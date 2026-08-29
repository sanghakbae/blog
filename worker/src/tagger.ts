import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

export const MAX_TAGS = 3

const TagResult = z.object({
  tags: z
    .array(
      z.object({
        tag: z.string().describe('소문자 슬러그 형태의 태그. 공백 대신 하이픈. 한글 그대로 가능.'),
        reason: z.string().describe('이 태그를 고른 근거를 본문 내용으로 한 문장 설명'),
      }),
    )
    .describe('본문을 대표하는 태그. 최대 3개, 중요한 순서대로.'),
})

const SYSTEM = `너는 개인 블로그의 태그 편집자다. 주제가 정해져 있지 않은 자유로운 블로그라서, 미리 정해진 태그 목록은 없다.

글 전체를 끝까지 읽고 "이 글이 실제로 무엇에 대한 글인지" 를 판단해 태그를 붙여라.

규칙:
- 태그는 최대 ${MAX_TAGS}개. 글이 정말 한 가지만 다루면 1~2개만 붙여도 된다. 억지로 3개를 채우지 마라.
- 본문에 등장하는 단어를 그대로 뽑는 키워드 추출이 아니다. 글의 주제·소재·분야를 사람이 나중에 다시 찾아볼 만한 이름으로 붙여라.
- 지나치게 일반적인 태그(일상, 생각, 글, 기록, 메모)는 그 글이 정말로 그 자체를 다룰 때만 쓴다.
- 지나치게 좁은 태그(한 번 스쳐 지나간 고유명사, 특정 버전 번호)도 피한다.
- 기존 태그 목록을 주면, 같은 주제일 때는 새 태그를 만들지 말고 기존 태그를 그대로 재사용해라. 표기만 다른 중복 태그가 생기는 게 가장 나쁘다.
- 태그는 소문자 슬러그로. 공백은 하이픈으로 바꾸고, 한글은 한글 그대로 둔다. 앞에 # 을 붙이지 마라.
- 글이 너무 짧거나 내용이 없어 판단이 불가능하면 빈 배열을 반환해라.`

/** 본문을 분석해 태그(최대 3개)를 만든다. existingTags 는 재사용을 유도하는 힌트다. */
export async function analyzeTags(
  apiKey: string,
  input: { title: string; body: string; existingTags: string[] },
): Promise<{ tag: string; reason: string }[]> {
  const client = new Anthropic({ apiKey })

  const existing = input.existingTags.length
    ? `이 블로그에 이미 있는 태그(같은 주제면 반드시 재사용):\n${input.existingTags.join(', ')}`
    : '이 블로그에는 아직 태그가 없다.'

  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 4000,
    system: SYSTEM,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: zodOutputFormat(TagResult) },
    messages: [
      {
        role: 'user',
        content: `${existing}\n\n---\n제목: ${input.title}\n\n본문:\n${input.body}`,
      },
    ],
  })

  const tags = response.parsed_output?.tags ?? []
  const seen = new Set<string>()
  return tags
    .map((t) => ({ ...t, tag: normalizeTag(t.tag) }))
    .filter((t) => t.tag && !seen.has(t.tag) && seen.add(t.tag))
    .slice(0, MAX_TAGS)
}

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 30)
}
