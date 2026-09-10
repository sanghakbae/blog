const R = String.raw
export default {

'csp-nonce': R`## 실제로 이렇게 터진다

정책은 있는데 인라인 허용이 들어 있어 효과가 없던 사례가 흔하다. 도입 당시 화면이 깨져서 임시로 넣었고, 그대로 몇 년이 지났다. 점검 도구에서는 정책이 있다고 나오니 아무도 다시 보지 않았다.

nonce 를 쓰면서 값을 고정한 경우도 있다. 요청마다 새로 만들어야 하는데 설정 파일에 상수로 박아 두었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 정책이 있으면 보호된다 | 인라인 허용이 있으면 무력하다 |
| nonce 는 비밀값이다 | 예측 불가능하면 된다, 매 요청 새로 |
| 해시 방식이 더 간단하다 | 스크립트가 바뀌면 매번 갱신해야 한다 |
| strict-dynamic 은 위험하다 | 오히려 목록 관리를 없애 준다 |
| 한 번 켜면 끝이다 | 화면이 바뀌면 다시 본다 |

## 왜 nonce 로 옮기는가

출처 목록 방식은 그 출처 안의 아무 파일이나 허용한다. 공개 CDN 하나를 허용하면 그 CDN 의 모든 스크립트가 실행 가능해진다. nonce 는 우리가 넣은 것만 허용한다.

| 방식 | 허용 범위 | 관리 |
| --- | --- | --- |
| 출처 목록 | 그 출처 전체 | 목록 유지 |
| 해시 | 그 내용 정확히 | 변경 시 갱신 |
| nonce | 우리가 표시한 것 | 요청마다 생성 |
| nonce + strict-dynamic | 표시된 것과 그것이 부른 것 | 목록 불필요 |

## 옮기는 순서

1. 보고 전용으로 nonce 정책을 함께 내려 본다 — 기존 정책은 유지
2. 위반 보고에서 인라인 스크립트 위치를 찾는다
3. 인라인을 외부 파일로 빼거나 nonce 를 붙인다
4. 인라인 이벤트 속성을 제거한다 — 이것이 가장 오래 걸린다
5. unsafe-inline 을 빼고 차단으로 전환한다
6. strict-dynamic 을 추가해 출처 목록을 없앤다

\`\`\`
Content-Security-Policy:
  default-src 'self';
  script-src 'nonce-{요청마다-무작위}' 'strict-dynamic';
  object-src 'none';
  base-uri 'self';
  report-uri /csp-report
\`\`\`

\`\`\`bash
# 인라인 이벤트 속성이 남아 있는지 — nonce 로도 못 막는다
grep -rnoE 'on(click|load|error|submit|change|mouseover)=' \
  --include='*.html' --include='*.jsx' --include='*.tsx' src/ | head -20
\`\`\``,

'cookie-attributes': R`## 실제로 이렇게 터진다

세션 쿠키에 도메인을 상위로 지정한 사례가 있다. 편의를 위해 전 서브도메인에서 쓰려고 했는데, 그중 하나가 외부 서비스에 위임돼 있었다. 그 서비스가 우리 세션 쿠키를 받게 됐다.

Secure 를 빼고 개발한 뒤 그대로 배포한 경우도 있다. 로컬에서 HTTPS 가 아니라 붙였다가 잊은 것이다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| HttpOnly 면 안전하다 | 요청 위조는 그대로다 |
| 도메인을 넓히면 편하다 | 서브도메인 전체가 읽는다 |
| Secure 는 HTTPS 면 자동이다 | 명시하지 않으면 평문으로도 간다 |
| SameSite 기본값이 있으니 된다 | 명시하는 편이 안전하다 |
| 경로 제한은 보안 기능이다 | 격리 수단이 아니다 |

## 속성별 판단

| 속성 | 권장 | 이유 |
| --- | --- | --- |
| HttpOnly | 인증 쿠키에 필수 | 스크립트 접근 차단 |
| Secure | 항상 | 평문 전송 방지 |
| SameSite | Lax 이상 | 교차 사이트 전송 제한 |
| Domain | 지정하지 않음 | 정확한 호스트로 한정된다 |
| Path | 필요한 경로만 | 격리 목적은 아님 |
| Max-Age | 짧게 | 세션 쿠키는 생략도 고려 |
| 접두사 | __Host- 사용 | 속성 강제 |

Domain 을 지정하지 않는 것이 핵심이다. 지정하면 하위 도메인 전체로 넓어진다.

## 접두사를 쓰면 강제된다

이름에 접두사를 붙이면 브라우저가 속성을 강제한다. 실수로 속성이 빠지는 것을 막는다.

\`\`\`
Set-Cookie: __Host-session=abc; Path=/; Secure; HttpOnly; SameSite=Lax
\`\`\`

이 접두사는 Secure 필수, Domain 금지, Path 는 루트를 요구한다. 하나라도 어기면 브라우저가 쿠키를 저장하지 않는다.

\`\`\`bash
# 지금 내려가는 쿠키의 속성 확인
curl -sI -X POST https://stg.example.com/api/login -d 'id=t&pw=t' |
  grep -i '^set-cookie' | tr ';' '\n' | sed 's/^ //'
# HttpOnly, Secure, SameSite 가 모두 있어야 한다. Domain 이 있으면 검토 대상
\`\`\``,

'postmessage-security': R`## 실제로 이렇게 터진다

프레임 간 통신에서 출처를 확인하지 않은 사례가 있다. 어떤 사이트든 우리 페이지를 프레임에 넣고 메시지를 보내면 그대로 처리됐다. 그 메시지로 화면 내용을 바꾸거나 요청을 유발할 수 있었다.

반대로 보낼 때 대상 출처를 와일드카드로 둔 경우도 있다. 프레임이 다른 사이트로 이동하면 그 사이트가 메시지를 받는다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 우리 프레임끼리만 통신한다 | 누구나 메시지를 보낼 수 있다 |
| 형식이 맞아야 처리된다 | 형식은 흉내 낼 수 있다 |
| 대상 출처는 편의 설정이다 | 와일드카드는 유출 경로다 |
| 받는 쪽만 확인하면 된다 | 보내는 쪽도 대상을 지정해야 한다 |
| 내부 메시지는 신뢰한다 | 출처 확인 없이는 내부가 아니다 |

## 양쪽에서 확인한다

\`\`\`ts
// 보낼 때 — 대상 출처를 명시한다. '*' 는 쓰지 않는다.
frame.contentWindow?.postMessage(payload, 'https://widget.example.com')

// 받을 때 — 출처와 형식을 모두 확인한다
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://widget.example.com') return     // 출처
  if (e.source !== frame.contentWindow) return              // 보낸 창까지 확인
  const msg = Schema.safeParse(e.data)                      // 형식
  if (!msg.success) return
  handle(msg.data)
})
\`\`\`

보낸 창까지 확인하는 것이 좋다. 같은 출처의 다른 창이 보낸 메시지를 구분할 수 있다.

## 무엇을 주고받지 않는가

| 항목 | 이유 |
| --- | --- |
| 인증 토큰 | 프레임이 이동하면 새어 나간다 |
| 개인정보 | 로그와 확장 프로그램에 노출 |
| 실행 가능한 코드 | 문자열을 평가하는 구조는 금지 |
| 권한 판정 결과 | 위조 가능, 서버가 판정 |

\`\`\`bash
# 출처 검증 없는 수신 처리기 찾기
grep -rnA5 "addEventListener('message'" src/ |
  grep -B2 -A5 'message' | grep -L 'origin' | head
grep -rn "postMessage(.*, *'\*'" src/ | head
\`\`\``,

'prototype-pollution': R`## 실제로 이렇게 터진다

설정 병합 함수를 통해 전역 객체가 오염된 사례가 있다. 사용자가 보낸 JSON 에 특수 키가 들어 있었고, 깊은 병합 과정에서 그 값이 모든 객체의 기본값이 됐다. 이후 권한 확인 코드가 그 값을 참조하면서 우회가 성립했다.

라이브러리를 통해 들어온 경우도 있다. 우리 코드에는 병합이 없었는데 의존성 안에 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 우리는 병합을 안 쓴다 | 라이브러리가 쓴다 |
| JSON 파싱은 안전하다 | 파싱은 안전하나 이후 처리가 문제다 |
| 특수 키만 막으면 된다 | 다른 경로도 있다 |
| 서버에서만 문제다 | 클라이언트에서 스크립팅으로 이어진다 |
| 영향이 제한적이다 | 전역에 영향을 준다 |

## 어디에서 생기는가

| 패턴 | 위험 |
| --- | --- |
| 깊은 병합 | 가장 흔하다 |
| 경로 문자열로 값 설정 | 경로에 특수 키 |
| 쿼리 문자열 파싱 | 중첩 표기 지원 시 |
| 객체 복제 | 재귀 복사 |
| 템플릿 데이터 병합 | 사용자 값과 기본값 결합 |

## 어떻게 막는가

1. 병합 대상 키를 허용 목록으로 제한한다
2. 특수 키를 명시적으로 거부한다
3. 프로토타입이 없는 객체를 쓴다
4. 스키마로 검증한 뒤에만 병합한다
5. 라이브러리를 최신으로 유지한다

\`\`\`ts
const BLOCKED = new Set(['__proto__', 'constructor', 'prototype'])

function safeMerge(target: Record<string, unknown>, src: Record<string, unknown>) {
  for (const k of Object.keys(src)) {
    if (BLOCKED.has(k)) continue                    // 특수 키 거부
    const v = src[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = safeMerge((target[k] as Record<string, unknown>) ?? Object.create(null), v as Record<string, unknown>)
    } else {
      target[k] = v
    }
  }
  return target
}

// 사용자 입력을 담는 객체는 프로토타입 없이 만든다
const params = Object.assign(Object.create(null), req.query)
\`\`\`

\`\`\`bash
# 위험한 병합 패턴 찾기
grep -rnE '(deepMerge|merge\(|extend\(|_\.merge|Object\.assign\(.*req\.(body|query))' src/ | head -20
\`\`\``,

'regex-dos': R`## 실제로 이렇게 터진다

입력 검증용 정규식 하나로 서버가 멈춘 사례가 있다. 이메일 형식을 확인하는 패턴이었고, 특정 형태의 긴 문자열에서 시간이 기하급수적으로 늘어났다. 요청 몇 개로 CPU 가 포화됐다.

라이브러리 안의 정규식이 원인인 경우도 있다. 우리 코드에는 없었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 정규식은 빠르다 | 역추적이 폭발할 수 있다 |
| 짧은 패턴은 안전하다 | 길이와 무관하다 |
| 입력 길이를 제한하면 된다 | 짧은 입력으로도 가능하다 |
| 우리 정규식만 보면 된다 | 라이브러리 안에도 있다 |
| 타임아웃을 걸면 해결된다 | 언어에 따라 지원하지 않는다 |

## 위험한 패턴

| 형태 | 문제 |
| --- | --- |
| 중첩된 수량자 | 조합이 폭발한다 |
| 겹치는 선택 + 수량자 | 여러 경로로 일치 시도 |
| 앞뒤로 열린 와일드카드 | 시작 위치마다 시도 |

핵심은 같은 문자열을 여러 방식으로 일치시킬 수 있는 구조다. 실패할 때 그 모든 조합을 시도한다.

## 어떻게 막는가

1. 정규식 대신 문자열 함수를 쓴다 — 대부분 가능하다
2. 필요하면 역추적이 없는 엔진을 쓴다
3. 입력 길이를 먼저 제한한다 — 완전하진 않지만 도움이 된다
4. 사용자 입력을 정규식으로 컴파일하지 않는다
5. 검사 도구로 위험 패턴을 찾는다
6. 타임아웃을 걸 수 있으면 건다

\`\`\`bash
# 위험한 정규식 패턴 찾기 — 중첩 수량자
grep -rnE '\([^)]*[+*][^)]*\)[+*]' --include='*.ts' --include='*.js' src/ | head -20

# 사용자 입력으로 정규식을 만드는 자리 — 더 위험하다
grep -rnE 'new RegExp\((?!/)[^)]*(req|input|param|query)' --include='*.ts' src/ | head
\`\`\`

\`\`\`ts
// 실제 소요 시간을 재 본다 — 스테이징에서
const re = /^([a-zA-Z0-9_.-]+)+@example\.com$/
const bad = 'a'.repeat(30) + '!'
const t = performance.now()
re.test(bad)
console.log(performance.now() - t, 'ms')   // 수백 ms 를 넘으면 위험하다
\`\`\``,
}
