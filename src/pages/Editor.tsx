import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deletePost, fetchTagNames, getPost, savePost } from '../lib/posts'
import { analyzeTags, type SuggestedTag } from '../lib/analyze'
import { uploadImage } from '../lib/upload'
import { MAX_TAGS } from '../lib/tags'

export default function Editor() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [published, setPublished] = useState(false)
  const [tags, setTags] = useState<SuggestedTag[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [status, setStatus] = useState('')
  const [loaded, setLoaded] = useState(!id)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!id) return
    getPost(id).then((p) => {
      if (!p) return setStatus('글을 찾을 수 없습니다.')
      setTitle(p.title)
      setBody(p.body)
      setPublished(p.published)
      setTags(p.tags.map((t) => ({ tag: t, reason: '' })))
      setLoaded(true)
    })
  }, [id])

  /** 본문을 Claude 에게 읽히고 태그를 받아온다 */
  const runAnalysis = useCallback(async () => {
    if (body.trim().length < 20) return setStatus('본문이 너무 짧아 분석할 수 없습니다.')
    setAnalyzing(true)
    setStatus('본문을 분석하는 중…')
    try {
      const existingTags = await fetchTagNames()
      setTags(await analyzeTags({ title, body, existingTags }))
      setStatus('태그를 새로 분석했습니다.')
    } catch (err) {
      setStatus((err as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }, [title, body])

  async function handleSave(nextPublished: boolean) {
    // 발행할 때 태그가 비어 있으면 저장 전에 반드시 분석을 한 번 돌린다.
    let finalTags = tags
    if (nextPublished && finalTags.length === 0) {
      setAnalyzing(true)
      setStatus('본문을 분석하는 중…')
      try {
        finalTags = await analyzeTags({ title, body, existingTags: await fetchTagNames() })
        setTags(finalTags)
      } catch (err) {
        setAnalyzing(false)
        return setStatus(`태그 분석 실패 — ${(err as Error).message}`)
      }
      setAnalyzing(false)
    }

    setStatus('저장 중…')
    try {
      const savedId = await savePost(id ?? null, {
        title,
        body,
        published: nextPublished,
        tags: finalTags.map((t) => t.tag),
      })
      setPublished(nextPublished)
      setStatus('저장했습니다.')
      if (!id) navigate(`/admin/edit/${savedId}`, { replace: true })
    } catch (err) {
      setStatus((err as Error).message)
    }
  }

  async function handleDelete() {
    if (!id || !confirm('이 글을 삭제할까요?')) return
    await deletePost(id)
    navigate('/admin')
  }

  /** 이미지를 R2 에 올리고 커서 위치에 마크다운을 끼워 넣는다 */
  async function insertImage(file: File) {
    setStatus('이미지 업로드 중…')
    try {
      const url = await uploadImage(file)
      const el = bodyRef.current
      const at = el?.selectionStart ?? body.length
      const md = `\n![${file.name}](${url})\n`
      setBody(body.slice(0, at) + md + body.slice(at))
      setStatus('이미지를 넣었습니다.')
    } catch (err) {
      setStatus((err as Error).message)
    }
  }

  if (!loaded) return <p className="text-sm text-[var(--color-muted)]">불러오는 중…</p>

  return (
    <div className="space-y-5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="w-full border-b border-[var(--color-line)] bg-transparent pb-3 text-2xl font-semibold tracking-tight outline-none placeholder:text-[var(--color-muted)]"
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
        className="min-h-[55vh] w-full resize-y rounded-xl border border-[var(--color-line)] bg-transparent p-4 font-mono text-sm leading-relaxed outline-none focus:border-[var(--color-accent)]"
      />

      <section className="rounded-xl border border-[var(--color-line)] p-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">태그</h2>
          <span className="text-xs text-[var(--color-muted)]">
            본문 분석 결과 · 최대 {MAX_TAGS}개
          </span>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={analyzing}
            className="ml-auto rounded-lg border border-[var(--color-line)] px-2.5 py-1 text-xs disabled:opacity-50"
          >
            {analyzing ? '분석 중…' : '다시 분석'}
          </button>
        </div>

        {tags.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            아직 분석 전입니다. 발행할 때 자동으로 분석합니다.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tags.map((t, i) => (
              <li key={t.tag} className="flex items-start gap-3">
                <span className="rounded-full bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                  #{t.tag}
                </span>
                {t.reason && (
                  <span className="flex-1 text-xs leading-relaxed text-[var(--color-muted)]">
                    {t.reason}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((_, j) => j !== i))}
                  className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  aria-label={`${t.tag} 태그 빼기`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={analyzing || !title.trim()}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {published ? '발행 상태로 저장' : '발행'}
        </button>
        <button
          type="button"
          onClick={() => handleSave(false)}
          className="rounded-lg border border-[var(--color-line)] px-4 py-2 text-sm"
        >
          임시저장
        </button>
        {id && (
          <button type="button" onClick={handleDelete} className="text-sm text-red-500">
            삭제
          </button>
        )}
        <span className="text-xs text-[var(--color-muted)]">{status}</span>
      </div>
    </div>
  )
}
