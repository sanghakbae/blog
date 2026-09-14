/**
 * 쿠팡 파트너스 추천 상품을 받아 온다.
 *
 * 쿠팡이 주는 배너는 iframe 이나 그들의 스크립트를 쓴다. 둘 다 카카오톡·인스타그램
 * 같은 앱 안의 웹뷰에서는 막혀 아무것도 그려지지 않는다. 실제로 모바일에서 배너가
 * 비어 보이던 원인이다.
 *
 * 그래서 데이터만 받아 와 화면이 직접 그린다. 상품 이미지는 쿠팡 CDN 에서
 * 그대로 불러오고, 누르면 추적 링크로 나간다 — 프레임도 외부 스크립트도 쓰지
 * 않으므로 어디서나 뜬다.
 *
 * 브라우저가 직접 받아 올 수는 없다. 쿠팡이 다른 출처의 요청을 허용하지 않아
 * CORS 에서 막힌다. 워커가 대신 받아 정리해 넘긴다.
 */

const WIDGET = 'https://ads-partners.coupang.com/widgets.html'
/** 같은 목록을 잠깐 재사용한다. 방문자마다 쿠팡을 두드릴 이유가 없다. */
const CACHE_SECONDS = 600
const MAX_ITEMS = 12

export type CoupangItem = {
  name: string
  image: string
  url: string
  price: number
  discountRate: number
}

type RawItem = {
  name?: string
  imagePath?: string
  landingUrl?: string
  salesPrice?: number
  discountRate?: number
}

export async function fetchCoupangItems(
  env: Env,
  width: number,
): Promise<{ status: number; body: Record<string, unknown>; cache: boolean }> {
  const tracking = env.COUPANG_TRACKING_CODE ?? ''
  if (!tracking) return { status: 503, body: { error: '추적 코드가 설정되지 않았습니다' }, cache: false }

  // 위젯 주소의 id 는 추적 코드에서 접두사를 뗀 숫자다. AF 가 붙은 채로 보내면 400 이 온다.
  const id = tracking.replace(/\D/g, '')
  const url =
    `${WIDGET}?id=${id}&template=carousel&trackingCode=${encodeURIComponent(tracking)}` +
    `&subId=&width=${width}&height=140&tsource=`

  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0' },
    cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
  })
  if (!res.ok) return { status: 502, body: { error: `쿠팡 응답 ${res.status}` }, cache: false }

  const html = await res.text()
  // 위젯 HTML 안에 상품 목록이 JSON 으로 들어 있다. 그 인자만 떼어낸다.
  const m = /new PartnersCoupang\.\w+\("#container",\s*(\{[\s\S]*\})\);/.exec(html)
  if (!m) return { status: 502, body: { error: '상품 목록을 찾지 못했습니다' }, cache: false }

  let data: { items?: RawItem[]; config?: { coupangCdnBaseUrl?: string } }
  try {
    data = JSON.parse(m[1])
  } catch {
    return { status: 502, body: { error: '상품 목록을 읽지 못했습니다' }, cache: false }
  }

  const base = data.config?.coupangCdnBaseUrl ?? 'https://static.coupangcdn.com/'
  const items: CoupangItem[] = (data.items ?? [])
    .filter((it) => it.name && it.imagePath && it.landingUrl)
    .slice(0, MAX_ITEMS)
    .map((it) => ({
      name: String(it.name).slice(0, 120),
      image: base + it.imagePath,
      url: String(it.landingUrl),
      price: Number(it.salesPrice ?? 0),
      discountRate: Math.round(Number(it.discountRate ?? 0)),
    }))

  if (items.length === 0) return { status: 502, body: { error: '상품이 없습니다' }, cache: false }
  return { status: 200, body: { items }, cache: true }
}

declare global {
  interface Env {
    /** 쿠팡 파트너스 추적 코드. 비밀이 아니라 페이지에 드러나는 값이다. */
    COUPANG_TRACKING_CODE?: string
  }
}

export { CACHE_SECONDS }
