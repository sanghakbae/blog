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

export default function PostView() {
  const { id = '' } = useParams()
  const [post, setPost] = useState<Post | null | 'missing'>(null)
  const [html, setHtml] = useState('')
  const [headings, setHeadings] = useState<Heading[]>([])

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
    import('../lib/markdown').then((m) => {
      if (!alive) return
      setHtml(m.renderMarkdown(post.body))
      setHeadings(m.extractHeadings(post.body))
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
        <h1 className="min-w-0 flex-1 text-[clamp(1.4rem,4.5vw,3.25rem)] font-semibold leading-[1.2] tracking-[-0.03em]">
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
