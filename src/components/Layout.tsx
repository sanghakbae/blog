import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import TagSidebar from './TagSidebar'

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  // 방문자에게 firebase/auth 를 내려보내지 않으려고 여기서는 로그인 상태를 보지 않는다.
  // 관리 링크는 /admin 안에서만 노출하고, 실제 권한 확인은 RequireAdmin 이 한다.
  const inAdmin = useLocation().pathname.startsWith('/admin')

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/80 backdrop-blur-xl">
        <div className="flex w-full items-center gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Link to="/" className="group flex items-baseline gap-2">
            <span className="display text-2xl">sanghak</span>
            <span className="hidden text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] sm:inline">
              blog
            </span>
          </Link>

          <div className="flex-1" />

          {inAdmin && (
            <Link
              to="/admin"
              className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            >
              관리
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-full bg-[var(--ink)] px-3.5 py-1.5 text-xs font-medium text-[var(--bg)] lg:hidden"
            aria-expanded={menuOpen}
          >
            태그
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-[var(--line)] px-5 py-5 sm:px-8 lg:hidden">
            <TagSidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        )}
      </header>

      <div className="flex w-full gap-10 px-5 py-10 sm:px-8 lg:gap-16 lg:px-12 lg:py-16">
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>

        {/* 사이드바를 오른쪽에 둬서 본문이 왼쪽 기준선에 붙는다 */}
        <aside className="hidden shrink-0 lg:block lg:w-52 xl:w-60">
          <div className="sticky top-28">
            <TagSidebar />
          </div>
        </aside>
      </div>

      <footer className="border-t border-[var(--line)]">
        <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 px-5 py-10 text-xs text-[var(--muted)] sm:px-8 lg:px-12">
          <span>© {new Date().getFullYear()} sanghak</span>
          <Link to="/privacy" className="transition-colors hover:text-[var(--ink)]">
            개인정보처리방침
          </Link>
        </div>
      </footer>
    </div>
  )
}
