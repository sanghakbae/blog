/**
 * 헤더 버튼과 댓글 영역이 함께 쓰는 로그인 상태.
 *
 * 컴포넌트마다 따로 구독하면, 댓글에서 로그인해도 헤더는 그대로인 상태가 된다.
 * firebase/auth 는 무거우므로 로그인한 적 있는 브라우저이거나 실제로 로그인을
 * 누른 순간에만 불러온다.
 */
const SEEN = 'auth:seen'

export type Viewer = {
  uid: string
  email: string
  name: string
  photo: string | null
  isAdmin: boolean
} | null

let viewer: Viewer = null
let started = false
const subscribers = new Set<(v: Viewer) => void>()

const notify = () => subscribers.forEach((cb) => cb(viewer))

function toViewer(user: {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}, admins: string[]): Viewer {
  const email = user.email ?? ''
  return {
    uid: user.uid,
    email,
    name: user.displayName ?? email.split('@')[0] ?? '익명',
    photo: user.photoURL,
    isAdmin: admins.includes(email.toLowerCase()),
  }
}

/** 이 브라우저에서 로그인한 적이 있을 때만 인증 모듈을 불러와 상태를 따라간다 */
async function start() {
  if (started || !localStorage.getItem(SEEN)) return
  started = true
  const [{ auth, ADMIN_EMAILS }, { onAuthStateChanged }] = await Promise.all([
    import('./authClient'),
    import('firebase/auth'),
  ])
  onAuthStateChanged(auth, (u) => {
    viewer = u ? toViewer(u, ADMIN_EMAILS) : null
    notify()
  })
}

export function subscribeViewer(cb: (v: Viewer) => void) {
  subscribers.add(cb)
  cb(viewer)
  void start()
  return () => {
    subscribers.delete(cb)
  }
}

export async function signIn(): Promise<Viewer> {
  const [{ auth, googleProvider, ADMIN_EMAILS }, { signInWithPopup }, { logAudit }] =
    await Promise.all([
      import('./authClient'),
      import('firebase/auth'),
      import('./audit'),
    ])
  const { user } = await signInWithPopup(auth, googleProvider)
  localStorage.setItem(SEEN, '1')
  viewer = toViewer(user, ADMIN_EMAILS)
  notify()
  void start()
  logAudit('auth.signin', user.uid, user.email ?? '')
  return viewer
}

export async function signOut(): Promise<void> {
  const [{ auth }, fbAuth, { logAudit }] = await Promise.all([
    import('./authClient'),
    import('firebase/auth'),
    import('./audit'),
  ])
  await logAudit('auth.signout', auth.currentUser?.uid ?? '', auth.currentUser?.email ?? '')
  await fbAuth.signOut(auth)
  localStorage.removeItem(SEEN)
  viewer = null
  notify()
}
