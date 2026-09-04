import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'

const tabs = [
  { to: '/admin', label: '글', end: true },
  { to: '/admin/audit', label: '감사 로그', end: false },
  { to: '/admin/seo', label: 'SEO / GEO', end: false },
  { to: '/admin/security', label: '보안', end: false },
]

export default function AdminLayout() {
  const { signOut, user } = useAuth()
  // 새 글 버튼은 글 목록에서만 뜻이 있다
  const onPostList = useLocation().pathname.replace(/\/$/, '') === '/admin'

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">관리</h1>
        <span className="text-xs text-[var(--muted)]">{user?.email}</span>
        <button
          type="button"
          onClick={() => signOut()}
          className="ml-auto text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        >
          로그아웃
        </button>
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
