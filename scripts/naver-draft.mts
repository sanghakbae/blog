/**
 * 네이버 블로그에 올릴 글감을 하루치씩 뽑아 준다.
 *
 * 자동으로 올려 주지는 않는다 — 네이버는 2020년 5월 글쓰기 API 를 없앴고,
 * 그 이유가 정확히 이 용도(자동 대량 포스팅)였다. 남은 방법은 로그인 세션을
 * 흉내 내는 것뿐인데 그건 이용약관 위반이라 여기서 하지 않는다.
 * 대신 붙여 넣기만 하면 되는 형태로 만들어 사람이 올리는 시간을 줄인다.
 *
 * 기본은 요약 + 원문 링크다. 본문을 통째로 옮기면 같은 글이 두 곳에 생기고,
 * 네이버는 자사 블로그를 먼저 보여 주는 성향이 강해서 원문이 아니라 복사본이
 * 검색 결과를 차지한다 — 원문 색인을 키우려는 목적과 정반대가 된다.
 *
 *   npx tsx scripts/naver-draft.mts              # 오늘 몫 3편
 *   npx tsx scripts/naver-draft.mts --count=5
 *   npx tsx scripts/naver-draft.mts --full       # 본문까지 (중복 문서를 감수할 때)
 *   npx tsx scripts/naver-draft.mts --dry        # 기록에 남기지 않고 보기만
 *   npx tsx scripts/naver-draft.mts --reset      # 올린 기록을 지운다
 *
 * 어디까지 올렸는지는 .naver-posted.json 에 남는다. 오래된 글부터 차례로 나간다.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const SITE = 'https://blog.sanghak.kr'
const LEDGER = '.naver-posted.json'

type Item = { id: string; title: string; excerpt: string; tags: string[]; createdAt: string }

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const has = (name: string) => process.argv.includes(`--${name}`)

const count = Number(arg('count') ?? 3)
if (!Number.isInteger(count) || count < 1) {
  console.error('--count 는 1 이상의 정수여야 합니다.')
  process.exit(1)
}

if (has('reset')) {
  writeFileSync(LEDGER, '[]\n')
  console.log(`${LEDGER} 를 비웠습니다.`)
  process.exit(0)
}

const done: string[] = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : []

const list: Item[] = await fetch(`${SITE}/posts-list.json`).then((r) => {
  if (!r.ok) throw new Error(`posts-list.json 을 받지 못했습니다 (${r.status})`)
  return r.json()
})

// 오래된 글부터 — 새 글은 어차피 IndexNow 로 바로 알려진다.
// 오래 묵은 채 색인되지 않은 글이 밖에서 들어오는 링크가 더 아쉽다.
const queue = list
  .filter((p) => !done.includes(p.id))
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  .slice(0, count)

if (queue.length === 0) {
  console.log(`${list.length}편을 모두 올렸습니다. 다시 돌리려면 --reset 을 쓰세요.`)
  process.exit(0)
}

const bodies = new Map<string, string>()
if (has('full')) {
  const all: (Item & { body: string })[] = await fetch(`${SITE}/posts.json`).then((r) => r.json())
  for (const p of all) bodies.set(p.id, p.body)
}

for (const [i, p] of queue.entries()) {
  const url = `${SITE}/posts/${p.id}/`
  console.log(`\n${'─'.repeat(72)}\n[${i + 1}/${queue.length}] ${p.id}\n${'─'.repeat(72)}`)
  console.log(`제목: ${p.title}\n`)
  console.log(has('full') ? (bodies.get(p.id) ?? p.excerpt) : p.excerpt)
  console.log(`\n전문은 여기서 볼 수 있습니다 — ${url}`)
  // 네이버 블로그는 태그를 본문과 따로 입력받는다. 그대로 옮겨 적을 수 있게 내놓는다.
  console.log(`\n태그: ${p.tags.map((t) => `#${t}`).join(' ')}`)
}

// 실수로 두 번 돌리면 올리지도 않은 글이 올린 것으로 남아 영영 건너뛴다.
// 확인만 하고 싶을 때를 위해 기록하지 않는 길을 둔다.
if (!has('dry'))
  writeFileSync(LEDGER, `${JSON.stringify([...done, ...queue.map((p) => p.id)], null, 2)}\n`)

console.log(
  `\n${'─'.repeat(72)}\n${queue.length}편 · 남은 글 ${list.length - done.length - queue.length}편` +
    (has('dry') ? ' · --dry 라 기록하지 않았습니다' : ` · 기록: ${LEDGER}`),
)
