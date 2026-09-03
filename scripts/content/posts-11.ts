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
