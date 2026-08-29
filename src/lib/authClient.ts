// firebase/auth 는 무거우므로 로그인이 필요한 화면에서만 불러온다.
import { GoogleAuthProvider, getAuth } from 'firebase/auth'
import { app } from './firebase'

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

export const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean)
