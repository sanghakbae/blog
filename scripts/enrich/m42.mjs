const R = String.raw
export default {

'first-hour-response': R`## 첫 한 시간 기록표

한 사람이 기록을 맡는다. 이 형태로 남기면 나중에 타임라인이 그대로 나온다.

\`\`\`
시각(UTC)  담당  행동                        결과
04:12      A     경보 확인 — 인지 시각        신고 기한 기준
04:15      A     대응 채널 개설(별도 경로)
04:22      B     대상 서버 네트워크 격리      종료하지 않음
04:31      B     메모리 덤프 확보             해시 기록
04:40      C     경영진 1차 보고
04:55      A     영향 범위 잠정 판단
\`\`\`

인지 시각을 첫 줄에 적는 것이 중요하다. 개인정보 유출 신고 기한이 이 시점부터 계산된다.`,

'memory-acquisition': R`## 확보 순서 명령

절차서에 이 형태로 적어 두면 급할 때 문법을 찾지 않는다.

\`\`\`bash
# 1. 휘발 정보 먼저 (몇 초)
ss -tunap > /evidence/net.txt
ps auxwww > /evidence/ps.txt
lsof -n > /evidence/lsof.txt

# 2. 전체 메모리 (수 분~수십 분)
avml /evidence/mem.lime

# 3. 해시 기록
sha256sum /evidence/* | tee /evidence/manifest.sha256
date -u +%Y-%m-%dT%H:%M:%SZ >> /evidence/manifest.sha256
\`\`\`

가상 머신이면 게스트 안에서 실행하지 말고 스냅샷을 뜬다. 흔적을 남기지 않고 상태도 바꾸지 않는다.`,

'lateral-movement-tracing': R`## 경로 추적 질의

계정 기준으로 모으면 이동 경로의 뼈대가 나온다.

\`\`\`bash
psql -Atc "SELECT host, min(at) 처음, max(at) 마지막, count(*) 횟수
           FROM auth_log
           WHERE username = :user AND at BETWEEN :start AND :end
           GROUP BY host ORDER BY min(at)"
\`\`\`

시간순으로 정렬하면 어디서 어디로 갔는지 보인다. 각 호스트에서 다시 어떤 계정이 쓰였는지 확인해 반복하면 경로가 완성된다.

시각 오차를 먼저 확인한다. 한 서버의 시계가 몇 분 어긋나 있으면 순서가 뒤바뀐다.`,

'containment-strategy': R`## 결정 기록

차단이든 관찰이든 판단 근거를 남긴다. 나중에 반드시 질문받는다.

\`\`\`
판단 시각   2026-09-10T04:40Z
선택        부분 차단 (외부 전송만)
근거        데이터 유출 진행 중, 범위 미파악
승인자      보안책임자
전환 조건   추가 유출 확인 시 즉시 전면 격리
실행        04:42 아웃바운드 차단
\`\`\`

전환 조건을 미리 적어 두면 상황이 바뀌었을 때 다시 논의하지 않는다.`,

'ransomware-response': R`## 확산 차단 명령

판단할 시간이 없다. 명령을 절차서에 그대로 적어 두고 실행 권한을 미리 정한다.

\`\`\`bash
# 해당 서브넷을 격리 (예: 보안 그룹 교체)
for i in $(aws ec2 describe-instances --filters Name=subnet-id,Values="$SUBNET" \
           --query 'Reservations[].Instances[].InstanceId' --output text); do
  aws ec2 modify-instance-attribute --instance-id "$i" --groups "$QUARANTINE_SG"
done
\`\`\`

백업 시스템은 이 작업 전에 네트워크에서 분리한다. 백업을 확인하러 접속하다 감염을 옮기는 사고가 실제로 일어난다.`,

'breach-scope-assessment': R`## 산정 근거 만들기

질의 로그에 반환 행 수가 있어야 정확한 산정이 된다. 평소에 남기고 있는지 확인한다.

\`\`\`bash
psql -Atc "SELECT actor, target_table, sum(rows_returned) 행수, count(*) 질의수
           FROM query_audit
           WHERE at BETWEEN :start AND :end AND actor = :suspect
           GROUP BY 1,2 ORDER BY 행수 DESC"
\`\`\`

이 정보가 없으면 네트워크 전송량으로 추정할 수밖에 없고, 그 추정은 근거가 약하다. 지금 남기고 있지 않다면 이번 조사가 끝난 뒤 추가한다.`,

'incident-timeline-build': R`## 시각 정규화

여러 시스템의 시각을 맞추는 것이 첫 작업이다.

\`\`\`bash
# 각 호스트의 시각 오차 확인 — 조사 전에 기록해 둔다
for h in $HOSTS; do
  printf '%-24s ' "$h"
  ssh "$h" 'chronyc tracking 2>/dev/null | grep -i "system time" || date -u'
done
\`\`\`

오차가 있으면 그 값을 기록하고 타임라인에서 보정한다. 로그의 도착 시각이 아니라 발생 시각 필드를 쓴다. 두 값이 몇 분씩 차이 나는 경우가 흔하다.`,

'external-ir-support': R`## 착수 자료 묶음

평소에 준비해 두면 착수가 하루 빨라진다.

| 자료 | 내용 |
| --- | --- |
| 환경 개요 | 시스템 목록·관계도 |
| 로그 위치 | 무엇이 어디에 얼마나 |
| 접근 절차 | 권한 부여 방법 |
| 연락 체계 | 담당·대체·에스컬레이션 |
| 제약 | 건드리면 안 되는 것 |
| 계약 | 대기 계약 문서 |

이 묶음을 분기마다 갱신한다. 사고 중에 만들려고 하면 그것만으로 반나절이 간다.`,

'post-incident-review': R`## 개선 항목 추적

회고에서 나온 항목이 실제로 끝나는지 본다. 다음 회고 첫 순서로 이 표를 확인한다.

| 항목 | 유형 | 담당 | 기한 | 상태 | 검증 |
| --- | --- | --- | --- | --- | --- |
| | 예방 | | | | |
| | 탐지 | | | | |
| | 대응 | | | | |

검증 열이 중요하다. 완료로 표시했지만 실제로 동작하는지 확인하지 않은 항목이 많다. 탐지 개선이라면 재현으로 확인한다.

기한을 넘긴 항목은 위험 수용 절차로 넘겨 책임자가 명시적으로 판단하게 한다.`,

'crisis-decision-authority': R`## 권한표 만들기

이 표를 절차서 첫 장에 둔다. 사고 중에 찾을 수 있어야 한다.

| 결정 | 1차 | 대체 | 무응답 시 |
| --- | --- | --- | --- |
| 서버 격리 | 당직자 | — | 즉시 실행 |
| 계정 비활성화 | 당직자 | — | 즉시 실행 |
| 외부 통신 차단 | 대응 책임자 | 당직자 | 15분 후 실행 |
| 서비스 일부 중단 | 대응 책임자 | 보안 책임자 | 30분 후 상위 |
| 전체 중단 | 경영진 | — | 상위 보고 |
| 대외 공지 | 경영진 | — | 상위 보고 |

이름과 연락처를 채우고 분기마다 확인한다. 훈련에서 이 표대로 진행되는지 본다.`,
}
