import { useEffect, useRef, useState } from 'react'
import {
  MAX_COMMENT_LENGTH, addComment, editComment, removeComment, subscribeComments, type Comment,
} from '../lib/comments'

type Me = { uid: string; name: string; photo: string | null; isAdmin: boolean } | null

const SEEN = 'auth:seen'

/** 게시글 하단의 댓글 영역. 댓글을 쓰려면 구글 로그인이 필요하다. */
export default function CommentSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [me, setMe] = useState<Me>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => subscribeComments(postId, setComments), [postId])

  // 읽기만 하는 방문자에게 인증 모듈을 내려보내지 않는다
  useEffect(() => {
    if (!localStorage.getItem(SEEN)) return
    let alive = true
    let unsubscribe: (() => void) | undefined
    ;(async () => {
      const [{ auth, ADMIN_EMAILS }, { onAuthStateChanged }] = await Promise.all([
        import('../lib/authClient'),
        import('firebase/auth'),
      ])
      if (!alive) return
      unsubscribe = onAuthStateChanged(auth, (u) =>
        setMe(
          u
            ? {
                uid: u.uid,
                name: u.displayName ?? u.email?.split('@')[0] ?? '익명',
                photo: u.photoURL,
                isAdmin: ADMIN_EMAILS.includes((u.email ?? '').toLowerCase()),
              }
            : null,
        ),
      )
    })()
    return () => { alive = false; unsubscribe?.() }
  }, [])

  async function signIn() {
    setBusy(true)
    try {
      const [{ auth, googleProvider, ADMIN_EMAILS }, { signInWithPopup }] = await Promise.all([
        import('../lib/authClient'),
        import('firebase/auth'),
      ])
      const { user } = await signInWithPopup(auth, googleProvider)
      localStorage.setItem(SEEN, '1')
      setMe({
        uid: user.uid,
        name: user.displayName ?? user.email?.split('@')[0] ?? '익명',
        photo: user.photoURL,
        isAdmin: ADMIN_EMAILS.includes((user.email ?? '').toLowerCase()),
      })
    } catch {
      setStatus('로그인을 취소했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!me || !body.trim()) return
    setBusy(true)
    setStatus('')
    try {
      await addComment(postId, {
        body,
        authorUid: me.uid,
        authorName: me.name,
        authorPhoto: me.photo,
      })
      setBody('')
      areaRef.current?.focus()
    } catch (err) {
      setStatus((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(comment: Comment) {
    setBusy(true)
    try {
      await editComment(postId, comment.id, editBody)
      setEditingId(null)
    } catch (err) {
      setStatus((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(comment: Comment) {
    if (!confirm('이 댓글을 삭제할까요?')) return
    try {
      await removeComment(postId, comment.id)
    } catch (err) {
      setStatus((err as Error).message)
    }
  }

  const count = comments?.length ?? 0

  return (
    <section className="mt-10 border-t border-[var(--line)] pt-6">
      <h2 className="text-sm font-semibold">
        댓글 <span className="font-mono text-[var(--muted)]">{count}</span>
      </h2>

      {comments === null ? (
        <p className="mt-4 text-xs text-[var(--muted)]">불러오는 중…</p>
      ) : count === 0 ? (
        <p className="mt-4 text-xs text-[var(--muted)]">첫 댓글을 남겨보세요.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              {c.authorPhoto ? (
                <img
                  src={c.authorPhoto}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-6 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--bg-elev)] text-[10px] text-[var(--muted)]">
                  {c.authorName.slice(0, 1)}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{c.authorName}</span>
                  <time className="font-mono text-[10px] text-[var(--muted)]">
                    {c.createdAt?.toDate?.().toLocaleString('ko-KR') ?? ''}
                  </time>
                  {c.editedAt && <span className="text-[10px] text-[var(--muted)]">(수정됨)</span>}

                  {/* 수정은 작성자 본인만. 관리자는 삭제만 한다. */}
                  {me?.uid === c.authorUid && editingId !== c.id && (
                    <button
                      type="button"
                      onClick={() => { setEditingId(c.id); setEditBody(c.body) }}
                      className="ml-auto text-[10px] text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                    >
                      수정
                    </button>
                  )}
                  {(me?.uid === c.authorUid || me?.isAdmin) && (
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      className={`text-[10px] text-[var(--muted)] transition-colors hover:text-red-500 ${
                        me?.uid === c.authorUid && editingId !== c.id ? '' : 'ml-auto'
                      }`}
                    >
                      삭제
                    </button>
                  )}
                </div>

                {editingId === c.id ? (
                  <div className="mt-1.5">
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingId(null)
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveEdit(c)
                      }}
                      rows={3}
                      autoFocus
                      className="w-full resize-y rounded-lg border border-[var(--accent)] bg-transparent p-2.5 text-[13px] outline-none"
                    />
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        {editBody.length}/{MAX_COMMENT_LENGTH}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="ml-auto rounded-md border border-[var(--line)] px-3 py-1 text-[11px]"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(c)}
                        disabled={busy || !editBody.trim() || editBody.trim() === c.body}
                        className="rounded-md bg-[var(--accent)] px-3 py-1 text-[11px] font-medium text-[var(--accent-ink)] disabled:opacity-40"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                    {c.body}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        {me ? (
          <>
            <textarea
              ref={areaRef}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
              }}
              rows={3}
              placeholder={`${me.name} 님으로 댓글을 남깁니다`}
              className="w-full resize-y rounded-xl border border-[var(--line)] bg-transparent p-3 text-[13px] outline-none focus:border-[var(--accent)]"
            />
            <div className="mt-2 flex items-center gap-3">
              <span className="font-mono text-[10px] text-[var(--muted)]">
                {body.length}/{MAX_COMMENT_LENGTH}
              </span>
              <span className="text-[10px] text-[var(--muted)]">{status}</span>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !body.trim()}
                className="ml-auto rounded-md bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-[var(--accent-ink)] disabled:opacity-40"
              >
                등록
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--line)] p-5 text-center">
            <p className="text-xs text-[var(--muted)]">댓글을 쓰려면 로그인이 필요합니다.</p>
            <button
              type="button"
              onClick={signIn}
              disabled={busy}
              className="mt-3 rounded-md border border-[var(--line)] px-4 py-1.5 text-xs font-medium transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
            >
              구글로 로그인
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
