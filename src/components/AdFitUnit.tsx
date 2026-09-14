import { useEffect, useRef } from 'react'

/**
 * 카카오 애드핏 광고 단위.
 *
 * 쿠팡 배너는 본문 끝에 있으므로 이것은 오른쪽 사이드바 아래에 둔다. 같은 자리에
 * 둘을 겹쳐 두면 서로를 밀어내고, 한 화면에 광고가 둘이면 본문보다 광고가 먼저
 * 읽힌다.
 *
 * 애드핏은 쿠팡과 달리 iframe 주소를 주지 않는다. 그들의 스크립트가 우리 페이지에서
 * 돌아야 하므로, 필요한 화면에서만 불러오고 설정이 없으면 아예 부르지 않는다.
 * 스크립트는 한 번만 받는다 — 화면을 옮길 때마다 다시 받으면 요청만 쌓인다.
 */
const UNIT = import.meta.env.VITE_ADFIT_UNIT_ID ?? ''
const SRC = 'https://t1.daumcdn.net/kas/static/ba.min.js'

/** 이미 불러왔는지 — 여러 자리에 두어도 스크립트는 하나다 */
let loading: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (loading) return loading
  loading = new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = SRC
    s.async = true
    // 실패해도 화면은 그대로 굴러가야 한다. 광고가 없는 것이 오류보다 낫다.
    s.onload = () => resolve()
    s.onerror = () => resolve()
    document.head.appendChild(s)
  })
  return loading
}

export default function AdFitUnit({
  width = 250,
  height = 250,
}: {
  width?: number
  height?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!UNIT) return
    let cancelled = false

    // 애드핏 스크립트는 붙을 때 화면에 있는 ins 만 훑는다. 화면을 옮겨 다시
    // 그려진 자리는 스스로 찾지 못하므로, 매번 ins 를 새로 만들어 넣는다.
    void loadScript().then(() => {
      if (cancelled || !ref.current) return
      ref.current.innerHTML = ''
      const ins = document.createElement('ins')
      ins.className = 'kakao_ad_area'
      ins.style.display = 'none'
      ins.setAttribute('data-ad-unit', UNIT)
      ins.setAttribute('data-ad-width', String(width))
      ins.setAttribute('data-ad-height', String(height))
      ref.current.appendChild(ins)
      // 스크립트가 이미 붙어 있으면 새로 만든 ins 를 다시 훑게 한다
      const w = window as unknown as { adfit?: { render?: (u: string) => void } }
      w.adfit?.render?.(UNIT)
    })

    return () => {
      cancelled = true
    }
  }, [width, height])

  if (!UNIT) return null

  return (
    <div className="no-print mt-4 border-t border-[var(--line)] pt-4">
      {/* 자리를 미리 잡아 둔다. 나중에 채워지며 위아래가 밀리면 레이아웃 이동이 된다. */}
      <div ref={ref} style={{ minHeight: height }} />
      <p className="mt-1.5 text-[10px] text-[var(--muted)]">광고</p>
    </div>
  )
}
