import { useEffect, useState } from 'react'
import type { Heading } from '../lib/markdown'

/**
 * 글 안의 소제목 목록.
 * 지금 읽고 있는 위치를 표시하려면 본문이 스크롤되는 요소를 알아야 하는데,
 * 이 사이트는 main 이 스크롤 컨테이너다.
 */
export default function TableOfContents({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState<string>('')

  useEffect(() => {
    if (headings.length === 0) return
    const scroller = document.querySelector('main')
    if (!scroller) return

    const update = () => {
      const top = scroller.getBoundingClientRect().top
      let current = headings[0]?.id ?? ''
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (el && el.getBoundingClientRect().top - top < 80) current = h.id
      }
      setActive(current)
    }

    update()
    scroller.addEventListener('scroll', update, { passive: true })
    return () => scroller.removeEventListener('scroll', update)
  }, [headings])

  if (headings.length < 3) return null

  return (
    <nav aria-label="목차" className="no-print mb-6 rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] p-3">
      <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] sm:mb-2.5 sm:text-[11px]">
        목차
      </h2>
      <ol className="space-y-0.5 sm:space-y-1">
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? 'pl-3' : ''}>
            <a
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              /* 넓은 화면에서 본문이 17px 인데 목차가 12px 이면 같은 글의 일부로
                 읽히지 않는다. 본문보다 한 단계만 작게 둔다.
                 좁은 화면은 그대로 둔다 — 거기서는 본문도 13px 이라 이미 비율이
                 맞고, 항목이 열 개를 넘으면 목차가 첫 화면을 다 먹는다. */
              className={`block truncate py-0.5 text-xs leading-snug transition-colors sm:py-1 sm:text-[13.5px] ${
                active === h.id
                  ? 'font-medium text-[var(--accent)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
