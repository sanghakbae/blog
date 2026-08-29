import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllPosts, type Post } from '../lib/posts'
import { auditAll, summarize, type IssueArea, type PostAudit } from '../lib/seo'

const AREAS: IssueArea[] = ['SEO', 'GEO', '이미지', '에디토리얼']

const AREA_STYLE: Record<IssueArea, string> = {
  SEO: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  GEO: 'bg-emerald-500/15 text-emerald-600',
  이미지: 'bg-[var(--bg)] text-[var(--muted)]',
  에디토리얼: 'bg-amber-500/15 text-amber-600',
}

function scoreStyle(score: number): string {
  if (score >= 80) return 'bg-emerald-500/15 text-emerald-600'
  if (score >= 50) return 'bg-amber-500/15 text-amber-600'
  return 'bg-red-500/15 text-red-600'
}

export default function AdminSeo() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [area, setArea] = useState<IssueArea | null>(null)

  useEffect(() => {
    listAllPosts(300).then(setPosts).catch(() => setPosts([]))
  }, [])

  const audits = useMemo(() => (posts ? auditAll(posts) : []), [posts])
  const counts = useMemo(() => summarize(audits), [audits])

  const shown: PostAudit[] = area
    ? audits.filter((a) => a.issues.some((i) => i.area === area))
    : audits

  return (
    <div>
      <header className="mb-5">
        <h2 className="text-base font-semibold tracking-tight">SEO / GEO 상태</h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
          GEO 는 Generative Engine Optimization — 답변 엔진이 인용할 수 있는 구조 신호를 뜻합니다.
          점수가 낮은 글이 위에 옵니다.
        </p>
      </header>

      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {AREAS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setArea(area === a ? null : a)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              area === a
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--line)] bg-[var(--bg-elev)] hover:border-[var(--accent)]'
            }`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {a}
            </span>
            <span className="mt-1 block text-2xl font-semibold tabular-nums">{counts[a]}</span>
            <span className="text-[11px] text-[var(--muted)]">해결해야 할 항목</span>
          </button>
        ))}
      </div>

      {!posts && <p className="text-xs text-[var(--muted)]">불러오는 중…</p>}
      {posts && shown.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--line)] py-12 text-center text-xs text-[var(--muted)]">
          해당하는 글이 없습니다.
        </p>
      )}

      <ul className="space-y-2">
        {shown.map((a) => (
          <li key={a.id} className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Link
                to={`/admin/edit/${a.id}`}
                className="text-[13px] font-semibold transition-colors hover:text-[var(--accent)]"
              >
                {a.title}
              </Link>

              <span className="ml-auto flex items-center gap-2 font-mono text-[10px] text-[var(--muted)]">
                <span>FAQ {a.faq}</span>
                <span>· 인용 {a.citations}</span>
                <span>· 키워드 {a.keywords}</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${scoreStyle(a.score)}`}
                >
                  {a.score}
                </span>
              </span>
            </div>

            {a.issues.length === 0 ? (
              <p className="mt-2 text-[11px] text-emerald-600">모든 항목을 충족합니다.</p>
            ) : (
              <ul className="mt-2.5 space-y-1.5">
                {a.issues
                  .filter((i) => !area || i.area === area)
                  .map((i) => (
                    <li key={i.field} className="flex flex-wrap items-baseline gap-2 text-[11px]">
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${AREA_STYLE[i.area]} ${
                          i.level === 'fail' ? 'ring-1 ring-red-500/40' : ''
                        }`}
                      >
                        {i.area}
                      </span>
                      <code className="shrink-0 font-mono text-[10px] text-[var(--muted)]">
                        {i.field}
                      </code>
                      <span className="text-[var(--ink)]">— {i.message}</span>
                    </li>
                  ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
