/**
 * 글 안에 들어갈 도식을 SVG 로 그린다.
 * 라이트/다크 어디에 놓여도 읽히도록 흰 카드 위에 그리고, 강조색 하나만 쓴다.
 */

const INK = '#18181b'
const MUTED = '#71717a'
const LINE = '#e4e4e7'
const ACCENT = '#4f46e5'
const ACCENT_BG = '#eef2ff'
const FONT =
  "-apple-system,BlinkMacSystemFont,'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif"

export type Diagram =
  /** 단계가 이어지는 흐름 */
  | { type: 'flow'; caption: string; steps: { label: string; note?: string; danger?: boolean }[] }
  /** 두 축으로 나눈 사분면 */
  | { type: 'matrix'; caption: string; x: [string, string]; y: [string, string]; cells: string[] }
  /** 값 비교 막대 */
  | { type: 'bars'; caption: string; unit?: string; items: { label: string; value: number; note?: string }[] }
  /** 겹겹이 쌓인 방어 계층 */
  | { type: 'layers'; caption: string; layers: { label: string; note?: string }[] }
  /** 번호가 붙은 절차 */
  | { type: 'steps'; caption: string; steps: { label: string; note: string }[] }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function frame(w: number, h: number, caption: string, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(caption)}">
<rect width="${w}" height="${h}" rx="14" fill="#ffffff"/>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="13.5" fill="none" stroke="${LINE}"/>
<text x="24" y="34" font-family="${FONT}" font-size="13" font-weight="600" fill="${MUTED}" letter-spacing="0.04em">${esc(caption)}</text>
${inner}
</svg>`
}

/** 글자를 폭에 맞춰 줄바꿈한다 (한글은 한 글자를 대략 폭 1로 본다) */
function wrap(text: string, perLine: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > perLine && cur) { lines.push(cur); cur = w } else cur = next
  }
  if (cur) lines.push(cur)
  return lines
}

function textBlock(
  lines: string[],
  x: number,
  y: number,
  size: number,
  fill: string,
  weight = '400',
  anchor: 'start' | 'middle' = 'start',
): string {
  return lines
    .map(
      (l, i) =>
        `<text x="${x}" y="${y + i * (size + 4)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(l)}</text>`,
    )
    .join('\n')
}

function renderFlow(d: Extract<Diagram, { type: 'flow' }>): string {
  const n = d.steps.length
  const w = 880
  const pad = 24
  const gap = 18
  const boxW = (w - pad * 2 - gap * (n - 1)) / n
  const top = 58
  const boxH = 96
  const h = top + boxH + 32

  const boxes = d.steps.map((s, i) => {
    const x = pad + i * (boxW + gap)
    const stroke = s.danger ? ACCENT : LINE
    const fill = s.danger ? ACCENT_BG : '#fafafa'
    const label = wrap(s.label, Math.floor(boxW / 9))
    const note = s.note ? wrap(s.note, Math.floor(boxW / 7)) : []
    const arrow =
      i < n - 1
        ? `<path d="M${x + boxW + 4} ${top + boxH / 2} L${x + boxW + gap - 4} ${top + boxH / 2}" stroke="${MUTED}" stroke-width="1.5" marker-end="url(#a)"/>`
        : ''
    return `<rect x="${x}" y="${top}" width="${boxW}" height="${boxH}" rx="10" fill="${fill}" stroke="${stroke}"/>
${textBlock(label, x + boxW / 2, top + (note.length ? 36 : 52), 14, s.danger ? ACCENT : INK, '600', 'middle')}
${note.length ? textBlock(note, x + boxW / 2, top + 60, 11, MUTED, '400', 'middle') : ''}
${arrow}`
  })

  return frame(
    w,
    h,
    d.caption,
    `<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${MUTED}"/></marker></defs>
${boxes.join('\n')}`,
  )
}

function renderMatrix(d: Extract<Diagram, { type: 'matrix' }>): string {
  const w = 880
  const h = 420
  const left = 130
  const top = 62
  const cw = (w - left - 40) / 2
  const ch = (h - top - 58) / 2

  const cells = d.cells.slice(0, 4).map((c, i) => {
    const x = left + (i % 2) * cw
    const y = top + Math.floor(i / 2) * ch
    const hot = i === 1
    return `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="${hot ? ACCENT_BG : '#fafafa'}" stroke="${LINE}"/>
${textBlock(wrap(c, 26), x + cw / 2, y + ch / 2 - 4, 14, hot ? ACCENT : INK, hot ? '600' : '400', 'middle')}`
  })

  return frame(
    w,
    h,
    d.caption,
    `${cells.join('\n')}
<text x="${left + cw / 2}" y="${h - 24}" font-family="${FONT}" font-size="12" fill="${MUTED}" text-anchor="middle">${esc(d.x[0])}</text>
<text x="${left + cw * 1.5}" y="${h - 24}" font-family="${FONT}" font-size="12" fill="${MUTED}" text-anchor="middle">${esc(d.x[1])}</text>
<text transform="translate(${left - 16},${top + ch / 2}) rotate(-90)" font-family="${FONT}" font-size="12" fill="${MUTED}" text-anchor="middle">${esc(d.y[0])}</text>
<text transform="translate(${left - 16},${top + ch * 1.5}) rotate(-90)" font-family="${FONT}" font-size="12" fill="${MUTED}" text-anchor="middle">${esc(d.y[1])}</text>`,
  )
}

function renderBars(d: Extract<Diagram, { type: 'bars' }>): string {
  const w = 880
  const top = 64
  const rowH = 46
  const h = top + d.items.length * rowH + 24
  const labelW = 220
  const barMax = w - labelW - 130
  const max = Math.max(...d.items.map((i) => i.value))

  const rows = d.items.map((it, i) => {
    const y = top + i * rowH
    const bw = Math.max(4, (it.value / max) * barMax)
    return `<text x="24" y="${y + 20}" font-family="${FONT}" font-size="13" font-weight="500" fill="${INK}">${esc(it.label)}</text>
<rect x="${labelW}" y="${y + 6}" width="${bw}" height="20" rx="5" fill="${i === 0 ? ACCENT : '#c7d2fe'}"/>
<text x="${labelW + bw + 10}" y="${y + 21}" font-family="${FONT}" font-size="12" font-weight="600" fill="${MUTED}">${esc(String(it.value))}${esc(d.unit ?? '')}</text>
${it.note ? `<text x="24" y="${y + 36}" font-family="${FONT}" font-size="11" fill="${MUTED}">${esc(it.note)}</text>` : ''}`
  })

  return frame(w, h, d.caption, rows.join('\n'))
}

function renderLayers(d: Extract<Diagram, { type: 'layers' }>): string {
  const w = 880
  const top = 60
  const rowH = 52
  const h = top + d.layers.length * rowH + 24
  const inset = 34

  const rows = d.layers.map((l, i) => {
    const y = top + i * rowH
    const x = 24 + i * inset
    const bw = w - 48 - i * inset * 2
    return `<rect x="${x}" y="${y}" width="${bw}" height="${rowH - 10}" rx="9" fill="${i === d.layers.length - 1 ? ACCENT_BG : '#fafafa'}" stroke="${i === d.layers.length - 1 ? ACCENT : LINE}"/>
<text x="${x + 16}" y="${y + 26}" font-family="${FONT}" font-size="13" font-weight="600" fill="${i === d.layers.length - 1 ? ACCENT : INK}">${esc(l.label)}</text>
${l.note ? `<text x="${x + bw - 16}" y="${y + 26}" font-family="${FONT}" font-size="11" fill="${MUTED}" text-anchor="end">${esc(l.note)}</text>` : ''}`
  })

  return frame(w, h, d.caption, rows.join('\n'))
}

function renderSteps(d: Extract<Diagram, { type: 'steps' }>): string {
  const w = 880
  const top = 58
  const rowH = 62
  const h = top + d.steps.length * rowH + 20

  const rows = d.steps.map((s, i) => {
    const y = top + i * rowH
    const line =
      i < d.steps.length - 1
        ? `<path d="M42 ${y + 34} L42 ${y + rowH + 4}" stroke="${LINE}" stroke-width="2"/>`
        : ''
    return `${line}
<circle cx="42" cy="${y + 18}" r="15" fill="${ACCENT_BG}" stroke="${ACCENT}"/>
<text x="42" y="${y + 23}" font-family="${FONT}" font-size="13" font-weight="700" fill="${ACCENT}" text-anchor="middle">${i + 1}</text>
<text x="72" y="${y + 15}" font-family="${FONT}" font-size="14" font-weight="600" fill="${INK}">${esc(s.label)}</text>
<text x="72" y="${y + 35}" font-family="${FONT}" font-size="12" fill="${MUTED}">${esc(s.note)}</text>`
  })

  return frame(w, h, d.caption, rows.join('\n'))
}

export function renderDiagram(d: Diagram): string {
  switch (d.type) {
    case 'flow': return renderFlow(d)
    case 'matrix': return renderMatrix(d)
    case 'bars': return renderBars(d)
    case 'layers': return renderLayers(d)
    case 'steps': return renderSteps(d)
  }
}
