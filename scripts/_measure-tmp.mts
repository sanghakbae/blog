import type { SeedPost } from './content/types.js'
const all: { n: number; p: SeedPost }[] = []
for (let n = 1; n <= 35; n++) {
  const m = (await import(`./content/posts-${n}.js`)) as Record<string, SeedPost[]>
  for (const p of m[`posts${n}`] ?? []) all.push({ n, p })
}
const stat = (x: number[]) => { const v = [...x].sort((a, b) => a - b); return { min: v[0], q1: v[(v.length/4)|0], med: v[(v.length/2)|0], q3: v[(3*v.length/4)|0], max: v[v.length-1] } }
const f = (p: SeedPost) => ({
  chars: p.body.length,
  code: (p.body.match(/```/g) ?? []).length / 2,
  table: (p.body.match(/\| --- \|/g) ?? []).length,
  h2: (p.body.match(/^## /gm) ?? []).length,
  cite: (p.body.split('## 참고')[1]?.match(/^- /gm) ?? []).length,
})
console.log('전체', all.length, '편')
for (const k of ['chars', 'code', 'table', 'h2', 'cite'] as const) {
  const s = stat(all.map((a) => f(a.p)[k]))
  console.log(`${k.padEnd(6)} 최소 ${s.min} · 25% ${s.q1} · 중앙 ${s.med} · 75% ${s.q3} · 최대 ${s.max}`)
}
const groups: [string, (n: number) => boolean][] = [['1~100', (n) => n <= 10], ['101~250', (n) => n > 10 && n <= 25], ['251~350', (n) => n > 25]]
for (const [name, sel] of groups) {
  const g = all.filter((a) => sel(a.n)).map((a) => f(a.p))
  const med = (k: keyof ReturnType<typeof f>) => stat(g.map((x) => x[k])).med
  console.log(`${name.padEnd(8)} n=${g.length} · 본문 ${med('chars')}자 · 코드블록 ${med('code')} · 표 ${med('table')} · 소제목 ${med('h2')}`)
}
const thin = all.filter((a) => f(a.p).chars < 1500).length
console.log('1500자 미만', thin, '편 · 2500자 이상', all.filter((a) => f(a.p).chars >= 2500).length, '편')
process.exit(0)
