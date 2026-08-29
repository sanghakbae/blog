import { useEffect, useState } from 'react'
import PostList from '../components/PostList'
import { listPosts, type Post } from '../lib/posts'

export default function Home() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  useEffect(() => { listPosts().then(setPosts).catch(() => setPosts([])) }, [])

  if (!posts) return <p className="text-sm text-[var(--color-muted)]">불러오는 중…</p>
  return <PostList posts={posts} empty="아직 글이 없습니다." />
}
