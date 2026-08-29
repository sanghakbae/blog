import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PostList from '../components/PostList'
import { listPostsByTag, type Post } from '../lib/posts'

export default function TagView() {
  const { tag = '' } = useParams()
  const [posts, setPosts] = useState<Post[] | null>(null)

  useEffect(() => {
    setPosts(null)
    listPostsByTag(tag).then(setPosts).catch(() => setPosts([]))
  }, [tag])

  return (
    <div>
      <header className="mb-10">
        <Link
          to="/"
          className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
        >
          ← 전체 글
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          <span className="text-[var(--muted)]">#</span>
          {tag}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {posts ? `${posts.length}개의 글` : ' '}
        </p>
      </header>

      {!posts ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <li key={i} className="h-44 animate-pulse rounded-2xl bg-[var(--bg-elev)]" />
          ))}
        </ul>
      ) : (
        <PostList posts={posts} empty="이 태그의 글이 없습니다." />
      )}
    </div>
  )
}
