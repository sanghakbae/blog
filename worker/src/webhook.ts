/**
 * 로그인·댓글 같은 일이 생기면 웹훅으로 알린다.
 *
 * 주소는 경로에 토큰이 들어 있어 그 자체가 비밀이다. 저장소가 공개라 vars 에 두면
 * 그대로 공개되므로 시크릿으로 받는다:
 *   npx wrangler secret put WEBHOOK_URL
 *
 * 알림은 부수적인 일이다. 웹훅이 죽었다고 댓글 저장이나 로그인이 실패하면 안 되므로
 * 실패는 삼키고 로그만 남긴다. 부르는 쪽도 await 하지 않아도 된다.
 */

declare global {
  interface Env {
    /** 알림을 받을 웹훅 주소. 없으면 알림만 꺼진다. */
    WEBHOOK_URL?: string
  }
}

export type WebhookEvent = {
  /** 'login' | 'comment' — 받는 쪽에서 거를 수 있게 종류를 따로 싣는다 */
  event: string
  /** 사람이 읽는 한 줄. 형식을 모르는 수신기라도 이것만 보면 된다. */
  text: string
  [key: string]: unknown
}

export async function sendWebhook(env: Env, payload: WebhookEvent): Promise<void> {
  if (!env.WEBHOOK_URL) return
  try {
    const res = await fetch(env.WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ...payload, site: env.SITE_URL, at: new Date().toISOString() }),
    })
    if (!res.ok) console.warn('웹훅 실패', res.status, (await res.text()).slice(0, 200))
  } catch (err) {
    console.warn('웹훅 실패', err)
  }
}
