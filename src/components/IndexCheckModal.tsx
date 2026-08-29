import { useEffect, useRef, useState } from 'react'
import { ENGINE_LABEL, confirmedOn, searchUrl, type Engine, type IndexStatus } from '../lib/indexStatus'

/**
 * 포털별 색인 확인 팝업.
 *
 * 검색 결과를 이 안에 그대로 띄울 수는 없다. 구글·네이버·빙 모두 다른 사이트가
 * 자기 결과 화면을 감싸지 못하도록 막아 두어서, iframe 은 빈 칸으로 남는다.
 * 그래서 확인에 필요한 것 — 검사할 주소, 검색어, 여는 버튼 — 을 모아 두고
 * 결과를 본 뒤 여기서 바로 기록하게 한다.
 */
export default function IndexCheckModal({
  engine,
  postId,
  title,
  status,
  onToggle,
  onClose,
}: {
  engine: Engine
  postId: string
  title: string
  status: IndexStatus
  onToggle: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  // 정리 단계에서 dialog 가 닫히며 나는 close 이벤트를 무시하기 위한 표시.
  // 없으면 StrictMode 가 이펙트를 두 번 돌릴 때 스스로 닫힌다.
  const closing = useRef(false)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      closing.current = true
    }
  }, [])

  const url = `https://blog.sanghak.kr/posts/${postId}/`
  const query = `site:blog.sanghak.kr/posts/${postId}/`
  const on = !!status[engine]

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      // 권한이 없으면 조용히 넘어간다. 값은 화면에 그대로 보인다.
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (!closing.current) onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-[min(92vw,26rem)] max-w-none rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-0 text-[var(--ink)] backdrop:bg-black/45 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
        <h2 className="text-[13px] font-semibold">{ENGINE_LABEL[engine]} 색인 확인</h2>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            on ? 'bg-amber-300/60 text-amber-900' : 'bg-[var(--bg)] text-[var(--muted)]'
          }`}
        >
          {on ? `색인됨 · ${confirmedOn(status, engine)} 기록` : '미확인'}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="ml-auto grid size-6 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink)]"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3 px-4 py-4 text-[11px]">
        <p className="text-[12px] font-medium">{title}</p>

        {[
          { label: '주소', value: url },
          { label: '검색어', value: query },
        ].map((row) => (
          <div key={row.label}>
            <span className="text-[10px] text-[var(--muted)]">{row.label}</span>
            <div className="mt-0.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-[var(--bg)] px-2 py-1 font-mono text-[10px]">
                {row.value}
              </code>
              <button
                type="button"
                onClick={() => copy(row.value, row.label)}
                className="shrink-0 rounded border border-[var(--line)] px-1.5 py-1 text-[10px] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {copied === row.label ? '복사됨' : '복사'}
              </button>
            </div>
          </div>
        ))}

        <p className="text-[10px] leading-relaxed text-[var(--muted)]">
          검색 결과를 이 창 안에 띄울 수는 없습니다. 포털이 다른 사이트에서 자기 결과 화면을 감싸지
          못하게 막아 두었습니다. 아래에서 열어 확인한 뒤 결과를 기록하세요.
        </p>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-3">
        <a
          href={searchUrl(engine, postId)}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent-ink)]"
        >
          {ENGINE_LABEL[engine]}에서 열기
        </a>
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-md border px-3 py-1.5 text-[11px] transition-colors ${
            on
              ? 'border-amber-400 bg-amber-300/60 font-medium text-amber-900'
              : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
          }`}
        >
          {on ? '색인됨 해제' : '색인됨으로 기록'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
        >
          닫기
        </button>
      </div>
    </dialog>
  )
}
