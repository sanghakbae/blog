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

/** 정렬이 중요한 줄 — 도식, 들여쓴 설정, 표처럼 칸을 맞춘 텍스트 */
function looksPreformatted(line: string): boolean {
  if (!line.trim()) return false
  // 마크다운 문법이 있는 줄은 건드리지 않는다
  if (/^\s{0,3}(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|```)/.test(line)) return false
  return (
    /[─│┌┐└┘├┤┬┴┼━┃▼▲◀▶→←↑↓⟶⇒]/.test(line) || // 선과 화살표
    /^\s{2,}\S/.test(line) || // 들여쓰기
    /\S {3,}\S/.test(line) // 칸 맞추기용 여러 칸 띄우기
  )
}

/**
 * 마크다운이 아닌 부분을 쓴 그대로 보여준다.
 *
 * 도식이나 들여쓴 설정을 그냥 렌더링하면 비례 글꼴과 공백 축약 때문에 정렬이
 * 무너진다. 글쓴이가 코드 울타리로 감싸지 않았더라도, 정렬이 중요한 줄이
 * 이어지면 자동으로 원문 그대로 보존한다.
 */
export function preserveLayout(body: string): string {
  const lines = body.split('\n')
  const out: string[] = []
  let inFence = false
  let block: string[] = []

  const flush = () => {
    if (block.length >= 2) out.push('```text', ...block, '```')
    else out.push(...block)
    block = []
  }

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      flush()
      inFence = !inFence
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }
    if (looksPreformatted(line)) {
      // 'resources:' 처럼 바로 앞의 이름표 줄도 같은 덩어리로 본다
      if (block.length === 0 && /^\S.*:$/.test(out[out.length - 1] ?? '')) block.push(out.pop()!)
      block.push(line)
      continue
    }
    flush()
    out.push(line)
  }
  flush()
  return out.join('\n')
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
  return DOMPurify.sanitize(marked.parse(preserveLayout(body), { renderer }) as string, {
    ADD_ATTR: ['id'],
  })
}
