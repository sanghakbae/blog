import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { subscribeTags, type Tag } from '../lib/posts'

/**
 * 본문 분석으로 만들어진 태그 목록을 배지로 보여준다.
 * 배지를 누르면 /tags/:tag 로 이동해 해당 태그가 달린 글만 모아 보여준다.
 */
export default function TagSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [tags, setTags] = useState<Tag[] | null>(null)

  useEffect(() => subscribeTags(setTags), [])

  return (
    <nav aria-label="태그">
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Tags
      </h2>

      {tags === null && (
        <div className="flex flex-wrap gap-2">
          {[64, 48, 72, 56, 40].map((w, i) => (
            <div
              key={i}
              className="h-7 animate-pulse rounded-full bg-[var(--bg-elev)]"
              style={{ width: w }}
            />
          ))}
        </div>
      )}

      {tags?.length === 0 && <p className="text-sm text-[var(--muted)]">아직 태그가 없습니다.</p>}

      <ul className="flex flex-wrap gap-2">
        {tags?.map((tag) => (
          <li key={tag.id}>
            <NavLink
              to={`/tags/${encodeURIComponent(tag.id)}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  'inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1.5 text-xs transition-all duration-150',
                  isActive
                    ? 'border-transparent bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                    : 'border-[var(--line)] bg-[var(--bg-elev)] text-[var(--ink)] hover:-translate-y-px hover:border-[var(--accent)] hover:text-[var(--accent)]',
                ].join(' ')
              }
            >
              <span className="truncate">#{tag.name}</span>
              <span className="rounded-full bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[10px] leading-none tabular-nums text-[var(--muted)]">
                {tag.count}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
