import { Link } from 'react-router-dom'
import type { Post } from '../lib/posts'
import { formatDate } from '../lib/date'

export default function PostList({ posts, empty }: { posts: Post[]; empty: string }) {
  if (posts.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] py-20 text-center">
        <p className="text-sm text-[var(--muted)]">{empty}</p>
      </div>
    )

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {posts.map((post, i) => (
        <li
          key={post.id}
          className="rise"
          style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
        >
          <article className="group flex h-full flex-col rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[var(--shadow)]">
            <Link to={`/posts/${post.id}`} className="flex min-h-0 flex-1 flex-col">
              <time className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted)]">
                {formatDate(post.createdAt)}
              </time>
              <h2 className="mt-2 text-[17px] font-semibold leading-snug tracking-tight transition-colors group-hover:text-[var(--accent)]">
                {post.title}
              </h2>
              <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-[var(--muted)]">
                {post.excerpt}
              </p>
            </Link>

            {post.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-3.5">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/tags/${encodeURIComponent(tag)}`}
                    className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </article>
        </li>
      ))}
    </ul>
  )
}
