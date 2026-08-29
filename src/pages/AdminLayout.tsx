import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'

const tabs = [
  { to: '/admin', label: '글', end: true },
  { to: '/admin/audit', label: '감사 로그', end: false },
  { to: '/admin/security', label: '보안', end: false },
]

export default function AdminLayout() {
  const { signOut, user } = useAuth()

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

      <nav className="mb-8 flex gap-1 border-b border-[var(--line)]">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
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

      <Outlet />
    </div>
  )
}
