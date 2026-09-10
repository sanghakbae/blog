import { useEffect, useState } from 'react'
import PostList from '../components/PostList'
import { listPosts, type Post } from '../lib/posts'

export default function Home() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  useEffect(() => { listPosts().then(setPosts).catch(() => setPosts([])) }, [])

  return (
    <div>
      {/* 표어 대신 지금 무엇이 있는지만 적는다.
          목록은 최신순으로 전부 보여주므로 "최근"이 아니라 "전체"다. */}
      <header className="mb-3 flex items-baseline gap-2.5">
        <h1 className="text-[13px] font-semibold tracking-tight">전체 글</h1>
        {posts && (
          <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
            {posts.length}편
          </span>
        )}
      </header>

      {!posts ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          {[...Array(4)].map((_, i) => (
            <li
              key={i}
              className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)]"
            >
              <div className="aspect-[16/7] animate-pulse bg-[var(--accent-soft)]" />
              <div className="px-4 pt-3.5 pb-4 sm:px-5 sm:pb-5">
                <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--bg)]" />
                <div className="mt-2.5 h-3 w-full animate-pulse rounded bg-[var(--bg)]" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <PostList posts={posts} empty="아직 글이 없습니다." />
      )}
    </div>
  )
}
