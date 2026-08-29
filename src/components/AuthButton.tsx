import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * 헤더 우측 상단의 구글 로그인 버튼.
 *
 * firebase/auth 는 무겁다. 글만 읽는 방문자에게까지 내려보내지 않으려고
 * 로그인한 적 있는 브라우저(SEEN 표시가 남은 경우)와 실제로 버튼을 누른
 * 순간에만 동적으로 불러온다.
 */
const SEEN = 'auth:seen'

type State =
  | { status: 'anon' }
  | { status: 'busy' }
  | { status: 'user'; email: string; photo: string | null; isAdmin: boolean }

export default function AuthButton() {
  const [state, setState] = useState<State>({ status: 'anon' })

  useEffect(() => {
    if (!localStorage.getItem(SEEN)) return
    let unsubscribe: (() => void) | undefined
    let alive = true

    ;(async () => {
      const [{ auth, ADMIN_EMAILS }, { onAuthStateChanged }] = await Promise.all([
        import('../lib/authClient'),
        import('firebase/auth'),
      ])
      if (!alive) return
      unsubscribe = onAuthStateChanged(auth, (u) => {
        if (!u) return setState({ status: 'anon' })
        setState({
          status: 'user',
          email: u.email ?? '',
          photo: u.photoURL,
          isAdmin: ADMIN_EMAILS.includes((u.email ?? '').toLowerCase()),
        })
      })
    })()

    return () => { alive = false; unsubscribe?.() }
  }, [])

  async function signIn() {
    setState({ status: 'busy' })
    try {
      const [{ auth, googleProvider, ADMIN_EMAILS }, { signInWithPopup }, { logAudit }] =
        await Promise.all([
          import('../lib/authClient'),
          import('firebase/auth'),
          import('../lib/audit'),
        ])
      const { user } = await signInWithPopup(auth, googleProvider)
      localStorage.setItem(SEEN, '1')
      setState({
        status: 'user',
        email: user.email ?? '',
        photo: user.photoURL,
        isAdmin: ADMIN_EMAILS.includes((user.email ?? '').toLowerCase()),
      })
      logAudit('auth.signin', user.uid, user.email ?? '')
    } catch {
      setState({ status: 'anon' })
    }
  }

  async function signOutNow() {
    const [{ auth }, { signOut }, { logAudit }] = await Promise.all([
      import('../lib/authClient'),
      import('firebase/auth'),
      import('../lib/audit'),
    ])
    await logAudit('auth.signout', auth.currentUser?.uid ?? '', auth.currentUser?.email ?? '')
    await signOut(auth)
    localStorage.removeItem(SEEN)
    setState({ status: 'anon' })
  }

  if (state.status === 'user') {
    return (
      <div className="flex items-center gap-1.5">
        {state.isAdmin && (
          <Link
            to="/admin"
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          >
            관리
          </Link>
        )}
        <button
          type="button"
          onClick={signOutNow}
          title={`${state.email} — 눌러서 로그아웃`}
          className="grid size-7 place-items-center overflow-hidden rounded-full border border-[var(--line)] text-[10px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)]"
        >
          {state.photo ? (
            <img src={state.photo} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            state.email.slice(0, 1).toUpperCase()
          )}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={state.status === 'busy'}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] py-1.5 pl-2 pr-3 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:opacity-50"
    >
      <svg viewBox="0 0 18 18" className="size-3.5" aria-hidden>
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
      </svg>
      {state.status === 'busy' ? '여는 중…' : '로그인'}
    </button>
  )
}
