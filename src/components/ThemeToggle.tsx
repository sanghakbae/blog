import { useState } from 'react'
import { applyTheme, getTheme, type Theme } from '../lib/theme'

const ORDER: Theme[] = ['system', 'light', 'dark']
const LABEL: Record<Theme, string> = { system: '시스템', light: '밝게', dark: '어둡게' }
const ICON: Record<Theme, string> = { system: '◐', light: '☀', dark: '☾' }

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getTheme)

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]
    applyTheme(next)
    setTheme(next)
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={`화면 테마: ${LABEL[theme]}`}
      aria-label={`화면 테마 ${LABEL[theme]}, 눌러서 변경`}
      className="grid size-7 place-items-center rounded-md text-sm text-[var(--muted)] transition-colors hover:bg-[var(--bg-elev)] hover:text-[var(--ink)]"
    >
      {ICON[theme]}
    </button>
  )
}
