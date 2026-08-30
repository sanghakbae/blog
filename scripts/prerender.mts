/**
 * 빌드 후 글마다 정적 HTML 을 만든다.
 *
 * 이 사이트는 SPA 라 GitHub Pages 가 /posts/xxx 같은 경로에 404 를 돌려준다.
 * 화면은 404.html 폴백으로 뜨지만 상태 코드가 404 라 검색엔진이 색인하지 않고,
 * 카톡·트위터 공유 카드는 자바스크립트를 실행하지 않아 글별 정보를 읽지 못한다.
 *
 * 그래서 빌드 시점에 Firestore 에서 발행글을 읽어
 *  - /posts/<id>/index.html, /tags/<tag>/index.html 을 실제 파일로 만들고
 *  - 글별 title·description·OG·JSON-LD 를 채우고
 *  - 본문 HTML 을 #root 안에 미리 넣는다 (React 가 뜨면 교체된다)
 *  - sitemap.xml, robots.txt, llms.txt 를 생성한다
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { marked } from 'marked'
import { preserveLayout } from '../src/lib/markdown.js'

const PROJECT = process.env.VITE_FIREBASE_PROJECT_ID ?? 'tag-blog-8408e'
const KEY = process.env.VITE_FIREBASE_API_KEY ?? ''
const SITE = 'https://blog.sanghak.kr'
const DIST = 'dist'

type Post = {
  id: string
  title: string
  body: string
  excerpt: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

const val = (f: any): any =>
  f?.stringValue ??
  f?.timestampValue ??
  f?.booleanValue ??
  (f?.arrayValue ? (f.arrayValue.values ?? []).map(val) : undefined)

async function fetchPosts(): Promise<Post[]> {
  if (!KEY) {
    console.warn('VITE_FIREBASE_API_KEY 가 없어 정적 페이지 생성을 건너뜁니다.')
    return []
  }

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery?key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'posts' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'published' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          limit: 500,
        },
      }),
    },
  )

  if (!res.ok) {
    console.warn(`Firestore 조회 실패 (${res.status}). 정적 페이지 생성을 건너뜁니다.`)
    return []
  }

  const rows = (await res.json()) as { document?: { name: string; fields: any } }[]
  return rows
    .filter((r) => r.document)
    .map((r) => {
      const f = r.document!.fields
      return {
        id: r.document!.name.split('/').pop()!,
        title: val(f.title) ?? '',
        body: val(f.body) ?? '',
        excerpt: val(f.excerpt) ?? '',
        tags: val(f.tags) ?? [],
        createdAt: val(f.createdAt) ?? '',
        updatedAt: val(f.updatedAt) ?? '',
      }
    })
}

// ── HTML 조립 ───────────────────────────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 셸의 메타를 글 정보로 바꾸고, 본문을 #root 안에 미리 넣는다 */
function buildPage(
  shell: string,
  opts: {
    title: string
    description: string
    url: string
    image?: string
    jsonLd?: object[]
    content?: string
  },
): string {
  const { title, description, url, image = '', jsonLd = [], content = '' } = opts
  let html = shell

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
  html = html.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${esc(description)}" />`,
  )
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${esc(title)}" />`,
  )
  html = html.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${esc(description)}" />`,
  )
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${esc(url)}" />`,
  )

  // 공유했을 때 뜨는 그림. 글마다 도식이 하나씩 있으니 그것을 쓴다.
  if (image) {
    html = html.replace(
      '<meta name="twitter:card" content="summary" />',
      `<meta name="twitter:card" content="summary_large_image" />\n    <meta property="og:image" content="${esc(image)}" />\n    <meta name="twitter:image" content="${esc(image)}" />`,
    )
  }

  const head = [
    `<link rel="canonical" href="${esc(url)}" />`,
    ...jsonLd.map(
      (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`,
    ),
  ].join('\n    ')
  html = html.replace('</head>', `  ${head}\n  </head>`)

  if (content) html = html.replace('<div id="root"></div>', `<div id="root">${content}</div>`)
  return html
}

/** 질문형 소제목을 FAQ 로 뽑는다 — 답변 엔진이 읽는 형식 */
function faqEntries(body: string): { q: string; a: string }[] {
  const clean = body.replace(/```[\s\S]*?```/g, '')
  const out: { q: string; a: string }[] = []
  const parts = clean.split(/^##\s+/m).slice(1)
  for (const part of parts) {
    const [head, ...rest] = part.split('\n')
    const q = head.trim()
    if (!/[?？]$|왜|어떻게|무엇|언제|어디|누가|어느|하나$/.test(q)) continue
    const a = rest
      .join(' ')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/[*_`~>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500)
    if (a) out.push({ q, a })
  }
  return out
}

// ── 실행 ────────────────────────────────────────────────────────────────────

const posts = await fetchPosts()
if (posts.length === 0) {
  console.log('생성할 글이 없습니다.')
  process.exit(0)
}

// 앱이 Firestore에 연결하지 못하거나 오프라인일 때 사용할 읽기 전용 스냅샷.
// 서비스 워커가 이 파일을 저장하므로 설치 앱에서도 마지막 배포 시점의 글을 읽는다.
writeFileSync(`${DIST}/posts.json`, JSON.stringify(posts))

const shell = readFileSync(`${DIST}/index.html`, 'utf8')
marked.setOptions({ breaks: true, gfm: true })

// 글 페이지
for (const post of posts) {
  const url = `${SITE}/posts/${post.id}/`
  const description = (post.excerpt || post.body.slice(0, 160)).replace(/\s+/g, ' ').slice(0, 160)
  const faqs = faqEntries(post.body)
  // 본문 첫 이미지를 대표 그림으로 쓴다. 경로가 상대면 절대 주소로 바꾼다.
  const firstImage = /!\[[^\]]*\]\(([^)\s]+)/.exec(post.body)?.[1] ?? ''
  const image = firstImage.startsWith('/') ? SITE + firstImage : firstImage

  const jsonLd: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description,
      datePublished: post.createdAt,
      dateModified: post.updatedAt || post.createdAt,
      author: { '@type': 'Person', name: '배상학' },
      publisher: { '@type': 'Person', name: 'sanghak' },
      mainEntityOfPage: url,
      keywords: post.tags.join(', '),
      inLanguage: 'ko',
    },
  ]
  if (faqs.length) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    })
  }

  const content = `<article><h1>${esc(post.title)}</h1>${marked.parse(preserveLayout(post.body))}</article>`
  mkdirSync(`${DIST}/posts/${post.id}`, { recursive: true })
  writeFileSync(
    `${DIST}/posts/${post.id}/index.html`,
    buildPage(shell, { title: `${post.title} · sanghak`, description, url, image, jsonLd, content }),
  )
}

// 태그 페이지
const tags = new Map<string, Post[]>()
for (const p of posts) for (const t of p.tags) tags.set(t, [...(tags.get(t) ?? []), p])

for (const [tag, list] of tags) {
  // 디렉터리는 원래 글자로 만든다. 퍼센트 인코딩한 이름으로 만들면
  // 서버가 경로를 디코딩해 찾을 때 일치하지 않아 404 가 된다.
  const url = `${SITE}/tags/${encodeURIComponent(tag)}/`
  const content = `<h1>${esc(tag)}</h1><ul>${list
    .map((p) => `<li><a href="/posts/${p.id}">${esc(p.title)}</a></li>`)
    .join('')}</ul>`
  mkdirSync(`${DIST}/tags/${tag}`, { recursive: true })
  writeFileSync(
    `${DIST}/tags/${tag}/index.html`,
    buildPage(shell, {
      title: `${tag} · sanghak`,
      description: `${tag} 태그가 붙은 글 ${list.length}편`,
      url,
      content,
    }),
  )
}

// sitemap.xml
const urls = [
  { loc: SITE + '/', lastmod: posts[0]?.updatedAt },
  ...posts.map((p) => ({ loc: `${SITE}/posts/${p.id}/`, lastmod: p.updatedAt || p.createdAt })),
  ...[...tags.keys()].map((t) => ({ loc: `${SITE}/tags/${encodeURIComponent(t)}/` })),
]
writeFileSync(
  `${DIST}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (u) =>
        `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${String(u.lastmod).slice(0, 10)}</lastmod>` : ''}</url>`,
    )
    .join('\n')}\n</urlset>\n`,
)

// robots.txt
writeFileSync(
  `${DIST}/robots.txt`,
  ['User-agent: *', 'Allow: /', 'Disallow: /admin', '', `Sitemap: ${SITE}/sitemap.xml`, ''].join('\n'),
)

// llms.txt — 답변 엔진을 위한 안내문
writeFileSync(
  `${DIST}/llms.txt`,
  [
    '# sanghak',
    '',
    '> 보안 실무 기록. 웹 취약점부터 클라우드, 컴플라이언스까지 다룹니다.',
    '> 각 글은 점검 방법(명령·설정)과 근거 표준을 함께 싣습니다.',
    '',
    '## 글 목록',
    '',
    ...posts.map((p) => `- [${p.title}](${SITE}/posts/${p.id}/): ${p.excerpt.slice(0, 120)}`),
    '',
    '## 인용 안내',
    '',
    '- 저자: 배상학 (bae@sanghak.kr)',
    `- 원문 주소를 함께 표기해 주세요: ${SITE}/posts/<id>/`,
    '- 각 글의 "참고" 절에 근거 표준 문서를 밝혀 두었습니다.',
    '',
  ].join('\n'),
)

console.log(
  `정적 페이지 생성: 글 ${posts.length}편, 태그 ${tags.size}종, sitemap·robots·llms.txt 포함`,
)
