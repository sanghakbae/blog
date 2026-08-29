/**
 * 보안 포스팅 100편을 Firestore 에 넣는다.
 *
 *   npx tsx scripts/seed.mts --dry     내용과 태그만 확인 (쓰기 없음)
 *   npx tsx scripts/seed.mts           실제 입력
 *   npx tsx scripts/seed.mts --purge   시드로 넣은 글만 삭제
 *
 * 쓰기에는 서비스 계정 키가 필요하다.
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { renderDiagram } from './diagram.mjs'
import { analyzeContent } from '../src/lib/localTagger.js'
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

const ALL: SeedPost[] = [
  ...posts1, ...posts2, ...posts3, ...posts4, ...posts5,
  ...posts6, ...posts7, ...posts8, ...posts9, ...posts10,
]

const AUTHOR = 'totoriverce@gmail.com'
const MAX_TAGS = 3
const IMG_DIR = 'public/img/posts'
const dry = process.argv.includes('--dry')
const purge = process.argv.includes('--purge')

// ── 검증 ────────────────────────────────────────────────────────────────────

function validate() {
  const problems: string[] = []
  const slugs = new Set<string>()
  for (const p of ALL) {
    if (slugs.has(p.slug)) problems.push(`중복 slug: ${p.slug}`)
    slugs.add(p.slug)
    if (!p.body.includes(`/img/posts/${p.slug}.svg`))
      problems.push(`${p.slug}: 본문에 도식 이미지 참조 없음`)
    if (!p.body.includes('| --- |')) problems.push(`${p.slug}: 표 없음`)
    if (p.body.length < 600) problems.push(`${p.slug}: 본문이 너무 짧음 (${p.body.length}자)`)
  }
  return problems
}

// ── 도식 생성 ───────────────────────────────────────────────────────────────

function writeDiagrams() {
  mkdirSync(IMG_DIR, { recursive: true })
  for (const p of ALL) writeFileSync(`${IMG_DIR}/${p.slug}.svg`, renderDiagram(p.diagram))
  return ALL.length
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

function excerpt(body: string, len = 140): string {
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

console.log(`글 ${ALL.length}편 · 검증 통과`)
console.log(`도식 ${writeDiagrams()}개 생성 → ${IMG_DIR}/`)

const { result, tagCount } = computeTags()

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

// 오래된 글이 먼저 오도록 과거 날짜를 하루 간격으로 부여한다
const start = new Date()
start.setDate(start.getDate() - ALL.length)

let written = 0
for (let i = 0; i < result.length; i += 100) {
  const batch = db.batch()
  const chunk = result.slice(i, i + 100)

  chunk.forEach(({ post, tags }, j) => {
    const at = new Date(start)
    at.setDate(at.getDate() + i + j)
    batch.set(db.collection('posts').doc(), {
      title: post.title,
      body: post.body,
      excerpt: excerpt(post.body),
      tags,
      published: true,
      author: AUTHOR,
      seed: true,
      createdAt: Timestamp.fromDate(at),
      updatedAt: Timestamp.fromDate(at),
    })
    written++
  })

  await batch.commit()
  console.log(`  ${written}/${ALL.length} 저장`)
}

const tagBatch = db.batch()
for (const [tag, count] of tagCount)
  tagBatch.set(db.collection('tags').doc(tag), { name: tag, count: FieldValue.increment(count) }, { merge: true })
tagBatch.set(db.collection('audit').doc(), {
  at: FieldValue.serverTimestamp(),
  action: 'post.create',
  actorEmail: AUTHOR,
  actorUid: 'seed-script',
  target: 'posts',
  detail: `보안 포스팅 ${ALL.length}편 일괄 등록 · 태그 ${tagCount.size}종`,
  userAgent: 'seed-script',
})
await tagBatch.commit()

console.log(`\n완료. 글 ${written}편, 태그 ${tagCount.size}종.`)
process.exit(0)
