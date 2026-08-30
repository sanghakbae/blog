import { useEffect, useState } from 'react'

const STORAGE_KEY = 'install-guide:v1'
const REMIND_AFTER_MS = 30 * 24 * 60 * 60 * 1000

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    iosNavigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  )
}

export default function InstallGuide() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone()) return

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'never' || Number(saved) > Date.now()) return
    } catch {
      // 저장소 접근이 막힌 브라우저에서도 안내는 정상적으로 표시한다.
    }

    const timer = window.setTimeout(() => setVisible(true), 900)
    return () => window.clearTimeout(timer)
  }, [])

  const close = (never: boolean) => {
    setVisible(false)
    try {
      localStorage.setItem(
        STORAGE_KEY,
        never ? 'never' : String(Date.now() + REMIND_AFTER_MS),
      )
    } catch {
      // 닫기 동작은 저장소 사용 가능 여부와 관계없이 동작해야 한다.
    }
  }

  if (!visible) return null

  return (
    <section
      role="dialog"
      aria-labelledby="install-guide-title"
      aria-describedby="install-guide-description"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-5 text-[var(--ink)] shadow-2xl sm:bottom-5 sm:p-6"
    >
      <h2 id="install-guide-title" className="text-base font-semibold tracking-tight">
        태그 블로그를 홈 화면에 추가하세요
      </h2>
      <p id="install-guide-description" className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        자주 보는 글을 앱처럼 빠르게 열고, 네트워크가 불안정할 때도 저장된 글을 읽을 수 있습니다.
      </p>

      <div className="mt-4 grid gap-3 text-sm leading-relaxed sm:grid-cols-2">
        <div className="rounded-xl bg-[var(--bg)] p-3">
          <strong className="block text-xs font-semibold">iPhone·iPad</strong>
          <span className="mt-1 block text-[var(--muted)]">
            Safari 하단의 공유 버튼을 누른 뒤 <b className="text-[var(--ink)]">홈 화면에 추가</b>를 선택하세요.
          </span>
        </div>
        <div className="rounded-xl bg-[var(--bg)] p-3">
          <strong className="block text-xs font-semibold">Android</strong>
          <span className="mt-1 block text-[var(--muted)]">
            Chrome 메뉴에서 <b className="text-[var(--ink)]">앱 설치</b> 또는 <b className="text-[var(--ink)]">홈 화면에 추가</b>를 선택하세요.
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => close(true)}
          className="rounded-md px-3 py-2 text-xs text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
        >
          다시 보지 않기
        </button>
        <button
          type="button"
          onClick={() => close(false)}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-ink)]"
        >
          확인
        </button>
      </div>
    </section>
  )
}
