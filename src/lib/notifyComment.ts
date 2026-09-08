import { auth } from './authClient'

const ENDPOINT = import.meta.env.VITE_UPLOAD_ENDPOINT ?? ''

/**
 * 새 댓글을 운영자에게 메일로 알리라고 워커에 요청한다.
 *
 * 메일은 브라우저가 아니라 워커가 보낸다. 워커는 토큰으로 요청자를 확인하고,
 * Firestore 에서 그 댓글이 실제로 있고 요청자가 쓴 것인지 대조한 뒤에만 보낸다.
 * 그래서 이 호출이 실패해도 댓글은 이미 저장된 상태고, 사용자에게 알릴 일이
 * 아니다 — 조용히 넘기고 콘솔에만 남긴다.
 */
export async function notifyComment(postId: string, commentId: string): Promise<void> {
  if (!ENDPOINT) return
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return
    const res = await fetch(`${ENDPOINT}/notify-comment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, commentId }),
      keepalive: true,
    })
    if (!res.ok) console.warn('댓글 알림 요청 실패', res.status, await res.text())
  } catch (err) {
    console.warn('댓글 알림 요청 실패', err)
  }
}
