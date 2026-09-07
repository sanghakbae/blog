/**
 * 서비스 워커 등록과 새 버전 안내.
 *
 * 등록만 해 두면, 이미 앱을 띄워 둔 사람은 새 버전이 배포돼도 옛 화면을 계속
 * 본다. 설치해 쓰는 경우에는 앱을 완전히 닫을 때까지 그 상태가 이어진다.
 * 그래서 새 버전이 준비되면 알리고, 누르면 그때 적용한다 — 보고 있는 화면이
 * 예고 없이 새로고침되지 않게 하려고 적용 시점을 사용자에게 맡긴다.
 */
const BANNER_ID = 'sw-update-banner'

function showUpdateBanner(onApply: () => void) {
  if (document.getElementById(BANNER_ID)) return

  const bar = document.createElement('div')
  bar.id = BANNER_ID
  bar.setAttribute('role', 'status')
  bar.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:16px',
    'transform:translateX(-50%)',
    'z-index:9999',
    'display:flex',
    'align-items:center',
    'gap:10px',
    'max-width:calc(100vw - 24px)',
    'padding:10px 12px',
    'border-radius:12px',
    'border:1px solid var(--line)',
    'background:var(--bg-elev)',
    'color:var(--ink)',
    'box-shadow:0 8px 24px rgb(0 0 0 / 18%)',
    'font-size:13px',
  ].join(';')

  const text = document.createElement('span')
  text.textContent = '새 버전이 있습니다'

  const apply = document.createElement('button')
  apply.type = 'button'
  apply.textContent = '새로고침'
  apply.style.cssText = [
    'padding:5px 10px',
    'border-radius:8px',
    'border:0',
    'background:var(--accent)',
    'color:var(--accent-ink)',
    'font-size:12px',
    'font-weight:600',
    'cursor:pointer',
  ].join(';')
  apply.addEventListener('click', () => {
    apply.disabled = true
    apply.textContent = '적용 중…'
    onApply()
  })

  const close = document.createElement('button')
  close.type = 'button'
  close.setAttribute('aria-label', '닫기')
  close.textContent = '✕'
  close.style.cssText = [
    'padding:2px 4px',
    'border:0',
    'background:transparent',
    'color:var(--muted)',
    'font-size:12px',
    'cursor:pointer',
  ].join(';')
  close.addEventListener('click', () => bar.remove())

  bar.append(text, apply, close)
  document.body.appendChild(bar)
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // 새 워커가 대기 상태가 되면 알린다.
        const notify = (worker: ServiceWorker) =>
          showUpdateBanner(() => worker.postMessage('SKIP_WAITING'))

        if (registration.waiting && navigator.serviceWorker.controller) {
          notify(registration.waiting)
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            // controller 가 없으면 첫 설치다. 그때는 알릴 것이 없다.
            if (installing.state === 'installed' && navigator.serviceWorker.controller)
              notify(installing)
          })
        })

        // 적용이 끝나면 한 번만 새로고침한다.
        let reloading = false
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloading) return
          reloading = true
          window.location.reload()
        })

        // 오래 열어 둔 화면도 새 배포를 알아채도록 주기적으로 확인한다.
        const HOUR = 60 * 60 * 1000
        setInterval(() => void registration.update(), HOUR)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registration.update()
        })
      })
      .catch((error: unknown) => {
        console.error('서비스 워커 등록에 실패했습니다.', error)
      })
  })
}
