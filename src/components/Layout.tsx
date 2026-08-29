import { Suspense, lazy, useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import TagSidebar from './TagSidebar'
import AuthButton from './AuthButton'
import ThemeToggle from './ThemeToggle'

// 처리방침은 열어볼 때만 내려받는다
const PrivacyModal = lazy(() => import('./PrivacyModal'))
const SearchDialog = lazy(() => import('./SearchDialog'))

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // ⌘K / Ctrl+K 로 어디서든 검색을 연다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="appbar z-20 shrink-0 border-b border-[var(--line)]">
        <div className="flex w-full items-center gap-4 px-2 py-2 sm:px-3 lg:px-4">
          <Link to="/" className="group flex items-baseline gap-2">
            <span className="display text-2xl">sanghak</span>
            <span className="hidden text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] sm:inline">
              blog
            </span>
          </Link>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <span aria-hidden>⌕</span>
            <span className="hidden sm:inline">검색</span>
            <kbd className="hidden font-mono text-[10px] opacity-60 lg:inline">⌘K</kbd>
          </button>

          <ThemeToggle />

          <AuthButton />

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md bg-[var(--ink)] px-3.5 py-1.5 text-xs font-medium text-[var(--bg)] lg:hidden"
            aria-expanded={menuOpen}
          >
            태그
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-[var(--line)] px-2 py-2 sm:px-3 lg:hidden">
            <TagSidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        )}
      </header>

      <div className="flex min-h-0 w-full flex-1">
        {/* 본문만 스크롤한다. 헤더와 푸터는 자리에 남는다. */}
        <main className="min-w-0 flex-1 overflow-y-auto px-2 py-3 sm:px-3 lg:px-4">
          <Outlet />
        </main>

        {/* 사이드바를 오른쪽에 둬서 본문이 왼쪽 기준선에 붙는다.
            태그는 화면에 들어가는 만큼만 자동으로 보여준다. */}
        <aside className="hidden shrink-0 overflow-hidden border-l border-[var(--line)] bg-[var(--bg-elev)] p-4 lg:block lg:w-56 xl:w-64">
          <TagSidebar fit />
        </aside>
      </div>

      <footer className="shrink-0 border-t border-[var(--line)]">
        <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 px-2 py-3 text-xs text-[var(--muted)] sm:px-3 lg:px-4">
          <span>© {new Date().getFullYear()} sanghak</span>
          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="underline underline-offset-4 transition-colors hover:text-[var(--ink)]"
          >
            개인정보처리방침
          </button>
        </div>
      </footer>

      {searchOpen && (
        <Suspense fallback={null}>
          <SearchDialog onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}

      {privacyOpen && (
        <Suspense fallback={null}>
          <PrivacyModal onClose={() => setPrivacyOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}
