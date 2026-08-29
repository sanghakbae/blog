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
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/75 backdrop-blur-xl">
        <div className="flex w-full items-center gap-4 px-4 py-3.5 sm:px-6 lg:px-10">
          <Link
            to="/"
            className="group flex items-center gap-2 text-[15px] font-semibold tracking-tight"
          >
            <span className="grid size-6 place-items-center rounded-lg bg-[var(--ink)] text-[11px] font-bold text-[var(--bg)] transition-transform group-hover:-rotate-6">
              s
            </span>
            sanghak
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
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] lg:hidden"
            aria-expanded={menuOpen}
          >
            태그
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-[var(--line)] px-4 py-4 sm:px-6 lg:hidden">
            <TagSidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        )}
      </header>

      <div className="flex w-full gap-8 px-4 py-8 sm:px-6 lg:gap-14 lg:px-10 lg:py-12">
        <aside className="hidden shrink-0 lg:block lg:w-44 xl:w-56">
          <div className="sticky top-24">
            <TagSidebar />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      <footer className="mt-8 border-t border-[var(--line)]">
        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 px-4 py-8 text-xs text-[var(--muted)] sm:px-6 lg:px-10">
          <span>© {new Date().getFullYear()} sanghak</span>
          <Link to="/privacy" className="transition-colors hover:text-[var(--ink)]">
            개인정보처리방침
          </Link>
          <span>개인정보 보호책임자 배상학</span>
          <a href="mailto:bae@sanghak.kr" className="transition-colors hover:text-[var(--ink)]">
            bae@sanghak.kr
          </a>
        </div>
      </footer>
    </div>
  )
}
