/**
 * 게시물 단위 SEO · GEO 점검.
 *
 * SEO 는 검색 결과에 노출되기 위한 조건이고,
 * GEO(Generative Engine Optimization) 는 생성형 엔진이 답변에 인용할 수 있는
 * 구조 신호가 갖춰졌는지를 본다. 두 영역이 요구하는 것이 다르다.
 */
import type { Post } from './posts'

export type IssueArea = 'SEO' | 'GEO' | '이미지' | '에디토리얼'
export type IssueLevel = 'fail' | 'warn'

export type Issue = {
  /** 어떤 항목인지 — 화면에 그대로 노출된다 */
  field: string
  area: IssueArea
  level: IssueLevel
  message: string
}

export type PostAudit = {
  id: string
  title: string
  issues: Issue[]
  /** 인용 신호 개수 */
  faq: number
  citations: number
  keywords: number
  score: number
}

// ── 본문 파싱 ───────────────────────────────────────────────────────────────

const stripCode = (body: string) => body.replace(/```[\s\S]*?```/g, '')

function plainText(body: string): string {
  return stripCode(body)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\|.*\|\s*$/gm, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const headings = (body: string) =>
  [...stripCode(body).matchAll(/^(#{2,4})\s+(.+)$/gm)].map((m) => ({
    level: m[1].length,
    text: m[2].trim(),
  }))

const images = (body: string) =>
  [...body.matchAll(/!\[([^\]]*)\]\(([^)]*)\)/g)].map((m) => ({ alt: m[1], src: m[2] }))

const firstParagraph = (body: string) =>
  stripCode(body)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .find((p) => p && !/^[#|!\-*>]/.test(p)) ?? ''

/** 질문형 소제목 — 생성형 엔진이 질문·답변 쌍으로 인식한다 */
const questionHeadings = (body: string) =>
  headings(body).filter((h) => /[?？]$|왜|어떻게|무엇|언제|어디|누가|어느|하나$/.test(h.text))

/** '## 참고' 절 아래 항목 수 */
function citationCount(body: string): number {
  // m 플래그에서 $ 는 줄 끝에도 걸린다. 문서 끝을 뜻하려면 $(?![\s\S]) 를 써야 한다.
  const m = /^##[ \t]*(참고|출처|references)[^\n]*\n([\s\S]*?)(?=\n##[ \t]|$(?![\s\S]))/im.exec(body)
  if (!m) return 0
  return (m[2].match(/^\s*[-*]\s+\S/gm) ?? []).length
}

// ── 점검 ────────────────────────────────────────────────────────────────────

type Input = { id?: string; title: string; body: string; excerpt?: string; tags?: string[] }

export function auditPost(post: Input): PostAudit {
  const title = post.title.trim()
  const body = post.body
  const text = plainText(body)
  const tags = post.tags ?? []
  const hs = headings(body)
  const imgs = images(body)
  const intro = firstParagraph(body)
  const excerpt = (post.excerpt ?? '').trim()
  const faq = questionHeadings(body).length
  const citations = citationCount(body)

  const issues: Issue[] = []
  const add = (field: string, area: IssueArea, level: IssueLevel, message: string) =>
    issues.push({ field, area, level, message })

  // 에디토리얼 — 글 자체가 갖춰졌는가
  if (text.length < 600) add('body', '에디토리얼', 'warn', `본문이 ${text.length}자입니다. 600자 이상을 권합니다.`)
  if (!excerpt) add('description', '에디토리얼', 'fail', '요약문이 비어 있습니다.')
  if (title.length < 15 || title.length > 45)
    add('title', '에디토리얼', 'warn', `제목이 ${title.length}자입니다. 15~45자가 검색 결과에서 잘리지 않습니다.`)

  // SEO
  if (!excerpt || excerpt.length < 50 || excerpt.length > 160)
    add('seo.description', 'SEO', 'fail', excerpt ? `요약문이 ${excerpt.length}자입니다. 50~160자로 맞추세요.` : '검색 결과에 노출될 설명이 없습니다.')
  if (tags.length === 0) add('seo.keywords', 'SEO', 'warn', '핵심어가 지정되지 않았습니다.')
  if (tags.length === 0) add('tags', 'SEO', 'warn', '태그가 없어 관련 글 묶임과 내부 링크가 생기지 않습니다.')
  if (hs.length < 2 || hs[0]?.level !== 2)
    add('seo.headings', 'SEO', 'warn', hs.length ? 'H2 로 시작하는 소제목 구조가 아닙니다.' : '소제목이 없어 목차로 인식되지 않습니다.')
  if (post.id && !/^[a-z0-9-]{3,60}$/.test(post.id))
    add('seo.slug', 'SEO', 'warn', '주소가 임의 문자열입니다. 영문 소문자와 하이픈으로 바꾸면 검색에 유리합니다.')

  // GEO
  if (intro.length < 60 || intro.length > 400)
    add('geo.answerSummary', 'GEO', 'warn', intro ? `첫 문단이 ${intro.length}자입니다. 60~400자로 결론을 먼저 쓰세요.` : '답변 엔진이 그대로 인용할 요약이 없습니다.')
  if (faq === 0)
    add('geo.faq', 'GEO', 'warn', '질문형 소제목이 없습니다. 질문·답변 쌍이 인용 확률이 가장 높습니다.')
  if (citations === 0)
    add('geo.citations', 'GEO', 'warn', '출처가 없습니다. 근거를 밝힌 글이 더 자주 인용됩니다.')
  if (tags.length === 0)
    add('geo.entities', 'GEO', 'warn', '이 글이 다루는 개체(기술 용어)가 지정되지 않았습니다.')
  if (!/\|\s*---/.test(body) && !/^[-*]\s/m.test(stripCode(body)))
    add('geo.structured', 'GEO', 'fail', '표나 목록이 없어 항목 단위로 인용되기 어렵습니다.')

  // 이미지
  if (imgs.length === 0) add('cover', '이미지', 'warn', '본문에 이미지가 없습니다. 도식 하나가 이해와 인용을 모두 돕습니다.')
  const missingAlt = imgs.filter((i) => i.alt.trim().length < 2).length
  if (missingAlt) add('image.alt', '이미지', 'fail', `${missingAlt}개 이미지에 대체 텍스트가 없습니다.`)

  // 점수 — fail 은 두 배로 깎는다
  const penalty = issues.reduce((n, i) => n + (i.level === 'fail' ? 10 : 5), 0)
  const score = Math.max(0, 100 - penalty)

  return { id: post.id ?? '', title, issues, faq, citations, keywords: tags.length, score }
}

export function auditAll(posts: Post[]): PostAudit[] {
  return posts.map((p) => auditPost(p)).sort((a, b) => a.score - b.score)
}

/** 영역별 미해결 항목 수 */
export function summarize(audits: PostAudit[]): Record<IssueArea, number> {
  const base: Record<IssueArea, number> = { SEO: 0, GEO: 0, 이미지: 0, 에디토리얼: 0 }
  for (const a of audits) for (const i of a.issues) base[i.area] += 1
  return base
}
