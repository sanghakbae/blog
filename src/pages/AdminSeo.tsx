import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllPosts, type Post } from '../lib/posts'
import { auditAll, summarize, type IssueArea, type PostAudit } from '../lib/seo'
import {
  ENGINES, ENGINE_LABEL, confirmedOn, searchUrl, toggleIndexed,
  type Engine, type IndexStatus,
} from '../lib/indexStatus'

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
  // 색인 확인 기록은 화면에서 바로 갱신한다
  const [status, setStatus] = useState<Record<string, IndexStatus>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    listAllPosts(300)
      .then((list) => {
        setPosts(list)
        setStatus(Object.fromEntries(list.map((p) => [p.id, p.indexStatus ?? {}])))
      })
      .catch(() => setPosts([]))
  }, [])

  const indexed = (engine: Engine) =>
    Object.values(status).filter((s) => s[engine]).length

  async function mark(postId: string, engine: Engine) {
    // 규칙에 막히거나 연결이 끊기면 조용히 실패한다. 눌렀는데 아무 일도
    // 일어나지 않으면 눌리지 않은 것으로 오해하므로 이유를 보여준다.
    try {
      const next = await toggleIndexed(postId, engine, status[postId] ?? {})
      setStatus((prev) => ({ ...prev, [postId]: next }))
      setError('')
    } catch (err) {
      setError(`색인 기록을 저장하지 못했습니다 — ${(err as Error).message}`)
    }
  }

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

      {error && (
        <p className="mb-3 rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-[11px] text-red-500">
          {error}
        </p>
      )}

      {/* 지적 4종 + 포털 3종. 넓은 화면은 한 줄, 좁은 화면은 네 개씩 두 줄. */}
      <div className="mb-6 grid grid-cols-4 gap-1 sm:gap-1.5 lg:grid-cols-7">
        {AREAS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setArea(area === a ? null : a)}
            className={`rounded-lg border p-1.5 text-left transition-colors sm:p-2.5 ${
              area === a
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--line)] bg-[var(--bg-elev)] hover:border-[var(--accent)]'
            }`}
          >
            <span className="block truncate text-[10px] font-bold tracking-tight text-[var(--muted)] sm:text-[13px]">
              {a}
            </span>
            <span className="mt-0.5 block text-center text-base font-semibold tabular-nums sm:text-xl">
              {counts[a]}
            </span>
          </button>
        ))}

        {ENGINES.map((e) => (
          <div key={e} className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] p-1.5 sm:p-2.5">
            <span className="block truncate text-[10px] font-bold tracking-tight text-[var(--muted)] sm:text-[13px]">
              {ENGINE_LABEL[e]}
            </span>
            <span className="mt-0.5 block text-center text-base font-semibold tabular-nums sm:text-xl">
              {indexed(e)}
              <span className="text-[10px] font-normal text-[var(--muted)] sm:text-xs">
                {' / '}
                {posts?.length ?? 0}
              </span>
            </span>
          </div>
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

              {/* 포털을 누르면 site: 검색이 새 탭에서 열리고 확인 기록이 함께 남는다.
                  색인 여부를 사이트가 스스로 알아낼 방법이 없어(검색 결과 수집은 각 사
                  약관 위반) 사람이 확인한 사실을 기록하는 방식이다. 잘못 눌렀으면
                  켜진 배지의 ✕ 로 되돌린다. */}
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--muted)]">색인</span>
                {ENGINES.map((e) => {
                  const on = !!status[a.id]?.[e]
                  return (
                    <span
                      key={e}
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                        on
                          ? 'border-amber-400 bg-amber-300/60 font-medium text-amber-900'
                          : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                      }`}
                    >
                      <a
                        href={searchUrl(e, a.id)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => { if (!on) void mark(a.id, e) }}
                        title={`${ENGINE_LABEL[e]}에서 site: 검색을 열고 확인 기록을 남깁니다`}
                      >
                        {ENGINE_LABEL[e]}
                        {on && ` ${confirmedOn(status[a.id] ?? {}, e)}`}
                      </a>
                      {on && (
                        <button
                          type="button"
                          onClick={() => void mark(a.id, e)}
                          aria-label={`${ENGINE_LABEL[e]} 확인 기록 해제`}
                          title="확인 기록 해제"
                          className="text-amber-900/60 transition-colors hover:text-amber-900"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  )
                })}
              </span>

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
              <ul className="mt-2.5 grid grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1.5 text-[11px]">
                {/* 배지와 항목 이름은 길이가 제각각이라, 행마다 따로 배치하면 설명이
                    시작하는 자리가 들쭉날쭉해진다. 목록 전체를 세 칸 격자로 두고 각
                    행이 그 칸을 물려받게 해서 설명의 왼쪽 끝을 한 줄로 맞춘다. */}
                {a.issues
                  .filter((i) => !area || i.area === area)
                  .map((i) => (
                    <li
                      key={i.field}
                      className="col-span-3 grid grid-cols-subgrid items-baseline"
                    >
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${AREA_STYLE[i.area]} ${
                          i.level === 'fail' ? 'ring-1 ring-red-500/40' : ''
                        }`}
                      >
                        {i.area}
                      </span>
                      <code className="font-mono text-[10px] text-[var(--muted)]">{i.field}</code>
                      <span className="min-w-0 text-[var(--ink)]">{i.message}</span>
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
