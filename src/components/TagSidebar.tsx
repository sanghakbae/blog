import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { subscribeTags, type Tag } from '../lib/posts'

/**
 * 본문 분석으로 만들어진 태그 목록.
 * 태그를 누르면 /tags/:tag 로 이동해 해당 태그가 달린 글만 모아 보여준다.
 */
export default function TagSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [tags, setTags] = useState<Tag[] | null>(null)

  useEffect(() => subscribeTags(setTags), [])

  const maxCount = Math.max(1, ...(tags ?? []).map((t) => t.count))

  return (
    <nav aria-label="태그">
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Tags
      </h2>

      {tags === null && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-7 animate-pulse rounded-lg bg-[var(--bg-elev)]" />
          ))}
        </div>
      )}

      {tags?.length === 0 && <p className="text-sm text-[var(--muted)]">아직 태그가 없습니다.</p>}

      <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
        {tags?.map((tag) => (
          <li key={tag.id}>
            <NavLink
              to={`/tags/${encodeURIComponent(tag.id)}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  'group relative flex items-center gap-2 overflow-hidden rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                    : 'text-[var(--ink)] hover:bg-[var(--bg-elev)]',
                ].join(' ')
              }
            >
              {/* 글 수를 막대 길이로 은근히 드러낸다 */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 -z-10 rounded-lg bg-[var(--accent-soft)] opacity-40 lg:block"
                style={{ width: `${(tag.count / maxCount) * 100}%` }}
              />
              <span className="truncate">#{tag.name}</span>
              <span className="ml-auto font-mono text-[11px] tabular-nums text-[var(--muted)]">
                {tag.count}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
