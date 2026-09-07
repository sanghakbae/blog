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

/** 사용자가 적용을 눌렀을 때만, 그리고 한 번만 새로고침한다 */
let applied = false

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  // 새로고침은 사용자가 배너를 눌렀을 때만 한다.
  //
  // 처음에는 "페이지를 열 때 controller 가 있었는가" 로 판단했는데 틀렸다.
  // 첫 방문에서 워커를 설치한 탭은 그 값이 false 라서, 그 탭에서 새 버전을
  // 적용하면 배너가 "적용 중…" 에서 멈춘 채 화면이 바뀌지 않았다.
  // 새로고침해야 하는 시점은 controller 의 과거가 아니라 사용자의 요청이다.
  let applying = false
  const reload = () => {
    if (!applying || applied) return
    applied = true
    window.location.reload()
  }

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // 새 워커가 대기 상태가 되면 알린다.
        const notify = (worker: ServiceWorker) =>
          showUpdateBanner(() => {
            applying = true
            worker.postMessage('SKIP_WAITING')
            // controllerchange 가 오지 않는 경우에도 화면은 넘어가야 한다.
            worker.addEventListener('statechange', () => {
              if (worker.state === 'activated') reload()
            })
          })

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

        navigator.serviceWorker.addEventListener('controllerchange', () => reload())

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
