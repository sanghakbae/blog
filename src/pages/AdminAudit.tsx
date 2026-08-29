import { useEffect, useState } from 'react'
import { AUDIT_LABELS, listAudit, type AuditEntry } from '../lib/audit'

function formatAt(entry: AuditEntry): string {
  const d = entry.at?.toDate?.()
  if (!d) return '기록 중…'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export default function AdminAudit() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listAudit().then(setEntries).catch((e) => { setError((e as Error).message); setEntries([]) })
  }, [])

  return (
    <div>
      <p className="mb-5 text-sm text-[var(--muted)]">
        관리자 활동 기록입니다. 기록은 추가만 가능하며 수정·삭제할 수 없습니다.
      </p>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
      {!entries && <p className="text-sm text-[var(--muted)]">불러오는 중…</p>}
      {entries?.length === 0 && !error && (
        <p className="text-sm text-[var(--muted)]">아직 기록이 없습니다.</p>
      )}

      {!!entries?.length && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs text-[var(--muted)]">
                <th className="py-2 pr-4 font-medium">시각</th>
                <th className="py-2 pr-4 font-medium">행위</th>
                <th className="py-2 pr-4 font-medium">수행자</th>
                <th className="py-2 pr-4 font-medium">대상</th>
                <th className="py-2 font-medium">내용</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-[var(--line)] align-top">
                  <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums text-xs text-[var(--muted)]">
                    {formatAt(e)}
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    {AUDIT_LABELS[e.action] ?? e.action}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-[var(--muted)]">{e.actorEmail}</td>
                  <td className="max-w-[16rem] truncate py-2.5 pr-4 text-xs text-[var(--muted)]">
                    {e.target}
                  </td>
                  <td className="py-2.5 text-xs text-[var(--muted)]">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
