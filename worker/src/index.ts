import { requireAdmin } from './auth'

export type Env = {
  BUCKET: R2Bucket
  FIREBASE_PROJECT_ID: string
  ADMIN_EMAILS: string
  ALLOWED_ORIGIN: string
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}
const ALLOWED_TYPES = Object.keys(EXT_BY_TYPE)

/** 개발용 로컬 출처 — 포트만 다른 것을 허용하고, 호스트는 정확히 일치해야 한다 */
const isLocalhost = (origin: string) => {
  try {
    const { protocol, hostname } = new URL(origin)
    return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')
  } catch {
    return false
  }
}

function cors(env: Env, origin: string | null): Record<string, string> {
  const allowed = env.ALLOWED_ORIGIN.split(',').map((s) => s.trim())
  // startsWith 로 비교하면 http://localhost.evil.example 이 통과한다. 파싱해서 호스트를 본다.
  const ok = origin && (allowed.includes(origin) || isLocalhost(origin))
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

    try {
      // 토큰 검증도 이 안에서 한다. 바깥에 두면 서명 키 조회 실패가
      // CORS 헤더 없는 500 으로 나가 브라우저에서 원인이 보이지 않는다.
      const admin = await requireAdmin(req, env)
      if (!admin) return json({ error: '관리자만 업로드할 수 있습니다' }, 401, headers)

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

  // 확장자는 검증한 Content-Type 에서 정한다. 파일명에서 가져오면 image/png 로 검사를
  // 통과한 요청이 .html 같은 키로 저장된다.
  const ext = EXT_BY_TYPE[type]
  const now = new Date()
  const key = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`

  await env.BUCKET.put(key, body, {
    httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
  })

  return json({ url: `${origin}/${key}` }, 200, headers)
}
