import type { SeedPost } from './types'

/** 291~300 — 브라우저 저장·격리와 모바일 앱 */
export const posts30: SeedPost[] = [
  {
    slug: 'service-worker-risk',
    title: '서비스 워커가 만드는 보안 문제',
    body: `서비스 워커는 그 출처의 모든 요청을 가로챌 수 있고, 페이지를 닫아도 살아 있고, 한 번 등록되면 스스로 갱신된다. 오프라인 지원을 위한 기능이지만 권한 관점에서 보면 출처 안에서 가장 강한 코드다. 그래서 스크립트 삽입 취약점의 피해가 서비스 워커에 닿는 순간 성격이 달라진다 — 일회성 공격이 지속적인 것으로 바뀐다.

## 왜 피해가 오래 남는가?

| 특성 | 결과 |
| --- | --- |
| 요청 가로채기 | 응답을 바꿔 보여줄 수 있다 |
| 페이지와 독립된 수명 | 탭을 닫아도 동작 |
| 캐시 저장소 접근 | 응답 사본을 남긴다 |
| 자체 갱신 | 공격자 코드가 스스로 유지 |
| 푸시 수신 | 외부 신호로 동작 가능 |

취약점을 고쳐도 이미 등록된 악성 워커는 남는다. 그래서 대응 절차에 워커 무효화를 넣어야 한다.

![삽입에서 지속성 확보까지](/img/posts/service-worker-risk.svg)

## 보안 헤더로 등록 자체를 통제한다

콘텐츠 보안 정책으로 워커 스크립트의 출처를 제한한다. 그리고 워커 파일에는 캐시 헤더를 짧게 두어 갱신이 막히지 않게 한다.

\`\`\`
Content-Security-Policy: worker-src 'self'; script-src 'self' 'nonce-...'
Service-Worker-Allowed 헤더는 필요할 때만
sw.js 응답:  Cache-Control: no-cache      # 갱신 차단 방지
범위:        필요한 경로로 한정, 루트 등록은 신중히
\`\`\`

워커 파일 자체가 오래 캐시되면 잘못된 워커를 되돌리기 어려워진다. 이 헤더 하나가 사고 대응 가능성을 좌우한다.

![등록과 갱신 통제](/img/posts/service-worker-risk-2.svg)

## 워커 코드에서 조심할 것

응답을 캐시할 때 인증된 응답을 넣으면, 로그아웃한 뒤에도 앞 사용자의 내용이 보인다. 그리고 아무 200 응답이나 저장하면 캐시가 무한히 늘어난다.

\`\`\`js
// 인증된 응답과 오류 응답은 캐시에 넣지 않는다
if (response.ok && !response.headers.get('Cache-Control')?.includes('private')) {
  const path = new URL(request.url).pathname
  if (CACHEABLE.test(path)) cache.put(request, response.clone())
}
// 캐시 조회 시 Vary 처리 — 서버가 Vary 를 붙이면 같은 주소인데도 못 찾을 수 있다
const hit = await caches.match(request, { ignoreVary: true })
\`\`\`

## 사고 시 어떻게 무효화하는가

워커를 지우는 코드를 담은 새 워커를 배포하는 것이 유일한 방법이다. 사용자가 접속하면 새 워커가 설치되고 스스로 등록을 해제한다.

\`\`\`js
// 무효화용 워커 — 캐시를 지우고 등록을 해제한 뒤 클라이언트를 새로 고친다
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k)
  await self.registration.unregister()
  for (const c of await self.clients.matchAll()) c.navigate(c.url)
})()))
\`\`\`

이 파일을 미리 준비해 두면 사고 시 판단할 일이 줄어든다. 절차서에 배포 경로를 함께 적어 둔다.

## 실제로 이렇게 터진다

배포 후에도 옛 버전이 계속 뜬 사례가 있다. 캐시 우선 전략을 문서에도 적용했고, 갱신 로직이 없었다. 보안 패치를 배포했지만 사용자에게 닿지 않았다.

또 하나는 등록 범위를 최상위로 두고 응답을 무조건 캐시한 경우다. 인증된 응답이 캐시에 남아 다음 사용자에게 보였다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 배포하면 갱신된다 | 옛 워커가 계속 산다 |
| 전부 캐시하면 빠르다 | 인증 응답까지 남는다 |
| 오프라인 지원이 목적이다 | 갱신 전략이 더 중요하다 |
| 문제 생기면 지우면 된다 | 사용자 브라우저에 남아 있다 |
| 범위는 넓을수록 좋다 | 의도치 않은 요청까지 가로챈다 |

## 무엇을 캐시하나

| 대상 | 전략 |
| --- | --- |
| 해시가 붙은 정적 자산 | 캐시 우선 |
| HTML 문서 | 네트워크 우선 |
| API 응답 | 원칙적으로 안 함 |
| 인증된 응답 | 절대 안 함 |
| 이미지·폰트 | 캐시 우선, 만료 |

인증 응답을 캐시하면 공용 단말에서 다음 사용자에게 노출된다. 응답 헤더를 보고 판단하는 로직을 넣는다.

## 갱신 전략

1. 새 워커가 설치되면 사용자에게 알린다
2. 사용자가 동의하면 대기 중인 워커를 활성화한다
3. 제어권이 바뀌면 페이지를 새로 고친다
4. 강제 갱신이 필요한 경우를 위해 원격 스위치를 둔다

자동으로 새로 고치면 작업 중이던 내용이 사라진다. 알리고 사용자가 선택하게 한다.

## 비상 해제 수단

문제가 생겼을 때 되돌릴 방법이 없으면 곤란하다.

\`\`\`javascript
// 비상시: 모든 캐시를 비우고 등록을 해제하는 워커를 배포한다
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', async () => {
  const keys = await caches.keys()
  await Promise.all(keys.map((k) => caches.delete(k)))
  await self.registration.unregister()
  const clients = await self.clients.matchAll()
  clients.forEach((c) => c.navigate(c.url))
})
\`\`\`

이 코드를 미리 준비해 두면 사고 시 몇 분 안에 되돌릴 수 있다.

## 점검

| 항목 | 확인 |
| --- | --- |
| 등록 범위 | 필요한 경로만 |
| 캐시 정책 | 인증 응답 제외 |
| 캐시 이름 버전 | 배포마다 변경 |
| 옛 캐시 삭제 | 활성화 시 |
| 갱신 알림 | 동작하는가 |
| 비상 해제 | 준비돼 있는가 |

## 참고

- W3C — Service Workers 명세, 보안 고려 사항
- OWASP — Content Security Policy Cheat Sheet
- MITRE ATT&CK — T1176 Browser Extensions·지속성 관점 참고`,
    diagram: {
      type: 'steps',
      caption: '지속성 확보',
      steps: [
        { label: '스크립트 삽입', note: '일회성 취약점' },
        { label: '워커 등록', note: '출처 전체 범위' },
        { label: '요청 가로채기', note: '응답 변조' },
        { label: '취약점 수정 후에도 유지', note: '무효화 필요' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '캐시 정책',
      x: ['공개 응답만', '전부 저장'],
      y: ['짧은 워커 캐시', '긴 워커 캐시'],
      cells: ['안전', '사용자 간 노출', '되돌리기 어려움', '사고 대응 불가'],
    },
  },
  {
    slug: 'cache-authenticated-response',
    title: '인증된 응답이 캐시에 남는 문제',
    body: `공용 캐시에 개인화된 응답이 저장되면, 다음 사람이 그 응답을 받는다. 이름과 주문 내역이 다른 사용자에게 보이는 사고가 대표적이다. 원인은 대개 한 줄이다 — 응답에 캐시 관련 헤더를 지정하지 않았고, 중간 계층이 기본 규칙으로 저장한 것이다.

## 어디에 저장되는가?

| 계층 | 저장 조건 |
| --- | --- |
| 브라우저 캐시 | 사용자별이지만 로그아웃 후에도 남는다 |
| CDN·리버스 프록시 | 헤더가 없으면 저장하는 구성도 있다 |
| 애플리케이션 캐시 | 키에 사용자가 빠지면 섞인다 |
| 검색 색인 | 크롤러가 인증 없이 받은 응답 |

애플리케이션 캐시의 키 설계가 특히 흔한 원인이다. 주소만 키로 쓰면 사용자가 달라도 같은 항목이 된다.

![캐시 계층과 노출 지점](/img/posts/cache-authenticated-response.svg)

## 보안 헤더를 어떻게 지정하는가

개인화된 응답에는 private 을 명시한다. no-store 는 브라우저에도 저장하지 않으므로 되돌아가기 동작이 불편해질 수 있어, 성격에 따라 나눈다.

\`\`\`
개인화 응답        Cache-Control: private, no-cache, must-revalidate
민감 데이터        Cache-Control: no-store
공개 정적 자산     Cache-Control: public, max-age=31536000, immutable
조건이 갈리는 응답 Vary: Authorization, Cookie
\`\`\`

Vary 를 쓸 때는 주의가 필요하다. 캐시 적중률이 떨어지고, 서비스 워커의 캐시 조회에서도 같은 주소를 못 찾는 문제가 생긴다.

![헤더 선택 기준](/img/posts/cache-authenticated-response-2.svg)

## 캐시 키에 주체를 넣는다

애플리케이션 캐시에서는 키 설계가 곧 인가 경계다. 사용자별 데이터를 담는 키에는 주체 식별자를 반드시 포함한다.

\`\`\`ts
// 나쁜 예 — 주소만 키로 쓴다
const key = \`page:\${req.path}\`

// 나은 예 — 주체와 권한 범위가 키에 들어간다
const key = \`page:\${req.path}:u=\${actor.id}:scope=\${actor.tenantId}\`

// 공용으로 둘 수 있는 것은 애초에 개인화하지 않는다
const publicKey = \`catalog:\${lang}:\${page}\`
\`\`\`

## 실제로 저장되는지 어떻게 확인하는가

응답 헤더와 캐시 적중 여부를 함께 본다. 로그인 상태와 비로그인 상태에서 같은 주소를 요청해 결과를 비교하는 것이 가장 확실한 시험이다.

\`\`\`bash
# 인증된 응답에 캐시 헤더가 붙는지
curl -sD - -o /dev/null https://stg.example.com/my/orders \\
  -H "Cookie: session=$SESSION" |
  grep -iE 'cache-control|vary|age|x-cache|cf-cache-status'

# 같은 주소를 비로그인으로 요청했을 때 남의 내용이 오는지
curl -s https://stg.example.com/my/orders | head -c 300

# 캐시된 응답인지 — age 가 0 보다 크면 저장되어 있다는 뜻
curl -sD - -o /dev/null https://stg.example.com/my/orders | grep -i '^age:'
\`\`\`

## 점검 목록에 넣을 것

인증이 필요한 경로 전체를 뽑아, 각 응답의 캐시 헤더를 표로 만들어 두면 누락이 드러난다. 그리고 새 경로가 추가될 때 기본값이 private 이 되도록 프레임워크 수준에서 설정하는 것이 반복 실수를 막는 방법이다.

## 실제로 이렇게 터진다

CDN 이 로그인한 사용자의 페이지를 캐시한 사례가 있다. 응답에 캐시 금지 헤더가 없었고, 다음 방문자에게 앞 사용자의 이름과 주문 내역이 보였다.

또 하나는 헤더는 있었지만 쿼리 파라미터만 다른 요청을 같은 것으로 본 경우다. 캐시 키에 인증 정보가 반영되지 않았다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 쿠키가 있으면 캐시 안 한다 | 설정에 따라 다르다 |
| 기본 설정이 안전하다 | 캐시 계층마다 다르다 |
| HTTPS 면 캐시되지 않는다 | 중간 캐시는 없어도 CDN 은 있다 |
| 헤더 하나면 충분하다 | 계층마다 해석이 다르다 |
| 개인화 페이지는 드물다 | 대부분의 서비스에 있다 |

## 어디에 캐시가 있나

| 계층 | 통제 |
| --- | --- |
| 브라우저 | 응답 헤더 |
| 서비스 워커 | 코드 |
| CDN | 헤더 + 설정 |
| 역방향 프록시 | 설정 |
| 애플리케이션 캐시 | 코드 |

한 계층만 막아도 다른 계층에서 남는다. 전 계층을 확인해야 한다.

## 인증 응답에 붙일 헤더

\`\`\`
Cache-Control: private, no-store
Vary: Cookie, Authorization
\`\`\`

no-store 가 가장 확실하다. private 만으로는 브라우저 캐시에 남는다. 공용 단말에서 뒤로 가기로 볼 수 있다.

## 캐시 키 설계

공개 응답을 캐시할 때도 키가 중요하다.

| 요소 | 포함 여부 |
| --- | --- |
| 경로 | 항상 |
| 의미 있는 쿼리 | 포함 |
| 추적용 쿼리 | 제외 — 캐시 적중률 저하 |
| 인증 쿠키 | 인증 응답이면 포함 |
| 언어·지역 헤더 | 응답이 달라지면 포함 |

응답이 달라지는 요소가 키에 없으면 잘못된 응답이 나간다. 반대로 불필요한 요소가 들어가면 캐시가 무의미해진다.

## 점검

\`\`\`bash
# 인증 상태로 요청했을 때 캐시 관련 헤더 확인
curl -sI -H "Cookie: session=..." https://example.com/mypage \
  | grep -iE 'cache-control|vary|age|x-cache'
\`\`\`

Age 헤더가 0 보다 크면 캐시에서 나온 응답이다. 인증 페이지에서 이 값이 보이면 즉시 조치 대상이다.

## 설계 원칙

개인화된 부분과 공통 부분을 분리한다. 공통 껍데기는 캐시하고 개인 정보는 별도 요청으로 가져오면, 캐시 효율과 안전을 함께 얻는다.

## 참고

- RFC 9111 — HTTP Caching, private 지시어
- OWASP — Web Security Testing Guide, 캐시 관련 시험
- CWE-524 Use of Cache Containing Sensitive Information`,
    diagram: {
      type: 'layers',
      caption: '저장 계층',
      layers: [
        { label: '브라우저', note: '로그아웃 후 잔존' },
        { label: 'CDN·프록시', note: '사용자 간 노출' },
        { label: '애플리케이션 캐시', note: '키 설계가 인가 경계' },
        { label: '검색 색인', note: '외부 공개' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '헤더와 결과',
      x: ['private 명시', '헤더 없음'],
      y: ['키에 주체 포함', '주소만 키'],
      cells: ['안전', '중간 계층 노출', '사용자 간 혼선', '전면 노출'],
    },
  },
  {
    slug: 'browser-storage-tokens',
    title: '브라우저 저장소와 토큰 보관 선택',
    body: `접근 토큰을 어디에 둘지는 프런트엔드에서 가장 자주 논쟁이 되는 주제다. 정답은 "완벽한 자리는 없다"이고, 무엇을 포기할지 정하는 문제다. 스크립트 삽입에 강하게 만들면 요청 위조에 대비해야 하고, 반대도 성립한다. 위협의 우선순위를 정하고 그에 맞는 조합을 고르는 것이 실무적이다.

## 저장 위치별로 무엇에 약한가?

| 위치 | 스크립트 삽입 | 요청 위조 | 특징 |
| --- | --- | --- | --- |
| localStorage | 취약 — 즉시 탈취 | 안전 | 새로고침에도 유지 |
| sessionStorage | 취약 | 안전 | 탭 단위 |
| 일반 쿠키 | 취약 | 취약 | 자동 전송 |
| HttpOnly 쿠키 | 안전 — 읽을 수 없다 | 취약 | SameSite 필요 |
| 메모리 변수 | 상대적으로 안전 | 안전 | 새로고침에 사라짐 |

![저장 위치와 위협의 대응](/img/posts/browser-storage-tokens.svg)

## 세션 관리에 쓰이는 조합

접근 토큰은 메모리에, 갱신 토큰은 HttpOnly 쿠키에 두는 구성이 균형이 좋다. 스크립트가 삽입돼도 갱신 토큰은 읽히지 않고, 새로고침 시에는 쿠키로 접근 토큰을 다시 받는다.

\`\`\`
접근 토큰   메모리 변수, 수명 5~15분
갱신 토큰   HttpOnly + Secure + SameSite=Strict 쿠키, 경로 한정
갱신 요청   전용 엔드포인트, 회전 발급(사용 시 새 토큰 발급 + 이전 무효화)
로그아웃    서버에서 갱신 토큰 폐기, 쿠키 삭제
\`\`\`

갱신 토큰 회전이 중요하다. 회전을 쓰면 탈취된 토큰이 한 번 쓰인 뒤 무효가 되고, 재사용 시도가 탐지 신호가 된다.

![토큰 수명과 갱신](/img/posts/browser-storage-tokens-2.svg)

## 무엇을 저장소에 두면 안 되는가

토큰 외에도 저장소에 들어가는 것이 많다. 개인정보를 캐시 목적으로 넣어 두면 그 장치를 쓰는 다른 사람이 볼 수 있다.

| 넣지 말 것 | 이유 |
| --- | --- |
| 개인정보 사본 | 장치 공유 시 노출, 지워지지 않음 |
| 권한 정보 | 변조해 화면 우회 |
| 다른 사용자 데이터 | 계정 전환 시 잔존 |
| 비밀 키 | 클라이언트에 비밀은 없다 |

권한 정보를 저장해 화면 표시를 결정하는 것은 편의상 흔하지만, 서버가 같은 판정을 다시 해야 한다. 클라이언트 값은 표시용이지 인가 근거가 아니다.

## 어떻게 점검하는가

\`\`\`js
// 콘솔에서 저장소 내용을 훑는다 — 토큰·개인정보가 있는지
Object.entries(localStorage).forEach(([k, v]) => {
  if (/token|jwt|auth|email|phone|name|card/i.test(k + v)) console.log(k, v.slice(0, 60))
})
// 쿠키 속성 확인 — HttpOnly 쿠키는 여기 보이지 않아야 정상이다
document.cookie
\`\`\`

\`\`\`bash
# 서버가 내려주는 쿠키 속성
curl -sD - -o /dev/null -X POST https://stg.example.com/api/login \\
  -H 'Content-Type: application/json' -d '{"id":"t","pw":"t"}' |
  grep -i 'set-cookie'
# HttpOnly; Secure; SameSite 가 모두 붙어 있는지 본다
\`\`\`

## 실제로 이렇게 터진다

액세스 토큰을 로컬 저장소에 둔 사례가 있다. 서드파티 스크립트에 취약점이 생기자 토큰이 그대로 나갔다. 저장소는 같은 출처의 모든 스크립트가 읽을 수 있다.

또 하나는 쿠키를 쓰면서 스크립트 접근 차단 속성을 빼먹은 경우다. 결과적으로 로컬 저장소와 다를 바 없었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 로컬 저장소가 편하다 | 스크립트가 전부 읽는다 |
| 쿠키는 구식이다 | 속성을 쓰면 더 안전하다 |
| 세션 저장소는 안전하다 | 같은 탭의 스크립트가 읽는다 |
| 토큰을 암호화하면 된다 | 복호화 키도 같은 곳에 있다 |
| 짧은 만료면 충분하다 | 갱신 토큰이 남는다 |

## 저장 위치별 특성

| 위치 | 스크립트 접근 | CSRF | 권장 |
| --- | --- | --- | --- |
| 로컬 저장소 | 가능 | 없음 | 비권장 |
| 세션 저장소 | 가능 | 없음 | 비권장 |
| 일반 쿠키 | 가능 | 있음 | 비권장 |
| HttpOnly 쿠키 | 불가 | 있음 — 대책 필요 | 권장 |
| 메모리 | 같은 문맥만 | 없음 | 액세스 토큰에 적합 |

## 권장 조합

| 토큰 | 위치 |
| --- | --- |
| 액세스 토큰 | 메모리 (짧은 수명) |
| 갱신 토큰 | HttpOnly + Secure + SameSite 쿠키 |

액세스 토큰을 메모리에 두면 새로 고침 시 사라진다. 갱신 토큰 쿠키로 다시 받아 오면 된다. 스크립트 취약점이 있어도 갱신 토큰은 읽히지 않는다.

## 쿠키 속성

\`\`\`
Set-Cookie: rt=...; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=1209600
\`\`\`

| 속성 | 효과 |
| --- | --- |
| HttpOnly | 스크립트 접근 차단 |
| Secure | 암호화 연결에서만 |
| SameSite | 교차 사이트 전송 제한 |
| Path 제한 | 갱신 경로에서만 전송 |

Path 제한이 자주 빠진다. 갱신 토큰이 모든 요청에 실려 가면 노출 기회가 늘어난다.

## 점검

\`\`\`javascript
// 저장소에 토큰처럼 보이는 값이 있는지 — 개발 중 확인
Object.keys(localStorage).filter((k) =>
  /token|jwt|auth|session|key/i.test(k) || /^ey[A-Za-z0-9_-]{10,}\./.test(localStorage[k] || ''))
\`\`\`

결과가 비어 있어야 한다. 서드파티 라이브러리가 몰래 저장하는 경우도 있으므로 정기적으로 확인한다.

## 참고

- OWASP — HTML5 Security Cheat Sheet, Session Management Cheat Sheet
- IETF — OAuth 2.0 for Browser-Based Apps
- RFC 6265bis — SameSite 쿠키 속성`,
    diagram: {
      type: 'matrix',
      caption: '위협별 강약',
      x: ['스크립트 삽입에 강함', '약함'],
      y: ['요청 위조에 강함', '약함'],
      cells: ['메모리 + 회전', 'localStorage', 'HttpOnly 쿠키', '일반 쿠키'],
    },
    diagram2: {
      type: 'flow',
      caption: '토큰 수명 흐름',
      steps: [
        { label: '로그인', note: '갱신 토큰 쿠키 발급' },
        { label: '접근 토큰 메모리 보관', note: '짧은 수명' },
        { label: '만료 시 갱신', note: '회전 발급' },
        { label: '재사용 감지 시 전부 폐기', note: '탈취 대응' },
      ],
    },
  },
  {
    slug: 'subresource-integrity',
    title: '서드파티 스크립트 통제와 무결성 검증',
    body: `분석 도구, 채팅 위젯, 광고, 지도. 외부 스크립트는 우리 페이지에서 우리 코드와 같은 권한으로 실행된다. 그 업체가 침해되거나 스크립트가 바뀌면 우리 사용자의 입력이 그대로 넘어간다. 결제 페이지에서 카드 정보가 유출된 사고들의 상당수가 이 경로였다.

## 외부 스크립트는 무엇을 할 수 있는가?

| 가능한 동작 | 결과 |
| --- | --- |
| DOM 읽기 | 화면의 모든 값 수집 |
| 입력 감시 | 타이핑 중인 값 전송 |
| 폼 조작 | 전송 주소 변경 |
| 쿠키 접근 | HttpOnly 아닌 값 탈취 |
| 다른 스크립트 로드 | 통제 밖으로 확장 |
| 요청 가로채기 | 응답 변조 |

우리 페이지에 넣은 스크립트는 우리 권한을 그대로 갖는다는 점이 핵심이다. 신뢰의 범위가 그 업체까지 확장된다.

![외부 스크립트의 권한 범위](/img/posts/subresource-integrity.svg)

## 무결성 검증으로 변경을 막는다

해시를 지정해 두면 파일이 바뀌었을 때 브라우저가 실행을 거부한다. 다만 이 방식은 버전이 고정된 파일에만 쓸 수 있다.

\`\`\`html
<script src="https://cdn.example.com/widget-1.4.2.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous" defer></script>
\`\`\`

\`\`\`bash
# 해시 생성 — 배포된 파일을 그대로 받아 계산한다
curl -s https://cdn.example.com/widget-1.4.2.js |
  openssl dgst -sha384 -binary | openssl base64 -A
\`\`\`

업체가 "최신 버전" 주소를 제공하고 버전 고정을 지원하지 않으면 이 방법을 쓸 수 없다. 그 경우는 다른 통제가 필요하다.

![검증이 가능한 조건](/img/posts/subresource-integrity-2.svg)

## 검증이 불가능할 때의 통제

버전을 고정할 수 없는 스크립트는 격리한다. 별도 출처의 iframe 안에서 실행하면 우리 페이지의 DOM 에 접근하지 못한다. 결제 입력처럼 민감한 화면에는 외부 스크립트를 아예 넣지 않는 것이 원칙이다.

| 통제 | 적용 상황 |
| --- | --- |
| 무결성 검증 | 버전 고정 가능 |
| 별도 출처 iframe | DOM 접근 차단이 필요 |
| 정책으로 출처 제한 | 스크립트 추가를 통제 |
| 민감 화면 제외 | 결제·인증 입력 |
| 자체 호스팅 | 검토 후 우리가 배포 |

\`\`\`
Content-Security-Policy:
  script-src 'self' https://cdn.example.com;
  connect-src 'self' https://api.example.com;
  require-trusted-types-for 'script';
  report-uri /csp-report
\`\`\`

connect-src 를 함께 제한하는 것이 중요하다. 스크립트가 실행돼도 데이터를 내보낼 주소가 막히면 유출이 성립하지 않는다.

## 지금 무엇이 들어 있는지 확인한다

\`\`\`bash
# 페이지가 불러오는 외부 출처 목록
curl -s https://example.com | grep -oE 'src="https?://[^"]+' | sort -u

# 무결성 속성이 없는 외부 스크립트
curl -s https://example.com |
  grep -oE '<script[^>]*src="https?://[^"]*"[^>]*>' | grep -v integrity
\`\`\`

## 실제로 이렇게 터진다

외부 CDN 에서 라이브러리를 불러오던 서비스가 그 CDN 침해로 악성 코드를 실행한 사례가 있다. 우리 서버는 멀쩡했고 코드도 그대로였다. 불러온 파일만 바뀌었다.

또 하나는 무결성 값을 넣었지만 버전 갱신 시 값을 안 바꾼 경우다. 스크립트가 로드되지 않아 기능이 죽었고, 원인 파악이 늦었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 유명 CDN 은 안전하다 | 침해 사례가 있다 |
| HTTPS 면 충분하다 | 원본이 바뀌면 소용없다 |
| 무결성 값이 있으면 끝이다 | 갱신 절차가 필요하다 |
| 모든 외부 자원에 쓸 수 있다 | 내용이 자주 바뀌면 어렵다 |
| 실패하면 알 수 있다 | 조용히 로드되지 않는다 |

## 적용 대상

| 자원 | 적용 |
| --- | --- |
| 고정 버전 라이브러리 | 가능 |
| 폰트 파일 | 가능 |
| 자주 바뀌는 스크립트 | 어려움 |
| 광고·분석 스크립트 | 대부분 불가 |

적용할 수 없는 스크립트가 문제다. 그런 스크립트는 정말 필요한지, 권한을 제한할 수 없는지 검토한다.

## 함께 쓸 것

| 수단 | 역할 |
| --- | --- |
| 무결성 검증 | 내용 변조 탐지 |
| 콘텐츠 보안 정책 | 허용 출처 제한 |
| 교차 출처 속성 | 검증에 필요 |
| 자체 호스팅 | 외부 의존 제거 |

가장 확실한 것은 자체 호스팅이다. 라이브러리를 직접 배포하면 외부 침해 경로가 사라진다. CDN 의 속도 이점보다 이쪽이 나은 경우가 많다.

## 값 생성과 관리

\`\`\`bash
# 무결성 값 생성
curl -s https://cdn.example.com/lib.js | openssl dgst -sha384 -binary | openssl base64 -A

# 페이지에 있는 외부 스크립트 중 무결성 값이 없는 것
grep -oE '<script[^>]+src="https://[^"]+"[^>]*>' index.html | grep -v integrity
\`\`\`

버전을 올릴 때 값을 함께 바꾸는 것을 빌드 과정에 넣는다. 손으로 관리하면 반드시 어긋난다.

## 실패 감지

무결성 검증에 실패하면 스크립트가 로드되지 않고 콘솔에만 오류가 남는다. 사용자는 기능이 안 되는 것만 안다. 오류를 수집해 알림을 받도록 해 둔다.

## 참고

- W3C — Subresource Integrity 명세
- OWASP — Third Party JavaScript Management Cheat Sheet
- PCI DSS 요구사항 6.4.3, 결제 페이지 스크립트 관리`,
    diagram: {
      type: 'flow',
      caption: '공급망을 통한 유출',
      steps: [
        { label: '외부 업체 침해', note: '우리 통제 밖' },
        { label: '스크립트 변경', note: '같은 주소' },
        { label: '우리 페이지에서 실행', note: '우리 권한으로' },
        { label: '입력값 외부 전송', note: '카드·인증정보', danger: true },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '통제 선택',
      x: ['버전 고정 가능', '불가능'],
      y: ['민감 화면', '일반 화면'],
      cells: ['무결성 + 검토', '넣지 않는다', '무결성 검증', 'iframe 격리'],
    },
  },
  {
    slug: 'iframe-sandbox',
    title: 'iframe 격리와 sandbox 속성 설계',
    body: `외부 콘텐츠나 사용자가 만든 콘텐츠를 화면에 넣어야 할 때, iframe 은 격리 수단이 된다. 그런데 그냥 넣으면 격리가 되지 않는다. sandbox 속성으로 권한을 명시적으로 제거해야 하고, 어떤 조합을 허용하는지에 따라 격리가 무의미해지기도 한다.

## sandbox 는 무엇을 막는가?

속성을 붙이면 기본적으로 거의 모든 것이 막히고, 필요한 것만 하나씩 되돌린다.

| 허용 값 | 되돌리는 권한 |
| --- | --- |
| allow-scripts | 스크립트 실행 |
| allow-same-origin | 같은 출처로 취급 |
| allow-forms | 폼 전송 |
| allow-popups | 새 창 열기 |
| allow-top-navigation | 최상위 페이지 이동 |
| allow-modals | 대화 상자 |
| allow-downloads | 내려받기 |

allow-scripts 와 allow-same-origin 을 함께 주면 격리가 사라진다. 프레임 안의 스크립트가 우리 출처의 코드로 동작하면서 sandbox 속성 자체를 지울 수 있다.

![허용 조합과 격리 수준](/img/posts/iframe-sandbox.svg)

## 사용자 콘텐츠는 별도 출처에 둔다

같은 출처에 두면 sandbox 만으로는 부족하다. 저장소와 쿠키를 공유하기 때문이다. 사용자 업로드 콘텐츠는 다른 도메인에서 제공하는 것이 원칙이다.

\`\`\`
본 서비스        app.example.com
사용자 콘텐츠    usercontent-example.net     ← 등록 가능한 다른 도메인
미리보기 프레임  sandbox="allow-scripts" (allow-same-origin 없이)
\`\`\`

하위 도메인으로 나누는 것만으로는 부족한 경우가 있다. 쿠키 도메인 설정에 따라 상위 도메인의 쿠키가 전달되기 때문이다.

![출처 분리 구성](/img/posts/iframe-sandbox-2.svg)

## 프레임 안팎의 통신

격리한 뒤에도 데이터를 주고받아야 한다면 postMessage 를 쓰고, 양쪽에서 출처를 검증한다. 대상 출처를 와일드카드로 두거나 수신 측에서 출처를 확인하지 않으면 격리한 의미가 없다.

\`\`\`ts
// 보낼 때 — 대상 출처를 명시한다. '*' 는 쓰지 않는다.
frame.contentWindow?.postMessage({ type: 'render', html }, 'https://usercontent-example.net')

// 받을 때 — 출처와 형식을 모두 검증한다
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://usercontent-example.net') return
  const msg = Schema.safeParse(e.data)
  if (!msg.success) return
  handle(msg.data)
})
\`\`\`

## 상위 페이지를 보호하는 헤더

우리 페이지가 남의 프레임에 들어가는 것도 함께 막는다. 클릭재킹 방어와 같은 설정이다.

\`\`\`
Content-Security-Policy: frame-ancestors 'self';
                         sandbox allow-scripts allow-forms
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
\`\`\`

\`\`\`bash
# 프레임 관련 헤더 확인
curl -sD - -o /dev/null https://example.com |
  grep -iE 'frame-ancestors|x-frame-options|cross-origin-(opener|embedder)'
\`\`\`

## 실제로 이렇게 터진다

외부 콘텐츠를 프레임으로 넣으면서 격리 속성을 빼먹은 사례가 있다. 그 콘텐츠가 상위 창을 다른 주소로 이동시켰다. 사용자는 우리 사이트에서 피싱 페이지로 옮겨 갔다.

또 하나는 격리를 켰지만 같은 출처 허용과 스크립트 허용을 함께 준 경우다. 격리가 사실상 해제됐다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 프레임은 자동으로 격리된다 | 속성을 명시해야 한다 |
| 같은 출처 허용은 필요하다 | 스크립트와 함께 주면 위험하다 |
| 격리하면 아무것도 못 한다 | 필요한 것만 허용하면 된다 |
| 외부 콘텐츠만 위험하다 | 사용자 생성 콘텐츠도 같다 |
| 프레임 안은 우리 책임이 아니다 | 사용자에게는 우리 사이트다 |

## 허용 항목

| 항목 | 의미 |
| --- | --- |
| 스크립트 | 자바스크립트 실행 |
| 폼 | 폼 제출 |
| 팝업 | 새 창 열기 |
| 같은 출처 | 출처 격리 해제 |
| 최상위 이동 | 상위 창 이동 |
| 모달 | 대화 상자 |

같은 출처 허용과 스크립트 허용을 함께 주면, 프레임 안 코드가 격리 속성 자체를 제거할 수 있다. 이 조합은 피한다.

## 외부 콘텐츠 삽입 기준

\`\`\`html
<iframe src="https://widget.example.com/w"
        sandbox="allow-scripts allow-forms"
        referrerpolicy="no-referrer"
        allow="camera 'none'; microphone 'none'; geolocation 'none'"
        loading="lazy"></iframe>
\`\`\`

| 속성 | 역할 |
| --- | --- |
| sandbox | 기능 제한 |
| referrerpolicy | 참조 주소 노출 방지 |
| allow | 장치 권한 차단 |

## 반대 방향도 본다

우리 페이지가 다른 사이트의 프레임에 들어가는 것도 막아야 한다. 클릭 유도 공격의 조건이다.

\`\`\`
Content-Security-Policy: frame-ancestors 'self'
\`\`\`

옛 헤더 대신 이 지시문을 쓴다. 특정 파트너에게만 허용하려면 그 출처를 나열한다.

## 통신

프레임과 부모 사이 통신은 메시지 전달을 쓴다.

| 항목 | 원칙 |
| --- | --- |
| 대상 출처 | 명시, 와일드카드 금지 |
| 수신 검증 | 출처 확인 후 처리 |
| 내용 | 신뢰하지 않고 검증 |

수신 측에서 출처를 확인하지 않으면 아무 창이나 메시지를 보낼 수 있다. 이 검증이 빠진 코드가 흔하다.

## 참고

- HTML 명세 — the sandbox attribute
- OWASP — Clickjacking Defense Cheat Sheet
- W3C — Content Security Policy Level 3, frame-ancestors`,
    diagram: {
      type: 'matrix',
      caption: '허용 조합',
      x: ['allow-same-origin 없음', '있음'],
      y: ['allow-scripts 없음', '있음'],
      cells: ['완전 격리', '저장소 공유', '스크립트만', '격리 무효'],
    },
    diagram2: {
      type: 'layers',
      caption: '격리 계층',
      layers: [
        { label: '다른 도메인', note: '쿠키·저장소 분리' },
        { label: 'sandbox 속성', note: '권한 제거' },
        { label: 'postMessage 검증', note: '양방향 출처 확인' },
        { label: '상위 보호 헤더', note: 'frame-ancestors' },
      ],
    },
  },
  {
    slug: 'web-permissions-api',
    title: '웹 권한 요청 설계와 사용자 동의',
    body: `위치, 카메라, 마이크, 알림. 브라우저가 사용자에게 묻는 권한은 한 번 허용되면 계속 유지된다. 그래서 요청 시점과 방식이 곧 개인정보 보호 설계다. 페이지 진입 즉시 여러 권한을 요청하는 구현이 흔하지만, 거부율이 높고 신뢰를 잃는다.

## 어떤 시점에 요청해야 하는가?

| 방식 | 허용률 | 사용자 인식 |
| --- | --- | --- |
| 진입 즉시 여러 개 | 낮음 | 왜 필요한지 모름 |
| 기능 사용 시점 | 높음 | 이유가 분명함 |
| 사전 설명 후 요청 | 가장 높음 | 선택으로 느껴짐 |
| 거부 후 반복 요청 | 영구 차단 유발 | 불신 |

브라우저는 거부가 반복되면 이후 요청을 아예 표시하지 않는다. 한 번의 거부가 영구적 차단이 되므로, 요청은 성공 가능성이 높은 시점에만 해야 한다.

![요청 시점과 결과](/img/posts/web-permissions-api.svg)

## 상태를 먼저 확인하고 분기한다

권한 상태는 세 가지다. 이미 거부된 상태에서 다시 요청하면 아무 일도 일어나지 않으므로, 대체 경로를 안내해야 한다.

\`\`\`ts
const st = await navigator.permissions.query({ name: 'geolocation' })
if (st.state === 'granted') return useLocation()
if (st.state === 'denied')  return showManualInput()      // 주소 직접 입력
// 'prompt' 인 경우에만 사전 설명 후 요청한다
await explainWhy()
navigator.geolocation.getCurrentPosition(useLocation, showManualInput,
  { enableHighAccuracy: false, timeout: 5000 })
\`\`\`

정확도를 낮추는 옵션을 쓰면 필요 이상의 정보를 받지 않는다. 배송지 추정에는 도시 단위면 충분한 경우가 많다.

![상태별 분기](/img/posts/web-permissions-api-2.svg)

## 받은 데이터를 어떻게 다루는가

권한 허용은 수집 근거의 일부일 뿐이다. 무엇을 수집해 어디에 보관하고 언제 지우는지가 별도 문제다.

| 항목 | 설계 방향 |
| --- | --- |
| 정밀도 | 업무에 필요한 최소 단위로 낮춘다 |
| 보관 | 필요한 기간만, 목적 달성 후 파기 |
| 전송 | 서버로 보낼 필요가 없으면 기기에서 처리 |
| 기록 | 언제 어떤 권한으로 수집했는지 남긴다 |
| 철회 | 서비스 안에서 철회 경로 제공 |

브라우저 권한을 취소하는 방법은 사용자가 잘 모른다. 설정 화면에 안내를 두면 철회권 보장에 도움이 된다.

## 정책으로 하위 프레임의 권한을 막는다

우리 페이지에 들어온 외부 프레임이 권한을 요청하면 사용자는 우리가 요청한 것으로 인식한다. 권한 정책으로 위임 범위를 제한한다.

\`\`\`
Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=()
\`\`\`

\`\`\`bash
curl -sD - -o /dev/null https://example.com | grep -i 'permissions-policy'
\`\`\`

## 실제로 이렇게 터진다

앱 실행 즉시 위치·알림·카메라 권한을 한꺼번에 요청한 사례가 있다. 대부분의 사용자가 거부했고, 나중에 정말 필요할 때는 다시 물을 수 없었다. 브라우저는 거부를 기억한다.

또 하나는 권한 거부 상태를 처리하지 않은 경우다. 화면이 빈 채로 멈췄다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 미리 받아 두면 편하다 | 거부되면 되돌리기 어렵다 |
| 거부하면 다시 물으면 된다 | 브라우저가 차단한다 |
| 권한이 있으면 계속 쓴다 | 사용자가 취소할 수 있다 |
| 거부는 예외 상황이다 | 기본 경로로 다뤄야 한다 |
| 권한 요청에 설명이 필요 없다 | 설명이 승낙률을 크게 바꾼다 |

## 요청 시점

| 시점 | 승낙률 |
| --- | --- |
| 페이지 로드 즉시 | 낮음 |
| 기능 버튼을 누른 직후 | 높음 |
| 왜 필요한지 설명 후 | 가장 높음 |

사용자가 그 기능을 쓰려는 순간에 묻는다. 그 전에 한 줄로 이유를 보여 주면 승낙률이 크게 오른다.

## 상태 처리

| 상태 | 화면 |
| --- | --- |
| 미결정 | 기능 버튼 표시 |
| 허용 | 기능 동작 |
| 거부 | 대체 수단 안내 |
| 브라우저 차단 | 설정 변경 방법 안내 |

거부 상태에서 대체 수단이 없으면 사용자가 그 기능을 영영 쓰지 못한다. 위치라면 주소 직접 입력, 카메라라면 파일 업로드 같은 대안을 둔다.

## 확인 방법

\`\`\`javascript
// 요청하지 않고 현재 상태만 확인 — 화면을 미리 맞출 수 있다
const st = await navigator.permissions.query({ name: 'geolocation' })
// st.state: 'granted' | 'denied' | 'prompt'
st.addEventListener('change', () => render(st.state))
\`\`\`

상태 변경을 감지하면 사용자가 설정에서 바꿨을 때 화면이 따라간다.

## 최소 권한

| 원칙 | 적용 |
| --- | --- |
| 필요할 때만 요청 | 기능 사용 시점 |
| 정확도 낮춰도 되면 낮게 | 대략 위치로 충분한가 |
| 지속 접근 대신 일회성 | 한 번 읽고 끝 |
| 사용 중 표시 | 사용자가 알 수 있게 |
| 사용 후 해제 | 스트림 정리 |

카메라·마이크는 사용 후 반드시 스트림을 정지한다. 그렇게 하지 않으면 표시등이 켜진 채로 남아 사용자 신뢰를 잃는다.

## 참고

- W3C — Permissions API, Permissions Policy
- 개인정보보호법, 개인정보 수집·이용 동의와 최소 수집 원칙
- OWASP — Privacy Risks 관련 지침`,
    diagram: {
      type: 'bars',
      caption: '요청 방식별 허용률(경향)',
      unit: '상대값',
      items: [
        { label: '사전 설명 후 요청', value: 45 },
        { label: '기능 사용 시점', value: 35 },
        { label: '진입 즉시 1개', value: 15 },
        { label: '진입 즉시 여러 개', value: 5, note: '거부·차단' },
      ],
    },
    diagram2: {
      type: 'flow',
      caption: '요청 절차',
      steps: [
        { label: '상태 조회', note: 'granted·denied·prompt' },
        { label: '거부면 대체 경로', note: '재요청 금지' },
        { label: '사전 설명', note: '이유 제시' },
        { label: '최소 정밀도로 수집', note: '보관 기간 지정' },
      ],
    },
  },
  {
    slug: 'mobile-deeplink',
    title: '모바일 앱 딥링크 처리와 신뢰 경계',
    body: `앱은 링크를 통해 외부에서 호출된다. 그 링크에 담긴 값으로 화면을 열고, 때로는 로그인 상태를 만들고, 결제 흐름을 이어 간다. 문제는 그 링크를 누가 만들었는지 앱이 알 수 없다는 점이다. 링크의 매개변수는 사용자 입력과 같은 등급이며, 그렇게 다루지 않으면 인가 우회와 토큰 탈취로 이어진다.

## 어떤 문제가 생기는가?

| 문제 | 결과 |
| --- | --- |
| 사용자 정의 스킴 가로채기 | 다른 앱이 같은 스킴을 등록해 값을 받는다 |
| 매개변수 검증 누락 | 임의 주소를 앱 내 웹뷰로 로드 |
| 인가 없는 화면 진입 | 링크만으로 다른 사용자 자료 열람 |
| 토큰 전달 | 링크에 담긴 인증값이 로그·기록에 남는다 |
| 자동 실행 동작 | 링크를 열자마자 상태 변경 |

사용자 정의 스킴은 운영체제가 유일성을 보장하지 않는다. 그래서 인증 결과를 스킴으로 돌려받는 구성은 다른 앱이 가로챌 수 있다.

![딥링크가 가로채이는 경로](/img/posts/mobile-deeplink.svg)

## 검증 가능한 링크를 쓴다

앱 링크와 유니버설 링크는 도메인 소유 증명이 필요하므로 다른 앱이 가로챌 수 없다. 인증 흐름에는 반드시 이 방식을 쓴다.

\`\`\`
안드로이드   assetlinks.json 을 도메인에 올려 앱 서명과 연결
iOS         apple-app-site-association 파일로 연결
검증        설치 시 운영체제가 도메인을 확인
대비        PKCE 를 함께 써서 코드 가로채기만으로는 성립하지 않게 한다
\`\`\`

\`\`\`bash
# 연결 파일이 올바르게 제공되는지 — 형식과 헤더를 함께 본다
curl -s https://example.com/.well-known/assetlinks.json | python3 -m json.tool | head
curl -sD - -o /dev/null https://example.com/.well-known/apple-app-site-association |
  grep -iE 'content-type|http/'
\`\`\`

![검증 방식 비교](/img/posts/mobile-deeplink-2.svg)

## 앱 안에서의 처리 규칙

링크를 받은 뒤의 처리도 검증이 필요하다. 세 가지가 핵심이다.

1. 이동할 화면을 허용 목록으로 정한다 — 링크가 화면 이름을 자유롭게 지정하지 못하게 한다
2. 웹뷰로 로드할 주소는 우리 도메인만 허용한다
3. 링크만으로는 인가를 부여하지 않는다 — 화면 진입 후 권한을 다시 확인한다

\`\`\`kotlin
// 허용 목록 방식. 링크가 임의 경로를 지정하지 못한다.
val route = when (uri.host to uri.path) {
    "example.com" to "/orders" -> Route.Orders(uri.getQueryParameter("id"))
    "example.com" to "/promo"  -> Route.Promo
    else -> Route.Home                          // 알 수 없는 링크는 홈으로
}
// 웹뷰 로드는 우리 도메인만
if (target.host?.endsWith("example.com") != true) return
\`\`\`

## 무엇을 시험하는가

임의 링크를 앱에 직접 던져 반응을 본다. 배포 전 점검 항목으로 두면 좋다.

\`\`\`bash
# 안드로이드 — 검증 없는 화면 진입이나 외부 주소 로드가 되는지
adb shell am start -W -a android.intent.action.VIEW \\
  -d "myapp://open?next=https://evil.example/steal" com.example.app
adb shell pm get-app-links com.example.app          # 도메인 검증 상태
\`\`\`

## 실제로 이렇게 터진다

인증 결과를 딥링크로 앱에 돌려주는 구조에서, 다른 앱이 같은 스킴을 등록한 사례가 있다. 인증 코드가 그 앱으로 전달됐다.

또 하나는 링크 파라미터를 검증 없이 화면 이동에 쓴 경우다. 외부에서 앱 내부의 인증 화면을 건너뛴 상태로 진입시킬 수 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 커스텀 스킴은 우리 것이다 | 다른 앱이 같은 것을 등록할 수 있다 |
| 링크로 들어오면 신뢰할 수 있다 | 외부 입력이다 |
| 인증 상태는 유지된다 | 링크 진입 시 확인해야 한다 |
| 파라미터는 우리가 만든 것이다 | 조작 가능하다 |
| 검증된 링크면 충분하다 | 내용 검증은 별개다 |

## 링크 방식

| 방식 | 안전성 |
| --- | --- |
| 커스텀 스킴 | 낮음 — 가로채기 가능 |
| 검증된 앱 링크 | 높음 — 도메인 소유 증명 |
| 앱 내 웹뷰 | 중간 |

인증 흐름에는 검증된 앱 링크를 쓴다. 도메인 소유를 증명해야 등록되므로 다른 앱이 가로챌 수 없다.

## 진입 시 검증

| 항목 | 확인 |
| --- | --- |
| 인증 상태 | 로그인돼 있는가 |
| 권한 | 그 화면에 접근 가능한가 |
| 파라미터 형식 | 예상 형식인가 |
| 대상 식별자 | 본인 것인가 |
| 외부 URL | 열어도 되는 주소인가 |

마지막 항목이 자주 문제다. 링크 파라미터로 받은 주소를 웹뷰에서 열면 피싱 경로가 된다. 허용 도메인 목록과 대조한다.

## 인증 흐름

인증 코드를 링크로 받을 때는 요청과 응답을 묶는 값이 필요하다.

| 요소 | 역할 |
| --- | --- |
| 상태 값 | 요청·응답 대응 확인 |
| 코드 검증자 | 코드 가로채기 방지 |
| 일회성 | 재사용 차단 |
| 짧은 유효 기간 | 노출 창 축소 |

## 점검

\`\`\`bash
# 안드로이드: 앱이 처리하는 링크 목록과 검증 상태
adb shell pm get-app-links <package>

# 등록된 인텐트 필터 확인
aapt dump xmltree app.apk AndroidManifest.xml | grep -A3 -i 'android.intent.action.VIEW'
\`\`\`

검증 상태가 확인되지 않은 도메인이 있으면 다른 앱이 같은 링크를 처리할 수 있다.

## 참고

- Android 개발자 문서 — App Links 검증, Deep Links
- Apple 문서 — Supporting Universal Links
- OWASP MASVS — 플랫폼 상호작용 요구사항`,
    diagram: {
      type: 'flow',
      caption: '스킴 가로채기',
      steps: [
        { label: '인증 결과 반환', note: '사용자 정의 스킴' },
        { label: '악성 앱이 같은 스킴 등록', note: '유일성 없음' },
        { label: '인가 코드 수신', note: '가로채기' },
        { label: '토큰 교환', note: 'PKCE 없으면 성립', danger: true },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '링크 방식',
      x: ['도메인 검증 있음', '없음'],
      y: ['PKCE 적용', '미적용'],
      cells: ['안전', '가로채도 무효', '검증으로 차단', '탈취 가능'],
    },
  },
  {
    slug: 'mobile-data-at-rest',
    title: '모바일 앱 저장 데이터 보호 기준',
    body: `앱이 기기에 남기는 데이터는 기기를 잃었을 때, 그리고 백업을 통해 외부로 나갔을 때 문제가 된다. 운영체제가 기본 암호화를 제공하지만 그것은 기기가 잠긴 상태에서만 유효하다. 앱이 무엇을 어디에 남기는지 목록으로 만들고, 남기지 않아도 되는 것을 줄이는 작업이 먼저다.

## 어디에 무엇이 남는가?

| 저장 위치 | 흔히 남는 것 | 위험 |
| --- | --- | --- |
| 기본 설정 저장소 | 토큰, 사용자 식별자 | 백업에 포함 |
| 내부 데이터베이스 | 목록·상세 캐시 | 평문 저장 |
| 파일 캐시 | 내려받은 문서·이미지 | 삭제 누락 |
| 로그 | 요청·응답 본문 | 다른 앱이 수집 가능 |
| 화면 캡처 | 앱 전환 시 스냅샷 | 민감 화면 노출 |
| 클립보드 | 복사한 인증번호 | 다른 앱이 읽음 |

앱 전환 시 저장되는 화면 스냅샷은 놓치기 쉽다. 잔액이나 개인정보가 보이는 화면은 가려야 한다.

![저장 위치와 노출 경로](/img/posts/mobile-data-at-rest.svg)

## 무엇을 어디에 두는가

비밀은 운영체제가 제공하는 보안 저장소에 둔다. 하드웨어 키를 쓰는 구성이면 기기 밖으로 키를 꺼낼 수 없다.

\`\`\`
토큰·키          안드로이드 Keystore / iOS Keychain (기기 잠금 연동)
개인정보 캐시    가능하면 저장하지 않음. 필요하면 암호화 + 만료
목록 캐시        식별자만, 표시용 최소 필드
로그             운영 빌드에서 비활성, 민감 필드 제거
백업             비밀·개인정보는 백업 제외 설정
\`\`\`

\`\`\`kotlin
// 기기 잠금 해제 상태에서만 쓸 수 있는 키로 저장한다
val spec = KeyGenParameterSpec.Builder("token_key",
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
    .setUserAuthenticationRequired(true)          // 잠금 해제 필요
    .setInvalidatedByBiometricEnrollment(true)
    .build()
\`\`\`

![저장 대상 분류](/img/posts/mobile-data-at-rest-2.svg)

## 캐시를 남기지 않는 것이 가장 확실하다

암호화해 저장하는 것보다 아예 저장하지 않는 것이 안전하고 단순하다. 목록 화면을 빠르게 띄우기 위해 상세 데이터까지 캐시하는 구현이 흔한데, 대개 식별자와 제목만 있으면 충분하고 나머지는 다시 받아도 체감 차이가 없다. 캐시가 필요한 경우에는 만료 시각을 함께 저장하고, 로그아웃과 계정 전환 시 전부 지운다. 계정 전환 후에도 앞 사용자의 데이터가 남는 것은 실제로 자주 발견되는 결함이다.

## 화면과 클립보드도 함께 다룬다

| 항목 | 조치 |
| --- | --- |
| 앱 전환 스냅샷 | 민감 화면에 보안 플래그 설정 |
| 스크린샷 | 필요한 화면에서 차단 |
| 클립보드 | 자동 복사한 값은 시간 후 삭제 |
| 키보드 학습 | 민감 입력 필드에 학습 제외 설정 |

## 실제로 무엇이 남는지 확인한다

설계 문서보다 기기에서 확인하는 것이 정확하다. 라이브러리가 몰래 남기는 것이 자주 발견된다.

\`\`\`bash
# 안드로이드 디버그 빌드에서 앱 데이터 훑기
adb shell run-as com.example.app find /data/data/com.example.app -type f |
  head -40
adb shell run-as com.example.app sh -c \\
  'grep -rlE "Bearer |token|[0-9]{6,}" /data/data/com.example.app 2>/dev/null' | head

# 백업에 포함되는지 — 추출해 내용을 확인한다
adb backup -f app.ab com.example.app 2>/dev/null && ls -la app.ab
\`\`\`

## 실제로 이렇게 터진다

로그인 상태 유지를 위해 토큰을 앱 내부 파일에 평문으로 저장한 사례가 있다. 루팅된 단말이나 백업 파일에서 그대로 읽혔다.

또 하나는 디버그 로그에 응답 본문을 남긴 경우다. 출시 빌드에도 그 로그가 남아 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 앱 내부 저장소는 안전하다 | 루팅·백업으로 접근된다 |
| 암호화하면 끝이다 | 키 보관이 문제다 |
| 디버그 로그는 출시에서 빠진다 | 설정하지 않으면 남는다 |
| 캐시는 신경 안 써도 된다 | 응답 본문이 남는다 |
| 스크린샷은 통제 불가 | 민감 화면은 가릴 수 있다 |

## 무엇이 어디에 남나

| 데이터 | 위치 | 대응 |
| --- | --- | --- |
| 인증 토큰 | 저장소 | 보안 저장소 사용 |
| 응답 캐시 | 캐시 디렉터리 | 민감 응답 캐시 금지 |
| 로그 | 시스템 로그 | 출시 빌드에서 제거 |
| 화면 캡처 | 최근 앱 목록 | 민감 화면 가리기 |
| 키보드 학습 | 시스템 | 민감 입력 필드 표시 |
| 백업 | 클라우드 | 백업 제외 설정 |

키보드 학습과 백업이 자주 빠진다. 비밀번호 입력란을 일반 텍스트로 두면 입력 내용이 학습된다.

## 보안 저장소

| 플랫폼 | 수단 |
| --- | --- |
| 안드로이드 | 키스토어 기반 암호화 |
| iOS | 키체인 |

키를 앱 코드에 넣지 않는 것이 핵심이다. 플랫폼이 제공하는 하드웨어 지원 저장소를 쓰면 키가 앱 밖으로 나오지 않는다.

## 점검 항목

| 항목 | 확인 |
| --- | --- |
| 저장소에 평문 토큰 | 없어야 함 |
| 백업 대상 | 민감 파일 제외 |
| 로그 출력 | 출시 빌드에서 제거 |
| 캐시 정책 | 민감 응답 제외 |
| 화면 보호 | 민감 화면 설정 |
| 클립보드 | 자동 지우기 |

\`\`\`bash
# 안드로이드: 앱 데이터 디렉터리에 토큰처럼 보이는 값이 있는지 (디버그 빌드)
adb shell run-as <package> find . -type f \
  -exec grep -lE 'eyJ[A-Za-z0-9_-]{10,}|Bearer ' {} +
\`\`\`

## 루팅·탈옥 단말

완전히 막을 수는 없다. 탐지해서 기능을 제한하는 것이 일반적인 대응이지만, 우회도 가능하다. 중요한 판단은 서버에서 하는 것이 근본 대응이다.

## 참고

- OWASP MASVS — 저장 데이터 요구사항, MASTG 시험 절차
- Android 개발자 문서 — Keystore, 백업 제외 규칙
- Apple 문서 — Keychain 접근성 옵션`,
    diagram: {
      type: 'layers',
      caption: '보호 계층',
      layers: [
        { label: '저장하지 않음', note: '가장 확실한 방법' },
        { label: '보안 저장소', note: '하드웨어 키 연동' },
        { label: '암호화 + 만료', note: '캐시가 필요할 때' },
        { label: '백업·화면 제외', note: '유출 경로 차단' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '위험 판정',
      x: ['보안 저장소', '일반 저장소'],
      y: ['백업 제외', '백업 포함'],
      cells: ['안전', '기기 분실 시 위험', '외부 유출 가능', '평문 유출'],
    },
  },
  {
    slug: 'app-integrity-check',
    title: '앱 무결성 검증과 우회 가능성',
    body: `앱이 변조됐는지, 탈옥·루팅된 기기에서 돌고 있는지 확인하는 기능을 넣는다. 필요한 통제지만, 그 판정이 클라이언트에서 이뤄지면 판정 자체를 우회할 수 있다는 점을 전제해야 한다. 무결성 검증은 공격 비용을 올리는 수단이고, 인가의 근거로 삼으면 안 된다.

## 클라이언트 판정은 왜 근거가 될 수 없는가?

| 검증 | 우회 방법 |
| --- | --- |
| 루팅 탐지 | 탐지 함수 후킹, 반환값 변경 |
| 서명 검증 | 검증 코드 자체를 우회 |
| 디버거 탐지 | 탐지 시점 우회 |
| 에뮬레이터 탐지 | 속성값 위조 |
| 통신 무결성 | 인증서 고정 우회 도구 |

전부 같은 원리다 — 판정 코드가 공격자의 기기에서 돌기 때문이다. 그래서 결과를 서버가 검증할 수 있는 형태로 만들어야 한다.

![클라이언트 판정과 서버 검증](/img/posts/app-integrity-check.svg)

## 모바일 앱 무결성을 서버가 검증하는 방식

플랫폼이 제공하는 무결성 증명은 운영체제가 서명한 결과를 서버가 확인하는 구조다. 앱 코드가 아니라 플랫폼이 판정하므로 후킹으로 바꿀 수 없다.

\`\`\`
안드로이드   Play Integrity API — 기기·앱·라이선스 판정을 서버에서 검증
iOS         App Attest — 하드웨어 키로 앱 진정성 증명
공통 원칙   판정 결과를 서버가 받아 검증. 앱이 "괜찮다"고 말하는 것을 믿지 않는다
\`\`\`

\`\`\`ts
// 서버에서 증명 토큰을 검증하고, 결과에 따라 기능을 제한한다
const verdict = await verifyIntegrityToken(req.body.token)   // 플랫폼에 확인
if (verdict.appRecognition !== 'PLAY_RECOGNIZED') {
  await audit.log('integrity.fail', { device: verdict.deviceId, actor: actor.id })
  return limitedMode()          // 차단이 아니라 기능 제한이 실무적이다
}
\`\`\`

![검증 흐름](/img/posts/app-integrity-check-2.svg)

## 차단할지 제한할지 정한다

무결성 실패를 곧바로 차단하면 정상 사용자가 막히는 경우가 생긴다. 개발자용 기기, 일부 제조사 커스텀 롬, 기업용 관리 기기가 실패로 판정되기도 한다. 위험도에 따라 단계를 두는 것이 낫다.

| 판정 | 대응 |
| --- | --- |
| 정상 | 전 기능 |
| 판정 불가 | 전 기능 + 기록 |
| 기기 무결성 실패 | 결제·출금 제한 |
| 앱 변조 확인 | 차단 + 조사 |

## 진짜 방어는 서버에 있다

무결성 검증으로 막으려던 것들 — 자동화 요청, 비정상 거래, 시세 조작 — 은 대부분 서버에서 판정할 수 있다. 요청 빈도, 동작 순서, 값의 범위를 서버가 검증하면 클라이언트가 무엇이든 그 규칙을 벗어날 수 없다. 무결성 검증은 그 위에 얹는 보강 수단으로 두는 것이 맞다.

\`\`\`bash
# 서버 검증이 실제로 있는지 시험한다 — 앱 없이 API 를 직접 호출해 본다
curl -s -X POST https://stg.example.com/api/withdraw \\
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \\
  -d '{"amount": 999999}' | head -c 200
# 금액 상한·순서 검증이 서버에 있으면 여기서 거부된다
\`\`\`

## 실제로 이렇게 터진다

앱 위변조 검사를 클라이언트에서만 한 사례가 있다. 검사 함수 자체를 우회하는 수정판이 배포됐고, 서버는 그것을 구분하지 못했다.

또 하나는 검사를 강하게 걸어 정상 사용자가 차단된 경우다. 특정 기기 제조사의 커스텀 환경이 위변조로 판정됐다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 클라이언트 검사로 막힌다 | 검사 자체가 우회된다 |
| 위변조를 완전히 막을 수 있다 | 늦출 뿐이다 |
| 검사가 엄격할수록 좋다 | 정상 사용자가 막힌다 |
| 난독화하면 안전하다 | 시간을 벌 뿐이다 |
| 서버는 클라이언트를 믿어야 한다 | 믿지 않는 설계가 가능하다 |

## 계층별 역할

| 계층 | 역할 |
| --- | --- |
| 클라이언트 검사 | 대량 자동화 억제 |
| 플랫폼 무결성 증명 | 서버가 검증 가능한 신호 |
| 서버 검증 | 실제 판단 |
| 이상 탐지 | 우회된 경우 발견 |

클라이언트 검사 결과를 서버가 그대로 믿으면 의미가 없다. 플랫폼이 서명한 증명을 서버가 검증하는 방식이라야 한다.

## 서버에서 판단하기

| 신호 | 활용 |
| --- | --- |
| 플랫폼 무결성 증명 | 정품 앱·정상 환경 여부 |
| 행위 패턴 | 사람다운 속도인가 |
| 기기 일관성 | 갑자기 바뀌었나 |
| 요청 순서 | 화면 흐름과 맞나 |

가장 효과적인 것은 요청 순서 검증이다. 정상 앱이라면 거치는 단계가 있다. 그것을 건너뛴 요청은 수정판이거나 스크립트다.

## 차단 정책

| 판정 | 조치 |
| --- | --- |
| 확실한 위변조 | 차단 |
| 의심 | 추가 인증 요구 |
| 루팅 단말 | 기능 제한 |
| 판정 불가 | 정상 처리 + 기록 |

판정 불가를 차단하면 정상 사용자가 막힌다. 오래된 기기, 제조사 커스텀 환경, 일시적 네트워크 문제로 증명을 받지 못하는 경우가 있다.

## 무엇을 지키려는가

앱 위변조 대응은 목적을 분명히 해야 한다. 게임 부정 사용 방지와 금융 거래 보호는 필요한 수준이 다르다. 목적 없이 강하게 걸면 정상 사용자만 불편해진다.

가장 중요한 원칙은 하나다. 클라이언트가 무엇을 하든 서버가 허용하지 않으면 안 되도록 만든다.

## 참고

- Android 개발자 문서 — Play Integrity API
- Apple 문서 — Establishing your app's integrity (App Attest)
- OWASP MASVS — 복원력 요구사항과 그 한계`,
    diagram: {
      type: 'matrix',
      caption: '판정 위치',
      x: ['서버 검증', '클라이언트 판정'],
      y: ['플랫폼 서명 사용', '앱 코드 자체 판정'],
      cells: ['신뢰 가능', '우회 가능', '해당 없음', '우회 가능'],
    },
    diagram2: {
      type: 'flow',
      caption: '증명 검증',
      steps: [
        { label: '앱이 증명 요청', note: '운영체제에' },
        { label: '플랫폼이 서명', note: '앱이 못 바꿈' },
        { label: '서버가 검증', note: '플랫폼에 확인' },
        { label: '판정별 기능 제한', note: '차단은 최후' },
      ],
    },
  },
  {
    slug: 'certificate-pinning-ops',
    title: '모바일 인증서 고정 운영과 장애 대비',
    body: `인증서 고정은 통신 상대를 우리 서버로 못 박아, 신뢰된 기관이 발급한 다른 인증서로도 중간에서 볼 수 없게 만든다. 효과가 확실한 대신 운영 부담이 크다. 서버 인증서를 갱신했는데 앱이 고정한 값과 다르면, 배포된 모든 앱이 한꺼번에 통신 불가가 된다. 실제로 발생하는 대형 장애 유형이다.

## 무엇을 고정하느냐가 부담을 정한다

| 고정 대상 | 안전성 | 갱신 부담 |
| --- | --- | --- |
| 리프 인증서 | 가장 높음 | 갱신마다 앱 배포 |
| 중간 인증서 | 높음 | 기관 변경 시에만 |
| 공개키 해시 | 높음 | 키를 유지하면 부담 없음 |
| 루트 인증서 | 낮음 | 거의 없음 |

공개키 해시를 고정하고 갱신 시 같은 키를 재사용하면, 안전성을 유지하면서 갱신 부담이 사라진다. 실무에서 가장 널리 쓰이는 방식이다.

![고정 대상별 부담](/img/posts/certificate-pinning-ops.svg)

## 예비 핀을 반드시 함께 넣는다

핀을 하나만 넣으면 되돌릴 방법이 없다. 다음 갱신에 쓸 키를 미리 만들어 그 해시를 함께 넣어 두면, 갱신 시 앱 배포 없이 넘어갈 수 있다.

\`\`\`
현재 핀    운영 중인 공개키 해시
예비 핀    다음 갱신에 쓸 키의 해시 (미리 생성해 오프라인 보관)
만료       핀 집합에 유효 기간을 두고, 기간이 지나면 고정을 해제
\`\`\`

\`\`\`xml
<!-- 안드로이드 네트워크 보안 설정 — 예비 핀과 만료를 함께 지정 -->
<domain-config>
  <domain includeSubdomains="true">api.example.com</domain>
  <pin-set expiration="2027-06-30">
    <pin digest="SHA-256">AAAA…현재키…</pin>
    <pin digest="SHA-256">BBBB…예비키…</pin>
  </pin-set>
</domain-config>
\`\`\`

만료를 지정하는 이유는 안전장치다. 앱을 갱신하지 않는 사용자가 통신 불가가 되는 상황을 막는다.

![예비 핀 운영](/img/posts/certificate-pinning-ops-2.svg)

## 어디에 적용하고 어디에 하지 않는가

전 통신에 고정을 걸면 부담이 크고, 외부 서비스 호출에서 문제가 생긴다. 우리가 통제하는 도메인에만 적용한다.

| 대상 | 적용 |
| --- | --- |
| 우리 API 도메인 | 적용 |
| 우리 정적 자산 도메인 | 선택 |
| 결제·인증 외부 서비스 | 적용하지 않음(상대가 갱신을 통제) |
| 분석·광고 | 적용하지 않음 |

## 키와 해시를 어떻게 확인하는가

배포 전에 서버에서 값을 뽑아 앱 설정과 대조한다. 이 대조를 배포 점검 항목에 넣으면 장애를 막을 수 있다.

\`\`\`bash
# 현재 서버 공개키 해시 — 앱에 넣은 값과 같아야 한다
openssl s_client -connect api.example.com:443 -servername api.example.com </dev/null 2>/dev/null |
  openssl x509 -pubkey -noout |
  openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl base64

# 인증서 만료일 — 갱신 일정과 핀 만료를 함께 관리한다
echo | openssl s_client -connect api.example.com:443 2>/dev/null |
  openssl x509 -noout -dates -subject
\`\`\`

## 실제로 이렇게 터진다

인증서를 고정해 둔 앱이 갱신 시점에 전면 장애를 일으킨 사례가 있다. 서버 인증서가 바뀌었는데 앱은 옛 값만 알고 있었다. 앱 업데이트가 배포되고 사용자가 설치할 때까지 접속이 안 됐다.

또 하나는 고정을 도입했지만 백업 값을 두지 않은 경우다. 긴급 교체가 필요할 때 방법이 없었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 고정하면 안전해진다 | 운영 부담이 크다 |
| 인증서를 고정한다 | 공개키를 고정하는 편이 낫다 |
| 백업은 필요 없다 | 없으면 교체 시 장애 |
| 만료를 안 봐도 된다 | 만료 전에 갱신해야 한다 |
| 모든 앱에 필요하다 | 위험 대비 부담을 따져야 한다 |

## 무엇을 고정하나

| 대상 | 특성 |
| --- | --- |
| 최종 인증서 | 갱신마다 변경 — 부담 큼 |
| 중간 인증서 | 상대적으로 안정 |
| 공개키 | 키를 유지하면 갱신해도 동일 |

공개키 고정이 실무적이다. 인증서를 갱신할 때 키를 재사용하면 값이 바뀌지 않는다.

## 필수 준비

| 항목 | 내용 |
| --- | --- |
| 백업 핀 | 다음에 쓸 키의 값을 미리 포함 |
| 만료 관리 | 앱 배포 주기보다 여유 있게 |
| 원격 해제 | 서버 신호로 고정을 끌 수 있게 |
| 모니터링 | 검증 실패율 감시 |
| 롤백 계획 | 장애 시 절차 |

백업 핀과 원격 해제 둘 중 하나는 반드시 있어야 한다. 없으면 사고 시 앱 업데이트 배포와 사용자 설치를 기다리는 수밖에 없다.

## 값 확인

\`\`\`bash
# 공개키 핀 값 계산 — 현재 값과 다음에 쓸 키 둘 다 구해 둔다
openssl s_client -connect api.example.com:443 -servername api.example.com </dev/null 2>/dev/null \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | openssl base64
\`\`\`

## 도입 판단

| 상황 | 권장 |
| --- | --- |
| 금융·의료 앱 | 도입 |
| 중간자 공격 위험이 실제로 높은 환경 | 도입 |
| 일반 서비스 | 신중히 — 부담이 이득보다 클 수 있다 |
| 배포 주기가 긴 앱 | 비권장 |

배포 주기가 길고 운영 인력이 적으면 고정이 오히려 가용성 위험을 만든다. 도입 전에 인증서 갱신 절차와 앱 배포 주기를 함께 놓고 판단한다.

## 운영 절차

1. 인증서 갱신 일정을 앱 배포 일정과 맞춘다
2. 새 키를 백업 핀으로 먼저 배포한다
3. 사용자 대부분이 새 버전으로 옮긴 뒤 서버 인증서를 교체한다
4. 검증 실패율을 감시한다
5. 다음 백업 핀을 준비한다

## 참고

- OWASP — Certificate and Public Key Pinning 지침
- Android 개발자 문서 — Network Security Configuration
- Apple 문서 — Identity Pinning`,
    diagram: {
      type: 'bars',
      caption: '고정 대상별 갱신 부담(상대값)',
      unit: '상대값',
      items: [
        { label: '리프 인증서', value: 40, note: '앱 배포 필요' },
        { label: '중간 인증서', value: 20 },
        { label: '공개키(키 재사용)', value: 5, note: '권장' },
        { label: '루트', value: 2, note: '효과 낮음' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '핀 구성',
      x: ['예비 핀 있음', '없음'],
      y: ['만료 지정', '만료 없음'],
      cells: ['안전 운영', '갱신 시 장애', '되돌릴 수 있음', '전면 통신 불가'],
    },
  },
]
