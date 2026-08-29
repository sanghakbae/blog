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
          className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-ink)]"
        >
          확인
        </button>
      </div>
    </dialog>
  )
}
