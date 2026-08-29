import { useEffect, useState } from 'react'
import PostList from '../components/PostList'
import { listPosts, type Post } from '../lib/posts'

export default function Home() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  useEffect(() => { listPosts().then(setPosts).catch(() => setPosts([])) }, [])

  return (
    <div>
      <header className="mb-7 sm:mb-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--accent)]">
          Personal journal
        </p>
        <h1 className="display mt-3 text-[clamp(1.75rem,7vw,5rem)]">
          쓰고 싶은 걸 씁니다
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)] sm:text-[15px]">
          주제를 정해두지 않은 블로그입니다. 태그는 글을 쓰면 본문 분석으로 붙습니다.
        </p>
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
