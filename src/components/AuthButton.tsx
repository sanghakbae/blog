import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { signIn, signOut, subscribeViewer, type Viewer } from '../lib/authState'

/** 헤더 우측 상단의 구글 로그인 버튼 */
export default function AuthButton() {
  const [viewer, setViewer] = useState<Viewer>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribeViewer(setViewer), [])

  async function handleSignIn() {
    setBusy(true)
    try {
      await signIn()
    } catch {
      // 사용자가 팝업을 닫은 경우 — 조용히 되돌린다
    } finally {
      setBusy(false)
    }
  }

  if (viewer) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        {viewer.isAdmin && (
          <>
            <Link
              to="/admin/new"
              className="rounded-md bg-[var(--accent)] px-2 py-1 text-[11px] font-medium whitespace-nowrap text-[var(--accent-ink)]"
            >
              글쓰기
            </Link>
            <Link
              to="/admin"
              className="hidden rounded-md px-1.5 py-1 text-[11px] font-medium whitespace-nowrap text-[var(--muted)] transition-colors hover:text-[var(--ink)] sm:block"
            >
              관리
            </Link>
          </>
        )}
        <button
          type="button"
          onClick={() => signOut()}
          title={`${viewer.email} — 눌러서 로그아웃`}
          className="grid size-6 place-items-center overflow-hidden rounded-full border border-[var(--line)] text-[10px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)]"
        >
          {viewer.photo ? (
            <img
              src={viewer.photo}
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            viewer.email.slice(0, 1).toUpperCase()
          )}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      disabled={busy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--line)] py-1 pl-1.5 pr-2 text-[11px] font-medium whitespace-nowrap text-[var(--muted)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:opacity-50 sm:pr-3"
    >
      <svg viewBox="0 0 18 18" className="size-3.5" aria-hidden>
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
      </svg>
      {busy ? '여는 중…' : '로그인'}
    </button>
  )
}
