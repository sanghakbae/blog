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

  if (post === null) return <p className="text-sm text-[var(--color-muted)]">불러오는 중…</p>
  if (post === 'missing') return <p className="text-sm text-[var(--color-muted)]">글을 찾을 수 없습니다.</p>

  return (
    <article>
      <Link to="/" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">
        ← 전체 글
      </Link>
      <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">{post.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--color-line)] pb-6">
        <time className="text-xs text-[var(--color-muted)]">{formatDate(post.createdAt)}</time>
        {post.tags.map((tag) => (
          <Link
            key={tag}
            to={`/tags/${encodeURIComponent(tag)}`}
            className="rounded-full border border-[var(--color-line)] px-2.5 py-0.5 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            #{tag}
          </Link>
        ))}
      </div>
      <div
        className="prose mt-8"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  )
}
