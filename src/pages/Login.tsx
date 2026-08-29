import { useAuth } from '../lib/useAuth'

export default function Login() {
  const { user, isAdmin, signIn, signOut, loading } = useAuth()
  if (loading) return <p className="text-sm text-[var(--muted)]">확인 중…</p>

  return (
    <div className="py-16 text-center">
      {!user ? (
        <button
          type="button"
          onClick={() => signIn()}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Google 로 로그인
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            {user.email} {isAdmin ? '' : '— 관리자 권한이 없습니다.'}
          </p>
          <button type="button" onClick={() => signOut()} className="text-sm underline">
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}
