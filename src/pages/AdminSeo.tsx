import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllPosts, setIndexStatus, type Post } from '../lib/posts'
import { auditAll, summarize, type IssueArea, type PostAudit } from '../lib/seo'
import {
  ENGINES, ENGINE_LABEL, confirmedOn, searchUrl,
  type Engine, type IndexStatus,
} from '../lib/indexStatus'
import IndexCheckModal from '../components/IndexCheckModal'

const AREAS: IssueArea[] = ['SEO', 'GEO', '이미지', '에디토리얼']

/** 좁은 화면에서 7칸을 한 줄에 넣으면 칸당 45px 정도라 다섯 글자가 잘린다. */
const AREA_SHORT: Partial<Record<IssueArea, string>> = { 에디토리얼: '에디터' }

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
  /** 카드 하나만 걸린다. 지적 영역이면 그 지적이 있는 글, 포털이면 그 포털에 색인된 글. */
  type Filter = { kind: 'area'; v: IssueArea } | { kind: 'engine'; v: Engine }
  const [filter, setFilter] = useState<Filter | null>(null)
  const area = filter?.kind === 'area' ? filter.v : null
  // 색인 상태는 CI 가 Search Console API 로 채운 값을 그대로 보여준다
  const [status, setStatus] = useState<Record<string, IndexStatus>>({})
  /** 열려 있는 색인 확인 팝업. 한 번에 하나만 연다. */
  const [checking, setChecking] = useState<{ id: string; title: string; engine: Engine } | null>(
    null,
  )
  const [saving, setSaving] = useState(false)

  /**
   * 관리자가 눈으로 본 결과를 기록한다.
   *
   * 화면을 먼저 바꾸고 저장한다 — 기록은 사람이 이미 확인한 사실이라 되돌릴 일이
   * 거의 없고, 500편을 훑는 동안 매번 왕복을 기다리면 손이 멈춘다. 실패하면
   * 되돌려 놓아 화면이 거짓말을 하지 않게 한다.
   */
  async function mark(id: string, engine: Engine, on: boolean) {
    const before = status[id] ?? {}
    const next = { ...before }
    if (on) next[engine] = new Date().toISOString()
    else delete next[engine]
    setStatus((m) => ({ ...m, [id]: next }))
    setChecking(null)
    setSaving(true)
    try {
      await setIndexStatus(id, engine, on)
    } catch (err) {
      setStatus((m) => ({ ...m, [id]: before }))
      alert(`색인 기록을 저장하지 못했습니다: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    listAllPosts()
      .then((list) => {
        setPosts(list)
        setStatus(Object.fromEntries(list.map((p) => [p.id, p.indexStatus ?? {}])))
      })
      .catch(() => setPosts([]))
  }, [])

  const indexed = (engine: Engine) =>
    Object.values(status).filter((s) => s[engine]).length

  const audits = useMemo(() => (posts ? auditAll(posts) : []), [posts])
  const counts = useMemo(() => summarize(audits), [audits])

  const shown: PostAudit[] = !filter
    ? audits
    : filter.kind === 'area'
      ? audits.filter((a) => a.issues.some((i) => i.area === filter.v))
      : audits.filter((a) => status[a.id]?.[filter.v])

  return (
    <div>
      <header className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight">SEO / GEO 상태</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
          GEO 는 Generative Engine Optimization — 답변 엔진이 인용할 수 있는 구조 신호를 뜻합니다.
          점수가 낮은 글이 위에 옵니다.
        </p>
        {/* 같은 모양의 칸에 0 이 두 가지 뜻으로 놓여 있었다.
            앞 네 칸의 0 은 지적이 없다는 뜻이고, 뒤 세 칸의 0 은 색인된 글이
            없다는 뜻이다. 정반대인데 구분이 없어 오해를 부른다. */}
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
          아래 앞 네 칸은 <strong className="font-medium text-[var(--ink)]">남은 지적 수</strong>라
          0 이 좋은 상태이고, 뒤 세 칸은{' '}
          <strong className="font-medium text-[var(--ink)]">색인이 확인된 글 수</strong>라 클수록
          좋습니다. 구글은 12시간마다 자동으로 확인합니다. 네이버·빙은 확인 API 가 없어, 배지를 누르면
          site: 검색이 팝업으로 열리고 아래의{' '}
          <strong className="font-medium text-[var(--ink)]">있음 / 없음</strong>으로 기록합니다.
        </p>
      </header>

      {/* 지적 4종 + 포털 3종. 넓은 화면은 한 줄, 좁은 화면은 네 개씩 두 줄. */}
      <div className="mb-6 grid grid-cols-7 gap-1 sm:gap-1.5">
        {AREAS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setFilter(area === a ? null : { kind: 'area', v: a })}
            className={`rounded-lg border p-1 text-left transition-colors sm:p-2.5 ${
              area === a
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--line)] bg-[var(--bg-elev)] hover:border-[var(--accent)]'
            }`}
          >
            <span className="block truncate text-[11px] font-bold tracking-tight text-[var(--muted)] sm:text-[13px]">
              <span className={AREA_SHORT[a] ? 'sm:hidden' : ''}>{AREA_SHORT[a] ?? a}</span>
              {AREA_SHORT[a] && <span className="hidden sm:inline">{a}</span>}
            </span>
            <span
              className={`mt-0.5 block text-center text-[13px] font-semibold tabular-nums sm:text-xl ${
                counts[a] === 0 ? 'text-emerald-600' : 'text-[var(--ink)]'
              }`}
            >
              {counts[a]}
            </span>
          </button>
        ))}

        {ENGINES.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() =>
              setFilter(filter?.kind === 'engine' && filter.v === e ? null : { kind: 'engine', v: e })
            }
            className={`rounded-lg border p-1 text-left transition-colors sm:p-2.5 ${
              filter?.kind === 'engine' && filter.v === e
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--line)] bg-[var(--bg-elev)] hover:border-[var(--accent)]'
            }`}
          >
            <span className="block truncate text-[11px] font-bold tracking-tight text-[var(--muted)] sm:text-[13px]">
              {ENGINE_LABEL[e]}
              {/* 구글만 API 로 확인된다. 나머지는 사람이 눌러 확인한 기록이다. */}
              <span className="ml-1 hidden font-normal text-[11px] sm:inline">
                {e === 'google' ? '자동' : '수동'}
              </span>
            </span>
            <span className="mt-0.5 block text-center text-[13px] font-semibold tabular-nums sm:text-xl">
              {indexed(e)}
              {/* 좁은 화면에서는 아래로 내린다. 한 줄에 붙이면 7칸이 넘친다. */}
              <span className="block text-[11px] font-normal text-[var(--muted)] sm:inline sm:text-[13px]">
                <span className="hidden sm:inline">{' / '}</span>
                <span className="sm:hidden">/</span>
                {posts?.length ?? 0}
              </span>
            </span>
          </button>
        ))}
      </div>

      {!posts && <p className="text-[13px] text-[var(--muted)]">불러오는 중…</p>}
      {posts && shown.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--line)] py-12 text-center text-[13px] text-[var(--muted)]">
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

              {/* 네이버·빙은 같은 화면 안 팝업에서 결과를 보고 바로 기록한다.
                  구글은 팝업에 담을 것이 없다 — iframe 을 막는 데다 배지 값을
                  API 가 채우므로 기록할 것도 없어서, 검색만 새 탭으로 연다. */}
              <span className="flex items-center gap-1.5">
                <span className="text-[11px] text-[var(--muted)]">색인</span>
                {ENGINES.map((e) => {
                  const on = !!status[a.id]?.[e]
                  const style = `rounded border px-1.5 py-0.5 text-[11px] transition-colors ${
                    on
                      ? 'border-amber-400 bg-amber-300/60 font-medium text-amber-900'
                      : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }`
                  const label = (
                    <>
                      {ENGINE_LABEL[e]}
                      {on && ` ${confirmedOn(status[a.id] ?? {}, e)}`}
                    </>
                  )

                  return e === 'google' ? (
                    <a
                      key={e}
                      href={searchUrl(e, a.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="구글 site: 검색을 새 탭에서 엽니다 (상태는 API 가 자동으로 채웁니다)"
                      className={style}
                    >
                      {label}
                    </a>
                  ) : (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setChecking({ id: a.id, title: a.title, engine: e })}
                      title={`${ENGINE_LABEL[e]} site: 검색을 열고, 본 결과를 기록합니다`}
                      className={style}
                    >
                      {label}
                    </button>
                  )
                })}
              </span>

              <span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-[var(--muted)]">
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
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${AREA_STYLE[i.area]} ${
                          i.level === 'fail' ? 'ring-1 ring-red-500/40' : ''
                        }`}
                      >
                        {i.area}
                      </span>
                      <code className="font-mono text-[11px] text-[var(--muted)]">{i.field}</code>
                      <span className="min-w-0 text-[var(--ink)]">{i.message}</span>
                    </li>
                  ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {checking && (
        <IndexCheckModal
          postId={checking.id}
          title={checking.title}
          engine={checking.engine}
          saving={saving}
          onMark={(on) => mark(checking.id, checking.engine, on)}
          onClose={() => setChecking(null)}
        />
      )}
    </div>
  )
}
