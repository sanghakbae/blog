import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { subscribeTags, type Tag } from '../lib/posts'

/**
 * 본문에서 자동 추출된 태그 목록.
 * 태그를 누르면 /tags/:tag 로 이동해 해당 태그가 달린 글만 모아 보여준다.
 */
export default function TagSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [tags, setTags] = useState<Tag[] | null>(null)

  useEffect(() => subscribeTags(setTags), [])

  return (
    <nav aria-label="태그">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        태그
      </h2>

      {tags === null && <p className="mt-4 text-sm text-[var(--color-muted)]">불러오는 중…</p>}
      {tags?.length === 0 && (
        <p className="mt-4 text-sm text-[var(--color-muted)]">아직 태그가 없습니다.</p>
      )}

      <ul className="mt-4 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
        {tags?.map((tag) => (
          <li key={tag.id}>
            <NavLink
              to={`/tags/${encodeURIComponent(tag.id)}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  'group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] text-[var(--color-accent)] font-medium'
                    : 'text-[var(--color-ink)] hover:bg-[color-mix(in_oklab,var(--color-line)_55%,transparent)]',
                ].join(' ')
              }
            >
              <span className="truncate">#{tag.name}</span>
              <span className="ml-auto text-xs tabular-nums text-[var(--color-muted)]">
                {tag.count}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
