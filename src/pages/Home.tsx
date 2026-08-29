import { useEffect, useState } from 'react'
import PostList from '../components/PostList'
import { listPosts, type Post } from '../lib/posts'

export default function Home() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  useEffect(() => { listPosts().then(setPosts).catch(() => setPosts([])) }, [])

  return (
    <div>
      {/* 표어 대신 지금 무엇이 있는지만 적는다 */}
      <header className="mb-3 flex items-baseline gap-2.5">
        <h1 className="text-[13px] font-semibold tracking-tight">최근 글</h1>
        {posts && (
          <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
            {posts.length}편
          </span>
        )}
      </header>

      {!posts ? (
        <ul className="border-t border-[var(--line)]">
          {[...Array(4)].map((_, i) => (
            <li key={i} className="border-b border-[var(--line)] py-8">
              <div className="h-7 w-2/3 animate-pulse rounded bg-[var(--bg-elev)]" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-[var(--bg-elev)]" />
            </li>
          ))}
        </ul>
      ) : (
        <PostList posts={posts} empty="아직 글이 없습니다." />
      )}
    </div>
  )
}
