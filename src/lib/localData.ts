/**
 * 개발 전용 인메모리 저장소.
 *
 * Firestore 접근이 불가능한 환경에서도 읽기와 쓰기, 관리 콘솔까지 전부
 * 확인할 수 있게 한다. `npx tsx scripts/seed.mts --local` 로 만든 고정 데이터를
 * 초기값으로 읽는다. 감사 로그와 보안 설정은 새로고침해도 남아야 의미가 있으므로
 * 브라우저 저장소에 함께 기록한다. 글 수정은 메모리에만 남는다.
 * VITE_LOCAL_DATA=1 일 때만 쓰인다.
 */
import type { Post, Tag } from './posts'
import type { AuditAction, AuditEntry } from './audit'
import { DEFAULT_SETTINGS, type SecuritySettings } from './settings'

type Raw = {
  posts: (Omit<Post, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string })[]
  tags: Tag[]
}

const ts = (d: Date) => ({ toDate: () => d }) as Post['createdAt']

type Store = {
  posts: Post[]
  tags: Map<string, number>
  audit: AuditEntry[]
  settings: SecuritySettings
}

const PERSIST_KEY = 'localdata:v1'

/** 감사 로그와 보안 설정만 브라우저에 남긴다 (글 본문까지 넣으면 용량이 크다) */
function persist(s: Store) {
  try {
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        settings: s.settings,
        audit: s.audit.map((e) => ({ ...e, at: e.at?.toDate?.().toISOString() })),
      }),
    )
  } catch {
    // 저장소가 가득 찼거나 차단된 경우 — 개발 편의 기능이므로 조용히 넘어간다
  }
}

function restore(s: Store) {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as {
      settings?: SecuritySettings
      audit?: (Omit<AuditEntry, 'at'> & { at?: string })[]
    }
    if (saved.settings) s.settings = { ...s.settings, ...saved.settings }
    if (saved.audit)
      s.audit = saved.audit.map((e) => ({
        ...e,
        at: e.at ? (ts(new Date(e.at)) as AuditEntry['at']) : undefined,
      }))
  } catch {
    // 형식이 바뀌었으면 무시하고 초기 상태로 간다
  }
}

let store: Store | null = null
const tagSubs = new Set<(t: Tag[]) => void>()
const settingSubs = new Set<(s: SecuritySettings) => void>()

async function load(): Promise<Store> {
  if (store) return store
  const data = (await import('../dev/seed-data.json')).default as Raw
  store = {
    posts: data.posts
      .map((p) => ({ ...p, createdAt: ts(new Date(p.createdAt)), updatedAt: ts(new Date(p.updatedAt)) }))
      .sort((a, b) => b.createdAt!.toDate().getTime() - a.createdAt!.toDate().getTime()),
    tags: new Map(data.tags.map((t) => [t.id, t.count])),
    audit: [],
    settings: { ...DEFAULT_SETTINGS },
  }
  restore(store)
  return store
}

function tagList(s: Store): Tag[] {
  return [...s.tags.entries()]
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ id, name: id, count }))
    .sort((a, b) => b.count - a.count)
}

const notifyTags = (s: Store) => tagSubs.forEach((cb) => cb(tagList(s)))

// ── 글 ──────────────────────────────────────────────────────────────────────

export async function localListPosts(max: number, includeDrafts = false): Promise<Post[]> {
  const s = await load()
  return s.posts.filter((p) => includeDrafts || p.published).slice(0, max)
}

export async function localListByTag(tag: string, max: number): Promise<Post[]> {
  const s = await load()
  return s.posts.filter((p) => p.published && p.tags.includes(tag)).slice(0, max)
}

export async function localGetPost(id: string): Promise<Post | null> {
  return (await load()).posts.find((p) => p.id === id) ?? null
}

export async function localAdjacent(id: string): Promise<{ prev?: Post; next?: Post }> {
  const published = (await load()).posts.filter((p) => p.published)
  const i = published.findIndex((p) => p.id === id)
  if (i < 0) return {}
  // 목록은 최신순이므로 앞이 다음 글, 뒤가 이전 글이다
  return { next: published[i - 1], prev: published[i + 1] }
}

export async function localSavePost(
  id: string | null,
  input: { title: string; body: string; excerpt: string; published: boolean; tags: string[] },
): Promise<string> {
  const s = await load()
  const existing = id ? s.posts.find((p) => p.id === id) : undefined
  const prevTags = existing?.published ? existing.tags : []
  const nextTags = input.published ? input.tags : []

  for (const t of prevTags) s.tags.set(t, (s.tags.get(t) ?? 1) - 1)
  for (const t of nextTags) s.tags.set(t, (s.tags.get(t) ?? 0) + 1)

  const now = ts(new Date())
  if (existing) {
    Object.assign(existing, { ...input, updatedAt: now })
  } else {
    s.posts.unshift({ id: id ?? crypto.randomUUID(), ...input, createdAt: now, updatedAt: now })
  }
  notifyTags(s)
  return existing?.id ?? s.posts[0].id
}

export async function localDeletePost(id: string): Promise<void> {
  const s = await load()
  const post = s.posts.find((p) => p.id === id)
  if (post?.published) for (const t of post.tags) s.tags.set(t, (s.tags.get(t) ?? 1) - 1)
  s.posts = s.posts.filter((p) => p.id !== id)
  notifyTags(s)
}

// ── 태그 ────────────────────────────────────────────────────────────────────

export async function localSubscribeTags(cb: (tags: Tag[]) => void) {
  tagSubs.add(cb)
  cb(tagList(await load()))
  return () => tagSubs.delete(cb)
}

export async function localTagNames(): Promise<string[]> {
  return tagList(await load()).map((t) => t.id)
}

// ── 감사 로그 ───────────────────────────────────────────────────────────────

export async function localAddAudit(
  action: AuditAction,
  actor: { uid: string; email: string },
  target: string,
  detail: string,
): Promise<void> {
  const s = await load()
  s.audit.unshift({
    id: crypto.randomUUID(),
    at: ts(new Date()) as AuditEntry['at'],
    action,
    actorEmail: actor.email,
    actorUid: actor.uid,
    target,
    detail,
  })
  persist(s)
}

export async function localListAudit(max: number): Promise<AuditEntry[]> {
  return (await load()).audit.slice(0, max)
}

// ── 보안 설정 ───────────────────────────────────────────────────────────────

export async function localGetSettings(): Promise<SecuritySettings> {
  return { ...(await load()).settings }
}

export async function localSubscribeSettings(cb: (s: SecuritySettings) => void) {
  settingSubs.add(cb)
  cb(await localGetSettings())
  return () => settingSubs.delete(cb)
}

export async function localUpdateSettings(patch: Partial<SecuritySettings>): Promise<void> {
  const s = await load()
  s.settings = { ...s.settings, ...patch }
  persist(s)
  settingSubs.forEach((cb) => cb({ ...s.settings }))
}
