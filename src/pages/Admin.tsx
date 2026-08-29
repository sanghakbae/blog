import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllPosts, type Post } from '../lib/posts'
import { formatDate } from '../lib/date'
import { useAuth } from '../lib/useAuth'

export default function Admin() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const { signOut } = useAuth()

  useEffect(() => { listAllPosts().then(setPosts).catch(() => setPosts([])) }, [])

  return (
    <div>
      <header className="mb-8 flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">글 관리</h1>
        <Link
          to="/admin/new"
          className="ml-auto rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white"
        >
          새 글
        </Link>
        <button type="button" onClick={() => signOut()} className="text-sm text-[var(--color-muted)]">
          로그아웃
        </button>
      </header>

      {!posts ? (
        <p className="text-sm text-[var(--color-muted)]">불러오는 중…</p>
      ) : (
        <ul className="divide-y divide-[var(--color-line)]">
          {posts.map((post) => (
            <li key={post.id} className="flex items-center gap-3 py-4">
              <Link to={`/admin/edit/${post.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{post.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
                  <span>{formatDate(post.updatedAt)}</span>
                  {post.tags.map((t) => <span key={t}>#{t}</span>)}
                </span>
              </Link>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                  post.published
                    ? 'bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] text-[var(--color-accent)]'
                    : 'border border-[var(--color-line)] text-[var(--color-muted)]'
                }`}
              >
                {post.published ? '발행' : '임시'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
