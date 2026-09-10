const R = String.raw
export default {

'privacy-impact-assessment': R`## 기획서 항목표

기획 단계에서 이 표를 채우게 하면 검토가 자연히 시작된다.

| 항목 | 수집 근거 | 이용 목적 | 보유 기간 | 제공·위탁 |
| --- | --- | --- | --- | --- |
| | | | | |

빈칸이 채워지지 않는 항목은 대개 필요 없는 항목이다. 목적을 적을 수 없으면 수집하지 않는다.

신규 항목이 하나라도 추가되면 검토를 요청하도록 절차에 넣는다. 항목이 늘어나는 시점이 개입할 수 있는 유일한 시점이다.`,

'isms-scope-definition': R`## 범위 경계 확인표

경계 근처를 이 표로 정리하면 지적을 미리 잡을 수 있다.

| 시스템 | 범위 안 | 범위 데이터 접근 | 인프라 공유 | 판단 |
| --- | --- | --- | --- | --- |
| | | | | |

두 번째나 세 번째 열이 예이면 실질적으로 범위에 포함된다. 범위 밖으로 두려면 접근을 끊거나 인프라를 분리해야 한다.

위탁 업체도 같은 표에 넣는다. 서비스 운영의 일부를 맡고 있으면 범위에 들어간다.`,

'vendor-risk-tiering': R`## 목록 만들기

목록이 없으면 등급도 없다. 여러 출처를 합쳐야 완성된다.

| 출처 | 얻는 것 |
| --- | --- |
| 구매·계약 부서 | 계약된 업체 |
| 결제 기록 | 카드 결제 SaaS |
| 계정 시스템 | 외부 사용자 |
| 네트워크 로그 | 연동 대상 |
| 현업 문의 | 알려지지 않은 도구 |

세 번째와 네 번째에서 계약 없이 쓰는 도구가 드러나는 경우가 많다. 발견하면 벌하지 말고 목록에 넣고 등급을 매긴다.`,

'security-policy-writing': R`## 문서 상태 점검

낡은 문서를 찾는 것부터 시작한다.

\`\`\`bash
# 마지막 수정이 오래된 정책 문서
find docs/policy -name '*.md' -mtime +540 -exec ls -l {} \; | head -20

# 검토일 표기가 없는 문서
grep -rL '마지막 검토' docs/policy/*.md
\`\`\`

2년 넘게 손대지 않은 문서는 대부분 현실과 다르다. 모든 문서에 마지막 검토일과 담당자를 표기하고, 검토 주기를 정한다.

읽히는지도 확인한다. 조회 기록이 있으면 실제로 열어 보는 문서와 아닌 문서가 구분된다.`,

'risk-acceptance-process': R`## 수용 목록 관리

만료가 다가오는 항목을 정기적으로 본다.

\`\`\`bash
psql -Atc "SELECT id, title, severity, approver, expires_at,
                  now()::date - accepted_at::date AS 경과일
           FROM risk_acceptance
           WHERE status='accepted'
           ORDER BY expires_at NULLS FIRST" | head -20
\`\`\`

만료일이 비어 있는 항목이 가장 위험하다. 영구 수용이 되어 있다는 뜻이다. 전부에 만료일을 붙이는 것부터 시작한다.

목록의 총량과 위험 가중 합계를 경영 보고에 넣으면 조치 역량 부족이 눈에 보인다.`,

'audit-evidence-collection': R`## 수집 스크립트 예

한 번 만들어 두면 매달 자동으로 증적이 쌓인다.

\`\`\`bash
D="증적/$(date +%Y)/$(date +%m)"
mkdir -p "$D"
aws iam list-users --query 'Users[].[UserName,CreateDate,PasswordLastUsed]' \
  --output text > "$D/iam-users.tsv"
aws iam list-attached-role-policies --role-name admin-role \
  > "$D/admin-role-policies.json" 2>/dev/null
kubectl get clusterrolebindings -o json > "$D/k8s-crb.json" 2>/dev/null
echo "수집 $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$D/README.txt"
\`\`\`

README 에 무엇을 어떻게 수집했는지 한 줄 적는다. 감사인이 해석할 수 있어야 증적이 된다.`,

'security-budget-justification': R`## 현재 상태 표

예산 요청은 못 하고 있는 일을 보이는 것이다.

| 항목 | 현재 | 목표 | 격차의 결과 |
| --- | --- | --- | --- |
| 취약점 조치 소요 | 90일 | 14일 | 노출 기간 |
| 로그 보존 | 30일 | 1년 | 조사 불가 구간 |
| 야간 대응 | 없음 | 2시간 내 | 최대 12시간 지연 |
| 복구 시험 | 미실시 | 반기 | 복구 불확실 |

네 번째 열이 설득의 핵심이다. 숫자보다 "그래서 무슨 일이 생기나" 가 판단을 만든다.`,

'processing-record': R`## 개인정보 컬럼 찾기

목록 작성의 출발점으로 쓴다. 이름만으로는 부족하지만 후보를 좁혀 준다.

\`\`\`bash
psql -Atc "SELECT table_name, column_name, data_type
           FROM information_schema.columns
           WHERE table_schema='public'
             AND column_name ~* 'name|phone|mobile|email|addr|birth|ssn|card|account|zip'
           ORDER BY table_name, column_name"
\`\`\`

나온 목록을 담당자와 확인해 실제 개인정보 여부를 판단한다. 로그와 파일에 남는 것은 이 방법으로 안 나오므로 별도로 조사한다.`,

'regulatory-change-tracking': R`## 추적 기록표

무엇을 확인했고 무엇이 남았는지 이 형태로 관리한다.

| 규정 | 공포일 | 시행일 | 해당 여부 | 영향 | 조치 상태 | 담당 |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

해당 없음으로 판단한 것도 기록한다. 나중에 왜 대응하지 않았는지 설명할 수 있어야 한다.

시행일 기준으로 역산해 일정을 잡는다. 시스템 변경이 필요하면 개발 주기를 고려해 최소 3개월 전에 착수한다.`,

'third-party-audit-prep': R`## 표준 답변 묶음

같은 질문이 반복된다. 한 번 정리하면 계속 쓴다.

| 영역 | 표준 답변 | 첨부 자료 | 최종 갱신 |
| --- | --- | --- | --- |
| 조직·역할 | | 조직도 | |
| 접근 통제 | | 권한 검토 기록 | |
| 취약점 관리 | | 조치 이력 요약 | |
| 사고 대응 | | 절차서·훈련 기록 | |
| 개발 보안 | | 검사 도구 설정 | |

최종 갱신일을 보고 오래된 항목을 먼저 확인한다. 답변이 실제와 달라지면 그것이 더 큰 문제가 된다.`,
}
