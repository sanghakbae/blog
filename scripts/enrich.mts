/**
 * 이미 올라간 글에 새 절을 끼워 넣는다.
 *
 * 글을 통째로 다시 쓰면 이미 검색엔진이 아는 문장까지 바뀌고, 잘 쓰인 부분도
 * 함께 사라진다. 기존 본문은 그대로 두고 '## 참고' 앞에 절을 추가하는 방식이
 * 안전하다. 슬러그로 대조하므로 순서가 바뀌어도 상관없다.
 *
 *   npx tsx scripts/enrich.mts <보강파일.mjs>
 *
 * 보강 파일은 { slug: '추가할 마크다운' } 을 default 로 내보낸다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'

const spec = process.argv[2]
if (!spec) { console.error('보강 파일 경로가 필요합니다.'); process.exit(1) }

const additions = (await import(spec.startsWith('/') ? spec : `${process.cwd()}/${spec}`))
  .default as Record<string, string>

const files = readdirSync('scripts/content').filter((f) => /^posts-\d+\.ts$/.test(f))
const done = new Set<string>()
let touched = 0

for (const f of files) {
  const path = `scripts/content/${f}`
  let src = readFileSync(path, 'utf8')
  let changed = false

  for (const [slug, extra] of Object.entries(additions)) {
    if (done.has(slug)) continue
    // 이 파일에 그 글이 있는지 — 슬러그 줄부터 body 의 '## 참고' 까지
    const at = src.indexOf(`slug: '${slug}',`)
    if (at < 0) continue

    const refAt = src.indexOf('\n\n## 참고\n', at)
    if (refAt < 0) { console.warn(`  ${slug}: '## 참고' 절을 찾지 못해 건너뜁니다`); continue }
    // 다음 글로 넘어가지 않았는지 확인
    const nextSlug = src.indexOf("slug: '", at + 10)
    if (nextSlug > 0 && refAt > nextSlug) { console.warn(`  ${slug}: 구조가 예상과 달라 건너뜁니다`); continue }

    const body = extra.trim()
    src = src.slice(0, refAt) + '\n\n' + body + src.slice(refAt)
    done.add(slug)
    changed = true
    touched++
  }

  if (changed) writeFileSync(path, src)
}

const missed = Object.keys(additions).filter((s) => !done.has(s))
console.log(`보강 ${touched}편`)
if (missed.length) console.log(`찾지 못한 슬러그 ${missed.length}개: ${missed.join(', ')}`)
process.exit(missed.length ? 1 : 0)
