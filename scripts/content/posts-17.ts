import type { SeedPost } from './types'

/** 161~170 — 인증과 세션 운영 */
export const posts17: SeedPost[] = [
  {
    slug: 'oauth-scope-design',
    title: 'OAuth 스코프 설계와 동의 화면',
    body: `연동을 붙일 때 스코프를 넓게 잡아 두면, 그 연동이 침해됐을 때 잃는 범위가 그대로 커진다. 반대로 너무 잘게 나누면 동의 화면이 길어져 사용자가 읽지 않고 누른다. 기준은 하나다. 스코프는 사용자가 이해할 수 있는 단위로 나누고, 애플리케이션은 실제로 쓰는 것만 요청한다.

## 왜 스코프가 계속 넓어지는가?

개발 초기에 무엇이 필요할지 몰라 전체 권한을 요청하고, 그 뒤로 아무도 줄이지 않는다. 스코프를 줄이면 재동의가 필요해 사용자 이탈이 생기므로 미룬다. 그 결과 읽기만 하는 연동이 쓰기 권한까지 들고 있게 된다.

![요청한 권한과 실제로 쓰는 권한](/img/posts/oauth-scope-design.svg)

## 나누는 기준

| 축 | 예 |
| --- | --- |
| 동작 | 읽기 · 쓰기 · 삭제 |
| 자원 | 프로필 · 주문 · 결제수단 |
| 민감도 | 일반 · 민감정보 |
| 기간 | 일회성 · 지속 접근 |
| 주체 | 사용자 대신 · 애플리케이션 자신 |

동작과 자원 두 축으로 나누는 것이 가장 이해하기 쉽다. \`orders:read\` 처럼 자원과 동작을 붙여 읽으면 무엇을 허용하는지 바로 보인다.

## 동의 화면은 결정을 돕는 화면이다

항목을 나열하기만 하면 사용자는 전부 허용을 누른다. 무엇을 위해 필요한지 한 줄로 적고, 선택 가능한 항목은 기본 해제로 둔다. 나중에 필요해질 권한을 미리 받아 두는 방식은 신뢰를 깎는다.

![요청 시점을 나누는 방식](/img/posts/oauth-scope-design-2.svg)

## 필요할 때 추가로 요청한다

모든 권한을 첫 로그인에 받지 않고, 그 기능을 처음 쓸 때 추가 동의를 받는 방식이 있다. 사용자는 맥락 안에서 판단하므로 승인률이 오히려 높고, 쓰지 않는 기능의 권한은 발급되지 않는다.

## 발급된 권한을 관리한다

- 사용자가 연결된 애플리케이션 목록과 권한을 볼 수 있게 한다
- 연결 해제 시 발급된 토큰을 즉시 폐기한다
- 오래 쓰이지 않은 연동은 만료시키거나 재동의를 요구한다
- 스코프별 사용 이력을 남겨 실제 사용 범위를 확인한다

## 바로 확인하기

발급된 토큰이 실제로 어떤 스코프를 들고 있는지, 그중 무엇을 쓰는지 대조한다.

\`\`\`bash
# 토큰 검사 엔드포인트로 스코프 확인
curl -s -X POST https://auth.example.com/oauth/introspect \\
  -u "$CLIENT_ID:$CLIENT_SECRET" \\
  -d "token=$ACCESS_TOKEN" | python3 -m json.tool | grep -i scope

# 최근 30일간 이 클라이언트가 실제로 호출한 엔드포인트
grep "client_id=$CLIENT_ID" api.log | awk '{print $7}' | sort | uniq -c | sort -rn | head
\`\`\`

요청과 사용의 차이가 곧 줄일 수 있는 범위다.

\`\`\`
요청한 스코프   profile:read orders:read orders:write payments:read
실제 호출       GET /profile, GET /orders
줄일 대상       orders:write, payments:read
\`\`\`

## 실제로 이렇게 터진다

스코프를 크게 두 개만 만든 사례가 있다. 읽기와 쓰기였고, 모든 연동 앱이 쓰기를 요구했다. 앱 하나가 침해되자 그 앱이 할 수 있는 일이 사용자 계정 전체였다.

반대로 스코프를 너무 잘게 나눠 동의 화면이 스무 줄이 된 경우도 있다. 사용자는 읽지 않고 동의했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 스코프가 많을수록 세밀하다 | 사용자가 판단할 수 없으면 무의미하다 |
| 나중에 나누면 된다 | 기존 앱이 이미 넓게 받았다 |
| 앱이 요구하면 줘야 한다 | 부분 동의를 허용할 수 있다 |
| 동의 화면은 형식이다 | 사용자가 판단하는 유일한 지점이다 |
| 스코프가 곧 인가다 | 서버가 다시 확인해야 한다 |

## 어떻게 나누는가

사용자가 이해할 수 있는 단위로 나눈다. 내부 API 단위가 아니다.

| 나쁜 예 | 나은 예 |
| --- | --- |
| read, write | 프로필 보기, 주문 내역 보기, 주문하기 |
| admin | 팀원 관리, 결제 수단 관리 |
| all | 없음 — 전체 권한 스코프를 만들지 않는다 |

기준은 "동의 화면에 한 줄로 적었을 때 사용자가 무엇에 동의하는지 아는가" 다.

## 동의 화면에 무엇을 보여 주는가

| 항목 | 내용 |
| --- | --- |
| 앱 이름·개발자 | 누구에게 주는지 |
| 권한 목록 | 사용자 언어로 |
| 필수·선택 구분 | 부분 동의 허용 |
| 유효 기간 | 언제까지 |
| 철회 방법 | 어디서 취소하는지 |

부분 동의를 허용하면 앱이 최소 권한만 요구하게 되는 유인이 생긴다.

## 발급 후 관리

1. 사용자가 연동 앱 목록을 보고 개별 철회할 수 있게 한다
2. 오래 쓰지 않은 연동은 만료시킨다
3. 앱별 사용 스코프 통계를 본다 — 요구했지만 안 쓰는 것
4. 안 쓰는 스코프는 앱에 축소를 요청한다
5. 스코프 추가 요청 시 재동의를 받는다

\`\`\`sql
-- 요구했지만 실제로 쓰지 않는 스코프 — 축소 요청 근거
SELECT g.client_id, g.scope,
       count(u.id) AS used
FROM granted_scopes g
LEFT JOIN api_usage u ON u.client_id = g.client_id AND u.scope = g.scope
                     AND u.at > now() - interval '90 days'
GROUP BY 1, 2 HAVING count(u.id) = 0
ORDER BY 1;
\`\`\`

## 참고

- RFC 6749 — The OAuth 2.0 Authorization Framework
- OAuth 2.0 Security Best Current Practice
- RFC 7662 — OAuth 2.0 Token Introspection`,
    diagram: {
      type: 'bars',
      caption: '요청한 권한과 실제 사용',
      unit: '개',
      items: [
        { label: '요청한 스코프', value: 12 },
        { label: '한 번이라도 사용', value: 5 },
        { label: '30일 내 사용', value: 3, note: '나머지는 회수 대상' },
      ],
    },
    diagram2: {
      type: 'flow',
      caption: '필요할 때 추가로 요청하기',
      steps: [
        { label: '로그인', note: '신원 확인 범위만' },
        { label: '기능 첫 사용', note: '맥락 안에서 요청' },
        { label: '추가 동의', note: '무엇에 쓰는지 설명' },
        { label: '사용 이력 기록', note: '회수 판단 근거' },
      ],
    },
  },
  {
    slug: 'saml-security',
    title: 'SAML 응답 검증에서 빠지는 항목',
    body: `통합 인증을 SAML 로 붙일 때 검증이 한두 항목만 빠져도 누구나 관리자로 로그인할 수 있게 된다. 서명을 확인했다는 것과 "우리가 신뢰하는 발급자가 이 사용자에 대해 방금 발급한 응답"임을 확인했다는 것은 다르다. 라이브러리에 맡기더라도 어떤 검증이 켜져 있는지는 직접 확인해야 한다.

## 무엇을 확인해야 하는가?

| 항목 | 확인 내용 |
| --- | --- |
| 서명 | 신뢰하는 인증서로 검증되는가 |
| 서명 범위 | 응답 전체인가, 단언부인가 |
| 발급자 | 등록된 발급자와 일치하는가 |
| 대상 | 우리 서비스를 대상으로 발급됐는가 |
| 유효 기간 | 시작·만료 시각 안인가 |
| 재사용 | 같은 응답이 두 번 쓰이지 않았는가 |
| 요청 대응 | 우리가 보낸 요청에 대한 응답인가 |

![응답이 신뢰되기까지 통과할 검증](/img/posts/saml-security.svg)

## 서명 범위가 특히 자주 뚫린다

응답 안에는 서명된 부분과 서명되지 않은 부분이 함께 있을 수 있다. 파서가 읽는 위치와 서명이 덮는 위치가 다르면, 서명은 유효한데 내용은 바뀐 상태가 된다. 사용자 식별자만 바꿔 넣으면 다른 사람으로 로그인된다.

## 라이브러리 설정을 직접 본다

기본값이 안전하지 않은 구현이 있다. 서명 검증을 켜는 옵션, 미서명 단언을 거부하는 옵션, 시각 오차 허용 범위, 재사용 방지 저장소가 실제로 설정돼 있는지 확인한다.

![검증이 빠졌을 때의 결과](/img/posts/saml-security-2.svg)

## 시각과 재사용

응답에는 유효 시각이 들어 있다. 서버 시각이 어긋나면 정상 로그인이 거부되거나 만료된 응답이 통과한다. 시간 동기화는 인증의 전제 조건이다. 재사용 방지는 응답 식별자를 유효 기간 동안 저장해 두 번째 사용을 거부하는 방식으로 만든다.

## 계정 연결 기준을 정한다

응답에 담긴 어떤 값으로 우리 계정과 연결할지 정해야 한다. 메일 주소로 연결하면 발급자 쪽에서 메일을 바꿀 수 있는 경우 계정이 넘어간다. 변하지 않는 식별자를 쓰고, 메일은 표시용으로만 다룬다.

## 바로 확인하기

설정을 코드에서 확인하는 것이 가장 빠르다.

\`\`\`bash
# 검증 옵션이 꺼져 있는 자리
grep -rnE 'wantAssertionsSigned|validateSignature|acceptUnsigned|allowUnencrypted' \\
  --include='*.ts' --include='*.js' --include='*.yml' . | grep -v node_modules
\`\`\`

받은 응답을 직접 뜯어 서명 범위를 확인한다.

\`\`\`bash
# base64 로 온 응답을 열어 서명 위치를 본다
printf '%s' "$SAML_RESPONSE" | base64 -d > resp.xml
grep -c '<ds:Signature' resp.xml          # 서명 개수
grep -oE 'Reference URI="[^"]*"' resp.xml # 서명이 덮는 대상
grep -oE '<saml:Issuer>[^<]*' resp.xml    # 발급자
grep -oE 'NotOnOrAfter="[^"]*"' resp.xml  # 만료 시각
\`\`\`

## 실제로 이렇게 터진다

서명은 검증했는데 무엇에 대한 서명인지 확인하지 않은 사례가 있다. 응답 전체가 아니라 일부만 서명돼 있었고, 서명되지 않은 부분에 사용자 식별자가 있었다. 그 값을 바꾸면 다른 사람으로 로그인됐다.

수신자와 대상 확인을 빠뜨린 경우도 있다. 다른 서비스용으로 발급된 응답을 우리 서비스에 제출해도 통과했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 서명이 유효하면 안전하다 | 무엇이 서명됐는지 봐야 한다 |
| 라이브러리가 다 검증한다 | 기본 설정이 느슨한 경우가 있다 |
| 인증서만 맞으면 된다 | 대상·수신자·시간이 남는다 |
| 재사용은 못 한다 | 식별자 추적이 없으면 가능하다 |
| XML 이라 안전하다 | 외부 엔티티 문제가 있다 |

## 검증 항목

| 항목 | 확인 |
| --- | --- |
| 서명 대상 | 응답 전체 또는 어설션 전체 |
| 서명 알고리즘 | 약한 알고리즘 거부 |
| 인증서 | 등록된 발급자 인증서와 일치 |
| 발급자 | 기대한 신원 제공자 |
| 대상 | 우리 서비스 식별자 |
| 수신자 | 우리 콜백 주소 |
| 시간 | 유효 구간 내 |
| 응답 식별자 | 재사용 여부 추적 |
| 요청 대응 | 우리가 보낸 요청에 대한 응답인지 |

서명 대상 확인이 가장 자주 빠진다. 서명된 부분과 우리가 읽는 부분이 같아야 한다.

## 구현 시 주의

1. XML 파서에서 외부 엔티티를 끈다
2. 서명 검증 후에 값을 읽는다 — 순서가 중요하다
3. 서명된 노드에서만 값을 읽는다
4. 응답 식별자를 저장해 재사용을 막는다
5. 시계 오차 허용 범위를 좁게 둔다

\`\`\`bash
# 응답에서 서명 대상이 무엇인지 확인한다
python3 - <<'PY'
import base64, sys, re
xml = base64.b64decode(sys.stdin.read()).decode()
for m in re.finditer(r'<(?:ds:)?Reference[^>]*URI="([^"]*)"', xml):
    print('서명 대상:', m.group(1) or '(문서 전체)')
print('어설션 ID:', re.findall(r'<(?:saml2?:)?Assertion[^>]*ID="([^"]+)"', xml))
PY
# 서명 대상과 어설션 ID 가 일치하지 않으면 검토가 필요하다
\`\`\`

## 참고

- OASIS SAML 2.0 Core 및 Profiles 규격
- OWASP Cheat Sheet — SAML Security
- 각 SAML 라이브러리의 검증 옵션 문서`,
    diagram: {
      type: 'steps',
      caption: 'SAML 응답 검증 순서',
      steps: [
        { label: '서명 검증', note: '신뢰 인증서로' },
        { label: '서명 범위 확인', note: '읽는 부분이 덮이는가' },
        { label: '발급자·대상 확인', note: '우리 서비스용인가' },
        { label: '시각·재사용 확인', note: '만료와 중복 거부' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '검증 항목과 결과',
      x: ['서명 범위 확인', '서명만 확인'],
      y: ['재사용 방지', '방지 없음'],
      cells: ['안전', '내용 교체 가능', '응답 재사용 가능', '임의 계정 로그인'],
    },
  },
  {
    slug: 'api-key-design',
    title: 'API 키 발급과 회수 설계 기준',
    body: `API 키는 한 번 만들어 주면 그다음부터 관리 대상이 된다. 누가 만들었는지, 무엇을 할 수 있는지, 언제까지 유효한지가 발급 시점에 정해져 있지 않으면 회수도 조사도 불가능해진다. 설계에서 정할 것은 네 가지다. 소유자, 범위, 수명, 그리고 유출됐을 때 알아채는 방법이다.

## 발급할 때 무엇을 정해야 하는가?

| 항목 | 이유 |
| --- | --- |
| 소유자 | 개인이 아니라 팀 — 퇴사에 흔들리지 않게 |
| 범위 | 호출 가능한 엔드포인트와 동작 |
| 수명 | 만료일 없는 키를 만들지 않는다 |
| 출처 제한 | 허용 IP 또는 서비스 |
| 이름 규칙 | 용도가 드러나게 |
| 마지막 사용 | 회수 판단의 근거 |

![키가 만들어지고 회수되기까지](/img/posts/api-key-design.svg)

## 저장은 해시로

키를 그대로 저장하면 데이터베이스가 유출될 때 전부 그대로 쓰인다. 비밀번호처럼 해시로 저장하고, 원문은 발급 순간에만 보여준다. 대신 조회를 위해 앞부분 몇 글자를 별도 컬럼에 남겨 "어떤 키인지" 화면에 표시한다.

\`\`\`
저장    prefix(8자) + 해시
표시    sk_live_a1b2…  (앞부분만)
검증    받은 키를 해시해 비교
분실    재발급만 가능 — 원문은 복구되지 않는다
\`\`\`

## 유출을 알아채는 장치

키에 고정된 접두어를 붙이면 저장소 검사 도구와 공개 저장소 감시가 그 형태를 찾아낸다. 접두어가 없으면 임의 문자열과 구분되지 않아 탐지에 걸리지 않는다.

![회전을 무중단으로 만드는 구조](/img/posts/api-key-design-2.svg)

## 회전을 전제로 만든다

키가 하나면 회전할 때 반드시 끊긴다. 계정당 활성 키를 둘 이상 둘 수 있게 하고, 새 키를 배포한 뒤 옛 키를 폐기하는 순서를 만든다. 이 구조가 없으면 회전 주기는 문서에만 남는다.

## 사람 계정과 섞지 않는다

사람의 자격 증명으로 만든 키는 그 사람이 떠나면 함께 무효가 되거나, 반대로 계정을 지우지 못하는 이유가 된다. 서비스용 키는 서비스 주체로 발급하고 소유 팀을 기록한다.

## 바로 확인하기

오래되고 쓰이지 않는 키가 회수 1순위다.

\`\`\`sql
SELECT id, name, owner_team, left(prefix, 12) AS prefix,
       created_at::date, last_used_at::date,
       (now() - coalesce(last_used_at, created_at))::int / 86400 AS idle_days
  FROM api_keys
 WHERE revoked_at IS NULL
 ORDER BY idle_days DESC
 LIMIT 20;
\`\`\`

만료일이 없는 키가 남아 있는지도 본다.

\`\`\`sql
SELECT count(*) FILTER (WHERE expires_at IS NULL) AS 만료없음,
       count(*) FILTER (WHERE expires_at < now()) AS 이미만료,
       count(*) AS 전체
  FROM api_keys WHERE revoked_at IS NULL;
\`\`\`

## 실제로 이렇게 터진다

API 키에 만료가 없고 권한 구분도 없던 사례가 있다. 발급받은 키 하나로 모든 엔드포인트를 호출할 수 있었고, 5년 전 발급된 키가 그대로 살아 있었다. 누구에게 발급했는지 기록도 없었다.

키를 데이터베이스에 평문으로 저장한 경우도 있다. 유출 시 전 고객의 키가 함께 나간다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 키는 길면 안전하다 | 수명과 범위가 더 중요하다 |
| 평문 저장이 편하다 | 유출 시 전량 노출이다 |
| 만료를 두면 불편하다 | 회전 경로가 있으면 괜찮다 |
| 키 하나면 충분하다 | 용도별로 나눠야 회수가 쉽다 |
| 유출은 고객 책임이다 | 탐지와 회수는 우리 몫이다 |

## 어떻게 설계하는가

| 항목 | 권장 |
| --- | --- |
| 형식 | 접두사 + 무작위 — 어떤 키인지 식별 가능하게 |
| 저장 | 해시만 저장, 원문은 발급 시 한 번만 표시 |
| 범위 | 스코프·엔드포인트·출발지 제한 |
| 만료 | 기본 만료 있음, 갱신 가능 |
| 개수 | 여러 개 발급 가능 — 무중단 회전 |
| 기록 | 발급자·용도·마지막 사용 |

접두사를 붙이면 유출 탐지가 쉬워진다. 공개 저장소 검사 도구가 우리 키 형식을 인식할 수 있다.

\`\`\`ts
// 발급 — 원문은 이때만 보여 주고 저장하지 않는다
const raw = 'sk_live_' + crypto.randomBytes(24).toString('base64url')
await db.apiKey.create({
  data: {
    hash: sha256(raw),               // 해시만 저장
    prefix: raw.slice(0, 12),        // 목록 표시용
    ownerId, scopes, expiresAt,
  },
})
return { key: raw }                  // 다시 볼 수 없다고 안내
\`\`\`

## 회수를 쉽게 만든다

1. 여러 키를 동시에 유효하게 한다 — 무중단 교체
2. 마지막 사용 시각을 기록한다 — 안 쓰는 키를 찾는다
3. 키별 사용 통계를 고객에게 보여 준다
4. 유출 의심 시 즉시 폐기 버튼을 제공한다
5. 공개 저장소에서 발견되면 자동 폐기하고 알린다

\`\`\`sql
-- 오래 쓰지 않았거나 만료가 지난 키
SELECT prefix, owner_id, created_at::date, last_used_at::date, expires_at::date
FROM api_keys
WHERE revoked_at IS NULL
  AND (last_used_at < now() - interval '90 days' OR expires_at < now())
ORDER BY last_used_at NULLS FIRST;
\`\`\`

## 참고

- OWASP Cheat Sheet — Secrets Management
- NIST SP 800-63B, 인증자 수명 관리
- CWE-798: Use of Hard-coded Credentials`,
    diagram: {
      type: 'flow',
      caption: 'API 키의 수명 주기',
      steps: [
        { label: '발급', note: '소유팀·범위·만료 기록' },
        { label: '사용', note: '마지막 사용 시각 갱신' },
        { label: '회전', note: '두 키 동시 유효' },
        { label: '폐기', note: '유휴·만료 자동 회수' },
      ],
    },
    diagram2: {
      type: 'steps',
      caption: '무중단 회전',
      steps: [
        { label: '새 키 발급', note: '옛 키 유지' },
        { label: '새 키 배포', note: '설정 갱신' },
        { label: '사용 확인', note: '옛 키 호출 0 확인' },
        { label: '옛 키 폐기', note: '되돌릴 수 있게 기록' },
      ],
    },
  },
  {
    slug: 'machine-to-machine',
    title: '서버 간 인증 방식 선택 기준',
    body: `사람이 없는 호출에는 사람용 인증을 쓸 수 없다. 그래서 서버 간 통신은 별도 방식을 골라야 하는데, 선택지가 여럿이고 각각 전제가 다르다. 판단 기준은 저장할 비밀값이 있는가, 신원을 누가 보증하는가, 회전을 어떻게 할 것인가 세 가지다. 가장 좋은 비밀값은 저장할 필요가 없는 비밀값이다.

## 어떤 방식을 고를 것인가?

| 방식 | 저장할 비밀값 | 회전 | 적합한 곳 |
| --- | --- | --- | --- |
| 정적 API 키 | 있음 | 수동 | 외부 연동 초기 |
| 클라이언트 자격 증명 | 있음 | 주기적 | 조직 간 연동 |
| 상호 TLS | 인증서 | 인증서 갱신 | 내부 서비스 간 |
| 워크로드 아이덴티티 | 없음 | 불필요 | 클라우드·컨테이너 |
| 서명된 요청 | 키 | 주기적 | 웹훅·콜백 |

![저장할 비밀값이 있는 방식과 없는 방식](/img/posts/machine-to-machine.svg)

## 저장할 값이 없는 쪽을 먼저 검토한다

클라우드와 컨테이너 환경에서는 실행 주체 자체를 신원으로 쓸 수 있다. 플랫폼이 발급한 짧은 수명의 토큰으로 인증하면 우리가 보관할 비밀값이 사라지고, 유출과 회전 문제가 함께 없어진다. 이것이 가능한 구간에서는 다른 방식을 고를 이유가 거의 없다.

## 내부 구간은 상호 TLS 가 잘 맞는다

서비스가 많아지면 서비스마다 키를 만들고 나눠 주는 일이 감당되지 않는다. 인증서를 자동 발급·갱신하는 체계를 두면 신원 확인과 전송 암호화가 한 번에 해결된다. 수명을 짧게 하면 폐기 목록 관리 부담도 줄어든다.

![내부와 외부 구간의 선택](/img/posts/machine-to-machine-2.svg)

## 신원과 권한을 나눠 생각한다

인증은 "누구인가"이고 인가는 "무엇을 해도 되는가"다. 상호 TLS 로 신원이 확인돼도 그 서비스가 모든 엔드포인트를 호출해도 되는 것은 아니다. 호출자 신원을 받아 엔드포인트별 권한을 따로 검사해야 한다.

## 호출 이력을 남긴다

서버 간 호출은 사람 눈에 띄지 않아 이상이 있어도 늦게 발견된다. 호출자, 대상, 시각, 결과를 남기고 평소와 다른 호출량과 새로운 호출자를 경보로 만든다.

## 바로 확인하기

지금 어떤 방식이 쓰이고 있는지, 정적 키가 어디에 남아 있는지 본다.

\`\`\`bash
# 설정과 환경 변수에 남은 정적 키
grep -rnE '(API_KEY|SECRET|TOKEN)=' --include='*.env*' --include='*.yaml' --include='*.yml' . \\
  | grep -v node_modules | head -20

# 클라우드 환경이라면 워크로드 아이덴티티로 바꿀 수 있는지 확인
aws sts get-caller-identity
\`\`\`

내부 구간의 인증서 수명을 확인한다.

\`\`\`bash
for svc in orders payments search; do
  printf '%-10s ' "$svc"
  echo | openssl s_client -connect "$svc.internal:443" 2>/dev/null \\
    | openssl x509 -noout -subject -enddate | tr '\\n' ' '
  echo
done
\`\`\`

## 실제로 이렇게 터진다

서버 간 통신에 공유 비밀값을 쓴 사례가 있다. 열 개 서비스가 같은 값을 썼고, 하나가 유출되자 전부 교체해야 했다. 교체 중에 몇 개 서비스가 멈췄다.

인증만 하고 인가를 안 한 경우도 있다. 내부 서비스면 무엇이든 호출할 수 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 내부 통신이라 간단해도 된다 | 침해 시 확산 경로다 |
| 공유 비밀값이 편하다 | 회수와 회전이 불가능해진다 |
| 인증하면 인가된 것이다 | 무엇을 할 수 있는지는 별개다 |
| 네트워크로 막으면 된다 | 같은 망 안이면 무력하다 |
| 상호 TLS 는 과하다 | 관리형 도구가 많아졌다 |

## 방식 선택

| 방식 | 적합 | 주의 |
| --- | --- | --- |
| 공유 비밀값 | 임시·소규모 | 회전이 어렵다 |
| 서명된 요청 | 외부 연동 | 시각·논스 필요 |
| 클라이언트 자격 증명 흐름 | 서비스 간 표준 | 토큰 수명 관리 |
| 상호 TLS | 내부망 | 인증서 수명 관리 |
| 워크로드 신원 | 클라우드·쿠버네티스 | 저장할 비밀이 없다 |

아래로 갈수록 관리할 비밀값이 줄어든다. 가능하면 마지막 행으로 간다.

## 인가를 어떻게 두는가

서비스 신원만으로는 부족하다. 무엇을 할 수 있는지를 따로 정한다.

| 계층 | 판정 |
| --- | --- |
| 전송 | 이 서비스가 맞는가 (상호 TLS) |
| 토큰 | 어떤 범위를 가졌는가 (스코프) |
| 애플리케이션 | 이 자원에 대해 그 동작이 허용되는가 |

\`\`\`ts
// 서비스 신원 + 스코프 + 자원 인가를 각각 확인한다
const peer = req.socket.getPeerCertificate()
if (!ALLOWED_SERVICES.has(peer.subject?.CN)) return res.status(401).end()

const claims = await verifyToken(bearer(req), { audience: 'billing-service' })
if (!claims.scope?.includes('orders:read')) return res.status(403).end()

const order = await db.order.findFirst({ where: { id, tenantId: claims.tenant } })
if (!order) return res.status(404).end()
\`\`\`

\`\`\`bash
# 공유 비밀값을 쓰는 서비스가 몇 개인지 — 회전 부담의 척도
grep -rl 'SHARED_SERVICE_SECRET' --include='*.yaml' --include='*.env' deploy/ | wc -l
\`\`\`

## 참고

- RFC 6749 — Client Credentials Grant
- RFC 8705 — OAuth 2.0 Mutual-TLS
- 클라우드 공급자별 워크로드 아이덴티티 문서`,
    diagram: {
      type: 'matrix',
      caption: '저장할 비밀값과 회전 부담',
      x: ['비밀값 없음', '비밀값 있음'],
      y: ['자동 회전', '수동 회전'],
      cells: ['가장 좋은 형태', '운영 가능', '해당 없음', '방치되기 쉬움'],
    },
    diagram2: {
      type: 'layers',
      caption: '구간별 인증 선택',
      layers: [
        { label: '클라우드 내부', note: '워크로드 아이덴티티' },
        { label: '서비스 간', note: '상호 TLS' },
        { label: '조직 간', note: '클라이언트 자격 증명' },
        { label: '웹훅 수신', note: '서명 검증' },
      ],
    },
  },
  {
    slug: 'step-up-auth',
    title: '위험 기반 추가 인증 설계와 적용 지점',
    body: `모든 요청에 다단계 인증을 요구하면 사용자가 떠나고, 아무 데도 요구하지 않으면 계정 탈취가 곧바로 피해로 이어진다. 해법은 평소에는 가볍게 두고 위험이 올라간 순간에만 한 단계 더 요구하는 것이다. 무엇을 위험으로 볼지, 어떤 동작에 요구할지 두 가지만 정하면 나머지는 조합이다.

## 언제 한 단계 더 요구하는가?

| 신호 | 예 |
| --- | --- |
| 동작의 무게 | 출금, 비밀번호·메일 변경, 권한 부여 |
| 새로운 맥락 | 처음 보는 기기·지역·아이피 |
| 시간 경과 | 마지막 인증 후 오래됨 |
| 이상 패턴 | 짧은 시간에 여러 실패 |
| 값의 크기 | 평소보다 큰 금액 |

동작의 무게와 시간 경과 두 가지만으로도 대부분의 피해를 막는다.

![평상시 흐름과 추가 인증 분기](/img/posts/step-up-auth.svg)

## 두 번째 단계로 무엇을 요구할 것인가?

추가 인증은 처음 로그인에 쓴 것보다 강해야 의미가 있다. 다단계 인증 수단을 이미 등록한 사용자라면 그 수단을 두 번째 단계로 쓴다. 비밀번호로 로그인한 사용자에게 다시 비밀번호를 묻는 것은 화면만 하나 늘리는 셈이다. 피싱에 저항하는 수단을 두 번째 단계로 둔다.

\`\`\`
1단계  비밀번호 또는 기존 세션
2단계  패스키·하드웨어 키 (피싱 저항)
대체   앱 일회용 번호 (차선)
피할 것 문자 메시지 — 가장 약한 고리가 된다
\`\`\`

## 유효 시간을 정한다

추가 인증을 한 번 하면 얼마 동안 유효한지 정해야 한다. 너무 짧으면 작업 도중에 계속 끊기고, 너무 길면 의미가 없다. 동작 단위로 유효 시간을 다르게 두는 방식이 실무에서 잘 맞는다.

![동작별 재인증 유효 시간](/img/posts/step-up-auth-2.svg)

## 우회 경로를 함께 막는다

화면에서 추가 인증을 요구해도 API 를 직접 호출하면 통과되는 경우가 많다. 판정은 화면이 아니라 서버의 미들웨어에서 하고, 민감한 엔드포인트 목록을 코드로 관리한다.

## 실패했을 때의 처리

추가 인증에 반복 실패하는 것은 그 자체로 신호다. 실패 횟수를 세고 임계치를 넘으면 세션을 끊고 사용자에게 알린다. 알림은 공격을 사용자가 인지하는 유일한 통로일 때가 많다.

## 바로 확인하기

민감한 엔드포인트가 실제로 보호되는지 직접 호출해 본다.

\`\`\`bash
# 오래된 세션으로 민감 동작 호출 — 401 과 재인증 요구가 나와야 한다
for p in /me/email /me/password /withdrawals /api-keys; do
  printf '%-16s ' "$p"
  curl -s -o /dev/null -w '%{http_code}\\n' -X POST "https://app.example.com$p" \\
    -H "Authorization: Bearer $OLD_SESSION" -H 'Content-Type: application/json' -d '{}'
done
\`\`\`

서버 쪽 판정은 한 곳에 모은다.

\`\`\`ts
const NEEDS_RECENT_AUTH: Record<string, number> = {
  '/me/email': 5 * 60_000,
  '/me/password': 5 * 60_000,
  '/withdrawals': 2 * 60_000,
  '/api-keys': 10 * 60_000,
}

app.use((req, res, next) => {
  const window = Object.entries(NEEDS_RECENT_AUTH).find(([p]) => req.path.startsWith(p))?.[1]
  if (!window) return next()
  if (Date.now() - req.session.strongAuthAt > window)
    return res.status(401).json({ error: 'step_up_required' })
  next()
})
\`\`\`

## 실제로 이렇게 터진다

로그인만 하면 모든 것을 할 수 있던 서비스에서, 세션 탈취 한 번으로 출금까지 이어진 사례가 있다. 로그인은 다단계였지만 그 이후에는 아무 확인이 없었다.

반대로 모든 동작에 재인증을 요구해 사용자가 이탈한 경우도 있다. 조회할 때마다 인증번호를 요구했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 로그인 시 강하게 하면 된다 | 세션은 오래 유지된다 |
| 재인증은 불편하다 | 위험한 동작에만 걸면 괜찮다 |
| 다단계가 있으면 충분하다 | 그 세션이 탈취되면 무관하다 |
| 위험 판단은 어렵다 | 몇 가지 신호로 충분하다 |
| 매번 같은 수단이어야 한다 | 위험에 따라 다르게 |

## 언제 추가 인증을 요구하는가

| 상황 | 요구 |
| --- | --- |
| 결제 수단 변경 | 항상 |
| 출금·송금 | 항상 |
| 비밀번호·연락처 변경 | 항상 |
| 권한 부여 | 항상 |
| 새 기기 로그인 | 조건부 |
| 평소와 다른 위치 | 조건부 |
| 오래된 세션 | 조건부 |
| 대량 조회·내보내기 | 조건부 |

## 위험 신호

| 신호 | 판단 |
| --- | --- |
| 새 기기 | 위험 상승 |
| 새 위치·국가 | 위험 상승 |
| 세션 나이 | 오래될수록 상승 |
| 최근 비밀번호 변경 | 상승 |
| 짧은 시간 내 여러 실패 | 상승 |
| 기억된 기기 | 하락 |

점수를 합산해 임계값을 넘으면 추가 인증을 요구한다. 이분법보다 이탈이 적다.

\`\`\`ts
function riskScore(ctx: Ctx): number {
  let s = 0
  if (!ctx.knownDevice) s += 30
  if (ctx.countryChanged) s += 25
  if (ctx.sessionAgeHours > 12) s += 15
  if (ctx.recentFailures > 3) s += 20
  if (ctx.rememberedDevice) s -= 20
  return s
}

// 동작별 임계값 — 위험한 동작일수록 낮게
const THRESHOLD = { view: 80, changeEmail: 30, withdraw: 0 }
if (riskScore(ctx) >= THRESHOLD[action]) return requireStepUp()
\`\`\`

출금은 임계값이 0이므로 언제나 추가 인증을 요구한다.

## 참고

- NIST SP 800-63B, 인증 보증 등급과 재인증
- OWASP Cheat Sheet — Authentication
- FIDO Alliance 배포 지침`,
    diagram: {
      type: 'flow',
      caption: '위험 신호에 따른 분기',
      steps: [
        { label: '요청 수신', note: '세션 확인' },
        { label: '위험 평가', note: '동작·맥락·경과 시간' },
        { label: '추가 인증', note: '피싱 저항 수단' },
        { label: '처리와 기록', note: '실패는 경보로' },
      ],
    },
    diagram2: {
      type: 'bars',
      caption: '동작별 재인증 유효 시간',
      unit: '분',
      items: [
        { label: '출금', value: 2 },
        { label: '비밀번호 변경', value: 5 },
        { label: '메일 변경', value: 5 },
        { label: 'API 키 발급', value: 10 },
      ],
    },
  },
  {
    slug: 'impersonation',
    title: '관리자 대리 로그인 통제 항목',
    body: `고객 문의를 처리하려면 그 사용자가 보는 화면을 봐야 할 때가 있다. 그래서 대리 로그인 기능을 만드는데, 이 기능은 설계상 인가를 우회하는 장치라서 통제가 없으면 가장 위험한 기능이 된다. 필요한 것은 세 가지다. 누가 언제 누구로 들어갔는지 남기고, 할 수 있는 일을 좁히고, 대상에게 알리는 것이다.

## 무엇이 문제가 되는가?

- 누가 언제 누구 계정에 들어갔는지 기록이 없다
- 대리 상태에서 한 행동이 원래 사용자가 한 것으로 남는다
- 대리 중에도 결제·탈퇴 같은 되돌릴 수 없는 동작이 가능하다
- 대리 세션이 만료되지 않는다
- 승인 없이 아무 상담원이나 들어갈 수 있다

![대리 로그인 세션의 두 신원](/img/posts/impersonation.svg)

## 통제 항목

| 항목 | 기준 |
| --- | --- |
| 사유 입력 | 문의 번호 등 근거를 남긴다 |
| 승인 | 민감 계정은 2인 승인 |
| 범위 | 읽기 전용을 기본으로 |
| 금지 동작 | 결제·탈퇴·비밀번호 변경 |
| 세션 수명 | 수십 분, 자동 종료 |
| 기록 | 대리자·대상·시각·행동 |
| 통지 | 대상 사용자에게 알림 |

## 두 신원을 함께 들고 다닌다

대리 세션에는 "실제 조작자"와 "대상 사용자" 두 신원이 있어야 한다. 권한 판정은 대상 기준으로 하되, 감사 로그에는 조작자를 남긴다. 이것이 없으면 사고 조사에서 누가 한 일인지 영원히 알 수 없다.

\`\`\`
세션 = { actorId: 상담원, subjectId: 고객, reason: 'TICKET-1234', expiresAt }
권한 판정   subjectId 기준
감사 로그   actorId 와 subjectId 를 모두 기록
화면 표시   대리 중임을 항상 노출
\`\`\`

![기록에 남는 정보의 차이](/img/posts/impersonation-2.svg)

## 화면에 계속 표시한다

대리 중이라는 사실이 화면에 계속 보여야 조작자가 실수로 위험한 동작을 하지 않는다. 배너를 상단에 고정하고, 종료 버튼을 함께 둔다.

## 읽기 전용을 기본값으로

대부분의 문의는 화면을 보는 것으로 해결된다. 쓰기가 필요한 경우를 예외로 두고 별도 승인을 요구하면, 사고 가능성이 크게 줄어든다.

## 바로 확인하기

대리 세션에서 금지 동작이 실제로 막히는지 확인한다.

\`\`\`bash
# 대리 세션 발급
IMP=$(curl -s -X POST https://app.example.com/admin/impersonate \\
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \\
  -d '{"userId":"u-123","reason":"TICKET-1234"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# 금지 동작 — 403 이어야 한다
for p in /me/password /withdrawals /me/delete; do
  printf '%-16s ' "$p"
  curl -s -o /dev/null -w '%{http_code}\\n' -X POST "https://app.example.com$p" \\
    -H "Authorization: Bearer $IMP" -H 'Content-Type: application/json' -d '{}'
done
\`\`\`

기록이 두 신원을 모두 담는지 본다.

\`\`\`sql
SELECT at, action, actor_id, subject_id, reason
  FROM audit
 WHERE subject_id IS NOT NULL
 ORDER BY at DESC LIMIT 20;
-- actor_id 가 비어 있으면 조사에서 누가 했는지 알 수 없다
\`\`\`

## 실제로 이렇게 터진다

고객 지원을 위한 대리 로그인이 기록 없이 쓰인 사례가 있다. 상담원이 고객 계정으로 들어가 문제를 확인했는데, 그 계정의 활동 로그에는 고객 본인이 한 것으로 남았다. 나중에 분쟁이 생겼을 때 누가 한 일인지 구분할 수 없었다.

대리 상태에서 결제까지 가능했던 경우도 있다. 제한이 없었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 지원 목적이라 문제없다 | 권한 남용 경로다 |
| 기록은 남는다 | 대리 여부가 구분되지 않는 경우가 많다 |
| 상담원은 신뢰할 수 있다 | 계정 탈취와 실수가 있다 |
| 고객에게 알릴 필요 없다 | 알리는 것만으로 남용이 준다 |
| 전 기능을 써야 지원이 된다 | 대부분은 조회로 충분하다 |

## 무엇을 제한하는가

| 항목 | 기준 |
| --- | --- |
| 사유 입력 | 필수, 티켓 번호 연결 |
| 시간 제한 | 30분 등 짧게 |
| 기능 제한 | 결제·출금·권한 변경 금지 |
| 대상자 통지 | 시작 시 또는 종료 후 |
| 기록 | 대리 여부를 별도 필드로 |
| 승인 | 민감 계정은 관리자 승인 |

기록에서 대리 여부를 구분하는 것이 핵심이다. 나중에 그 계정의 행위가 본인 것인지 상담원 것인지 답할 수 있어야 한다.

\`\`\`ts
// 세션에 대리 정보를 함께 담고, 모든 기록에 남긴다
type Actor = { userId: string; impersonatedBy?: string; reason?: string; ticket?: string }

await audit.log(action, {
  userId: actor.userId,
  actualActor: actor.impersonatedBy ?? actor.userId,   // 실제 수행자
  impersonation: !!actor.impersonatedBy,
  reason: actor.reason,
  ticket: actor.ticket,
})

// 위험한 동작은 대리 상태에서 막는다
const BLOCKED_WHEN_IMPERSONATING = new Set(['payment.create', 'withdraw', 'role.grant', 'password.change'])
if (actor.impersonatedBy && BLOCKED_WHEN_IMPERSONATING.has(action)) {
  throw new Forbidden('대리 로그인 상태에서는 할 수 없는 동작입니다')
}
\`\`\`

## 점검 항목

\`\`\`sql
-- 사유 없이 시작된 대리 세션, 오래 유지된 세션
SELECT staff_id, target_user_id, started_at, ended_at, reason, ticket
FROM impersonation_sessions
WHERE reason IS NULL
   OR ticket IS NULL
   OR coalesce(ended_at, now()) - started_at > interval '1 hour'
ORDER BY started_at DESC LIMIT 30;
\`\`\`

## 참고

- NIST SP 800-53, AC-6 최소 권한 및 AU-2 감사 이벤트
- OWASP Cheat Sheet — Access Control
- 개인정보의 안전성 확보조치 기준, 접속기록`,
    diagram: {
      type: 'layers',
      caption: '대리 로그인 통제',
      layers: [
        { label: '사유와 승인', note: '근거 없는 접근 차단' },
        { label: '읽기 전용 기본', note: '쓰기는 예외 승인' },
        { label: '두 신원 기록', note: '조작자와 대상' },
        { label: '대상 통지', note: '사용자가 인지' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '기록 방식과 조사 가능성',
      x: ['조작자 기록', '대상만 기록'],
      y: ['사유 있음', '사유 없음'],
      cells: ['조사 가능', '누가 했는지 불명', '근거 불명', '조사 불가'],
    },
  },
  {
    slug: 'session-fixation',
    title: '세션 고정 공격과 식별자 재발급',
    body: `공격자가 먼저 세션 식별자를 만들어 피해자에게 심어 두고, 피해자가 그 식별자로 로그인하면 그대로 그 세션에 올라탄다. 비밀번호를 알아낼 필요도, 토큰을 훔칠 필요도 없다. 방어는 한 줄이다. 권한 수준이 바뀌는 순간 세션 식별자를 새로 발급한다.

## 어떻게 성립하는가?

로그인 전과 후에 같은 식별자를 그대로 쓰는 구현에서 성립한다. 공격자는 자기 브라우저에서 세션을 하나 만들고, 그 식별자를 피해자 브라우저에 심는다. 피해자가 로그인하면 그 식별자에 인증 상태가 붙고, 공격자는 같은 식별자로 접근한다.

![로그인 전후 식별자를 유지할 때](/img/posts/session-fixation.svg)

## 식별자를 심는 경로

| 경로 | 조건 |
| --- | --- |
| 주소 파라미터로 세션 전달 | 세션을 URL 로 넘기는 구현 |
| 하위 도메인에서 쿠키 설정 | Domain 이 넓게 잡힌 쿠키 |
| 스크립트 삽입 | 다른 취약점과 결합 |
| 중간자 | 평문 구간이 남아 있을 때 |

첫 번째는 세션을 URL 에 넣지 않는 것으로, 두 번째는 Domain 을 지정하지 않는 것으로 함께 막힌다.

## 언제 재발급해야 하는가

- 로그인 성공 직후
- 권한이 올라가는 시점 (추가 인증 통과, 역할 변경)
- 대리 로그인 시작과 종료
- 비밀번호 변경 후

권한이 바뀌었는데 식별자가 그대로면, 바뀌기 전에 알려진 식별자로 바뀐 후의 권한을 쓸 수 있다.

![재발급 시점](/img/posts/session-fixation-2.svg)

## 옛 세션을 확실히 버린다

새 식별자를 발급하면서 옛 세션 데이터를 그대로 옮기면, 공격자가 심어 둔 값이 함께 따라온다. 필요한 값만 골라 옮기고 옛 세션은 저장소에서 삭제한다.

## 서버 저장 세션과 토큰의 차이

서버에 세션을 저장하는 구조에서는 재발급이 저장소 조작으로 끝난다. 상태 없는 토큰을 쓰는 구조에서는 로그인 시점에 새 토큰을 발급하는 것이 곧 재발급이므로 이 문제가 잘 생기지 않는다. 대신 옛 토큰을 무효화하는 경로가 필요하다.

## 바로 확인하기

로그인 전후의 식별자를 비교하는 것으로 끝난다.

\`\`\`bash
# 로그인 전 세션 받기
BEFORE=$(curl -s -c jar.txt -o /dev/null -w '%{http_code}' https://app.example.com/login \\
  && grep -oE 'session[^\\s]*\\s+\\S+$' jar.txt | awk '{print $NF}')

# 로그인
curl -s -b jar.txt -c jar.txt -o /dev/null -X POST https://app.example.com/login \\
  -H 'Content-Type: application/json' -d '{"email":"a@example.com","password":"..."}'

AFTER=$(grep -oE 'session[^\\s]*\\s+\\S+$' jar.txt | awk '{print $NF}')
[ "$BEFORE" = "$AFTER" ] && echo '식별자가 그대로 — 세션 고정에 취약' || echo '재발급됨'
\`\`\`

코드에서는 로그인 처리 직후에 재발급이 있는지 확인한다.

\`\`\`bash
grep -rnE 'regenerate|renewSession|rotateSession' --include='*.ts' src/ || echo '재발급 호출 없음'
\`\`\`

## 실제로 이렇게 터진다

로그인 시 세션 식별자를 새로 발급하지 않은 사례가 있다. 공격자가 자기 식별자를 피해자 브라우저에 심어 두고, 피해자가 로그인하면 그 식별자가 인증된 세션이 됐다. 공격자는 처음부터 그 값을 알고 있었다.

권한이 올라갈 때도 같은 문제가 생긴다. 일반 사용자가 관리자로 전환될 때 식별자를 유지하면 같은 경로가 열린다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 식별자가 예측 불가능하면 안전하다 | 고정 공격은 예측이 필요 없다 |
| 로그인하면 새 세션이 생긴다 | 프레임워크 설정에 따라 다르다 |
| 쿠키만 쓰면 안전하다 | 주소로 세션을 넘기는 경로가 남을 수 있다 |
| 로그아웃하면 정리된다 | 서버에서 지우지 않으면 남는다 |
| 흔하지 않은 공격이다 | 설정 하나로 생긴다 |

## 언제 식별자를 재발급하는가

| 시점 | 이유 |
| --- | --- |
| 로그인 성공 | 핵심 |
| 권한 상승 | 관리자 전환 등 |
| 비밀번호 변경 | 기존 세션 무효화와 함께 |
| 추가 인증 통과 | 권한 범위가 바뀐다 |
| 로그아웃 | 기존 식별자 폐기 |

## 함께 확인할 것

1. 세션 식별자를 주소로 전달하는 경로가 없는가
2. 로그인 전 세션에 어떤 데이터가 담기는가 — 장바구니 등은 이관 필요
3. 로그아웃 시 서버 세션이 실제로 지워지는가
4. 동시 세션 수에 상한이 있는가
5. 세션 목록을 사용자가 볼 수 있는가

\`\`\`bash
# 로그인 전후 식별자 비교
BEFORE=$(curl -sI https://stg.example.com/login | grep -oiE 'sessionid=[^;]+')
AFTER=$(curl -sI -X POST https://stg.example.com/login \
          -H "Cookie: $BEFORE" -d 'id=test&pw=test' | grep -oiE 'sessionid=[^;]+')
echo "전: $BEFORE"
echo "후: $AFTER"
[ "$BEFORE" = "$AFTER" ] && echo '재발급되지 않는다 — 고정 공격에 취약'
\`\`\`

## 참고

- OWASP Cheat Sheet — Session Management
- CWE-384: Session Fixation
- NIST SP 800-63B, 세션 관리`,
    diagram: {
      type: 'flow',
      caption: '세션 고정이 성립하는 과정',
      steps: [
        { label: '공격자가 세션 생성', note: '식별자 확보' },
        { label: '피해자에게 심기', note: '주소·쿠키 경로' },
        { label: '피해자 로그인', note: '같은 식별자에 인증 부착', danger: true },
        { label: '공격자 접근', note: '같은 세션 사용', danger: true },
      ],
    },
    diagram2: {
      type: 'steps',
      caption: '식별자 재발급 시점',
      steps: [
        { label: '로그인 성공', note: '가장 중요한 지점' },
        { label: '권한 상승', note: '추가 인증 통과 시' },
        { label: '대리 로그인 전환', note: '시작과 종료 모두' },
        { label: '비밀번호 변경', note: '옛 세션 전부 폐기' },
      ],
    },
  },
  {
    slug: 'remember-me',
    title: '자동 로그인 토큰 설계와 탈취 감지',
    body: `자동 로그인은 편의 기능이지만 실제로는 수명이 긴 자격 증명을 기기에 남기는 일이다. 그래서 세션 쿠키보다 더 조심스럽게 다뤄야 하는데, 오히려 대충 만들어지는 경우가 많다. 설계의 핵심은 두 가지다. 쓸 때마다 새 값으로 바꾸고, 옛 값이 다시 나타나면 탈취로 판단한다.

## 무엇이 잘못된 구현인가?

| 구현 | 문제 |
| --- | --- |
| 사용자 식별자를 그대로 저장 | 값만 바꾸면 다른 사람이 된다 |
| 식별자 + 해시 고정값 | 한 번 훔치면 영구 사용 |
| 서버에 기록 없음 | 회수도 탐지도 불가능 |
| 만료 없음 | 기기를 잃어도 계속 유효 |
| 세션과 같은 권한 | 민감 동작까지 통과 |

![회전형 토큰과 고정 토큰](/img/posts/remember-me.svg)

## 회전과 재사용 감지

토큰을 쓸 때마다 새 토큰을 발급하고 옛 토큰을 무효로 만든다. 이미 쓰인 토큰이 다시 들어오면 두 가지 경우다. 통신 오류로 사용자가 재시도했거나, 누군가 복제해 쓰는 것이다. 후자를 가정하고 그 계정의 자동 로그인 계열 전체를 폐기하고 사용자에게 알린다.

\`\`\`
발급   시리즈 ID + 토큰 값(무작위)
검증   시리즈가 있고 토큰이 일치 → 새 토큰 발급
불일치 같은 시리즈인데 토큰이 다름 → 복제 의심, 계열 전체 폐기
없음   무시하고 로그인 화면으로
\`\`\`

## 권한을 낮춘다

자동 로그인으로 들어온 세션은 "이 사람일 가능성이 높다"는 상태이지 "방금 인증했다"는 상태가 아니다. 열람은 허용하되 비밀번호 변경, 결제수단 등록, 출금 같은 동작에는 다시 인증을 요구한다.

![자동 로그인 세션의 권한 범위](/img/posts/remember-me-2.svg)

## 기기 목록을 사용자에게 보여준다

발급된 자동 로그인 토큰을 기기 단위로 보여주고 개별 해제를 제공한다. 마지막 사용 시각과 접속 지역을 함께 표시하면 사용자가 스스로 이상을 발견한다.

## 저장은 해시로

토큰 원문을 저장하면 데이터베이스 유출이 곧 전 계정 로그인으로 이어진다. 해시로 저장하고 검증할 때 해시를 비교한다. 시리즈 식별자는 조회용이므로 그대로 저장해도 된다.

## 바로 확인하기

토큰이 실제로 회전하는지, 옛 토큰이 막히는지 본다.

\`\`\`bash
# 1) 자동 로그인 쿠키로 접근
T1=$(grep remember jar.txt | awk '{print $NF}')
curl -s -b jar.txt -c jar.txt -o /dev/null https://app.example.com/me
T2=$(grep remember jar.txt | awk '{print $NF}')
[ "$T1" = "$T2" ] && echo '회전하지 않음 — 탈취 시 영구 사용' || echo '회전됨'

# 2) 옛 토큰 재사용 — 거부되고 계열 폐기 알림이 와야 한다
curl -s -o /dev/null -w '옛 토큰 %{http_code}\\n' \\
  -H "Cookie: remember=$T1" https://app.example.com/me
\`\`\`

민감 동작이 막히는지도 확인한다.

\`\`\`bash
curl -s -o /dev/null -w '비밀번호 변경 %{http_code}\\n' -X POST \\
  https://app.example.com/me/password -H "Cookie: remember=$T2" \\
  -H 'Content-Type: application/json' -d '{"next":"New!2345"}'
# 401 재인증 요구가 정상이다
\`\`\`

## 실제로 이렇게 터진다

자동 로그인 토큰이 만료 없이 발급된 사례가 있다. 한 번 로그인하면 영구히 유지됐고, 기기를 잃어버려도 회수할 방법이 없었다. 토큰은 사용자 식별자를 그대로 담고 있어서 값을 바꾸면 다른 사람이 됐다.

토큰 재사용을 탐지하지 않은 경우도 있다. 탈취된 토큰과 정상 토큰이 동시에 쓰였지만 아무 신호가 없었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 편의 기능이라 위험이 낮다 | 장기 자격 증명이다 |
| 암호화하면 안전하다 | 탈취 시 그대로 쓰인다 |
| 만료를 길게 해야 편하다 | 회전하면 길어도 안전하다 |
| 기기 정보를 넣으면 안전하다 | 위조 가능하다 |
| 로그아웃하면 사라진다 | 서버에서 지워야 한다 |

## 어떻게 설계하는가

토큰을 사용할 때마다 새것으로 바꾸는 회전 방식이 표준이다.

| 항목 | 설계 |
| --- | --- |
| 값 | 무작위, 사용자 정보 미포함 |
| 저장 | 서버에 해시로, 기기 정보와 함께 |
| 수명 | 절대 만료 + 유휴 만료 |
| 회전 | 사용 시 새 토큰 발급, 이전 무효 |
| 재사용 감지 | 이미 쓴 토큰이 다시 오면 전체 폐기 |
| 범위 | 자동 로그인 세션은 권한 축소 |

마지막 항목이 중요하다. 자동 로그인으로 들어온 세션에서는 결제·설정 변경 전에 재인증을 요구한다.

\`\`\`ts
const row = await rememberTokens.findByHash(sha256(presented))
if (!row) return null

if (row.usedAt) {
  // 이미 사용된 토큰이 다시 왔다 — 탈취 가능성이 높다
  await rememberTokens.revokeFamily(row.familyId)
  await alerts.security('자동 로그인 토큰 재사용', { userId: row.userId })
  return null
}

await rememberTokens.markUsed(row.id)
const next = await rememberTokens.issue(row.userId, row.familyId)   // 회전
return { userId: row.userId, token: next, elevated: false }         // 권한 축소
\`\`\`

## 사용자에게 무엇을 보여 주는가

기기 목록과 마지막 사용 시각을 보여 주고 개별 해제를 제공한다. 사용자가 스스로 이상을 알아채는 유일한 수단이다.

## 참고

- OWASP Cheat Sheet — Session Management, Remember Me
- CWE-539: Use of Persistent Cookies Containing Sensitive Information
- NIST SP 800-63B, 재인증 요건`,
    diagram: {
      type: 'flow',
      caption: '회전형 자동 로그인',
      steps: [
        { label: '토큰 사용', note: '시리즈 + 값 검증' },
        { label: '새 토큰 발급', note: '옛 값 무효화' },
        { label: '옛 값 재등장', note: '복제 의심', danger: true },
        { label: '계열 전체 폐기', note: '사용자에게 통지' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '세션 종류와 허용 범위',
      x: ['열람', '민감 동작'],
      y: ['방금 인증', '자동 로그인'],
      cells: ['허용', '허용', '허용', '재인증 요구'],
    },
  },
  {
    slug: 'logout-everywhere',
    title: '전체 기기 로그아웃과 세션 목록',
    body: `사용자가 계정이 이상하다고 느꼈을 때 스스로 할 수 있는 가장 강력한 조치가 전체 기기 로그아웃이다. 그런데 이 기능이 없거나, 있어도 실제로는 일부만 끊는 경우가 많다. 끊어야 할 것은 화면 세션만이 아니라 갱신 토큰, 자동 로그인 토큰, 발급된 API 키, 연동된 애플리케이션까지다.

## 무엇을 끊어야 하는가?

| 대상 | 놓치면 생기는 일 |
| --- | --- |
| 화면 세션 | 다른 브라우저에서 계속 사용 |
| 갱신 토큰 | 만료 후 새 토큰이 계속 발급 |
| 자동 로그인 토큰 | 기기에서 다시 들어온다 |
| 모바일 앱 세션 | 앱은 그대로 살아 있다 |
| 개인 API 키 | 프로그램 접근이 유지된다 |
| 연동 애플리케이션 | 제3자 접근이 유지된다 |

![끊어야 할 접근 경로 전체](/img/posts/logout-everywhere.svg)

## 세션 목록을 먼저 만든다

전체 로그아웃을 만들려면 무엇이 발급돼 있는지 알아야 한다. 세션과 토큰을 사용자 단위로 조회할 수 있는 구조가 없으면 이 기능 자체를 만들 수 없다. 목록에는 기기 정보, 마지막 사용 시각, 접속 지역을 담아 사용자가 판단할 수 있게 한다.

## 상태 없는 토큰을 함께 끊는 방법

서명만으로 검증되는 접근 토큰은 저장소에서 지울 것이 없다. 사용자 레코드에 토큰 버전을 두고 전체 로그아웃 시 값을 올리면, 그보다 낮은 버전의 토큰은 검증 단계에서 거부된다. 접근 토큰 수명을 짧게 두면 지연도 짧다.

\`\`\`
전체 로그아웃 시
  1. 세션 저장소에서 해당 사용자 세션 전부 삭제
  2. 갱신 토큰·자동 로그인 토큰 폐기
  3. tokenVersion += 1  → 남아 있는 접근 토큰 무효
  4. 개인 API 키는 사용자에게 확인 후 폐기
  5. 연동 애플리케이션 목록 제시
  6. 감사 로그 기록과 통지
\`\`\`

![끊긴 뒤 남는 접근 경로](/img/posts/logout-everywhere-2.svg)

## 스스로 한 것과 시스템이 한 것을 구분한다

비밀번호 변경이나 침해 의심으로 시스템이 전체 로그아웃을 실행한 경우, 사용자에게 왜 끊겼는지 알려야 한다. 이유 없이 로그인이 풀리면 사용자는 서비스 오류로 받아들이고, 실제 침해 신호를 놓친다.

## 현재 기기는 남길지 정한다

전체 로그아웃에 현재 기기까지 포함할지는 선택이다. 계정 탈취 상황에서는 전부 끊고 다시 로그인하게 하는 편이 안전하다. 현재 기기를 남기는 옵션을 준다면 기본값은 전부 끊기로 둔다.

## 바로 확인하기

전체 로그아웃 후 각 경로가 실제로 막히는지 하나씩 확인한다.

\`\`\`bash
curl -s -X POST https://app.example.com/me/sessions/revoke-all \\
  -H "Authorization: Bearer $ACCESS" -o /dev/null

for name in 접근토큰 갱신토큰 자동로그인 API키; do :; done
curl -s -o /dev/null -w '접근 토큰   %{http_code}\\n' -H "Authorization: Bearer $ACCESS" https://app.example.com/me
curl -s -o /dev/null -w '갱신 토큰   %{http_code}\\n' -X POST https://app.example.com/token/refresh \\
  -H 'Content-Type: application/json' -d "{\\"refresh_token\\":\\"$REFRESH\\"}"
curl -s -o /dev/null -w '자동 로그인 %{http_code}\\n' -H "Cookie: remember=$REMEMBER" https://app.example.com/me
curl -s -o /dev/null -w 'API 키      %{http_code}\\n' -H "X-Api-Key: $APIKEY" https://api.example.com/me
\`\`\`

401 이 아닌 항목이 남은 경로다.

## 실제로 이렇게 터진다

비밀번호를 바꿨는데 기존 세션이 그대로 유지된 사례가 있다. 계정이 탈취된 것을 알고 비밀번호를 바꿨지만, 공격자의 세션은 계속 살아 있었다.

전체 로그아웃 기능은 있었는데 API 토큰은 빠진 경우도 있다. 화면 세션만 끊기고 발급된 토큰은 유효했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 비밀번호를 바꾸면 세션이 끊긴다 | 명시적으로 처리해야 한다 |
| 로그아웃하면 다 끝난다 | 그 기기만이다 |
| 세션만 끊으면 된다 | 토큰·자동 로그인·연동 앱이 남는다 |
| 사용자가 알아서 한다 | 목록을 보여줘야 판단할 수 있다 |
| 즉시 반영된다 | 캐시 때문에 지연될 수 있다 |

## 무엇을 함께 끊는가

| 대상 | 놓치기 쉬움 |
| --- | --- |
| 웹 세션 | 기본 |
| 모바일 앱 세션 | 별도 저장소 |
| 갱신 토큰 | 서버 저장 |
| 자동 로그인 토큰 | 별도 테이블 |
| API 키 | 대개 유지가 맞다 |
| 연동 앱 권한 | 사용자 선택 |

API 키는 보통 유지한다. 사용자가 명시적으로 선택하게 하는 편이 낫다.

## 언제 자동으로 끊는가

| 상황 | 처리 |
| --- | --- |
| 비밀번호 변경 | 현재 기기 외 전부 |
| 다단계 수단 변경 | 전부 |
| 계정 복구 완료 | 전부 |
| 관리자 정지 | 전부 |
| 의심 활동 감지 | 전부 + 알림 |

## 사용자 화면에 무엇을 두는가

기기·위치·마지막 사용 시각을 보여 주고 개별·전체 해제를 제공한다. 목록이 없으면 사용자는 이상을 알아챌 수 없다.

\`\`\`ts
// 일괄 폐기는 기준 시각으로 — 목록을 지우지 않아도 된다
await users.update(userId, { tokensInvalidBefore: Math.floor(Date.now() / 1000) })
await sessions.deleteAllFor(userId, { except: currentSessionId })
await rememberTokens.revokeAllFor(userId)
await refreshTokens.revokeAllFor(userId)
await notify.user(userId, '모든 기기에서 로그아웃되었습니다')
\`\`\`

검증 시 발급 시각을 기준 시각과 비교하면, 폐기 목록을 크게 유지하지 않아도 된다.

## 참고

- OWASP Cheat Sheet — Session Management
- RFC 7009 — OAuth 2.0 Token Revocation
- NIST SP 800-63B, 세션 종료 요건`,
    diagram: {
      type: 'layers',
      caption: '계정에 붙어 있는 접근 경로',
      layers: [
        { label: '화면 세션', note: '브라우저별' },
        { label: '갱신·자동 로그인 토큰', note: '기기에 저장' },
        { label: '개인 API 키', note: '프로그램 접근' },
        { label: '연동 애플리케이션', note: '제3자 접근' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '폐기 범위와 남는 위험',
      x: ['토큰까지 폐기', '세션만 폐기'],
      y: ['연동 정리', '연동 유지'],
      cells: ['완전히 차단', '토큰으로 재진입', '제3자 접근 유지', '사실상 그대로'],
    },
  },
  {
    slug: 'device-authorization',
    title: '입력이 어려운 기기의 로그인 흐름',
    body: `TV, 셋톱박스, 콘솔처럼 키보드가 없는 기기에서 비밀번호를 입력하게 만들면 사용자는 리모컨으로 한 글자씩 찍어야 한다. 그래서 기기는 짧은 코드만 보여주고 실제 인증은 사용자의 휴대폰에서 끝내는 흐름을 쓴다. 편의를 위한 설계지만, 코드를 남에게 읽어 주게 만드는 사기가 성립하므로 통제가 필요하다.

## 흐름은 어떻게 되는가?

기기가 인증 서버에 요청해 사용자 코드와 확인 주소를 받는다. 화면에 코드를 띄우고, 사용자는 휴대폰에서 그 주소로 들어가 코드를 입력하고 로그인한다. 기기는 그동안 인증 서버에 결과를 물어보다가 승인되면 토큰을 받는다.

![기기와 휴대폰으로 나뉜 인증](/img/posts/device-authorization.svg)

## 이 흐름의 위험

| 위험 | 내용 |
| --- | --- |
| 코드 유도 사기 | 남의 코드를 읽어 주게 만든다 |
| 코드 추측 | 코드가 짧고 시도 제한이 없을 때 |
| 승인 화면 오해 | 무엇을 승인하는지 안 보임 |
| 만료 없음 | 오래 유효한 코드가 떠 있다 |
| 폴링 남용 | 기기가 과도하게 조회 |

## 승인 화면이 무엇을 승인하는지 보여야 한다

사용자가 보는 화면에 어떤 기기가, 어디에서, 무엇을 요청하는지 나와야 한다. "코드를 입력하세요"만 있고 대상 정보가 없으면, 사기범이 불러 준 코드를 그대로 넣게 된다. 기기 종류와 요청 위치를 함께 보여주고, 사용자가 시작한 것이 아니면 취소하라고 안내한다.

![승인 화면에 담아야 할 정보](/img/posts/device-authorization-2.svg)

## 코드와 만료

사용자 코드는 사람이 읽고 입력하는 값이라 짧아야 하는데, 짧으면 추측이 쉬워진다. 그래서 시도 제한과 짧은 만료를 함께 둔다. 혼동되는 글자를 제외한 문자 집합을 쓰면 같은 길이에서 오입력이 줄어든다.

\`\`\`
길이     8자 내외, 하이픈으로 구분
문자     혼동 글자 제외 (0/O, 1/I/l 등)
만료     5~10분
시도     분당 제한, 초과 시 코드 폐기
\`\`\`

## 폴링 간격을 서버가 정한다

기기가 짧은 간격으로 계속 물어보면 서버 부하가 된다. 응답에 대기 간격을 담아 기기가 그만큼 기다리게 하고, 너무 자주 오면 간격을 늘리라는 신호를 준다.

## 바로 확인하기

승인 화면에 기기 정보가 노출되는지, 코드에 시도 제한이 있는지 본다.

\`\`\`bash
# 기기 인증 시작
RESP=$(curl -s -X POST https://auth.example.com/device/code \\
  -d "client_id=$CLIENT_ID&scope=profile")
echo "$RESP" | python3 -m json.tool

# 응답에 있어야 하는 것
#   user_code, verification_uri, expires_in, interval
#   expires_in 이 지나치게 길면 사기 창이 넓어진다
\`\`\`

코드 추측이 막히는지 시험한다.

\`\`\`bash
for i in $(seq 1 20); do
  code=$(printf 'ABCD-%04d' "$i")
  printf '%s ' "$(curl -s -o /dev/null -w '%{http_code}' -X POST \\
    https://auth.example.com/device/verify -d "user_code=$code")"
done; echo
# 계속 400 만 나오고 차단되지 않으면 시도 제한이 없는 것이다
\`\`\`

## 실제로 이렇게 터진다

TV 앱 로그인에서 코드가 짧고 만료가 길었던 사례가 있다. 네 자리 코드에 만료가 30분이라 무차별 대입이 가능했다. 공격자가 코드를 맞히면 그 기기가 피해자 계정으로 연결됐다.

사용자에게 무엇을 승인하는지 보여 주지 않은 경우도 있다. 코드만 입력하면 승인되어, 피싱으로 코드를 받아 낼 수 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 코드가 짧아야 편하다 | 대입 가능성이 커진다 |
| 만료가 길어야 편하다 | 공격 창이 넓어진다 |
| 코드만 맞으면 된다 | 무엇을 승인하는지 보여야 한다 |
| 기기 화면에 코드가 있으니 안전하다 | 코드를 전달받는 피싱이 있다 |
| 승인 후에는 안전하다 | 기기 목록에서 회수 가능해야 한다 |

## 무엇을 정하는가

| 항목 | 권장 |
| --- | --- |
| 코드 길이 | 8자 이상, 혼동 문자 제외 |
| 만료 | 5~10분 |
| 시도 제한 | 5회 후 코드 폐기 |
| 폴링 간격 | 서버가 지정, 초과 시 거부 |
| 승인 화면 | 기기 종류·위치·요청 시각 표시 |
| 사후 관리 | 기기 목록에서 해제 가능 |

승인 화면에 정보를 보여 주는 것이 피싱 방어의 핵심이다. "거실 TV 에서 로그인 요청" 을 보면 사용자가 판단할 수 있다.

## 흐름

1. 기기가 코드 발급을 요청한다
2. 기기 화면에 사용자 코드와 확인 주소를 표시한다
3. 사용자가 다른 기기에서 로그인하고 코드를 입력한다
4. 승인 화면에 무엇을 승인하는지 보여 준다
5. 승인하면 기기가 폴링으로 토큰을 받는다
6. 기기 목록에 등록되어 나중에 해제할 수 있다

\`\`\`ts
// 코드 생성 — 혼동되는 문자를 뺀다
const ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ23456789'   // 0/O, 1/I 제외
const userCode = Array.from(crypto.randomBytes(8))
  .map((b) => ALPHABET[b % ALPHABET.length]).join('')
  .replace(/(.{4})/, '$1-')                        // BCDF-GHJK

await deviceCodes.create({
  userCode, deviceCode: crypto.randomUUID(),
  expiresAt: new Date(Date.now() + 8 * 60_000),    // 8분
  attempts: 0, interval: 5,
})
\`\`\`

\`\`\`bash
# 코드 대입 시도가 있는지 — 실패가 몰리면 신호다
psql -Atc "
  SELECT date_trunc('hour', at) AS h, count(*) FILTER (WHERE NOT ok) AS fail
  FROM device_code_attempts WHERE at > now() - interval '24 hours'
  GROUP BY 1 ORDER BY 1 DESC LIMIT 24"
\`\`\`

## 참고

- RFC 8628 — OAuth 2.0 Device Authorization Grant
- OAuth 2.0 Security Best Current Practice
- NIST SP 800-63B, 인증 시도 제한`,
    diagram: {
      type: 'flow',
      caption: '기기 인증 흐름',
      steps: [
        { label: '기기가 코드 요청', note: '사용자 코드와 주소 수신' },
        { label: '화면에 코드 표시', note: '입력은 휴대폰에서' },
        { label: '사용자 승인', note: '대상 정보 확인 후' },
        { label: '기기가 토큰 수신', note: '간격을 지켜 조회' },
      ],
    },
    diagram2: {
      type: 'layers',
      caption: '승인 화면에 담을 정보',
      layers: [
        { label: '어떤 기기인가', note: '종류와 이름' },
        { label: '어디에서 요청했는가', note: '대략적 위치' },
        { label: '무엇을 허용하는가', note: '스코프 설명' },
        { label: '내가 시작했는가', note: '아니면 취소 안내' },
      ],
    },
  },
]
