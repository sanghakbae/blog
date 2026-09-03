import type { SeedPost } from './types'

/** 1~10 — 웹 애플리케이션 취약점 */
export const posts1: SeedPost[] = [
  {
    slug: 'sql-injection',
    title: 'SQL 인젝션이 사라지지 않는 이유와 위치별 대응',
    body: `OWASP Top 10 이 처음 나온 게 2003년인데 SQL 인젝션은 아직 목록에 있다. 20년 넘게 알려진 취약점이 사라지지 않는 이유는 단순하다. 문자열을 이어 붙여 쿼리를 만드는 코드가 계속 새로 쓰이기 때문이다.

## 어디서 계속 생기나

프레임워크가 파라미터 바인딩을 기본 제공하는데도 인젝션이 나오는 자리는 정해져 있다. 정렬 컬럼명, 테이블명, IN 절 목록처럼 **바인딩할 수 없는 위치**다. 개발자는 여기서 어쩔 수 없이 문자열을 조립하고, 검증을 빠뜨린다.

![SQL 인젝션이 발생하는 코드 경로](/img/posts/sql-injection.svg)

동적 검색 조건도 흔한 자리다. 조건이 열 개쯤 되면 쿼리를 조각조각 이어 붙이게 되고, 그중 하나만 바인딩을 놓쳐도 뚫린다.

## 위치별 대응이 다르다

| 삽입 위치 | 바인딩 가능 | 올바른 대응 |
| --- | --- | --- |
| WHERE 절 값 | 가능 | 파라미터 바인딩 |
| LIKE 패턴 | 가능 | 바인딩 + 와일드카드 이스케이프 |
| 정렬 컬럼명 | 불가 | 허용 목록 대조 |
| 정렬 방향 | 불가 | ASC/DESC 두 값만 허용 |
| 테이블명 | 불가 | 허용 목록 대조 |
| IN 절 목록 | 조건부 | 개수만큼 플레이스홀더 생성 |

이스케이프 함수로 해결하려는 시도는 대부분 실패한다. 문자셋 처리나 중첩 인용부호에서 우회가 나온다.

## 성공해도 피해를 줄이는 층

- 애플리케이션 DB 계정에서 DDL 권한과 파일 접근 권한을 제거한다
- 읽기 전용 작업은 별도 계정으로 분리한다
- 한 번에 반환되는 행 수에 상한을 둔다. 전체 덤프를 늦춘다

## 탐지

정적 분석 도구는 문자열 연결 후 실행되는 경로를 꽤 잘 잡는다. 다만 오탐이 많아 무시하는 습관이 생기면 의미가 없다. **신규 코드에서 발견된 것만이라도 반드시 처리한다**는 규칙이 현실적이다.

## 바로 확인하기

문자열을 이어 붙여 쿼리를 만드는 자리를 먼저 찾는다.

\`\`\`bash
# 자바·코틀린에서 연결 연산자로 조립되는 쿼리
grep -rnE '"(SELECT|INSERT|UPDATE|DELETE)[^"]*" *\\+' src/

# 파이썬 f-string / format 으로 만든 쿼리
grep -rnE "(execute|executemany)\\(\\s*f?[\"']" --include='*.py' .

# 노드 템플릿 리터럴 쿼리
grep -rn 'query(\`' --include='*.ts' --include='*.js' src/
\`\`\`

DB 계정 권한도 함께 본다. 애플리케이션 계정에 DDL 이나 파일 접근 권한이 남아 있으면 인젝션 한 번의 피해가 훨씬 커진다.

\`\`\`sql
-- MySQL: 애플리케이션 계정에 남은 권한 확인
SHOW GRANTS FOR 'app'@'%';
-- FILE, CREATE, DROP, SUPER 가 보이면 회수 대상이다

-- PostgreSQL: 테이블별 권한 확인
\\dp public.*
\`\`\`

## 참고

- OWASP ASVS 4.0 — V5.3 출력 인코딩 및 인젝션 방지
- OWASP Cheat Sheet — SQL Injection Prevention
- CWE-89 SQL Injection`,
    diagram: {
      type: 'flow',
      caption: 'SQL 인젝션이 성립하는 조건',
      steps: [
        { label: '사용자 입력', note: '검색어 · 정렬 컬럼' },
        { label: '문자열 연결', note: '바인딩 없이 조립', danger: true },
        { label: 'DB 실행', note: '구문으로 해석됨', danger: true },
        { label: '데이터 유출', note: '권한 범위 전체' },
      ],
    },
  },
  {
    slug: 'xss-context',
    title: 'XSS 방어의 핵심, 출력 컨텍스트별 인코딩',
    body: `크로스 사이트 스크립팅을 막는다고 하면 대부분 출력 이스케이프를 떠올린다. 맞는 말이지만 절반이다. 어디에 출력하느냐에 따라 필요한 처리가 완전히 달라진다.

## 어디에 출력하느냐에 따라 무엇이 달라지는가?

같은 문자열이라도 HTML 본문, 속성값, 자바스크립트 리터럴, URL 파라미터, CSS 안에서 각각 다르게 해석된다. HTML 이스케이프만 해두고 자바스크립트 문자열 안에 넣으면 여전히 뚫린다.

| 출력 위치 | 위험한 문자 | 필요한 처리 |
| --- | --- | --- |
| HTML 본문 | 꺾쇠, 앰퍼샌드 | HTML 엔티티 변환 |
| 속성값 | 따옴표, 공백 | 엔티티 변환 + 반드시 인용 |
| href / src | javascript: 스킴 | 스킴 허용 목록 |
| 스크립트 리터럴 | 따옴표, 역슬래시, 줄바꿈 | JS 문자열 인코딩 |
| CSS 값 | 괄호, expression | CSS 인코딩 또는 금지 |
| JSON 응답 | 없음 | Content-Type 정확히 지정 |

특히 위험한 자리는 **href 속성**이다. javascript: 스킴을 걸러내지 않으면 이스케이프를 아무리 해도 소용없다.

## 리액트를 쓰면 안전한가

기본 출력은 안전하다. 문제는 dangerouslySetInnerHTML 이다. 이름에 경고가 들어 있는데도 마크다운 렌더링 같은 곳에서 무심코 쓰인다. 이 자리에는 반드시 새니타이저를 통과시켜야 한다.

![XSS 방어 계층](/img/posts/xss-context.svg)

## CSP 는 안전망이다

Content-Security-Policy 로 인라인 스크립트를 막아두면, 이스케이프를 한 곳 놓쳐도 실행까지는 가지 않는다. 방어의 대체재가 아니라 마지막 그물이다.

- script-src 에 unsafe-inline 을 넣는 순간 CSP 의 의미가 거의 사라진다
- nonce 나 해시 기반으로 가는 게 정석이다
- report-uri 로 위반 보고를 먼저 받아본 뒤 차단으로 전환하면 사고를 줄일 수 있다

## 바로 확인하기

위험한 출력 지점을 코드에서 직접 찾는다.

\`\`\`bash
# 리액트에서 HTML 을 그대로 넣는 자리
grep -rn 'dangerouslySetInnerHTML' src/

# 템플릿 엔진의 이스케이프 해제 문법
grep -rnE '\\{\\{\\{|\\|safe|\\|raw|v-html' src/ templates/

# 자바스크립트에서 직접 조립하는 DOM
grep -rnE '\\.(innerHTML|outerHTML|insertAdjacentHTML) *=' src/
\`\`\`

CSP 는 보고 전용으로 먼저 켠다. 차단부터 걸면 화면이 깨지고, 결국 무력화된 정책이 남는다.

\`\`\`
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self' 'nonce-{요청마다-생성};
  object-src 'none';
  base-uri 'self';
  report-uri /csp-report
\`\`\`

## 참고

- OWASP Cheat Sheet — Cross Site Scripting Prevention, DOM based XSS Prevention
- W3C Content Security Policy Level 3
- CWE-79 Improper Neutralization of Input During Web Page Generation`,
    diagram: {
      type: 'layers',
      caption: 'XSS 를 막는 세 겹',
      layers: [
        { label: '입력 검증', note: '형식·길이 제한' },
        { label: '컨텍스트별 출력 인코딩', note: '핵심 방어' },
        { label: 'CSP', note: '놓쳤을 때의 마지막 그물' },
      ],
    },
  },
  {
    slug: 'csrf-samesite',
    title: 'CSRF 방어에서 SameSite 쿠키의 한계',
    body: `SameSite 속성이 브라우저 기본값으로 Lax 가 되면서 CSRF 는 끝난 문제처럼 이야기된다. 실제로 상당 부분 줄었지만 전부는 아니다.

## Lax 는 무엇을 막지 못하는가?

Lax 는 GET 방식의 최상위 이동을 허용한다. 즉 **상태를 바꾸는 GET 엔드포인트**가 남아 있다면 여전히 공격이 가능하다. 로그아웃, 삭제, 설정 변경을 GET 으로 처리하는 코드가 생각보다 많다.

또 하나는 같은 사이트로 취급되는 서브도메인이다. 서브도메인 하나가 장악되면 SameSite 는 방어가 되지 않는다.

| 값 | 교차 사이트 GET | 교차 사이트 POST | 부작용 |
| --- | --- | --- | --- |
| None | 전송 | 전송 | Secure 필수, 사실상 무방비 |
| Lax | 최상위 이동만 전송 | 차단 | 외부 결제 콜백에서 문제 |
| Strict | 차단 | 차단 | 외부 링크 유입 시 로그아웃처럼 보임 |

![CSRF 방어 조합](/img/posts/csrf-samesite.svg)

## 토큰 방식이 여전히 필요한 곳

- 결제, 비밀번호 변경, 권한 부여처럼 되돌리기 어려운 작업
- 서브도메인이 많고 각각 관리 주체가 다른 서비스
- 오래된 브라우저를 지원해야 하는 서비스

## 실무 권장

상태를 바꾸는 요청은 POST 로 통일하고, 쿠키에는 SameSite=Lax 이상을 걸고, 민감한 작업에는 CSRF 토큰을 추가한다. 세 겹이 겹쳐야 안심할 수 있다.

토큰은 세션에 묶어야 한다. 세션과 무관한 난수를 발급해 쿠키와 폼에 함께 넣는 방식은 서브도메인 쿠키 주입에 취약하다.

## 바로 확인하기

상태를 바꾸는 GET 엔드포인트가 남아 있는지부터 본다. SameSite=Lax 는 이것을 막지 못한다.

\`\`\`bash
# 스프링: GET 으로 열린 변경 API
grep -rnE '@GetMapping.*(delete|remove|update|logout|approve)' src/

# 익스프레스: GET 라우트에 부수효과가 있는지
grep -rnE "router\\.get\\(['\"][^'\"]*(delete|remove|update|logout)" src/
\`\`\`

쿠키 속성은 응답에서 직접 확인하는 편이 빠르다.

\`\`\`bash
curl -sI https://example.com/login | grep -i '^set-cookie'
# HttpOnly, Secure, SameSite 가 모두 붙어 있어야 한다
\`\`\`

## 참고

- OWASP Cheat Sheet — Cross-Site Request Forgery Prevention
- RFC 6265bis — Cookies: SameSite 속성
- CWE-352 Cross-Site Request Forgery`,
    diagram: {
      type: 'matrix',
      caption: '요청 성격에 따른 방어 수준',
      x: ['조회만 하는 요청', '상태를 바꾸는 요청'],
      y: ['되돌리기 어려움', '되돌릴 수 있음'],
      cells: ['SameSite 로 충분', 'SameSite + 토큰 + 재인증', 'SameSite 로 충분', 'SameSite + 토큰'],
    },
  },
  {
    slug: 'file-upload',
    title: '파일 업로드 기능의 위험과 안전한 처리 순서',
    body: `업로드 기능은 거의 모든 서비스에 있다. 그리고 거의 모든 침해 사례에 등장한다. 파일 하나를 서버에 올릴 수 있다는 건 생각보다 큰 권한이다.

## 확장자 검사는 왜 무력한가

확장자 블랙리스트는 우회 방법이 너무 많다. 대소문자, 이중 확장자, 널 바이트, 대체 확장자까지 고려하면 목록으로 막는 건 불가능에 가깝다. Content-Type 헤더도 클라이언트가 정하는 값이라 신뢰할 수 없다.

![업로드 처리 절차](/img/posts/file-upload.svg)

## 검사 항목과 실효성

| 검사 | 우회 난이도 | 단독으로 충분한가 |
| --- | --- | --- |
| 확장자 블랙리스트 | 매우 낮음 | 아니오 |
| Content-Type 헤더 | 매우 낮음 | 아니오 |
| 확장자 허용 목록 | 낮음 | 아니오 |
| 파일 시그니처 확인 | 중간 | 아니오 |
| 재인코딩 후 저장 | 높음 | 이미지에 한해 유효 |
| 실행 권한 제거 | 높음 | 핵심 조치 |
| 웹 루트 밖 저장 | 매우 높음 | 핵심 조치 |

## 실제로 효과 있는 조치

- 허용 목록 방식으로 확장자와 MIME 을 모두 검사한다
- 저장할 때 **원본 파일명을 쓰지 않는다**. UUID 로 바꾸면 경로 조작과 덮어쓰기가 함께 막힌다
- 업로드 디렉터리에서 실행 권한을 제거한다. 웹 루트 밖에 저장하는 게 가장 확실하다
- 이미지라면 재인코딩한다. 메타데이터에 숨긴 코드가 함께 사라진다
- 정적 파일은 별도 도메인이나 오브젝트 스토리지에서 서빙해 쿠키와 분리한다

## 가용성도 보안이다

크기 제한 없는 업로드는 디스크를 채워 서비스를 멈추는 가장 쉬운 방법이다. 파일당 크기, 사용자당 총량, 시간당 개수를 모두 제한한다.

## 바로 확인하기

업로드 디렉터리에서 실행 권한이 빠져 있는지, 웹 루트 밖에 있는지 확인한다.

\`\`\`bash
# 업로드 경로에 실행 비트가 남아 있는지
find /var/uploads -type f -perm /111 | head

# 웹 루트 안에 업로드 디렉터리가 있는지
ls -ld /var/www/html/uploads 2>/dev/null && echo '웹 루트 안이다. 밖으로 옮길 것'
\`\`\`

엔진엑스라면 업로드 경로에서 스크립트 실행을 아예 막는다.

\`\`\`nginx
location ^~ /uploads/ {
    types { }                       # MIME 추론 금지
    default_type application/octet-stream;
    add_header X-Content-Type-Options nosniff;
    add_header Content-Disposition attachment;
}
\`\`\`

## 참고

- OWASP Cheat Sheet — File Upload
- CWE-434 Unrestricted Upload of File with Dangerous Type`,
    diagram: {
      type: 'steps',
      caption: '안전한 업로드 처리 순서',
      steps: [
        { label: '크기와 개수 제한', note: '스트림 단계에서 조기 차단' },
        { label: '확장자·MIME 허용 목록', note: '블랙리스트가 아니라 화이트리스트' },
        { label: '시그니처 확인 후 재인코딩', note: '이미지는 다시 그려 저장' },
        { label: 'UUID 이름으로 웹 루트 밖 저장', note: '실행 권한 제거' },
        { label: '별도 도메인에서 서빙', note: '쿠키와 분리' },
      ],
    },
  },
  {
    slug: 'path-traversal',
    title: '경로 탐색 취약점과 정규화 후 검사 원칙',
    body: `사용자 입력으로 파일 경로를 만드는 코드는 언제나 검토 대상이다. 상위 디렉터리 참조 한 줄로 설정 파일이 유출된다.

## 왜 문자열 검사로는 부족한가?

입력에서 상위 참조 문자열을 지우는 방식은 우회가 쉽다. 겹쳐 쓰거나, URL 인코딩하거나, 유니코드 변형을 쓰면 필터를 통과한다.

| 우회 기법 | 단순 문자열 제거 | 정규화 후 검사 |
| --- | --- | --- |
| 상위 참조 반복 | 우회됨 | 차단 |
| 겹쳐 쓰기 | 우회됨 | 차단 |
| URL 인코딩 | 우회됨 | 차단 |
| 이중 인코딩 | 우회됨 | 디코딩 순서 주의 |
| 절대 경로 주입 | 우회됨 | 차단 |
| 심볼릭 링크 | 우회됨 | 링크 해석 필요 |

## 정규화 후 검사

올바른 순서는 이렇다. 먼저 절대 경로로 정규화하고, 그 결과가 허용된 기준 디렉터리 **아래에 있는지** 확인한다. 검사 후 정규화가 아니라 정규화 후 검사여야 한다.

![경로 검증 순서](/img/posts/path-traversal.svg)

심볼릭 링크도 고려해야 한다. 정규화 결과가 링크를 따라 밖으로 나갈 수 있기 때문에, 링크를 따라간 실제 경로로 비교해야 한다.

## 더 나은 설계

경로를 아예 노출하지 않는 방법이 가장 안전하다. 파일에 식별자를 부여하고 데이터베이스에서 실제 경로를 찾아오면, 사용자 입력이 파일 시스템에 닿지 않는다. 다운로드 기능은 대부분 이렇게 바꿀 수 있다.

## 바로 확인하기

사용자 입력이 경로 조립에 쓰이는 자리를 찾는다.

\`\`\`bash
grep -rnE '(readFile|createReadStream|sendFile|File\\(|open\\()' src/ \\
  | grep -vE 'path\\.(resolve|join)\\(__dirname'
\`\`\`

검증은 정규화한 뒤에 한다. 순서가 바뀌면 우회된다.

\`\`\`ts
import { realpathSync } from 'node:fs'
import { resolve, sep } from 'node:path'

const BASE = realpathSync(resolve('/srv/files'))

export function safePath(userInput: string): string {
  const target = realpathSync(resolve(BASE, userInput))
  if (target !== BASE && !target.startsWith(BASE + sep)) {
    throw new Error('허용 범위 밖의 경로')
  }
  return target
}
\`\`\`

realpathSync 를 쓰는 이유는 심볼릭 링크까지 따라간 실제 경로로 비교하기 위해서다.

## 참고

- OWASP Cheat Sheet — Input Validation
- CWE-22 Improper Limitation of a Pathname to a Restricted Directory`,
    diagram: {
      type: 'flow',
      caption: '경로 검증은 순서가 결과를 바꾼다',
      steps: [
        { label: '입력 수신', note: '파일명 파라미터' },
        { label: '절대 경로로 정규화', note: '링크까지 해석' },
        { label: '기준 디렉터리 포함 확인', note: '접두 비교' },
        { label: '허용 시에만 접근', note: '아니면 거부', danger: true },
      ],
    },
  },
  {
    slug: 'ssrf',
    title: 'SSRF 공격 경로와 내부 대역 차단',
    body: `서버 측 요청 위조는 클라우드 환경에서 특히 치명적이다. 외부에서 접근할 수 없는 메타데이터 서비스에 서버가 대신 요청을 보내주기 때문이다.

## 공격은 어떻게 진행되는가?

이미지 URL 을 받아 서버가 내려받는 기능이 있다고 하자. 공격자는 여기에 내부 주소를 넣는다. 클라우드 인스턴스의 메타데이터 엔드포인트가 응답하면 임시 자격 증명이 그대로 유출된다.

![SSRF 공격 경로](/img/posts/ssrf.svg)

## 차단해야 할 대역

| 대상 | 대역 | 이유 |
| --- | --- | --- |
| 링크 로컬 | 169.254.0.0/16 | 클라우드 메타데이터 |
| 루프백 | 127.0.0.0/8 | 로컬 관리 포트 |
| 사설 A | 10.0.0.0/8 | 내부 서비스 |
| 사설 B | 172.16.0.0/12 | 내부 서비스 |
| 사설 C | 192.168.0.0/16 | 내부 서비스 |
| IPv6 로컬 | ::1, fc00::/7 | 동일 위험 |

## 막는 방법

- 도메인 허용 목록을 쓴다. 차단 목록은 우회 방법이 너무 많다
- DNS 로 해석한 **최종 IP** 를 검사한다. 도메인만 보면 리바인딩에 뚫린다
- 리다이렉트를 따라가지 않거나, 따라갈 때마다 다시 검사한다
- 메타데이터 서비스는 토큰 필수 모드로 전환한다

## 네트워크 계층에서도 막는다

애플리케이션 코드만으로 완벽히 막기는 어렵다. 외부 콘텐츠를 가져오는 작업은 아웃바운드가 제한된 별도 프록시나 워커에서 수행하게 하면 피해 범위가 줄어든다. 이 구조에서는 코드에 구멍이 남아도 도달할 수 있는 곳이 없다.

## 바로 확인하기

외부 URL 을 받아 서버가 요청하는 기능을 찾는다.

\`\`\`bash
grep -rnE '(fetch|axios|requests\\.get|HttpClient|curl_exec)\\(' src/ \\
  | grep -iE 'url|link|image|callback|webhook'
\`\`\`

메타데이터 서비스는 토큰 필수 모드로 바꾼다. 이것만으로 대표적인 유출 경로 하나가 닫힌다.

\`\`\`bash
# AWS: IMDSv2 강제 (인스턴스 단위)
aws ec2 modify-instance-metadata-options \\
  --instance-id i-0123456789abcdef0 \\
  --http-tokens required --http-endpoint enabled

# 확인
aws ec2 describe-instances --instance-id i-0123456789abcdef0 \\
  --query 'Reservations[].Instances[].MetadataOptions.HttpTokens'
\`\`\`

## 참고

- OWASP Cheat Sheet — Server Side Request Forgery Prevention
- CWE-918 Server-Side Request Forgery
- AWS 인스턴스 메타데이터 서비스 v2 문서`,
    diagram: {
      type: 'flow',
      caption: 'SSRF 가 자격 증명 유출로 이어지는 경로',
      steps: [
        { label: '외부 URL 입력', note: '이미지 주소 등' },
        { label: '서버가 대신 요청', note: '대역 검증 누락', danger: true },
        { label: '메타데이터 응답', note: '169.254.169.254', danger: true },
        { label: '임시 자격 증명 획득', note: '클라우드 권한 탈취' },
      ],
    },
  },
  {
    slug: 'broken-access-control',
    title: '인증과 인가의 차이, 접근 통제 누락 방지',
    body: `로그인은 되는데 남의 데이터가 보인다. 실무에서 가장 흔하게 발견되는 취약점이고, 자동화 도구가 잘 잡지 못하는 종류이기도 하다.

## 접근 통제 누락

주문 번호를 하나 바꿨더니 다른 사람 주문서가 열린다. 인증은 통과했으니 서버는 정상 요청으로 본다. 문제는 **이 사용자가 이 자원의 주인인가** 를 확인하지 않은 것이다.

| 구분 | 질문 | 실패했을 때 |
| --- | --- | --- |
| 인증 | 당신은 누구인가 | 아무나 들어온다 |
| 인가 | 이걸 할 권한이 있는가 | 남의 데이터를 본다 |
| 자원 소유 확인 | 이게 당신 것인가 | 식별자만 바꾸면 열린다 |

## 왜 놓치기 쉬운가

화면에 링크가 없으면 접근할 수 없다고 착각하기 때문이다. 실제로는 요청을 직접 만들면 그만이다. 프론트엔드에서 버튼을 숨기는 건 보안 조치가 아니다.

![인가 검사를 두는 위치](/img/posts/broken-access-control.svg)

## 설계로 해결하기

- 조회 쿼리에 소유자 조건을 항상 포함한다. 조회 후 검사보다 안전하다
- 식별자를 순차 증가값 대신 예측 불가능한 값으로 둔다. 근본 해결은 아니지만 대량 수집을 늦춘다
- 권한 검사를 공통 계층으로 끌어올린다. 각 핸들러에서 반복하면 언젠가 빠뜨린다
- 권한별 접근 목록을 문서로 만들고 테스트 코드로 고정한다

## 점검 방법

권한이 다른 계정 두 개로 같은 요청을 보내보는 테스트를 자동화하면 회귀를 잡을 수 있다. 신규 엔드포인트가 추가될 때마다 이 목록에 넣는 규칙이 필요하다.

## 바로 확인하기

권한이 다른 계정 두 개로 같은 요청을 보내 비교한다. 자동화해두면 회귀를 잡을 수 있다.

\`\`\`bash
# A 계정이 만든 자원을 B 계정 토큰으로 조회
RES=$(curl -s -o /dev/null -w '%{http_code}' \\
  -H "Authorization: Bearer $TOKEN_B" \\
  https://api.example.com/orders/$ORDER_OF_A)

# 403 또는 404 가 아니면 접근 통제 결함이다
[ "$RES" = "403" ] || [ "$RES" = "404" ] || echo "취약: HTTP $RES"
\`\`\`

조회 쿼리에는 소유자 조건을 항상 포함한다. 조회한 뒤에 검사하는 방식보다 빠뜨릴 여지가 적다.

\`\`\`sql
-- 나쁨: 먼저 가져오고 나중에 검사
SELECT * FROM orders WHERE id = ?;

-- 좋음: 소유자 조건을 쿼리에 넣는다
SELECT * FROM orders WHERE id = ? AND user_id = ?;
\`\`\`

## 참고

- OWASP Top 10 — A01 Broken Access Control
- OWASP ASVS 4.0 — V4 접근 통제
- CWE-639 Authorization Bypass Through User-Controlled Key`,
    diagram: {
      type: 'layers',
      caption: '인가 검사는 아래로 갈수록 안전하다',
      layers: [
        { label: '화면에서 버튼 숨김', note: '보안 아님' },
        { label: '핸들러마다 개별 검사', note: '누락 위험' },
        { label: '공통 계층 + 쿼리 소유자 조건', note: '권장' },
      ],
    },
  },
  {
    slug: 'password-storage',
    title: '비밀번호 저장에 쓸 해시 알고리즘 선택',
    body: `비밀번호를 평문으로 저장하는 곳은 이제 드물다. 문제는 해시를 쓰긴 쓰는데 잘못된 알고리즘을 쓰는 경우다. 무엇을 골라야 하는지는 한 문장으로 끝난다. 비밀번호에는 느리게 설계된 해시만 쓰고, 작업 계수는 우리 서버가 감당할 수 있는 최대치에 맞춘다.

## 왜 빠른 해시가 오히려 약점인가?

MD5 나 SHA-256 은 빠르다. 무결성 검증에는 장점이지만 비밀번호 저장에는 치명적이다. 초당 수십억 번 시도할 수 있다는 뜻이기 때문이다.

![해시 알고리즘별 대입 속도](/img/posts/password-storage.svg)

비밀번호 저장에는 **느리도록 설계된** 알고리즘을 써야 한다. 메모리를 많이 쓰도록 설계된 Argon2 계열이 현재 권장된다.

| 알고리즘 | 용도 | 비밀번호 저장 | 비고 |
| --- | --- | --- | --- |
| MD5 | 체크섬 | 부적합 | 충돌 공격 존재 |
| SHA-256 | 무결성 | 부적합 | 너무 빠름 |
| PBKDF2 | 키 유도 | 조건부 | 반복 횟수 충분해야 함 |
| bcrypt | 비밀번호 | 적합 | 입력 길이 제한 주의 |
| scrypt | 비밀번호 | 적합 | 메모리 사용 |
| Argon2id | 비밀번호 | 권장 | 현재 기준 최선 |

## 솔트와 페퍼

솔트는 계정마다 다른 무작위 값이고, 최신 라이브러리는 알아서 붙여준다. 페퍼는 애플리케이션 전체가 공유하는 비밀값으로, 데이터베이스만 유출됐을 때 한 겹을 더한다. 페퍼는 DB 가 아닌 곳에 둬야 의미가 있다.

## 그 외 실무 항목

- 로그인 실패 응답에서 아이디 존재 여부를 흘리지 않는다
- 시도 횟수 제한과 지연을 둔다
- 유출 비밀번호 목록과 대조해 이미 털린 값은 거부한다
- 정기 변경 강제는 권장되지 않는다. 오히려 예측 가능한 패턴을 만든다

## 바로 확인하기

저장된 해시의 접두사만 봐도 어떤 알고리즘을 쓰는지 알 수 있다.

\`\`\`
$2b$12$...    bcrypt (cost 12)
$argon2id$v=19$m=65536,t=3,p=4$...   Argon2id
$pbkdf2-sha256$29000$...             PBKDF2
5f4dcc3b5aa765d61d8327deb882cf99     MD5 — 즉시 교체 대상
\`\`\`

교체는 한 번에 못 한다. 로그인 성공 시점에 새 알고리즘으로 다시 해시해 점진적으로 옮긴다.

\`\`\`ts
const ok = await verifyLegacy(input, user.passwordHash)
if (ok && isLegacyHash(user.passwordHash)) {
  // 평문을 손에 쥔 유일한 순간이다. 이때 다시 해시한다.
  await saveHash(user.id, await argon2.hash(input))
}
\`\`\`

## 참고

- OWASP Cheat Sheet — Password Storage
- NIST SP 800-63B — Memorized Secret Verifiers
- RFC 9106 Argon2`,
    diagram: {
      type: 'bars',
      caption: '초당 대입 시도 가능 횟수 (GPU 기준, 상대값)',
      unit: '만회',
      items: [
        { label: 'MD5', value: 8000, note: '비밀번호 저장에 부적합' },
        { label: 'SHA-256', value: 3000, note: '무결성 용도로만' },
        { label: 'PBKDF2 (10만 회)', value: 30 },
        { label: 'bcrypt (cost 12)', value: 1 },
        { label: 'Argon2id', value: 1, note: '메모리까지 요구해 병렬화가 어렵다' },
      ],
    },
  },
  {
    slug: 'jwt-pitfalls',
    title: 'JWT 를 세션 대신 쓸 때의 트레이드오프',
    body: `상태를 서버에 두지 않아도 된다는 점 때문에 JWT 가 널리 쓰인다. 그런데 그 장점이 그대로 단점이 된다.

## 왜 발급한 토큰을 취소할 수 없는가?

발급한 토큰은 만료 전까지 유효하다. 비밀번호를 바꿔도, 계정을 정지시켜도 이미 나간 토큰은 살아 있다. 결국 블랙리스트를 두게 되는데, 그러면 상태를 서버에 두지 않겠다는 처음 목적이 사라진다.

현실적인 절충은 **액세스 토큰을 짧게** 두고 갱신 토큰으로 재발급하는 구조다. 갱신 토큰은 서버에서 관리하므로 취소가 가능하다.

| 항목 | 서버 세션 | JWT |
| --- | --- | --- |
| 즉시 무효화 | 가능 | 어려움 |
| 수평 확장 | 저장소 공유 필요 | 쉬움 |
| 크기 | 식별자만 | 본문 전체 전송 |
| 권한 변경 반영 | 즉시 | 재발급 전까지 지연 |
| 유출 시 피해 | 세션 삭제로 종료 | 만료까지 유효 |

![액세스 토큰과 갱신 토큰 구조](/img/posts/jwt-pitfalls.svg)

## 알고리즘 혼동

alg 필드를 none 으로 바꾸거나 비대칭 키를 대칭 키로 오인하게 만드는 공격이 알려져 있다. 라이브러리에서 **허용 알고리즘을 명시적으로 지정**해야 한다.

## 저장 위치

로컬 스토리지에 두면 XSS 한 번에 전부 털린다. HttpOnly 쿠키가 안전하지만 CSRF 대비가 필요하다. 무엇을 택하든 트레이드오프를 알고 택해야 한다.

## 담지 말아야 할 것

토큰 본문은 서명만 되어 있을 뿐 암호화되어 있지 않다. 누구나 열어볼 수 있다는 전제로 개인정보를 넣지 않는다.

## 바로 확인하기

허용 알고리즘을 명시했는지부터 본다. 검증 함수에 알고리즘을 넘기지 않으면 토큰 헤더를 믿게 된다.

\`\`\`ts
// 위험: 토큰이 스스로 알고리즘을 고른다
jwt.verify(token, secret)

// 안전: 서버가 알고리즘을 정한다
jwt.verify(token, publicKey, {
  algorithms: ['RS256'],
  issuer: 'https://auth.example.com',
  audience: 'blog-api',
})
\`\`\`

토큰 본문은 서명만 되어 있고 암호화되어 있지 않다. 무엇이 들어 있는지 직접 확인한다.

\`\`\`bash
echo "$JWT" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null | jq
# 이메일, 전화번호, 권한 목록이 보이면 설계를 다시 본다
\`\`\`

## 참고

- RFC 8725 JSON Web Token Best Current Practices
- RFC 7519 JSON Web Token
- OWASP Cheat Sheet — JSON Web Token for Java`,
    diagram: {
      type: 'flow',
      caption: '짧은 액세스 토큰 + 취소 가능한 갱신 토큰',
      steps: [
        { label: '로그인', note: '자격 증명 확인' },
        { label: '액세스 토큰 발급', note: '5~15분' },
        { label: '만료 시 갱신 요청', note: '서버가 상태 확인' },
        { label: '차단 계정이면 거부', note: '여기서 취소가 가능해진다', danger: true },
      ],
    },
  },
  {
    slug: 'oauth-code-flow',
    title: 'OAuth 2.0 인가 코드 흐름과 PKCE 적용',
    body: `소셜 로그인을 붙이는 일은 흔하지만, 문서를 대충 따라가면 위험한 조합이 만들어진다. 지금 기준으로 고를 것은 하나다. 인가 코드 흐름에 PKCE 를 붙이고, state 로 요청을 묶고, 리다이렉트 URI 를 정확히 일치하는 값으로만 등록한다.

## 암묵적 흐름을 왜 쓰지 않는가?

토큰을 URL 프래그먼트로 바로 받는 방식은 브라우저 이력과 리퍼러로 새어 나갈 수 있다. 현재 권장은 **인가 코드 흐름 + PKCE** 다. 공개 클라이언트인 SPA 와 모바일 앱도 예외가 아니다.

![인가 코드 흐름](/img/posts/oauth-code-flow.svg)

| 흐름 | 대상 | 현재 권장 |
| --- | --- | --- |
| 인가 코드 + PKCE | 모든 클라이언트 | 권장 |
| 인가 코드 (PKCE 없음) | 기밀 클라이언트 | 조건부 |
| 암묵적 흐름 | SPA | 사용 금지 |
| 리소스 소유자 비밀번호 | 레거시 | 사용 금지 |
| 클라이언트 자격 증명 | 서버 간 통신 | 용도 한정 |

## state 를 빠뜨리지 않는다

state 는 CSRF 방어 장치다. 요청을 시작할 때 무작위 값을 만들어 저장하고, 콜백에서 반드시 대조해야 한다. 값만 넣고 검증하지 않는 코드가 의외로 많다.

## 리다이렉트 URI 검증

인가 서버에 등록한 URI 와 **정확히 일치**해야 한다. 부분 일치나 와일드카드를 허용하면 토큰 탈취 경로가 열린다.

## 인증과 인가를 혼동하지 않기

OAuth 는 위임된 접근 권한을 다루는 규격이지 신원 확인 규격이 아니다. 로그인이 목적이라면 그 위에 정의된 OIDC 를 써야 한다. 액세스 토큰이 있다는 사실만으로 사용자를 식별하면 토큰 대체 공격에 노출된다.

## 바로 확인하기

인가 요청에 PKCE 와 state 가 모두 들어가는지 확인한다.

\`\`\`
GET /authorize
  ?response_type=code
  &client_id=...
  &redirect_uri=https://blog.example.com/callback
  &scope=openid%20email
  &state={무작위-32바이트}
  &code_challenge={verifier의 SHA-256 을 base64url}
  &code_challenge_method=S256
\`\`\`

state 를 넣기만 하고 콜백에서 대조하지 않는 코드가 흔하다. 검증 지점을 직접 찾아본다.

\`\`\`bash
grep -rn 'state' src/auth/ | grep -iE 'compare|===|equals|verify'
# 결과가 없으면 state 는 장식일 뿐이다
\`\`\`

## 참고

- RFC 9700 OAuth 2.0 Security Best Current Practice
- RFC 7636 Proof Key for Code Exchange
- OpenID Connect Core 1.0`,
    diagram: {
      type: 'steps',
      caption: '인가 코드 + PKCE 순서',
      steps: [
        { label: 'code_verifier 생성', note: '무작위 문자열을 클라이언트에 보관' },
        { label: 'challenge 와 state 를 붙여 인가 요청', note: '해시값만 전달' },
        { label: '사용자 동의 후 코드 수신', note: 'state 를 반드시 대조' },
        { label: 'verifier 와 함께 토큰 교환', note: '가로챈 코드만으로는 교환 불가' },
      ],
    },
  },
]
