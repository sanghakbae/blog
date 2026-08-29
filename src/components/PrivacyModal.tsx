import { useEffect, useRef } from 'react'
import PrivacyContent from './PrivacyContent'

/**
 * 개인정보처리방침 팝업.
 * 네이티브 dialog 를 써서 포커스 가둠과 Esc 닫기를 브라우저에 맡긴다.
 */
export default function PrivacyModal({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  // 정리 단계에서 dialog 가 닫히며 발생하는 close 이벤트를 무시하기 위한 표시.
  // 없으면 StrictMode 가 이펙트를 두 번 돌릴 때 스스로 닫혀 팝업이 뜨지 않는다.
  const closing = useRef(false)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      closing.current = true
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <dialog
      ref={ref}
      onClose={() => { if (!closing.current) onClose() }}
      onClick={(e) => {
        // 바깥(백드롭)을 누르면 닫는다
        if (e.target === ref.current) onClose()
      }}
      className="m-auto flex h-[80dvh] max-h-none w-[80vw] max-w-none flex-col rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-0 text-[var(--ink)] backdrop:bg-black/45 backdrop:backdrop-blur-sm"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--line)] px-6 py-4">
        <h2 className="text-sm font-semibold">개인정보처리방침</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="ml-auto grid size-7 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink)]"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10">
        <PrivacyContent />
      </div>

      <div className="shrink-0 border-t border-[var(--line)] px-6 py-3 text-right">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-ink)]"
        >
          확인
        </button>
      </div>
    </dialog>
  )
}
