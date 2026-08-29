import { Link } from 'react-router-dom'
import type { Post } from '../lib/posts'
import { formatDate } from '../lib/date'

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
          <article className="row-fill py-7">
            <Link to={`/posts/${post.id}`} className="group block">
              <div className="flex items-baseline gap-4">
                <span className="w-8 shrink-0 font-mono text-xs tabular-nums text-[var(--muted)]">
                  {String(i + 1).padStart(2, '0')}
                </span>

                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-semibold leading-snug tracking-[-0.03em] transition-colors group-hover:text-[var(--accent)] sm:text-[1.75rem]">
                    {post.title}
                  </h2>
                  <p className="mt-2.5 line-clamp-2 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
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

            <div className="mt-4 flex flex-wrap items-center gap-2 pl-0 sm:pl-12">
              <time className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted)]">
                {formatDate(post.createdAt)}
              </time>
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/tags/${encodeURIComponent(tag)}`}
                  className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </article>
        </li>
      ))}
    </ul>
  )
}
