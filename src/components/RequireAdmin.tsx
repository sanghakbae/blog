import type { ReactNode } from 'react'
import { useAuth } from '../lib/useAuth'
import Login from '../pages/Login'

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useAuth()
  if (loading) return <p className="text-sm text-[var(--muted)]">확인 중…</p>
  return isAdmin ? <>{children}</> : <Login />
}
