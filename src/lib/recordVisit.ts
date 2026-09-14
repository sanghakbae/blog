import { auth } from './authClient'

const ENDPOINT = import.meta.env.VITE_UPLOAD_ENDPOINT ?? ''

/**
 * 글을 열었다고 워커에 알린다.
 *
 * 브라우저가 직접 기록하지 않는 이유는 두 가지다. 출발지 주소와 지역은 서버만
 * 알 수 있고, 로그인한 사람의 신원은 토큰을 검증해야 알 수 있다. 브라우저가
 * 보내는 값을 그대로 믿으면 기록이 아니라 주장이 된다.
 *
 * 화면 전환마다 부른다. 조회수(engagement.ts)는 하루 한 번만 세지만 방문 기록은
 * 매번 남긴다 — 세는 것과 남기는 것은 목적이 다르다.
 *
 * 실패해도 아무것도 하지 않는다. 글을 읽는 데 지장이 없어야 한다.
 */
export function recordVisit(postId: string): void {
  if (!ENDPOINT) return

  const send = (token?: string) => {
    void fetch(`${ENDPOINT}/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ postId, referrer: document.referrer || '' }),
      // 화면을 옮기는 중에 끊기지 않게 한다
      keepalive: true,
    }).catch(() => {
      /* 기록 실패는 조용히 넘긴다 */
    })
  }

  // 로그인한 사람이면 토큰을 붙인다. 토큰을 기다리느라 기록이 늦어지지 않게,
  // 이미 로그인된 경우에만 가져오고 아니면 익명으로 바로 보낸다.
  const user = auth.currentUser
  if (!user) return send()
  user
    .getIdToken()
    .then(send)
    .catch(() => send())
}
