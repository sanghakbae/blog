import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * 빌드에 설정값이 들어가지 않으면 초기화가 예외를 던지고, 그 예외가 최상위에서
 * 터지면서 화면이 통째로 비어 버린다. 실제로 배포에서 발생했던 문제다.
 *
 * 값이 없을 때는 형식만 맞는 자리값으로 초기화해 import 단계에서 터지지 않게 하고,
 * isConfigured 로 네트워크 호출을 건너뛴다. 글이 안 보일지언정 화면은 뜬다.
 */
export const isConfigured = Object.values(config).every(
  (v) => typeof v === 'string' && v.length > 0,
)

if (!isConfigured) {
  console.warn(
    'Firebase 설정값이 비어 있습니다. 데이터 기능 없이 화면만 표시합니다. ' +
      '배포 환경이라면 VITE_FIREBASE_* 값이 빌드에 주입되는지 확인하세요.',
  )
}

const placeholder = {
  apiKey: 'not-configured',
  authDomain: 'not-configured',
  projectId: 'not-configured',
  storageBucket: 'not-configured',
  messagingSenderId: '0',
  appId: 'not-configured',
}

export const app = initializeApp(isConfigured ? config : placeholder)
export const db = getFirestore(app)
