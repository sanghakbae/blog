import { auth } from './authClient'
import { MAX_TAGS, normalizeTag } from './tags'

const ENDPOINT = import.meta.env.VITE_UPLOAD_ENDPOINT ?? ''

export type SuggestedTag = { tag: string; reason: string }

/**
 * 본문을 Worker 로 보내 Claude 가 읽게 하고, 이 글이 무엇에 대한 글인지에 따라
 * 태그(최대 3개)를 받아온다. 기존 태그를 함께 넘겨 같은 주제가 다른 이름으로
 * 쪼개지지 않게 한다.
 */
export async function analyzeTags(input: {
  title: string
  body: string
  existingTags: string[]
}): Promise<SuggestedTag[]> {
  if (!ENDPOINT) throw new Error('VITE_UPLOAD_ENDPOINT 가 설정되지 않았습니다.')
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('로그인이 필요합니다.')

  const res = await fetch(`${ENDPOINT}/tags`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`태그 분석 실패 (${res.status}): ${await res.text()}`)

  const { tags } = (await res.json()) as { tags: SuggestedTag[] }
  return tags
    .map((t) => ({ ...t, tag: normalizeTag(t.tag) }))
    .filter((t) => t.tag)
    .slice(0, MAX_TAGS)
}
