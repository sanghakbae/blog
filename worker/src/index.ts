import { requireAdmin } from './auth'
import { analyzeTags } from './tagger'

export type Env = {
  BUCKET: R2Bucket
  FIREBASE_PROJECT_ID: string
  ADMIN_EMAILS: string
  PUBLIC_BASE_URL: string
  ALLOWED_ORIGIN: string
  ANTHROPIC_API_KEY: string
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

function cors(env: Env, origin: string | null): Record<string, string> {
  const allowed = env.ALLOWED_ORIGIN.split(',').map((s) => s.trim())
  const ok = origin && (allowed.includes(origin) || origin.startsWith('http://localhost'))
  return {
    'Access-Control-Allow-Origin': ok ? origin! : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { pathname } = new URL(req.url)

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)

    const admin = await requireAdmin(req, env)
    if (!admin) return json({ error: 'Unauthorized' }, 401, headers)

    try {
      if (pathname === '/upload') return await handleUpload(req, env, headers)
      if (pathname === '/tags') return await handleTags(req, env, headers)
    } catch (err) {
      console.error(err)
      return json({ error: (err as Error).message }, 500, headers)
    }
    return json({ error: 'Not found' }, 404, headers)
  },
} satisfies ExportedHandler<Env>

/** 이미지를 R2 에 저장하고 공개 URL 을 돌려준다. */
async function handleUpload(req: Request, env: Env, headers: Record<string, string>) {
  const type = req.headers.get('Content-Type') ?? ''
  if (!ALLOWED_TYPES.includes(type)) return json({ error: `지원하지 않는 형식: ${type}` }, 415, headers)

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

  return json({ url: `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}` }, 200, headers)
}

/** 본문을 분석해 태그(최대 3개)를 제안한다. */
async function handleTags(req: Request, env: Env, headers: Record<string, string>) {
  const { title = '', body = '', existingTags = [] } = (await req.json()) as {
    title?: string
    body?: string
    existingTags?: string[]
  }
  if (body.trim().length < 20) return json({ tags: [] }, 200, headers)

  const tags = await analyzeTags(env.ANTHROPIC_API_KEY, {
    title,
    body: body.slice(0, 200_000),
    existingTags: existingTags.slice(0, 200),
  })
  return json({ tags }, 200, headers)
}
