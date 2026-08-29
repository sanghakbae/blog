import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { ADMIN_EMAILS, auth, googleProvider } from './authClient'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false) }), [])

  const email = user?.email?.toLowerCase() ?? ''
  return {
    user,
    loading,
    isAdmin: !!user && ADMIN_EMAILS.includes(email),
    signIn: () => signInWithPopup(auth, googleProvider),
    signOut: () => signOut(auth),
  }
}
