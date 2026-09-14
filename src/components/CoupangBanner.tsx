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

export default function CoupangBanner() {
  // 설정이 없으면 자리 자체를 만들지 않는다. 빈 칸이 남으면 본문이 끊겨 보인다.
  if (!ID || !TRACKING) return null

  const src =
    `https://ads-partners.coupang.com/widgets.html?id=${encodeURIComponent(ID)}` +
    `&template=carousel&trackingCode=${encodeURIComponent(TRACKING)}` +
    `&subId=&width=680&height=140&tsource=`

  return (
    <aside className="no-print mt-10 border-t border-[var(--line)] pt-6">
      {/* 높이를 미리 잡아 둔다. 나중에 채워지면서 아래 내용이 밀리면
          레이아웃 이동으로 잡혀 페이지 평가가 깎인다. */}
      <div className="overflow-hidden rounded-lg" style={{ height: 140 }}>
        {/* sandbox 의 by-user-activation 이 핵심이다. 사람이 실제로 누른 경우에만
            이동을 허용하므로 광고 스크립트가 스스로 페이지를 옮길 수는 없다.
            이것이 없으면 모바일에서 쿠팡 앱으로 넘어가는 딥링크가 막혀 수수료
            추적이 끊긴다. */}
        <iframe
          src={src}
          title="쿠팡 파트너스 추천 상품"
          width="680"
          height="140"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          className="block w-full border-0"
          scrolling="no"
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
        이 배너는 쿠팡 파트너스 활동의 일환으로, 이를 통해 구매가 이루어지면
        운영자가 일정액의 수수료를 제공받습니다.
      </p>
    </aside>
  )
}
