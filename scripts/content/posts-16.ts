import type { SeedPost } from './types'

/** 151~160 — 브라우저 실행 환경과 입력 처리 */
export const posts16: SeedPost[] = [
  {
    slug: 'csp-nonce',
    title: 'CSP 를 nonce 기반으로 옮기는 순서',
    body: `콘텐츠 보안 정책을 도메인 허용 목록으로 쓰면 오래 버티지 못한다. 허용한 CDN 안에 오래된 라이브러리 하나만 있어도 그 경로로 임의 스크립트가 실행되기 때문이다. 요청마다 새로 만드는 nonce 로 옮기면 "우리가 이 페이지에서 직접 넣은 스크립트"만 실행된다. 다만 한 번에 바꾸면 화면이 깨지므로 보고 전용으로 관찰하는 단계가 반드시 필요하다.

## 도메인 허용 목록은 왜 무너지는가?

허용 목록은 출처만 본다. 그 출처에 무엇이 올라가 있는지는 보지 않는다. 널리 쓰이는 CDN 에는 임의 코드를 실행할 수 있는 형태의 파일이 남아 있고, 공격자는 우리가 허용한 그 출처에서 그 파일을 불러오면 된다. 정책이 있는데도 우회되는 대표적인 구조다.

여기에 \`unsafe-inline\` 이 붙어 있으면 정책은 사실상 없는 것과 같다. 인라인 스크립트를 허용한다는 것은 삽입된 스크립트도 허용한다는 뜻이기 때문이다.

![허용 목록 방식과 nonce 방식의 차이](/img/posts/csp-nonce.svg)

## 방식별 비교

| 방식 | 막는 것 | 한계 |
| --- | --- | --- |
| unsafe-inline | 없음 | 정책이 있으나 마나 |
| 도메인 허용 목록 | 모르는 출처 | 허용 출처 안의 위험한 파일 |
| nonce | 우리가 안 넣은 스크립트 | 요청마다 새 값 필요 |
| hash | 고정된 인라인 코드 | 코드가 바뀌면 해시도 바꿔야 |
| strict-dynamic | 신뢰한 스크립트가 부른 것까지 | 구형 브라우저는 무시 |

## 도입 순서

정책을 곧바로 강제하면 화면이 깨진다. 보고만 받는 단계에서 실제 위반 목록을 모은 뒤 좁혀야 한다.

\`\`\`
1주차   Content-Security-Policy-Report-Only 로 관찰
2주차   보고서에서 정상 스크립트를 골라 nonce 부여
3주차   남은 인라인 이벤트 핸들러 제거 (onclick 등)
4주차   Content-Security-Policy 로 전환, 보고는 유지
이후    새 위반이 보고되면 배포 전에 잡는다
\`\`\`

![보고 전용에서 차단으로 가는 단계](/img/posts/csp-nonce-2.svg)

## nonce 는 요청마다 달라야 한다

nonce 를 고정값으로 두면 공격자가 그 값을 그대로 쓰면 되므로 아무 의미가 없다. 요청마다 암호학적 난수로 만들고, 응답 헤더와 script 태그에 같은 값을 넣는다. 캐시가 있는 구성에서는 페이지 캐시와 nonce 가 충돌하므로, 캐시 대상 페이지는 hash 방식을 쓰거나 nonce 를 넣는 부분만 캐시에서 제외한다.

## 보고서를 받을 곳을 먼저 만든다

위반 보고를 받을 엔드포인트가 없으면 관찰 단계가 성립하지 않는다. 보고는 인증 없이 들어오므로 양이 많고 위조도 가능하다. 수집량 제한을 걸고, 보고 내용을 그대로 신뢰하지 않는다.

## 바로 확인하기

지금 정책이 실제로 무엇을 허용하는지부터 본다.

\`\`\`bash
# 현재 정책 확인 — unsafe-inline 이 있으면 사실상 무방비다
curl -sI https://www.example.com | grep -i content-security-policy | tr ';' '\\n'

# 보고 전용 정책을 먼저 붙인다
# Content-Security-Policy-Report-Only:
#   default-src 'self'; script-src 'nonce-<값>' 'strict-dynamic';
#   object-src 'none'; base-uri 'none'; report-uri /csp-report
\`\`\`

서버는 요청마다 nonce 를 만들어 헤더와 태그에 함께 넣는다.

\`\`\`ts
import { randomBytes } from 'node:crypto'

app.use((req, res, next) => {
  const nonce = randomBytes(16).toString('base64')
  res.locals.nonce = nonce
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      \`script-src 'nonce-\${nonce}' 'strict-dynamic'\`,
      "object-src 'none'",
      "base-uri 'none'",
      'report-uri /csp-report',
    ].join('; '),
  )
  next()
})
\`\`\`

## 참고

- MDN — Content Security Policy
- W3C Content Security Policy Level 3
- OWASP Cheat Sheet — Content Security Policy`,
    diagram: {
      type: 'matrix',
      caption: '스크립트 실행 허용 기준',
      x: ['출처로 판단', '값으로 판단'],
      y: ['인라인 허용', '인라인 차단'],
      cells: ['사실상 무방비', 'nonce 없으면 실행 불가', '허용 출처 안이면 통과', '가장 안전'],
    },
    diagram2: {
      type: 'steps',
      caption: 'CSP 전환 4주',
      steps: [
        { label: '보고 전용 적용', note: '차단 없이 위반만 수집' },
        { label: '정상 스크립트 식별', note: 'nonce 부여 대상 확정' },
        { label: '인라인 핸들러 제거', note: 'onclick 등 정리' },
        { label: '차단으로 전환', note: '보고는 계속 유지' },
      ],
    },
  },
  {
    slug: 'cookie-attributes',
    title: '쿠키 속성 선택 기준과 흔한 실수',
    body: `쿠키 하나에 붙는 속성은 대여섯 개뿐인데, 그 조합이 세션 보안의 대부분을 결정한다. 값을 어떻게 만드느냐보다 어디까지 전달되고 누가 읽을 수 있느냐가 실제 사고를 가른다. 기준은 단순하다. 세션 쿠키는 스크립트가 읽지 못하게 하고, 전송 구간을 강제하고, 다른 사이트에서 시작된 요청에는 따라가지 않게 한다.

## 어떤 속성을 어떻게 정하는가?

| 속성 | 세션 쿠키 | 이유 |
| --- | --- | --- |
| HttpOnly | 켬 | 스크립트가 읽으면 탈취 경로가 생긴다 |
| Secure | 켬 | 평문 구간으로 새지 않게 |
| SameSite | Lax 또는 Strict | 다른 사이트발 요청에 따라가지 않게 |
| Domain | 지정하지 않음 | 지정하면 하위 도메인 전체로 퍼진다 |
| Path | / | 경로로 보안을 만들려 하지 않는다 |
| Max-Age | 짧게 | 만료 없는 세션을 두지 않는다 |
| 이름 접두어 | __Host- | 조건을 브라우저가 강제한다 |

![쿠키가 전달되는 범위](/img/posts/cookie-attributes.svg)

## Domain 을 지정하면 범위가 넓어진다

\`Domain=example.com\` 을 붙이면 그 쿠키는 모든 하위 도메인으로 전달된다. 마케팅 페이지나 문서 사이트 같은 하위 도메인 하나가 침해되면 세션 쿠키가 그쪽으로도 흘러간다. 서브도메인 탈취가 위험한 이유가 여기에 있다. 지정하지 않으면 발급한 호스트에만 전달된다.

## __Host- 접두어가 조건을 강제한다

이름을 \`__Host-\` 로 시작하면 브라우저가 Secure 여야 하고, Path 가 / 여야 하고, Domain 이 없어야 한다는 조건을 검사한다. 코드에서 실수로 조건을 빠뜨려도 브라우저가 거부하므로 설정이 흐트러지지 않는다.

\`\`\`
Set-Cookie: __Host-session=<값>; Secure; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600
\`\`\`

![속성 조합에 따른 노출 경로](/img/posts/cookie-attributes-2.svg)

## SameSite 는 무엇을 막고 무엇을 못 막는가

Lax 는 다른 사이트에서 시작된 POST 요청에 쿠키를 붙이지 않는다. 그래서 단순한 요청 위조는 막힌다. 그러나 GET 으로 상태를 바꾸는 기능이 있으면 여전히 통한다. 상태를 바꾸는 동작은 GET 으로 만들지 않는 것이 원칙이고, 그 위에 토큰 검증을 둔다.

## 만료와 갱신

만료 없는 세션은 로그아웃을 하지 않는 사용자에게 영구 접근권을 준다. 절대 만료와 유휴 만료를 함께 둔다. 절대 만료는 로그인 시각 기준으로 며칠, 유휴 만료는 마지막 활동 기준으로 수십 분이 흔한 조합이다.

## 바로 확인하기

응답의 Set-Cookie 를 그대로 읽어 속성 누락을 찾는다.

\`\`\`bash
curl -sI https://app.example.com/login -X POST \\
  -H 'Content-Type: application/json' -d '{"email":"a@b.c","password":"x"}' \\
  | grep -i '^set-cookie:' | tr ',' '\\n'

# 점검
#   HttpOnly 없음  → 스크립트로 읽힌다
#   Secure 없음    → 평문 구간으로 나간다
#   SameSite 없음  → 브라우저 기본값에 의존한다
#   Domain 있음    → 하위 도메인 전체로 퍼진다
\`\`\`

브라우저에서 실제로 읽히는지도 확인한다. 콘솔에서 세션 쿠키가 보이면 HttpOnly 가 빠진 것이다.

\`\`\`js
document.cookie.split('; ').map((c) => c.split('=')[0])
\`\`\`

## 참고

- RFC 6265bis — HTTP State Management Mechanism
- OWASP Cheat Sheet — Session Management
- MDN — Set-Cookie`,
    diagram: {
      type: 'layers',
      caption: '세션 쿠키 보호 계층',
      layers: [
        { label: 'HttpOnly', note: '스크립트 접근 차단' },
        { label: 'Secure', note: '평문 전송 차단' },
        { label: 'SameSite', note: '타 사이트발 요청 차단' },
        { label: '__Host- 접두어', note: '조건을 브라우저가 강제' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: 'Domain 지정과 노출 범위',
      x: ['Domain 지정', 'Domain 없음'],
      y: ['하위 도메인 많음', '단일 호스트'],
      cells: ['한 곳 침해로 전체 유출', '발급 호스트만', '불필요하게 넓음', '가장 좁음'],
    },
  },
  {
    slug: 'postmessage-security',
    title: 'postMessage 출처 검증과 데이터 처리',
    body: `창과 프레임 사이에 메시지를 주고받는 기능은 편리하지만, 출처를 확인하지 않으면 아무 사이트나 우리 페이지에 메시지를 보낼 수 있다. 반대로 보낼 때 대상 출처를 별표로 두면 우리가 보낸 내용이 어디로 갈지 알 수 없다. 받을 때는 보낸 곳을 확인하고, 보낼 때는 받을 곳을 지정한다. 이 두 줄이 전부다.

## 어디에서 문제가 생기는가?

- 받은 메시지의 origin 을 확인하지 않는다
- 보낼 때 대상 출처를 \`*\` 로 둔다
- 받은 값을 그대로 화면에 넣어 크로스 사이트 스크립팅이 된다
- 메시지 형식을 검증하지 않아 예상 밖 구조가 들어온다
- 부모 창을 신뢰할 수 있다고 가정한다

결제 위젯, 지도, 채팅, 광고처럼 다른 출처의 프레임을 붙이는 화면에서 자주 나온다.

![메시지 송수신에서 확인해야 할 지점](/img/posts/postmessage-security.svg)

## 검증 항목

| 항목 | 확인 |
| --- | --- |
| event.origin | 허용 출처와 정확히 일치하는가 |
| event.source | 기대한 창·프레임에서 왔는가 |
| 데이터 형식 | 정의된 스키마를 통과하는가 |
| 보낼 때 대상 | targetOrigin 을 명시했는가 |
| 처리 방식 | 받은 값을 실행하거나 그대로 삽입하지 않는가 |

## 보낸 곳 비교는 정확히 일치로

문자열 포함이나 앞부분 일치로 검사하면 우회된다. \`https://example.com.evil.test\` 가 앞부분 일치를 통과하고, \`https://evil-example.com\` 이 끝부분 일치를 통과한다. 허용 출처를 집합에 넣고 완전히 같은지만 본다.

![잘못된 출처 검사와 우회 입력](/img/posts/postmessage-security-2.svg)

## 받은 값이 스크립팅으로 이어지지 않게 한다

메시지에는 문자열만 오지 않는다. 객체가 오면 필드가 몇 개인지, 형이 무엇인지 정해두지 않으면 예상 밖 값이 로직으로 들어간다. 스키마 검증을 붙이고, 정의되지 않은 필드는 버린다. 받은 값으로 페이지를 그리는 경우에는 텍스트로만 넣는다. HTML 로 넣으면 그 순간 크로스 사이트 스크립팅 경로가 된다.

## 프레임을 붙이는 쪽의 책임

우리가 다른 사이트를 프레임으로 붙일 때는 그 프레임에 필요한 권한만 준다. sandbox 속성으로 스크립트·폼·팝업 권한을 개별로 열고, allow 속성으로 카메라나 위치 같은 기능을 제한한다. 프레임이 침해되어도 할 수 있는 일이 줄어든다.

## 바로 확인하기

우리 페이지가 메시지를 어떻게 받는지 코드에서 찾는다.

\`\`\`bash
# 출처 검사 없이 수신하는 코드
grep -rn "addEventListener('message'" --include='*.ts' --include='*.tsx' --include='*.js' src/ \\
  | while read -r line; do echo "$line"; done

# 대상 출처를 별표로 보내는 코드
grep -rn "postMessage(.*,\\s*['\\\"]\\*['\\\"]" --include='*.ts' --include='*.tsx' src/
\`\`\`

수신부는 이렇게 좁힌다.

\`\`\`ts
const ALLOWED = new Set(['https://pay.example.com'])

window.addEventListener('message', (event) => {
  if (!ALLOWED.has(event.origin)) return          // 출처 정확히 일치
  if (event.source !== frameRef.current?.contentWindow) return  // 기대한 프레임인지
  const parsed = MessageSchema.safeParse(event.data)            // 형식 검증
  if (!parsed.success) return
  handle(parsed.data)                              // 실행하지 않고 처리만
})

// 보낼 때는 대상 출처를 명시한다
frameRef.current?.contentWindow?.postMessage({ type: 'ready' }, 'https://pay.example.com')
\`\`\`

## 참고

- MDN — Window.postMessage
- OWASP Cheat Sheet — HTML5 Security
- HTML Standard, cross-document messaging`,
    diagram: {
      type: 'flow',
      caption: '메시지 처리 경로',
      steps: [
        { label: '메시지 수신', note: '누구나 보낼 수 있다' },
        { label: '출처 검사', note: '정확히 일치하는지' },
        { label: '형식 검증', note: '스키마 통과' },
        { label: '처리', note: '실행·삽입하지 않는다' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '출처 검사 방식과 우회',
      x: ['정확히 일치', '부분 일치'],
      y: ['허용 목록', '검사 없음'],
      cells: ['안전', '유사 도메인 통과', '아무나 통과', '가장 위험'],
    },
  },
  {
    slug: 'prototype-pollution',
    title: '프로토타입 오염과 객체 병합 함수',
    body: `사용자 입력을 객체에 깊이 병합하는 함수 하나가 애플리케이션 전체의 기본값을 바꿀 수 있다. 특수한 키가 객체의 조상에 값을 심으면, 그 뒤로 만들어지는 모든 객체가 그 값을 물려받기 때문이다. 결과는 권한 상승부터 코드 실행까지 다양하다. 방어는 그 키를 걸러내는 것이 아니라 조상을 갖지 않는 자료구조를 쓰는 것이다.

## 권한 상승은 왜 한 곳에서 전체로 번지는가?

자바스크립트 객체는 값을 찾을 때 자기 자신에 없으면 조상을 따라 올라간다. 조상에 \`isAdmin\` 이 심기면, 그 속성을 직접 갖지 않은 모든 객체가 \`isAdmin\` 을 참이라고 답한다. 검사 코드가 아무 잘못이 없어도 판정이 뒤집혀 권한 상승이 일어난다.

![오염된 조상이 판정을 바꾸는 경로](/img/posts/prototype-pollution.svg)

## 어디에서 들어오는가?

| 경로 | 예 |
| --- | --- |
| 깊은 병합 | 설정 병합, 기본값 채우기 |
| 쿼리 문자열 파싱 | 중첩 표기를 객체로 변환 |
| JSON 본문 | 특수 키가 담긴 요청 |
| 경로 기반 설정 | a.b.c 형태로 값 지정 |
| 템플릿 데이터 | 사용자 값이 컨텍스트로 |

공통점은 문자열로 받은 키를 그대로 객체 속성으로 쓰는 코드다.

## 막는 방법은 구조를 바꾸는 것

특수 키 이름을 목록으로 막는 방식은 표기 변형과 중첩으로 우회된다. 근본 대책은 세 가지다.

- 사용자 입력을 담는 객체는 조상이 없는 형태로 만든다
- 키·값 저장에는 객체 대신 전용 자료구조를 쓴다
- 병합 대신 스키마로 정의된 필드만 뽑아 쓴다

![병합 방식과 안전한 대안](/img/posts/prototype-pollution-2.svg)

## 라이브러리도 함께 본다

직접 병합 코드를 쓰지 않아도 의존성 안에 있을 수 있다. 유틸리티 라이브러리, 쿼리 파서, 설정 로더가 흔한 자리다. 의존성 취약점 목록에서 이 유형이 나오면 실제 호출 경로가 있는지 확인해 우선순위를 정한다.

## 바로 확인하기

객체가 오염되는지 직접 시험한다. 개발 환경에서만 한다.

\`\`\`js
// 오염 시도 후 아무 객체나 확인 — 값이 보이면 취약하다
merge({}, JSON.parse('{"__proto__":{"polluted":"yes"}}'))
console.log(({}).polluted)   // 'yes' 가 나오면 오염됐다
\`\`\`

API 로도 같은 것을 확인할 수 있다.

\`\`\`bash
curl -s -X POST https://stg.example.com/api/settings \\
  -H 'Content-Type: application/json' \\
  -d '{"theme":"dark","__proto__":{"isAdmin":true}}'

# 이후 권한이 필요한 엔드포인트가 통과되는지 확인
curl -s -o /dev/null -w '%{http_code}\\n' https://stg.example.com/api/admin/users
\`\`\`

코드는 병합 대신 정의된 필드만 뽑는 형태로 바꾼다.

\`\`\`ts
const Settings = z.object({ theme: z.enum(['light', 'dark']), density: z.number().int() }).strict()
const parsed = Settings.parse(req.body)     // 정의되지 않은 키는 거부
const store = Object.create(null)           // 조상이 없는 객체
Object.assign(store, parsed)
\`\`\`

## 참고

- CWE-1321: Improperly Controlled Modification of Object Prototype
- OWASP Cheat Sheet — Input Validation
- Node.js 보안 권고 목록`,
    diagram: {
      type: 'flow',
      caption: '오염이 판정을 뒤집는 과정',
      steps: [
        { label: '특수 키 포함 입력', note: '요청 본문·쿼리' },
        { label: '깊은 병합', note: '키를 그대로 속성으로', danger: true },
        { label: '조상에 값 저장', note: '모든 객체가 물려받음', danger: true },
        { label: '권한 검사 통과', note: '코드는 그대로인데 결과가 바뀐다' },
      ],
    },
    diagram2: {
      type: 'bars',
      caption: '대응 방식별 효과',
      unit: '상대값',
      items: [
        { label: '키 이름 차단', value: 35, note: '변형으로 우회' },
        { label: '조상 없는 객체', value: 80, note: '심을 자리가 없음' },
        { label: '전용 자료구조', value: 85, note: '속성 조회 아님' },
        { label: '스키마 추출', value: 95, note: '정의된 필드만' },
      ],
    },
  },
  {
    slug: 'regex-dos',
    title: '정규식 폭주로 인한 서비스 거부',
    body: `짧은 입력 하나로 서버 한 대를 멈출 수 있다. 특정 형태의 정규식은 입력 길이에 따라 처리 시간이 기하급수로 늘어나기 때문이다. 공격자는 큰 트래픽도 취약점도 필요 없이 문자열 몇십 자만 보내면 된다. 검사는 짧고, 수정도 대개 정규식 한 줄이다.

## 어떤 정규식이 위험한가?

같은 문자를 여러 방식으로 나눠 맞출 수 있는 구조가 문제다. 반복 안에 반복이 있거나, 겹치는 선택지가 반복되는 형태다.

\`\`\`
위험   (a+)+$          반복 안의 반복
위험   (a|a)*$         겹치는 선택지
위험   (\\s*,\\s*)+      공백과 구분자가 겹침
위험   ^(\\w+\\s?)*$     단어와 공백 경계가 모호
안전   ^[a-z0-9]+$     한 가지로만 나뉜다
\`\`\`

![입력 길이에 따른 처리 시간](/img/posts/regex-dos.svg)

## 자주 나오는 자리

| 자리 | 흔한 패턴 |
| --- | --- |
| 이메일 검증 | 복잡한 형식 정규식 |
| URL 파싱 | 프로토콜·호스트 분리 |
| 로그 파싱 | 공백 구분 필드 추출 |
| 마크다운 처리 | 강조·링크 문법 |
| 사용자 검색어 | 입력을 정규식으로 변환 |
| 의존성 안의 검증기 | 우리가 쓴 적 없는 코드 |

마지막 항목이 특히 많다. 직접 쓴 정규식이 없어도 라이브러리 안에 있다.

## 세 가지로 막는다

- 정규식을 단순하게 고친다 — 대부분의 경우 가장 확실하다
- 입력 길이에 상한을 둔다 — 검사 전에 자른다
- 사용자 입력을 정규식 자체로 만들지 않는다 — 검색어는 문자열 비교로

![대응 순서](/img/posts/regex-dos-2.svg)

## 사용자 입력을 정규식으로 만들지 않는다

검색 기능에서 입력을 그대로 정규식으로 컴파일하면, 사용자가 폭주하는 패턴을 직접 보낼 수 있다. 문자열 포함 검사로 바꾸거나, 꼭 필요하면 특수문자를 모두 이스케이프한다.

## 바로 확인하기

의심되는 정규식에 길이를 늘려 가며 시간을 잰다. 급격히 늘면 취약하다.

\`\`\`js
const re = /^(\\w+\\s?)*$/
for (const n of [10, 20, 24, 26, 28]) {
  const s = 'a'.repeat(n) + '!'
  const t = process.hrtime.bigint()
  re.test(s)
  console.log(n, Number(process.hrtime.bigint() - t) / 1e6, 'ms')
}
// 길이가 조금 늘 때 시간이 몇 배씩 뛰면 폭주하는 정규식이다
\`\`\`

코드베이스에서 위험한 형태를 먼저 훑는다.

\`\`\`bash
# 반복 안의 반복 — 가장 흔한 형태
grep -rnE '\\(\\S*[+*]\\)[+*]' --include='*.ts' --include='*.js' src/ | head -20

# 사용자 입력으로 정규식을 만드는 코드
grep -rn 'new RegExp(' --include='*.ts' --include='*.js' src/
\`\`\`

## 참고

- OWASP — Regular expression Denial of Service (ReDoS)
- CWE-1333: Inefficient Regular Expression Complexity
- 각 언어 런타임의 정규식 엔진 문서`,
    diagram: {
      type: 'bars',
      caption: '입력 길이와 처리 시간 (폭주하는 정규식)',
      unit: 'ms',
      items: [
        { label: '20자', value: 2 },
        { label: '24자', value: 30 },
        { label: '28자', value: 480, note: '급격히 증가' },
        { label: '32자', value: 900, note: '사실상 멈춤' },
      ],
    },
    diagram2: {
      type: 'steps',
      caption: '대응 순서',
      steps: [
        { label: '위험 패턴 탐색', note: '반복 안의 반복' },
        { label: '정규식 단순화', note: '한 가지로만 나뉘게' },
        { label: '입력 길이 상한', note: '검사 전에 자른다' },
        { label: '의존성 점검', note: '라이브러리 안의 검증기' },
      ],
    },
  },
  {
    slug: 'file-download-security',
    title: '파일 다운로드 응답 설계와 위험',
    body: `업로드는 조심하면서 다운로드는 그냥 내보내는 경우가 많다. 그런데 응답 헤더 몇 개를 잘못 두면 우리가 저장해 둔 파일이 우리 도메인에서 실행되는 스크립트가 된다. 그러면 업로드한 사람이 다른 사용자의 세션을 가져갈 수 있다. 다운로드 응답은 형식을 고정하고, 브라우저가 추측하지 못하게 하고, 되도록 다른 출처에서 내보내는 것이 원칙이다.

## 무엇이 문제가 되는가?

| 상황 | 결과 |
| --- | --- |
| Content-Type 을 추측하게 둠 | HTML 로 해석되어 스크립트 실행 |
| 원본 파일명을 그대로 사용 | 헤더 조작, 경로 문자 포함 |
| 같은 도메인에서 서빙 | 실행되면 우리 세션 범위 |
| 인가 없이 식별자로 접근 | 남의 파일 열람 |
| 응답 캐시 설정 없음 | 공유 캐시에 남는다 |

![업로드 파일이 실행되는 경로](/img/posts/file-download-security.svg)

## 응답 헤더 기준

\`\`\`
Content-Type: application/octet-stream        형식을 추측하지 않게
X-Content-Type-Options: nosniff               추측 자체를 금지
Content-Disposition: attachment; filename*=UTF-8''<인코딩된 이름>
Content-Security-Policy: sandbox              열려도 실행되지 않게
Cache-Control: private, no-store              공유 캐시에 남기지 않게
\`\`\`

이미지처럼 화면에 바로 보여야 하는 파일은 형식을 검증한 뒤 해당 형식으로 고정해 내보낸다. 사용자가 올린 값을 그대로 쓰지 않는다.

## 다른 출처에서 내보내는 것이 근본 대책

업로드된 파일을 서비스 도메인이 아닌 별도 도메인에서 서빙하면, 그 파일이 스크립트로 실행되더라도 우리 세션과 쿠키에 접근할 수 없다. 사용자 콘텐츠를 다루는 서비스가 별도 도메인을 쓰는 이유다.

![같은 도메인과 분리된 도메인의 차이](/img/posts/file-download-security-2.svg)

## 파일명 처리

원본 파일명에는 줄바꿈, 따옴표, 경로 구분자가 들어올 수 있다. 헤더에 그대로 넣으면 헤더가 깨지거나 조작된다. 저장은 무작위 이름으로 하고, 내려줄 때만 인코딩한 표시용 이름을 붙인다.

## 접근 통제

파일 주소가 추측 불가하다는 것만으로는 통제가 아니다. 주소는 공유되고 로그에 남는다. 다운로드 요청마다 그 사용자가 그 파일에 접근해도 되는지 확인하거나, 짧은 수명의 서명된 주소를 발급한다.

## 바로 확인하기

내려받은 응답의 헤더를 그대로 본다.

\`\`\`bash
curl -sI "https://app.example.com/files/abc123" -H "Cookie: session=$S" \\
  | grep -iE 'content-type|content-disposition|x-content-type-options|cache-control'

# HTML 파일을 올려 두고 그 응답이 어떻게 나오는지 확인한다 (스테이징에서)
#   Content-Type: text/html 로 나오면 실행된다
\`\`\`

남의 파일에 접근되는지도 함께 본다.

\`\`\`bash
A=<사용자A 세션>; B=<사용자B 세션>
ID=$(curl -s -H "Cookie: session=$A" https://app.example.com/api/files | head -c 200)
curl -s -o /dev/null -w '%{http_code}\\n' -H "Cookie: session=$B" \\
  "https://app.example.com/files/$ID"
\`\`\`

## 참고

- OWASP Cheat Sheet — File Upload
- RFC 6266 — Content-Disposition in HTTP
- MDN — X-Content-Type-Options`,
    diagram: {
      type: 'flow',
      caption: '업로드 파일이 스크립트가 되는 경로',
      steps: [
        { label: '파일 업로드', note: 'HTML 내용' },
        { label: '같은 도메인 서빙', note: 'Content-Type 추측' },
        { label: '브라우저가 실행', note: '우리 출처에서', danger: true },
        { label: '세션 접근', note: '다른 사용자 피해', danger: true },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '서빙 도메인과 형식 고정',
      x: ['형식 고정 + nosniff', '형식 추측 허용'],
      y: ['분리 도메인', '같은 도메인'],
      cells: ['안전', '실행돼도 세션 접근 불가', '실행되지 않음', '세션 탈취 가능'],
    },
  },
  {
    slug: 'zip-bomb',
    title: '압축 폭탄과 업로드 파일 처리 한도',
    body: `압축 파일은 크기가 작아도 풀면 수백 기가가 될 수 있다. 업로드 크기만 검사하고 압축 해제에는 한도를 두지 않으면, 몇십 킬로바이트짜리 파일 하나로 디스크와 메모리를 채울 수 있다. 오피스 문서와 이미지 일부도 내부가 압축 형식이라 같은 문제를 안고 있다. 방어는 해제 결과에 상한을 두고, 상한을 넘으면 중간에 끊는 것이다.

## 왜 크기 검사만으로는 부족한가?

압축률이 높은 데이터는 같은 바이트가 반복되는 형태다. 0으로 채운 파일은 수천 배로 압축된다. 여기에 압축 파일 안에 압축 파일을 넣는 중첩까지 더하면 배율이 더 커진다. 업로드 시점에 보이는 것은 압축된 크기뿐이다.

![압축된 크기와 해제 후 크기](/img/posts/zip-bomb.svg)

## 한도를 두어야 하는 지점

| 지점 | 상한 |
| --- | --- |
| 업로드 크기 | 형식별로 다르게 |
| 해제 후 총 크기 | 업로드 크기의 배수로 |
| 파일 개수 | 아카이브 안 항목 수 |
| 중첩 깊이 | 압축 안의 압축 |
| 개별 항목 크기 | 한 파일이 전부를 차지하지 않게 |
| 처리 시간 | 시간 초과 시 중단 |

## 스트리밍으로 처리하고 중간에 끊는다

파일 전체를 풀어 놓고 크기를 재면 이미 늦다. 해제하면서 누적 바이트를 세고 상한을 넘는 순간 중단해야 한다. 임시 파일도 함께 지운다.

![상한을 넘으면 중단하는 처리](/img/posts/zip-bomb-2.svg)

## 격리된 곳에서 처리한다

압축 해제는 자원을 많이 쓰는 작업이라 웹 서버와 같은 프로세스에서 하면 서비스 전체가 함께 느려진다. 별도 작업자로 분리하고, 그 작업자에 메모리와 CPU 상한을 건다. 컨테이너로 격리하면 상한을 운영체제 수준에서 강제할 수 있다.

## 문서 파일도 대상이다

오피스 문서와 일부 이미지 형식은 내부가 압축된 XML 이다. 문서를 파싱하는 라이브러리가 압축 해제를 대신 하므로, 우리 코드에 압축 처리가 없어도 같은 위험이 있다. 라이브러리에 크기 상한 옵션이 있는지 확인한다.

## 바로 확인하기

해제 전에 아카이브가 신고한 크기를 먼저 읽어 판단한다.

\`\`\`bash
# 신고된 해제 후 크기와 압축률 확인
unzip -l suspicious.zip | tail -3

# 배율이 비정상적으로 높으면 처리하지 않는다
python3 - <<'PY'
import zipfile
z = zipfile.ZipFile('suspicious.zip')
comp = sum(i.compress_size for i in z.infolist())
raw = sum(i.file_size for i in z.infolist())
print(f'압축 {comp:,}B → 해제 {raw:,}B · 배율 {raw / max(comp, 1):.0f}배 · 항목 {len(z.infolist())}개')
PY
\`\`\`

처리 코드는 누적 크기를 세며 끊는다.

\`\`\`ts
const MAX_TOTAL = 200 * 1024 * 1024   // 해제 후 총 200MB
const MAX_ENTRIES = 1000

let total = 0
for (const entry of archive.entries) {
  if (++count > MAX_ENTRIES) throw new Error('too many entries')
  for await (const chunk of entry.stream()) {
    total += chunk.length
    if (total > MAX_TOTAL) throw new Error('expanded size limit')  // 즉시 중단
    await sink.write(chunk)
  }
}
\`\`\`

## 참고

- CWE-409: Improper Handling of Highly Compressed Data
- OWASP Cheat Sheet — File Upload
- 각 언어 압축 라이브러리의 제한 옵션 문서`,
    diagram: {
      type: 'bars',
      caption: '압축 크기와 해제 후 크기',
      unit: 'MB',
      items: [
        { label: '정상 문서', value: 12, note: '압축 3MB' },
        { label: '높은 압축률', value: 400, note: '압축 1MB' },
        { label: '중첩 압축', value: 900, note: '압축 40KB' },
      ],
    },
    diagram2: {
      type: 'flow',
      caption: '해제 처리 흐름',
      steps: [
        { label: '신고 크기 확인', note: '배율이 크면 거부' },
        { label: '스트리밍 해제', note: '누적 바이트 계산' },
        { label: '상한 초과 시 중단', note: '임시 파일 정리' },
        { label: '격리 작업자', note: '메모리·CPU 상한' },
      ],
    },
  },
  {
    slug: 'svg-upload',
    title: 'SVG 업로드가 위험한 이유와 처리',
    body: `SVG 는 이미지처럼 보이지만 내용은 XML 문서다. 스크립트를 담을 수 있고, 외부 자원을 불러올 수 있고, 다른 문서를 참조할 수도 있다. 그래서 파일 업로드에서 SVG 를 허용하면 이미지 업로드가 아니라 문서 업로드를 허용한 것이 된다. 처리 방법은 세 가지 중 하나를 고르는 것이고, 가장 쉬운 선택은 허용하지 않는 것이다.

## 무엇이 들어갈 수 있는가?

- script 요소와 이벤트 속성
- 외부 이미지·폰트·스타일 참조
- 다른 문서를 끌어오는 참조 요소
- 외부 엔티티 선언 (XML 이므로)
- 애니메이션 요소를 통한 속성 변경

파일 확장자와 MIME 타입만 검사하면 전부 통과한다. 내용을 봐야 판단할 수 있다.

![SVG 가 처리되는 두 가지 경로](/img/posts/svg-upload.svg)

## 파일 업로드에서 고를 수 있는 세 가지

| 방식 | 안전도 | 비용 |
| --- | --- | --- |
| 허용하지 않음 | 가장 높음 | 사용자 불편 |
| 래스터로 변환해 저장 | 높음 | 변환 처리 필요 |
| 정제 후 저장 | 중간 | 정제기 유지보수 |
| 그대로 저장 + 분리 도메인 | 중간 | 도메인 운영 |
| 그대로 저장 | 낮음 | 없음 |

## 화면에 어떻게 넣는지가 실행 여부를 가른다

같은 SVG 라도 넣는 방법에 따라 스크립트 실행 여부가 달라진다. img 요소로 넣으면 스크립트가 실행되지 않지만, 문서에 직접 삽입하면 실행된다. 파일을 주소로 직접 열었을 때도 실행된다.

\`\`\`
<img src="/u/avatar.svg">    스크립트 실행 안 됨
직접 삽입 (innerHTML)         실행됨 — 가장 위험
새 탭에서 파일 주소 열기       실행됨
CSS background-image          실행 안 됨
\`\`\`

![삽입 방식별 실행 여부](/img/posts/svg-upload-2.svg)

## 정제한다면 허용 목록으로

차단 목록은 새 요소와 속성이 추가될 때마다 뚫린다. 허용할 요소와 속성을 정해 두고 나머지를 전부 제거하는 방식이어야 한다. 검증된 정제 라이브러리를 쓰고, 정제 결과를 다시 파싱해 확인한다.

## 서빙 헤더도 함께

정제하더라도 응답 헤더로 한 겹 더 막는다. 형식을 고정하고 추측을 금지하고, 콘텐츠 보안 정책으로 스크립트를 차단한다. 사용자 콘텐츠 전용 도메인에서 내보내면 실행되더라도 서비스 세션에 닿지 못한다.

## 바로 확인하기

파일 업로드로 들어온 SVG 안에 무엇이 들어 있는지 직접 본다.

\`\`\`bash
# 저장된 SVG 에서 위험 요소 찾기
grep -rlE '<script|on[a-z]+=|<foreignObject|<!ENTITY|xlink:href="http' uploads/ | head

# 우리 서비스가 SVG 를 어떤 헤더로 내보내는지
curl -sI https://app.example.com/u/avatar.svg \
  | grep -iE 'content-type|x-content-type-options|content-security-policy'
\`\`\`

허용 여부를 코드에서 명시적으로 정한다.

\`\`\`ts
const RASTER = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

// SVG 는 문서다. 이미지 목록에 섞지 않는다.
if (type === 'image/svg+xml') {
  if (!ALLOW_SVG) throw new BadRequest('SVG 는 지원하지 않습니다')
  buffer = sanitizeSvg(buffer)          // 허용 목록 기반 정제
}
if (!RASTER.includes(type) && type !== 'image/svg+xml') throw new BadRequest('형식')
\`\`\`

## 참고

- OWASP Cheat Sheet — File Upload
- MDN — SVG and scripting
- W3C SVG 규격, script 요소`,
    diagram: {
      type: 'flow',
      caption: 'SVG 업로드 처리 판단',
      steps: [
        { label: '형식 확인', note: 'SVG 는 이미지가 아니라 문서' },
        { label: '허용 여부 결정', note: '거부·변환·정제 중 하나' },
        { label: '정제', note: '허용 목록 기반' },
        { label: '분리 도메인 서빙', note: '실행돼도 세션 접근 불가' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '삽입 방식과 실행 여부',
      x: ['정제함', '정제 안 함'],
      y: ['문서에 직접 삽입', 'img 로 표시'],
      cells: ['비교적 안전', '스크립트 실행', '실행 안 됨', '실행 안 되나 외부 요청'],
    },
  },
  {
    slug: 'dom-clobbering',
    title: 'DOM 클로버링과 전역 이름 오염',
    body: `스크립트를 넣지 못하더라도 HTML 요소만으로 자바스크립트 변수의 값을 바꿀 수 있다. 요소에 붙인 id 나 name 이 전역 객체의 속성이 되기 때문이다. 스크립트를 막는 정책이 있어도 이 경로는 열려 있어서, 설정값이나 함수 참조가 요소로 덮이면 로직이 통째로 달라진다. 방어는 전역 이름에 의존하지 않는 코드와 정제 규칙 양쪽에 있다.

## 어떻게 값이 덮이는가?

브라우저는 id 를 가진 요소를 전역 이름으로도 접근할 수 있게 해 준다. 그래서 사용자 입력으로 만들어진 요소의 id 가 코드에서 쓰는 이름과 같으면, 그 이름이 요소를 가리키게 된다. 이름이 두 단계인 경우도 요소 두 개로 만들 수 있다.

\`\`\`html
<a id="config"></a>                     config 가 요소가 된다
<a id="config" name="url" href="..."></a>   config.url 이 주소 문자열이 된다
\`\`\`

![입력 HTML 이 전역 이름을 덮는 과정](/img/posts/dom-clobbering.svg)

## 어떤 코드가 취약한가?

| 코드 형태 | 위험 |
| --- | --- |
| 전역 변수에 설정 보관 | 요소로 덮인다 |
| 선언 없이 이름 사용 | 요소를 참조하게 된다 |
| 기본값 확인 후 사용 | 요소가 참으로 평가된다 |
| 함수 존재 확인 | 요소는 함수가 아니라 호출 시 오류 |
| 문서 속성 직접 접근 | 사용자 입력 요소와 충돌 |

## 크로스 사이트 스크립팅을 막아도 왜 남는가?

콘텐츠 보안 정책으로 크로스 사이트 스크립팅을 차단해도 이 기법은 통한다. 스크립트를 새로 실행하는 것이 아니라, 이미 있는 코드가 읽는 값을 바꾸는 것이기 때문이다. 스크립팅 대응으로 넣은 정제기가 script 만 지우고 id·name 을 그대로 두면 경로가 남는다.

![차단 정책과 클로버링의 관계](/img/posts/dom-clobbering-2.svg)

## 코드 쪽 대책

- 설정과 상태를 전역이 아닌 모듈 범위에 둔다
- 변수를 선언 없이 쓰지 않는다
- 값을 쓰기 전에 형을 확인한다 — 문자열인지, 함수인지
- 문서에서 요소를 찾을 때는 명시적인 조회 함수를 쓴다

## 정제 쪽 대책

사용자 HTML 을 허용하는 기능이 있다면 정제 단계에서 id 와 name 을 제거하거나 접두어를 붙인다. 검증된 정제 라이브러리는 이 옵션을 제공한다. 직접 만든 정제기는 대부분 이 항목을 빠뜨린다.

## 바로 확인하기

전역 이름에 의존하는 코드를 먼저 찾는다.

\`\`\`bash
# 선언 없이 전역 이름을 읽는 자리
grep -rnE 'window\\.[a-zA-Z_]+ *\\|\\||typeof [a-zA-Z_]+ *!== *.undefined' \\
  --include='*.ts' --include='*.js' src/ | head -20

# 사용자 HTML 을 정제할 때 id·name 을 남기는지
grep -rn 'sanitize\\|DOMPurify' --include='*.ts' src/
\`\`\`

브라우저에서 실제로 덮이는지 확인한다.

\`\`\`js
// 사용자 입력으로 만들어진 영역에 아래를 넣고 전역 이름을 읽어 본다
container.innerHTML = '<a id="appConfig" name="apiBase" href="https://evil.test"></a>'
console.log(typeof window.appConfig, String(window.appConfig?.apiBase))
// 'object' 와 주소가 나오면 덮인 것이다
\`\`\`

## 참고

- HTML Standard — named access on the Window object
- OWASP Cheat Sheet — DOM based XSS Prevention
- PortSwigger Web Security Academy — DOM clobbering`,
    diagram: {
      type: 'flow',
      caption: '요소가 전역 이름을 덮는 과정',
      steps: [
        { label: '사용자 HTML 삽입', note: 'script 없이 id·name 만' },
        { label: '전역 이름 생성', note: '브라우저 기본 동작' },
        { label: '코드가 그 이름을 읽음', note: '값이 요소로 바뀜', danger: true },
        { label: '로직 변경', note: '주소·설정이 뒤바뀐다', danger: true },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '정책과 정제의 조합',
      x: ['id·name 제거', '유지'],
      y: ['스크립트 차단', '차단 없음'],
      cells: ['막힘', '클로버링은 통한다', '스크립트로 충분', '모두 통한다'],
    },
  },
  {
    slug: 'same-origin-policy',
    title: '동일 출처 정책과 새어 나가는 정보',
    body: `브라우저 보안의 바탕은 다른 출처의 문서가 우리 문서의 내용을 읽지 못하게 하는 규칙이다. 그런데 이 규칙은 "읽기"를 막을 뿐 "보내기"와 "관찰"까지 막지는 않는다. 그래서 응답을 읽지 못해도 응답이 있었는지, 얼마나 걸렸는지, 크기가 얼마인지로 정보가 새어 나간다. 무엇이 막히고 무엇이 남는지를 알아야 방어할 자리가 보인다.

## 무엇이 막히고 무엇이 남는가?

| 동작 | 막히는가 |
| --- | --- |
| 다른 출처 응답 본문 읽기 | 막힘 |
| 다른 출처로 요청 보내기 | 막히지 않음 |
| 요청 성공·실패 관찰 | 막히지 않음 |
| 응답 시간 측정 | 막히지 않음 |
| 이미지 크기·로드 여부 | 막히지 않음 |
| 프레임 개수 관찰 | 막히지 않음 |
| 창 이동 여부 | 막히지 않음 |

![읽기는 막히지만 관찰은 남는다](/img/posts/same-origin-policy.svg)

## 관찰만으로 무엇을 알 수 있는가

로그인 여부를 판별하는 것이 대표적이다. 로그인한 사용자에게만 보이는 이미지를 불러 보고 성공하면 로그인 상태다. 검색 결과 수에 따라 응답 시간이 달라지면, 시간을 재는 것만으로 결과 존재 여부를 알 수 있다. 사용자를 특정하는 데까지 이어질 수 있다.

## 막는 방법

- 상태를 바꾸지 않는 조회도 인가를 확인한다
- 다른 출처에서 시작된 요청에 쿠키가 붙지 않게 한다 (SameSite)
- 리소스 격리 헤더로 다른 출처의 포함 자체를 막는다
- 응답 시간과 크기가 내용에 따라 달라지지 않게 한다
- 프레임 포함을 차단한다

![격리 헤더가 막는 범위](/img/posts/same-origin-policy-2.svg)

## 격리 헤더 세 가지

\`\`\`
Cross-Origin-Resource-Policy: same-origin     다른 출처가 우리 자원을 포함하지 못하게
Cross-Origin-Opener-Policy: same-origin       우리가 연 창과의 연결을 끊어 관찰 차단
Cross-Origin-Embedder-Policy: require-corp    우리 문서가 포함하는 것을 명시적으로만
\`\`\`

앞의 두 개는 부작용이 적어 먼저 넣을 수 있다. 세 번째는 외부 자원을 많이 쓰는 페이지에서 깨질 수 있으므로 관찰 후 적용한다.

## 오해하기 쉬운 지점

CORS 는 이 규칙을 푸는 장치이지 보안 통제가 아니다. CORS 를 좁게 두어도 서버가 인가를 확인하지 않으면 브라우저가 아닌 클라이언트는 그대로 읽는다. 반대로 CORS 를 열어도 인가가 있으면 남의 데이터는 나가지 않는다.

## 바로 확인하기

격리 헤더가 붙어 있는지부터 본다.

\`\`\`bash
for p in / /me /api/orders; do
  printf '%-14s ' "$p"
  curl -sI "https://app.example.com$p" \\
    | grep -icE 'cross-origin-(resource|opener|embedder)-policy'
done
\`\`\`

로그인 여부가 관찰되는지 시험한다.

\`\`\`html
<!-- 로그인 사용자에게만 200 인 자원 -->
<img src="https://app.example.com/me/avatar" onload="alert('로그인 상태')" onerror="alert('비로그인')">
\`\`\`

이 구분이 생기면 SameSite 와 리소스 격리로 막는다.

## 참고

- MDN — Same-origin policy
- web.dev — Cross-Origin Isolation
- OWASP Cheat Sheet — Cross-Site Request Forgery Prevention`,
    diagram: {
      type: 'layers',
      caption: '출처 격리의 층',
      layers: [
        { label: '동일 출처 정책', note: '응답 읽기 차단' },
        { label: 'SameSite 쿠키', note: '타 사이트발 요청에 미부착' },
        { label: '리소스 격리 헤더', note: '포함·관찰 차단' },
        { label: '서버 인가', note: '브라우저 밖 요청까지' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '읽기 차단과 관찰 차단',
      x: ['격리 헤더 있음', '없음'],
      y: ['인가 확인', '확인 없음'],
      cells: ['안전', '관찰로 유출', '읽기만 막힘', '가장 취약'],
    },
  },
]
