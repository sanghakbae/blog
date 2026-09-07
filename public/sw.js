const CACHE_VERSION = 'tag-blog-v8'
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
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)),
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
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(async () => {
          return (await caches.match(request)) || (await caches.match('/'))
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
      caches.match(request).then(
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

  // 그 밖의 것은 네트워크를 먼저 쓰고, 실패했을 때만 캐시로 돌아간다.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request)),
  )
})

// 새 버전을 기다리는 상태에서 화면이 적용을 요청하면 즉시 넘어간다
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
