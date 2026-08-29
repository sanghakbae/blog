/**
 * 본문 분석 태거 — 외부 API 없이 브라우저에서 동작한다.
 *
 * 단순 빈도수는 "것", "때문" 같은 말만 뽑아내므로 쓰지 않는다. 대신
 *  1) 이 블로그의 다른 글 전체를 코퍼스로 삼아 TF-IDF 를 계산하고 (모든 글에 흔한 말은 탈락)
 *  2) 제목·소제목·강조 등 글쓴이가 힘을 준 위치에 가중치를 주고
 *  3) 한국어 조사/어미를 벗겨 "블로그를"·"블로그는"을 같은 말로 묶고
 *  4) 붙어 나오는 말은 복합어(2~3어절)로 합쳐 더 구체적인 태그를 만든다.
 */

export type TagCandidate = {
  tag: string
  score: number
  /** 왜 이 태그가 뽑혔는지 — 에디터에서 그대로 보여준다 */
  reason: string
}

export type CorpusDoc = { title: string; body: string }

// ── 사전 ────────────────────────────────────────────────────────────────────

/** 조사·어미. 긴 것부터 벗겨야 한다. */
const KO_SUFFIXES = [
  '에서부터', '으로부터', '에게서', '이라고', '라고는', '까지도', '에서는', '으로는', '에서도',
  '이라는', '라는', '으로써', '으로서', '이라도', '한테서', '에게는', '이나마',
  '에서', '에게', '한테', '으로', '까지', '부터', '조차', '마저', '처럼', '보다', '이라', '라도',
  '이나', '든지', '만큼', '밖에', '이며', '하고', '이랑', '으로', '에는', '에도', '와는', '과는',
  '은', '는', '이', '가', '을', '를', '에', '의', '도', '만', '과', '와', '나', '로', '야', '여',
]

/** 용언 어미 — 명사형으로 되돌리기 위해 벗긴다. */
const KO_VERB_ENDINGS = [
  '하였습니다', '했습니다', '합니다', '입니다', '했었다', '하였다', '하는', '했던', '하던',
  '해서', '하고', '하며', '하면', '한다', '했다', '하다', '되는', '됐다', '된다', '되다', '되어',
]

const KO_STOPWORDS = new Set([
  '그리고','그러나','하지만','그래서','때문','정도','경우','생각','사람','사실','문제','부분',
  '이번','다음','지금','오늘','내일','어제','정말','아주','너무','매우','조금','다시','계속',
  '이런','저런','그런','어떤','무슨','자신','우리','저는','내가','당신','여기','거기','저기',
  '하나','둘','셋','모두','전체','일단','결국','또한','물론','바로','거의','같은','같이','대해',
  '통해','위해','대한','관련','이후','이전','동안','상태','상황','방법','내용','기준','중요',
  '필요','가능','시작','마지막','처음','자체','실제','현재','최근','이제','아직','그냥','근데',
  '이유','방식','과정','결과','때문','생각','이야기','정리','참고','때는','만큼','종류','형태',
  '새로','함께','서로','따로','미리','자주','실제로','반드시','훨씬','오히려','가장','대개','아예',
  '특히','대부분','전부','절반','여럿','제대로','충분','한편','다만','이때','이제','여기','저기',
  '이라','에서','으로','것들','수도','수가','건데','한번','번째','정말로','때문에','거의다',
])

const EN_STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','than','that','this','these','those','of','in','on',
  'at','to','for','with','from','by','as','is','are','was','were','be','been','being','it','its',
  'we','you','they','he','she','i','my','our','your','their','not','no','so','do','does','did',
  'can','could','should','would','will','just','about','into','over','more','most','some','any',
  'there','here','when','what','which','who','how','why','all','also','have','has','had','one',
  'two','get','got','make','made','use','used','using','like','very','out','up','down','after',
  'before','because','while','only','other','same','new','now','then','way','well','back','even',
])

// ── 토큰화 ──────────────────────────────────────────────────────────────────

/** 조사·어미를 벗겨 표제어에 가깝게 만든다. 너무 짧아지면 원형을 유지한다. */
function stem(word: string): string {
  let w = word
  if (/[가-힣]$/.test(w)) {
    for (const e of KO_VERB_ENDINGS) {
      if (w.length > e.length + 1 && w.endsWith(e)) { w = w.slice(0, -e.length); break }
    }
    for (const s of KO_SUFFIXES) {
      if (w.length > s.length + 1 && w.endsWith(s)) { w = w.slice(0, -s.length); break }
    }
  }
  return w
}

/**
 * 용언 조각을 걸러낸다.
 *
 * 형태소 분석기가 없으므로 어미로 판단한다. 명사와 겹칠 수 있는 어미
 * (어·아·지·서·나·고 등 — "언어", "이미지", "이력서" 같은 명사가 걸린다)는
 * 일부러 제외했다. 놓치는 쪽이 멀쩡한 명사를 버리는 쪽보다 낫다.
 */
function isVerbFragment(token: string): boolean {
  if (!/[가-힣]$/.test(token)) return false
  // 과거·추측 선어말어미가 들어간 형태는 확실한 용언이다
  if (/[았었겠했]/.test(token)) return true
  // 종결형 — '다'로 끝나는 한국어 명사는 거의 없다
  if (token.length >= 2 && /다$/.test(token)) return true
  // 명사형·부사형 어미 (짧은 형태도 용언일 확률이 높다)
  if (token.length >= 2 && /(됨|함|음|임|게)$/.test(token)) return true
  // 관형사형 어미
  if (token.length >= 3 && /(는|은|한|인|된|될|할|기|며|면|고)$/.test(token)) return true
  // '~는지', '~을지' 같은 연결형
  if (/(는|은|을)지$/.test(token)) return true
  return false
}

function isNoise(token: string): boolean {
  if (token.length < 2) return true
  if (/^\d+$/.test(token)) return true
  if (KO_STOPWORDS.has(token)) return true
  if (EN_STOPWORDS.has(token)) return true
  // 한글 한 글자 + 조사 잔재처럼 의미 없는 조각
  if (/^[가-힣]$/.test(token)) return true
  if (isVerbFragment(token)) return true
  return false
}

/** 한 덩어리의 텍스트를 어절 단위로 자른다. 문장 경계는 배열로 구분한다. */
function tokenizeSentences(text: string): string[][] {
  const runs: string[][] = []

  for (const clause of text.split(/[.!?\n·:;|()[\]{}"'“”‘’,—–]+/)) {
    let run: string[] = []
    for (const raw of clause.split(/\s+/)) {
      const token = stem(raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase())
      // 걸러낸 낱말은 자리를 끊는다. 그래야 "성공 시 세션" 이
      // "성공 세션" 이라는 없던 복합어로 합쳐지지 않는다.
      if (!token || isNoise(token)) {
        if (run.length) runs.push(run)
        run = []
        continue
      }
      run.push(token)
    }
    if (run.length) runs.push(run)
  }
  return runs
}

// ── 마크다운에서 가중치별 구역 뽑기 ─────────────────────────────────────────

type Weighted = { text: string; weight: number; where: string }

function sections(title: string, body: string): Weighted[] {
  const out: Weighted[] = [{ text: title, weight: 4, where: '제목' }]

  const clean = body
    .replace(/```[\s\S]*?```/g, ' ')          // 코드블록
    .replace(/`[^`\n]+`/g, (m) => ` ${m.slice(1, -1)} `) // 인라인 코드는 살린다
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')    // 이미지
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // 링크는 글자만
    .replace(/https?:\/\/\S+/g, ' ')

  for (const m of clean.matchAll(/^#{1,4}\s+(.+)$/gm)) out.push({ text: m[1], weight: 2.5, where: '소제목' })
  for (const m of clean.matchAll(/\*\*([^*\n]+)\*\*/g)) out.push({ text: m[1], weight: 2, where: '강조' })

  const paragraphs = clean.replace(/^#{1,4}\s+.+$/gm, ' ').split(/\n{2,}/).filter((p) => p.trim())
  paragraphs.forEach((p, i) =>
    out.push({ text: p, weight: i === 0 ? 1.6 : 1, where: i === 0 ? '도입부' : '본문' }),
  )

  return out
}

// ── 코퍼스 (다른 글들) 로 문서빈도 계산 ─────────────────────────────────────

function documentFrequency(corpus: CorpusDoc[]): Map<string, number> {
  const df = new Map<string, number>()
  for (const d of corpus) {
    const seen = new Set<string>()
    for (const s of tokenizeSentences(`${d.title} ${d.body}`)) {
      for (let i = 0; i < s.length; i++) {
        seen.add(s[i])
        if (i + 1 < s.length) seen.add(`${s[i]} ${s[i + 1]}`)
      }
    }
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1)
  }
  return df
}

// ── 본체 ────────────────────────────────────────────────────────────────────

type Stat = { tf: number; raw: number; places: Map<string, number>; words: number }

/**
 * 본문을 분석해 태그 후보를 점수순으로 돌려준다.
 * corpus 는 이 블로그의 다른 글들 — 흔한 말을 걸러내는 기준이 된다.
 * existingTags 는 이미 쓰고 있는 태그 — 같은 주제면 새 이름을 만들지 않도록 밀어준다.
 */
export function analyzeContent(input: {
  title: string
  body: string
  corpus?: CorpusDoc[]
  existingTags?: string[]
  max?: number
}): TagCandidate[] {
  const { title, body, corpus = [], existingTags = [], max = 8 } = input
  if (body.trim().length < 20) return []

  const stats = new Map<string, Stat>()
  const bump = (term: string, weight: number, where: string, words: number) => {
    const s = stats.get(term) ?? { tf: 0, raw: 0, places: new Map(), words }
    s.tf += weight
    s.raw += 1
    s.places.set(where, (s.places.get(where) ?? 0) + 1)
    stats.set(term, s)
  }

  for (const sec of sections(title, body)) {
    for (const sentence of tokenizeSentences(sec.text)) {
      for (let i = 0; i < sentence.length; i++) {
        bump(sentence[i], sec.weight, sec.where, 1)
        // 붙어 나오는 말을 복합어로 — 더 구체적인 태그가 된다
        if (i + 1 < sentence.length)
          bump(`${sentence[i]} ${sentence[i + 1]}`, sec.weight * 1.1, sec.where, 2)
      }
    }
  }

  const df = documentFrequency(corpus)
  const N = Math.max(corpus.length, 1)
  const existing = new Set(existingTags.map((t) => t.toLowerCase()))

  const scored: (TagCandidate & { raw: number; words: number })[] = []
  for (const [term, s] of stats) {
    // 복합어는 실제로 되풀이되는 표현일 때만 태그가 된다.
    // 낱말은 제목·소제목에 있으면 한 번만 나와도 후보로 본다.
    if (s.words > 1 && s.raw < 2) continue
    if (s.words === 1 && s.raw < 2 && !s.places.has('제목') && !s.places.has('소제목')) continue

    // 이 글에서만 두드러지는 말일수록 높다. 다만 그대로 쓰면 딱 한 번만 등장하는
    // 말이 항상 이겨서 태그가 글 수만큼 늘어난다. 제곱근으로 눌러 여러 글에
    // 걸치는 말도 살아남게 한다.
    const idf = Math.sqrt(Math.log(1 + N / (1 + (df.get(term) ?? 0))))
    // 복합어를 조금 우대해 "태그" 보다 "태그 자동생성" 이 뽑히게 한다
    const specificity = 1 + (s.words - 1) * 0.25
    // 이미 쓰고 있는 태그면 강하게 밀어준다. 이 값이 낮으면 글마다 새 태그가
    // 생겨 사이드바가 한 번만 쓰인 태그로 가득 찬다.
    const reuse = existing.has(term) ? 3 : 1

    // 제목에 한 번 스쳤을 뿐 본문이 받쳐주지 않는 말은 끌어내린다
    const support = s.raw === 1 ? 0.6 : 1

    const score = Math.sqrt(s.tf) * (corpus.length ? idf : 1) * specificity * reuse * support
    const places = [...s.places.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([where, n]) => (where === '제목' ? '제목' : `${where} ${n}회`))
    const reason = [
      places.slice(0, 3).join(' · '),
      existing.has(term) ? '기존 태그 재사용' : '',
      corpus.length && (df.get(term) ?? 0) === 0 ? '다른 글에 없는 말' : '',
    ]
      .filter(Boolean)
      .join(' · ')

    scored.push({ tag: term.replace(/\s+/g, '-'), score, reason, raw: s.raw, words: s.words })
  }

  scored.sort((a, b) => b.score - a.score)

  // 복합어가 이미 뽑혔으면 그 안에 들어있는 낱말은 뺀다 (태그 중복 방지)
  const picked: typeof scored = []
  for (const c of scored) {
    const parts = c.tag.split('-')
    // 이미 뽑은 태그와 낱말이 겹치면 뺀다. #코드-흐름 옆에 #흐름 이 같이 붙으면
    // 태그 세 자리 중 두 자리를 같은 말이 차지하게 된다.
    const redundant = picked.some((p) => {
      const pp = p.tag.split('-')
      return parts.some((w) => pp.includes(w))
    })
    if (!redundant) picked.push(c)
    if (picked.length >= max) break
  }

  return picked.map(({ tag, score, reason }) => ({ tag, score, reason }))
}
