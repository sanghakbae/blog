import { auth } from './authClient'
import { logAudit } from './audit'

const ENDPOINT = import.meta.env.VITE_UPLOAD_ENDPOINT ?? ''

/**
 * 색인 상태 갱신을 지금 한 번 돌리라고 요청한다.
 *
 * 브라우저가 직접 Search Console 을 부를 수는 없다 — 서비스 계정 키가 필요한데
 * 그 키는 GitHub Actions 시크릿에만 있다. 그래서 워커를 거쳐 배포 워크플로를
 * 깨우고, 조회와 기록은 그 안의 '색인 상태 갱신' 단계가 평소대로 한다.
 *
 * 결과가 화면에 반영되는 것은 워크플로가 끝난 뒤다(10분 안팎). 그래서 이 함수는
 * 접수됐다는 사실만 돌려주고, 버튼은 그 말을 그대로 전한다.
 */
export async function requestReindex(): Promise<void> {
  if (!ENDPOINT) throw new Error('VITE_UPLOAD_ENDPOINT 가 설정되지 않았습니다.')

  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('로그인이 필요합니다.')

  const res = await fetch(`${ENDPOINT}/reindex`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `갱신 요청이 실패했습니다 (${res.status})`)
  }

  await logAudit('index.refresh', '', '색인 상태 갱신 요청')
}
