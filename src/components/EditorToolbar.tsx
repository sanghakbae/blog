type Props = {
  onCommand: (cmd: string) => void
  onImage: () => void
  disabled?: boolean
}

const GROUPS: { cmd: string; label: string; title: string }[][] = [
  [
    { cmd: 'h2', label: 'H2', title: '소제목 (⌘⌥2)' },
    { cmd: 'h3', label: 'H3', title: '작은 제목 (⌘⌥3)' },
  ],
  [
    { cmd: 'bold', label: 'B', title: '굵게 (⌘B)' },
    { cmd: 'italic', label: 'I', title: '기울임 (⌘I)' },
    { cmd: 'strike', label: 'S', title: '취소선' },
    { cmd: 'code', label: '‹›', title: '인라인 코드' },
  ],
  [
    { cmd: 'ul', label: '••', title: '글머리 목록' },
    { cmd: 'ol', label: '1.', title: '번호 목록' },
    { cmd: 'quote', label: '❝', title: '인용' },
    { cmd: 'task', label: '☑', title: '체크리스트' },
  ],
  [
    { cmd: 'link', label: '🔗', title: '링크 (⌘K)' },
    { cmd: 'image', label: '🖼', title: '이미지 업로드' },
    { cmd: 'codeblock', label: '{ }', title: '코드 블록' },
    { cmd: 'table', label: '▦', title: '표' },
    { cmd: 'hr', label: '—', title: '구분선' },
  ],
]

export default function EditorToolbar({ onCommand, onImage, disabled }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-[var(--line)] bg-[var(--bg-elev)] px-1.5 py-1 sm:px-2 sm:py-1.5">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <span className="mx-1 h-4 w-px bg-[var(--line)]" />}
          {group.map((b) => (
            <button
              key={b.cmd}
              type="button"
              title={b.title}
              disabled={disabled}
              onClick={() => (b.cmd === 'image' ? onImage() : onCommand(b.cmd))}
              className={`grid h-6 min-w-6 place-items-center rounded-md px-1 text-[11px] transition-colors sm:h-7 sm:min-w-7 sm:px-1.5 sm:text-xs hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:opacity-40 ${
                b.cmd === 'bold' ? 'font-bold' : b.cmd === 'italic' ? 'font-serif italic' : ''
              } ${b.cmd === 'strike' ? 'line-through' : ''}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
