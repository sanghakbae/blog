/**
 * IndexNow 로 새 글 주소를 검색 포털에 알린다.
 *
 * 한 번 제출하면 참여 포털이 함께 받는다 — Bing, Naver, Yandex, Seznam.
 * 구글은 IndexNow 에 참여하지 않으므로 Search Console 의 sitemap 으로 처리한다.
 *
 *   npx tsx scripts/indexnow.mts
 */
import { readdirSync, readFileSync } from 'node:fs'

const SITE = 'https://blog.sanghak.kr'
const HOST = 'blog.sanghak.kr'

const keyFile = readdirSync('public').find((f) => /^[a-f0-9]{32}\.txt$/.test(f))
if (!keyFile) {
  console.error('public/ 에 IndexNow 키 파일이 없습니다.')
  process.exit(1)
}
const key = keyFile.replace('.txt', '')

// 빌드 결과의 sitemap 에서 주소를 읽는다
const sitemap = readFileSync('dist/sitemap.xml', 'utf8')
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

if (urlList.length === 0) {
  console.error('sitemap 에서 주소를 찾지 못했습니다. 먼저 빌드하세요.')
  process.exit(1)
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
