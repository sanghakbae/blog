import { useEffect, useRef, useState } from 'react'

/**
 * 본문 끝에 붙는 쿠팡 파트너스 배너.
 *
 * 자리는 본문과 댓글 사이다. 다 읽은 뒤라 이탈 부담이 적고, 첫 화면을 밀어내지
 * 않아 레이아웃이 흔들리지 않는다. 글 위나 목차 아래에 넣으면 단가는 오르지만
 * 본문이 아래로 밀려 첫 화면 평가가 나빠진다.
 *
 * 쿠팡이 주는 코드는 그들의 자바스크립트를 우리 페이지에 불러오는 형태다.
 * 그러면 그 스크립트가 우리 DOM 과 같은 실행 맥락을 갖는다. 같은 배너를 iframe
 * 주소로도 받을 수 있어 그쪽을 쓴다 — 다른 출처의 프레임이라 우리 페이지의
 * 내용이나 로그인 상태에 접근하지 못한다.
 *
 * 공정거래위원회 추천·보증 심사지침상 대가를 받는다는 사실을 소비자가 쉽게 알
 * 수 있게 표시해야 한다. 배너 바로 아래에 적는다.
 */
const TRACKING = import.meta.env.VITE_COUPANG_TRACKING_CODE ?? ''

/**
 * 위젯 주소의 id 는 추적 코드에서 접두사를 뗀 숫자다.
 *
 * 쿠팡이 주는 코드에는 두 값이 따로 적혀 있지만 실제로는 같은 번호다.
 * id=AF5168844 는 400 을 돌려주고 id=5168844 는 정상으로 뜬다. 값을 두 번
 * 넣게 하면 한쪽만 바꿔 놓고 배너가 왜 안 나오는지 찾게 되므로 여기서 뽑는다.
 * 따로 지정해야 하는 경우를 대비해 덮어쓸 길은 남겨 둔다.
 */
const ID = import.meta.env.VITE_COUPANG_PARTNER_ID || TRACKING.replace(/\D/g, '')

const MAX_WIDTH = 680
const HEIGHT = 140

export default function CoupangBanner() {
  const box = useRef<HTMLDivElement>(null)
  /**
   * 실제로 그려질 폭을 재서 넘긴다.
   *
   * 680 으로 고정해 보내면 좁은 화면에서 위젯이 680px 짜리 배치를 만들고, 그것이
   * 343px 틀 안에서 잘려 아무것도 보이지 않는다. 모바일에서 배너가 안 뜨던
   * 이유가 이것이다. 화면에 맞춰 재서 알려 주는 것이 양쪽에서 맞는 유일한 방법이다.
   *
   * 한 번만 잰다. 창 크기가 바뀔 때마다 다시 보내면 주소가 바뀌어 iframe 이
   * 처음부터 다시 로드되고 노출 집계도 그만큼 중복된다.
   */
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = box.current
    if (!el) return

    const measure = (w: number) => {
      if (w > 0) setWidth((prev) => (prev > 0 ? prev : Math.min(Math.round(w), MAX_WIDTH)))
    }

    // 첫 배치에서 이미 폭이 나오면 그것을 쓴다.
    measure(el.getBoundingClientRect().width)

    // 나오지 않을 수도 있다. 본문이 아직 그려지는 중이거나 글꼴이 로드되기 전이면
    // 첫 측정이 0 으로 나오고, 한 번만 재는 구조에서는 그대로 멈춰 배너가 영영
    // 뜨지 않는다. 실제로 모바일에서 그렇게 됐다. 폭이 잡힐 때까지 지켜본다.
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0) {
        measure(w)
        ro.disconnect()
      }
    })
    ro.observe(el)

    // 그래도 못 재는 경우를 대비한 마지막 수단. 화면 폭에서 좌우 여백을 뺀다.
    const fallback = setTimeout(() => {
      measure(Math.min(window.innerWidth - 32, MAX_WIDTH))
      ro.disconnect()
    }, 1200)

    return () => {
      ro.disconnect()
      clearTimeout(fallback)
    }
  }, [])

  // 설정이 없으면 자리 자체를 만들지 않는다. 빈 칸이 남으면 본문이 끊겨 보인다.
  if (!ID || !TRACKING) return null

  const src =
    `https://ads-partners.coupang.com/widgets.html?id=${encodeURIComponent(ID)}` +
    `&template=carousel&trackingCode=${encodeURIComponent(TRACKING)}` +
    `&subId=&width=${width}&height=${HEIGHT}&tsource=`

  return (
    <aside className="no-print mt-10 border-t border-[var(--line)] pt-6">
      {/* 높이를 미리 잡아 둔다. 나중에 채워지면서 아래 내용이 밀리면 레이아웃
          이동으로 잡혀 페이지 평가가 깎인다. 폭은 URL 에 적은 값과 맞춘다 —
          늘려 두면 쿠팡이 그 폭을 채우려고 상품을 스무 개 가까이 밀어 넣는다. */}
      <div
        ref={box}
        className="mx-auto max-w-[680px] overflow-hidden rounded-lg"
        style={{ height: HEIGHT }}
      >
        {/* sandbox 에 allow-same-origin 이 필요하다. 없으면 프레임이 불투명한
            출처를 갖게 되어 그 안의 스크립트가 저장소에 손대는 순간 예외로 죽는다.
            프레임 내용이 다른 출처(쿠팡)이므로 이 값이 있어도 우리 페이지에는
            접근하지 못한다 — 위험해지는 조합은 같은 출처를 프레임에 담을 때다.

            by-user-activation 은 사람이 실제로 누른 경우에만 이동을 허용한다.
            없으면 모바일에서 쿠팡 앱으로 넘어가는 딥링크가 막혀 수수료 추적이
            끊기고, 있어도 광고가 스스로 페이지를 옮기지는 못한다. */}
        {/* 폭을 재기 전에는 만들지 않는다. 0 으로 한 번 부르고 다시 부르면
            노출이 두 번 집계된다. */}
        {width > 0 && (
          <iframe
            src={src}
            title="쿠팡 파트너스 추천 상품"
            width={width}
            height={HEIGHT}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
            className="block border-0"
            scrolling="no"
          />
        )}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
        이 배너는 쿠팡 파트너스 활동의 일환으로, 이를 통해 구매가 이루어지면
        운영자가 일정액의 수수료를 제공받습니다.
      </p>
    </aside>
  )
}
