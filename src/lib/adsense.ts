/**
 * 애드센스 스크립트 로더.
 *
 * 광고 단위(슬롯)가 아직 없어도 스크립트는 실려야 한다. 심사는 사이트에 그
 * 스크립트가 있는지를 보고, 승인 전에는 슬롯 ID 자체가 발급되지 않는다.
 * 그래서 게시자 ID 만 있으면 부른다.
 *
 * 한 번만 받는다. 자리마다 받으면 요청만 쌓인다. 실패해도 조용히 넘긴다 —
 * 광고가 없는 것이 오류보다 낫다.
 */
export const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT ?? ''
export const ADSENSE_SLOT = import.meta.env.VITE_ADSENSE_SLOT ?? ''

const SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

let loading: Promise<void> | null = null

export function loadAdSense(): Promise<void> {
  if (!ADSENSE_CLIENT) return Promise.resolve()
  if (loading) return loading
  loading = new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = `${SRC}?client=${encodeURIComponent(ADSENSE_CLIENT)}`
    s.async = true
    s.crossOrigin = 'anonymous'
    s.onload = () => resolve()
    s.onerror = () => resolve()
    document.head.appendChild(s)
  })
  return loading
}
