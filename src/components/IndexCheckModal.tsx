import { useEffect, useRef } from 'react'
import { ENGINE_LABEL, searchUrl, type Engine } from '../lib/indexStatus'

/**
 * 색인 확인 팝업.
 *
 * 예전에는 별도 창을 띄웠는데, 500편을 훑다 보면 창이 계속 쌓이고 어느 창이
 * 어느 글의 것인지 알 수 없게 된다. 같은 화면 안에 띄우고, 본 결과를 그 자리에서
 * 남기면 한 글에 대한 일이 한 곳에서 끝난다.
 *
 * 구글은 여기 오지 않는다. x-frame-options: SAMEORIGIN 을 보내 iframe 에 뜨지
 * 않는 데다, 배지 값은 Search Console API 가 채우므로 기록할 것도 없다. 띄워 봐야
 * 새 창 단추 하나뿐인 빈 칸이라 목록에서 바로 새 탭으로 연다.
 * 네이버·빙은 그 헤더도 frame-ancestors 도 보내지 않아 그대로 뜬다.
 */

export default function IndexCheckModal({
  postId,
  title,
  engine,
  saving,
  onMark,
  onClose,
}: {
  postId: string
  title: string
  engine: Engine
  saving: boolean
  onMark: (on: boolean) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  // PrivacyModal 과 같은 이유 — StrictMode 가 이펙트를 두 번 돌릴 때
  // 정리 단계의 close 이벤트를 진짜 닫힘으로 착각하지 않게 한다.
  const closing = useRef(false)
  const url = searchUrl(engine, postId)

  useEffect(() => {
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
      onClose={() => {
        if (!closing.current) onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto flex h-[80dvh] max-h-none w-[80vw] max-w-none flex-col rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-0 text-[var(--ink)] backdrop:bg-black/45 backdrop:backdrop-blur-sm"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <span className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
          {ENGINE_LABEL[engine]}
        </span>
        <h2 className="min-w-0 truncate text-[11px] font-semibold">{title}</h2>
        <span className="hidden truncate font-mono text-[10px] text-[var(--muted)] sm:block">
          site:blog.sanghak.kr/posts/{postId}/
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto shrink-0 rounded-md border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          새 창에서 열기
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink)]"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 bg-[var(--bg)]">
        <iframe
          src={url}
          title={`${ENGINE_LABEL[engine]} 검색 결과`}
          className="size-full border-0"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-[var(--line)] px-4 py-2.5">
        <span className="text-[11px] text-[var(--muted)]">
          검색 결과에 이 글이 있나요?
        </span>
        <button
          type="button"
          disabled={saving}
          onClick={() => onMark(true)}
          className="rounded border border-amber-400 bg-amber-300/60 px-2 py-0.5 text-[11px] font-medium text-amber-900 disabled:opacity-50"
        >
          있음
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onMark(false)}
          className="rounded border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)] disabled:opacity-50"
        >
          없음
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
        >
          기록하지 않고 닫기
        </button>
      </div>
    </dialog>
  )
}
