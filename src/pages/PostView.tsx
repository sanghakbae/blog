import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPost, type Post } from '../lib/posts'

import { formatDate } from '../lib/date'

export default function PostView() {
  const { id = '' } = useParams()
  const [post, setPost] = useState<Post | null | 'missing'>(null)
  const [html, setHtml] = useState('')

  useEffect(() => {
    getPost(id).then((p) => setPost(p ?? 'missing')).catch(() => setPost('missing'))
  }, [id])

  useEffect(() => {
    if (typeof post !== 'object' || !post) return
    import('../lib/markdown').then((m) => setHtml(m.renderMarkdown(post.body)))
  }, [post])

  if (post === null) return <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
  if (post === 'missing') return <p className="text-sm text-[var(--muted)]">글을 찾을 수 없습니다.</p>

  return (
    <article>
      <Link
        to="/"
        className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
      >
        ← 전체 글
      </Link>

      <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[2.6rem]">
        {post.title}
      </h1>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--line)] pb-6">
        <time className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted)]">
          {formatDate(post.createdAt)}
        </time>
        {post.tags.map((tag) => (
          <Link
            key={tag}
            to={`/tags/${encodeURIComponent(tag)}`}
            className="rounded-full bg-[var(--bg-elev)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          >
            #{tag}
          </Link>
        ))}
      </div>
      <div
        className="prose mt-9 max-w-3xl"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  )
}
