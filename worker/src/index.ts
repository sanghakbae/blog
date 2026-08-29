import { requireAdmin } from './auth'

export type Env = {
  BUCKET: R2Bucket
  FIREBASE_PROJECT_ID: string
  ADMIN_EMAILS: string
  ALLOWED_ORIGIN: string
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

function cors(env: Env, origin: string | null): Record<string, string> {
  const allowed = env.ALLOWED_ORIGIN.split(',').map((s) => s.trim())
  const ok = origin && (allowed.includes(origin) || origin.startsWith('http://localhost'))
  return {
    'Access-Control-Allow-Origin': ok ? origin! : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Filename',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const json = (data: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  })

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = cors(env, req.headers.get('Origin'))
    const url = new URL(req.url)

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })

    // 업로드된 이미지 서빙 — 별도 도메인이나 공개 버킷 없이 이 워커가 직접 내려준다
    if (req.method === 'GET') {
      const key = decodeURIComponent(url.pathname.slice(1))
      if (!key) return json({ error: 'Not found' }, 404, headers)

      const object = await env.BUCKET.get(key)
      if (!object) return json({ error: 'Not found' }, 404, headers)

      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
          ETag: object.httpEtag,
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)
    if (url.pathname !== '/upload') return json({ error: 'Not found' }, 404, headers)

    const admin = await requireAdmin(req, env)
    if (!admin) return json({ error: '관리자만 업로드할 수 있습니다' }, 401, headers)

    try {
      return await handleUpload(req, env, headers, url.origin)
    } catch (err) {
      console.error(err)
      return json({ error: (err as Error).message }, 500, headers)
    }
  },
} satisfies ExportedHandler<Env>

/** 이미지를 R2 에 저장하고 공개 URL 을 돌려준다 */
async function handleUpload(
  req: Request,
  env: Env,
  headers: Record<string, string>,
  origin: string,
) {
  const type = (req.headers.get('Content-Type') ?? '').split(';')[0].trim()
  if (!ALLOWED_TYPES.includes(type))
    return json({ error: `지원하지 않는 형식: ${type || '알 수 없음'}` }, 415, headers)

  const body = await req.arrayBuffer()
  if (body.byteLength === 0) return json({ error: '빈 파일' }, 400, headers)
  if (body.byteLength > MAX_IMAGE_BYTES) return json({ error: '10MB 를 넘습니다' }, 413, headers)

  const name = decodeURIComponent(req.headers.get('X-Filename') ?? 'image')
  const ext = (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] ?? type.split('/')[1]).toLowerCase()
  const now = new Date()
  const key = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`

  await env.BUCKET.put(key, body, {
    httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
  })

  return json({ url: `${origin}/${key}` }, 200, headers)
}
