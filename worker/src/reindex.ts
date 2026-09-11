/**
 * 색인 상태 갱신을 사람이 눌러서 돌린다.
 *
 * 갱신 자체는 브라우저에서 할 수 없다. Search Console URL 검사 API 는 서비스
 * 계정 키로만 부를 수 있고, 그 키를 공개 저장소의 프런트 번들에 넣을 수는 없다.
 * 그래서 이미 그 키를 쥐고 있는 곳 — GitHub Actions 의 배포 워크플로 — 을
 * 대신 깨운다. 워커는 관리자 토큰을 확인한 뒤 workflow_dispatch 만 던지고,
 * 실제 조회와 Firestore 기록은 평소 정해진 시각에 도는 그 단계가 그대로 한다.
 *
 * 토큰은 fine-grained PAT 에 이 저장소의 Actions 쓰기 권한만 준 것을 쓴다.
 * 없으면 기능만 꺼지고 나머지 워커 동작에는 영향이 없다.
 */

declare global {
  interface Env {
    /**
     * GitHub fine-grained PAT — 이 저장소의 Actions 쓰기 권한만 있으면 된다.
     * wrangler.jsonc 에 두면 공개되므로 시크릿으로 넣는다:
     *   npx wrangler secret put GITHUB_DISPATCH_TOKEN
     */
    GITHUB_DISPATCH_TOKEN?: string
  }
}

const REPO = 'sanghakbae/blog'
const WORKFLOW = 'deploy.yml'

export async function dispatchReindex(env: Env): Promise<{ status: number; body: unknown }> {
  const token = env.GITHUB_DISPATCH_TOKEN
  if (!token)
    return {
      status: 503,
      body: { error: 'GITHUB_DISPATCH_TOKEN 이 설정되지 않아 갱신을 요청할 수 없습니다.' },
    }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        // GitHub 은 User-Agent 가 없으면 403 을 준다
        'User-Agent': 'blog-worker',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    },
  )

  // 성공은 204 다. 본문이 없으므로 status 로만 판단한다.
  if (res.status === 204) return { status: 200, body: { ok: true } }

  const text = await res.text()
  return {
    status: 502,
    body: { error: `GitHub 이 요청을 거절했습니다 (${res.status}) ${text.slice(0, 200)}` },
  }
}
