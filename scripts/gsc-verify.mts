/**
 * 서비스 계정을 Search Console 속성 소유자로 등록한다.
 *
 * URL 검사 API 는 속성 소유자만 호출할 수 있다. 콘솔에서 사람이 사용자 추가를
 * 하는 대신, 사이트 확인 API 로 서비스 계정이 직접 소유권을 증명하게 한다.
 * 확인 파일을 public/ 에 두고 배포하면 되므로 사람 손이 들어가지 않는다.
 *
 *   npx tsx scripts/gsc-verify.mts token     확인 파일 생성 (배포 전)
 *   npx tsx scripts/gsc-verify.mts verify    소유권 확인 (배포 후)
 *   npx tsx scripts/gsc-verify.mts status    현재 소유 상태 조회
 *
 * 선행 조건 — GCP 콘솔에서 아래 두 API 사용 설정 (프로젝트 소유자만 가능)
 *   Google Search Console API      searchconsole.googleapis.com
 *   Site Verification API          siteverification.googleapis.com
 */
import { existsSync, writeFileSync } from 'node:fs'
import { GoogleAuth } from 'google-auth-library'

const SITE = 'https://blog.sanghak.kr/'
const PUBLIC_DIR = 'public'
const cmd = process.argv[2] ?? 'status'

const auth = new GoogleAuth({
  scopes: [
    'https://www.googleapis.com/auth/siteverification',
    'https://www.googleapis.com/auth/webmasters',
  ],
})

/** 설정이 안 끝난 상태를 스택 트레이스 대신 한 줄로 알린다 */
function explain(err: unknown): string {
  const message = (err as { message?: string }).message ?? String(err)
  if (/has not been used in project|SERVICE_DISABLED/i.test(message))
    return 'GCP 콘솔에서 Search Console API 와 Site Verification API 를 사용 설정하세요.'
  if (/permission|not authori|403/i.test(message))
    return '서비스 계정에 권한이 없습니다. 사용 설정 여부를 먼저 확인하세요.'
  return message.split('\n')[0].slice(0, 160)
}

const client = await (async () => {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (path && !existsSync(path)) {
    console.error(`서비스 계정 키를 찾을 수 없습니다: ${path}`)
    process.exit(1)
  }
  try {
    return await auth.getClient()
  } catch (err) {
    console.error('자격 증명을 읽지 못했습니다 —', explain(err))
    process.exit(1)
  }
})()

async function getToken(): Promise<string> {
  const res = await client.request<{ token?: string }>({
    url: 'https://www.googleapis.com/siteVerification/v1/token',
    method: 'POST',
    data: {
      site: { type: 'SITE', identifier: SITE },
      verificationMethod: 'FILE',
    },
  })
  const token = res.data.token
  if (!token) throw new Error('확인 토큰을 받지 못했습니다')
  return token
}

if (cmd === 'token') {
  try {
    const token = await getToken()
    const path = `${PUBLIC_DIR}/${token}`
    writeFileSync(path, `google-site-verification: ${token}\n`)
    console.log(`확인 파일 생성 → ${path}`)
    console.log(`배포 후 확인 주소 → ${SITE}${token}`)
    console.log('\n다음 순서로 진행하세요.')
    console.log('  1. 이 파일을 커밋·푸시하고 배포가 끝날 때까지 기다린다')
    console.log('  2. npx tsx scripts/gsc-verify.mts verify')
  } catch (err) {
    console.error('토큰 발급 실패 —', explain(err))
    process.exit(1)
  }
  process.exit(0)
}

if (cmd === 'verify') {
  try {
    // 확인 파일이 실제로 서빙되는지 먼저 본다. 배포 전이면 여기서 걸린다.
    const token = await getToken()
    const probe = await fetch(`${SITE}${token}`)
    if (!probe.ok) {
      console.error(`확인 파일이 아직 서빙되지 않습니다 (${probe.status}) — ${SITE}${token}`)
      console.error('  → 커밋·푸시 후 배포가 끝나면 다시 실행하세요.')
      process.exit(1)
    }

    const res = await client.request<{ id?: string; owners?: string[] }>({
      url: 'https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=FILE',
      method: 'POST',
      data: { site: { type: 'SITE', identifier: SITE } },
    })
    console.log('소유권 확인 완료')
    console.log('  소유자:', (res.data.owners ?? []).join(', '))
    console.log('\n이제 색인 상태 갱신이 동작합니다.')
    console.log('  npx tsx scripts/index-status.mts --dry')
  } catch (err) {
    console.error('소유권 확인 실패 —', explain(err))
    process.exit(1)
  }
  process.exit(0)
}

// status
try {
  const res = await client.request<{ items?: { site: { identifier: string }; owners?: string[] }[] }>({
    url: 'https://www.googleapis.com/siteVerification/v1/webResource',
  })
  const items = res.data.items ?? []
  if (!items.length) {
    console.log('이 서비스 계정이 소유한 속성이 없습니다.')
    console.log('  → npx tsx scripts/gsc-verify.mts token 부터 시작하세요.')
  } else {
    for (const it of items) console.log(it.site.identifier, '·', (it.owners ?? []).join(', '))
  }
} catch (err) {
  console.error('조회 실패 —', explain(err))
  process.exit(1)
}
process.exit(0)
