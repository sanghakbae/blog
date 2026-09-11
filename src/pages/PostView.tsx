import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPost, type Post } from '../lib/posts'

import { formatDate } from '../lib/date'
import CommentSection from '../components/CommentSection'
import PostActions from '../components/PostActions'
import TableOfContents from '../components/TableOfContents'
import PostNav from '../components/PostNav'
import { readingStats } from '../lib/editorCommands'
import type { Heading } from '../lib/markdown'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function PostView() {
  const { id = '' } = useParams()
  const [post, setPost] = useState<Post | null | 'missing'>(null)
  const [html, setHtml] = useState('')
  const [headings, setHeadings] = useState<Heading[]>([])

  useDocumentTitle(typeof post === 'object' ? post?.title : undefined)

  useEffect(() => {
    // 같은 화면에서 글만 바뀌므로 직접 비우지 않으면 이전 글이 잠시 남는다
    setPost(null)
    setHtml('')
    setHeadings([])

    let alive = true
    getPost(id)
      .then((p) => alive && setPost(p ?? 'missing'))
      .catch(() => alive && setPost('missing'))
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    if (typeof post !== 'object' || !post) return
    let alive = true
    import('../lib/markdown')
      .then((m) => {
        if (!alive) return
        setHtml(m.renderMarkdown(post.body))
        setHeadings(m.extractHeadings(post.body))
      })
      .catch(() => {
        // 오프라인에서 아직 받지 않은 조각이면 이 import 가 실패한다.
        // 본문은 이미 손에 있으므로, 서식 없이라도 읽을 수 있게 그대로 보여준다.
        if (!alive) return
        const escaped = post.body.replace(
          /[&<>]/g,
          (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c,
        )
        setHtml(
          `<p><em>서식을 불러오지 못해 원문을 그대로 표시합니다.</em></p>` +
            `<pre style="white-space:pre-wrap">${escaped}</pre>`,
        )
        setHeadings([])
      })
    return () => {
      alive = false
    }
  }, [post])

  if (post === null) return <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
  if (post === 'missing') return <p className="text-sm text-[var(--muted)]">글을 찾을 수 없습니다.</p>

  return (
    <article>
      <Link
        to="/"
        className="no-print font-mono text-[11px] uppercase tracking-wider text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
      >
        ← 전체 글
      </Link>

      <div className="mt-3 flex items-start gap-4">
        {/* 본문(17px)의 두 배에서 멈춘다. 4.5vw 로 두면 넓은 화면에서 52px 까지
            자라 본문의 세 배가 되고, 제목만 포스터처럼 커져 본문이 각주처럼 보였다.
            vw 계수를 낮춰 좁은 화면에서도 완만하게 오르내리게 한다. */}
        <h1 className="min-w-0 flex-1 text-[clamp(1.375rem,1.1rem_+_1.4vw,2.125rem)] font-semibold leading-[1.25] tracking-[-0.03em]">
          {post.title}
        </h1>
        <PostActions post={post} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--line)] pb-4 sm:pb-6">
        <time className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted)]">
          {formatDate(post.createdAt)}
        </time>
        <span className="font-mono text-[11px] text-[var(--muted)]">
          {readingStats(post.body).minutes}분 분량
        </span>
        {post.tags.map((tag) => (
          <Link
            key={tag}
            to={`/tags/${encodeURIComponent(tag)}`}
            className="rounded-md border border-[var(--line)] bg-[var(--bg-elev)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {tag}
          </Link>
        ))}
      </div>
      <div className="mt-6 sm:mt-8">
        <TableOfContents headings={headings} />
      </div>

      <div
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <PostNav post={post} />

      <div className="no-print">
        <CommentSection postId={post.id} />
      </div>
    </article>
  )
}
