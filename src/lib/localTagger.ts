/**
 * 본문 분석 태거 — 외부 API 없이 브라우저에서 동작한다.
 *
 * 본문에서 단어를 뽑는 방식은 '실수', '전체', '공개' 같은 말이 태그가 된다.
 * 기술 블로그의 태그는 분류 체계여야 하므로, 용어집(vocabulary.ts)에 정의된
 * 기술 용어만 태그가 된다. 본문에 실제로 등장하는지, 어디에 등장하는지로
 * 점수를 매겨 상위 몇 개를 고른다.
 */
import { VOCABULARY, type VocabEntry } from './vocabulary'

export type TagCandidate = {
  tag: string
  score: number
  /** 왜 이 태그가 뽑혔는지 — 에디터에서 그대로 보여준다 */
  reason: string
}

export type CorpusDoc = { title: string; body: string }
export type CorpusIndex = { df: Map<string, number>; size: number }

/** 글쓴이가 힘을 준 위치일수록 가중치가 높다 */
type Zone = { text: string; weight: number; where: string }

function zones(title: string, body: string): Zone[] {
  const clean = body
    .replace(/```[\s\S]*?```/g, ' ') // 코드블록은 명령어라 태그 근거로 쓰지 않는다
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')

  const out: Zone[] = [{ text: title, weight: 6, where: '제목' }]
  for (const m of clean.matchAll(/^#{2,4}\s+(.+)$/gm))
    out.push({ text: m[1], weight: 3, where: '소제목' })
  for (const m of clean.matchAll(/\*\*([^*\n]+)\*\*/g))
    out.push({ text: m[1], weight: 2, where: '강조' })

  const paragraphs = clean.replace(/^#{2,4}\s+.+$/gm, ' ').split(/\n{2,}/).filter((p) => p.trim())
  paragraphs.forEach((p, i) =>
    out.push({ text: p, weight: i === 0 ? 1.8 : 1, where: i === 0 ? '도입부' : '본문' }),
  )
  return out
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  let at = haystack.indexOf(needle)
  while (at !== -1) {
    n++
    at = haystack.indexOf(needle, at + needle.length)
  }
  return n
}

/** 코퍼스에서 각 용어가 몇 편에 등장하는지 — 모든 글에 흔한 용어의 점수를 낮춘다 */
export function buildCorpusIndex(corpus: CorpusDoc[]): CorpusIndex {
  const df = new Map<string, number>()
  for (const doc of corpus) {
    const text = `${doc.title}\n${doc.body}`.toLowerCase()
    for (const entry of VOCABULARY) {
      if (entry.match.some((m) => text.includes(m))) df.set(entry.tag, (df.get(entry.tag) ?? 0) + 1)
    }
  }
  return { df, size: corpus.length }
}

function scoreEntry(entry: VocabEntry, zs: Zone[]) {
  let weighted = 0
  let raw = 0
  const places = new Map<string, number>()

  for (const zone of zs) {
    const text = zone.text.toLowerCase()
    let hits = 0
    for (const alias of entry.match) hits += countOccurrences(text, alias)
    if (!hits) continue
    weighted += hits * zone.weight
    raw += hits
    places.set(zone.where, (places.get(zone.where) ?? 0) + hits)
  }
  return { weighted, raw, places }
}

/**
 * 본문을 분석해 태그 후보를 점수순으로 돌려준다.
 * corpus 또는 index 는 이 블로그의 다른 글들 — 흔한 용어를 걸러내는 기준이 된다.
 * existingTags 는 이미 쓰고 있는 태그 — 같은 주제면 재사용하도록 밀어준다.
 */
export function analyzeContent(input: {
  title: string
  body: string
  corpus?: CorpusDoc[]
  index?: CorpusIndex
  existingTags?: string[]
  max?: number
}): TagCandidate[] {
  const { title, body, corpus = [], existingTags = [], max = 8 } = input
  if (body.trim().length < 20) return []

  const index = input.index ?? buildCorpusIndex(corpus)
  const N = Math.max(index.size, 1)
  const existing = new Set(existingTags)
  const zs = zones(title, body)

  const scored: TagCandidate[] = []
  for (const entry of VOCABULARY) {
    const { weighted, raw, places } = scoreEntry(entry, zs)
    if (!raw) continue
    // 스쳐 지나간 한 번은 이 글의 주제가 아니다. 제목에 있으면 예외로 둔다.
    if (raw < 2 && !places.has('제목') && !places.has('소제목')) continue

    // 모든 글에 나오는 용어는 분류에 도움이 되지 않는다
    const idf = index.size ? Math.sqrt(Math.log(1 + N / (1 + (index.df.get(entry.tag) ?? 0)))) : 1
    const reuse = existing.has(entry.tag) ? 1.4 : 1
    const score = Math.sqrt(weighted) * idf * reuse

    const reason = [...places.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([where, n]) => (where === '제목' ? '제목' : `${where} ${n}회`))
      .join(' · ')

    scored.push({ tag: entry.tag, score, reason })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, max)
}
