/**
 * 쿠팡 추천 상품을 빌드할 때 받아 dist/coupang.json 에 넣는다.
 *
 * 화면이 실행 중에 외부를 부르면 실패할 자리가 너무 많다. 쿠팡 프레임은 앱 안의
 * 웹뷰에서 막히고, 워커를 거치면 다른 출처라 CORS·차단 목록·회선 정책에 걸린다.
 * 실제로 모바일에서 계속 비어 보였다.
 *
 * 빌드할 때 받아 우리 도메인에 파일로 두면 그 자리들이 전부 사라진다. 화면은
 * 같은 출처의 정적 파일 하나만 읽으면 되고, 그것은 글 본문과 똑같은 경로다.
 * 목록은 배포마다 갱신되므로 하루 두 번 바뀐다 — 추천 상품에는 충분하다.
 *
 * 받지 못하면 빈 목록을 쓴다. 광고를 못 받은 것이 배포를 막을 이유는 없다.
 */
import { writeFileSync } from 'node:fs'

const TRACKING = process.env.VITE_COUPANG_TRACKING_CODE ?? ''
const OUT = 'dist/coupang.json'
const MAX_ITEMS = 12

type RawItem = {
  name?: string
  imagePath?: string
  landingUrl?: string
  salesPrice?: number
  discountRate?: number
}

async function load(): Promise<unknown[]> {
  if (!TRACKING) {
    console.log('쿠팡 추적 코드가 없어 건너뜁니다.')
    return []
  }

  // 위젯 주소의 id 는 추적 코드에서 접두사를 뗀 숫자다. AF 가 붙으면 400 이 온다.
  const id = TRACKING.replace(/\D/g, '')
  const url =
    `https://ads-partners.coupang.com/widgets.html?id=${id}` +
    `&template=carousel&trackingCode=${encodeURIComponent(TRACKING)}` +
    `&subId=&width=680&height=140&tsource=`

  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
  if (!res.ok) {
    console.warn(`쿠팡 응답 ${res.status} — 빈 목록으로 둡니다.`)
    return []
  }

  // 위젯 HTML 안에 상품 목록이 JSON 으로 들어 있다. 그 인자만 떼어낸다.
  const html = await res.text()
  const m = /new PartnersCoupang\.\w+\("#container",\s*(\{[\s\S]*\})\);/.exec(html)
  if (!m) {
    console.warn('상품 목록을 찾지 못했습니다 — 빈 목록으로 둡니다.')
    return []
  }

  const data = JSON.parse(m[1]) as {
    items?: RawItem[]
    config?: { coupangCdnBaseUrl?: string }
  }
  const base = data.config?.coupangCdnBaseUrl ?? 'https://static.coupangcdn.com/'

  return (data.items ?? [])
    .filter((it) => it.name && it.imagePath && it.landingUrl)
    .slice(0, MAX_ITEMS)
    .map((it) => ({
      name: String(it.name).slice(0, 120),
      image: base + it.imagePath,
      url: String(it.landingUrl),
      price: Number(it.salesPrice ?? 0),
      discountRate: Math.round(Number(it.discountRate ?? 0)),
    }))
}

let items: unknown[] = []
try {
  items = await load()
} catch (err) {
  console.warn(`쿠팡 상품을 받지 못했습니다 — ${(err as Error).message}`)
}

writeFileSync(OUT, JSON.stringify({ items, at: new Date().toISOString() }))
console.log(`쿠팡 상품 ${items.length}개 → ${OUT}`)
