/**
 * 방문 기록.
 *
 * 누가·언제·어디서·어떤 글을 봤는지를 남긴다. Firestore 에 쓰면 조회 한 번이
 * 쓰기 한 번이라 비용이 조회수에 비례한다. Analytics Engine 은 이런 용도로
 * 만들어진 저장소라 쓰기가 사실상 공짜고 SQL 로 조회할 수 있다.
 *
 * "누가" 를 남기는 것이 이 기능에서 가장 무거운 부분이다. 한국에서 IP 는
 * 개인정보라 그대로 쌓으면 수집 항목이 되고 유출 시 신고 의무가 생긴다.
 * 그래서 원본을 저장하지 않고 날짜별 소금을 섞어 해시한다:
 *
 *   - 같은 날 같은 방문자는 같은 값 → "몇 명이 봤나" 를 셀 수 있다
 *   - 날이 바뀌면 값이 달라진다 → 며칠에 걸친 추적이 불가능하다
 *   - 소금을 모르면 되돌릴 수 없다 → 저장된 값만으로는 IP 를 알 수 없다
 *
 * 로그인한 사람은 토큰에서 꺼낸 uid 를 함께 남긴다. 브라우저가 말하는 값이
 * 아니라 검증된 값이라 위조할 수 없다.
 */
import { verifyIdToken } from './auth'

declare global {
  interface Env {
    /** Analytics Engine 데이터셋. wrangler.jsonc 의 analytics_engine_datasets */
    VISITS?: AnalyticsEngineDataset
    /** 해시에 섞는 소금. npx wrangler secret put VISIT_SALT */
    VISIT_SALT?: string
  }
}

const ID = /^[A-Za-z0-9_-]{1,80}$/

/** 날짜가 바뀌면 같은 방문자도 다른 값이 된다 — 장기 추적을 막는다 */
async function visitorHash(ip: string, salt: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10)
  const data = new TextEncoder().encode(`${day}:${salt}:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function recordVisit(
  req: Request,
  env: Env,
): Promise<{ status: number; body: Record<string, unknown> }> {
  // 입력 검증을 저장소 확인보다 먼저 한다. 잘못된 요청은 저장소가 있든 없든
  // 잘못된 요청이고, 뒤에 두면 저장소가 꺼져 있는 동안 검증을 시험할 수 없다.
  let input: { postId?: unknown; referrer?: unknown }
  try {
    input = (await req.json()) as typeof input
  } catch {
    return { status: 400, body: { error: '본문이 JSON 이 아닙니다' } }
  }
  const postId = typeof input.postId === 'string' && ID.test(input.postId) ? input.postId : ''
  if (!postId) return { status: 400, body: { error: 'postId 가 필요합니다' } }

  if (!env.VISITS) return { status: 503, body: { error: '기록 저장소가 설정되지 않았습니다' } }

  // 들어오는 문자열은 전부 길이를 자른다. 저장소가 아니라 우리 쪽을 지키는 것이다.
  const cut = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '')

  const ip = req.headers.get('cf-connecting-ip') ?? ''
  const salt = env.VISIT_SALT ?? ''
  // 소금이 없으면 되돌릴 수 있는 해시가 되므로 방문자 구분을 포기한다.
  const visitor = ip && salt ? await visitorHash(ip, salt) : ''

  // 로그인했으면 누구인지까지 남긴다. 토큰이 없거나 틀리면 그냥 익명이다.
  let uid = ''
  const token = /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '')?.[1]
  if (token) {
    try {
      uid = (await verifyIdToken(token, env.FIREBASE_PROJECT_ID))?.sub ?? ''
    } catch {
      // 검증 실패는 익명과 같게 다룬다 — 기록이 실패할 이유가 아니다
    }
  }

  const cf = (req as Request & { cf?: Record<string, unknown> }).cf ?? {}

  env.VISITS.writeDataPoint({
    // 색인은 하나만 둘 수 있다. 조회는 대개 "이 글을 몇 명이 봤나" 로 시작한다.
    indexes: [postId],
    blobs: [
      postId,
      visitor,
      uid,
      cut(cf.country, 8),
      cut(cf.city, 40),
      cut(req.headers.get('user-agent'), 180),
      cut(input.referrer, 200),
    ],
    doubles: [uid ? 1 : 0],
  })

  return { status: 200, body: { ok: true } }
}
