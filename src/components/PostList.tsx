import { Link } from 'react-router-dom'
import type { Post } from '../lib/posts'
import { formatDate } from '../lib/date'
import { readingStats } from '../lib/editorCommands'

/**
 * 글마다 만들어 둔 도식을 곁들인 카드 격자.
 *
 * 목록을 텍스트 행으로만 두면 351편이 전부 같은 무게로 보여서 어디부터 볼지
 * 단서가 없다. 도식을 오른쪽에 작게 붙여 글의 종류를 눈으로 구분하게 하되,
 * 읽는 것은 제목과 요약이므로 자리는 글자에 준다.
 * 태그 목록은 오른쪽 사이드바에 그대로 있으므로 여기서는 반복하지 않는다.
 */

/** 번호 색은 첫 태그에서 정한다. 순서로 정하면 목록이 바뀔 때 같은 글의 색이 달라진다. */
const TINTS = [
  ['--rank-1-soft', '--rank-1'],
  ['--rank-2-soft', '--rank-2'],
  ['--rank-3-soft', '--rank-3'],
  ['--rank-4-soft', '--rank-4'],
  ['--rank-5-soft', '--rank-5'],
] as const

function tintOf(tag: string | undefined): { bg: string; ink: string } {
  if (!tag) return { bg: 'var(--accent-soft)', ink: 'var(--accent)' }
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  const [bg, ink] = TINTS[h % TINTS.length]
  return { bg: `var(${bg})`, ink: `var(${ink})` }
}

export default function PostList({ posts, empty }: { posts: Post[]; empty: string }) {
  if (posts.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] py-24 text-center">
        <p className="text-sm text-[var(--muted)]">{empty}</p>
      </div>
    )

  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
      {posts.map((post, i) => {
        const tint = tintOf(post.tags[0])
        return (
          <li
            key={post.id}
            /* 등장 애니메이션은 처음 화면에 보일 만큼만 건다.
               500편 전체에 걸면 애니메이션이 그 수만큼 동시에 돌고,
               무엇보다 애니메이션이 시작되지 않는 환경에서 카드가 계속 투명해진다. */
            className={i < 12 ? 'rise' : undefined}
            style={i < 12 ? { animationDelay: `${Math.min(i, 8) * 45}ms` } : undefined}
          >
            <article className="flex h-full gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-3 transition-colors hover:border-[var(--accent)]">
              <div className="flex min-w-0 flex-1 flex-col">
                <Link to={`/posts/${post.id}`} className="group block">
                  <h2 className="text-[15px] leading-snug font-semibold tracking-[-0.02em] transition-colors group-hover:text-[var(--accent)] sm:text-[15.5px]">
                    {post.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.55] text-[var(--muted)]">
                    {post.excerpt}
                  </p>
                </Link>

                <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2">
                  {/* 목록에서의 순서가 아니라 글 번호다. 새 글이 나올수록 번호가 커진다. */}
                  <span
                    className="rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
                    style={{ color: tint.ink, background: tint.bg }}
                  >
                    {String(posts.length - i).padStart(2, '0')}
                  </span>
                  <time className="font-mono text-[11px] text-[var(--muted)]">
                    {formatDate(post.createdAt)}
                  </time>
                  <span className="font-mono text-[10px] text-[var(--muted)]">
                    {post.minutes ?? readingStats(post.body).minutes}분
                  </span>
                  {post.tags.map((tag) => (
                    <Link
                      key={tag}
                      to={`/tags/${encodeURIComponent(tag)}`}
                      className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>

              {/* 도식 SVG 는 흰 바탕과 테두리를 스스로 갖고 있고 높이도 글마다 다르다.
                  그래서 색을 덧대지 않고 흰 판에 맞춰 넣는다 — 남는 여백이 보이지 않는다. */}
              <Link
                to={`/posts/${post.id}`}
                aria-hidden
                tabIndex={-1}
                className="shrink-0 self-start"
              >
                <div
                  className="grid w-[76px] place-items-center overflow-hidden rounded-lg border border-[var(--line)] sm:w-[92px]"
                  style={{ background: '#ffffff', aspectRatio: '16 / 10' }}
                >
                  <img
                    src={`/img/posts/${post.id}.svg`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain"
                  />
                </div>
              </Link>
            </article>
          </li>
        )
      })}
    </ul>
  )
}
