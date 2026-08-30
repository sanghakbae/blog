import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp,
  setDoc, deleteDoc, where, writeBatch, increment, type Timestamp,
} from 'firebase/firestore'
import { db, isConfigured } from './firebase'
import { MAX_TAGS, makeExcerpt, normalizeTag } from './tags'
import { addAuditToBatch, logAudit } from './audit'

export type Post = {
  id: string
  title: string
  body: string
  excerpt: string
  tags: string[]
  published: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
  /** 검색 포털별 색인 확인 기록 */
  indexStatus?: Record<string, string>
}

export type Tag = { id: string; name: string; count: number }

/**
 * 개발 중 Firestore 에 접근할 수 없을 때 고정 데이터로 화면을 확인하기 위한 모드.
 * 운영 빌드에서는 조건이 상수 false 가 되어 코드가 제거된다.
 */
const USE_LOCAL = import.meta.env.DEV && import.meta.env.VITE_LOCAL_DATA === '1'

/** 설정이 없으면 네트워크 호출을 하지 않고 빈 결과를 돌려준다 */
const OFFLINE = !USE_LOCAL && !isConfigured

const postsCol = collection(db, 'posts')
const tagsCol = collection(db, 'tags')

function toPost(id: string, d: any): Post {
  return {
    id,
    title: d.title ?? '(제목 없음)',
    body: d.body ?? '',
    excerpt: d.excerpt ?? '',
    tags: Array.isArray(d.tags) ? d.tags : [],
    published: !!d.published,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    indexStatus: d.indexStatus ?? {},
  }
}

/**
 * 발행글 캐시.
 *
 * 홈, 검색, 태그 목록, 이전·다음 글, 에디터의 코퍼스가 모두 같은 글 목록을 본다.
 * 각자 조회하면 화면을 옮길 때마다 100건씩 읽게 되어 읽기 할당량이 금방 찬다.
 * 한 번 읽어 공유하고, 글이 바뀌면 비운다.
 */
const CACHE_TTL = 5 * 60 * 1000
const CACHE_LIMIT = 500
let cache: { at: number; posts: Post[] } | null = null

type SnapshotPost = Omit<Post, 'createdAt' | 'updatedAt'> & {
  createdAt?: string
  updatedAt?: string
}

const snapshotTimestamp = (value?: string) =>
  value ? ({ toDate: () => new Date(value) } as Timestamp) : undefined

async function loadPublishedSnapshot(): Promise<Post[]> {
  const response = await fetch('/posts.json')
  if (!response.ok) throw new Error(`글 스냅샷 조회 실패: ${response.status}`)
  const posts = (await response.json()) as SnapshotPost[]
  return posts.map((post) => ({
    ...post,
    published: true,
    createdAt: snapshotTimestamp(post.createdAt),
    updatedAt: snapshotTimestamp(post.updatedAt),
  }))
}

function tagsFromPosts(posts: Post[]): Tag[] {
  const counts = new Map<string, number>()
  for (const post of posts)
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts.entries()]
    .map(([id, count]) => ({ id, name: id, count }))
    .sort((a, b) => b.count - a.count)
}

async function loadPublished(): Promise<Post[]> {
  if (OFFLINE) return []
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.posts

  const firestorePosts = getDocs(
    query(
      postsCol,
      where('published', '==', true),
      orderBy('createdAt', 'desc'),
      limit(CACHE_LIMIT),
    ),
  ).then((snap) => snap.docs.map((d) => toPost(d.id, d.data())))

  try {
    // 정적 스냅샷을 먼저 그려 초기 화면에서 Firestore 왕복을 기다리지 않는다.
    const posts = await loadPublishedSnapshot()
    cache = { at: Date.now(), posts }
    void firestorePosts
      .then((fresh) => {
        if (fresh.length > 0) cache = { at: Date.now(), posts: fresh }
      })
      .catch((error) => console.warn('Firestore 글 갱신에 실패했습니다.', error))
  } catch (error) {
    console.warn('글 스냅샷 조회에 실패해 Firestore를 사용합니다.', error)
    cache = { at: Date.now(), posts: await firestorePosts }
  }
  return cache.posts
}

function invalidate() {
  cache = null
}

/** 발행된 글 목록 (최신순) */
export async function listPosts(max = 50): Promise<Post[]> {
  if (USE_LOCAL) return (await import('./localData')).localListPosts(max)
  return (await loadPublished()).slice(0, max)
}

/** 특정 태그가 달린 글 목록 */
export async function listPostsByTag(tag: string, max = 50): Promise<Post[]> {
  if (USE_LOCAL) return (await import('./localData')).localListByTag(tag, max)
  return (await loadPublished()).filter((p) => p.tags.includes(tag)).slice(0, max)
}

/** 관리자용 — 임시저장 포함 전체 */
export async function listAllPosts(max = 300): Promise<Post[]> {
  if (OFFLINE) return []
  if (USE_LOCAL) return (await import('./localData')).localListPosts(max, true)
  const snap = await getDocs(query(postsCol, orderBy('updatedAt', 'desc'), limit(max)))
  return snap.docs.map((d) => toPost(d.id, d.data()))
}

/** 이전·다음 글 — 이미 읽어둔 목록에서 계산한다 */
export async function getAdjacentPosts(post: Post): Promise<{ prev?: Post; next?: Post }> {
  if (USE_LOCAL) return (await import('./localData')).localAdjacent(post.id)

  const all = await loadPublished()
  const i = all.findIndex((p) => p.id === post.id)
  if (i < 0) return {}
  // 목록은 최신순이므로 앞이 다음 글, 뒤가 이전 글이다
  return { next: all[i - 1], prev: all[i + 1] }
}

export async function getPost(id: string): Promise<Post | null> {
  if (OFFLINE) return null
  if (USE_LOCAL) return (await import('./localData')).localGetPost(id)
  try {
    const snap = await getDoc(doc(postsCol, id))
    return snap.exists() ? toPost(snap.id, snap.data()) : null
  } catch {
    return (await loadPublished()).find((post) => post.id === id) ?? null
  }
}

/** 태그 분석의 기준이 되는 코퍼스 — 다른 글들의 제목·본문 */
export async function fetchCorpus(max = 200): Promise<{ title: string; body: string }[]> {
  if (USE_LOCAL)
    return (await import('./localData')).localListPosts(max).then((ps) =>
      ps.map((p) => ({ title: p.title, body: p.body })),
    )
  return (await loadPublished()).slice(0, max).map((p) => ({ title: p.title, body: p.body }))
}

/** 태그 목록 1회 조회 — 태그 분석 시 재사용 힌트로 넘긴다 */
export async function fetchTagNames(): Promise<string[]> {
  if (OFFLINE) return []
  if (USE_LOCAL) return (await import('./localData')).localTagNames()
  const snap = await getDocs(query(tagsCol, orderBy('count', 'desc'), limit(200)))
  return snap.docs.map((d) => d.id)
}

/** 사이드바용 태그 목록 구독 (글 수 많은 순) */
export function subscribeTags(cb: (tags: Tag[]) => void) {
  if (OFFLINE) {
    cb([])
    return () => {}
  }
  if (USE_LOCAL) {
    let stop: (() => void) | undefined
    import('./localData').then((m) => m.localSubscribeTags(cb).then((fn) => (stop = fn)))
    return () => stop?.()
  }
  try {
    // 실시간 구독 연결 전에 스냅샷 태그를 먼저 표시한다.
    loadPublishedSnapshot().then((posts) => cb(tagsFromPosts(posts))).catch(() => {})
    return onSnapshot(
      query(tagsCol, orderBy('count', 'desc'), limit(300)),
      (snap) => {
        const tags = snap.docs
          .map((d) => ({ id: d.id, name: d.data().name ?? d.id, count: d.data().count ?? 0 }))
          .filter((t) => t.count > 0)
        if (tags.length > 0) cb(tags)
        else loadPublishedSnapshot().then((posts) => cb(tagsFromPosts(posts))).catch(() => cb([]))
      },
      // 권한이 없거나 네트워크가 막혀도 화면은 떠야 한다
      (err) => {
        console.warn('태그를 불러오지 못했습니다', err)
        loadPublishedSnapshot().then((posts) => cb(tagsFromPosts(posts))).catch(() => cb([]))
      },
    )
  } catch (err) {
    console.warn('태그 구독을 시작하지 못했습니다', err)
    cb([])
    return () => {}
  }
}

/**
 * 글 저장 + 태그 집계.
 * 태그는 본문을 분석해 얻은 값(최대 3개)을 그대로 저장하고,
 * 이전 태그와 비교해 늘어난/빠진 태그만 tags 컬렉션 카운트에 반영한다.
 */
export async function savePost(
  id: string | null,
  input: { title: string; body: string; published: boolean; tags: string[]; wasPublished?: boolean },
): Promise<string> {
  const tagsInput = [...new Set(input.tags.map(normalizeTag).filter(Boolean))].slice(0, MAX_TAGS)

  if (USE_LOCAL) {
    const local = await import('./localData')
    const savedId = await local.localSavePost(id, {
      title: input.title.trim(),
      body: input.body,
      excerpt: makeExcerpt(input.body),
      published: input.published,
      tags: tagsInput,
    })
    invalidate()
    await logAudit(
      !id ? 'post.create' : input.published !== input.wasPublished
        ? (input.published ? 'post.publish' : 'post.unpublish')
        : 'post.update',
      savedId,
      `${input.title.trim()} · 태그 ${tagsInput.join(', ') || '없음'}`,
    )
    return savedId
  }

  const postRef = id ? doc(postsCol, id) : doc(postsCol)
  const prev = id ? await getDoc(postRef) : null
  const prevData = prev?.exists() ? prev.data() : null
  const prevTags: string[] = prevData?.published ? (prevData.tags ?? []) : []

  const tags = tagsInput
  const nextTags = input.published ? tags : []

  const batch = writeBatch(db)
  batch.set(
    postRef,
    {
      title: input.title.trim(),
      body: input.body,
      excerpt: makeExcerpt(input.body),
      tags,
      published: input.published,
      createdAt: prevData?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  for (const t of nextTags.filter((t) => !prevTags.includes(t)))
    batch.set(doc(tagsCol, t), { name: t, count: increment(1) }, { merge: true })
  for (const t of prevTags.filter((t) => !nextTags.includes(t)))
    batch.set(doc(tagsCol, t), { name: t, count: increment(-1) }, { merge: true })

  // 감사 로그는 같은 배치에 넣어 저장과 함께 원자적으로 남긴다
  const action = !id
    ? 'post.create'
    : input.published && !input.wasPublished
      ? 'post.publish'
      : !input.published && input.wasPublished
        ? 'post.unpublish'
        : 'post.update'
  addAuditToBatch(batch, action, postRef.id, `${input.title.trim()} · 태그 ${tags.join(', ') || '없음'}`)

  await batch.commit()
  invalidate()
  return postRef.id
}

export async function deletePost(id: string, title = ''): Promise<void> {
  if (USE_LOCAL) {
    const local = await import('./localData')
    await local.localDeletePost(id)
    return logAudit('post.delete', id, title)
  }

  const postRef = doc(postsCol, id)
  const snap = await getDoc(postRef)
  const data = snap.data()
  const batch = writeBatch(db)
  if (data?.published) {
    for (const t of (data.tags ?? []) as string[])
      batch.set(doc(tagsCol, t), { name: t, count: increment(-1) }, { merge: true })
  }
  batch.delete(postRef)
  addAuditToBatch(batch, 'post.delete', id, title || (data?.title ?? ''))
  await batch.commit()
  invalidate()
}

export { deleteDoc, setDoc }
