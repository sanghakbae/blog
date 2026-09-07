const CACHE_VERSION = 'tag-blog-v10'

/**
 * 캐시를 찾을 때 Vary 를 보지 않는다.
 *
 * 서버가 자산에 `Vary: Origin` 을 붙인다. 사전 캐시는 서비스 워커가 담으므로
 * Origin 헤더가 없는 요청으로 저장되는데, 화면이 그 자산을 불러올 때는
 * (Vite 가 모듈 스크립트에 crossorigin 을 붙여서) Origin 헤더가 붙는다.
 * 그러면 같은 주소인데도 Vary 가 어긋나 캐시에 없는 것으로 취급되고,
 * 오프라인에서는 그대로 실패해 빈 화면이 나왔다.
 * 한 오리진짜리 사이트라서 Origin 으로 응답이 갈릴 일이 없다.
 */
const MATCH = { ignoreVary: true }
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/posts-list.json',
  '/posts.json',
  // 빌드된 js·css 는 이름에 해시가 붙어 여기 적을 수 없다.
  // scripts/precache.mts 가 빌드 후 실제 이름을 이 자리에 채운다.
  // BUILD_ASSETS
]

self.addEventListener('install', (event) => {
  // addAll 은 하나라도 실패하면 전체가 실패한다. 그러면 설치가 끝나지 않아
  // 서비스 워커가 아예 붙지 않는다 — 스냅샷 파일 하나가 없다고 오프라인 지원
  // 전체를 잃을 이유는 없으므로 하나씩 담고 실패한 것만 넘긴다.
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        APP_SHELL.map((path) =>
          cache.add(path).catch(() => {
            /* 없는 파일은 건너뛴다 */
          }),
        ),
      ),
    ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // ok 인지 보지 않으면 404 나 오류 페이지가 캐시에 들어앉아,
          // 다음에 오프라인일 때 그 오류 페이지가 사본으로 나온다.
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => {
          return (await caches.match(request, MATCH)) || (await caches.match('/', MATCH))
        }),
    )
    return
  }

  // 내용이 바뀌는 것과 바뀌지 않는 것을 나눈다.
  // 파일 이름에 해시가 붙은 자산은 내용이 고정되므로 캐시를 먼저 써도 된다.
  // 글 목록 스냅샷은 배포마다 바뀌므로 캐시를 먼저 쓰면 옛 글 수가 계속 보인다.
  const immutable = /\/assets\/.*-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(url.pathname)

  if (immutable) {
    event.respondWith(
      caches.match(request, MATCH).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
    return
  }

  // 오프라인에 대비해 사본을 둘 만한 것만 저장한다.
  // 200 이면 무엇이든 저장하면, SPA 라 아무 주소나 셸을 200 으로 돌려주는 탓에
  // 방문하지도 않은 잘못된 주소까지 캐시에 쌓인다.
  const worthCaching =
    APP_SHELL.includes(url.pathname) ||
    /\.(svg|png|jpg|jpeg|webp|avif|ico|woff2?|css|js)$/.test(url.pathname)

  // 네트워크를 먼저 쓰고, 실패했을 때만 캐시로 돌아간다.
  // 캐시에도 없으면 respondWith 에 undefined 가 들어가 TypeError 로 터지므로
  // 응답을 하나 만들어 돌려준다.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && worthCaching) {
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request, MATCH)
        return (
          cached ||
          new Response('오프라인이고 저장된 사본이 없습니다.', {
            status: 504,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        )
      }),
  )
})

// 새 버전을 기다리는 상태에서 화면이 적용을 요청하면 즉시 넘어간다
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
