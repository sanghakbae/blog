const R = String.raw
export default {

'passkey-rollout': R`## 진행 상황을 보는 법

전환은 등록률 하나로 판단하지 않는다. 실제로 쓰이는지, 복구 부담이 늘지 않는지를 함께 본다.

\`\`\`bash
psql -Atc "SELECT
  count(*) FILTER (WHERE cred_count > 0) AS 보유,
  count(*) FILTER (WHERE cred_count > 1) AS 다중보유,
  count(*) FILTER (WHERE last_login_method = 'passkey') AS 실제사용,
  count(*) AS 전체
FROM user_auth_summary"
\`\`\`

다중 보유 비율이 복구 문의량을 정한다. 이 값이 낮으면 기기 분실 문의가 늘어난다. 두 번째 등록을 유도하는 안내를 추가할 시점이다.`,

'session-binding': R`## 어디까지 묶을지 정하는 법

바인딩 강도는 사용자 이탈과 교환이다. 실제 데이터를 보고 정한다.

\`\`\`bash
# 같은 세션에서 접속 주소가 바뀌는 비율 — 엄격하게 묶으면 이만큼 끊긴다
psql -Atc "SELECT round(100.0 * count(*) FILTER (WHERE ip_changed) / count(*), 1)
           FROM sessions WHERE started_at > now() - interval '30 days'"
\`\`\`

이 비율이 높으면 주소 기반 바인딩은 쓸 수 없다. 대신 기기 식별자와 재인증 조합을 쓴다. 반대로 사무실 접속이 대부분이라면 주소 대역 기준이 유효하다.`,

'token-revocation-strategy': R`## 무효화가 실제로 되는지 확인

설계만으로는 알 수 없다. 실제로 시험한다.

\`\`\`bash
# 로그아웃 후 기존 토큰으로 호출 — 401 이어야 한다
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $OLD" \
  https://api.example.com/me
\`\`\`

200 이 나오면 무효화가 동작하지 않는 것이다. 계정 정지, 권한 변경, 비밀번호 변경 세 가지 상황에서 각각 확인한다. 상황마다 처리 경로가 달라 하나만 동작하는 경우가 흔하다.`,

'step-up-authentication': R`## 서버에서 확인되는지 시험

화면을 거치지 않고 민감 작업을 직접 호출한다.

\`\`\`bash
# 재인증 없이 인증 수단 변경 시도 — 401 과 reauth 표시가 와야 한다
curl -s -w '\n%{http_code}\n' -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"phone":"01000000000"}' \
  https://api.example.com/me/contact
\`\`\`

200 이 나오면 화면에서만 재인증을 요구하고 있는 것이다. 인증 수단 변경, 연락처 변경, 출금 세 가지를 각각 확인한다.`,

'account-recovery-design': R`## 복구 경로의 실제 강도 재기

가장 약한 경로가 전체 강도다. 목록을 만들어 각각의 통과 조건을 적어 본다.

| 경로 | 필요한 것 | 공격자가 얻기 어려운가 |
| --- | --- | --- |
| 다른 패스키 | 등록 기기 | 어렵다 |
| 이메일 재설정 | 메일 계정 | 메일이 뚫리면 쉽다 |
| 문자 인증 | 번호 통제 | 번호 이전 사기 |
| 상담 확인 | 개인정보 | 유출 정보로 가능 |

세 번째 열에 "쉽다" 가 하나라도 있으면 그것이 계정의 실제 강도다. 그 경로를 없애거나 대기 기간과 통지로 보완한다.`,

'authorization-model-choice': R`## 현재 상태 측정

모델을 바꾸기 전에 지금이 어떤 상태인지 숫자로 본다.

\`\`\`bash
psql -Atc "SELECT
  (SELECT count(*) FROM roles) AS 역할수,
  (SELECT count(*) FROM users) AS 사용자수,
  (SELECT round(avg(n),1) FROM (SELECT count(*) n FROM user_roles GROUP BY user_id) t) AS 평균보유,
  (SELECT count(*) FROM roles WHERE name ~ '(부서|팀|지역|_[A-Z]{2}$)') AS 조건형역할"
\`\`\`

역할 수가 사용자 수의 10%를 넘거나 조건형 역할이 여럿이면 전환을 검토할 시점이다. 평균 보유가 다섯을 넘으면 조합으로 권한을 표현하고 있다는 뜻이다.`,

'service-account-lifecycle': R`## 정리 대상 뽑기

사용 기록과 소유자 정보를 함께 본다. 한쪽만 보면 오판한다.

\`\`\`bash
psql -Atc "SELECT id, owner_team, created_at, last_used_at
           FROM service_accounts
           WHERE (last_used_at IS NULL OR last_used_at < now() - interval '180 days')
           ORDER BY last_used_at NULLS FIRST"
\`\`\`

180일로 잡으면 분기 작업까지 포함된다. 90일로 잡으면 오판이 생긴다. 목록이 나오면 지우지 말고 먼저 소유 팀에 확인을 요청하고, 응답이 없으면 권한만 축소한 뒤 관찰한다.`,

'impersonation-audit': R`## 기록이 실제로 남는지 확인

기능을 한 번 써 보고 무엇이 남는지 본다.

\`\`\`bash
psql -Atc "SELECT actor, target, reason, ticket_id, started_at, ended_at,
                  (SELECT count(*) FROM impersonation_views v
                   WHERE v.session_id = i.id) AS 조회화면수
           FROM impersonation_log i ORDER BY started_at DESC LIMIT 5"
\`\`\`

사유와 연결 문의가 비어 있거나 조회 화면 수가 0이면 기록이 불완전한 것이다. 열람 범위를 알 수 없으면 나중에 유출 범위를 산정할 수 없다.`,

'api-key-vs-token': R`## 키 현황 점검

발급한 키가 어떤 상태인지 한 번 본다.

\`\`\`bash
psql -Atc "SELECT id, owner, created_at, last_used_at, expires_at,
                  array_length(scopes,1) AS 범위수
           FROM api_keys WHERE revoked_at IS NULL
           ORDER BY created_at" | head -30
\`\`\`

만료일이 없는 키, 1년 넘은 키, 범위가 넓은 키가 정리 대상이다. 마지막 사용이 없는 키는 폐기 후보다. 연동처가 여럿인데 키가 하나뿐이면 분리부터 계획한다.`,

'delegated-access-scope': R`## 연동 현황 정리

승인된 연동이 실제로 무엇을 쓰고 있는지 본다.

\`\`\`bash
psql -Atc "SELECT client_id, array_to_string(scopes,',') AS 범위,
                  last_used_at, granted_at
           FROM oauth_grants
           WHERE last_used_at IS NULL OR last_used_at < now() - interval '90 days'
           ORDER BY granted_at" | head -20
\`\`\`

오래 쓰지 않은 연동은 철회 대상이다. 사용 중이더라도 부여된 범위와 실제 호출 범위를 비교하면 줄일 여지가 보인다. 사용자에게 연동 목록과 철회 버튼을 제공하면 이 정리가 자연히 진행된다.`,
}
