/**
 * 검색 포털별 색인 상태.
 *
 * 검색 결과를 긁는 것은 각 사 약관 위반이고 브라우저에서는 막힌다. 그래서 구글은
 * 공식 API(Search Console URL 검사)로 확인한다 — scripts/index-status.mts 가
 * 배포 때마다 돌며 이 값을 채운다. 화면은 그 값을 읽기만 한다.
 * 네이버·빙은 색인 여부를 알려주는 공개 API 가 없어 자동으로 켜지지 않는다.
 */

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

export function confirmedOn(status: IndexStatus, engine: Engine): string {
  const iso = status[engine]
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
