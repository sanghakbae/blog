/**
 * 빌드된 자산 이름을 서비스 워커의 사전 캐시 목록에 넣는다.
 *
 * public/sw.js 의 APP_SHELL 에는 해시가 붙은 파일 이름을 적을 수 없다. 배포마다
 * 바뀌기 때문이다. 그래서 첫 방문에서는 화면을 그리는 js·css 가 캐시에 들어가지
 * 않았고, 그 상태로 오프라인이 되면 빈 화면이 나왔다 — 서비스 워커는 붙어 있는데
 * 정작 앱을 띄울 파일이 없는 상태다.
 *
 * 빌드가 끝난 뒤 dist/sw.js 에 실제 파일 이름을 채워 그 구멍을 막는다.
 * 첫 화면에 필요한 진입 파일만 넣는다 — 관리 화면이나 PDF 같은 무거운 조각까지
 * 미리 받으면 첫 방문이 느려진다.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'

const DIST = 'dist'
const SW = `${DIST}/sw.js`

if (!existsSync(SW)) {
  console.error('dist/sw.js 가 없습니다. vite build 를 먼저 실행하세요.')
  process.exit(1)
}

// index.html 이 실제로 불러오는 것만 고른다. 여기 적힌 것이 첫 화면의 전부다.
const html = readFileSync(`${DIST}/index.html`, 'utf8')
const entries = new Set<string>()
for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g))
  entries.add(m[1])

// 진입 js 가 곧바로 import 하는 런타임 조각도 없으면 앱이 뜨지 않는다.
for (const name of readdirSync(`${DIST}/assets`))
  if (/^rolldown-runtime-.*\.js$/.test(name)) entries.add(`/assets/${name}`)

const list = [...entries].sort()
if (!list.length) {
  console.error('index.html 에서 자산을 찾지 못했습니다. 사전 캐시 목록을 바꾸지 않습니다.')
  process.exit(1)
}

const sw = readFileSync(SW, 'utf8')
const marker = '  // BUILD_ASSETS'
if (!sw.includes(marker)) {
  console.error(`sw.js 에 ${marker} 자리가 없습니다.`)
  process.exit(1)
}

writeFileSync(
  SW,
  sw.replace(marker, list.map((p) => `  '${p}',`).join('\n')),
)
console.log(`사전 캐시에 자산 ${list.length}개를 넣었습니다.`)
for (const p of list) console.log(`  ${p}`)
