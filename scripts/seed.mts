/**
 * 보안 포스팅 499편을 Firestore 에 넣는다.
 *
 *   npx tsx scripts/seed.mts --dry        내용과 태그만 확인 (쓰기 없음)
 *   npx tsx scripts/seed.mts              실제 입력
 *   npx tsx scripts/seed.mts --only=new       나중에 추가한 250편만 입력
 *   npx tsx scripts/seed.mts --only=missing   Firestore 에 없는 글만 입력
 *   npx tsx scripts/seed.mts --recount        태그 집계를 실제 글 수로 다시 센다
 *   npx tsx scripts/seed.mts --refresh    이미 올라간 글의 본문·요약·태그만 갱신 (주소 유지)
 *   npx tsx scripts/seed.mts --purge      시드로 넣은 글만 삭제
 *
 * 쓰기에는 서비스 계정 키가 필요하다.
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { renderDiagram } from './diagram.mjs'
import { analyzeContent } from '../src/lib/localTagger.js'
import { auditPost } from '../src/lib/seo.js'
import type { SeedPost } from './content/types.js'
import { posts1 } from './content/posts-1.js'
import { posts2 } from './content/posts-2.js'
import { posts3 } from './content/posts-3.js'
import { posts4 } from './content/posts-4.js'
import { posts5 } from './content/posts-5.js'
import { posts6 } from './content/posts-6.js'
import { posts7 } from './content/posts-7.js'
import { posts8 } from './content/posts-8.js'
import { posts9 } from './content/posts-9.js'
import { posts10 } from './content/posts-10.js'
import { posts11 } from './content/posts-11.js'
import { posts12 } from './content/posts-12.js'
import { posts13 } from './content/posts-13.js'
import { posts14 } from './content/posts-14.js'
import { posts15 } from './content/posts-15.js'
import { posts16 } from './content/posts-16.js'
import { posts17 } from './content/posts-17.js'
import { posts18 } from './content/posts-18.js'
import { posts19 } from './content/posts-19.js'
import { posts20 } from './content/posts-20.js'
import { posts21 } from './content/posts-21.js'
import { posts22 } from './content/posts-22.js'
import { posts23 } from './content/posts-23.js'
import { posts24 } from './content/posts-24.js'
import { posts25 } from './content/posts-25.js'
import { posts26 } from './content/posts-26.js'
import { posts27 } from './content/posts-27.js'
import { posts28 } from './content/posts-28.js'
import { posts29 } from './content/posts-29.js'
import { posts30 } from './content/posts-30.js'
import { posts31 } from './content/posts-31.js'
import { posts32 } from './content/posts-32.js'
import { posts33 } from './content/posts-33.js'
import { posts34 } from './content/posts-34.js'
import { posts35 } from './content/posts-35.js'
import { posts36 } from './content/posts-36.js'
import { posts37 } from './content/posts-37.js'
import { posts38 } from './content/posts-38.js'
import { posts39 } from './content/posts-39.js'
import { posts40 } from './content/posts-40.js'
import { posts41 } from './content/posts-41.js'
import { posts42 } from './content/posts-42.js'
import { posts43 } from './content/posts-43.js'
import { posts44 } from './content/posts-44.js'
import { posts45 } from './content/posts-45.js'
import { posts46 } from './content/posts-46.js'
import { posts47 } from './content/posts-47.js'
import { posts48 } from './content/posts-48.js'
import { posts49 } from './content/posts-49.js'
import { posts50 } from './content/posts-50.js'

/** 처음 올린 100편. */
const LEGACY: SeedPost[] = [
  ...posts1, ...posts2, ...posts3, ...posts4, ...posts5,
  ...posts6, ...posts7, ...posts8, ...posts9, ...posts10,
]

/** 나중에 추가한 250편. --only=new 로 이것만 넣을 수 있다. */
const ADDED: SeedPost[] = [
  ...posts11, ...posts12, ...posts13, ...posts14, ...posts15,
  ...posts16, ...posts17, ...posts18, ...posts19, ...posts20,
  ...posts21, ...posts22, ...posts23, ...posts24, ...posts25,
  ...posts26, ...posts27, ...posts28, ...posts29, ...posts30,
  ...posts31, ...posts32, ...posts33, ...posts34, ...posts35,
  ...posts36, ...posts37, ...posts38, ...posts39, ...posts40,
  ...posts41, ...posts42, ...posts43, ...posts44, ...posts45,
  ...posts46, ...posts47, ...posts48, ...posts49, ...posts50,
]

const ALL: SeedPost[] = [...LEGACY, ...ADDED]
const isAdded = (p: SeedPost) => ADDED.includes(p)

const AUTHOR = 'totoriverce@gmail.com'
const MAX_TAGS = 3
const IMG_DIR = 'public/img/posts'
const dry = process.argv.includes('--dry')
const onlyNew = process.argv.includes('--only=new')
const onlyMissing = process.argv.includes('--only=missing')
const recount = process.argv.includes('--recount')
const refresh = process.argv.includes('--refresh')
const purge = process.argv.includes('--purge')
const local = process.argv.includes('--local')

// ── 검증 ────────────────────────────────────────────────────────────────────

function validate() {
  const problems: string[] = []
  const slugs = new Set<string>()
  for (const p of ALL) {
    if (slugs.has(p.slug)) problems.push(`중복 slug: ${p.slug}`)
    slugs.add(p.slug)
    if (!p.body.includes(`/img/posts/${p.slug}.svg`))
      problems.push(`${p.slug}: 본문에 도식 이미지 참조 없음`)
    if (p.diagram2 && !p.body.includes(`/img/posts/${p.slug}-2.svg`))
      problems.push(`${p.slug}: 두 번째 도식을 만들었는데 본문에서 참조하지 않음`)
    if (!p.body.includes('| --- |')) problems.push(`${p.slug}: 표 없음`)
    if (p.body.length < 600) problems.push(`${p.slug}: 본문이 너무 짧음 (${p.body.length}자)`)
  }
  return problems
}

/**
 * 저장될 모습(요약문·태그·주소) 그대로 SEO / GEO 점검을 돌린다.
 * 관리 콘솔의 SEO 탭과 같은 함수를 쓰므로 화면에 뜨는 점수와 일치한다.
 * 100점이 아닌 글이 하나라도 있으면 시드를 중단한다.
 */
function auditScores(scored: { post: SeedPost; tags: string[] }[]) {
  const problems: string[] = []
  const scores: number[] = []

  for (const { post, tags } of scored) {
    const audit = auditPost({
      id: post.slug,
      title: post.title,
      body: post.body,
      excerpt: excerpt(post.body),
      tags,
    })
    scores.push(audit.score)
    if (audit.score < 100)
      problems.push(
        `${post.slug}: SEO/GEO ${audit.score}점 — ` +
          audit.issues.map((i) => `${i.field}(${i.message})`).join(', '),
      )
  }
  return { problems, scores }
}

// ── 도식 생성 ───────────────────────────────────────────────────────────────

function writeDiagrams() {
  mkdirSync(IMG_DIR, { recursive: true })
  let n = 0
  for (const p of ALL) {
    writeFileSync(`${IMG_DIR}/${p.slug}.svg`, renderDiagram(p.diagram))
    n++
    if (p.diagram2) {
      writeFileSync(`${IMG_DIR}/${p.slug}-2.svg`, renderDiagram(p.diagram2))
      n++
    }
  }
  return n
}

// ── 태그 산출 ───────────────────────────────────────────────────────────────

/**
 * 실제 서비스와 같은 방식으로 태그를 뽑는다.
 * 앞선 글들이 코퍼스가 되므로 뒤로 갈수록 흔한 용어의 점수가 떨어진다.
 */
function computeTags() {
  const corpus: { title: string; body: string }[] = []
  const tagCount = new Map<string, number>()
  const result: { post: SeedPost; tags: string[] }[] = []

  for (const post of ALL) {
    const tags = analyzeContent({
      title: post.title,
      body: post.body,
      corpus,
      existingTags: [...tagCount.keys()],
      max: MAX_TAGS,
    }).map((t) => t.tag)

    tags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1))
    corpus.push({ title: post.title, body: post.body })
    result.push({ post, tags })
  }
  return { result, tagCount }
}

// ── 본문 요약 ───────────────────────────────────────────────────────────────

function excerpt(body: string, len = 110): string {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\|[^\n]*\|/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[#>*\-\s]+/gm, ' ')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > len ? text.slice(0, len).trimEnd() + '…' : text
}

// ── 실행 ────────────────────────────────────────────────────────────────────

const problems = validate()
if (problems.length) {
  console.error('내용 검증 실패:')
  problems.forEach((p) => console.error('  - ' + p))
  process.exit(1)
}

const { result, tagCount } = computeTags()

const audit = auditScores(result)
if (audit.problems.length) {
  console.error('SEO / GEO 점검 실패:')
  audit.problems.forEach((p) => console.error('  - ' + p))
  process.exit(1)
}

console.log(`글 ${ALL.length}편 · 검증 통과`)
console.log(`SEO/GEO ${Math.min(...audit.scores)}~${Math.max(...audit.scores)}점 (${audit.scores.length}편)`)
console.log(`도식 ${writeDiagrams()}개 생성 → ${IMG_DIR}/`)

// 개발용 로컬 데이터 — Firebase 없이 개발환경을 돌리기 위한 고정 데이터
if (local) {
  const start = new Date()
  start.setDate(start.getDate() - ALL.length)

  const posts = result.map(({ post, tags }, i) => {
    const at = new Date(start)
    at.setDate(at.getDate() + i)
    return {
      id: post.slug,
      title: post.title,
      body: post.body,
      excerpt: excerpt(post.body),
      tags,
      published: true,
      author: AUTHOR,
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
    }
  })

  const tags = [...tagCount.entries()]
    .map(([id, count]) => ({ id, name: id, count }))
    .sort((a, b) => b.count - a.count)

  mkdirSync('src/dev', { recursive: true })
  writeFileSync('src/dev/seed-data.json', JSON.stringify({ posts, tags }, null, 0))
  console.log(`\n로컬 데이터 생성 → src/dev/seed-data.json (글 ${posts.length}편, 태그 ${tags.length}종)`)
  console.log('.env.local 에 VITE_LOCAL_DATA=1 을 넣고 개발 서버를 다시 시작하세요.')
  process.exit(0)
}

if (dry) {
  console.log('\n제목과 태그\n')
  result.forEach(({ post, tags }, i) =>
    console.log(`${String(i + 1).padStart(3)}. ${post.title}\n     ${tags.map((t) => '#' + t).join(' ')}`),
  )
  const sorted = [...tagCount.entries()].sort((a, b) => b[1] - a[1])
  console.log(`\n태그 ${sorted.length}종. 상위 20개:`)
  console.log(sorted.slice(0, 20).map(([t, n]) => `#${t}(${n})`).join(' '))
  console.log('\n--dry 모드이므로 Firestore 에 쓰지 않았습니다.')
  process.exit(0)
}

// 여기부터는 실제 쓰기 — 서비스 계정 자격 증명이 필요하다
const { initializeApp, applicationDefault } = await import('firebase-admin/app')
const { getFirestore, FieldValue, Timestamp } = await import('firebase-admin/firestore')

initializeApp({ credential: applicationDefault(), projectId: 'tag-blog-8408e' })
const db = getFirestore()

/**
 * 태그 집계를 실제 발행 글 수로 다시 센다.
 *
 * 예전에는 시드가 넣은 만큼 increment 로 더했다. 그러면 시드를 다시 돌리거나
 * --refresh 로 태그가 바뀔 때 집계가 실제와 벌어진다 — 48종이 어긋난 채로
 * 사이드바 순서와 상위 5개 색이 정해지고 있었다. 더하는 대신 셀 때마다
 * 절대값으로 맞춘다. 쓰지 않는 태그 문서는 지운다.
 */
async function recountTags(): Promise<{ tags: number; fixed: number; removed: number }> {
  const posts = await db.collection('posts').where('published', '==', true).select('tags').get()
  const actual = new Map<string, number>()
  for (const d of posts.docs)
    for (const t of (d.data().tags ?? []) as string[]) actual.set(t, (actual.get(t) ?? 0) + 1)

  const stored = await db.collection('tags').get()
  const storedCount = new Map(stored.docs.map((d) => [d.id, (d.data().count ?? 0) as number]))

  let fixed = 0
  let removed = 0
  const batch = db.batch()
  for (const [tag, count] of actual) {
    if (storedCount.get(tag) !== count) fixed++
    batch.set(db.collection('tags').doc(tag), { name: tag, count }, { merge: true })
  }
  for (const d of stored.docs)
    if (!actual.has(d.id)) { batch.delete(d.ref); removed++ }
  await batch.commit()
  return { tags: actual.size, fixed, removed }
}

if (recount) {
  const r = await recountTags()
  console.log(`태그 ${r.tags}종 · 집계 수정 ${r.fixed}종 · 미사용 삭제 ${r.removed}종`)
  process.exit(0)
}

if (purge) {
  const snap = await db.collection('posts').where('seed', '==', true).get()
  console.log(`시드 글 ${snap.size}편 삭제`)
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch()
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  const tags = await db.collection('tags').get()
  const tb = db.batch()
  tags.docs.forEach((d) => tb.delete(d.ref))
  await tb.commit()
  console.log('태그 집계도 초기화했습니다.')
  process.exit(0)
}

/**
 * 이미 올라간 글의 제목·본문·요약·태그만 갱신한다.
 *
 * 문서 ID 가 slug 이므로 그것으로 대조한다. createdAt 과 문서 ID 를 건드리지 않으므로
 * 검색엔진이 알고 있는 주소와 목록 순서가 그대로 유지된다.
 */
if (refresh) {
  const existing = new Set((await db.collection('posts').select().get()).docs.map((d) => d.id))

  let updated = 0
  const missing: string[] = []

  for (let i = 0; i < result.length; i += 200) {
    const batch = db.batch()
    let queued = 0

    for (const { post, tags } of result.slice(i, i + 200)) {
      if (!existing.has(post.slug)) { missing.push(post.slug); continue }
      batch.update(db.collection('posts').doc(post.slug), {
        title: post.title,
        body: post.body,
        excerpt: excerpt(post.body),
        tags,
        updatedAt: Timestamp.fromDate(new Date()),
      })
      queued++
      updated++
    }

    if (queued) await batch.commit()
  }

  const r = await recountTags()
  console.log(`\n갱신 ${updated}편 · 태그 집계 수정 ${r.fixed}종`)
  if (missing.length)
    console.log(`Firestore 에 없는 글 ${missing.length}편 — --only=new 또는 전체 시드로 넣어야 합니다:\n  ` + missing.join('\n  '))
  process.exit(0)
}

/**
 * Firestore 에 아직 없는 글만 넣는다.
 *
 * 전체 시드는 createdAt 을 "오늘 − 전체 글 수" 부터 다시 흩뿌린다. 글이 늘어나면
 * 이미 올라간 글의 작성일까지 과거로 밀리고, 검색엔진이 알고 있는 날짜와 목록
 * 순서가 함께 바뀐다. 새 글을 덧붙일 때는 기존 글을 건드리지 않고, 지금 가장
 * 최근인 글 뒤에 하루 간격으로 이어 붙인다.
 */
if (onlyMissing) {
  const snap = await db.collection('posts').select().get()
  const existing = new Set(snap.docs.map((d) => d.id))

  const targets = result.filter(({ post }) => !existing.has(post.slug))
  if (!targets.length) {
    console.log('\nFirestore 에 없는 글이 없습니다. 넣을 것이 없습니다.')
    process.exit(0)
  }

  // 작성일은 지금을 마지막으로 두고 한 시간 간격으로 거꾸로 매긴다.
  //
  // 기존 글 뒤에 하루 간격으로 이어 붙이면 글이 100편일 때 마지막 글이 석 달 뒤가
  // 된다. 미래 날짜는 목록에서 이상하게 보이고 사이트맵에도 그대로 나간다.
  const STEP_MS = 60 * 60 * 1000
  const end = Date.now()

  console.log(`\n기존 ${existing.size}편 유지 · 새로 넣을 글 ${targets.length}편`)
  console.log(
    `작성일 ${new Date(end - (targets.length - 1) * STEP_MS).toISOString().slice(0, 16)}` +
      ` ~ ${new Date(end).toISOString().slice(0, 16)} (한 시간 간격)`,
  )

  const addedTags = new Map<string, number>()
  let inserted = 0

  for (let i = 0; i < targets.length; i += 100) {
    const batch = db.batch()
    targets.slice(i, i + 100).forEach(({ post, tags }, j) => {
      const at = new Date(end - (targets.length - 1 - (i + j)) * STEP_MS)
      tags.forEach((t) => addedTags.set(t, (addedTags.get(t) ?? 0) + 1))
      batch.set(db.collection('posts').doc(post.slug), {
        title: post.title,
        body: post.body,
        excerpt: excerpt(post.body),
        tags,
        published: true,
        author: AUTHOR,
        seed: true,
        createdAt: Timestamp.fromDate(at),
        updatedAt: Timestamp.now(),
      })
      inserted++
    })
    await batch.commit()
    console.log(`  ${inserted}/${targets.length} 저장`)
  }

  const r = await recountTags()
  await db.collection('audit').doc().set({
    at: FieldValue.serverTimestamp(),
    action: 'post.create',
    actorEmail: AUTHOR,
    actorUid: 'seed-script',
    target: 'posts',
    detail: `보안 포스팅 ${inserted}편 추가 등록 · 태그 ${addedTags.size}종`,
    userAgent: 'seed-script',
  })

  console.log(`\n완료. 새 글 ${inserted}편 · 태그 ${r.tags}종으로 다시 셈 (수정 ${r.fixed}종).`)
  process.exit(0)
}

// 오래된 글이 먼저 오도록 과거 날짜를 하루 간격으로 부여한다
const start = new Date()
start.setDate(start.getDate() - ALL.length)

let written = 0
for (let i = 0; i < result.length; i += 100) {
  const batch = db.batch()
  const chunk = result.slice(i, i + 100)
  let queued = 0

  chunk.forEach(({ post, tags }, j) => {
    if (onlyNew && !isAdded(post)) return
    const at = new Date(start)
    at.setDate(at.getDate() + i + j)
    // 문서 ID 는 slug 다. 검색에 유리하고, 재실행이 새 문서 생성이 아니라 덮어쓰기가 된다.
    queued++
    batch.set(db.collection('posts').doc(post.slug), {
      title: post.title,
      body: post.body,
      excerpt: excerpt(post.body),
      tags,
      published: true,
      author: AUTHOR,
      seed: true,
      // createdAt 은 목록 순서를 위해 과거로 흩뿌리지만, updatedAt 은 실제로 쓴 시각이다.
      // 둘 다 과거로 두면 사이트맵의 lastmod 가 몇 달 전이 되어, 방금 추가한 글이
      // IndexNow 의 최근 변경분 필터에서 빠진다.
      createdAt: Timestamp.fromDate(at),
      updatedAt: Timestamp.now(),
    })
    written++
  })

  if (!queued) continue
  await batch.commit()
  console.log(`  ${written}/${onlyNew ? ADDED.length : ALL.length} 저장`)
}

const r = await recountTags()
await db.collection('audit').doc().set({
  at: FieldValue.serverTimestamp(),
  action: 'post.create',
  actorEmail: AUTHOR,
  actorUid: 'seed-script',
  target: 'posts',
  detail: `보안 포스팅 ${written}편 일괄 등록 · 태그 ${r.tags}종`,
  userAgent: 'seed-script',
})

console.log(`\n완료. 글 ${written}편 · 태그 ${r.tags}종으로 다시 셈 (수정 ${r.fixed}종).`)
process.exit(0)
