const R = String.raw
export default {

'security-design-review': R`## 검토 요청 조건 자동 감지

사람이 판단해 요청하기를 기다리면 놓친다.

\`\`\`bash
# 변경에 검토 대상 신호가 있는지 — 파이프라인에서 확인
git diff --name-only origin/main...HEAD \
  | grep -qE '(auth|permission|policy|schema/.*user|integration)' \
  && echo '설계 검토 요청 필요'
\`\`\`

해당하면 자동으로 라벨을 붙이거나 알림을 보낸다. 개발팀이 기억해서 요청하는 방식보다 누락이 적다.

검토는 한 시간을 넘기지 않는다. 길어지면 요청 자체를 꺼리게 된다.`,

'defense-in-depth-practice': R`## 계층 점검표

각 계층이 뚫렸을 때 다음이 무엇인지 채워 본다.

| 뚫린 계층 | 다음 계층 | 실제로 있나 | 확인 방법 |
| --- | --- | --- | --- |
| 웹 방화벽 | 입력 검증 | | 코드 확인 |
| 입력 검증 | 최소 권한 | | 권한 조회 |
| 계정 | 다중 인증 | | 설정 확인 |
| 인증 | 이상 탐지 | | 재현 시험 |
| 서버 | 네트워크 분할 | | 통신 시험 |
| 데이터 접근 | 암호화 | | 저장 확인 |

세 번째 열이 비어 있는 행이 우선 대상이다. 네 번째 열은 설정만 보지 말고 실제로 확인하라는 뜻이다.`,

'blast-radius-limitation': R`## 영향 범위 그려 보기

주요 시스템 하나가 침해됐다고 가정하고 어디까지 갈 수 있는지 센다.

\`\`\`bash
# 그 인스턴스의 역할 권한
aws sts get-caller-identity
aws iam list-attached-role-policies --role-name "$ROLE" --output text

# 저장된 자격 증명
grep -rlE 'PRIVATE KEY|password|token' /etc /opt/app 2>/dev/null | head

# 도달 가능한 대상
ss -tn state established | awk 'NR>1{print $5}' | sort -u
\`\`\`

세 결과를 합치면 그 서버 하나의 침해가 어디까지 번지는지 보인다. 예상보다 넓은 경우가 대부분이다.`,

'graceful-degradation-security': R`## 실패 동작 시험

의도적으로 멈춰 보고 무엇이 일어나는지 본다.

| 멈춘 구성 요소 | 기대 동작 | 실제 동작 |
| --- | --- | --- |
| 인증 서버 | 신규 로그인 거부 | |
| 정책 엔진 | 캐시 사용 또는 거부 | |
| 로그 수집 | 서비스 유지 + 경보 | |
| 비밀 관리 | 캐시 사용 | |
| 이상 탐지 | 서비스 유지 + 경보 | |

시험 환경에서 분기마다 해 본다. 기대와 실제가 다른 행이 나오면 그것이 고칠 부분이다. 실패 동작은 평소에 발생하지 않아 검증되지 않은 채 남는다.`,

'observability-for-security': R`## 기존 데이터 활용도 확인

새로 수집하기 전에 이미 있는 것을 본다.

| 데이터 | 수집 중 | 보안 활용 | 추가할 필드 |
| --- | --- | --- | --- |
| 요청 추적 | | | 주체·인가 결과 |
| 지표 | | | 인증 실패율 |
| 애플리케이션 로그 | | | 접근 범위 |
| 접근 로그 | | | 출발지 |

두 번째 열이 예인데 세 번째가 아니오인 행이 가장 값싼 개선이다. 이미 있는 데이터를 보기만 하면 된다.

민감 정보가 들어가지 않는지도 함께 확인한다. 관측 시스템은 접근 권한이 넓다.`,

'legacy-system-security': R`## 위험 기록표

고칠 수 없는 것을 관리하려면 목록이 필요하다.

| 시스템 | 위험 | 보완 통제 | 잔여 위험 | 교체 목표 | 담당 |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

교체 목표가 비어 있으면 영구히 남는다. 시기를 정하고 예산 계획에 넣는다.

보완 통제가 실제로 동작하는지 정기적으로 확인한다. 격리해 두었다고 생각했는데 새 경로가 생긴 경우가 있다.`,

'security-debt-management': R`## 증감 추이

갚는 속도와 쌓이는 속도를 비교한다.

\`\`\`bash
psql -Atc "SELECT date_trunc('month', d) m,
                  count(*) FILTER (WHERE kind='created') 신규,
                  count(*) FILTER (WHERE kind='resolved') 해소
           FROM debt_events WHERE d > now() - interval '12 months'
           GROUP BY 1 ORDER BY 1"
\`\`\`

신규가 해소보다 계속 많으면 총량이 늘어난다. 이 추이를 경영 보고에 넣으면 조치 역량 부족이 눈에 보인다.

신규를 줄이는 것이 갚는 것보다 효과가 크다. 안전한 기본값과 자동 검사가 그 수단이다.`,

'change-freeze-security': R`## 동결 전 정리

동결 기간에 걸릴 항목을 미리 처리한다.

\`\`\`bash
psql -Atc "SELECT id, title, severity, due_date
           FROM findings
           WHERE fixed_at IS NULL
             AND due_date BETWEEN :freeze_start AND :freeze_end
           ORDER BY severity, due_date"
\`\`\`

기한이 동결 기간에 걸리는 항목을 앞당겨 처리한다. 처리하지 못하면 기한을 조정하고 사유를 기록한다.

긴급 배포 절차의 승인자와 연락처를 동결 시작 전에 확인한다. 휴가 기간과 겹치는 경우가 많다.`,

'security-automation-priorities': R`## 자동화 감시

자동화 자체가 멈추면 점검이 안 되고 있는 상태가 유지된다.

\`\`\`bash
psql -Atc "SELECT job, max(ran_at) 마지막실행,
                  now() - max(ran_at) 경과,
                  bool_or(succeeded) 최근성공
           FROM automation_runs GROUP BY 1
           HAVING now() - max(ran_at) > interval '2 days'"
\`\`\`

예상 주기보다 오래 실행되지 않은 작업이 나오면 확인한다. 조용히 멈춘 자동화가 가장 위험하다.

실패 시 알림을 받도록 설정하고, 알림이 실제로 도달하는지도 확인한다.`,

'security-runbook-writing': R`## 절차서 점검

실제로 쓸 수 있는 상태인지 확인한다.

| 항목 | 확인 |
| --- | --- |
| 사용 상황이 첫 줄에 있나 | |
| 명령을 그대로 복사할 수 있나 | |
| 채워야 할 값이 표시돼 있나 | |
| 연락처가 최신인가 | |
| 마지막 검토일이 있나 | |
| 오프라인 사본이 있나 | |

새로 온 사람에게 절차서만 주고 따라 해 보게 하면 빈틈이 드러난다. 작성자는 아는 것을 빼먹기 쉽다.`,

'security-tool-evaluation': R`## 도입 후 평가

6개월 뒤 실제로 쓰이는지 본다.

| 지표 | 목표 | 실제 |
| --- | --- | --- |
| 콘솔 접속 빈도 | 주 1회 이상 | |
| 탐지·차단 실적 | 유의미 | |
| 오탐률 | 20% 이하 | |
| 운영 소요 시간 | 예상 이내 | |
| 연간 비용 | 예산 이내 | |

접속 빈도가 낮으면 쓰이지 않는 것이다. 종료 조건에 해당하는지 확인하고, 해당하면 계약 갱신 시점에 정리한다.

이미 쓴 비용 때문에 계속 유지하는 판단을 피한다.`,
}
