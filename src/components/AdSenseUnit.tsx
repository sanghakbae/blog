import { useEffect, useRef } from 'react'

/**
 * 구글 애드센스 광고 단위.
 *
 * 애드센스는 그들의 스크립트가 우리 페이지에서 돌아야 한다. 쿠팡처럼 데이터만
 * 받아 직접 그리는 방법이 없다 — 어떤 광고를 보여 줄지 그 스크립트가 정한다.
 * 그래서 설정이 있을 때만 부르고, 없으면 스크립트를 받지도 않는다.
 *
 * 앱 안의 웹뷰나 광고 차단이 켜진 브라우저에서는 뜨지 않는다. 그쪽에서도 보이게
 * 할 방법은 없으므로, 본문 끝의 쿠팡 영역이 그 자리를 메운다.
 */
const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT ?? ''
const SLOT = import.meta.env.VITE_ADSENSE_SLOT ?? ''
const SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

/** 스크립트는 한 번만 받는다. 자리마다 받으면 요청만 쌓인다. */
let loading: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (loading) return loading
  loading = new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = `${SRC}?client=${encodeURIComponent(CLIENT)}`
    s.async = true
    s.crossOrigin = 'anonymous'
    // 실패해도 화면은 그대로 굴러가야 한다. 광고가 없는 것이 오류보다 낫다.
    s.onload = () => resolve()
    s.onerror = () => resolve()
    document.head.appendChild(s)
  })
  return loading
}

export default function AdSenseUnit({
  format = 'auto',
  minHeight = 250,
}: {
  /** 'auto' 는 자리에 맞춰 크기를 정한다. 사이드바처럼 좁은 곳에 맞는다. */
  format?: string
  minHeight?: number
}) {
  const ref = useRef<HTMLModElement>(null)
  /** 같은 자리를 두 번 밀어 넣지 않는다 — 애드센스가 오류로 본다. */
  const pushed = useRef(false)

  useEffect(() => {
    if (!CLIENT || !SLOT || pushed.current) return
    let cancelled = false
    void loadScript().then(() => {
      if (cancelled || !ref.current || pushed.current) return
      try {
        const w = window as unknown as { adsbygoogle?: unknown[] }
        w.adsbygoogle = w.adsbygoogle ?? []
        w.adsbygoogle.push({})
        pushed.current = true
      } catch {
        // 차단기가 껍데기만 만들어 두는 경우가 있다. 실패는 그냥 넘긴다.
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!CLIENT || !SLOT) return null

  return (
    <div className="no-print mt-4 border-t border-[var(--line)] pt-4">
      {/* 자리를 미리 잡아 둔다. 나중에 채워지며 위아래가 밀리면 레이아웃 이동이 된다. */}
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: 'block', minHeight }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
      <p className="mt-1.5 text-[11px] text-[var(--muted)]">광고</p>
    </div>
  )
}
