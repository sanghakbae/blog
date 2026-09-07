/**
 * 서비스 계정을 Search Console 속성 소유자로 등록한다.
 *
 * URL 검사 API 는 속성 소유자만 호출할 수 있다. 콘솔에서 사람이 사용자 추가를
 * 하는 대신, 사이트 확인 API 로 서비스 계정이 직접 소유권을 증명하게 한다.
 * 확인 파일을 public/ 에 두고 배포하면 되므로 사람 손이 들어가지 않는다.
 *
 *   npx tsx scripts/gsc-verify.mts token     확인 파일 생성 (배포 전)
 *   npx tsx scripts/gsc-verify.mts verify    소유권 확인 (배포 후)
 *   npx tsx scripts/gsc-verify.mts add       Search Console 속성 등록
 *   npx tsx scripts/gsc-verify.mts sitemap   사이트맵 제출·상태 조회
 *   npx tsx scripts/gsc-verify.mts status    소유 상태와 등록된 속성 조회
 *
 * 선행 조건 — GCP 콘솔에서 아래 두 API 사용 설정 (프로젝트 소유자만 가능)
 *   Google Search Console API      searchconsole.googleapis.com
 *   Site Verification API          siteverification.googleapis.com
 */
import { existsSync, writeFileSync } from 'node:fs'
import { GoogleAuth } from 'google-auth-library'

const SITE = 'https://blog.sanghak.kr/'
const SITEMAP = `${SITE}sitemap.xml`
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

if (cmd === 'add') {
  // 소유권 확인만으로는 부족하다. Search Console 에 속성으로 등록해야
  // URL 검사 API 가 그 주소를 자기 속성으로 인식한다.
  try {
    await client.request({
      url: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}`,
      method: 'PUT',
    })
    console.log('속성 등록 완료 —', SITE)
  } catch (err) {
    console.error('속성 등록 실패 —', explain(err))
    process.exit(1)
  }

  try {
    const res = await client.request<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>({
      url: 'https://www.googleapis.com/webmasters/v3/sites',
    })
    for (const s of res.data.siteEntry ?? []) console.log('  ', s.siteUrl, '·', s.permissionLevel)
  } catch {
    // 목록 조회는 부가 정보라 실패해도 넘어간다
  }
  process.exit(0)
}

if (cmd === 'sitemap') {
  // 구글이 사이트맵을 다시 읽게 만드는 유일한 자동 수단이다.
  // "색인 생성 요청" 버튼은 API 가 없다 — Indexing API 는 채용공고·방송일정
  // 두 유형만 받는다. 그래서 배포마다 이 제출을 걸어 두어야 새 글이 밀리지 않는다.
  const enc = encodeURIComponent
  try {
    await client.request({
      url: `https://www.googleapis.com/webmasters/v3/sites/${enc(SITE)}/sitemaps/${enc(SITEMAP)}`,
      method: 'PUT',
    })
    console.log('사이트맵 제출 완료 —', SITEMAP)
  } catch (err) {
    console.error('사이트맵 제출 실패 —', explain(err))
    process.exit(1)
  }

  try {
    const res = await client.request<{
      sitemap?: {
        path: string
        lastSubmitted?: string
        lastDownloaded?: string
        isPending?: boolean
        errors?: string
        warnings?: string
        contents?: { type: string; submitted?: string; indexed?: string }[]
      }[]
    }>({ url: `https://www.googleapis.com/webmasters/v3/sites/${enc(SITE)}/sitemaps` })

    for (const sm of res.data.sitemap ?? []) {
      console.log(`  ${sm.path}`)
      console.log(
        `    제출 ${sm.lastSubmitted?.slice(0, 19) ?? '-'}` +
          ` · 구글이 읽은 시각 ${sm.lastDownloaded?.slice(0, 19) ?? '아직 없음'}` +
          ` · 대기 ${sm.isPending ?? false}`,
      )
      console.log(`    오류 ${sm.errors ?? 0} · 경고 ${sm.warnings ?? 0}`)
      for (const c of sm.contents ?? [])
        console.log(`    ${c.type}: 구글이 아는 주소 ${c.submitted} · 색인 ${c.indexed ?? '미집계'}`)
    }
  } catch {
    // 상태 조회는 부가 정보라 실패해도 제출 자체는 끝났다
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
    console.log('소유권이 확인된 사이트가 없습니다.')
    console.log('  → npx tsx scripts/gsc-verify.mts token 부터 시작하세요.')
  } else {
    console.log('소유권 확인됨:')
    for (const it of items) console.log('  ', it.site.identifier, '·', (it.owners ?? []).join(', '))
  }
} catch (err) {
  console.error('소유권 조회 실패 —', explain(err))
}

try {
  const res = await client.request<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>({
    url: 'https://www.googleapis.com/webmasters/v3/sites',
  })
  const sites = res.data.siteEntry ?? []
  if (!sites.length) {
    console.log('\nSearch Console 에 등록된 속성이 없습니다.')
    console.log('  → npx tsx scripts/gsc-verify.mts add 를 실행하세요.')
  } else {
    console.log('\n등록된 속성:')
    for (const s of sites) console.log('  ', s.siteUrl, '·', s.permissionLevel)
  }
} catch (err) {
  console.error('속성 조회 실패 —', explain(err))
  process.exit(1)
}
process.exit(0)
