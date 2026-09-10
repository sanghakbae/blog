import { useEffect, useMemo, useState } from 'react'
import { listAllPosts, type Post } from '../lib/posts'
import { auditPost } from '../lib/seo'
import { readingStats } from '../lib/editorCommands'

/**
 * 관리 콘솔의 통계 탭.
 *
 * 차트 라이브러리를 새로 들이지 않고 SVG 로 직접 그린다. 여기서 필요한 것은
 * 막대 네 종류뿐이고, 라이브러리 하나가 첫 화면 용량을 수십 KB 늘리는 편이
 * 손해다. 계열이 하나씩이라 범례 없이 값에 직접 라벨을 단다.
 */

const ACCENT = 'var(--accent)'
const SOFT = 'var(--accent-soft)'

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] px-4 py-3.5">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-1 font-mono text-2xl leading-none tabular-nums">{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-[var(--muted)]">{sub}</div>}
    </div>
  )
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-4 sm:p-5">
      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {note && <span className="text-[11px] text-[var(--muted)]">{note}</span>}
      </div>
      {children}
    </section>
  )
}

/** 세로 막대 — 시간 흐름처럼 순서가 뜻을 갖는 값에 쓴다 */
function ColumnChart({ data }: { data: { label: string; value: number; full: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex h-44 items-end gap-1.5" role="img" aria-label="월별 발행 글 수">
      {data.map((d) => (
        <div key={d.full} className="group flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="font-mono text-[10px] tabular-nums text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100">
            {d.value}
          </span>
          <div
            className="w-full rounded-t-[4px] transition-colors"
            style={{
              height: `${Math.max(2, (d.value / max) * 118)}px`,
              background: d.value ? ACCENT : 'var(--line)',
            }}
            title={`${d.full} · ${d.value}편`}
          />
          <span className="w-full truncate text-center font-mono text-[10px] text-[var(--muted)]">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 가로 막대 — 이름이 길고 순위가 뜻을 갖는 값에 쓴다 */
function BarChart({ data, unit = '편' }: { data: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3" title={`${d.label} · ${d.value}${unit}`}>
          <span className="w-20 shrink-0 truncate text-right text-xs text-[var(--ink)]">{d.label}</span>
          <div className="h-[9px] min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: SOFT }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, background: ACCENT }}
            />
          </div>
          <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--muted)]">
            {d.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 한 줄 누적 막대 — 전체를 나눈 상태를 보여줄 때 쓴다 */
function StackedBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0) || 1
  return (
    <div>
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-full">
        {parts.map((p) => (
          <div
            key={p.label}
            style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
            title={`${p.label} · ${p.value}편`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} />
            <span className="text-xs text-[var(--ink)]">{p.label}</span>
            <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
              {p.value} · {Math.round((p.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminStats() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listAllPosts().then(setPosts).catch((e) => { setError((e as Error).message); setPosts([]) })
  }, [])

  const s = useMemo(() => {
    if (!posts?.length) return null

    const published = posts.filter((p) => p.published)

    // 월별 — 최근 12개월. 글이 없는 달도 자리를 남겨야 간격이 왜곡되지 않는다.
    const now = new Date()
    const months: { label: string; value: number; full: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const n = posts.filter((p) => {
        const at = p.createdAt?.toDate?.()
        return at && `${at.getFullYear()}-${at.getMonth()}` === key
      }).length
      months.push({ label: `${d.getMonth() + 1}월`, value: n, full: `${d.getFullYear()}년 ${d.getMonth() + 1}월` })
    }

    const tagCount = new Map<string, number>()
    for (const p of published) for (const t of p.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
    const topTags = [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }))

    const minuteCount = new Map<number, number>()
    for (const p of published) {
      const m = p.minutes ?? readingStats(p.body).minutes
      minuteCount.set(m, (minuteCount.get(m) ?? 0) + 1)
    }
    const readTimes = [...minuteCount.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([m, value]) => ({ label: `${m}분`, value }))

    const scores = published.map((p) =>
      auditPost({ id: p.id, title: p.title, body: p.body, excerpt: p.excerpt, tags: p.tags }).score,
    )
    const perfect = scores.filter((n) => n === 100).length
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

    const indexed = published.filter((p) => p.indexStatus?.google).length

    return {
      total: posts.length,
      published: published.length,
      drafts: posts.length - published.length,
      tags: tagCount.size,
      months,
      topTags,
      readTimes,
      avg,
      perfect,
      indexed,
      notIndexed: published.length - indexed,
    }
  }, [posts])

  if (error) return <p className="text-sm text-red-500">{error}</p>
  if (!posts) return <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
  if (!s) return <p className="text-sm text-[var(--muted)]">집계할 글이 없습니다.</p>

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="전체 글" value={String(s.total)} sub={`발행 ${s.published} · 임시저장 ${s.drafts}`} />
        <Tile label="태그" value={String(s.tags)} sub="발행 글 기준" />
        <Tile
          label="SEO / GEO 평균"
          value={`${s.avg}점`}
          sub={`100점 ${s.perfect}편 (${Math.round((s.perfect / s.published) * 100)}%)`}
        />
        <Tile
          label="구글 색인"
          value={`${Math.round((s.indexed / Math.max(1, s.published)) * 100)}%`}
          sub={`${s.indexed} / ${s.published}편`}
        />
      </div>

      <Panel title="월별 발행" note="최근 12개월">
        <ColumnChart data={s.months} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="많이 쓴 태그" note="상위 10개">
          <BarChart data={s.topTags} />
        </Panel>
        <Panel title="읽기 시간 분포" note="발행 글">
          <BarChart data={s.readTimes} />
        </Panel>
      </div>

      <Panel title="구글 색인 상태" note="하루 두 번 자동 갱신">
        <StackedBar
          parts={[
            { label: '색인됨', value: s.indexed, color: 'var(--accent)' },
            { label: '미색인', value: s.notIndexed, color: 'var(--line)' },
          ]}
        />
      </Panel>
    </div>
  )
}
