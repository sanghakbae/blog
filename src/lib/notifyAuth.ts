import { auth } from './authClient'

const ENDPOINT = import.meta.env.VITE_UPLOAD_ENDPOINT ?? ''

/**
 * 로그인했다고 워커에 알린다. 워커가 웹훅으로 흘려보낸다.
 *
 * 웹훅 주소는 경로에 토큰이 들어 있어 비밀이다. 브라우저에서 직접 부르면 번들에
 * 그대로 박혀 누구나 아무 알림이나 보낼 수 있게 되므로, 워커만 알고 있게 한다.
 * 이메일도 브라우저가 말하는 값이 아니라 워커가 토큰에서 꺼낸 값을 쓴다.
 *
 * 알림이 실패해도 로그인은 이미 끝난 상태다. 사용자에게 알릴 일이 아니라
 * 조용히 넘기고 콘솔에만 남긴다.
 */
export async function notifyAuth(): Promise<void> {
  if (!ENDPOINT) return
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return
    const res = await fetch(`${ENDPOINT}/notify-auth`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      keepalive: true,
    })
    if (!res.ok) console.warn('로그인 알림 실패', res.status)
  } catch (err) {
    console.warn('로그인 알림 실패', err)
  }
}
