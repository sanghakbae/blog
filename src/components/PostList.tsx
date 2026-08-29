import { Link } from 'react-router-dom'
import type { Post } from '../lib/posts'
import { formatDate } from '../lib/date'

export default function PostList({ posts, empty }: { posts: Post[]; empty: string }) {
  if (posts.length === 0)
    return <p className="py-16 text-center text-sm text-[var(--color-muted)]">{empty}</p>

  return (
    <ul className="divide-y divide-[var(--color-line)]">
      {posts.map((post) => (
        <li key={post.id} className="py-7 first:pt-0">
          <article>
            <Link to={`/posts/${post.id}`} className="group block">
              <h2 className="text-lg font-semibold tracking-tight group-hover:text-[var(--color-accent)]">
                {post.title}
              </h2>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--color-muted)]">
                {post.excerpt}
              </p>
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <time className="text-xs text-[var(--color-muted)]">{formatDate(post.createdAt)}</time>
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/tags/${encodeURIComponent(tag)}`}
                  className="rounded-full border border-[var(--color-line)] px-2.5 py-0.5 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
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
