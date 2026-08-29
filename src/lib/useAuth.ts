import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { ADMIN_EMAILS, auth, googleProvider } from './authClient'
import { logAudit } from './audit'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false) }), [])

  const email = user?.email?.toLowerCase() ?? ''
  return {
    user,
    loading,
    isAdmin: !!user && ADMIN_EMAILS.includes(email),
    signIn: async () => {
      const cred = await signInWithPopup(auth, googleProvider)
      await logAudit('auth.signin', cred.user.uid, cred.user.email ?? '')
      return cred
    },
    signOut: async () => {
      await logAudit('auth.signout', user?.uid ?? '', email)
      await signOut(auth)
    },
  }
}

/** 오래된 세션으로 위험한 작업을 하지 못하도록 구글 재인증을 요구한다. */
export async function reauthenticate() {
  if (!auth.currentUser) throw new Error('로그인이 필요합니다.')
  await reauthenticateWithPopup(auth.currentUser, googleProvider)
}
