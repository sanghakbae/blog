/** Firebase ID 토큰(RS256) 검증 — 관리자만 업로드/태그분석을 쓸 수 있게 한다. */

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

type Jwk = JsonWebKey & { kid: string }
let jwkCache: { keys: Jwk[]; expiresAt: number } | null = null

async function getKey(kid: string): Promise<CryptoKey | null> {
  if (!jwkCache || jwkCache.expiresAt < Date.now()) {
    const res = await fetch(JWKS_URL)
    const maxAge = Number(
      /max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600,
    )
    jwkCache = {
      keys: ((await res.json()) as { keys: Jwk[] }).keys,
      expiresAt: Date.now() + maxAge * 1000,
    }
  }
  const jwk = jwkCache.keys.find((k) => k.kid === kid)
  if (!jwk) return null
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export type Claims = { sub: string; email?: string; email_verified?: boolean }

/** 검증에 성공하면 claims 를, 실패하면 null 을 돌려준다. */
export async function verifyIdToken(token: string, projectId: string): Promise<Claims | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])))
  if (header.alg !== 'RS256' || !header.kid) return null

  const key = await getKey(header.kid)
  if (!key) return null

  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  )
  if (!ok) return null

  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])))
  const now = Math.floor(Date.now() / 1000)
  if (payload.aud !== projectId) return null
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null
  if (typeof payload.exp !== 'number' || payload.exp <= now) return null
  if (typeof payload.iat !== 'number' || payload.iat > now + 60) return null
  if (!payload.sub) return null

  return payload as Claims
}

/** Authorization 헤더에서 토큰을 꺼내 관리자 여부까지 확인한다. */
export async function requireAdmin(
  req: Request,
  env: { FIREBASE_PROJECT_ID: string; ADMIN_EMAILS: string },
): Promise<Claims | null> {
  const token = /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '')?.[1]
  if (!token) return null

  const claims = await verifyIdToken(token, env.FIREBASE_PROJECT_ID)
  if (!claims?.email) return null

  const admins = env.ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  return admins.includes(claims.email.toLowerCase()) ? claims : null
}
