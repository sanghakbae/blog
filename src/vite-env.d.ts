/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_ADMIN_EMAILS: string
  readonly VITE_UPLOAD_ENDPOINT: string
  /** 개발 전용: 1 이면 Firestore 대신 고정 데이터를 쓴다 */
  readonly VITE_LOCAL_DATA?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
