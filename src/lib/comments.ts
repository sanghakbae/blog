import {
  addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp,
  updateDoc, type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export type Comment = {
  id: string
  body: string
  authorUid: string
  authorName: string
  authorPhoto: string | null
  createdAt?: Timestamp
  /** 수정된 적이 있으면 그 시각이 남는다 */
  editedAt?: Timestamp
}

export const MAX_COMMENT_LENGTH = 1000

const USE_LOCAL = import.meta.env.DEV && import.meta.env.VITE_LOCAL_DATA === '1'

/** 개발용 로컬 모드에서만 쓰는 메모리 저장소 */
const localStore = new Map<string, Comment[]>()
const localSubs = new Map<string, Set<(c: Comment[]) => void>>()

function localNotify(postId: string) {
  const list = localStore.get(postId) ?? []
  localSubs.get(postId)?.forEach((cb) => cb([...list]))
}

const commentsCol = (postId: string) => collection(db, 'posts', postId, 'comments')

/** 댓글 목록 실시간 구독 (오래된 것부터) */
export function subscribeComments(postId: string, cb: (comments: Comment[]) => void) {
  if (USE_LOCAL) {
    const subs = localSubs.get(postId) ?? new Set()
    subs.add(cb)
    localSubs.set(postId, subs)
    cb([...(localStore.get(postId) ?? [])])
    return () => subs.delete(cb)
  }

  return onSnapshot(
    query(commentsCol(postId), orderBy('createdAt', 'asc'), limit(200)),
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            body: data.body ?? '',
            authorUid: data.authorUid ?? '',
            authorName: data.authorName ?? '이름 없음',
            authorPhoto: data.authorPhoto ?? null,
            createdAt: data.createdAt,
            editedAt: data.editedAt,
          }
        }),
      ),
    () => cb([]),
  )
}

export async function addComment(
  postId: string,
  input: { body: string; authorUid: string; authorName: string; authorPhoto: string | null },
): Promise<void> {
  const body = input.body.trim().slice(0, MAX_COMMENT_LENGTH)
  if (!body) throw new Error('내용을 입력하세요.')

  if (USE_LOCAL) {
    const list = localStore.get(postId) ?? []
    list.push({
      id: crypto.randomUUID(),
      body,
      authorUid: input.authorUid,
      authorName: input.authorName,
      authorPhoto: input.authorPhoto,
      createdAt: { toDate: () => new Date() } as Timestamp,
    })
    localStore.set(postId, list)
    return localNotify(postId)
  }

  await addDoc(commentsCol(postId), { ...input, body, createdAt: serverTimestamp() })
}

/** 댓글 수정. 규칙상 작성자 본인만 가능하며 본문만 바뀐다. */
export async function editComment(
  postId: string,
  commentId: string,
  nextBody: string,
): Promise<void> {
  const body = nextBody.trim().slice(0, MAX_COMMENT_LENGTH)
  if (!body) throw new Error('내용을 입력하세요.')

  if (USE_LOCAL) {
    const list = localStore.get(postId) ?? []
    const target = list.find((c) => c.id === commentId)
    if (target) {
      target.body = body
      target.editedAt = { toDate: () => new Date() } as Timestamp
    }
    return localNotify(postId)
  }

  await updateDoc(doc(commentsCol(postId), commentId), { body, editedAt: serverTimestamp() })
}

export async function removeComment(postId: string, commentId: string): Promise<void> {
  if (USE_LOCAL) {
    localStore.set(postId, (localStore.get(postId) ?? []).filter((c) => c.id !== commentId))
    return localNotify(postId)
  }
  await deleteDoc(doc(commentsCol(postId), commentId))
}
