/**
 * 검색 포털별 색인 상태.
 *
 * 색인 여부를 사이트가 자동으로 알아낼 방법이 없다. 검색 결과를 긁는 것은
 * 각 사 약관 위반이고 브라우저에서는 막힌다. 그래서 확인한 사실을 기록해 둔다.
 * 배지를 누르면 해당 포털에서 site: 검색이 열리고, 확인 후 표시를 남긴다.
 */
import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

export const ENGINES = ['google', 'naver', 'bing'] as const
export type Engine = (typeof ENGINES)[number]

export const ENGINE_LABEL: Record<Engine, string> = {
  google: '구글',
  naver: '네이버',
  bing: '빙',
}

/** 확인한 날짜(ISO)를 담는다. 값이 없으면 아직 확인되지 않은 것이다. */
export type IndexStatus = Partial<Record<Engine, string>>

export function searchUrl(engine: Engine, postId: string): string {
  const q = `site:blog.sanghak.kr/posts/${postId}/`
  const encoded = encodeURIComponent(q)
  if (engine === 'google') return `https://www.google.com/search?q=${encoded}`
  if (engine === 'naver') return `https://search.naver.com/search.naver?query=${encoded}`
  return `https://www.bing.com/search?q=${encoded}`
}

/** 색인 확인 표시를 켜거나 끈다 */
export async function toggleIndexed(
  postId: string,
  engine: Engine,
  current: IndexStatus,
): Promise<IndexStatus> {
  const next: IndexStatus = { ...current }
  if (next[engine]) delete next[engine]
  else next[engine] = new Date().toISOString()

  await updateDoc(doc(db, 'posts', postId), { indexStatus: next })
  return next
}

export function confirmedOn(status: IndexStatus, engine: Engine): string {
  const iso = status[engine]
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
