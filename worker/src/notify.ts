/**
 * 새 댓글을 운영자에게 메일로 알린다.
 *
 * 브라우저가 "댓글 달았어요" 라고 말하는 것을 그대로 믿지 않는다. 토큰으로 요청자를
 * 확인하고, Firestore 에서 그 댓글 문서를 읽어 요청자가 쓴 것인지, 방금 쓴 것인지
 * 대조한다. 그래서 알림을 위조하려면 실제로 댓글을 남겨야 하고, 그 댓글은 화면에
 * 보이고 지울 수 있다. 같은 댓글로 두 번 보내지 않도록 R2 에 표식을 남긴다.
 */
import type { Claims } from './auth'

type FsValue = { stringValue?: string; timestampValue?: string }
type FsDoc = { fields?: Record<string, FsValue> }

const ID = /^[A-Za-z0-9_-]{1,80}$/
/** 이 시간이 지난 댓글은 알림 대상이 아니다 — 옛 댓글을 재사용한 반복 요청을 막는다 */
const FRESH_MS = 15 * 60 * 1000

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

async function readDoc(env: Env, path: string, mask?: string[]): Promise<FsDoc | null> {
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,
  )
  url.searchParams.set('key', env.FIREBASE_WEB_API_KEY)
  mask?.forEach((f) => url.searchParams.append('mask.fieldPaths', f))
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Firestore 읽기 실패 ${res.status}`)
  return (await res.json()) as FsDoc
}

export async function notifyComment(
  req: Request,
  env: Env,
  user: Claims,
): Promise<{ status: number; body: Record<string, unknown> }> {
  let input: { postId?: unknown; commentId?: unknown }
  try {
    input = (await req.json()) as typeof input
  } catch {
    return { status: 400, body: { error: '본문이 JSON 이 아닙니다' } }
  }
  const { postId, commentId } = input
  if (typeof postId !== 'string' || !ID.test(postId) || typeof commentId !== 'string' || !ID.test(commentId))
    return { status: 400, body: { error: 'postId, commentId 가 필요합니다' } }

  // 댓글이 실제로 있고, 요청자가 쓴 것이고, 방금 쓴 것인지
  const comment = await readDoc(env, `posts/${postId}/comments/${commentId}`)
  const f = comment?.fields
  if (!f) return { status: 404, body: { error: '댓글이 없습니다' } }
  if (f.authorUid?.stringValue !== user.sub)
    return { status: 403, body: { error: '본인이 쓴 댓글만 알릴 수 있습니다' } }
  const createdAt = Date.parse(f.createdAt?.timestampValue ?? '')
  if (Number.isNaN(createdAt) || Date.now() - createdAt > FRESH_MS)
    return { status: 409, body: { error: '오래된 댓글입니다' } }

  // 같은 댓글로 두 번 보내지 않는다
  const marker = `notify/${postId}/${commentId}`
  if (await env.BUCKET.head(marker)) return { status: 200, body: { ok: true, duplicate: true } }

  const post = await readDoc(env, `posts/${postId}`, ['title'])
  const title = post?.fields?.title?.stringValue ?? postId
  const author = (f.authorName?.stringValue ?? '익명').slice(0, 60)
  const text = (f.body?.stringValue ?? '').slice(0, 1000)
  const link = `${env.SITE_URL}/posts/${postId}/`
  const to = env.NOTIFY_TO.split(',').map((s) => s.trim()).filter(Boolean)

  const result = await env.EMAIL.send({
    to,
    from: { email: env.NOTIFY_FROM, name: '보안 실무 블로그' },
    subject: `[댓글] ${title}`,
    text: `${author} 님이 댓글을 남겼습니다.\n\n${text}\n\n글: ${link}`,
    html:
      `<p><strong>${escapeHtml(author)}</strong> 님이 댓글을 남겼습니다.</p>` +
      `<blockquote style="border-left:3px solid #ccc;margin:12px 0;padding:8px 12px;white-space:pre-wrap">${escapeHtml(text)}</blockquote>` +
      `<p><a href="${link}">${escapeHtml(title)}</a></p>`,
  })

  await env.BUCKET.put(marker, result.messageId ?? '1', {
    httpMetadata: { contentType: 'text/plain' },
  })
  return { status: 200, body: { ok: true, messageId: result.messageId } }
}
