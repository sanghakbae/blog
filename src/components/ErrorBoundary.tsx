import { Component, type ReactNode } from 'react'

/**
 * 마지막 안전망.
 * 초기화 실패 하나로 화면 전체가 비어 버리면 사용자는 아무것도 할 수 없다.
 * 최소한 무엇이 잘못됐는지 보여주고 다시 시도할 길을 남긴다.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('렌더링 중 오류', error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-lg font-semibold">화면을 표시하지 못했습니다</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            일시적인 문제일 수 있습니다. 새로고침해도 같은 화면이 나오면 잠시 후 다시 시도해
            주세요.
          </p>
          <p className="mt-4 break-words font-mono text-[11px] text-[var(--muted)]">
            {error.message}
          </p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-6 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-ink)]"
          >
            새로고침
          </button>
        </div>
      </div>
    )
  }
}
