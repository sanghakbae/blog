/** 게시물 하나당 허용되는 최대 태그 수 */
export const MAX_TAGS = 3

/**
 * 태그 표기 통일.
 * 이 값이 곧 URL 슬러그이자 tags 컬렉션의 문서 ID 다.
 */
export function normalizeTag(raw: string): string {
  // 태그는 기호 없는 한 낱말이다
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, 20)
}

/** 목록에 보여줄 짧은 요약 */
export function makeExcerpt(body: string, len = 110): string {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    // 표는 요약에 넣으면 구분자만 늘어놓게 된다
    .replace(/^\|.*\|\s*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[#>*\-\s]+/gm, ' ')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > len ? text.slice(0, len).trimEnd() + '…' : text
}
