import { Link } from 'react-router-dom'
import type { Post } from '../lib/posts'
import { formatDate } from '../lib/date'
import { readingStats } from '../lib/editorCommands'

/**
 * 카드를 격자로 늘어놓으면 모든 글이 똑같은 무게로 보인다.
 * 잡지 목차처럼 큰 제목 + 얇은 구분선으로 세로 흐름을 만든다.
 */
export default function PostList({ posts, empty }: { posts: Post[]; empty: string }) {
  if (posts.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] py-24 text-center">
        <p className="text-sm text-[var(--muted)]">{empty}</p>
      </div>
    )

  return (
    <ul className="border-t border-[var(--line)]">
      {posts.map((post, i) => (
        <li
          key={post.id}
          className="rise border-b border-[var(--line)]"
          style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
        >
          <article className="row-fill py-5">
            <Link to={`/posts/${post.id}`} className="group block">
              <div className="flex items-baseline gap-4">
                <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums text-[var(--muted)] sm:w-8 sm:text-xs">
                  {String(i + 1).padStart(2, '0')}
                </span>

                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-semibold leading-snug tracking-[-0.02em] transition-colors group-hover:text-[var(--accent)] sm:text-[1.6rem] sm:tracking-[-0.03em]">
                    {post.title}
                  </h2>
                  <p className="mt-1.5 truncate text-[12px] leading-relaxed text-[var(--muted)] sm:mt-2 sm:text-[14px]">
                    {post.excerpt}
                  </p>
                </div>

                <span
                  aria-hidden
                  className="hidden shrink-0 text-xl text-[var(--accent)] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 sm:block sm:-translate-x-2"
                >
                  →
                </span>
              </div>
            </Link>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-0 sm:mt-4 sm:pl-12">
              <time className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted)]">
                {formatDate(post.createdAt)}
              </time>
              <span className="font-mono text-[10px] text-[var(--muted)]">
                {readingStats(post.body).minutes}분
              </span>
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/tags/${encodeURIComponent(tag)}`}
                  className="rounded-md border border-[var(--line)] bg-[var(--bg-elev)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </article>
        </li>
      ))}
    </ul>
  )
}
