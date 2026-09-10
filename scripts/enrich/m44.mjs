const R = String.raw
export default {

'sast-false-positive': R`## 규칙별 발생량 보기

상위 몇 개가 전체의 대부분을 차지한다. 거기서부터 줄인다.

\`\`\`bash
# 규칙별 지적 건수
jq -r '.runs[].results[].ruleId' sarif.json | sort | uniq -c | sort -rn | head -15

# 시험 코드가 포함돼 있는지
jq -r '.runs[].results[].locations[].physicalLocation.artifactLocation.uri' sarif.json \
  | grep -cE 'test|spec|mock|fixture'
\`\`\`

시험 코드 비중이 크면 제외 설정만으로 절반이 준다. 남은 상위 규칙의 표본을 열어 사내 검증 함수를 인식하지 못하는 것인지 확인한다.`,

'code-review-security-checklist': R`## 변경 크기 관리

큰 변경은 아무도 제대로 보지 못한다. 실제 크기를 재 본다.

\`\`\`bash
# 최근 병합된 변경의 크기 분포
git log --merges --since='3 months ago' --format='%H' \
  | while read -r h; do git show --stat --format='' "$h" | tail -1; done \
  | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' | sort -n | tail -10
\`\`\`

수천 줄짜리 병합이 자주 보이면 리뷰 품질을 기대할 수 없다. 민감 경로에는 변경 크기 상한을 두거나 경로별 리뷰어를 지정한다.`,

'secret-scanning-pipeline': R`## 이력 검사

현재 파일만 보면 이미 커밋된 것을 놓친다.

\`\`\`bash
# 이력 전체에서 개인키 형식
git log --all -p --diff-filter=AM \
  | grep -nE 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}' | head

# 현재 파일
grep -rlE 'BEGIN (RSA |EC )?PRIVATE KEY' . --exclude-dir=.git
\`\`\`

하나라도 나오면 그 값을 먼저 무효화한다. 이력 정리는 그다음이고, 효과도 제한적이다. 이미 복제된 저장소에는 남아 있다.`,

'dependency-update-strategy': R`## 밀린 정도 재기

보안 갱신이 얼마나 늦게 반영되는지가 실질 지표다.

\`\`\`bash
# 공개된 취약점 중 미조치 항목의 경과일
npm audit --json 2>/dev/null \
  | jq -r '.vulnerabilities | to_entries[] | select(.value.severity=="critical" or .value.severity=="high")
           | "\(.value.severity) \(.key)"' | sort | head -20
\`\`\`

심각·높음 항목이 목록에 오래 남아 있으면 처리 흐름이 막힌 것이다. 보안 갱신만 별도 경로로 빼서 즉시 처리하고, 일반 갱신은 일괄로 미룬다.`,

'test-data-management': R`## 시험 환경 데이터 점검

가공이 실제로 됐는지 확인한다.

\`\`\`bash
# 실제 형식의 개인정보가 남아 있는지
psql -h test-db -Atc "SELECT count(*) FROM users
                      WHERE email !~ '@example\.(com|org)$'
                         OR phone ~ '^01[016789][0-9]{7,8}$'"
\`\`\`

0 이 아니면 가공이 불완전한 것이다. 특히 이메일 도메인이 실제 값이면 시험 중 메일이 실제로 발송된다.

외부 발송 차단이 걸려 있는지도 함께 확인한다. 가공이 불완전해도 도달하지 않는다면 피해가 없다.`,

'api-versioning-security': R`## 버전별 사용 현황

종료 판단의 근거가 된다.

\`\`\`bash
psql -Atc "SELECT api_version, count(DISTINCT client_id) 클라이언트, count(*) 호출
           FROM api_log WHERE at > now() - interval '30 days'
           GROUP BY 1 ORDER BY 1"
\`\`\`

클라이언트 수가 적으면 개별 연락으로 전환을 도울 수 있다. 호출은 많은데 클라이언트가 하나면 그쪽만 옮기면 된다.

보안 수정이 모든 활성 버전에 적용됐는지도 확인한다. 공통 계층에서 처리하고 있으면 이 걱정이 사라진다.`,

'error-message-design': R`## 응답 차이 확인

메시지를 통일해도 다른 신호가 남는다.

\`\`\`bash
for u in "exists@example.com" "nouser@example.com"; do
  printf '%-28s ' "$u"
  curl -s -o /dev/null -w '%{http_code} %{time_total}\n' -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$u\",\"password\":\"wrong\"}" \
    https://api.example.com/login
done
\`\`\`

상태 코드나 응답 시간이 다르면 계정 존재 여부가 드러난다. 없는 계정에도 더미 해시로 검증을 수행해 시간을 맞춘다.`,

'rate-limiting-design': R`## 걸린 요청 분석

제한이 정상 사용자를 막고 있는지 본다.

\`\`\`bash
psql -Atc "SELECT rule, count(*) 건수,
                  count(DISTINCT account) 계정수,
                  count(DISTINCT ip) 주소수
           FROM rate_limit_log WHERE at > now() - interval '7 days'
           GROUP BY 1 ORDER BY 건수 DESC"
\`\`\`

계정 수가 많고 주소가 적으면 공유 IP 환경의 정상 사용자가 함께 막히는 것이다. 기준을 계정으로 옮긴다. 반대로 주소가 많고 계정이 적으면 분산 공격이다.`,

'graphql-query-limits': R`## 비싼 질의 찾기

복잡도 상한을 정하려면 실제 질의를 봐야 한다.

\`\`\`bash
psql -Atc "SELECT left(operation_name, 40), max(depth) 최대깊이,
                  max(complexity) 최대복잡도, max(duration_ms) 최대시간
           FROM graphql_log WHERE at > now() - interval '7 days'
           GROUP BY 1 ORDER BY 최대복잡도 DESC LIMIT 15"
\`\`\`

정상 질의의 최대값보다 조금 위로 상한을 잡는다. 처음부터 낮게 잡으면 정상 기능이 막힌다. 인트로스펙션이 운영에서 열려 있는지도 함께 확인한다.`,

'mass-assignment-prevention': R`## 위험 패턴 찾기

요청 본문을 통째로 넘기는 곳을 훑는다.

\`\`\`bash
grep -rnE '\(req\.body[,)]|\(request\.body[,)]|Object\.assign\([^,]+, *req\.' src/ | head -20
\`\`\`

각 위치에서 대상 모델에 권한이나 소유자 필드가 있는지 확인한다. 있으면 허용 목록으로 바꾼다.

응답 쪽도 같은 방식으로 본다. 모델을 그대로 직렬화하는 코드는 새 필드가 추가될 때 함께 노출된다.`,
}
