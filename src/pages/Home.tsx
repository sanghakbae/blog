import { useEffect, useState } from 'react'
import PostList from '../components/PostList'
import { listPosts, type Post } from '../lib/posts'

export default function Home() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  useEffect(() => { listPosts().then(setPosts).catch(() => setPosts([])) }, [])

  return (
    <div>
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          쓰고 싶은 걸 씁니다
        </h1>
        <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
          주제를 정해두지 않은 블로그입니다. 태그는 글을 쓰면 본문 분석으로 붙습니다 —
          왼쪽에서 골라 보세요.
        </p>
      </header>

      {!posts ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <li key={i} className="h-44 animate-pulse rounded-2xl bg-[var(--bg-elev)]" />
          ))}
        </ul>
      ) : (
        <PostList posts={posts} empty="아직 글이 없습니다." />
      )}
    </div>
  )
}
