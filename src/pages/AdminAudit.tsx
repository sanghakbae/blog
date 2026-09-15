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
              className={`rounded-md border px-2.5 py-1 text-[13px] font-medium transition-colors ${
                group === g.id
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {g.label}
              <span className="ml-1.5 font-mono text-[11px] opacity-70">{counts[g.id]}</span>
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
        <>
          {/* 좁은 화면에서는 표를 버린다.
              칸이 다섯이면 어떤 폭을 줘도 375px 안에 들어가지 않는다. 억지로 넣으면
              내용 칸이 한 글자 폭이 되어 글자가 세로로 흐르고, 넘친 만큼 페이지
              전체가 옆으로 밀려 왼쪽이 잘린다. 실제로 그렇게 됐다.
              한 건을 한 장으로 쌓으면 무엇을 언제 누가 했는지 그대로 읽힌다. */}
          <ul className="space-y-2 sm:hidden">
            {shown.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] p-3"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-[13px] font-semibold">
                    {AUDIT_LABELS[e.action] ?? e.action}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
                    {formatAt(e)}
                  </span>
                </div>

                {/* 대상과 내용은 길다. 자르지 않고 접어 내린다 — 감사 기록은
                    훑는 것이 아니라 읽는 것이라 잘리면 쓸모가 없다. */}
                {e.target && (
                  <p className="mt-1.5 text-[12px] break-all text-[var(--muted)]">{e.target}</p>
                )}
                {e.detail && (
                  <p className="mt-1 text-[12.5px] leading-snug break-words text-[var(--ink)]">
                    {e.detail}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] break-all text-[var(--muted)]">{e.actorEmail}</p>
              </li>
            ))}
          </ul>

          {/* 넓은 화면에서는 표가 훑기에 낫다 */}
          <table className="hidden w-full table-fixed border-collapse sm:table">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[13px] text-[var(--muted)]">
                <th className="w-[10rem] py-2 pr-3 font-medium">시각</th>
                <th className="w-[6rem] py-2 pr-3 font-medium">행위</th>
                <th className="w-[12rem] py-2 pr-3 font-medium lg:w-[14rem]">수행자</th>
                <th className="w-[9rem] py-2 pr-3 font-medium">대상</th>
                <th className="py-2 font-medium">내용</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id} className="border-b border-[var(--line)] align-top">
                  <td className="py-2.5 pr-3 font-mono text-[12px] tabular-nums text-[var(--muted)]">
                    {formatAt(e)}
                  </td>
                  <td className="py-2.5 pr-3 text-[13px]">{AUDIT_LABELS[e.action] ?? e.action}</td>
                  <td className="py-2.5 pr-3 text-[12px] break-all text-[var(--muted)]">
                    {e.actorEmail}
                  </td>
                  <td className="py-2.5 pr-3 text-[12px] break-all text-[var(--muted)]">
                    {e.target || <span className="opacity-40">—</span>}
                  </td>
                  <td className="py-2.5 text-[13px] break-words text-[var(--ink)]">
                    {e.detail || <span className="opacity-40">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

    </div>
  )
}
