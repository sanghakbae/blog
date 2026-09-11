import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { requestReindex } from '../lib/reindex'

const tabs = [
  { to: '/admin', label: '글', end: true },
  { to: '/admin/audit', label: '감사 로그', end: false },
  { to: '/admin/seo', label: 'SEO / GEO', end: false },
  { to: '/admin/security', label: '보안', end: false },
  { to: '/admin/stats', label: '통계', end: false },
]

export default function AdminLayout() {
  const { user } = useAuth()
  // 새 글 버튼은 글 목록에서만 뜻이 있다
  const onPostList = useLocation().pathname.replace(/\/$/, '') === '/admin'
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  /**
   * 갱신은 공짜가 아니다 — 글 한 편이 URL 검사 API 호출 한 번이고 하루 한도가
   * 2,000건이다. 실수로 눌러 한도를 태우는 일이 없게 한 번 묻는다.
   */
  async function reindex() {
    if (!confirm('색인 상태를 지금 갱신할까요?\n글 수만큼 조회하므로 하루 한도(2,000건)를 씁니다.'))
      return
    setError('')
    setState('sending')
    try {
      await requestReindex()
      setState('sent')
    } catch (err) {
      setError((err as Error).message)
      setState('idle')
    }
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">관리</h1>
        <span className="text-xs text-[var(--muted)]">{user?.email}</span>
        {/* 로그아웃은 헤더의 계정 아이콘에 있다. 여기서는 관리 화면에서만
            뜻이 있는 것 — 색인 갱신 — 에 자리를 준다. */}
        <div className="ml-auto flex items-center gap-2">
          {error && <span className="text-xs text-red-500">{error}</span>}
          {state === 'sent' && (
            <span className="text-xs text-[var(--muted)]">
              요청했습니다 — 10분쯤 뒤 SEO / GEO 에 반영됩니다
            </span>
          )}
          <button
            type="button"
            onClick={reindex}
            disabled={state !== 'idle'}
            title="Search Console 에 각 글의 색인 여부를 다시 물어봅니다"
            className="rounded-md border border-[var(--line)] px-2.5 py-1 text-sm text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            {state === 'sending' ? '요청 중…' : state === 'sent' ? '요청됨' : '색인 갱신'}
          </button>
        </div>
      </header>

      <div className="mb-8 flex items-end gap-3 border-b border-[var(--line)]">
        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `-mb-px shrink-0 border-b-2 px-2.5 py-2 text-sm whitespace-nowrap transition-colors sm:px-3 ${
                  isActive
                    ? 'border-[var(--accent)] font-medium text-[var(--accent)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        {onPostList && (
          <Link
            to="/admin/new"
            className="mb-1.5 shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
          >
            새 글
          </Link>
        )}
      </div>

      <Outlet />
    </div>
  )
}
