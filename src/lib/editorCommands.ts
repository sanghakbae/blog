/** 텍스트영역에서 마크다운 서식을 넣고 빼는 조작들 */

export type Selection = { value: string; start: number; end: number }

/** 선택 영역을 기호로 감싼다. 이미 감싸져 있으면 벗긴다. */
export function surround(sel: Selection, mark: string, placeholder = ''): Selection {
  const { value, start, end } = sel
  const picked = value.slice(start, end) || placeholder
  const before = value.slice(0, start)
  const after = value.slice(end)

  if (before.endsWith(mark) && after.startsWith(mark)) {
    return {
      value: before.slice(0, -mark.length) + picked + after.slice(mark.length),
      start: start - mark.length,
      end: start - mark.length + picked.length,
    }
  }
  return {
    value: `${before}${mark}${picked}${mark}${after}`,
    start: start + mark.length,
    end: start + mark.length + picked.length,
  }
}

/** 선택된 줄들의 앞에 기호를 붙인다. 이미 붙어 있으면 뗀다. */
export function prefixLines(sel: Selection, prefix: string | ((i: number) => string)): Selection {
  const { value, start, end } = sel
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const lineEndRaw = value.indexOf('\n', end)
  const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw

  const lines = value.slice(lineStart, lineEnd).split('\n')
  const at = (i: number) => (typeof prefix === 'string' ? prefix : prefix(i))
  const allPrefixed = lines.every((l, i) => l.startsWith(at(i)))

  const next = lines
    .map((l, i) => (allPrefixed ? l.slice(at(i).length) : at(i) + l))
    .join('\n')

  return {
    value: value.slice(0, lineStart) + next + value.slice(lineEnd),
    start: lineStart,
    end: lineStart + next.length,
  }
}

/** 커서 자리에 블록을 끼워 넣는다 (앞뒤로 빈 줄을 보장한다). */
export function insertBlock(sel: Selection, block: string): Selection {
  const { value, start, end } = sel
  const before = value.slice(0, start)
  const after = value.slice(end)
  const lead = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
  const tail = after.startsWith('\n') ? '' : '\n'
  const inserted = `${lead}${block}${tail}`
  return {
    value: before + inserted + after,
    start: start + inserted.length,
    end: start + inserted.length,
  }
}

/** 링크 삽입 — 선택한 글자가 있으면 그것을 링크 텍스트로 쓴다. */
export function insertLink(sel: Selection, url: string): Selection {
  const text = sel.value.slice(sel.start, sel.end) || '링크'
  const md = `[${text}](${url})`
  return {
    value: sel.value.slice(0, sel.start) + md + sel.value.slice(sel.end),
    start: sel.start + 1,
    end: sel.start + 1 + text.length,
  }
}

/** 글자 수와 예상 읽는 시간 */
export function readingStats(body: string): { chars: number; words: number; minutes: number } {
  const text = body.replace(/```[\s\S]*?```/g, ' ').trim()
  const chars = text.replace(/\s/g, '').length
  const words = text ? text.split(/\s+/).length : 0
  // 한국어는 분당 500자 정도로 잡는다
  return { chars, words, minutes: Math.max(1, Math.round(chars / 500)) }
}
