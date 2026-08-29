import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deletePost, fetchCorpus, fetchTagNames, getPost, savePost } from '../lib/posts'
import {
  analyzeContent, buildCorpusIndex, type CorpusDoc, type TagCandidate,
} from '../lib/localTagger'
import { uploadImage } from '../lib/upload'
import { MAX_TAGS, makeExcerpt } from '../lib/tags'
import {
  insertBlock, insertLink, prefixLines, readingStats, surround, type Selection,
} from '../lib/editorCommands'
import EditorToolbar from '../components/EditorToolbar'
import { DEFAULT_SETTINGS, needsReauth, subscribeSettings, type SecuritySettings } from '../lib/settings'
import { logAudit } from '../lib/audit'
import { auditPost, type IssueArea } from '../lib/seo'
import { reauthenticate } from '../lib/useAuth'

const draftKey = (id?: string) => `draft:${id ?? 'new'}`

const AREA_TONE: Record<IssueArea, string> = {
  SEO: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  GEO: 'bg-emerald-500/15 text-emerald-600',
  이미지: 'bg-[var(--bg-elev)] text-[var(--muted)]',
  에디토리얼: 'bg-amber-500/15 text-amber-600',
}

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
  const [preview, setPreview] = useState(true)
  const [html, setHtml] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loaded, setLoaded] = useState(!id)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => subscribeSettings(setSettings), [])

  useEffect(() => {
    fetchCorpus().then(setCorpus).catch(() => {})
    fetchTagNames().then(setExistingTags).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) {
      // 새 글이면 저장하지 못한 초안을 복구한다
      const saved = localStorage.getItem(draftKey())
      if (saved) {
        const d = JSON.parse(saved)
        setTitle(d.title ?? '')
        setBody(d.body ?? '')
        setStatus('저장하지 않은 초안을 복구했습니다.')
      }
      return
    }
    getPost(id).then((p) => {
      if (!p) return setStatus('글을 찾을 수 없습니다.')
      setTitle(p.title)
      setBody(p.body)
      setPublished(p.published)
      if (p.tags.length) { setPicked(p.tags); setTouched(true) }
      setLoaded(true)
    })
  }, [id])

  // 브라우저가 닫혀도 잃지 않도록 초안을 로컬에 남긴다
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(
      () => localStorage.setItem(draftKey(id), JSON.stringify({ title, body })),
      600,
    )
    return () => clearTimeout(t)
  }, [title, body, dirty, id])

  useEffect(() => {
    if (!preview) return
    const t = setTimeout(() => {
      import('../lib/markdown').then((m) => setHtml(m.renderMarkdown(body)))
    }, 200)
    return () => clearTimeout(t)
  }, [body, preview])

  // 코퍼스 색인은 글 목록이 바뀔 때만 다시 만든다
  const index = useMemo(() => buildCorpusIndex(corpus), [corpus])

  // 타이핑 중에는 분석을 미룬다. 매 글자마다 돌리면 입력이 끊긴다.
  const [analyzed, setAnalyzed] = useState({ title: '', body: '' })
  useEffect(() => {
    const t = setTimeout(() => setAnalyzed({ title, body }), 400)
    return () => clearTimeout(t)
  }, [title, body])

  const candidates: TagCandidate[] = useMemo(
    () => analyzeContent({ ...analyzed, index, existingTags, max: 10 }),
    [analyzed, index, existingTags],
  )

  const tags = touched ? picked : candidates.slice(0, MAX_TAGS).map((c) => c.tag)
  const stats = useMemo(() => readingStats(body), [body])

  // 쓰는 중에 무엇이 빠졌는지 바로 보이게 한다
  const audit = useMemo(
    () => auditPost({ id, title: analyzed.title, body: analyzed.body, excerpt: makeExcerpt(analyzed.body), tags }),
    [id, analyzed, tags],
  )

  const edit = useCallback((fn: (sel: Selection) => Selection) => {
    const el = bodyRef.current
    if (!el) return
    const next = fn({ value: el.value, start: el.selectionStart, end: el.selectionEnd })
    setBody(next.value)
    setDirty(true)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(next.start, next.end)
    })
  }, [])

  const runCommand = useCallback(
    (cmd: string) => {
      switch (cmd) {
        case 'bold': return edit((s) => surround(s, '**', '굵게'))
        case 'italic': return edit((s) => surround(s, '*', '기울임'))
        case 'strike': return edit((s) => surround(s, '~~', '취소선'))
        case 'code': return edit((s) => surround(s, '`', 'code'))
        case 'h2': return edit((s) => prefixLines(s, '## '))
        case 'h3': return edit((s) => prefixLines(s, '### '))
        case 'ul': return edit((s) => prefixLines(s, '- '))
        case 'ol': return edit((s) => prefixLines(s, (i) => `${i + 1}. `))
        case 'quote': return edit((s) => prefixLines(s, '> '))
        case 'task': return edit((s) => prefixLines(s, '- [ ] '))
        case 'hr': return edit((s) => insertBlock(s, '---\n'))
        case 'codeblock': return edit((s) => insertBlock(s, '```\n\n```\n'))
        case 'table':
          return edit((s) => insertBlock(s, '| 항목 | 값 |\n| --- | --- |\n|  |  |\n'))
        case 'link': {
          const url = prompt('링크 주소')
          return url ? edit((s) => insertLink(s, url)) : undefined
        }
      }
    },
    [edit],
  )

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key === 's') { e.preventDefault(); return handleSave(published) }
    if (mod && e.key === 'b') { e.preventDefault(); return runCommand('bold') }
    if (mod && e.key === 'i') { e.preventDefault(); return runCommand('italic') }
    if (mod && e.key === 'k') { e.preventDefault(); return runCommand('link') }
    if (mod && e.altKey && (e.key === '2' || e.key === '3')) {
      e.preventDefault()
      return runCommand(`h${e.key}`)
    }
    // 탭으로 포커스가 날아가지 않게 두 칸 들여쓰기
    if (e.key === 'Tab') {
      e.preventDefault()
      edit((s) => (e.shiftKey ? prefixLines(s, '  ') : { ...s, value: s.value.slice(0, s.start) + '  ' + s.value.slice(s.end), start: s.start + 2, end: s.start + 2 }))
    }
  }

  const toggle = useCallback(
    (tag: string) => {
      if (!tags.includes(tag) && tags.length >= MAX_TAGS)
        return setStatus(`태그는 최대 ${MAX_TAGS}개입니다.`)
      setTouched(true)
      setPicked(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag])
      setStatus('')
    },
    [tags],
  )

  async function handleSave(nextPublished: boolean) {
    setError('')
    if (settings.postingLocked) return setError('보안 설정에서 글쓰기가 잠겨 있습니다.')
    if (!title.trim()) return setError('제목을 입력하세요.')

    if (needsReauth(settings)) {
      setStatus('마지막 로그인이 오래되어 재인증이 필요합니다…')
      try {
        await reauthenticate()
      } catch (err) {
        const code = (err as { code?: string }).code ?? ''
        setStatus('')
        return setError(
          code.includes('popup-blocked')
            ? '재인증 창이 브라우저에 막혔습니다. 주소창의 팝업 차단을 해제하고 다시 시도하세요.'
            : `재인증에 실패해 저장하지 못했습니다 — ${(err as Error).message}`,
        )
      }
    }

    setStatus('저장 중…')
    try {
      const savedId = await savePost(id ?? null, {
        title, body, published: nextPublished, tags, wasPublished: published,
      })
      setPublished(nextPublished)
      setDirty(false)
      localStorage.removeItem(draftKey(id))

      // 발행했으면 결과를 바로 확인하는 게 자연스럽다. 임시저장은 계속 쓰는 중이므로 남는다.
      if (nextPublished) return navigate(`/posts/${savedId}`)

      setStatus(`임시저장했습니다 · ${new Date().toLocaleTimeString('ko-KR')}`)
      if (!id) navigate(`/admin/edit/${savedId}`, { replace: true })
    } catch (err) {
      setStatus('')
      setError(`저장하지 못했습니다 — ${(err as Error).message}`)
    }
  }

  async function handleDelete() {
    if (!id) return
    setError('')
    if (settings.postingLocked) return setError('보안 설정에서 글쓰기가 잠겨 있습니다.')

    if (needsReauth(settings)) {
      try {
        await reauthenticate()
      } catch (err) {
        return setError(`재인증에 실패해 삭제하지 못했습니다 — ${(err as Error).message}`)
      }
    }

    setStatus('삭제 중…')
    try {
      await deletePost(id, title)
      localStorage.removeItem(draftKey(id))
      navigate('/admin')
    } catch (err) {
      setStatus('')
      setError(`삭제하지 못했습니다 — ${(err as Error).message}`)
    }
  }

  /** 이미지를 R2 에 올리고 커서 위치에 마크다운을 끼워 넣는다 */
  async function insertImage(file: File) {
    if (!settings.allowImageUpload) return setStatus('보안 설정에서 이미지 업로드가 꺼져 있습니다.')
    setStatus('이미지 업로드 중…')
    try {
      const url = await uploadImage(file)
      edit((s) => insertBlock(s, `![${file.name}](${url})`))
      setStatus('이미지를 넣었습니다.')
      logAudit('image.upload', url, `${file.name} · ${Math.round(file.size / 1024)}KB`)
    } catch (err) {
      setStatus((err as Error).message)
    }
  }

  if (!loaded) return <p className="text-sm text-[var(--muted)]">불러오는 중…</p>

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/60 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-500"
        >
          {error}
        </p>
      )}

      {settings.postingLocked && (
        <p className="rounded-xl border border-red-400/50 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-500">
          보안 설정에서 글쓰기가 잠겨 있습니다. 저장·삭제가 차단됩니다.
        </p>
      )}

      <input
        value={title}
        onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
        placeholder="제목"
        className="w-full bg-transparent pb-2 text-3xl font-semibold tracking-[-0.03em] outline-none placeholder:text-[var(--muted)]"
      />

      <div>
        <EditorToolbar onCommand={runCommand} onImage={() => fileRef.current?.click()} />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) insertImage(f)
            e.target.value = ''
          }}
        />

        <div className={`grid ${preview ? 'lg:grid-cols-2' : ''}`}>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => { setBody(e.target.value); setDirty(true) }}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              const file = [...e.clipboardData.files][0]
              if (file?.type.startsWith('image/')) { e.preventDefault(); insertImage(file) }
            }}
            onDrop={(e) => {
              const file = [...e.dataTransfer.files][0]
              if (file?.type.startsWith('image/')) { e.preventDefault(); insertImage(file) }
            }}
            placeholder="마크다운으로 자유롭게 쓰세요. 이미지는 붙여넣거나 끌어다 놓으면 됩니다."
            className={`min-h-[55vh] w-full resize-y border border-[var(--line)] bg-transparent p-4 font-mono text-sm leading-relaxed outline-none focus:border-[var(--accent)] ${
              preview ? 'rounded-bl-xl lg:border-r-0' : 'rounded-b-xl'
            }`}
          />

          {preview && (
            <div className="prose max-h-[70vh] overflow-y-auto rounded-br-xl border border-[var(--line)] bg-[var(--bg-elev)] p-6 text-[15px]">
              {body.trim() ? (
                <div dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <p className="text-sm text-[var(--muted)]">미리보기</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="transition-colors hover:text-[var(--ink)]"
          >
            미리보기 {preview ? '끄기' : '켜기'}
          </button>
          <span className="font-mono tabular-nums">{stats.chars}자</span>
          <span className="font-mono tabular-nums">{stats.words}단어</span>
          <span>약 {stats.minutes}분</span>
          {dirty && <span className="text-[var(--accent)]">저장 안 됨</span>}
        </div>
      </div>

      <section className="rounded-xl border border-[var(--line)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">태그</h2>
          <span className="text-xs text-[var(--muted)]">
            본문 분석 결과 · 최대 {MAX_TAGS}개 · 눌러서 바꿉니다
          </span>
          {touched && (
            <button
              type="button"
              onClick={() => { setTouched(false); setPicked([]) }}
              className="ml-auto rounded-md border border-[var(--line)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              분석 결과로 되돌리기
            </button>
          )}
        </div>

        {candidates.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">본문이 짧아 아직 분석할 내용이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {candidates.map((c) => {
              const on = tags.includes(c.tag)
              return (
                <li key={c.tag}>
                  <button
                    type="button"
                    onClick={() => toggle(c.tag)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                      on ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--bg-elev)]'
                    }`}
                  >
                    <span
                      className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        on
                          ? 'border-transparent bg-[var(--accent)] text-[var(--accent-ink)]'
                          : 'border-[var(--line)] text-[var(--muted)]'
                      }`}
                    >
                      {c.tag}
                    </span>
                    <span className="flex-1 truncate text-xs text-[var(--muted)]">{c.reason}</span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--muted)]">
                      {c.score.toFixed(1)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-[var(--line)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">SEO / GEO</h2>
          <span className="text-xs text-[var(--muted)]">
            FAQ {audit.faq} · 인용 {audit.citations} · 키워드 {audit.keywords}
          </span>
          <span
            className={`ml-auto rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
              audit.score >= 80
                ? 'bg-emerald-500/15 text-emerald-600'
                : audit.score >= 50
                  ? 'bg-amber-500/15 text-amber-600'
                  : 'bg-red-500/15 text-red-600'
            }`}
          >
            {audit.score}
          </span>
        </div>

        {audit.issues.length === 0 ? (
          <p className="mt-2 text-xs text-emerald-600">모든 항목을 충족합니다.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {audit.issues.map((i) => (
              <li key={i.field} className="flex flex-wrap items-baseline gap-2 text-[11px]">
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    AREA_TONE[i.area]
                  }`}
                >
                  {i.area}
                </span>
                <code className="shrink-0 font-mono text-[10px] text-[var(--muted)]">{i.field}</code>
                <span>— {i.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t border-[var(--line)] bg-[var(--bg)]/85 px-1 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={!title.trim() || settings.postingLocked}
          className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-[var(--accent-ink)] transition-opacity disabled:opacity-40"
        >
          {published ? '발행 상태로 저장' : '발행'}
        </button>
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={settings.postingLocked}
          className="rounded-md border border-[var(--line)] px-4 py-2 text-sm transition-colors hover:border-[var(--ink)] disabled:opacity-40"
        >
          임시저장
        </button>
        {id &&
          (confirmDelete ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-[var(--muted)]">정말 삭제할까요?</span>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-md bg-red-500 px-3 py-1 text-xs font-medium text-white"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-[var(--line)] px-3 py-1 text-xs"
              >
                취소
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-red-500"
            >
              삭제
            </button>
          ))}
        <span className="text-xs text-[var(--muted)]">{status}</span>
      </div>
    </div>
  )
}
