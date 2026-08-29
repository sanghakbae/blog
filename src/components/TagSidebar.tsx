import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { subscribeTags, type Tag } from '../lib/posts'

/**
 * 본문 분석으로 만들어진 태그 목록을 배지로 보여준다.
 *
 * fit 모드에서는 잘린 배지가 생기지 않도록, 실제로 자리에 들어가는 개수를
 * 재서 그만큼만 그린다. 화면 크기가 바뀌면 다시 잰다.
 */
export default function TagSidebar({
  onNavigate,
  fit = false,
}: {
  onNavigate?: () => void
  fit?: boolean
}) {
  const [tags, setTags] = useState<Tag[] | null>(null)
  const [visible, setVisible] = useState<number>(Number.MAX_SAFE_INTEGER)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => subscribeTags(setTags), [])

  useLayoutEffect(() => {
    if (!fit || !tags?.length) return
    const list = listRef.current
    const box = list?.parentElement
    if (!list || !box) return

    const measure = () => {
      // 한 번 전부 그린 상태에서 각 배지의 아래 끝을 재고,
      // 영역 안에 완전히 들어오는 마지막 배지까지만 남긴다.
      const limit = box.clientHeight - (list.offsetTop - box.offsetTop)
      const items = [...list.children] as HTMLElement[]
      let count = items.length
      for (let i = 0; i < items.length; i++) {
        if (items[i].offsetTop + items[i].offsetHeight > limit) {
          count = i
          break
        }
      }
      setVisible(count)
    }

    setVisible(Number.MAX_SAFE_INTEGER)
    const raf = requestAnimationFrame(measure)
    const observer = new ResizeObserver(() => {
      setVisible(Number.MAX_SAFE_INTEGER)
      requestAnimationFrame(measure)
    })
    observer.observe(box)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [fit, tags])

  const shown = fit ? tags?.slice(0, visible) : tags

  return (
    <nav aria-label="태그" className={fit ? 'flex h-full flex-col overflow-hidden' : undefined}>
      <h2 className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Tags
      </h2>

      {tags === null && (
        <div className="flex flex-wrap gap-2">
          {[64, 48, 72, 56, 40].map((w, i) => (
            <div
              key={i}
              className="h-7 animate-pulse rounded-md bg-[var(--bg-elev)]"
              style={{ width: w }}
            />
          ))}
        </div>
      )}

      {tags?.length === 0 && <p className="text-sm text-[var(--muted)]">아직 태그가 없습니다.</p>}

      <ul ref={listRef} className="flex flex-wrap gap-1.5">
        {shown?.map((tag) => (
          <li key={tag.id}>
            <NavLink
              to={`/tags/${encodeURIComponent(tag.id)}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  'inline-flex max-w-full items-center gap-1.5 rounded-md border py-1 pl-2.5 pr-1.5 text-xs transition-all duration-150',
                  isActive
                    ? 'border-transparent bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                    : 'border-[var(--line)] bg-[var(--bg-elev)] text-[var(--ink)] hover:-translate-y-px hover:border-[var(--accent)] hover:text-[var(--accent)]',
                ].join(' ')
              }
            >
              <span className="truncate">{tag.name}</span>
              <span className="rounded-md bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[10px] leading-none tabular-nums text-[var(--muted)]">
                {tag.count}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
