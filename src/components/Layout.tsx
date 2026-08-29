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
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[color-mix(in_oklab,Canvas_86%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-4">
          <Link to="/" className="text-[15px] font-semibold tracking-tight">
            sanghak
          </Link>
          <div className="flex-1" />
          {inAdmin && (
            <Link to="/admin" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
              관리
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg border border-[var(--color-line)] px-2.5 py-1 text-sm lg:hidden"
            aria-expanded={menuOpen}
          >
            태그
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-[var(--color-line)] px-5 py-4 lg:hidden">
            <TagSidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        )}
      </header>

      <div className="mx-auto flex max-w-5xl gap-10 px-5 py-10">
        <aside className="hidden w-48 shrink-0 lg:block">
          <div className="sticky top-24">
            <TagSidebar />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      <footer className="border-t border-[var(--color-line)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-8 text-xs text-[var(--color-muted)]">
          <span>© {new Date().getFullYear()} sanghak</span>
          <Link to="/privacy" className="hover:text-[var(--color-ink)]">
            개인정보처리방침
          </Link>
          <span>개인정보 보호책임자 배상학</span>
          <a href="mailto:bae@sanghak.kr" className="hover:text-[var(--color-ink)]">
            bae@sanghak.kr
          </a>
        </div>
      </footer>
    </div>
  )
}
