import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { subscribeTags, type Tag } from '../lib/posts'

/**
 * 목록은 글 수가 많은 순으로 온다. 상위 다섯 개에만 색을 넣어, 이 블로그가
 * 주로 무엇을 다루는지 목록을 읽지 않고도 보이게 한다. 여섯 번째부터는
 * 기본 배지라 색이 서열이 아니라 "자주 쓰는 묶음" 표시로 읽힌다.
 */
const RANK_STYLE = [
  'border-transparent bg-[var(--rank-1-soft)] font-medium text-[var(--rank-1)]',
  'border-transparent bg-[var(--rank-2-soft)] font-medium text-[var(--rank-2)]',
  'border-transparent bg-[var(--rank-3-soft)] font-medium text-[var(--rank-3)]',
  'border-transparent bg-[var(--rank-4-soft)] font-medium text-[var(--rank-4)]',
  'border-transparent bg-[var(--rank-5-soft)] font-medium text-[var(--rank-5)]',
]

/**
 * 본문 분석으로 만들어진 태그 목록을 배지로 보여준다.
 *
 * 레일이 스크롤하므로 전부 보여준다 — 태그가 이 블로그의 분류 축이라 잘리면 안 된다.
 */
export default function TagSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [tags, setTags] = useState<Tag[] | null>(null)

  useEffect(() => subscribeTags(setTags), [])

  return (
    <nav aria-label="태그">
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

      <ul className="flex flex-wrap gap-1.5">
        {tags?.map((tag, i) => (
          <li key={tag.id}>
            <NavLink
              to={`/tags/${encodeURIComponent(tag.id)}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  'inline-flex max-w-full items-center gap-1.5 rounded-md border py-1 pl-2.5 pr-1.5 text-xs transition-all duration-150',
                  isActive
                    ? 'border-transparent bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                    : RANK_STYLE[i]
                      ? `${RANK_STYLE[i]} hover:-translate-y-px`
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
