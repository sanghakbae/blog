import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Post } from '../lib/posts'
import { subscribeViewer, type Viewer } from '../lib/authState'
import { downloadPdf, safeName } from '../lib/pdf'

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
  const [viewer, setViewer] = useState<Viewer>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => subscribeViewer(setViewer), [])

  async function savePdf() {
    const article = document.querySelector('article')
    if (!article) return
    setBusy(true)
    try {
      await downloadPdf(post, article as HTMLElement)
    } catch (err) {
      console.error(err)
      alert(`PDF 를 만들지 못했습니다 — ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="no-print flex shrink-0 items-center gap-1 sm:gap-1.5">
      {viewer?.isAdmin && (
        <Link
          to={`/admin/edit/${post.id}`}
          title="이 글 편집"
          className="rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-medium tracking-wider text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] sm:px-4 sm:py-1.5 sm:text-[13px]"
        >
          편집
        </Link>
      )}
      <button
        type="button"
        onClick={() => downloadMarkdown(post)}
        title="마크다운 파일로 저장"
        className="rounded-md border border-[var(--line)] bg-[var(--bg-elev)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] sm:px-4 sm:py-1.5 sm:text-[13px]"
      >
        MD
      </button>
      <button
        type="button"
        onClick={savePdf}
        disabled={busy}
        title="PDF 파일로 저장"
        className="rounded-md border border-[var(--line)] bg-[var(--bg-elev)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:opacity-50 sm:px-4 sm:py-1.5 sm:text-[13px]"
      >
        {busy ? '…' : 'PDF'}
      </button>
    </div>
  )
}
