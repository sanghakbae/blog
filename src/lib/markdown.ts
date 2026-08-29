import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

export type Heading = { id: string; text: string; level: 2 | 3 }

/** 목차와 본문이 같은 규칙으로 id 를 만들어야 이동이 맞는다 */
export function headingId(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
  return `${slug || 'section'}-${index}`
}

/** 본문에서 소제목을 뽑아 목차를 만든다 */
export function extractHeadings(body: string): Heading[] {
  const out: Heading[] = []
  const clean = body.replace(/```[\s\S]*?```/g, '')
  let i = 0
  for (const m of clean.matchAll(/^(#{2,3})\s+(.+)$/gm)) {
    const text = m[2].replace(/[*_`]/g, '').trim()
    out.push({ id: headingId(text, i++), text, level: m[1].length as 2 | 3 })
  }
  return out
}

/** 본문 마크다운 → 안전한 HTML. 소제목에는 목차가 가리킬 id 를 붙인다. */
export function renderMarkdown(body: string): string {
  let index = 0
  const renderer = new marked.Renderer()
  renderer.heading = ({ text, depth, tokens }) => {
    const plain = (tokens ?? []).map((t) => ('text' in t ? String(t.text) : '')).join('') || text
    const inner = marked.parseInline(text) as string
    if (depth === 2 || depth === 3) {
      return `<h${depth} id="${headingId(plain.replace(/[*_`]/g, '').trim(), index++)}">${inner}</h${depth}>`
    }
    return `<h${depth}>${inner}</h${depth}>`
  }
  return DOMPurify.sanitize(marked.parse(body, { renderer }) as string, { ADD_ATTR: ['id'] })
}
