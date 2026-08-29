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
      <header className="mb-8">
        <Link to="/" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          ← 전체 글
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">#{tag}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {posts ? `${posts.length}개의 글` : ' '}
        </p>
      </header>
      {!posts ? (
        <p className="text-sm text-[var(--color-muted)]">불러오는 중…</p>
      ) : (
        <PostList posts={posts} empty="이 태그의 글이 없습니다." />
      )}
    </div>
  )
}
