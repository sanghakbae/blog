import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

/** 본문 마크다운 → 안전한 HTML */
export function renderMarkdown(body: string): string {
  return DOMPurify.sanitize(marked.parse(body) as string)
}
