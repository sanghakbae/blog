import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deletePost, fetchCorpus, fetchTagNames, getPost, savePost } from '../lib/posts'
import { analyzeContent, type CorpusDoc, type TagCandidate } from '../lib/localTagger'
import { uploadImage } from '../lib/upload'
import { MAX_TAGS } from '../lib/tags'
import { DEFAULT_SETTINGS, needsReauth, subscribeSettings, type SecuritySettings } from '../lib/settings'
import { logAudit } from '../lib/audit'
import { reauthenticate } from '../lib/useAuth'

export default function Editor() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [published, setPublished] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [touched, setTouched] = useState(false)
  const [corpus, setCorpus] = useState<CorpusDoc[]>([])
  const [existingTags, setExistingTags] = useState<string[]>([])
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState('')
  const [loaded, setLoaded] = useState(!id)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => subscribeSettings(setSettings), [])

  useEffect(() => {
    // 분석 기준이 되는 다른 글들과 기존 태그를 미리 받아둔다
    fetchCorpus().then(setCorpus).catch(() => {})
    fetchTagNames().then(setExistingTags).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    getPost(id).then((p) => {
      if (!p) return setStatus('글을 찾을 수 없습니다.')
      setTitle(p.title)
      setBody(p.body)
      setPublished(p.published)
      if (p.tags.length) { setPicked(p.tags); setTouched(true) }
      setLoaded(true)
    })
  }, [id])

  /** 본문이 바뀔 때마다 다시 분석한다. 외부 호출이 없어 즉시 끝난다. */
  const candidates: TagCandidate[] = useMemo(
    () => analyzeContent({ title, body, corpus, existingTags, max: 10 }),
    [title, body, corpus, existingTags],
  )

  // 아직 손대지 않았으면 상위 3개를 그대로 쓴다
  const tags = touched ? picked : candidates.slice(0, MAX_TAGS).map((c) => c.tag)

  const toggle = useCallback(
    (tag: string) => {
      const next = tags.includes(tag)
        ? tags.filter((t) => t !== tag)
        : tags.length >= MAX_TAGS
          ? tags
          : [...tags, tag]
      if (next === tags && !tags.includes(tag)) return setStatus(`태그는 최대 ${MAX_TAGS}개입니다.`)
      setTouched(true)
      setPicked(next)
      setStatus('')
    },
    [tags],
  )

  async function handleSave(nextPublished: boolean) {
    if (settings.postingLocked) return setStatus('보안 설정에서 글쓰기가 잠겨 있습니다.')

    if (needsReauth(settings)) {
      setStatus('마지막 로그인이 오래되어 재인증이 필요합니다…')
      try {
        await reauthenticate()
      } catch (err) {
        return setStatus(`재인증 실패 — ${(err as Error).message}`)
      }
    }

    setStatus('저장 중…')
    try {
      const savedId = await savePost(id ?? null, {
        title,
        body,
        published: nextPublished,
        tags,
        wasPublished: published,
      })
      setPublished(nextPublished)
      setStatus('저장했습니다.')
      if (!id) navigate(`/admin/edit/${savedId}`, { replace: true })
    } catch (err) {
      setStatus((err as Error).message)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (settings.postingLocked) return setStatus('보안 설정에서 글쓰기가 잠겨 있습니다.')
    if (!confirm('이 글을 삭제할까요? 되돌릴 수 없습니다.')) return
    if (needsReauth(settings)) {
      try { await reauthenticate() } catch (err) { return setStatus((err as Error).message) }
    }
    await deletePost(id, title)
    navigate('/admin')
  }

  /** 이미지를 R2 에 올리고 커서 위치에 마크다운을 끼워 넣는다 */
  async function insertImage(file: File) {
    if (!settings.allowImageUpload) return setStatus('보안 설정에서 이미지 업로드가 꺼져 있습니다.')
    setStatus('이미지 업로드 중…')
    try {
      const url = await uploadImage(file)
      const el = bodyRef.current
      const at = el?.selectionStart ?? body.length
      setBody(body.slice(0, at) + `\n![${file.name}](${url})\n` + body.slice(at))
      setStatus('이미지를 넣었습니다.')
      logAudit('image.upload', url, `${file.name} · ${Math.round(file.size / 1024)}KB`)
    } catch (err) {
      setStatus((err as Error).message)
    }
  }

  if (!loaded) return <p className="text-sm text-[var(--muted)]">불러오는 중…</p>

  return (
    <div className="space-y-5">
      {settings.postingLocked && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-transparent">
          보안 설정에서 글쓰기가 잠겨 있습니다. 저장·삭제가 차단됩니다.
        </p>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="w-full border-b border-[var(--line)] bg-transparent pb-3 text-2xl font-semibold tracking-tight outline-none placeholder:text-[var(--muted)]"
      />

      <textarea
        ref={bodyRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onPaste={(e) => {
          const file = [...e.clipboardData.files][0]
          if (file?.type.startsWith('image/')) { e.preventDefault(); insertImage(file) }
        }}
        onDrop={(e) => {
          const file = [...e.dataTransfer.files][0]
          if (file?.type.startsWith('image/')) { e.preventDefault(); insertImage(file) }
        }}
        placeholder="마크다운으로 자유롭게 쓰세요. 이미지는 붙여넣거나 끌어다 놓으면 됩니다."
        className="min-h-[50vh] w-full resize-y rounded-xl border border-[var(--line)] bg-transparent p-4 font-mono text-sm leading-relaxed outline-none focus:border-[var(--accent)]"
      />

      <section className="rounded-xl border border-[var(--line)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">태그</h2>
          <span className="text-xs text-[var(--muted)]">
            본문 분석 결과 · 최대 {MAX_TAGS}개 · 눌러서 바꿀 수 있습니다
          </span>
          {touched && (
            <button
              type="button"
              onClick={() => { setTouched(false); setPicked([]) }}
              className="ml-auto rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs"
            >
              분석 결과로 되돌리기
            </button>
          )}
        </div>

        {candidates.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            본문이 짧아 아직 분석할 내용이 없습니다.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {candidates.map((c) => {
              const on = tags.includes(c.tag)
              return (
                <li key={c.tag}>
                  <button
                    type="button"
                    onClick={() => toggle(c.tag)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                      on
                        ? 'bg-[var(--accent-soft)]'
                        : 'hover:bg-[var(--bg-elev)]'
                    }`}
                  >
                    <span
                      className={`shrink-0 text-sm ${on ? 'font-medium text-[var(--accent)]' : ''}`}
                    >
                      #{c.tag}
                    </span>
                    <span className="flex-1 truncate text-xs text-[var(--muted)]">
                      {c.reason}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                      {c.score.toFixed(1)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={!title.trim() || settings.postingLocked}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {published ? '발행 상태로 저장' : '발행'}
        </button>
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={settings.postingLocked}
          className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-50"
        >
          임시저장
        </button>
        {id && (
          <button type="button" onClick={handleDelete} className="text-sm text-red-500">
            삭제
          </button>
        )}
        <span className="text-xs text-[var(--muted)]">{status}</span>
      </div>
    </div>
  )
}
