import type { SeedPost } from './types'

/** 101~110 — 웹 취약점 심화 */
export const posts11: SeedPost[] = [
  {
    slug: 'cors-credentials',
    title: 'CORS 설정 실수와 인가 우회 경로',
    body: `CORS 는 접근 통제가 아니라 브라우저가 응답을 읽게 해줄지를 정하는 규칙이다. 서버가 인가를 제대로 하지 않으면 CORS 를 아무리 좁혀도 막히지 않고, 반대로 CORS 를 넓게 열면 로그인한 사용자의 응답이 공격자 사이트로 읽힌다. 가장 위험한 조합은 요청 출처를 그대로 되돌려주면서 자격 증명을 허용하는 설정이다.

## 왜 이 설정이 반복해서 뚫리는가?

개발 중 "일단 열어두자"로 시작한 설정이 그대로 운영에 나간다. 특히 다음 두 줄이 함께 있으면 사실상 모든 사이트에 API 를 개방한 것과 같다.

- 요청의 Origin 헤더를 검증 없이 Access-Control-Allow-Origin 에 반영
- Access-Control-Allow-Credentials 를 true 로 설정

브라우저는 와일드카드와 자격 증명 조합은 거부하지만, 출처를 그대로 되돌려주는 방식은 정상 응답으로 처리한다. 규격을 우회한 것이 아니라 서버가 스스로 허용한 것이다.

![요청 출처 반영 방식과 허용 목록 방식의 차이](/img/posts/cors-credentials.svg)

## 설정별 위험도

| 설정 | 자격 증명 | 결과 |
| --- | --- | --- |
| 고정 허용 목록 | 허용 | 안전. 목록 관리 필요 |
| 요청 Origin 반영 | 허용 | 모든 사이트가 응답을 읽는다 |
| 와일드카드 | 허용 | 브라우저가 거부해 기능이 깨진다 |
| 와일드카드 | 미허용 | 공개 API 에만 적합 |
| null 허용 | 허용 | 샌드박스 iframe 에서 악용된다 |

## 부분 문자열 검사가 위험한 이유

\`origin.endsWith('example.com')\` 같은 검사는 \`evil-example.com\` 을 통과시킨다. \`startsWith('https://example.com')\` 은 \`https://example.com.evil.net\` 을 통과시킨다. 출처는 문자열 포함 관계가 아니라 정확히 일치하는지로 판단해야 한다.

## 프리플라이트를 신뢰하지 말 것

프리플라이트는 브라우저의 예의이지 보안 경계가 아니다. 브라우저가 아닌 클라이언트는 프리플라이트 없이 바로 본 요청을 보낸다. 따라서 상태를 바꾸는 요청은 CORS 와 무관하게 토큰이나 CSRF 방어로 별도 검증해야 한다.

## 무엇을 먼저 고쳐야 하는가

1. 자격 증명을 허용하는 엔드포인트 목록을 만든다
2. 그 엔드포인트의 허용 출처를 고정 목록으로 바꾼다
3. Vary: Origin 을 붙여 캐시가 다른 출처에 응답을 재사용하지 않게 한다
4. 노출 헤더와 허용 메서드를 실제 쓰는 것만 남긴다

## 바로 확인하기

임의 출처를 보내보고 응답 헤더가 그대로 되돌아오는지 본다. 되돌아오면 설정 오류다.

\`\`\`bash
# 임의 출처를 보냈을 때 그대로 반영되는지
curl -sI https://api.example.com/me \\
  -H 'Origin: https://evil.test' | grep -i 'access-control-allow-'

# 기대: 헤더가 없거나 허용 목록의 출처만 나온다
# 위험: access-control-allow-origin: https://evil.test
#       access-control-allow-credentials: true

# null 출처 허용 여부
curl -sI https://api.example.com/me -H 'Origin: null' | grep -i allow-origin
\`\`\`

허용 목록 방식으로 바꾸는 코드는 짧다. 정확히 일치하는지만 본다.

\`\`\`ts
const ALLOWED = new Set(['https://app.example.com', 'https://admin.example.com'])

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && ALLOWED.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }
  next()
})
\`\`\`

## 실제로 이렇게 터진다

요청 출처를 그대로 응답에 돌려주고 자격 증명 허용까지 켠 사례가 있다. 여러 협력사 도메인을 허용해야 해서 목록 대신 요청 헤더를 반사한 것이다. 그러면 모든 사이트가 허용된 것과 같고, 피해자가 그 사이트를 방문하는 순간 우리 API 를 피해자 권한으로 호출할 수 있다.

접두 일치로 검증한 경우도 뚫린다. 우리 도메인으로 시작하는지만 확인하면 공격자가 그 문자열을 포함한 도메인을 등록하면 된다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| CORS 는 서버를 보호한다 | 브라우저의 읽기를 제한할 뿐이다 |
| 출처를 반사해도 안전하다 | 전체 허용과 같다 |
| 접두 일치면 충분하다 | 문자열을 포함한 도메인 등록이 가능하다 |
| null 출처는 무해하다 | 샌드박스 프레임이 보낸다 |
| 사전 요청이 막아 준다 | 단순 요청에는 사전 요청이 없다 |

## 위험한 조합

| 출처 설정 | 자격 증명 허용 | 결과 |
| --- | --- | --- |
| 정확한 목록 | 허용 | 안전 |
| 정확한 목록 | 미허용 | 안전 |
| 반사 | 허용 | 전면 노출 |
| 와일드카드 | 허용 | 브라우저가 거부(설정 오류) |
| 와일드카드 | 미허용 | 공개 API 로만 |

반사와 자격 증명 허용이 만나는 지점이 사고다. 둘 중 하나만 있으면 피해가 제한된다.

## 올바른 구현

\`\`\`ts
const ALLOWED = new Set(['https://app.example.com', 'https://admin.example.com'])

app.use((req, res, next) => {
  const origin = req.headers.origin
  // 정확히 일치하는 것만. 반사도 접두 비교도 하지 않는다.
  if (origin && ALLOWED.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')          // 캐시가 출처별로 나뉘게
  }
  next()
})
\`\`\`

Vary 헤더가 빠지면 캐시가 한 출처의 응답을 다른 출처에 준다.

## 점검 절차

\`\`\`bash
# 임의 출처를 반사하는지
for o in https://evil.example https://app.example.com.evil.example null; do
  printf '%-36s ' "$o"
  curl -sI https://api.example.com/me -H "Origin: $o" |
    grep -i 'access-control-allow-origin' | tr -d '\r'
  echo
done
# 첫 번째나 두 번째가 그대로 돌아오면 취약하다
\`\`\`

## 참고

- MDN — Cross-Origin Resource Sharing (CORS)
- Fetch Standard, CORS protocol
- OWASP Cheat Sheet — HTML5 Security, CORS`,
    diagram: {
      type: 'matrix',
      caption: '출처 검사 방식과 자격 증명 허용',
      x: ['자격 증명 허용', '자격 증명 미허용'],
      y: ['요청 출처 반영', '고정 허용 목록'],
      cells: ['응답이 그대로 유출', '공개 API 라면 무해', '안전한 기본값', '과도하게 좁아 기능 장애'],
    },
  },
  {
    slug: 'clickjacking-defense',
    title: '클릭재킹 방어와 프레임 차단 헤더',
    body: `클릭재킹은 내 화면을 투명하게 덮어 사용자가 다른 것을 누르게 만드는 공격이다. 방어는 헤더 한 줄로 끝나지만, 그 한 줄을 어디에 붙이는지가 문제다. 로그인·결제·권한 변경처럼 클릭 한 번이 상태를 바꾸는 화면에 프레임 차단이 빠져 있는 경우가 대부분이다.

## 어떻게 공격이 성립하는가?

공격자 페이지가 우리 사이트를 iframe 으로 불러온 뒤 투명하게 만들고, 그 위에 "무료 쿠폰 받기" 같은 미끼를 겹친다. 사용자는 미끼를 누르지만 실제 클릭은 아래에 깔린 우리 사이트의 버튼에 들어간다. 사용자가 이미 로그인해 있으므로 요청은 정상 세션으로 처리된다.

CSRF 토큰은 이 공격을 막지 못한다. 요청을 위조하는 것이 아니라 진짜 사용자가 진짜 화면을 누르게 만드는 것이기 때문이다.

![투명 프레임 위에 미끼를 겹치는 구조](/img/posts/clickjacking-defense.svg)

## 방어 수단 비교

| 수단 | 효과 | 비고 |
| --- | --- | --- |
| Content-Security-Policy: frame-ancestors | 표준. 출처별 허용 가능 | 최신 브라우저 기준 |
| X-Frame-Options: DENY | 단순 차단 | 구형 호환용으로 함께 유지 |
| X-Frame-Options: ALLOW-FROM | 지원 중단 | 쓰지 말 것 |
| 자바스크립트 프레임 탈출 | 우회 가능 | 보조 수단 |
| SameSite 쿠키 | 부분적 | 프레임 자체를 막지 못한다 |

## 어디에 붙여야 하는가

전체 응답에 기본값으로 프레임 차단을 넣고, 임베드가 필요한 경로만 예외로 푸는 순서가 안전하다. 반대로 하면 새로 만든 화면이 항상 무방비로 나간다.

\`\`\`
기본      Content-Security-Policy: frame-ancestors 'none'
임베드    frame-ancestors https://partner.example.com
로그인    항상 'none' — 예외 없음
결제      항상 'none' — 예외 없음
\`\`\`

## 중요한 동작에는 한 겹 더

프레임 차단과 별개로, 되돌릴 수 없는 동작에는 확인 단계를 둔다. 비밀번호 재입력이나 문자 입력 같은 절차는 사용자가 무엇을 하는지 인식하게 만들어 클릭 한 번으로 끝나는 공격을 무력화한다.

## 바로 확인하기

주요 화면의 헤더를 한 번에 훑는다. 결제·로그인·설정 변경 경로가 비어 있으면 바로 고친다.

\`\`\`bash
for p in / /login /settings /payments/new; do
  printf '%-16s ' "$p"
  curl -sI "https://app.example.com$p" \\
    | grep -iE 'x-frame-options|content-security-policy' \\
    | tr -d '\\r' | paste -sd' ' - || echo '없음'
done
\`\`\`

프레임에 실제로 들어가는지 직접 확인하는 것이 가장 확실하다.

\`\`\`html
<!-- 로컬 파일로 열어 화면이 뜨면 방어가 없는 것이다 -->
<iframe src="https://app.example.com/settings" width="800" height="600"></iframe>
\`\`\`

## 실제로 이렇게 터진다

관리자 화면이 프레임 차단 없이 열려 있던 사례가 있다. 공격자는 투명한 프레임으로 그 화면을 덮고 그 위에 다른 버튼을 놓았다. 관리자가 무해해 보이는 버튼을 누르면 실제로는 프레임 안의 권한 부여 버튼이 눌렸다.

헤더를 붙였는데 효과가 없던 경우도 있다. 옛 헤더만 설정하고 새 정책 지시어를 빼서, 일부 브라우저에서만 동작했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 로그인해야 보이는 화면은 안전하다 | 피해자가 로그인 상태다 |
| 옛 헤더 하나면 충분하다 | 정책 지시어가 표준이다 |
| 프레임 안에서 못 읽으니 무해하다 | 클릭을 훔치는 것이 목적이다 |
| 시각적으로 눈치챈다 | 투명하게 겹친다 |
| 모바일 앱은 무관하다 | 웹뷰가 같은 문제를 갖는다 |

## 무엇을 설정하는가

| 설정 | 역할 |
| --- | --- |
| frame-ancestors | 표준, 어느 사이트가 프레임에 넣을 수 있는지 |
| X-Frame-Options | 옛 브라우저 대비 |
| SameSite 쿠키 | 프레임 안 요청에 쿠키가 안 붙게 |
| 민감 동작 재인증 | 클릭만으로 끝나지 않게 |

프레임을 막는 것과 함께, 되돌릴 수 없는 동작에 재인증을 붙이면 한 번의 클릭으로 끝나지 않는다.

\`\`\`
Content-Security-Policy: frame-ancestors 'self';
X-Frame-Options: SAMEORIGIN
\`\`\`

## 점검 절차

\`\`\`bash
# 주요 경로에서 프레임 차단이 실제로 붙는지
for p in / /admin /admin/users /settings; do
  printf '%-16s ' "$p"
  h=$(curl -sI "https://example.com$p")
  echo "$h" | grep -qi 'frame-ancestors' && printf 'CSP ' || printf '--- '
  echo "$h" | grep -qi 'x-frame-options' && printf 'XFO' || printf '---'
  echo
done
\`\`\`

정적 페이지와 오류 페이지에서 빠지는 경우가 많으니 대표 경로를 여럿 확인한다.

## 참고

- MDN — CSP frame-ancestors
- OWASP Cheat Sheet — Clickjacking Defense
- RFC 7034 — X-Frame-Options`,
    diagram: {
      type: 'layers',
      caption: '클릭재킹 방어 계층',
      layers: [
        { label: 'frame-ancestors 기본 차단', note: '모든 응답에 적용' },
        { label: 'X-Frame-Options 병행', note: '구형 브라우저 대비' },
        { label: '중요 동작 재확인', note: '비밀번호·문자 인증' },
        { label: '감사 로그', note: '이상 요청 사후 추적' },
      ],
    },
  },
  {
    slug: 'open-redirect',
    title: '오픈 리다이렉트와 피싱 연결 고리',
    body: `오픈 리다이렉트는 단독으로는 사소해 보이지만, 우리 도메인의 신뢰를 공격자에게 빌려주는 통로가 된다. 메일 필터와 사용자 모두 도메인을 보고 판단하기 때문에, 정상 도메인으로 시작하는 링크는 피싱 성공률을 크게 끌어올린다. 이동 대상은 사용자 입력이 아니라 서버가 가진 목록에서 골라야 한다.

## 어디에서 주로 생기는가?

- 로그인 후 돌아갈 주소를 쿼리 파라미터로 받는 곳
- 로그아웃·약관 동의·본인 인증처럼 여러 화면을 거쳐 되돌아오는 흐름
- 외부 링크 클릭 통계를 남기는 중계 주소
- OAuth 클라이언트의 리다이렉트 URI 검증이 느슨한 경우

로그인 흐름의 next 파라미터가 가장 흔하다. 인증 성공 직후이므로 사용자의 경계심이 가장 낮은 시점에 외부로 튕겨나간다.

![입력 기반 이동과 목록 기반 이동](/img/posts/open-redirect.svg)

## 우회되는 검사들

| 검사 방식 | 통과하는 입력 |
| --- | --- |
| http 로 시작하는지 확인 | //evil.test |
| 도메인 포함 여부 | https://evil.test/example.com |
| 앞부분 일치 | https://example.com.evil.test |
| 도메인 끝 일치 | https://evilexample.com |
| 한 번만 디코딩 | %252f%252fevil.test |

공통점은 문자열로 판단했다는 것이다. 주소는 파싱한 뒤 호스트를 정확히 비교해야 하고, 애초에 전체 주소를 받지 않는 편이 낫다.

## 가장 안전한 설계

이동 대상을 키로만 받는다. 사용자는 \`?next=orders\` 를 보내고 서버가 \`/orders\` 로 바꾼다. 목록에 없으면 기본 화면으로 보낸다. 외부로 나가야 한다면 중간에 "외부 사이트로 이동합니다" 안내 화면을 두고 대상 도메인을 그대로 보여준다.

## 바로 확인하기

대표적인 우회 문자열을 넣어 응답의 Location 헤더를 본다. 외부 호스트가 나오면 취약하다.

\`\`\`bash
for u in '//evil.test' 'https://evil.test' '/\\evil.test' 'https:/\\evil.test' '%2f%2fevil.test'; do
  printf '%-24s ' "$u"
  curl -sI "https://app.example.com/login?next=$u" | grep -i '^location:' | tr -d '\\r'
  echo
done
\`\`\`

서버 쪽은 목록 조회로 단순화한다.

\`\`\`ts
const NEXT: Record<string, string> = {
  orders: '/orders',
  settings: '/settings',
  dashboard: '/',
}

function redirectAfterLogin(key: string | undefined) {
  return NEXT[key ?? ''] ?? '/'
}
\`\`\`

## 실제로 이렇게 터진다

로그인 후 원래 페이지로 돌려보내는 파라미터가 검증되지 않은 사례가 있다. 우리 도메인으로 시작하는 링크라 사용자는 믿었고, 로그인 뒤 공격자 사이트로 이동했다. 그 사이트는 우리 로그인 화면을 그대로 흉내 냈다.

토큰이 함께 새는 경우도 있다. 리다이렉트 시 쿼리에 있던 값이 리퍼러로 전달됐다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 리다이렉트는 피해가 없다 | 피싱의 신뢰를 빌려준다 |
| 우리 도메인으로 시작하면 안전하다 | 문자열 검사로는 부족하다 |
| 상대 경로만 받으면 된다 | 두 슬래시로 시작하면 절대 주소다 |
| 인코딩을 풀면 걸러진다 | 이중 인코딩이 있다 |
| 경고 페이지를 두면 된다 | 사용자는 대개 넘긴다 |

## 검증 방법

목록 방식이 가장 안전하다. 자유 입력을 받아야 한다면 파싱해서 호스트를 비교한다.

\`\`\`ts
const ALLOWED_HOSTS = new Set(['example.com', 'app.example.com'])

function safeRedirect(next: string, fallback = '/'): string {
  // 상대 경로만 허용하는 것이 가장 단순하고 안전하다
  if (/^\/(?!\/)/.test(next)) return next

  try {
    const u = new URL(next, 'https://example.com')
    if (u.protocol !== 'https:') return fallback
    if (!ALLOWED_HOSTS.has(u.hostname)) return fallback     // 정확히 일치
    return u.toString()
  } catch {
    return fallback
  }
}
\`\`\`

정규식 \`^\/(?!\/)\` 가 핵심이다. 슬래시 하나로 시작하되 둘은 아닌 것만 상대 경로다.

## 어디를 확인하는가

| 자리 | 흔한 이름 |
| --- | --- |
| 로그인 후 이동 | next, redirect, return, continue |
| 로그아웃 후 | logout_redirect |
| 외부 연동 콜백 | callback, redirect_uri |
| 단축 링크 | url, target |
| 오류 후 복귀 | back, from |

\`\`\`bash
# 리다이렉트가 검증되는지 시험한다
for n in '//evil.example' 'https://evil.example' '/\evil.example' 'https:/\/\evil.example'; do
  printf '%-30s ' "$n"
  curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' \
    "https://stg.example.com/login?next=$(printf %s "$n" | jq -sRr @uri)"
done
# 외부 주소가 redirect_url 에 나오면 취약하다
\`\`\`

## 참고

- OWASP Cheat Sheet — Unvalidated Redirects and Forwards
- CWE-601: URL Redirection to Untrusted Site
- OAuth 2.0 Security Best Current Practice, redirect URI 검증`,
    diagram: {
      type: 'flow',
      caption: '오픈 리다이렉트를 이용한 피싱 경로',
      steps: [
        { label: '정상 도메인 링크', note: '메일 필터 통과' },
        { label: '로그인 화면', note: 'next 파라미터 포함' },
        { label: '외부 이동', note: '경계심이 가장 낮은 시점', danger: true },
        { label: '자격 증명 입력', note: '복제된 화면', danger: true },
      ],
    },
  },
  {
    slug: 'idor-prevention',
    title: 'IDOR 방지를 위한 접근 통제 설계',
    body: `IDOR 은 주소의 식별자를 바꿨을 때 남의 데이터가 나오는 결함이다. 원인은 조회 쿼리에 소유자 조건이 빠진 것이고, 해결은 식별자를 추측하기 어렵게 만드는 것이 아니라 모든 조회에 소유자 조건을 강제하는 것이다. 자동 도구로는 찾기 어렵고 사람이 몰라도 되는 구조를 만드는 편이 빠르다.

## 왜 자동 점검으로 잡히지 않는가?

스캐너는 응답이 200 인지만 본다. 남의 주문서를 정상 형식으로 돌려주는 응답은 오류로 보이지 않는다. 두 개의 계정으로 같은 요청을 보내 결과를 비교해야 판별할 수 있는데, 이는 도구가 아니라 테스트 설계의 문제다.

![소유자 조건이 없는 조회와 있는 조회](/img/posts/idor-prevention.svg)

## 잘못된 대책과 올바른 대책

| 대책 | 효과 |
| --- | --- |
| 순번을 UUID 로 교체 | 추측만 어려워진다. 유출된 식별자에는 무력하다 |
| 프런트에서 버튼 숨김 | 요청을 직접 만들면 그만이다 |
| 응답 필드만 가림 | 조회 자체는 성공한다 |
| 조회 쿼리에 소유자 조건 | 근본 해결 |
| 데이터 계층에서 테넌트 강제 | 누락을 구조적으로 방지 |

## 데이터 계층에서 막는다

접근 통제를 각 핸들러에 맡기면 새 기능마다 누락이 생긴다. 조회 함수가 항상 현재 사용자 맥락을 요구하도록 만들면, 조건을 빼먹은 코드는 컴파일이나 리뷰 단계에서 드러난다.

\`\`\`
나쁨   findOrder(id)
좋음   findOrder(id, { ownerId })
더 좋음 withUser(ctx).orders.find(id)   ← 맥락 없이는 호출 불가
\`\`\`

## 권한 계층이 있을 때

관리자, 조직 소유자, 협업자처럼 여러 역할이 있으면 "본인 것"만으로는 부족하다. 역할별로 허용 범위를 표로 정리하고, 그 표를 그대로 옮긴 판정 함수 하나를 두고 모든 경로가 그 함수를 통과하게 한다. 판정 로직이 두 곳에 있으면 반드시 갈라진다.

## 바로 확인하기

계정 두 개의 토큰으로 같은 자원을 요청해 결과를 비교한다. 회귀 테스트로 남겨야 재발하지 않는다.

\`\`\`bash
A=<사용자A 토큰>; B=<사용자B 토큰>
ID=$(curl -s -H "Authorization: Bearer $A" https://api.example.com/orders \\
     | python3 -c 'import sys,json;print(json.load(sys.stdin)["items"][0]["id"])')

# 사용자 B 가 사용자 A 의 자원을 요청 — 404 또는 403 이어야 한다
curl -s -o /dev/null -w '%{http_code}\\n' \\
  -H "Authorization: Bearer $B" "https://api.example.com/orders/$ID"
\`\`\`

수정 계열 메서드도 함께 본다. 조회는 막혔는데 PATCH 나 DELETE 가 열려 있는 경우가 흔하다.

\`\`\`bash
for m in GET PATCH DELETE; do
  printf '%-7s ' $m
  curl -s -o /dev/null -w '%{http_code}\\n' -X $m \\
    -H "Authorization: Bearer $B" "https://api.example.com/orders/$ID"
done
\`\`\`

## 실제로 이렇게 터진다

파일 다운로드 주소가 순차 번호였던 사례가 있다. 자기 파일을 내려받은 뒤 번호를 하나씩 바꾸자 다른 회사의 계약서가 나왔다. 인증은 통과했고 파일 소유 확인만 빠져 있었다.

식별자를 무작위로 바꿔 해결했다고 판단한 경우도 있다. 추측은 어려워졌지만 유출된 식별자에는 여전히 무력했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 무작위 식별자면 해결된다 | 늦출 뿐, 소유 확인이 필요하다 |
| 목록에 없으면 접근 못 한다 | 상세 조회는 별개 경로다 |
| 조회만 막으면 된다 | 수정·삭제·다운로드가 남는다 |
| 프런트에서 필터링한다 | 응답은 이미 나갔다 |
| 관리자 API 는 숨겨져 있다 | 번들에 경로가 있다 |

## 어디에 검사를 두는가

| 방식 | 안전성 | 이유 |
| --- | --- | --- |
| 조회 후 소유 비교 | 낮음 | 빠뜨리기 쉽고 존재가 노출된다 |
| 질의 조건에 소유 포함 | 높음 | 없으면 결과가 0건 |
| 데이터 계층에서 강제 | 매우 높음 | 우회 질의도 덮인다 |
| 데이터베이스 정책 | 가장 높음 | 애플리케이션 밖에서도 적용 |

질의 조건에 넣는 방식이 실무적 최선이다. 조회 후 비교는 검사를 빠뜨린 코드가 그대로 통과한다.

\`\`\`ts
// 위험 — 먼저 가져오고 나중에 비교한다
const file = await db.file.findUnique({ where: { id } })
if (file.ownerId !== actor.id) throw new Forbidden()

// 안전 — 소유 조건이 질의에 들어간다
const file = await db.file.findFirst({ where: { id, ownerId: actor.id } })
if (!file) return res.status(404).end()      // 존재 여부도 숨긴다
\`\`\`

404 를 주는 것도 의도적이다. 403 은 그 식별자의 자원이 존재한다는 정보를 준다.

## 회귀를 막는 시험

\`\`\`bash
# 다른 사용자의 자원에 접근되는지 — 메서드별로 확인한다
for m in GET PUT PATCH DELETE; do
  printf '%-7s ' "$m"
  curl -s -o /dev/null -w '%{http_code}\n' -X "$m" \
    "https://stg.example.com/api/files/$OTHER_USERS_FILE_ID" \
    -H "Authorization: Bearer $TOKEN_A"
done
# 전부 404 여야 한다. 200 이나 403 이 나오면 검토 대상이다
\`\`\`

## 참고

- OWASP API Security Top 10 — API1 Broken Object Level Authorization
- CWE-639: Authorization Bypass Through User-Controlled Key
- OWASP Cheat Sheet — Authorization Testing Automation`,
    diagram: {
      type: 'steps',
      caption: 'IDOR 을 구조적으로 막는 순서',
      steps: [
        { label: '자원 목록 작성', note: '식별자를 받는 모든 엔드포인트' },
        { label: '소유 관계 정의', note: '누가 어떤 역할로 접근하는가' },
        { label: '판정 함수 단일화', note: '경로마다 흩어진 검사 제거' },
        { label: '두 계정 회귀 테스트', note: '조회·수정·삭제 모두' },
      ],
    },
  },
  {
    slug: 'mass-assignment',
    title: '대량 할당 취약점과 입력 허용 목록',
    body: `대량 할당은 요청 본문을 객체에 그대로 붙여 넣을 때 생긴다. 사용자가 보내지 않아야 할 필드를 끼워 넣으면 등급, 권한, 잔액, 승인 상태가 함께 바뀐다. 방어는 받지 말 것을 막는 차단 목록이 아니라, 받을 것만 정하는 허용 목록이다.

## 왜 프레임워크 편의 기능이 위험해지는가?

객체 병합 한 줄로 갱신을 처리하면 코드가 짧아진다. 문제는 모델에 필드가 추가될 때다. 새 필드가 자동으로 갱신 대상에 포함되고, 그 필드가 권한이나 금액이면 그날부터 취약해진다. 취약점이 도입되는 시점이 코드를 쓴 시점이 아니라 나중이라는 점이 이 결함의 특징이다.

![요청 본문 병합과 허용 목록 추출](/img/posts/mass-assignment.svg)

## 위험한 필드 유형

| 유형 | 예시 | 결과 |
| --- | --- | --- |
| 권한 | role, isAdmin, scopes | 권한 상승 |
| 소속 | tenantId, orgId | 다른 조직 데이터 접근 |
| 금액 | price, discount, balance | 금전 손실 |
| 상태 | approved, verified, paid | 검증 절차 우회 |
| 식별 | id, userId, ownerId | 소유자 변경 |
| 시각 | createdAt, deletedAt | 이력 조작 |

## 허용 목록을 코드로 강제한다

스키마 검증기를 입구에 두고, 정의되지 않은 필드는 통과시키지 않도록 설정한다. 검증을 통과한 값만 도메인 객체로 넘기면 모델에 필드가 추가돼도 자동으로 새는 일이 없다.

## 응답에도 같은 원칙이 필요하다

입력만 막고 응답을 그대로 내보내면 내부 필드가 노출된다. 비밀번호 해시, 내부 메모, 다른 사용자의 식별자가 API 응답에 남아 있는 사례가 많다. 직렬화도 허용 목록으로 처리한다.

## 바로 확인하기

정상 요청에 권한 필드를 하나 끼워 보낸다. 응답이나 이후 조회에 반영되면 취약하다.

\`\`\`bash
# 프로필 수정 요청에 role 을 끼워 넣는다
curl -s -X PATCH https://api.example.com/me \\
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \\
  -d '{"nickname":"tester","role":"admin","tenantId":"other-org"}'

# 반영됐는지 다시 조회 — role 이 admin 이면 취약
curl -s -H "Authorization: Bearer $TOKEN" https://api.example.com/me
\`\`\`

서버는 정의된 필드만 뽑아 쓴다. 알 수 없는 키는 조용히 버리지 않고 거부하는 편이 디버깅에 유리하다.

\`\`\`ts
import { z } from 'zod'

const PatchMe = z.object({
  nickname: z.string().min(1).max(20),
  bio: z.string().max(200).optional(),
}).strict() // 정의되지 않은 필드가 있으면 실패

app.patch('/me', async (req, res) => {
  const parsed = PatchMe.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' })
  await users.update(req.user.id, parsed.data) // 검증된 값만 전달
  res.json({ ok: true })
})
\`\`\`

## 실제로 이렇게 터진다

프로필 수정 API 가 요청 본문을 그대로 모델에 넘긴 사례가 있다. 화면에는 이름과 소개만 있었지만, 요청에 역할 필드를 추가하자 그대로 반영됐다. 사용자가 스스로 관리자가 됐다.

결제 관련 필드가 노출된 경우도 있다. 주문 생성 시 금액 필드를 함께 보내면 서버가 받아들였다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 화면에 없으면 안 보낸다 | 요청은 직접 만든다 |
| 모델이 알아서 걸러 준다 | 기본은 전부 허용이다 |
| 필요한 것만 검증하면 된다 | 허용 목록이어야 한다 |
| 생성만 조심하면 된다 | 수정이 더 위험하다 |
| 중첩 객체는 안 넘어간다 | 관계까지 함께 반영되는 경우가 있다 |

## 허용 목록으로 바꾸기

받을 필드를 명시하는 것이 유일한 해법이다. 제외 목록은 필드가 늘어날 때마다 빠진다.

\`\`\`ts
// 위험 — 요청 본문 전체를 넘긴다
await db.user.update({ where: { id }, data: req.body })

// 안전 — 스키마로 받을 것만 정의하고, 그 밖은 거부한다
const Patch = z.object({
  name: z.string().min(1).max(60),
  bio: z.string().max(500).optional(),
}).strict()                       // 정의되지 않은 키가 오면 실패

const data = Patch.parse(req.body)
await db.user.update({ where: { id: actor.id }, data })
\`\`\`

\`.strict()\` 가 중요하다. 모르는 필드를 조용히 무시하면 공격 시도가 로그에도 안 남는다.

## 응답에도 같은 원칙

입력만 좁히고 출력을 열어 두면 정보가 샌다.

\`\`\`ts
const PUBLIC_FIELDS = ['id', 'name', 'bio', 'avatarUrl'] as const
return res.json(pick(user, PUBLIC_FIELDS))
\`\`\`

## 점검 절차

\`\`\`bash
# 권한 필드를 함께 보내 반영되는지 확인한다
curl -s -X PATCH https://stg.example.com/api/me \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"test","role":"admin","emailVerified":true,"credits":999999}'
curl -s https://stg.example.com/api/me -H "Authorization: Bearer $TOKEN" |
  python3 -c 'import sys,json;d=json.load(sys.stdin);print({k:d.get(k) for k in ("role","emailVerified","credits")})'
# 값이 바뀌었으면 대량 할당이 가능한 것이다
\`\`\`

## 참고

- OWASP API Security Top 10 — API6 Mass Assignment
- CWE-915: Improperly Controlled Modification of Object Attributes
- OWASP Cheat Sheet — Input Validation`,
    diagram: {
      type: 'flow',
      caption: '요청 본문이 저장까지 가는 경로',
      steps: [
        { label: '요청 본문', note: '신뢰할 수 없는 입력' },
        { label: '스키마 검증', note: '허용 목록·초과 필드 거부' },
        { label: '도메인 처리', note: '권한 필드는 서버가 결정' },
        { label: '저장', note: '검증된 값만' },
      ],
    },
  },
  {
    slug: 'http-request-smuggling',
    title: 'HTTP 요청 스머글링과 프록시 불일치',
    body: `요청 스머글링은 앞단 프록시와 뒷단 서버가 하나의 요청을 서로 다르게 나눌 때 생긴다. 앞단이 요청 하나로 본 바이트가 뒷단에서 두 개로 쪼개지면, 뒤쪽 조각이 다음 사용자의 요청 앞에 붙는다. 결과는 인가 우회, 캐시 오염, 다른 사용자 응답 탈취다.

## 왜 서로 다르게 해석하는가?

요청 길이를 알려주는 방법이 두 가지이기 때문이다. Content-Length 와 Transfer-Encoding: chunked 가 함께 오면 규격은 chunked 를 따르라고 하지만, 구현에 따라 다르게 처리한다. 헤더 이름에 공백을 넣거나 값을 미묘하게 변형하면 한쪽만 인식하게 만들 수 있다.

![앞단과 뒷단의 요청 경계 해석 차이](/img/posts/http-request-smuggling.svg)

## 유형과 조건

| 유형 | 앞단 | 뒷단 | 결과 |
| --- | --- | --- | --- |
| CL.TE | Content-Length | chunked | 잔여 바이트가 다음 요청에 붙는다 |
| TE.CL | chunked | Content-Length | 본문 일부가 새 요청으로 해석된다 |
| TE.TE | chunked | chunked | 한쪽만 헤더 변형을 인식한다 |
| HTTP/2 다운그레이드 | h2 | HTTP/1.1 | 길이 정보 재생성 과정에서 불일치 |

## 근본 대책은 하나

앞단과 뒷단 사이를 같은 프로토콜로, 되도록 HTTP/2 로 유지하고 연결 재사용을 없애면 조각이 다음 요청에 붙을 자리가 사라진다. 다운그레이드가 불가피하면 앞단에서 모호한 요청을 통과시키지 않고 거부해야 한다.

\`\`\`
1순위   앞단·뒷단 모두 HTTP/2 유지
2순위   앞단이 모호한 요청을 거부 (CL+TE 동시 존재 시 400)
3순위   백엔드 연결 재사용 비활성화 — 성능 손실을 감수
피할 것 정규식으로 특정 변형만 차단
\`\`\`

## 캐시 오염과 결합되면 피해가 커진다

스머글링으로 만들어진 응답이 CDN 에 저장되는 캐시 오염이 함께 일어나면, 한 번의 요청이 모든 사용자에게 전달된다. 캐시 오염은 스머글링의 결과를 증폭시키는 경로이므로 캐시 키에 포함되지 않는 헤더로 응답이 달라지는 구조를 함께 점검해야 한다. 요청 경계를 바로잡은 뒤에도 캐시 오염 점검을 따로 해야 하는 이유다.

## 바로 확인하기

운영 트래픽에 영향을 줄 수 있으므로 스테이징에서, 사전 승인을 받고 진행한다. 먼저 모호한 요청을 앞단이 거부하는지만 본다.

\`\`\`bash
# Content-Length 와 Transfer-Encoding 을 함께 보낸다 — 400 이 정상
printf 'POST / HTTP/1.1\\r\\nHost: stg.example.com\\r\\nContent-Length: 6\\r\\nTransfer-Encoding: chunked\\r\\n\\r\\n0\\r\\n\\r\\nX' \\
  | openssl s_client -quiet -connect stg.example.com:443 2>/dev/null | head -1

# 헤더 이름 변형도 거부해야 한다
printf 'POST / HTTP/1.1\\r\\nHost: stg.example.com\\r\\nTransfer-Encoding : chunked\\r\\nContent-Length: 4\\r\\n\\r\\n1\\r\\nA\\r\\n0\\r\\n\\r\\n' \\
  | openssl s_client -quiet -connect stg.example.com:443 2>/dev/null | head -1
\`\`\`

응답 시간이 비정상적으로 길어지는 방식이 표준적인 탐지법이다. 시간 기반 확인은 다른 사용자에게 영향을 줄 수 있어 반드시 격리 환경에서 한다.

## 실제로 이렇게 터진다

앞단 프록시와 뒷단 서버가 요청 경계를 다르게 해석한 사례가 있다. 하나는 길이 헤더를, 다른 하나는 청크 인코딩을 우선했다. 공격자가 두 헤더를 모두 넣은 요청을 보내자, 뒷단은 요청 하나를 둘로 봤다. 남은 절반이 다음 사용자의 요청 앞에 붙어 그 사용자의 응답을 오염시켰다.

관리자 경로 접근에 쓰인 경우도 있다. 앞단에서 차단하는 경로를 밀반입한 절반에 담으면 뒷단이 그대로 처리했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 프록시가 있으면 안전하다 | 해석 차이가 원인이다 |
| HTTPS 면 막힌다 | 종단 간이 아니라 구간별이다 |
| 드문 공격이다 | 계층이 많을수록 흔해진다 |
| 앞단 차단으로 충분하다 | 밀반입된 요청은 앞단을 안 거친다 |
| 한 번 고치면 끝이다 | 구성 요소를 바꾸면 다시 본다 |

## 무엇이 원인인가

| 상황 | 해석 차이 |
| --- | --- |
| 두 헤더가 모두 존재 | 어느 것을 우선하는가 |
| 헤더 이름 변형 | 공백·대소문자 처리 |
| 청크 크기 표기 변형 | 관대한 파서와 엄격한 파서 |
| 헤더 중복 | 첫 값과 마지막 값 |

## 어떻게 막는가

1. 앞단과 뒷단의 HTTP 파서를 같은 계열로 맞춘다
2. 두 헤더가 함께 오면 거부한다 — 정상 요청에는 없다
3. 앞단에서 뒷단으로 HTTP/2 를 쓰면 경계 모호성이 줄어든다
4. 연결 재사용을 끄면 영향이 줄지만 성능 비용이 있다
5. 비정상 요청을 거부하고 로그로 남긴다

\`\`\`bash
# 두 헤더를 함께 보냈을 때 거부하는지 확인한다 (스테이징에서만)
printf 'POST /api/echo HTTP/1.1\r\nHost: stg.example.com\r\nContent-Length: 6\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\nX' |
  openssl s_client -quiet -connect stg.example.com:443 2>/dev/null | head -1
# 400 이 나와야 한다. 200 이면 둘 중 하나를 골라 처리한 것이다
\`\`\`

이 시험은 운영에서 하지 않는다. 다른 사용자의 요청에 영향을 줄 수 있다.

## 참고

- RFC 9112 — HTTP/1.1 Message Syntax, message body length
- PortSwigger Web Security Academy — HTTP request smuggling
- CWE-444: Inconsistent Interpretation of HTTP Requests`,
    diagram: {
      type: 'flow',
      caption: '요청 경계 불일치가 만드는 결과',
      steps: [
        { label: '모호한 요청', note: 'CL 과 TE 동시 존재' },
        { label: '앞단 프록시', note: '요청 하나로 판단' },
        { label: '뒷단 서버', note: '두 개로 분리', danger: true },
        { label: '다음 사용자', note: '조각이 앞에 붙는다', danger: true },
      ],
    },
  },
  {
    slug: 'race-condition-web',
    title: '웹 경쟁 조건과 멱등 처리 설계',
    body: `쿠폰이 두 번 쓰이고 잔액이 음수가 되는 사고는 대부분 검사와 실행 사이의 틈에서 생긴다. 동시에 들어온 요청이 같은 조건을 모두 통과한 뒤 각자 실행되기 때문이다. 방어는 애플리케이션에서 검사하는 것이 아니라 데이터베이스가 마지막 순간에 판정하도록 옮기는 것이다.

## 어디에서 자주 터지는가?

- 쿠폰·포인트 사용, 선착순 응모
- 잔액 차감과 출금
- 초대 코드, 일회용 링크
- 결제 승인과 주문 생성
- 팔로우·좋아요 같은 중복 방지 로직

공통 구조는 같다. "이미 썼는지 조회 → 안 썼으면 쓴 것으로 표시" 두 단계 사이에 다른 요청이 끼어든다.

![검사와 실행 사이의 틈](/img/posts/race-condition-web.svg)

## 대책 비교

| 방식 | 강도 | 비용 |
| --- | --- | --- |
| 애플리케이션 조회 후 검사 | 없음 | 낮음 |
| 유니크 제약 | 강함 | 낮음. 최우선 |
| 조건부 갱신 | 강함 | 낮음 |
| SELECT FOR UPDATE | 강함 | 잠금 경쟁 |
| 분산 락 | 중간 | 장애 시 이중 실행 위험 |
| 큐로 직렬화 | 강함 | 지연 증가 |

## 조건부 갱신이 가장 단순하다

갱신 문장 자체에 조건을 넣고, 영향받은 행이 0이면 실패로 처리한다. 애플리케이션은 판정하지 않고 결과만 확인한다. 잔액 차감, 상태 전이, 재고 감소 모두 이 형태로 쓸 수 있다.

## 멱등 키로 재시도를 흡수한다

네트워크 오류로 클라이언트가 같은 요청을 다시 보내는 것은 정상 동작이다. 요청마다 멱등 키를 받아 처리 결과를 저장하고, 같은 키가 다시 오면 저장된 결과를 돌려준다. 결제에서는 선택이 아니라 필수다.

## 바로 확인하기

동시 요청을 실제로 던져 본다. 순차 호출로는 절대 재현되지 않는다.

\`\`\`bash
# 같은 쿠폰을 동시에 20번 사용 — 성공이 2건 이상이면 결함
seq 20 | xargs -P 20 -I{} curl -s -o /dev/null -w '%{http_code}\\n' \\
  -X POST https://api.example.com/coupons/use \\
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \\
  -d '{"code":"WELCOME10"}' | sort | uniq -c
\`\`\`

서버는 조건부 갱신으로 바꾼다. 조회와 검사를 없애는 것이 요점이다.

\`\`\`sql
-- 사용되지 않은 상태일 때만 갱신된다. 영향 행이 0이면 이미 쓰인 쿠폰이다.
UPDATE coupons
   SET used_by = $1, used_at = now()
 WHERE code = $2
   AND used_by IS NULL;

-- 잔액도 같은 형태로. 음수 잔액이 구조적으로 불가능해진다.
UPDATE accounts
   SET balance = balance - $1
 WHERE id = $2
   AND balance >= $1;
\`\`\`

## 실제로 이렇게 터진다

쿠폰 한 장을 여러 번 쓴 사례가 있다. 사용 여부를 조회하고 처리한 뒤 사용 표시를 하는 순서였는데, 동시에 열 번 요청하면 열 번 모두 조회 시점에 미사용이었다. 잔액 차감, 재고 감소, 초대 코드에서 같은 일이 생긴다.

인출 한도를 우회한 경우도 있다. 한도 확인과 차감 사이에 다른 요청이 끼어들었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 트랜잭션이면 안전하다 | 격리 수준에 따라 다르다 |
| 조회 후 검사면 충분하다 | 그 사이에 바뀐다 |
| 사용자가 그렇게 못 보낸다 | 도구로 동시에 보낸다 |
| 애플리케이션 잠금이면 된다 | 인스턴스가 여럿이면 무의미하다 |
| 재시도로 해결된다 | 중복이 늘어난다 |

## 무엇으로 막는가

| 방법 | 적합 | 주의 |
| --- | --- | --- |
| 유일 제약 | 중복 생성 방지 | 가장 확실하다 |
| 조건부 갱신 | 잔액·재고 차감 | 영향 행 수를 확인 |
| 행 잠금 | 복잡한 갱신 | 교착 상태 주의 |
| 분산 잠금 | 외부 자원 | 만료와 재진입 처리 |
| 멱등 키 | 요청 중복 | 저장과 조회 필요 |

데이터베이스가 보장하게 만드는 것이 가장 안전하다. 애플리케이션에서 순서를 맞추려는 시도는 인스턴스가 늘면 깨진다.

\`\`\`sql
-- 조건부 갱신 — 영향 행이 0이면 이미 쓰인 것이다
UPDATE coupons SET used_by = $1, used_at = now()
WHERE code = $2 AND used_by IS NULL;

-- 잔액 차감 — 음수가 되지 않게 조건에 넣는다
UPDATE accounts SET balance = balance - $1
WHERE id = $2 AND balance >= $1;
\`\`\`

애플리케이션은 영향 행 수를 반드시 확인해야 한다. 0이면 실패로 처리한다.

## 시험 방법

\`\`\`bash
# 동시에 보내 중복이 생기는지 — 순차 시험으로는 안 잡힌다
for i in $(seq 1 20); do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST https://stg.example.com/api/coupons/use \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d '{"code":"TESTCODE"}' &
done; wait
# 200 이 하나만 나와야 한다
\`\`\`

## 참고

- CWE-362: Concurrent Execution using Shared Resource
- PortSwigger Web Security Academy — Race conditions
- Stripe API Reference — Idempotent requests`,
    diagram: {
      type: 'steps',
      caption: '경쟁 조건 제거 순서',
      steps: [
        { label: '중복 불가 조건 식별', note: '무엇이 한 번만 일어나야 하는가' },
        { label: '유니크 제약 추가', note: '데이터베이스가 판정한다' },
        { label: '조건부 갱신 전환', note: '조회 후 검사 제거' },
        { label: '멱등 키 도입', note: '재시도를 안전하게 흡수' },
      ],
    },
  },
  {
    slug: 'xxe-prevention',
    title: 'XXE 취약점과 외부 엔티티 차단',
    body: `XXE 는 XML 파서가 문서 안에 선언된 외부 엔티티를 실제로 읽어오면서 생긴다. 공격자는 서버의 파일을 읽거나 내부 대역으로 요청을 보내게 만들 수 있다. 대책은 입력을 검사하는 것이 아니라 파서에서 외부 엔티티와 DTD 처리를 끄는 것이다. 한 줄 설정으로 끝나는 대신, XML 을 쓰는 모든 지점을 찾아내는 일이 실제 작업량이다.

## 왜 아직도 남아 있는가?

XML 을 직접 다루지 않는다고 생각하는 곳에 남아 있다. 문서 형식 변환, 오피스 파일 업로드, SVG 이미지, SOAP 연동, SAML 인증 응답, 설정 파일 파싱이 모두 XML 파서를 지난다. 특히 SAML 은 인증 경로에 있어 영향이 크다.

![외부 엔티티 처리 여부에 따른 결과](/img/posts/xxe-prevention.svg)

## 파서별 차단 설정

| 환경 | 조치 |
| --- | --- |
| Java DocumentBuilderFactory | disallow-doctype-decl 을 true 로 |
| Java SAXParser | external-general-entities 를 false 로 |
| .NET XmlReader | DtdProcessing 을 Prohibit 로 |
| Python lxml | resolve_entities 를 false 로, no_network 유지 |
| PHP libxml | 외부 엔티티 로딩 비활성화 |
| Node.js | DTD 를 처리하지 않는 파서 선택 |

## 파일 업로드가 가장 위험하다

오피스 문서와 SVG 는 내부가 XML 이다. 확장자와 MIME 타입만 검사하고 내용을 그대로 파서에 넘기면 업로드 기능이 XXE 입구가 된다. 이미지 처리 라이브러리도 SVG 를 파싱하므로 함께 점검한다.

## 응답이 없어도 유출된다

파서가 오류만 반환하도록 설정돼 있어도, 외부 엔티티로 공격자 서버에 요청을 보내는 방식으로 내용을 빼낼 수 있다. 따라서 "응답에 안 나오니 안전하다"는 판단은 성립하지 않는다. 네트워크 요청 자체를 끊어야 한다.

## 바로 확인하기

읽기 대상은 존재 여부만 확인할 수 있는 무해한 경로를 쓰고, 반드시 허가된 환경에서 시험한다.

\`\`\`bash
# 외부 엔티티가 처리되는지 — 응답에 파일 내용이나 오류 차이가 나타나면 취약
cat > xxe.xml <<'XML'
<?xml version="1.0"?>
<!DOCTYPE r [ <!ENTITY x SYSTEM "file:///etc/hostname"> ]>
<r>&x;</r>
XML

curl -s -X POST https://stg.example.com/api/import \\
  -H 'Content-Type: application/xml' --data-binary @xxe.xml
\`\`\`

파서 설정은 안전한 기본값을 한 곳에 모아두고 그것만 쓰게 만든다.

\`\`\`java
DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
f.setFeature("http://xml.org/sax/features/external-general-entities", false);
f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
f.setXIncludeAware(false);
f.setExpandEntityReferences(false);
\`\`\`

## 실제로 이렇게 터진다

문서 업로드 기능에서 서버 파일이 유출된 사례가 있다. 사무용 문서 형식이 내부적으로 XML 이었고, 파서가 외부 엔티티를 처리하도록 기본 설정돼 있었다. 문서 안에 파일 경로를 참조하는 엔티티를 넣자 그 내용이 응답에 포함됐다.

이미지 업로드에서도 나온다. 벡터 이미지 형식이 XML 이라 같은 문제를 갖는다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| XML 을 안 쓴다 | 문서·이미지 형식 내부가 XML 이다 |
| 파서가 알아서 막는다 | 오래된 기본값이 허용이다 |
| 읽기만 가능하니 피해가 작다 | 키 파일 하나면 충분하다 |
| 응답에 안 보이면 안전하다 | 외부로 내보내는 방식이 있다 |
| 스키마 검증하면 막힌다 | 파싱은 검증 전에 일어난다 |

## 어디에 XML 이 숨어 있는가

| 형식 | 비고 |
| --- | --- |
| 사무용 문서 | 압축 안에 XML |
| 벡터 이미지 | 그 자체가 XML |
| 설정·연동 | 인증 응답, 피드 |
| 이미지 메타데이터 | 내장된 XML 조각 |
| 지도·도면 | 좌표 데이터 |

## 무엇을 끄는가

파서마다 이름은 다르지만 끄는 것은 같다 — 외부 엔티티, 외부 DTD, 엔티티 확장.

\`\`\`python
# 파이썬 — 방어적 파서를 쓰는 것이 가장 간단하다
from defusedxml.ElementTree import parse
tree = parse(fp)
\`\`\`

\`\`\`java
// 자바 — 기능을 명시적으로 끈다
var f = DocumentBuilderFactory.newInstance();
f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
f.setFeature("http://xml.org/sax/features/external-general-entities", false);
f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
f.setXIncludeAware(false);
f.setExpandEntityReferences(false);
\`\`\`

가장 확실한 것은 DOCTYPE 선언 자체를 거부하는 것이다. 대부분의 업무 문서에는 필요 없다.

## 점검 절차

\`\`\`bash
# 외부 엔티티가 처리되는지 — 우리가 통제하는 주소로 확인한다
cat > /tmp/xxe.xml <<'X'
<?xml version="1.0"?>
<!DOCTYPE r [<!ENTITY e SYSTEM "http://canary.example.net/xxe-probe">]>
<r>&e;</r>
X
curl -s -X POST https://stg.example.com/api/import -H 'Content-Type: application/xml' \
  --data-binary @/tmp/xxe.xml -o /dev/null
# canary 서버에 요청이 도착하면 외부 엔티티가 처리된 것이다
\`\`\`

## 참고

- OWASP Cheat Sheet — XML External Entity Prevention
- CWE-611: Improper Restriction of XML External Entity Reference
- OWASP Top 10 — A05 Security Misconfiguration`,
    diagram: {
      type: 'matrix',
      caption: 'DTD 처리와 네트워크 접근 허용',
      x: ['네트워크 허용', '네트워크 차단'],
      y: ['DTD 처리 허용', 'DTD 처리 금지'],
      cells: ['파일 유출·SSRF', '파일 읽기 가능', '무해', '안전한 기본값'],
    },
  },
  {
    slug: 'subdomain-takeover',
    title: '서브도메인 탈취 탐지와 DNS 정리',
    body: `서브도메인 탈취는 DNS 레코드는 남아 있는데 그 레코드가 가리키는 서비스가 해지된 상태에서 일어난다. 누구든 그 서비스에 같은 이름으로 다시 등록하면 우리 도메인으로 임의의 페이지를 띄울 수 있다. 쿠키 범위와 CORS 허용, 메일 신뢰까지 함께 넘어가는 것이 진짜 피해다.

## 왜 눈에 띄지 않는가?

레코드를 만든 사람과 서비스를 해지한 사람이 다르고, 남은 레코드는 아무 오류도 내지 않는다. 아무도 접속하지 않는 이름이므로 모니터링에도 걸리지 않는다. 이벤트 페이지, 상태 페이지, 문서 사이트, 예전 스테이징 이름에서 주로 발견된다.

![레코드는 남고 서비스만 사라진 상태](/img/posts/subdomain-takeover.svg)

## 피해 범위

| 항목 | 영향 |
| --- | --- |
| 쿠키 | 상위 도메인에 걸린 쿠키가 전달된다 |
| CORS | 와일드카드 하위 도메인 허용 시 API 접근 |
| 콘텐츠 보안 정책 | 하위 도메인 허용이면 스크립트 삽입 경로 |
| 피싱 | 정상 도메인으로 자격 증명 수집 |
| 메일 | 하위 도메인 발신 신뢰 악용 |
| 인증서 | 도메인 검증으로 정식 인증서 발급 |

## 정리 원칙

레코드는 서비스와 함께 만들고 함께 지운다. 해지 절차에 DNS 레코드 삭제를 넣지 않으면 반드시 남는다. 소유자와 만료일을 레코드마다 기록하고, 소유자가 퇴사하거나 팀이 사라진 레코드는 회수 대상으로 본다.

\`\`\`
생성   서비스 등록과 DNS 레코드를 같은 변경 건으로 처리
보유   레코드마다 소유 팀·용도·만료일 기록
해지   서비스 해지 티켓에 레코드 삭제를 필수 항목으로
점검   주 1회 전체 레코드 대상 자동 검사
\`\`\`

## 와일드카드는 탈취를 무력화하지만 다른 위험을 만든다

와일드카드 레코드를 두면 해지된 이름도 우리 서버로 가므로 탈취가 성립하지 않는다. 대신 존재하지 않는 이름이 모두 응답하게 되어 쿠키 범위와 가상 호스트 설정을 정확히 다뤄야 한다. 기본값으로 권할 방식은 아니다.

## 바로 확인하기

CNAME 목록을 뽑아 대상이 살아 있는지 확인한다. 존재하지 않는 대상을 가리키는 레코드가 후보다.

\`\`\`bash
# 보유 중인 CNAME 의 대상이 응답하는지 확인
while read -r name; do
  target=$(dig +short CNAME "$name" | sed 's/\\.$//')
  [ -z "$target" ] && continue
  if ! dig +short "$target" | grep -q .; then
    echo "확인 필요: $name -> $target (대상 미해석)"
  fi
done < subdomains.txt

# 응답 본문에 서비스별 미등록 안내 문구가 있는지
curl -s -m 5 https://old.example.com | grep -iE "no such|not found|unclaimed|does not exist"
\`\`\`

인증서 투명성 로그로 우리가 모르는 이름을 찾는 것도 효과적이다. 자산 목록에 없는 이름이 나오면 그 자체가 점검 대상이다.

## 실제로 이렇게 터진다

마케팅용으로 만든 서브도메인이 탈취된 사례가 있다. 외부 호스팅 서비스를 가리키던 별칭 레코드였는데, 그 서비스 계정을 해지하면서 레코드만 남았다. 누군가 같은 이름으로 그 서비스에 가입하자 우리 서브도메인이 그 사람의 페이지가 됐다.

피해는 페이지 위조에서 끝나지 않는다. 우리 도메인의 쿠키를 읽을 수 있고, 우리 이름으로 인증서를 받을 수 있다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 안 쓰는 서브도메인은 무해하다 | 탈취 대상이 된다 |
| 레코드가 남아도 응답이 없다 | 대상 서비스에서 다시 만들면 응답한다 |
| 서브도메인은 별개 사이트다 | 쿠키와 신뢰를 공유한다 |
| 우리는 서브도메인이 적다 | 인증서 로그를 보면 많다 |
| 한 번 정리하면 끝이다 | 계속 생긴다 |

## 위험한 레코드 유형

| 상황 | 위험 |
| --- | --- |
| 별칭이 없어진 서비스 자원을 가리킴 | 매우 높음 |
| A 레코드가 회수된 IP 를 가리킴 | 높음 |
| 위임이 만료된 영역 | 높음 |
| 사용 중인 서비스, 계정 유효 | 낮음 |

## 정리 절차

1. 인증서 투명성 로그로 우리 이름 전체를 모은다 — 목록보다 많다
2. 각 이름의 해석 대상을 확인한다
3. 대상이 없거나 오류를 주는 것을 후보로 뺀다
4. 소유자를 찾아 아직 필요한지 확인한다
5. 필요 없으면 레코드를 삭제한다 — 서비스만 지우지 말고 레코드까지
6. 정기 점검을 자동화한다

\`\`\`bash
# 인증서 로그로 이름을 모으고, 대상이 사라진 것을 찾는다
curl -s "https://crt.sh/?q=%25.example.com&output=json" |
  python3 -c 'import sys,json;print("\n".join(sorted({r["common_name"] for r in json.load(sys.stdin)})))' |
while read -r n; do
  cname=$(dig +short CNAME "$n" | head -1)
  [ -z "$cname" ] && continue
  dig +short "$cname" | grep -q . || echo "$n -> $cname (대상 없음)"
done
\`\`\`

레코드를 만들 때 소유자와 만료일을 함께 기록하는 규칙을 두면, 이 점검이 대조 작업으로 바뀐다.

## 참고

- OWASP Web Security Testing Guide — Test for Subdomain Takeover
- Certificate Transparency 로그 검색
- can-i-take-over-xyz 서비스별 지문 목록`,
    diagram: {
      type: 'steps',
      caption: '서브도메인 자산 점검 주기',
      steps: [
        { label: '레코드 수집', note: 'DNS 영역과 인증서 로그 대조' },
        { label: '대상 생존 확인', note: '미해석 CNAME 식별' },
        { label: '소유자 확인', note: '용도와 만료일 기록' },
        { label: '삭제 또는 회수', note: '해지 절차에 편입' },
      ],
    },
  },
  {
    slug: 'bot-mitigation',
    title: '봇 차단 설계와 요청 수 제한 조합',
    body: `자동화 트래픽은 하나의 수단으로 막히지 않는다. 요청 수 제한은 분산된 요청에 약하고, 문자 인증은 사용자 이탈을 만들며, 지문 수집은 개인정보 문제를 부른다. 실제로 효과가 있는 구성은 값싼 검사부터 순서대로 쌓고, 확신이 높을 때만 비싼 검사를 꺼내는 방식이다.

## 무엇을 막으려는지부터 정한다

목적이 다르면 수단도 다르다. 뭉뚱그려 "봇 차단"으로 두면 정상 사용자만 불편해진다.

- 자격 증명 대입 — 로그인 실패율과 계정 분산이 신호
- 재고·가격 수집 — 목록 조회 편중이 신호
- 가입 남용 — 동일 결제수단·기기 재사용이 신호
- 재고 선점 — 결제 전환율과 요청 간격이 신호

![값싼 검사부터 쌓는 차단 계층](/img/posts/bot-mitigation.svg)

## 수단별 특성

| 수단 | 강점 | 약점 |
| --- | --- | --- |
| IP 단위 요청 수 제한 | 즉시 적용, 저렴 | 분산·프록시에 무력 |
| 계정·기기 단위 제한 | 분산에 강함 | 식별자 확보 필요 |
| 정상 흐름 검사 | 오탐 적음 | 설계 필요 |
| 문자 인증 | 확실한 차단 | 이탈률 상승, 우회 서비스 존재 |
| 지문·행위 분석 | 정교함 | 개인정보 검토 필요 |
| 사후 탐지와 회수 | 사용자 영향 없음 | 피해 후 조치 |

## 실패에 비용을 붙인다

같은 계정에 대한 로그인 실패가 쌓이면 응답을 점점 늦추고, 임계치를 넘으면 추가 인증을 요구한다. 성공한 요청에는 비용을 붙이지 않으므로 정상 사용자는 아무것도 느끼지 않는다.

## 차단은 조용히 한다

즉시 오류를 돌려주면 공격자가 임계치를 학습한다. 표준 상태 코드와 재시도 안내를 유지하되, 성공 여부를 알려주는 응답 차이를 없애는 것이 중요하다.

## 바로 확인하기

우리 서비스의 제한이 실제로 걸리는지 스테이징에서 확인한다. 계정 단위와 IP 단위를 각각 본다.

\`\`\`bash
# 같은 계정에 대한 연속 실패 — 임계치 이후 429 가 나와야 한다
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST https://stg.example.com/login \\
    -H 'Content-Type: application/json' \\
    -d '{"email":"probe@example.com","password":"wrong"}')
  printf '%s ' "$code"
done; echo

# 응답 헤더로 남은 한도를 알려주는지
curl -sI https://stg.example.com/api/search | grep -iE 'ratelimit|retry-after'
\`\`\`

로그에서 신호를 뽑는 쪽이 더 중요하다. 계정당 실패, 아이피당 계정 수를 함께 본다.

\`\`\`
경보 1  단일 IP 가 10분간 서로 다른 계정 50개 이상 시도
경보 2  단일 계정에 서로 다른 IP 20개 이상에서 시도
경보 3  로그인 실패율이 기준선의 3배 초과
경보 4  가입 후 결제 전환율이 급락 — 자동 가입 신호
\`\`\`

## 실제로 이렇게 터진다

한도를 IP 기준으로만 건 서비스에서 재고가 전부 봇에게 넘어간 사례가 있다. 주거용 프록시를 쓰니 요청마다 주소가 달랐고, 한도는 아무것도 막지 못했다.

반대로 차단을 세게 걸어 정상 사용자가 막힌 경우도 있다. 회사 네트워크에서 나오는 트래픽이 한 주소로 보여 대량 요청으로 판정됐다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| IP 로 구분할 수 있다 | 프록시와 공용 주소가 있다 |
| 자동화 확인 문제로 해결된다 | 우회 서비스가 있다 |
| 봇은 전부 나쁘다 | 검색 엔진과 모니터링도 봇이다 |
| 차단이 목표다 | 비용을 올리는 것이 목표다 |
| 한 번 막으면 끝이다 | 우회하고 다시 온다 |

## 층을 겹친다

한 가지로는 막히지 않는다. 각 층이 우회 비용을 조금씩 올린다.

| 층 | 막는 것 | 우회 난도 |
| --- | --- | --- |
| 요청 수 한도 | 단순 반복 | 낮음 |
| 계정·대상 기준 한도 | 주소 변경 우회 | 중간 |
| 기기 지문 | 도구 재사용 | 중간 |
| 행위 분석 | 사람 같지 않은 패턴 | 높음 |
| 작업 증명 | 대량 시도의 비용 | 높음 |
| 자동화 확인 | 마지막 관문 | 우회 서비스 존재 |

## 정상 사용자를 막지 않는 방법

1. 의심 점수를 매기고 점수에 따라 다르게 대응한다 — 즉시 차단은 최후
2. 낮은 점수는 통과, 중간은 추가 확인, 높은 것만 차단
3. 로그인한 사용자에게는 완화된 기준을 적용한다
4. 차단 시 이유와 해제 경로를 알린다
5. 오탐 신고 창구를 두고 지표로 관찰한다

\`\`\`bash
# 실제로 봇인지 판단할 재료 — 요청 특성을 집계한다
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10
awk -F'"' '{print $6}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10
# 한 주소에서 온 요청의 시간 간격이 일정하면 자동화다
\`\`\`

## 참고

- OWASP Automated Threats to Web Applications (OAT) 목록
- OWASP Cheat Sheet — Credential Stuffing Prevention
- NIST SP 800-63B, 인증 시도 제한 요건`,
    diagram: {
      type: 'layers',
      caption: '자동화 트래픽 차단 계층',
      layers: [
        { label: '요청 수 제한', note: 'IP·계정·엔드포인트별' },
        { label: '흐름 검증', note: '정상 순서를 거쳤는지' },
        { label: '추가 인증', note: '확신이 높을 때만' },
        { label: '사후 탐지', note: '이상 계정 회수' },
      ],
    },
  },
]
