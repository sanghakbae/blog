/**
 * 새로 쓴 글 파일만 골라 점검한다.
 *
 * seed.mts 는 250편 전체를 돌리므로 한 파일을 고치는 동안 쓰기에 무겁다.
 * 태그는 앞선 글이 코퍼스가 되어야 정확하므로 전체를 읽되, 결과는 지정한
 * 파일의 글만 보여준다.
 *
 *   npx tsx scripts/check-posts.mts 26 27
 */
import { analyzeContent } from '../src/lib/localTagger.js'
import { auditPost } from '../src/lib/seo.js'
import type { SeedPost } from './content/types.js'

const want = process.argv.slice(2).map(Number).filter((n) => n > 0)

const groups: { n: number; posts: SeedPost[] }[] = []
for (let n = 1; n <= 40; n++) {
  try {
    const mod = (await import(`./content/posts-${n}.js`)) as Record<string, SeedPost[]>
    const posts = mod[`posts${n}`]
    if (posts) groups.push({ n, posts })
  } catch {
    // 없는 파일은 넘어간다
  }
}

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

const corpus: { title: string; body: string }[] = []
const tagCount = new Map<string, number>()
let bad = 0
let shown = 0

for (const g of groups) {
  for (const post of g.posts) {
    const tags = analyzeContent({
      title: post.title,
      body: post.body,
      corpus,
      existingTags: [...tagCount.keys()],
      max: 3,
    }).map((t) => t.tag)
    tags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1))
    corpus.push({ title: post.title, body: post.body })

    if (want.length && !want.includes(g.n)) continue

    const audit = auditPost({
      id: post.slug,
      title: post.title,
      body: post.body,
      excerpt: excerpt(post.body),
      tags,
    })
    shown++

    const structural: string[] = []
    if (!post.body.includes(`/img/posts/${post.slug}.svg`)) structural.push('도식1 참조 없음')
    if (post.diagram2 && !post.body.includes(`/img/posts/${post.slug}-2.svg`))
      structural.push('도식2 참조 없음')
    if (!post.body.includes('| --- |')) structural.push('표 없음')
    if (post.body.length < 600) structural.push(`본문 ${post.body.length}자`)
    if (!tags.length) structural.push('태그 0개')

    const ok = audit.score === 100 && !structural.length
    if (!ok) {
      bad++
      console.log(`\n✗ ${post.slug} — ${audit.score}점  제목 ${post.title.length}자`)
      structural.forEach((s) => console.log(`    구조: ${s}`))
      audit.issues.forEach((i) => console.log(`    ${i.level} ${i.field}: ${i.message}`))
    } else {
      console.log(`✓ ${post.slug}  제목 ${String(post.title.length).padStart(2)}자 · 태그 ${tags.join(',')}`)
    }
  }
}

console.log(`\n점검 ${shown}편 · 문제 ${bad}편`)
process.exit(bad ? 1 : 0)
