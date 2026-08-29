import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listPosts, type Post } from '../lib/posts'

/** 제목·요약·태그·본문 순으로 가중치를 줘 점수를 매긴다 */
function score(post: Post, terms: string[]): number {
  const title = post.title.toLowerCase()
  const excerpt = post.excerpt.toLowerCase()
  const tags = post.tags.join(' ').toLowerCase()
  const body = post.body.toLowerCase()

  let total = 0
  for (const t of terms) {
    if (!t) continue
    let hit = 0
    if (title.includes(t)) hit += 10
    if (tags.includes(t)) hit += 6
    if (excerpt.includes(t)) hit += 3
    if (body.includes(t)) hit += 1
    if (!hit) return 0 // 모든 단어가 어딘가에는 있어야 한다
    total += hit
  }
  return total
}

/** 마크다운 기호를 걷어내 읽을 수 있는 문장만 남긴다 */
function plain(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\|.*\|\s*$/gm, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 본문에서 검색어 주변을 잘라 보여준다 */
function snippet(post: Post, term: string): string {
  const text = plain(post.body)
  const at = term ? text.toLowerCase().indexOf(term) : -1
  if (at < 0) return post.excerpt
  const from = Math.max(0, at - 40)
  return (from > 0 ? '…' : '') + text.slice(from, at + 90) + '…'
}

export default function SearchDialog({ onClose }: { onClose: () => void }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const ref = useRef<HTMLDialogElement>(null)
  const closing = useRef(false)
  const navigate = useNavigate()

  useEffect(() => {
    listPosts(500).then(setPosts).catch(() => setPosts([]))
  }, [])

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      closing.current = true
      document.body.style.overflow = ''
    }
  }, [])

  const results = useMemo(() => {
    const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean)
    if (!terms.length) return []
    return posts
      .map((p) => ({ post: p, s: score(p, terms) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map((r) => r.post)
  }, [q, posts])

  useEffect(() => setCursor(0), [q])

  function open(post: Post) {
    onClose()
    navigate(`/posts/${post.id}`)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    }
    if (e.key === 'Enter' && results[cursor]) open(results[cursor])
  }

  return (
    <dialog
      ref={ref}
      onClose={() => { if (!closing.current) onClose() }}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      className="m-auto flex h-[80dvh] max-h-none w-[min(40rem,calc(100vw-1.5rem))] flex-col rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-0 text-[var(--ink)] backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] px-4">
        <span className="text-[var(--muted)]">⌕</span>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="제목, 태그, 본문에서 찾기"
          className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-[var(--muted)]"
        />
        <kbd className="hidden shrink-0 rounded border border-[var(--line)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)] sm:block">
          ESC
        </kbd>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {q && results.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-[var(--muted)]">결과가 없습니다.</p>
        )}
        {!q && (
          <p className="px-4 py-8 text-center text-xs text-[var(--muted)]">
            글 {posts.length}편에서 찾습니다.
          </p>
        )}

        <ul>
          {results.map((post, i) => (
            <li key={post.id}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => open(post)}
                className={`block w-full border-b border-[var(--line)] px-4 py-3 text-left last:border-0 ${
                  i === cursor ? 'bg-[var(--accent-soft)]' : ''
                }`}
              >
                <span className="block text-[13px] font-medium">{post.title}</span>
                <span className="mt-1 block line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">
                  {snippet(post, q.toLowerCase().trim().split(/\s+/)[0])}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {post.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]"
                    >
                      {t}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  )
}
