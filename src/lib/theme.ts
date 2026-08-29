/**
 * 화면 테마. 기본값은 시스템 설정을 따르고, 사용자가 고르면 그 선택을 기억한다.
 * 루트 요소의 data-theme 로 index.css 의 토큰을 덮어쓴다.
 */
export type Theme = 'system' | 'light' | 'dark'

const KEY = 'theme'

export function getTheme(): Theme {
  const saved = localStorage.getItem(KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
    localStorage.removeItem(KEY)
  } else {
    root.setAttribute('data-theme', theme)
    localStorage.setItem(KEY, theme)
  }
}

/** 첫 화면이 그려지기 전에 적용해 깜빡임을 막는다 */
export function initTheme(): void {
  const theme = getTheme()
  if (theme !== 'system') document.documentElement.setAttribute('data-theme', theme)
}
