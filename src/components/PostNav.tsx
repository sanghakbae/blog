import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdjacentPosts, listPostsByTag, type Post } from '../lib/posts'
import { formatDate } from '../lib/date'

/** 글 아래에 붙는 이전·다음 글과 같은 태그의 글 */
export default function PostNav({ post }: { post: Post }) {
  const [siblings, setSiblings] = useState<{ prev?: Post; next?: Post }>({})
  const [related, setRelated] = useState<Post[]>([])

  useEffect(() => {
    getAdjacentPosts(post).then(setSiblings).catch(() => {})
  }, [post])

  useEffect(() => {
    if (!post.tags.length) return setRelated([])
    Promise.all(post.tags.map((t) => listPostsByTag(t, 12)))
      .then((lists) => {
        const seen = new Set([post.id])
        const picked: Post[] = []
        // 태그를 번갈아 골라 한 태그에 쏠리지 않게 한다
        for (let round = 0; round < 12 && picked.length < 4; round++) {
          for (const list of lists) {
            const candidate = list[round]
            if (candidate && !seen.has(candidate.id)) {
              seen.add(candidate.id)
              picked.push(candidate)
            }
          }
        }
        setRelated(picked.slice(0, 4))
      })
      .catch(() => {})
  }, [post.id, post.tags])

  return (
    <div className="no-print mt-10 space-y-8">
      {(siblings.prev || siblings.next) && (
        <nav className="grid gap-2 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
          {siblings.prev ? (
            <Link
              to={`/posts/${siblings.prev.id}`}
              className="rounded-lg border border-[var(--line)] p-3 transition-colors hover:border-[var(--accent)]"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                ← 이전 글
              </span>
              <span className="mt-1 block truncate text-[13px] font-medium">
                {siblings.prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {siblings.next && (
            <Link
              to={`/posts/${siblings.next.id}`}
              className="rounded-lg border border-[var(--line)] p-3 text-right transition-colors hover:border-[var(--accent)]"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                다음 글 →
              </span>
              <span className="mt-1 block truncate text-[13px] font-medium">
                {siblings.next.title}
              </span>
            </Link>
          )}
        </nav>
      )}

      {related.length > 0 && (
        <section>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            같은 태그의 글
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/posts/${r.id}`}
                  className="block rounded-lg border border-[var(--line)] p-3 transition-colors hover:border-[var(--accent)]"
                >
                  <span className="block truncate text-[13px] font-medium">{r.title}</span>
                  <span className="mt-1 flex items-center gap-2 font-mono text-[10px] text-[var(--muted)]">
                    {formatDate(r.createdAt)}
                    <span className="flex gap-1">
                      {r.tags.slice(0, 2).map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
