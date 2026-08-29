/**
 * IndexNow 로 새 글·수정된 글 주소를 검색 포털에 알린다.
 *
 * 한 번 제출하면 참여 포털이 함께 받는다 — Bing, Naver, Yandex, Seznam.
 * 구글은 IndexNow 에 참여하지 않으므로 Search Console 의 sitemap 으로 처리한다.
 *
 *   npx tsx scripts/indexnow.mts            # 사이트맵의 모든 주소
 *   npx tsx scripts/indexnow.mts --days=2   # 최근 2일 안에 바뀐 주소만
 *
 * 매일 도는 빌드에서 전체를 매번 제출하면 같은 내용을 반복해 보내는 셈이고,
 * 포털이 과다 제출로 취급할 수 있다. 자동 실행에는 --days 를 쓴다.
 */
import { readdirSync, readFileSync } from 'node:fs'

const SITE = 'https://blog.sanghak.kr'
const HOST = 'blog.sanghak.kr'

const daysArg = process.argv.find((a) => a.startsWith('--days='))
const days = daysArg ? Number(daysArg.slice(7)) : null

const keyFile = readdirSync('public').find((f) => /^[a-f0-9]{32}\.txt$/.test(f))
if (!keyFile) {
  console.error('public/ 에 IndexNow 키 파일이 없습니다.')
  process.exit(1)
}
const key = keyFile.replace('.txt', '')

// 빌드 결과의 sitemap 에서 주소와 수정일을 읽는다
const sitemap = readFileSync('dist/sitemap.xml', 'utf8')
const entries = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)].map(
  (m) => ({ loc: m[1], lastmod: m[2] ?? '' }),
)

if (entries.length === 0) {
  console.error('sitemap 에서 주소를 찾지 못했습니다. 먼저 빌드하세요.')
  process.exit(1)
}

let urlList = entries.map((e) => e.loc)

if (days !== null) {
  if (!Number.isFinite(days) || days < 0) {
    console.error(`--days 값이 올바르지 않습니다: ${daysArg}`)
    process.exit(1)
  }
  // lastmod 는 YYYY-MM-DD 라 문자열 비교로 충분하다
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  urlList = entries.filter((e) => e.lastmod && e.lastmod >= cutoff).map((e) => e.loc)
  console.log(`${cutoff} 이후 수정된 주소 ${urlList.length}개 (전체 ${entries.length}개)`)
}

if (urlList.length === 0) {
  console.log('제출할 주소가 없습니다.')
  process.exit(0)
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key,
    keyLocation: `${SITE}/${keyFile}`,
    urlList,
  }),
})

// 200·202 는 접수, 그 외는 이유를 그대로 보여준다
console.log(`IndexNow 제출: ${urlList.length}개 주소 → HTTP ${res.status}`)
if (!res.ok) console.log(await res.text())
