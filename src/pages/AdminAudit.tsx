import { useEffect, useMemo, useState } from 'react'
import { AUDIT_LABELS, listAudit, type AuditAction, type AuditEntry } from '../lib/audit'

function formatAt(entry: AuditEntry): string {
  const d = entry.at?.toDate?.()
  if (!d) return '기록 중…'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * 묶어서 보기.
 *
 * 로그인·로그아웃은 한 번 작업할 때마다 두 줄씩 쌓여서, 정작 무엇을 바꿨는지가
 * 그 사이에 묻힌다. 기록을 줄이는 것은 감사 로그의 목적에 어긋나므로 지우지 않고
 * 걸러 본다. 기본값은 '글·설정' — 실제로 확인하려는 것이 그쪽이다.
 */
const GROUPS = [
  { id: 'change', label: '글·설정', match: (a: AuditAction) => !a.startsWith('auth.') },
  { id: 'auth', label: '접속', match: (a: AuditAction) => a.startsWith('auth.') },
  { id: 'all', label: '전체', match: () => true },
] as const

type GroupId = (typeof GROUPS)[number]['id']

export default function AdminAudit() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState('')
  const [group, setGroup] = useState<GroupId>('change')

  useEffect(() => {
    listAudit().then(setEntries).catch((e) => { setError((e as Error).message); setEntries([]) })
  }, [])

  const counts = useMemo(() => {
    const base: Record<GroupId, number> = { change: 0, auth: 0, all: entries?.length ?? 0 }
    for (const e of entries ?? []) {
      if (e.action.startsWith('auth.')) base.auth++
      else base.change++
    }
    return base
  }, [entries])

  const shown = useMemo(() => {
    const m = GROUPS.find((g) => g.id === group)!.match
    return (entries ?? []).filter((e) => m(e.action))
  }, [entries, group])

  return (
    <div>
      <p className="mb-4 text-sm text-[var(--muted)]">
        관리자 활동 기록입니다. 기록은 추가만 가능하며 수정·삭제할 수 없습니다.
      </p>

      {!!entries?.length && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                group === g.id
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {g.label}
              <span className="ml-1.5 font-mono text-[10px] opacity-70">{counts[g.id]}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
      {!entries && <p className="text-sm text-[var(--muted)]">불러오는 중…</p>}
      {entries?.length === 0 && !error && (
        <p className="text-sm text-[var(--muted)]">아직 기록이 없습니다.</p>
      )}
      {!!entries?.length && shown.length === 0 && (
        <p className="text-sm text-[var(--muted)]">이 묶음에는 기록이 없습니다.</p>
      )}

      {shown.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-center text-xs text-[var(--muted)]">
                <th className="py-2 pr-4 font-medium">시각</th>
                <th className="py-2 pr-4 font-medium">행위</th>
                <th className="py-2 pr-4 font-medium">수행자</th>
                <th className="py-2 pr-4 font-medium">대상</th>
                <th className="py-2 font-medium">내용</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id} className="border-b border-[var(--line)] align-top text-left">
                  <td className="py-2.5 pr-4 text-xs whitespace-nowrap tabular-nums text-[var(--muted)]">
                    {formatAt(e)}
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    {AUDIT_LABELS[e.action] ?? e.action}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-[var(--muted)]">{e.actorEmail}</td>
                  <td className="max-w-[16rem] truncate py-2.5 pr-4 text-xs text-[var(--muted)]">
                    {e.target || <span className="opacity-40">—</span>}
                  </td>
                  <td className="py-2.5 text-xs text-[var(--muted)]">
                    {e.detail || <span className="opacity-40">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
