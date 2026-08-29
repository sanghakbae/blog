import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { auth } from './authClient'
import { logAudit } from './audit'

/**
 * 보안 설정. Firestore 규칙이 이 문서를 직접 읽어 쓰기를 막으므로,
 * 브라우저에서 우회할 수 없다.
 */
export type SecuritySettings = {
  /** 켜면 글 작성·수정·삭제가 전면 차단된다 (계정 탈취 의심 시 잠금) */
  postingLocked: boolean
  /** 발행/삭제 전에 재로그인을 요구하는 기준 시간(분). 0 이면 요구하지 않음 */
  reauthAfterMinutes: number
  /** 이미지 업로드 허용 */
  allowImageUpload: boolean
}

export const DEFAULT_SETTINGS: SecuritySettings = {
  postingLocked: false,
  reauthAfterMinutes: 120,
  allowImageUpload: true,
}

const ref = doc(db, 'settings', 'security')

const USE_LOCAL = import.meta.env.DEV && import.meta.env.VITE_LOCAL_DATA === '1'

export async function getSettings(): Promise<SecuritySettings> {
  if (USE_LOCAL) return (await import('./localData')).localGetSettings()
  const snap = await getDoc(ref)
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<SecuritySettings> | undefined) }
}

export function subscribeSettings(cb: (s: SecuritySettings) => void) {
  if (USE_LOCAL) {
    let stop: (() => void) | undefined
    import('./localData').then((m) => m.localSubscribeSettings(cb).then((fn) => (stop = fn)))
    return () => stop?.()
  }
  return onSnapshot(ref, (snap) =>
    cb({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<SecuritySettings> | undefined) }),
  )
}

export async function updateSettings(patch: Partial<SecuritySettings>): Promise<void> {
  if (USE_LOCAL) {
    await (await import('./localData')).localUpdateSettings(patch)
    return logAudit(
      'settings.update',
      'settings/security',
      Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(', '),
    )
  }

  await setDoc(
    ref,
    { ...patch, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email ?? '' },
    { merge: true },
  )
  await logAudit(
    'settings.update',
    'settings/security',
    Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(', '),
  )
}

/**
 * 마지막 로그인 이후 기준 시간이 지났으면 재로그인을 요구한다.
 * 오래 열어둔 탭에서 발행·삭제가 일어나는 걸 막는 용도다.
 */
export function needsReauth(settings: SecuritySettings): boolean {
  if (settings.reauthAfterMinutes <= 0) return false
  const at = auth.currentUser?.metadata.lastSignInTime
  if (!at) return true
  return Date.now() - new Date(at).getTime() > settings.reauthAfterMinutes * 60_000
}
