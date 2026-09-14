import { useEffect, useState } from 'react'
import {
  countView,
  hasLiked,
  subscribeEngagement,
  toggleLike,
  type Engagement,
} from '../lib/engagement'
import { signIn, subscribeViewer, type Viewer } from '../lib/authState'

/**
 * 글 아래 붙는 조회수와 좋아요.
 *
 * 숫자는 실시간으로 따라간다 — 다른 사람이 누른 것이 새로고침 없이 보인다.
 * 좋아요는 로그인이 필요하고, 로그인하지 않은 사람이 누르면 로그인을 먼저 연다.
 * 누르기 전에 막아 두면 왜 못 누르는지 알 수 없어 그냥 지나간다.
 */
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

export default function PostEngagement({ postId }: { postId: string }) {
  const [stats, setStats] = useState<Engagement>({ views: 0, likes: 0 })
  const [liked, setLiked] = useState(false)
  const [viewer, setViewer] = useState<Viewer>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribeViewer(setViewer), [])

  useEffect(() => {
    void countView(postId)
    return subscribeEngagement(postId, setStats)
  }, [postId])

  useEffect(() => {
    if (!viewer) return setLiked(false)
    void hasLiked(postId).then(setLiked)
  }, [postId, viewer])

  async function onLike() {
    setBusy(true)
    try {
      // 로그인하지 않았으면 먼저 로그인하고, 같은 누름으로 좋아요까지 끝낸다.
      // 로그인만 하고 끝내면 사용자는 눌렀는데 아무 일도 없는 것으로 본다 —
      // 두 번 눌러야 한다는 것을 알 방법이 없다.
      if (!viewer) await signIn()
      // 화면을 먼저 바꾼다. 구독이 곧 진짜 값으로 덮어쓰므로 어긋나도 오래가지 않는다.
      setLiked((v) => !v)
      setLiked(await toggleLike(postId))
    } catch (err) {
      // 로그인 팝업을 닫은 경우까지 포함된다. 실제 상태로 되돌린다.
      setLiked(await hasLiked(postId))
      const message = (err as Error).message
      if (message && !/popup|cancel|closed/i.test(message)) console.warn('좋아요 실패', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className="font-mono text-[11px] text-[var(--muted)]"
        title={`조회 ${stats.views}회`}
      >
        조회 {fmt(stats.views)}
      </span>

      <button
        type="button"
        onClick={onLike}
        disabled={busy}
        aria-pressed={liked}
        title={viewer ? (liked ? '좋아요 취소' : '좋아요') : '로그인하고 좋아요'}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition-colors disabled:opacity-50 ${
          liked
            ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
            : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
        }`}
      >
        <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
          <path
            d="M8 14s-5.5-3.4-5.5-7A3 3 0 0 1 8 5.3 3 3 0 0 1 13.5 7c0 3.6-5.5 7-5.5 7Z"
            fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
        {fmt(stats.likes)}
      </button>
    </div>
  )
}
