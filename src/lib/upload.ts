import { auth } from './authClient'

const ENDPOINT = import.meta.env.VITE_UPLOAD_ENDPOINT ?? ''

/** Cloudflare Worker 를 거쳐 R2 에 이미지를 올리고 공개 URL 을 돌려준다. */
export async function uploadImage(file: File): Promise<string> {
  if (!ENDPOINT) throw new Error('VITE_UPLOAD_ENDPOINT 가 설정되지 않았습니다.')
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('로그인이 필요합니다.')

  const res = await fetch(`${ENDPOINT}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type || 'application/octet-stream',
      'X-Filename': encodeURIComponent(file.name),
    },
    body: file,
  })
  if (!res.ok) throw new Error(`업로드 실패 (${res.status}): ${await res.text()}`)
  return (await res.json()).url as string
}
