/**
 * 개발 전용 고정 데이터.
 * Firestore 접근이 불가능한 환경에서도 화면 전체를 확인할 수 있게 한다.
 * `npx tsx scripts/seed.mts --local` 로 생성하고 VITE_LOCAL_DATA=1 일 때만 쓰인다.
 */
import type { Post, Tag } from './posts'

type Raw = {
  posts: (Omit<Post, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string })[]
  tags: Tag[]
}

let cache: { posts: Post[]; tags: Tag[] } | null = null

async function load() {
  if (cache) return cache
  const data = (await import('../dev/seed-data.json')).default as Raw
  const toTs = (iso: string) => ({ toDate: () => new Date(iso) }) as Post['createdAt']
  cache = {
    posts: data.posts
      .map((p) => ({ ...p, createdAt: toTs(p.createdAt), updatedAt: toTs(p.updatedAt) }))
      .sort((a, b) => (b.createdAt!.toDate() > a.createdAt!.toDate() ? 1 : -1)),
    tags: data.tags,
  }
  return cache
}

export async function localListPosts(max: number): Promise<Post[]> {
  return (await load()).posts.slice(0, max)
}

export async function localListByTag(tag: string, max: number): Promise<Post[]> {
  return (await load()).posts.filter((p) => p.tags.includes(tag)).slice(0, max)
}

export async function localGetPost(id: string): Promise<Post | null> {
  return (await load()).posts.find((p) => p.id === id) ?? null
}

export async function localTags(): Promise<Tag[]> {
  return (await load()).tags
}
