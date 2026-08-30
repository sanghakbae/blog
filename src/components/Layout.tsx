import { Suspense, lazy, useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import TagSidebar from './TagSidebar'
import AuthButton from './AuthButton'
import ThemeToggle from './ThemeToggle'
import InstallGuide from './InstallGuide'
import { subscribeViewer, type Viewer } from '../lib/authState'

/** 좁은 화면의 메뉴 패널에서만 쓰는 관리 링크 */
const ADMIN_LINKS = [
  { to: '/admin/new', label: '글쓰기', end: false },
  { to: '/admin', label: '글 목록', end: true },
  { to: '/admin/audit', label: '감사 로그', end: false },
  { to: '/admin/seo', label: 'SEO / GEO', end: false },
  { to: '/admin/security', label: '보안', end: false },
]

// 처리방침은 열어볼 때만 내려받는다
const PrivacyModal = lazy(() => import('./PrivacyModal'))
const SearchDialog = lazy(() => import('./SearchDialog'))

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [viewer, setViewer] = useState<Viewer>(null)

  useEffect(() => subscribeViewer(setViewer), [])

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
        <div className="flex w-full flex-nowrap items-center gap-1.5 px-2 py-2 sm:gap-3 sm:px-3 lg:px-4">
          <Link to="/" className="group flex items-baseline gap-2">
            <span className="display text-lg sm:text-xl">sanghak</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)] sm:text-[11px]">
              blog
            </span>
          </Link>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[var(--line)] px-1.5 py-1 text-[11px] whitespace-nowrap text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] sm:px-2"
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
            className="shrink-0 rounded-md bg-[var(--ink)] px-2 py-1 text-[11px] font-medium whitespace-nowrap text-[var(--bg)] lg:hidden"
            aria-expanded={menuOpen}
          >
            메뉴
          </button>
        </div>

        {menuOpen && (
          <div className="max-h-[70dvh] overflow-y-auto border-t border-[var(--line)] px-2 py-2 sm:px-3 lg:hidden">
            {/* 관리 메뉴는 헤더에 자리가 없어 여기에 둔다. 좁은 화면에서도 모두 닿아야 한다. */}
            {viewer?.isAdmin && (
              <div className="mb-3 flex flex-wrap gap-1.5 border-b border-[var(--line)] pb-3">
                {ADMIN_LINKS.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    end={l.end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                          : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                      }`
                    }
                  >
                    {l.label}
                  </NavLink>
                ))}
              </div>
            )}
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
        <aside className="hidden shrink-0 overflow-hidden border-l border-[var(--line)] bg-[var(--bg-elev)] p-4 lg:block lg:w-[16.8rem] xl:w-[19.2rem]">
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

      <InstallGuide />
    </div>
  )
}
