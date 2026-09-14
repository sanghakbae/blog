import { deleteDoc, doc, getDoc, increment, onSnapshot, setDoc, writeBatch } from 'firebase/firestore'
import { db, isConfigured } from './firebase'
import { auth } from './authClient'

/**
 * 조회수와 좋아요.
 *
 * 둘 다 stats/{postId} 한 장에 센다. 글 문서에 넣지 않는 이유는, 글이 바뀌지도
 * 않았는데 조회할 때마다 updatedAt 이 움직이면 사이트맵의 lastmod 가 매번 바뀌어
 * 검색엔진이 lastmod 를 믿지 않게 되기 때문이다.
 *
 * 좋아요는 로그인한 사람만 누른다. 익명으로 받으면 누가 눌렀는지 저장할 곳이
 * 브라우저밖에 없어 몇 번이고 다시 눌러진다. 누른 사실은 posts/{id}/likes/{uid}
 * 문서의 존재로 남기고, 합계는 stats 에서 센다 — 합계를 매번 세면 좋아요가 많은
 * 글일수록 읽기가 늘어난다.
 */
export type Engagement = { views: number; likes: number }

const statsRef = (postId: string) => doc(db, 'stats', postId)
const likeRef = (postId: string, uid: string) => doc(db, 'posts', postId, 'likes', uid)

/** 이 브라우저에서 이미 센 글 — 새로고침마다 오르는 것을 막는다 */
const VIEWED = 'viewed:'

/**
 * 조회수를 한 번 올린다.
 *
 * 같은 사람이 새로고침할 때마다 오르면 숫자가 뜻을 잃는다. 브라우저에 표식을
 * 남겨 하루에 한 번만 센다. 완벽한 중복 제거는 아니지만, 로그인도 쿠키 동의도
 * 없이 할 수 있는 선에서는 이 정도가 맞다.
 */
export async function countView(postId: string): Promise<void> {
  if (!isConfigured) return
  const key = `${VIEWED}${postId}`
  try {
    const last = Number(localStorage.getItem(key) ?? 0)
    if (Date.now() - last < 24 * 60 * 60 * 1000) return
    localStorage.setItem(key, String(Date.now()))
  } catch {
    // 저장소가 막힌 브라우저 — 세는 것 자체는 계속한다
  }

  try {
    await setDoc(statsRef(postId), { views: increment(1) }, { merge: true })
  } catch {
    // 집계 실패가 글 읽기를 방해할 이유는 없다
  }
}

/** 조회수·좋아요 수를 구독한다. 다른 사람이 누르면 그 자리에서 바뀐다. */
export function subscribeEngagement(postId: string, cb: (e: Engagement) => void) {
  if (!isConfigured) return () => {}
  return onSnapshot(
    statsRef(postId),
    (snap) => cb({ views: snap.data()?.views ?? 0, likes: snap.data()?.likes ?? 0 }),
    () => cb({ views: 0, likes: 0 }),
  )
}

/** 내가 이 글에 좋아요를 눌렀는지 */
export async function hasLiked(postId: string): Promise<boolean> {
  const uid = auth.currentUser?.uid
  if (!isConfigured || !uid) return false
  try {
    return (await getDoc(likeRef(postId, uid))).exists()
  } catch {
    return false
  }
}

/**
 * 좋아요를 켜고 끈다. 바뀐 뒤 상태를 돌려준다.
 *
 * 표식과 합계를 한 배치로 쓴다. 따로 쓰면 둘 중 하나만 성공했을 때 합계가
 * 실제 누른 사람 수와 어긋난 채 남는다.
 */
export async function toggleLike(postId: string): Promise<boolean> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('로그인이 필요합니다.')

  const liked = await hasLiked(postId)
  const batch = writeBatch(db)
  if (liked) {
    batch.delete(likeRef(postId, uid))
    batch.set(statsRef(postId), { likes: increment(-1) }, { merge: true })
  } else {
    batch.set(likeRef(postId, uid), { at: new Date().toISOString() })
    batch.set(statsRef(postId), { likes: increment(1) }, { merge: true })
  }
  await batch.commit()
  return !liked
}

export { deleteDoc }
