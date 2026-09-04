/**
 * 글마다 구글 색인 여부를 확인해 Firestore 에 기록한다.
 *
 * 색인 여부를 알아내는 방법은 하나뿐이다. 검색 결과를 긁는 것은 약관 위반이고
 * 브라우저에서는 막히므로, 구글이 공식으로 제공하는 Search Console
 * URL Inspection API 를 쓴다. 이 API 는 속성 소유자만 호출할 수 있다.
 *
 *   npx tsx scripts/index-status.mts --dry    조회만 하고 쓰지 않는다
 *   npx tsx scripts/index-status.mts          Firestore 의 indexStatus 갱신
 *
 * 준비 (한 번만)
 *   1. GCP 콘솔에서 "Google Search Console API" 사용 설정
 *   2. Search Console → 설정 → 사용자 및 권한 →
 *      서비스 계정 이메일을 **소유자** 로 추가 (URL 검사 API 는 소유자만 됨)
 *   3. GOOGLE_APPLICATION_CREDENTIALS 에 서비스 계정 키 경로
 *
 * 할당량은 하루 2,000건, 분당 600건이다. 글 151편을 하루 두 번 확인해도
 * 302건이라 여유가 있다.
 */
import { GoogleAuth } from 'google-auth-library'

const SITE = 'https://blog.sanghak.kr'
/** Search Console 에 등록된 속성. 도메인 속성이면 sc-domain:blog.sanghak.kr */
const PROPERTY = process.env.GSC_PROPERTY ?? `${SITE}/`
const PROJECT = process.env.VITE_FIREBASE_PROJECT_ID ?? 'tag-blog-8408e'
const CONCURRENCY = 4

const dry = process.argv.includes('--dry')

type Verdict = 'PASS' | 'PARTIAL' | 'FAIL' | 'NEUTRAL' | 'VERDICT_UNSPECIFIED'
type Inspection = {
  inspectionResult?: {
    indexStatusResult?: {
      verdict?: Verdict
      coverageState?: string
      lastCrawlTime?: string
      googleCanonical?: string
    }
  }
}

// ── 인증 ────────────────────────────────────────────────────────────────────

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
})
const client = await auth.getClient()

async function inspect(url: string): Promise<Inspection['inspectionResult']> {
  const res = await client.request<Inspection>({
    url: 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
    method: 'POST',
    data: { inspectionUrl: url, siteUrl: PROPERTY, languageCode: 'ko' },
  })
  return res.data.inspectionResult
}

/**
 * 색인된 것으로 볼지 판정한다.
 *
 * verdict 만 보면 안 된다. 색인은 됐지만 개선 사항이 있어 PARTIAL 로 오는 경우가
 * 있어서, 실제 상태를 담은 coverageState 를 함께 본다.
 */
function isIndexed(r: Inspection['inspectionResult']): boolean {
  const s = r?.indexStatusResult
  if (!s) return false
  if (s.verdict === 'PASS') return true
  const state = (s.coverageState ?? '').toLowerCase()
  return state.includes('indexed') && !state.includes('not indexed')
}

// ── 대상 글 ─────────────────────────────────────────────────────────────────

const { initializeApp, applicationDefault } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')

initializeApp({ credential: applicationDefault(), projectId: PROJECT })
const db = getFirestore()

const snap = await db.collection('posts').where('published', '==', true).get()
const posts = snap.docs.map((d) => ({
  id: d.id,
  title: (d.data().title ?? '') as string,
  status: (d.data().indexStatus ?? {}) as Record<string, string>,
}))

console.log(`발행글 ${posts.length}편 · 속성 ${PROPERTY}`)

// ── 조회 ────────────────────────────────────────────────────────────────────

type Row = { id: string; title: string; indexed: boolean; state: string; had: boolean }
const rows: Row[] = []
let failed = 0
/** 설정이 안 끝난 상태에서 151번 같은 오류를 찍지 않도록 한 번에 멈춘다 */
let fatal = ''

/** 글마다 다시 시도해도 소용없는, 설정을 고쳐야 하는 오류인가 */
function setupError(message: string): string {
  if (/has not been used in project|SERVICE_DISABLED/i.test(message))
    return 'GCP 콘솔에서 "Google Search Console API" 를 사용 설정하세요.'
  if (/permission|not authori|403/i.test(message))
    return 'Search Console → 설정 → 사용자 및 권한에서 서비스 계정을 소유자로 추가하세요.'
  if (/invalid_grant|unauthorized_client|401/i.test(message))
    return '서비스 계정 자격 증명을 확인하세요.'
  return ''
}

async function worker(queue: typeof posts) {
  for (;;) {
    if (fatal) return
    const post = queue.pop()
    if (!post) return
    const url = `${SITE}/posts/${post.id}/`
    try {
      const result = await inspect(url)
      rows.push({
        id: post.id,
        title: post.title,
        indexed: isIndexed(result),
        state: result?.indexStatusResult?.coverageState ?? '알 수 없음',
        had: !!post.status.google,
      })
    } catch (err) {
      const message = (err as { message?: string }).message ?? String(err)
      const remedy = setupError(message)
      if (remedy) {
        fatal = `${message.split('\n')[0].slice(0, 160)}\n  → ${remedy}`
        return
      }
      failed++
      console.warn(`  조회 실패 ${post.id} — ${message.slice(0, 120)}`)
    }
  }
}

const queue = [...posts]
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)))

if (fatal) {
  console.error(`\n색인 조회를 시작하지 못했습니다.\n  ${fatal}`)
  process.exit(1)
}

const indexed = rows.filter((r) => r.indexed)
console.log(`\n색인됨 ${indexed.length} / 조회 성공 ${rows.length}${failed ? ` · 실패 ${failed}` : ''}`)

const byState = new Map<string, number>()
rows.forEach((r) => byState.set(r.state, (byState.get(r.state) ?? 0) + 1))
;[...byState.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([state, n]) => console.log(`  ${String(n).padStart(4)}  ${state}`))

// ── 기록 ────────────────────────────────────────────────────────────────────

const changed = rows.filter((r) => r.indexed !== r.had)
if (changed.length) {
  console.log(`\n상태가 바뀐 글 ${changed.length}편`)
  changed.slice(0, 20).forEach((r) =>
    console.log(`  ${r.indexed ? '색인됨  ' : '해제    '} ${r.title.slice(0, 40)}`),
  )
}

if (dry) {
  console.log('\n--dry 모드이므로 Firestore 에 쓰지 않았습니다.')
  process.exit(0)
}

if (!changed.length) {
  console.log('\n바뀐 것이 없어 쓰지 않았습니다.')
  process.exit(0)
}

const now = new Date().toISOString()
for (let i = 0; i < changed.length; i += 400) {
  const batch = db.batch()
  for (const row of changed.slice(i, i + 400)) {
    // 구글 항목만 건드린다. 네이버·빙은 확인 API 가 없어 사람이 남긴 기록을 그대로 둔다.
    batch.set(
      db.collection('posts').doc(row.id),
      { indexStatus: { google: row.indexed ? now : FieldValue.delete() } },
      { merge: true },
    )
  }
  await batch.commit()
}

console.log(`\n갱신 ${changed.length}편`)
process.exit(0)
