import { renderMarkdown } from './markdown'
import { safeName } from './pdf'

/** 문서 안에서 쓸 수 없는 문자를 막는다 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 상대 경로 이미지와 링크를 절대 주소로 바꾼다 — 파일을 어디서 열어도 보이게 */
function absolutize(html: string, origin: string): string {
  return html.replace(/(src|href)="\/(?!\/)/g, `$1="${origin}/`)
}

/**
 * 어디서 열어도 깨지지 않는 한 장짜리 문서를 만든다.
 *
 * 가로폭은 화면을 100% 채우되 본문은 읽기 좋은 폭에서 멈춘다. 표와 코드처럼
 * 줄일 수 없는 요소만 각자 가로 스크롤을 갖고, 바깥 문서는 절대 옆으로
 * 밀리지 않는다. 글꼴과 색은 전부 문서 안에 넣어 외부 요청이 없다.
 */
const STYLE = `
*,*::before,*::after{box-sizing:border-box}
:root{color-scheme:light dark;
  --bg:#ffffff;--ink:#18181b;--muted:#52525b;--line:#e4e4e7;
  --elev:#f4f4f5;--accent:#4f46e5;--accent-soft:#eef2ff}
@media (prefers-color-scheme:dark){:root{
  --bg:#18181b;--ink:#f4f4f5;--muted:#a1a1aa;--line:#3f3f46;
  --elev:#27272a;--accent:#a5b4fc;--accent-soft:#312e81}}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:"Apple SD Gothic Neo","Pretendard","Noto Sans KR",
    -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  font-size:16px;line-height:1.75;word-break:keep-all;overflow-wrap:anywhere}
.wrap{width:100%;max-width:820px;margin:0 auto;padding:32px 20px 80px}
@media (max-width:640px){.wrap{padding:24px 16px 56px}body{font-size:15px}}
header{border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:32px}
h1{font-size:1.9rem;line-height:1.35;margin:0 0 12px}
@media (max-width:640px){h1{font-size:1.5rem}}
.meta{color:var(--muted);font-size:.85rem;display:flex;flex-wrap:wrap;gap:8px 14px}
.meta a{color:var(--muted)}
.tags{margin-top:12px;display:flex;flex-wrap:wrap;gap:6px}
.tags span{border:1px solid var(--line);border-radius:999px;
  padding:2px 10px;font-size:.75rem;color:var(--muted)}
article h2{font-size:1.3rem;margin:44px 0 12px;padding-top:8px;
  border-top:1px solid var(--line)}
article h3{font-size:1.1rem;margin:28px 0 8px}
article p{margin:0 0 16px}
article a{color:var(--accent)}
article ul,article ol{padding-left:1.3em;margin:0 0 16px}
article li{margin:4px 0}
article img,article svg{display:block;max-width:100%;height:auto;margin:20px auto}
article blockquote{margin:0 0 16px;padding:8px 16px;border-left:3px solid var(--accent);
  background:var(--elev);color:var(--muted)}
article hr{border:0;border-top:1px solid var(--line);margin:32px 0}
.table-scroll{width:100%;overflow-x:auto;margin:0 0 20px;-webkit-overflow-scrolling:touch}
article table{width:auto;min-width:100%;border-collapse:collapse;font-size:.92rem}
article td{white-space:nowrap}
article th,article td{border:1px solid var(--line);padding:8px 12px;text-align:center}
article th{background:var(--elev);font-weight:600;white-space:nowrap}
article code{background:var(--elev);border:1px solid var(--line);border-radius:4px;
  padding:1px 5px;font-size:.88em;
  font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace}
article pre{background:var(--elev);border:1px solid var(--line);border-radius:8px;
  padding:14px 16px;overflow-x:auto;margin:0 0 20px;-webkit-overflow-scrolling:touch}
article pre code{background:none;border:0;padding:0;font-size:.85rem;line-height:1.6}
footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--line);
  color:var(--muted);font-size:.8rem}
footer a{color:var(--muted)}
@media print{body{background:#fff;color:#000}.wrap{max-width:none;padding:0}
  article pre,.table-scroll{overflow:visible}}
`.trim()

/** 표를 감싸서 표만 옆으로 스크롤되게 한다 — 문서 자체는 밀리지 않는다 */
function wrapTables(html: string): string {
  return html.replace(/<table[\s\S]*?<\/table>/g, (t) => `<div class="table-scroll">${t}</div>`)
}

/**
 * 변환에 필요한 최소한의 정보.
 * 저장된 글과 편집 중인 초안을 같은 함수로 다루기 위해 따로 둔다.
 */
export type HtmlSource = {
  id?: string
  title: string
  body: string
  excerpt?: string
  tags?: string[]
  createdAt?: { toDate?: () => Date }
}

/** 글 하나를 독립 실행되는 반응형 HTML 문서로 만든다 */
export function buildHtmlDocument(post: HtmlSource, origin = location.origin): string {
  const date = post.createdAt?.toDate?.().toISOString().slice(0, 10)
    ?? new Date().toISOString().slice(0, 10)
  const source = post.id ? `${origin}/posts/${post.id}` : origin
  const body = wrapTables(absolutize(renderMarkdown(post.body), origin))
  const tags = post.tags?.length
    ? `<div class="tags">${post.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>`
    : ''

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(post.title)}</title>
<meta name="description" content="${escapeHtml(post.excerpt ?? '')}">
<style>
${STYLE}
</style>
</head>
<body>
<div class="wrap">
<header>
<h1>${escapeHtml(post.title)}</h1>
<div class="meta">${date ? `<span>${date}</span>` : ''}<a href="${source}">${source}</a></div>
${tags}
</header>
<article>
${body}
</article>
<footer>이 문서는 <a href="${source}">${source}</a> 의 내용을 HTML 로 옮긴 것입니다.</footer>
</div>
</body>
</html>
`
}

/** 만든 문서를 파일로 내려받는다 */
export function downloadHtml(post: HtmlSource): void {
  const blob = new Blob([buildHtmlDocument(post)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName(post.title)}.html`
  a.click()
  URL.revokeObjectURL(url)
}
