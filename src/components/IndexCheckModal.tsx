import { useEffect, useRef } from 'react'
import { ENGINE_LABEL, confirmedOn, searchUrl, type Engine, type IndexStatus } from '../lib/indexStatus'

/**
 * 포털별 색인 확인 팝업. 화면의 가로·세로 80% 크기로 검색 페이지를 띄운다.
 *
 * 포털이 결과 화면을 다른 사이트에서 감싸지 못하게 막아 두는 경우가 있어,
 * 안쪽이 비어 보일 수 있다. 그때를 위해 새 탭으로 여는 길을 함께 둔다.
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

  useEffect(() => {
    // StrictMode 는 이펙트를 붙였다 떼었다 다시 붙인다. 그 떼는 단계에서 세운
    // closing 을 여기서 되돌리지 않으면 계속 true 로 남아, 진짜로 닫혔을 때
    // onClose 가 무시된다. 그러면 팝업은 사라졌는데 상태는 열린 채라 다시
    // 열리지 않고 body 스크롤도 잠긴 채 남는다.
    closing.current = false
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      closing.current = true
      document.body.style.overflow = ''
    }
  }, [])

  const url = searchUrl(engine, postId)
  const on = !!status[engine]

  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (!closing.current) onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto flex h-[80dvh] max-h-none w-[80vw] max-w-none flex-col rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-0 text-[var(--ink)] backdrop:bg-black/45 backdrop:backdrop-blur-sm"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <h2 className="text-[13px] font-semibold">{ENGINE_LABEL[engine]} 색인 확인</h2>
        <span className="min-w-0 max-w-[38%] truncate text-[11px] text-[var(--muted)]">{title}</span>

        <button
          type="button"
          onClick={onToggle}
          className={`ml-auto rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
            on
              ? 'border-amber-400 bg-amber-300/60 font-medium text-amber-900'
              : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
          }`}
        >
          {on ? `색인됨 · ${confirmedOn(status, engine)} — 해제` : '색인됨으로 기록'}
        </button>

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          새 탭 ↗
        </a>

        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="grid size-6 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink)]"
        >
          ✕
        </button>
      </div>

      <iframe
        src={url}
        title={`${ENGINE_LABEL[engine]} 검색 결과`}
        className="min-h-0 w-full flex-1 border-0 bg-white"
        referrerPolicy="no-referrer"
      />

      {/* 포털이 결과 화면을 다른 사이트 안에 띄우지 못하게 막으면 위가 빈 칸으로
          남는다. 그때 무엇을 해야 하는지는 iframe 에 가리지 않는 자리에 둔다. */}
      <p className="shrink-0 rounded-b-2xl border-t border-[var(--line)] px-4 py-2 text-[10px] text-[var(--muted)]">
        위가 비어 있으면 {ENGINE_LABEL[engine]}이(가) 결과 화면을 다른 사이트 안에 띄우지 못하게 막은
        것입니다. <span className="text-[var(--ink)]">새 탭 ↗</span> 으로 열어 확인하세요.
      </p>
    </dialog>
  )
}
