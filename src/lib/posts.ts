import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp,
  setDoc, deleteDoc, where, writeBatch, increment, type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
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
}

export type Tag = { id: string; name: string; count: number }

/**
 * 개발 중 Firestore 에 접근할 수 없을 때 고정 데이터로 화면을 확인하기 위한 모드.
 * 운영 빌드에서는 조건이 상수 false 가 되어 코드가 제거된다.
 */
const USE_LOCAL = import.meta.env.DEV && import.meta.env.VITE_LOCAL_DATA === '1'

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
  }
}

/** 발행된 글 목록 (최신순) */
export async function listPosts(max = 50): Promise<Post[]> {
  if (USE_LOCAL) return (await import('./localData')).localListPosts(max)
  const snap = await getDocs(
    query(postsCol, where('published', '==', true), orderBy('createdAt', 'desc'), limit(max)),
  )
  return snap.docs.map((d) => toPost(d.id, d.data()))
}

/** 특정 태그가 달린 글 목록 */
export async function listPostsByTag(tag: string, max = 50): Promise<Post[]> {
  if (USE_LOCAL) return (await import('./localData')).localListByTag(tag, max)
  const snap = await getDocs(
    query(
      postsCol,
      where('published', '==', true),
      where('tags', 'array-contains', tag),
      orderBy('createdAt', 'desc'),
      limit(max),
    ),
  )
  return snap.docs.map((d) => toPost(d.id, d.data()))
}

/** 관리자용 — 임시저장 포함 전체 */
export async function listAllPosts(max = 100): Promise<Post[]> {
  if (USE_LOCAL) return (await import('./localData')).localListPosts(max, true)
  const snap = await getDocs(query(postsCol, orderBy('updatedAt', 'desc'), limit(max)))
  return snap.docs.map((d) => toPost(d.id, d.data()))
}

export async function getPost(id: string): Promise<Post | null> {
  if (USE_LOCAL) return (await import('./localData')).localGetPost(id)
  const snap = await getDoc(doc(postsCol, id))
  return snap.exists() ? toPost(snap.id, snap.data()) : null
}

/** 태그 분석의 기준이 되는 코퍼스 — 다른 글들의 제목·본문 */
export async function fetchCorpus(max = 100): Promise<{ title: string; body: string }[]> {
  if (USE_LOCAL)
    return (await import('./localData')).localListPosts(max).then((ps) =>
      ps.map((p) => ({ title: p.title, body: p.body })),
    )
  const snap = await getDocs(query(postsCol, orderBy('updatedAt', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ title: d.data().title ?? '', body: d.data().body ?? '' }))
}

/** 태그 목록 1회 조회 — 태그 분석 시 재사용 힌트로 넘긴다 */
export async function fetchTagNames(): Promise<string[]> {
  if (USE_LOCAL) return (await import('./localData')).localTagNames()
  const snap = await getDocs(query(tagsCol, orderBy('count', 'desc'), limit(200)))
  return snap.docs.map((d) => d.id)
}

/** 사이드바용 태그 목록 구독 (글 수 많은 순) */
export function subscribeTags(cb: (tags: Tag[]) => void) {
  if (USE_LOCAL) {
    let stop: (() => void) | undefined
    import('./localData').then((m) => m.localSubscribeTags(cb).then((fn) => (stop = fn)))
    return () => stop?.()
  }
  return onSnapshot(query(tagsCol, orderBy('count', 'desc'), limit(100)), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ id: d.id, name: d.data().name ?? d.id, count: d.data().count ?? 0 }))
        .filter((t) => t.count > 0),
    )
  })
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
}

export { deleteDoc, setDoc }
