import type { Post } from '../lib/posts'

/** 파일 이름으로 쓸 수 없는 문자를 정리한다 */
function safeName(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || 'post'
}

function downloadMarkdown(post: Post) {
  const date = post.createdAt?.toDate?.().toISOString().slice(0, 10) ?? ''
  const front = [
    '---',
    `title: ${post.title}`,
    date && `date: ${date}`,
    post.tags.length && `tags: [${post.tags.join(', ')}]`,
    `source: ${location.origin}/posts/${post.id}`,
    '---',
  ]
    .filter(Boolean)
    .join('\n')
    // 머리말과 본문 사이를 빈 줄로 띄운다
    .concat('\n\n')

  const blob = new Blob([front + post.body], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName(post.title)}.md`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 글 우측 상단의 내려받기 버튼.
 * PDF 는 브라우저 인쇄 기능을 쓴다. 글자가 이미지로 굳지 않고 선택·검색이 되며,
 * 한글 폰트를 번들에 싣지 않아도 된다. 인쇄용 스타일은 index.css 에 있다.
 */
export default function PostActions({ post }: { post: Post }) {
  return (
    <div className="no-print flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => downloadMarkdown(post)}
        title="마크다운 파일로 저장"
        className="rounded-md border border-[var(--line)] bg-[var(--bg-elev)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
      >
        MD
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        title="PDF 로 저장 (인쇄 대화상자에서 대상을 PDF 로 선택)"
        className="rounded-md border border-[var(--line)] bg-[var(--bg-elev)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
      >
        PDF
      </button>
    </div>
  )
}
