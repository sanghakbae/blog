import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { IndexSummary } from '../lib/indexSummary'

/**
 * 로그인하면 한 번 보여 주는 색인 현황.
 *
 * 12시간마다 도는 확인의 결과를 관리 화면까지 들어가야 볼 수 있었다. 로그인은
 * 자주 하는 일이 아니므로, 들어온 김에 그동안 무엇이 색인됐는지 먼저 보여 준다.
 *
 * 숫자를 크게 늘어놓지 않는다. 알고 싶은 것은 "늘었나" 하나뿐이고, 자세한 것은
 * SEO / GEO 화면에 이미 있다.
 */
function since(iso: string): string {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return '알 수 없음'
  const mins = Math.round((Date.now() - at) / 60000)
  if (mins < 60) return `${mins}분 전`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.round(hours / 24)}일 전`
}

export default function IndexReportModal({
  summary,
  onClose,
}: {
  summary: IndexSummary
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  // PrivacyModal 과 같은 이유 — StrictMode 의 정리 단계에서 나는 close 를
  // 진짜 닫힘으로 착각하면 팝업이 뜨지 않는다.
  const closing = useRef(false)

  useEffect(() => {
    closing.current = false
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      closing.current = true
      document.body.style.overflow = ''
    }
  }, [])

  const pct = summary.published
    ? Math.round((summary.indexed / summary.published) * 100)
    : 0

  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (!closing.current) onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-[min(30rem,90vw)] rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-0 text-[var(--ink)] backdrop:bg-black/45 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <h2 className="text-[12px] font-semibold">구글 색인 현황</h2>
        <span className="text-[10px] text-[var(--muted)]">{since(summary.at)} 확인</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="ml-auto grid size-6 place-items-center rounded-full text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink)]"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl leading-none tabular-nums">{summary.indexed}</span>
          <span className="text-[11px] text-[var(--muted)]">
            / {summary.published}편 · {pct}%
          </span>
        </div>

        {/* 막대 하나로 충분하다 — 비율 말고는 볼 것이 없다 */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
        </div>

        {summary.newlyIndexed.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-medium text-emerald-600">
              새로 색인됨 {summary.newlyIndexed.length}편
            </p>
            <ul className="mt-1.5 space-y-1">
              {summary.newlyIndexed.slice(0, 5).map((p) => (
                <li key={p.id} className="truncate text-[11px]">
                  <Link
                    to={`/posts/${p.id}`}
                    onClick={onClose}
                    className="text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                  >
                    {p.title}
                  </Link>
                </li>
              ))}
              {summary.newlyIndexed.length > 5 && (
                <li className="text-[11px] text-[var(--muted)]">
                  외 {summary.newlyIndexed.length - 5}편
                </li>
              )}
            </ul>
          </div>
        )}

        {summary.lost.length > 0 && (
          <p className="mt-4 text-[11px] text-red-500">
            색인에서 빠짐 {summary.lost.length}편 — {summary.lost[0].title}
            {summary.lost.length > 1 && ` 외 ${summary.lost.length - 1}편`}
          </p>
        )}

        {summary.newlyIndexed.length === 0 && summary.lost.length === 0 && (
          <p className="mt-4 text-[11px] text-[var(--muted)]">
            지난 확인 이후 바뀐 글이 없습니다.
          </p>
        )}

        <p className="mt-4 text-[10px] leading-relaxed text-[var(--muted)]">
          이번에 {summary.checked}편을 조회했습니다. 이미 색인된 {summary.skipped}편은 7일간
          건너뜁니다{summary.failed ? ` · 조회 실패 ${summary.failed}편` : ''}.
        </p>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-2.5">
        <Link
          to="/admin/seo"
          onClick={onClose}
          className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
        >
          자세히 보기
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-md bg-[var(--accent)] px-3 py-1 text-[11px] font-medium text-[var(--accent-ink)]"
        >
          확인
        </button>
      </div>
    </dialog>
  )
}
