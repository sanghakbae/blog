import type { SeedPost } from './types'

/** 191~200 — AWS 보안 서비스: 탐지와 가시성 */
export const posts20: SeedPost[] = [
  {
    slug: 'aws-guardduty',
    title: 'GuardDuty 탐지 범위와 과금 구조',
    body: `GuardDuty 는 에이전트를 깔지 않고 켜기만 하면 도는 위협 탐지 서비스다. 이미 AWS 안에 흐르고 있는 감사 로그, 흐름 로그, DNS 질의를 읽어 이상 행위를 찾는다. 그래서 도입 비용이 거의 없고, 클라우드 보안에서 가장 먼저 켜는 항목에 든다. 다만 무엇을 읽는지에 따라 요금이 달라지므로 켜기 전에 데이터 양을 가늠해 두는 편이 좋다.

## 무엇을 탐지할 수 있는가?

| 데이터 원본 | 잡아내는 것 |
| --- | --- |
| CloudTrail 관리 이벤트 | 루트 로그인, 자격 증명 오용, 이상 지역 API 호출 |
| CloudTrail 데이터 이벤트 | S3 대량 조회·반출 |
| VPC 흐름 로그 | 채굴 트래픽, 알려진 악성 대역 통신 |
| DNS 질의 로그 | 명령 제어 도메인, 도메인 생성 알고리즘 |
| EKS 감사 로그 | 클러스터 권한 상승 시도 |
| RDS 로그인 활동 | 비정상 데이터베이스 접속 |
| Lambda 네트워크 활동 | 함수에서의 외부 통신 |
| 런타임 모니터링 | 컨테이너·인스턴스 내부 프로세스 행위 |

![흐르고 있는 로그를 읽어 탐지한다](/img/posts/aws-guardduty.svg)

## 켜는 순서

조직 단위로 켜는 것이 기본이다. 계정마다 켜면 새 계정이 생길 때마다 빠진다.

\`\`\`
1. 보안 전용 계정을 위임 관리자로 지정
2. 조직 전체 자동 활성화 켜기 (신규 계정 포함)
3. 데이터 원본 선택 — 흐름 로그·DNS 는 기본 포함
4. S3 보호와 런타임 모니터링은 비용을 보고 결정
5. 결과를 EventBridge 로 받아 알림·티켓 연결
6. 억제 규칙으로 알려진 정상 행위 정리
\`\`\`

## 비용은 어떻게 붙는가

정액이 아니라 **분석한 데이터 양에 비례**한다. 과금 축은 대체로 이렇게 나뉜다.

- CloudTrail 관리 이벤트 — 분석한 이벤트 건수
- VPC 흐름 로그·DNS 질의 — 분석한 로그 용량(GB)
- S3 데이터 이벤트 — 분석한 이벤트 건수
- EKS·RDS·Lambda 보호 — 각각 별도 축
- 런타임 모니터링 — 보호 대상 자원 시간

즉 트래픽이 많은 계정일수록 요금이 커진다. 켜기 전에 30일 무료 평가 기간의 예상 비용 화면을 확인하면 실제 규모를 알 수 있다. 정확한 단가는 지역마다 다르므로 요금 페이지에서 확인해야 한다.

![과금이 붙는 축](/img/posts/aws-guardduty-2.svg)

## 비용을 줄이는 방법

가장 큰 몫은 대개 흐름 로그와 S3 데이터 이벤트다. 흐름 로그가 많은 계정에서는 표본 추출을 검토하고, S3 보호는 민감 버킷이 있는 계정에만 켠다. 개발 계정과 운영 계정의 설정을 다르게 가져가는 것이 현실적이다.

## 결과를 실제로 쓰는 방법

탐지 결과를 콘솔에서만 보면 아무도 보지 않는다. 심각도 기준으로 나눠 처리 경로를 정한다.

\`\`\`
심각도 7 이상   즉시 호출 — 자격 증명 오용, 채굴, 백도어
심각도 4~7      당일 확인 — 이상 지역 호출, 정찰
심각도 4 미만   주간 검토 — 정책 위반성 알림
반복 오탐       억제 규칙 등록 후 근거 기록
\`\`\`

## 바로 확인하기

켜져 있는지, 조직 전체에 적용됐는지부터 본다.

\`\`\`bash
# 활성화 여부와 데이터 원본
aws guardduty list-detectors --query 'DetectorIds' --output text
DET=$(aws guardduty list-detectors --query 'DetectorIds[0]' --output text)
aws guardduty get-detector --detector-id "$DET" \\
  --query '{상태:Status,주기:FindingPublishingFrequency,기능:Features[].{이름:Name,상태:Status}}'

# 최근 심각도 높은 탐지
aws guardduty list-findings --detector-id "$DET" \\
  --finding-criteria '{"Criterion":{"severity":{"Gte":7}}}' --max-results 10 \\
  --query 'FindingIds' --output text | tr '\\t' '\\n' | head
\`\`\`

조직 전체 적용 여부도 확인한다.

\`\`\`bash
aws guardduty describe-organization-configuration --detector-id "$DET" \\
  --query '{자동활성화:AutoEnableOrganizationMembers,기능:Features[].{이름:Name,자동:AutoEnable}}'
# 신규 계정이 자동 포함되지 않으면 계정이 늘 때마다 사각지대가 생긴다
\`\`\`

## 실제로 이렇게 터진다

켜 두기만 하고 경보를 아무도 보지 않은 사례가 흔하다. 몇 달 뒤 침해 조사에서 관련 탐지가 이미 있었다는 것을 알게 된다. 켜는 것과 운영하는 것은 다르다.

한 리전만 켠 경우도 많다. 공격자는 쓰지 않는 리전에서 활동하고, 그 리전에는 탐지가 없다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 켜면 알아서 막아 준다 | 탐지만 하고 차단하지 않는다 |
| 한 리전만 켜면 된다 | 전 리전에서 켜야 한다 |
| 경보가 없으면 안전하다 | 보지 않으면 없는 것과 같다 |
| 전부 조사해야 한다 | 심각도별로 나눠야 유지된다 |
| 비용을 예측할 수 없다 | 데이터 소스별로 계산된다 |

## 어떤 탐지가 실제로 유용한가

| 탐지 유형 | 대응 가치 |
| --- | --- |
| 자격 증명의 예상 밖 위치 사용 | 매우 높음 — 즉시 조사 |
| 채굴 관련 통신 | 높음 — 침해 확정에 가깝다 |
| 알려진 악성 주소 통신 | 높음 |
| 계정 열거·정찰 | 중간 |
| 포트 스캔 수신 | 낮음 — 상시 발생 |

자격 증명 관련 탐지에 가장 먼저 대응 절차를 붙인다. 오탐이 적고 영향이 크다.

## 비용은 어떻게 붙는가

데이터 소스별로 처리량 기준이다. 무엇을 켜느냐가 비용을 정한다.

| 소스 | 과금 기준 |
| --- | --- |
| 관리 이벤트 분석 | 이벤트 수 |
| 데이터 이벤트 분석 | 이벤트 수 |
| 흐름 로그 분석 | GB |
| DNS 로그 분석 | 포함 |
| 런타임 모니터링 | vCPU 시간 |
| 악성코드 검사 | 스캔한 GB |

흐름 로그 분석이 트래픽이 많은 환경에서 큰 비중을 차지한다. 먼저 30일 시험 기간의 실제 청구를 보고 판단한다.

## 운영 설정

\`\`\`bash
# 전 리전에서 켜져 있는지, 조직 단위로 관리되는지
for r in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  id=$(aws guardduty list-detectors --region "$r" --query 'DetectorIds[0]' --output text 2>/dev/null)
  [ "$id" = "None" ] && { echo "$r 미설정"; continue; }
  st=$(aws guardduty get-detector --region "$r" --detector-id "$id" --query 'Status' --output text)
  printf '%-16s %s\n' "$r" "$st"
done

# 심각도 높은 미처리 탐지
aws guardduty list-findings --detector-id "$DET" \
  --finding-criteria '{"Criterion":{"severity":{"Gte":7},"service.archived":{"Eq":["false"]}}}' \
  --query 'FindingIds' --output text | tr '\t' '\n' | wc -l
\`\`\`

## 참고

- AWS GuardDuty 사용 설명서 — 데이터 원본과 탐지 유형
- AWS GuardDuty 요금 페이지
- MITRE ATT&CK for Cloud 매트릭스`,
    diagram: {
      type: 'flow',
      caption: 'GuardDuty 가 읽는 것',
      steps: [
        { label: '기존 로그', note: 'CloudTrail·흐름·DNS' },
        { label: '위협 인텔 대조', note: '알려진 악성 지표' },
        { label: '이상 행위 분석', note: '평소와 다른 패턴' },
        { label: '탐지 결과', note: '심각도별 처리 경로' },
      ],
    },
    diagram2: {
      type: 'bars',
      caption: '과금에 기여하는 비중(일반적 경향)',
      unit: '상대값',
      items: [
        { label: 'VPC 흐름 로그', value: 45, note: '트래픽 많을수록' },
        { label: 'S3 데이터 이벤트', value: 30, note: '요청 건수 기준' },
        { label: 'CloudTrail 관리', value: 15 },
        { label: 'DNS 질의', value: 10 },
      ],
    },
  },
  {
    slug: 'aws-security-hub',
    title: 'AWS Security Hub 표준 선택과 운영 부담',
    body: `Security Hub 는 여러 AWS 보안 서비스의 결과를 한 곳으로 모으고, AWS 계정 설정을 표준 점검 항목에 대조해 점수로 보여준다. 켜는 것은 몇 분이면 되지만, 켜자마자 수백 건의 실패 항목이 쏟아져 아무도 보지 않게 되는 것이 가장 흔한 실패다. 표준을 골라 켜고 예외를 정리하는 과정이 실제 도입 작업이다.

## 무엇을 확인할 수 있는가?

| 영역 | 내용 |
| --- | --- |
| 설정 점검 | 표준 항목 대비 계정 설정 준수 여부 |
| 결과 통합 | GuardDuty·Inspector·Macie 등 결과 집계 |
| 계정 요약 | 조직 전체 점수와 계정별 비교 |
| 자동 대응 | EventBridge 로 조치 연결 |
| 통제 관리 | 항목별 활성·비활성과 예외 |

![여러 서비스 결과가 모이는 지점](/img/posts/aws-security-hub.svg)

## AWS 표준 중 무엇을 고를 것인가?

전부 켜면 항목이 수백 개가 된다. 처음에는 기본 모범 사례 표준 하나로 시작해 실패 항목을 정리하고, 그다음에 규정 관련 표준을 얹는 것이 순서다.

\`\`\`
1단계  AWS 기본 보안 모범 사례 표준만 켠다
2단계  심각도 높은 실패 항목부터 조치
3단계  해당 없는 항목은 근거를 적고 비활성
4단계  CIS 등 추가 표준을 얹는다
5단계  점수 목표를 정하고 주간으로 추적
\`\`\`

## 비용은 어떻게 붙는가

두 축으로 나뉜다.

- **설정 점검 횟수** — 활성화한 통제 항목 수 × 자원 수에 비례해 매달 점검이 돈다
- **수집한 결과 건수** — 다른 서비스에서 들어온 결과의 개수

즉 계정과 자원이 많을수록, 표준을 많이 켤수록 늘어난다. 자원이 적은 개발 계정은 부담이 작고, 운영 계정이 큰 조직은 표준 선택이 곧 비용 조절이다. 첫 30일 무료 평가에서 실제 규모를 확인할 수 있다.

![표준 수와 점검 횟수](/img/posts/aws-security-hub-2.svg)

## 예외를 근거와 함께 남긴다

해당 없는 항목을 그냥 끄면 나중에 왜 껐는지 아무도 모른다. 통제를 비활성화할 때 사유를 적고, 정기적으로 다시 본다. 이 기록이 감사 대응 증적이 되기도 한다.

## 점수를 목표로 삼을 때 주의

점수를 올리는 가장 쉬운 방법은 실패하는 통제를 끄는 것이다. 그래서 점수만 지표로 삼으면 실제 보안 수준과 반대로 움직인다. 활성 통제 수와 점수를 함께 보고, 통제를 끈 건수를 별도로 추적한다.

## 바로 확인하기

켜져 있는 표준과 실패 항목 분포를 본다.

\`\`\`bash
# 활성화된 표준
aws securityhub get-enabled-standards \\
  --query 'StandardsSubscriptions[].{표준:StandardsArn,상태:StandardsStatus}' --output table

# 심각도별 실패 건수
for sev in CRITICAL HIGH MEDIUM; do
  n=$(aws securityhub get-findings \\
    --filters "{\\"SeverityLabel\\":[{\\"Value\\":\\"$sev\\",\\"Comparison\\":\\"EQUALS\\"}],\\"ComplianceStatus\\":[{\\"Value\\":\\"FAILED\\",\\"Comparison\\":\\"EQUALS\\"}],\\"RecordState\\":[{\\"Value\\":\\"ACTIVE\\",\\"Comparison\\":\\"EQUALS\\"}]}" \\
    --query 'length(Findings)' --output text)
  printf '%-10s %s\\n' "$sev" "$n"
done
\`\`\`

비활성화한 통제가 얼마나 되는지도 확인한다.

\`\`\`bash
aws securityhub describe-standards-controls \\
  --standards-subscription-arn "$SUB_ARN" \\
  --query 'Controls[?ControlStatus==\`DISABLED\`].{항목:ControlId,사유:DisabledReason}' --output table
# 사유가 비어 있는 항목은 점수를 올리려고 끈 것일 가능성이 높다
\`\`\`

## 실제로 이렇게 터진다

표준을 전부 켜서 지적이 3천 건 나온 사례가 있다. 점수는 40% 였고 아무도 손대지 않았다. 무엇부터 고칠지 정할 수 없는 상태가 되면 도구는 대시보드로만 남는다.

예외 처리를 안 해서 같은 지적이 매일 반복된 경우도 있다. 의도적으로 그렇게 둔 설정이었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 표준을 다 켜야 한다 | 우리에게 해당하는 것만 |
| 점수가 성과다 | 위험이 준 것이 성과다 |
| 지적은 전부 고쳐야 한다 | 예외를 근거와 함께 등록한다 |
| 자동으로 고쳐 준다 | 자동 조치는 따로 구성한다 |
| 켜면 비용이 없다 | 검사 수 기준으로 붙는다 |

## 표준을 어떻게 고르는가

| 표준 | 성격 | 권장 |
| --- | --- | --- |
| 기본 모범 사례 | 폭넓은 기본 | 우선 하나만 |
| CIS 벤치마크 | 구성 강화 | 그다음 |
| 산업 규정 표준 | 해당 시 | 규정이 요구할 때 |

하나로 시작해 지적을 소화한 뒤 다음을 켜는 것이 유지된다.

## 비용은 어떻게 붙는가

| 항목 | 기준 |
| --- | --- |
| 보안 검사 | 계정·리전당 검사 수 |
| 탐지 수집 | 수집 건수 |
| 자동 대응 | 별도 서비스 비용 |

계정과 리전이 늘어날수록 검사 수가 곱해진다. 쓰지 않는 리전을 조직 정책으로 막으면 비용과 지적이 함께 줄어든다.

## 운영 방법

1. 표준 하나만 켜고 지적을 등급별로 센다
2. 치명·높음부터 처리한다
3. 의도적 설정은 예외로 등록하고 사유를 적는다
4. 반복 지적은 자동 조치로 만든다
5. 점수가 아니라 미처리 치명·높음 건수를 지표로 본다

\`\`\`bash
# 등급별 미처리 건수 — 점수보다 이 숫자가 실질적이다
aws securityhub get-findings \
  --filters '{"RecordState":[{"Value":"ACTIVE","Comparison":"EQUALS"}],"WorkflowStatus":[{"Value":"NEW","Comparison":"EQUALS"}]}' \
  --query 'Findings[].Severity.Label' --output text | tr '\t' '\n' | sort | uniq -c | sort -rn
\`\`\`

## 참고

- AWS Security Hub 사용 설명서 — 표준과 통제
- AWS Security Hub 요금 페이지
- CIS AWS Foundations Benchmark`,
    diagram: {
      type: 'layers',
      caption: '결과가 모이는 구조',
      layers: [
        { label: '설정 점검', note: '표준 항목 대비' },
        { label: '탐지 결과 수집', note: 'GuardDuty·Inspector·Macie' },
        { label: '조직 집계', note: '계정별 비교' },
        { label: '자동 대응 연결', note: 'EventBridge' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '표준 수와 운영 상태',
      x: ['예외 정리됨', '정리 안 됨'],
      y: ['표준 최소', '표준 전부'],
      cells: ['운영 가능', '실패 항목에 묻힘', '점수 관리 가능', '아무도 보지 않음'],
    },
  },
  {
    slug: 'aws-config',
    title: 'AWS Config 규칙과 설정 이력 활용',
    body: `AWS Config 는 자원의 설정이 언제 어떻게 바뀌었는지를 기록하고, 정해 둔 규칙에 맞는지 계속 평가한다. "지금 어떤 상태인가"만이 아니라 "언제부터 그랬는가"에 답할 수 있다는 점이 다른 서비스와 다르다. 사고 조사와 감사 대응에서 이 이력이 결정적인 근거가 된다.

## 무엇을 확인할 수 있는가?

| 질문 | Config 로 답하는 방법 |
| --- | --- |
| 이 보안 그룹이 언제 열렸나 | 설정 이력 타임라인 |
| 누가 바꿨나 | 이력에 연결된 CloudTrail 이벤트 |
| 규칙 위반이 몇 건인가 | 규칙 평가 결과 |
| 위반이 언제부터인가 | 준수 상태 변경 이력 |
| 지금 이 조건에 맞는 자원은 | 고급 질의 |
| 자원 간 관계는 | 관계 그래프 |

![설정 변경이 기록되고 평가되는 흐름](/img/posts/aws-config.svg)

## 켜는 순서

기록 대상과 규칙을 함께 정해야 한다. 기록만 켜면 이력은 쌓이지만 아무도 보지 않고, 규칙만 켜면 위반 시점을 알 수 없다.

\`\`\`
1. 조직 단위로 기록기 활성화 — 전 지역, 전 자원 유형
2. 전달 대상 S3 버킷을 보안 계정에 두고 삭제 방지
3. 관리형 규칙 묶음을 적용 (모범 사례 팩)
4. 위반 시 자동 조치가 필요한 항목만 자동 교정 연결
5. 준수 상태 변경을 EventBridge 로 알림
\`\`\`

## 비용은 어떻게 붙는가

세 가지 축이다.

- **기록된 설정 항목 수** — 자원이 바뀔 때마다 항목이 기록된다
- **규칙 평가 횟수** — 규칙 × 자원 × 평가 빈도
- **고급 질의와 적합성 팩** — 별도 축

주의할 점은 자주 바뀌는 자원이 비용을 끌어올린다는 것이다. 오토스케일링으로 인스턴스가 계속 생겼다 사라지면 기록 항목이 폭증한다. 그런 자원 유형을 기록 대상에서 제외하거나, 변경 기록 대신 주기적 스냅샷으로 바꾸는 선택지가 있다.

![비용을 끌어올리는 자원 유형](/img/posts/aws-config-2.svg)

## 자동 교정은 신중하게

Config 는 위반을 발견하면 자동으로 되돌릴 수 있다. 편리하지만 장애 대응 중 임시 변경까지 되돌려 상황을 악화시킬 수 있다. 되돌리기 안전한 항목만 자동으로 두고 나머지는 알림으로 처리한다.

\`\`\`
자동 교정  S3 공개 차단, 기본 암호화 해제, 로그 비활성화
알림만     보안 그룹 규칙 추가, IAM 정책 변경
보고서만   태그 누락, 이름 규칙 위반
\`\`\`

## 고급 질의가 실제로 유용하다

설정을 SQL 비슷한 문법으로 질의할 수 있다. 자산 목록을 만들거나 특정 조건의 자원을 찾을 때 콘솔을 뒤지는 것보다 빠르다.

## 바로 확인하기

기록기가 켜져 있고 실제로 전달되는지 본다.

\`\`\`bash
# 기록기 상태
aws configservice describe-configuration-recorder-status \\
  --query 'ConfigurationRecordersStatus[].{이름:name,실행중:recording,마지막상태:lastStatus}'

# 기록 대상 범위
aws configservice describe-configuration-recorders \\
  --query 'ConfigurationRecorders[].recordingGroup'
\`\`\`

위반 항목을 한 번에 뽑는다.

\`\`\`bash
aws configservice describe-compliance-by-config-rule \\
  --compliance-types NON_COMPLIANT \\
  --query 'ComplianceByConfigRules[].{규칙:ConfigRuleName,위반:Compliance.ComplianceContributorCount.CappedCount}' \\
  --output table

# 특정 조건 자원 찾기 — 공개된 보안 그룹
aws configservice select-resource-config \\
  --expression "SELECT resourceId, configuration.ipPermissions WHERE resourceType = 'AWS::EC2::SecurityGroup'" \\
  --query 'Results' --output text | head
\`\`\`

## 실제로 이렇게 터진다

전 자원 유형을 기록하도록 켜 두었다가 월 비용이 크게 늘어난 사례가 있다. 자주 바뀌는 자원이 많았고, 변경마다 항목이 기록됐다.

반대로 필요한 규칙이 없어 설정 변경을 놓친 경우도 있다. 버킷이 공개로 바뀐 것을 몇 달 뒤에 알았다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 전부 기록해야 한다 | 비용이 급증한다 |
| 규칙이 자동으로 고친다 | 보정을 따로 구성해야 한다 |
| 켜면 즉시 평가된다 | 첫 평가에 시간이 걸린다 |
| 비용은 저장 비용이다 | 기록 항목 수와 규칙 평가가 대부분이다 |
| 다른 도구와 중복이다 | 이력과 시점 조회는 여기서만 된다 |

## 무엇이 유용한가

이 서비스의 고유한 가치는 "그때 어땠는가" 에 답하는 것이다.

| 질문 | 답할 수 있는 것 |
| --- | --- |
| 침해 시점의 보안 그룹 규칙은 | 시점 조회 |
| 이 설정을 언제 누가 바꿨나 | 변경 이력 |
| 규정 위반이 언제부터인가 | 규칙 평가 이력 |
| 지금 위반 자원이 몇 개인가 | 규칙 대시보드 |

## 비용은 어떻게 붙는가

| 항목 | 기준 |
| --- | --- |
| 설정 항목 기록 | 기록된 항목 수 |
| 규칙 평가 | 평가 횟수 |
| 적합성 팩 | 규칙 수에 따라 |
| 저장 | S3 저장 비용 |

기록 항목 수가 대부분이다. 자주 바뀌는 자원 유형을 제외하면 비용이 크게 준다.

\`\`\`bash
# 무엇을 기록하고 있는지 — 전부 켜져 있으면 줄일 여지가 있다
aws configservice describe-configuration-recorders \
  --query 'ConfigurationRecorders[].recordingGroup' --output json

# 위반 자원이 많은 규칙 — 처리 우선순위
aws configservice describe-compliance-by-config-rule \
  --compliance-types NON_COMPLIANT \
  --query 'ComplianceByConfigRules[].[ConfigRuleName,Compliance.ComplianceContributorCount.CappedCount]' \
  --output text | sort -k2 -rn | head -15
\`\`\`

기록 대상을 줄일 때는 보안 관련 자원 유형을 남긴다. 보안 그룹, IAM, 버킷 정책은 이력이 가장 자주 필요하다.

## 참고

- AWS Config 개발자 안내서 — 규칙과 적합성 팩
- AWS Config 요금 페이지
- NIST SP 800-128, 설정 관리 기반 보안`,
    diagram: {
      type: 'flow',
      caption: '설정 변경이 기록되는 경로',
      steps: [
        { label: '자원 변경', note: '콘솔·API·자동화' },
        { label: '설정 항목 기록', note: '이전·이후 상태' },
        { label: '규칙 평가', note: '준수 여부 판정' },
        { label: '알림·교정', note: '위험도에 따라' },
      ],
    },
    diagram2: {
      type: 'bars',
      caption: '기록 항목을 많이 만드는 자원(경향)',
      unit: '상대값',
      items: [
        { label: '오토스케일링 인스턴스', value: 90, note: '생성·삭제 반복' },
        { label: '네트워크 인터페이스', value: 60 },
        { label: 'IAM 정책', value: 20 },
        { label: 'S3 버킷', value: 10 },
      ],
    },
  },
  {
    slug: 'aws-cloudtrail',
    title: 'CloudTrail 이벤트 종류와 보관 설계',
    body: `CloudTrail 은 누가 언제 어떤 API 를 호출했는지를 남기는 감사 로그다. 침해 조사에서 가장 먼저 찾는 자료이고, 없으면 조사 자체가 성립하지 않는다. 그런데 기본 설정만으로는 90일치 조회만 가능하고 데이터 이벤트는 아예 기록되지 않는다. 무엇을 얼마나 남길지 정하는 것이 설계의 전부다.

## 이벤트 종류를 구분한다

| 종류 | 내용 | 기본 |
| --- | --- | --- |
| 관리 이벤트 | 자원 생성·삭제, 권한 변경, 로그인 | 켜짐 |
| 데이터 이벤트 | S3 객체 읽기·쓰기, Lambda 호출 | 꺼짐 |
| 인사이트 이벤트 | 호출량 이상 패턴 | 꺼짐 |
| 네트워크 활동 이벤트 | VPC 엔드포인트 경유 호출 | 꺼짐 |

조사에서 "누가 이 파일을 가져갔나"에 답하려면 데이터 이벤트가 있어야 한다. 그런데 이것이 비용의 대부분을 차지하므로 대상을 좁혀 켜는 설계가 필요하다.

![이벤트 종류와 조사 가능 범위](/img/posts/aws-cloudtrail.svg)

## 켜는 순서

\`\`\`
1. 조직 추적(Organization Trail) 하나를 만든다 — 전 계정·전 지역
2. 전달 대상 S3 버킷은 보안 전용 계정에 둔다
3. 버킷에 객체 잠금과 버전 관리를 건다 — 침해자가 지울 수 없게
4. 로그 파일 무결성 검증을 켠다
5. 데이터 이벤트는 민감 버킷·함수만 선택적으로
6. CloudWatch Logs 로 함께 보내 탐지 규칙을 붙인다
\`\`\`

## 비용은 어떻게 붙는가

- **관리 이벤트** — 계정마다 첫 번째 사본은 무료, 추가 추적부터 건수 과금
- **데이터 이벤트** — 기록한 건수에 비례. S3 요청이 많으면 여기서 커진다
- **인사이트 이벤트** — 분석한 이벤트 건수
- **S3 저장 비용** — 로그 보관 용량
- **CloudWatch Logs 수집** — 함께 보내면 별도 과금

즉 추적을 여러 개 만들면 관리 이벤트가 중복 과금된다. 조직 추적 하나로 모으는 것이 비용 면에서도 유리하다.

![비용 축과 줄이는 지점](/img/posts/aws-cloudtrail-2.svg)

## 데이터 이벤트를 좁히는 방법

전체 버킷에 켜면 요청이 많은 로그 버킷과 정적 자산 버킷에서 비용이 폭증한다. 고급 이벤트 선택기로 특정 접두어나 특정 버킷만 대상으로 지정한다. 개인정보가 있는 버킷과 백업 버킷만 켜도 조사 목적은 대부분 달성된다.

## 보관 기간을 나눈다

즉시 조회가 필요한 최근 구간과 보관만 하는 구간을 나눈다. 수명 주기 규칙으로 오래된 로그를 저렴한 저장 클래스로 옮기면 비용이 크게 줄어든다. 다만 복원에 시간이 걸리므로 조사에 필요한 기간은 즉시 조회 가능한 곳에 둔다.

## 바로 확인하기

추적이 조직 전체를 덮고 있는지, 무결성 검증이 켜져 있는지 본다.

\`\`\`bash
aws cloudtrail describe-trails \\
  --query 'trailList[].{이름:Name,전지역:IsMultiRegionTrail,조직:IsOrganizationTrail,무결성:LogFileValidationEnabled,버킷:S3BucketName}' \\
  --output table

# 실제로 기록 중인지 (만들어만 두고 시작 안 한 경우가 있다)
for t in $(aws cloudtrail describe-trails --query 'trailList[].Name' --output text); do
  printf '%-24s ' "$t"
  aws cloudtrail get-trail-status --name "$t" --query 'IsLogging' --output text
done
\`\`\`

데이터 이벤트 설정과 로그 버킷 보호도 확인한다.

\`\`\`bash
aws cloudtrail get-event-selectors --trail-name "$TRAIL" \\
  --query 'AdvancedEventSelectors[].{이름:Name,조건:FieldSelectors[].Field}'

aws s3api get-object-lock-configuration --bucket "$LOG_BUCKET" 2>/dev/null \\
  || echo '객체 잠금 없음 — 침해자가 로그를 지울 수 있다'
\`\`\`

## 실제로 이렇게 터진다

데이터 이벤트를 켜지 않아 무엇이 유출됐는지 모른 사례가 있다. 관리 이벤트는 있었지만 버킷에서 어떤 객체를 읽었는지는 기록이 없었다. 유출 범위를 산정할 수 없었다.

로그를 같은 계정에 둔 경우도 있다. 권한을 얻은 공격자가 먼저 지웠다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 기본으로 다 기록된다 | 데이터 이벤트는 별도다 |
| 90일 이력이면 충분하다 | 조회용이고 보존이 아니다 |
| 한 리전만 켜면 된다 | 전 리전이 필요하다 |
| 같은 계정에 두면 편하다 | 함께 지워진다 |
| 비용이 많이 든다 | 관리 이벤트는 첫 사본이 무료다 |

## 무엇을 켜는가

| 항목 | 권장 |
| --- | --- |
| 범위 | 조직 전체, 전 리전 |
| 관리 이벤트 | 읽기·쓰기 모두 |
| 데이터 이벤트 | 민감 버킷·함수 선별 |
| 로그 검증 | 활성화 |
| 저장 위치 | 별도 보안 계정 |
| 객체 잠금 | 삭제 불가 기간 설정 |

데이터 이벤트를 전 버킷에 켜면 비용이 크다. 개인정보나 백업이 있는 버킷만 선별한다.

## 비용은 어떻게 붙는가

| 항목 | 기준 |
| --- | --- |
| 관리 이벤트 | 첫 사본 무료, 추가 사본 유료 |
| 데이터 이벤트 | 이벤트 수 |
| 인사이트 | 분석된 이벤트 수 |
| S3 저장 | 용량 |

데이터 이벤트가 비용의 대부분이다. 요청이 많은 버킷에 켜면 급증한다.

## 반드시 걸어야 할 경보

로깅 중지는 침해의 강한 신호다.

\`\`\`bash
# 전 리전·조직 범위이고 검증이 켜져 있는지
aws cloudtrail describe-trails \
  --query 'trailList[].[Name,IsMultiRegionTrail,IsOrganizationTrail,LogFileValidationEnabled]' \
  --output table

# 실제로 기록 중인지 — 만들어 두고 꺼 둔 경우가 있다
for t in $(aws cloudtrail describe-trails --query 'trailList[].Name' --output text); do
  printf '%-28s ' "$t"
  aws cloudtrail get-trail-status --name "$t" --query 'IsLogging' --output text
done

# 로깅 중지 이벤트 조회
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=StopLogging \
  --query 'Events[].[EventTime,Username,AwsRegion]' --output table
\`\`\`

## 참고

- AWS CloudTrail 사용 설명서 — 이벤트 유형과 선택기
- AWS CloudTrail 요금 페이지
- NIST SP 800-92, 로그 관리 지침`,
    diagram: {
      type: 'layers',
      caption: '이벤트 종류와 조사 범위',
      layers: [
        { label: '관리 이벤트', note: '누가 무엇을 만들고 지웠나' },
        { label: '데이터 이벤트', note: '어떤 객체를 읽었나' },
        { label: '인사이트', note: '호출량 이상' },
        { label: '무결성 검증', note: '로그가 조작되지 않았음' },
      ],
    },
    diagram2: {
      type: 'bars',
      caption: '비용 비중(경향)',
      unit: '상대값',
      items: [
        { label: 'S3 데이터 이벤트', value: 70, note: '요청 많은 버킷' },
        { label: 'S3 저장', value: 15 },
        { label: 'CloudWatch 수집', value: 10 },
        { label: '관리 이벤트', value: 5, note: '첫 사본 무료' },
      ],
    },
  },
  {
    slug: 'aws-inspector',
    title: 'Inspector 취약점 스캔 대상과 비용',
    body: `Inspector 는 EC2 인스턴스, 컨테이너 이미지, Lambda 함수 안의 소프트웨어 취약점을 자동으로 찾아 준다. 예전처럼 스캔을 예약하고 에이전트를 따로 관리하는 방식이 아니라, 켜 두면 새 자원이 생기거나 취약점 정보가 갱신될 때마다 계속 평가된다. 그래서 "지금 무엇이 취약한가"를 상시로 알 수 있다.

## 무엇을 확인할 수 있는가?

| 대상 | 찾는 것 |
| --- | --- |
| EC2 인스턴스 | 운영체제 패키지 취약점, 네트워크 도달성 |
| ECR 이미지 | 이미지 레이어 안의 패키지 취약점 |
| Lambda 함수 | 함수 패키지 의존성 취약점 |
| Lambda 코드 | 코드 안의 위험 패턴 |
| 네트워크 도달성 | 인터넷에서 실제로 닿는 포트 |

마지막 항목이 특히 유용하다. 취약점이 있어도 외부에서 도달할 수 없으면 우선순위가 내려간다. 도달성 정보가 있으면 조치 순서를 근거 있게 정할 수 있다.

![취약점과 도달성을 함께 본다](/img/posts/aws-inspector.svg)

## 켜는 순서

\`\`\`
1. 조직 위임 관리자 지정 후 조직 전체 활성화
2. 스캔 유형 선택 — EC2, ECR, Lambda 중 필요한 것
3. EC2 는 에이전트 없는 스캔과 에이전트 기반 중 선택
4. ECR 은 재스캔 기간 설정 (푸시 시 · 지속)
5. 결과를 Security Hub 로 모으고 심각도별 처리 경로 지정
6. 조치 불가 항목은 사유와 기한을 적어 억제
\`\`\`

## 비용은 어떻게 붙는가

대상 유형마다 축이 다르다.

- **EC2** — 스캔한 인스턴스 수 × 시간(월 단위 환산)
- **ECR** — 스캔한 이미지 수. 재스캔 정책에 따라 반복 과금
- **Lambda** — 스캔한 함수 수, 표준 스캔과 코드 스캔이 별도

ECR 이 예상보다 커지는 경우가 많다. 태그가 다른 이미지를 자주 올리면 그만큼 스캔이 늘어난다. 수명 주기 정책으로 오래된 이미지를 지우면 스캔 대상도 함께 줄어든다.

![대상별 과금 축](/img/posts/aws-inspector-2.svg)

## 도달성으로 우선순위를 정한다

심각도만 보면 조치 목록이 수백 건이 된다. 다음 순서로 좁히면 실제로 처리 가능한 크기가 된다.

\`\`\`
1순위  인터넷에서 도달 가능 + 악용 사례 존재
2순위  인터넷에서 도달 가능 + 심각도 높음
3순위  내부만 도달 + 심각도 높음
4순위  도달 불가 — 정기 패치 주기에 포함
\`\`\`

## 억제 규칙에 기한을 붙인다

지금 고칠 수 없는 항목은 억제하되, 사유와 재검토 시점을 함께 남긴다. 기한 없는 억제가 쌓이면 결과 목록이 실제 상태를 반영하지 않게 된다.

## 바로 확인하기

활성화 상태와 대상 범위를 본다.

\`\`\`bash
aws inspector2 batch-get-account-status \\
  --query 'accounts[].{계정:accountId,상태:state.status,EC2:resourceState.ec2.status,ECR:resourceState.ecr.status,Lambda:resourceState.lambda.status}' \\
  --output table
\`\`\`

도달 가능한 자원의 심각한 취약점부터 뽑는다.

\`\`\`bash
aws inspector2 list-findings \\
  --filter-criteria '{
    "severity":[{"comparison":"EQUALS","value":"CRITICAL"}],
    "exploitAvailable":[{"comparison":"EQUALS","value":"YES"}],
    "findingStatus":[{"comparison":"EQUALS","value":"ACTIVE"}]}' \\
  --query 'findings[].{자원:resources[0].id,제목:title,점수:inspectorScore}' \\
  --output table | head -20
\`\`\`

## 실제로 이렇게 터진다

취약점이 수천 건 나왔지만 무엇부터 고칠지 정하지 못한 사례가 있다. 심각도만 있고 도달 가능성 정보가 없어서, 인터넷에 노출되지 않은 서버의 원격 취약점과 노출된 서버의 것이 같은 등급으로 보였다.

컨테이너 이미지를 스캔했지만 실행 중인 것과 다른 경우도 있다. 저장소의 최신 태그를 스캔했는데 운영은 옛 다이제스트를 쓰고 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 심각도 순으로 고치면 된다 | 도달 가능성이 더 중요하다 |
| 스캔하면 다 나온다 | 에이전트가 없으면 안 나온다 |
| 이미지를 스캔하면 충분하다 | 실행 중인 것과 다를 수 있다 |
| 한 번 스캔하면 된다 | 새 취약점이 계속 나온다 |
| 비용은 스캔 횟수다 | 대상 수와 시간 기준이다 |

## 무엇을 스캔하는가

| 대상 | 방식 |
| --- | --- |
| EC2 | 에이전트 기반 또는 무에이전트 |
| 컨테이너 이미지 | 저장소 푸시 시 |
| 함수 | 코드와 의존성 |

## 비용은 어떻게 붙는가

| 대상 | 기준 |
| --- | --- |
| EC2 | 인스턴스·월 |
| 컨테이너 이미지 | 초기 스캔 + 재스캔 |
| 함수 | 함수·월 |

이미지 재스캔이 잦으면 비용이 늘어난다. 태그마다 스캔되므로 태그를 남발하지 않는 것이 도움이 된다.

## 우선순위를 어떻게 정하는가

1. 인터넷에 노출된 자원의 취약점부터
2. 그중 실제 악용이 확인된 것
3. 도달 가능성이 확인된 것 — 그 코드 경로를 쓰는가
4. 나머지는 정기 패치 주기로

\`\`\`bash
# 인터넷 노출 + 심각도 높음 — 실제 우선순위
aws inspector2 list-findings \
  --filter-criteria '{"severity":[{"comparison":"EQUALS","value":"CRITICAL"}],
                      "exploitAvailable":[{"comparison":"EQUALS","value":"YES"}]}' \
  --query 'findings[].[title,resources[0].id,inspectorScore]' --output text | head -20

# 스캔되지 않는 인스턴스 — 사각지대
aws inspector2 list-coverage \
  --filter-criteria '{"scanStatusCode":[{"comparison":"NOT_EQUALS","value":"ACTIVE"}]}' \
  --query 'coveredResources[].[resourceId,scanStatus.reason]' --output text | head -20
\`\`\`

## 참고

- Amazon Inspector 사용 설명서 — 스캔 유형과 도달성 분석
- Amazon Inspector 요금 페이지
- NIST SP 800-40, 패치 관리 계획`,
    diagram: {
      type: 'matrix',
      caption: '심각도와 도달성으로 정하는 우선순위',
      x: ['외부 도달 가능', '도달 불가'],
      y: ['심각도 높음', '낮음'],
      cells: ['즉시 조치', '정기 주기', '기한 내 조치', '기록만'],
    },
    diagram2: {
      type: 'layers',
      caption: '스캔 대상',
      layers: [
        { label: 'EC2 인스턴스', note: '운영체제 패키지' },
        { label: 'ECR 이미지', note: '푸시 시·지속 재스캔' },
        { label: 'Lambda 함수', note: '의존성과 코드' },
        { label: '네트워크 도달성', note: '우선순위 판단 근거' },
      ],
    },
  },
  {
    slug: 'aws-macie',
    title: 'Macie 로 S3 민감 데이터 찾아내기',
    body: `어떤 버킷에 개인정보가 들어 있는지 아무도 모르는 상태에서는 보호 수준을 정할 수 없다. Macie 는 S3 를 훑어 개인정보로 보이는 데이터가 어디에 얼마나 있는지 알려준다. 데이터 분류와 유출 신고 준비의 출발점이 되는 서비스인데, 훑는 양에 따라 요금이 붙으므로 대상 선정이 곧 비용 설계다.

## 무엇을 확인할 수 있는가?

| 구분 | 내용 |
| --- | --- |
| 버킷 인벤토리 | 공개 여부, 암호화, 공유 상태 |
| 민감 데이터 유형 | 주민등록번호·여권번호·카드번호·자격 증명 등 |
| 사용자 정의 유형 | 정규식으로 사내 식별자 정의 |
| 위치 정보 | 어느 객체의 어느 위치에 있는지 |
| 자동 탐색 | 계정 전체를 표본으로 상시 훑기 |

버킷 인벤토리는 별도 스캔 없이 제공되므로, 그것만으로도 공개 버킷과 암호화 누락을 먼저 잡을 수 있다.

![버킷 목록 파악에서 민감 데이터 탐색까지](/img/posts/aws-macie.svg)

## 켜는 순서

\`\`\`
1. 조직 위임 관리자 지정 후 활성화
2. 버킷 인벤토리로 공개·비암호화 버킷부터 조치
3. 자동 민감 데이터 탐색을 켜고 몇 주 관찰
4. 결과를 보고 정밀 스캔이 필요한 버킷을 고른다
5. 사내 식별자 형식을 사용자 정의 유형으로 등록
6. 결과를 Security Hub 로 모아 데이터 분류에 반영
\`\`\`

## 비용은 어떻게 붙는가

두 축이다.

- **버킷 평가** — 계정의 S3 버킷 수에 따른 월 단위 비용
- **민감 데이터 탐색** — 실제로 검사한 데이터 용량(GB)

두 번째가 큰 몫이다. 전체 버킷을 전부 스캔하면 데이터 웨어하우스나 로그 버킷 때문에 비용이 커진다. 자동 탐색은 표본만 훑으므로 부담이 작고, 정밀 스캔은 대상을 좁혀 쓰는 것이 정석이다.

![스캔 범위와 비용](/img/posts/aws-macie-2.svg)

## 비용을 줄이는 방법

- 로그·백업·정적 자산 버킷은 제외 목록에 넣는다
- 압축·미디어 파일은 검사 대상에서 뺀다
- 자동 탐색으로 먼저 후보를 좁히고 정밀 스캔은 후보만
- 접두어 단위로 대상을 지정한다

## 결과를 데이터 분류로 이어 붙인다

Macie 결과는 그 자체로 끝이 아니라 데이터 분류의 입력이다. 민감 데이터가 발견된 버킷에는 등급을 부여하고, 등급에 따라 암호화·접근 통제·보관 기간을 다르게 적용한다. 이 연결이 없으면 발견 목록만 쌓인다.

## 바로 확인하기

버킷 인벤토리에서 공개·비암호화부터 본다.

\`\`\`bash
aws macie2 describe-buckets \\
  --query 'buckets[?publicAccess.effectivePermission==\`PUBLIC\`].{버킷:bucketName,공개:publicAccess.effectivePermission,암호화:serverSideEncryption.type}' \\
  --output table

# 민감 데이터가 발견된 버킷
aws macie2 list-findings \\
  --finding-criteria '{"criterion":{"category":{"eq":["CLASSIFICATION"]}}}' \\
  --max-results 20 --query 'findingIds' --output text | tr '\\t' '\\n' | head
\`\`\`

자동 탐색이 켜져 있는지도 확인한다.

\`\`\`bash
aws macie2 get-automated-discovery-configuration \\
  --query '{상태:status,마지막갱신:lastUpdatedAt}'
\`\`\`

## 실제로 이렇게 터진다

전 버킷 스캔을 한 번 돌렸다가 청구서를 보고 놀란 사례가 있다. 로그와 백업이 들어 있는 버킷까지 포함됐고, 이들은 용량이 크고 민감정보는 없었다.

반대로 자동 탐지만 켜 두고 그 결과를 아무도 보지 않은 경우도 있다. 공개 버킷에 개인정보가 있다는 탐지가 몇 달째 열려 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 켜면 전부 스캔한다 | 자동 탐지는 표본 수준이다 |
| 스캔하면 개인정보를 지워 준다 | 알려 줄 뿐이다 |
| 한 번 돌리면 끝이다 | 새 객체가 계속 들어온다 |
| 비용은 버킷 수 기준이다 | 스캔한 용량 기준이다 |
| 한국 주민등록번호도 기본 탐지된다 | 사용자 정의 식별자가 필요하다 |

## 비용을 줄이는 순서

1. 자동 탐지로 어느 버킷에 민감정보가 있을 법한지 좁힌다
2. 그 버킷만 상세 스캔한다
3. 로그·백업·아티팩트 버킷은 제외 목록에 넣는다
4. 접두사 단위로 범위를 좁힌다
5. 이후에는 새 객체만 대상으로 하는 주기 작업으로 돌린다

## 한국 환경에서 필요한 것

기본 제공 식별자는 해외 형식 위주다. 실무에서는 사용자 정의 식별자를 만들어야 쓸 만해진다.

| 대상 | 접근 |
| --- | --- |
| 주민등록번호 | 사용자 정의 정규식 + 검증 규칙 |
| 휴대전화번호 | 사용자 정의 정규식 |
| 계좌번호 | 은행별 형식이 달라 키워드 병행 |
| 여권번호 | 사용자 정의 정규식 |

정규식만 쓰면 오탐이 많다. 근처에 나오는 키워드를 함께 요구하면 정확도가 크게 오른다.

\`\`\`bash
# 민감정보가 발견된 버킷 — 여기부터 조치한다
aws macie2 list-findings \
  --finding-criteria '{"criterion":{"category":{"eq":["CLASSIFICATION"]},"archived":{"eq":["false"]}}}' \
  --query 'findingIds' --output text | tr '\t' '\n' | head -50

# 공개 상태이면서 민감정보가 있는 버킷 — 최우선
aws macie2 describe-buckets \
  --criteria '{"publicAccess.effectivePermission":{"eq":["PUBLIC"]}}' \
  --query 'buckets[].[bucketName,sensitiveData]' --output text
\`\`\`

조치는 도구가 아니라 사람이 한다. 발견 → 담당자 → 기한을 정하지 않으면 목록만 늘어난다.

## 참고

- Amazon Macie 사용 설명서 — 관리형 데이터 식별자
- Amazon Macie 요금 페이지
- 개인정보의 안전성 확보조치 기준, 개인정보 처리 현황 파악`,
    diagram: {
      type: 'steps',
      caption: '민감 데이터 파악 순서',
      steps: [
        { label: '버킷 인벤토리', note: '공개·암호화 상태' },
        { label: '자동 탐색', note: '표본으로 후보 선별' },
        { label: '정밀 스캔', note: '후보 버킷만' },
        { label: '분류 반영', note: '등급별 통제 적용' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '스캔 범위 선택',
      x: ['대상 선별', '전체 스캔'],
      y: ['자동 탐색 병행', '정밀만'],
      cells: ['비용 대비 효과 좋음', '비용 급증', '누락 위험', '가장 비싼 방식'],
    },
  },
  {
    slug: 'aws-access-analyzer',
    title: 'IAM Access Analyzer 로 외부 공유 찾기',
    body: `정책을 사람이 읽어 "이건 외부에 열려 있다"를 판단하는 것은 어렵다. 조건과 주체가 몇 겹으로 겹치면 실제 효과가 직관과 달라지기 때문이다. Access Analyzer 는 정책을 수학적으로 분석해 신뢰 경계 밖에서 접근 가능한 자원을 찾아낸다. 추측이 아니라 증명 기반이라는 점이 다른 점검 도구와 다르다.

## 무엇을 확인할 수 있는가?

| 기능 | 내용 |
| --- | --- |
| 외부 접근 분석 | 조직·계정 밖에서 접근 가능한 자원 |
| 미사용 접근 분석 | 오래 쓰지 않은 역할·권한·키 |
| 정책 검증 | 정책 문법과 위험한 패턴 경고 |
| 사용자 지정 정책 검사 | 배포 전 정책이 기준을 넘는지 |
| 정책 생성 | 실제 사용 이력으로 최소 권한 정책 초안 |

마지막 기능이 특히 실용적이다. CloudTrail 이력을 읽어 실제로 쓴 동작만 담은 정책을 만들어 준다.

![신뢰 경계 밖에서 접근 가능한 자원](/img/posts/aws-access-analyzer.svg)

## 어떤 자원을 분석하는가

S3 버킷, IAM 역할, KMS 키, Lambda 함수, SQS 큐, Secrets Manager 비밀, ECR 저장소, EFS, RDS 스냅샷, SNS 주제 등 리소스 정책을 가질 수 있는 대부분이 대상이다. 실수로 외부에 열리기 쉬운 자원이 모두 포함된다.

## 켜는 순서

\`\`\`
1. 조직 수준 분석기를 만든다 — 신뢰 경계를 조직으로
2. 계정 수준 분석기도 함께 (계정 밖 접근 확인용)
3. 미사용 접근 분석기를 별도로 만든다
4. 결과를 Security Hub·EventBridge 로 연결
5. 의도된 공유는 아카이브 규칙으로 걸러 낸다
6. 파이프라인에 정책 검사 단계를 넣는다
\`\`\`

## 비용은 어떻게 붙는가

- **외부 접근 분석** — 무료
- **미사용 접근 분석** — 분석 대상 IAM 역할·사용자 수에 따라 월 과금
- **사용자 지정 정책 검사** — 검사 호출 건수에 따라 과금

즉 외부 공유 탐지는 비용 없이 켤 수 있다. 안 켤 이유가 없는 기능이다. 미사용 권한 정리는 대상 수에 비례하므로 계정이 많으면 규모를 가늠해 본다.

![기능별 과금 여부](/img/posts/aws-access-analyzer-2.svg)

## 배포 전 검사가 가장 효과적이다

사후에 찾는 것보다 배포 전에 막는 편이 낫다. 인프라 코드 파이프라인에 정책 검사를 넣어, 기준보다 넓은 정책이 들어오면 병합을 막는다. 기준 정책을 하나 정해 두고 그것보다 넓어지는지만 보면 된다.

## 의도된 공유를 구분한다

외부와 공유하는 것이 정상인 자원도 있다. 그런 항목을 매번 확인하면 실제 이상을 놓친다. 아카이브 규칙으로 알려진 공유를 자동 정리하되, 규칙에 사유를 적어 두고 정기적으로 다시 본다.

## 바로 확인하기

분석기가 있는지, 외부 접근 결과가 있는지 본다.

\`\`\`bash
aws accessanalyzer list-analyzers \\
  --query 'analyzers[].{이름:name,유형:type,상태:status}' --output table

ARN=$(aws accessanalyzer list-analyzers --query 'analyzers[0].arn' --output text)
aws accessanalyzer list-findings-v2 --analyzer-arn "$ARN" \\
  --filter '{"status":{"eq":["ACTIVE"]}}' \\
  --query 'findings[].{자원:resource,유형:resourceType,주체:findingType}' --output table | head -20
\`\`\`

정책이 기준보다 넓은지 배포 전에 검사한다.

\`\`\`bash
aws accessanalyzer check-no-new-access \\
  --new-policy-document file://new-policy.json \\
  --existing-policy-document file://baseline-policy.json \\
  --policy-type IDENTITY_POLICY \\
  --query '{결과:result,이유:reasons[].description}'
# result 가 FAIL 이면 기준보다 넓은 권한이 추가된 것이다
\`\`\`

## 실제로 이렇게 터진다

외부 공유 탐지가 켜져 있었지만 신뢰 영역을 계정 하나로 잡아 둔 사례가 있다. 조직 내 다른 계정과의 공유가 전부 "외부" 로 잡혀 수백 건이 나왔고, 진짜 외부 공유가 그 속에 묻혔다.

미사용 권한 분석을 돌리지 않아, 붙여 두고 한 번도 쓰지 않은 관리자 권한이 몇 년째 남은 경우도 있다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 외부 공유만 본다 | 미사용 권한 분석도 있다 |
| 신뢰 영역은 기본값이면 된다 | 조직으로 잡아야 잡음이 준다 |
| 결과가 없으면 안전하다 | 분석 대상 유형이 한정적이다 |
| 정책 검증은 배포 후에 한다 | 배포 전에 부를 수 있다 |
| 무료다 | 외부 공유는 무료, 미사용 분석은 유료 |

## 두 가지 분석의 성격

| 분석 | 답하는 질문 | 비용 |
| --- | --- | --- |
| 외부 공유 | 우리 자원을 밖에서 쓸 수 있나 | 무료 |
| 미사용 권한 | 붙여 둔 권한 중 안 쓰는 것은 | 역할 수 기준 유료 |

외부 공유 분석은 조직 단위로 하나 만들고 신뢰 영역을 조직으로 잡는다. 그러면 진짜 외부만 남는다.

## 배포 전 검증에 쓰기

정책 검증 기능은 파이프라인에 넣을 수 있다. 사람이 리뷰하기 전에 명백한 문제를 걸러 준다.

\`\`\`bash
# 정책 파일 검증 — 오류·보안 경고를 배포 전에 잡는다
aws accessanalyzer validate-policy \
  --policy-type IDENTITY_POLICY \
  --policy-document file://policy.json \
  --query 'findings[].[findingType,issueCode,findingDetails]' --output text | grep -v SUGGESTION

# 외부 공유 결과 — 신뢰 영역 밖에서 접근 가능한 자원
aws accessanalyzer list-findings-v2 --analyzer-arn "$ARN" \
  --filter '{"status":{"eq":["ACTIVE"]}}' \
  --query 'findings[].[resourceType,resource]' --output text | sort | uniq -c | sort -rn
\`\`\`

정책 검증에서 SUGGESTION 을 제외한 이유는, 제안까지 막으면 파이프라인이 자주 멈춰서 결국 검증을 끄게 되기 때문이다. 오류와 보안 경고만 차단 조건으로 둔다.

## 참고

- AWS IAM Access Analyzer 사용 설명서
- AWS IAM 요금 페이지 — Access Analyzer 항목
- NIST SP 800-53, AC-6 최소 권한`,
    diagram: {
      type: 'flow',
      caption: '정책 분석 흐름',
      steps: [
        { label: '신뢰 경계 지정', note: '조직 또는 계정' },
        { label: '리소스 정책 분석', note: '조건까지 계산' },
        { label: '외부 접근 식별', note: '증명 기반' },
        { label: '아카이브·조치', note: '의도된 공유 구분' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '기능과 비용',
      x: ['무료', '유료'],
      y: ['상시 운영', '필요 시'],
      cells: ['외부 접근 분석', '미사용 접근 분석', '정책 검증', '배포 전 검사'],
    },
  },
  {
    slug: 'aws-detective',
    title: 'AWS Detective 로 침해사고 조사하기',
    body: `탐지 결과 하나를 받았을 때 실제로 필요한 것은 "이 자격 증명이 최근 무엇을 했는가", "이 아이피가 언제부터 나타났는가" 같은 맥락이다. 이것을 로그를 직접 질의해 만들려면 시간이 오래 걸린다. AWS Detective 는 CloudTrail·흐름 로그·GuardDuty 결과를 미리 이어 붙여 그 맥락을 그래프로 보여준다. 침해사고 대응에서 초동 조치의 범위를 정하는 데 쓴다.

## 무엇을 확인할 수 있는가?

| 질문 | Detective 가 답하는 방식 |
| --- | --- |
| 이 역할이 평소와 다르게 행동했나 | 기간별 API 호출 프로필 |
| 이 아이피는 언제부터 나타났나 | 최초 관측 시점과 빈도 |
| 이 자격 증명이 어디서 쓰였나 | 지역·자원·호출 목록 |
| 관련된 다른 자원은 | 개체 간 연결 그래프 |
| 언제부터 이상했나 | 기준선 대비 변화 |

![탐지 결과에서 맥락으로](/img/posts/aws-detective.svg)

## 켜는 순서

GuardDuty 가 이미 켜져 있어야 의미가 있다. 탐지와 조사는 짝이다.

\`\`\`
1. GuardDuty 를 먼저 켜고 최소 48시간 데이터 축적
2. 보안 계정을 위임 관리자로 지정
3. 조직 전체 계정을 그래프에 포함
4. GuardDuty 결과에서 Detective 로 넘어가는 경로 확인
5. 대응 절차서에 "Detective 에서 확인할 것" 항목 추가
\`\`\`

## 비용은 어떻게 붙는가

**수집해 분석한 데이터 양(GB)** 에 비례한다. 원본은 이미 있는 CloudTrail·흐름 로그·GuardDuty 결과이므로 추가로 로그를 만들 필요는 없지만, 분석 대상 양이 곧 비용이다.

트래픽이 큰 계정을 모두 포함하면 비용이 빠르게 늘어난다. 처음에는 운영 계정과 보안 계정만 넣고, 필요에 따라 넓히는 방식이 무난하다. 30일 무료 평가 기간에 예상 비용이 표시되므로 그 값을 보고 결정한다.

![포함 계정과 분석량](/img/posts/aws-detective-2.svg)

## 침해사고 대응에서 언제 쓰는가?

상시로 들여다보는 도구가 아니다. 다음 순간에 꺼내 쓴다.

- GuardDuty 에서 심각한 탐지가 떴을 때
- 자격 증명 유출이 의심될 때
- 이상한 아이피가 로그에 보일 때
- 침해사고 조사에서 시간 순서를 재구성할 때

## 한계를 알고 쓴다

Detective 는 AWS 안의 활동만 본다. 애플리케이션 내부 로그, 데이터베이스 조회 내역, 사내 시스템 활동은 포함되지 않는다. 조사 전체를 여기서 끝낼 수는 없고, 클라우드 구간의 맥락을 빠르게 얻는 도구로 봐야 한다.

## 바로 확인하기

그래프가 만들어져 있고 계정이 포함됐는지 본다.

\`\`\`bash
aws detective list-graphs --query 'GraphList[].Arn' --output text
GRAPH=$(aws detective list-graphs --query 'GraphList[0].Arn' --output text)

aws detective list-members --graph-arn "$GRAPH" \\
  --query 'MemberDetails[].{계정:AccountId,상태:Status,볼륨:VolumeUsageInBytes}' --output table
\`\`\`

조사 대상 개체를 바로 열 수 있게 절차서에 링크 형식을 적어 둔다.

\`\`\`
GuardDuty 탐지 → 결과 상세 → "Detective 에서 조사" 링크
또는 개체 검색: 역할 이름 · 액세스 키 ID · 아이피 주소 · 인스턴스 ID
\`\`\`

## 실제로 이렇게 터진다

침해 조사 때 로그를 직접 뒤지느라 며칠이 걸린 사례가 있다. 어떤 자격 증명이 어디서 언제 무엇을 했는지를 손으로 이어 붙였다. 그래프를 미리 켜 두었다면 몇 분에 끝날 일이었다.

문제는 사후에 켜도 소용이 적다는 것이다. 이력은 켠 시점부터 쌓인다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 사고가 나면 그때 켜면 된다 | 이력이 없어 쓸모가 적다 |
| 탐지 도구를 대체한다 | 탐지가 아니라 조사 도구다 |
| 로그를 대신 보관한다 | 보관은 별도로 해야 한다 |
| 켜면 바로 쓸 수 있다 | 데이터가 쌓이는 데 시간이 걸린다 |
| 비용이 크다 | 처리 로그 GB 기준이다 |

## 언제 값을 하는가

| 상황 | 도움 정도 |
| --- | --- |
| 자격 증명 오남용 조사 | 매우 높음 |
| 어떤 자원이 연루됐나 | 높음 |
| 평소 대비 이상한가 | 높음 — 기준선을 갖고 있다 |
| 실시간 차단 | 없음 |
| 규정 증적 | 낮음 — 다른 도구가 맞다 |

## 운영 전제

1. 탐지 서비스를 먼저 켠다 — 조사 진입점이 거기서 온다
2. 조직 단위로 켜서 계정 간 이동을 추적할 수 있게 한다
3. 관리 계정이 아닌 보안 계정을 관리자로 지정한다
4. 조사 담당자에게 읽기 권한을 미리 준다 — 사고 때 권한 요청부터 하면 늦다

\`\`\`bash
# 그래프가 있는지, 어느 계정이 들어와 있는지
aws detective list-graphs --query 'GraphList[].Arn' --output text

aws detective list-members --graph-arn "$G" \
  --query 'MemberDetails[].[AccountId,Status]' --output table
\`\`\`

조사 도구는 평시에 만져 봐야 사고 때 쓸 수 있다. 분기에 한 번 모의 조사로 손에 익혀 두는 것이 실질적이다.

## 참고

- Amazon Detective 사용 설명서
- Amazon Detective 요금 페이지
- NIST SP 800-61, 사고 처리 지침`,
    diagram: {
      type: 'flow',
      caption: '탐지에서 조사까지',
      steps: [
        { label: 'GuardDuty 탐지', note: '무엇이 이상한가' },
        { label: 'Detective 로 이동', note: '개체 중심 조회' },
        { label: '기준선 대비 확인', note: '언제부터 달라졌나' },
        { label: '범위 확정', note: '관련 자원 식별' },
      ],
    },
    diagram2: {
      type: 'bars',
      caption: '조사 소요 시간(경향)',
      unit: '상대값',
      items: [
        { label: '로그 직접 질의', value: 100, note: '질의 작성부터' },
        { label: '로그 도구 + 대시보드', value: 55 },
        { label: 'Detective', value: 20, note: '미리 연결된 그래프' },
      ],
    },
  },
  {
    slug: 'aws-security-lake',
    title: 'Security Lake 로 로그 형식 통일하기',
    body: `보안 로그는 서비스마다 형식이 다르고, 사내 시스템 로그까지 더하면 질의 하나 쓰는 데도 형식을 맞추는 작업이 먼저 필요하다. Security Lake 는 이 로그들을 공통 형식으로 바꿔 한 곳에 모아 준다. 도구를 바꿔도 데이터는 남는다는 점이 이 방식의 가장 큰 이점이다.

## 무엇을 해결하는가?

| 문제 | Security Lake 적용 후 |
| --- | --- |
| 서비스마다 다른 형식 | 공통 스키마로 정규화 |
| 계정·지역별 흩어진 로그 | 한 계정으로 집약 |
| 도구 종속 | 원본은 우리 S3 에 남는다 |
| 보관 비용 | 수명 주기로 단계 관리 |
| 접근 통제 | 구독자별 권한 분리 |

![형식이 다른 로그를 공통 스키마로](/img/posts/aws-security-lake.svg)

## 어떤 원본을 넣을 수 있는가

AWS 쪽은 CloudTrail, VPC 흐름 로그, Route 53 질의 로그, Security Hub 결과, EKS 감사 로그 등이 기본 지원된다. 사내 시스템이나 다른 클라우드의 로그도 공통 스키마로 변환해 넣을 수 있다. 이 확장성이 핵심이다.

## 켜는 순서

\`\`\`
1. 보안 전용 계정에 데이터 레이크 생성
2. 롤업 지역을 정해 다지역 로그를 한 곳으로 모음
3. AWS 원본 선택 — 필요한 것부터 (전부 켜지 않는다)
4. 보관 수명 주기 설정 — 즉시 조회 구간과 보관 구간 분리
5. 구독자 등록 — 분석 도구·사내 조회 도구에 권한 부여
6. 사내 로그는 공통 스키마로 변환해 사용자 원본으로 추가
\`\`\`

## 비용은 어떻게 붙는가

Security Lake 자체는 **수집·정규화한 데이터 양(GB)** 으로 과금된다. 여기에 더해 다음이 별도로 붙는다.

- S3 저장 비용 — 보관 기간과 저장 클래스에 따라
- 조회 비용 — Athena 등으로 질의할 때 스캔한 양
- 원본 로그 생성 비용 — 흐름 로그·CloudTrail 자체 비용은 별도

즉 로그를 많이 만들수록 세 겹으로 비용이 붙는다. 무엇을 수집할지 정하는 것이 곧 비용 설계다.

![세 겹으로 붙는 비용](/img/posts/aws-security-lake-2.svg)

## 파티션과 형식이 조회 비용을 정한다

공통 스키마는 열 기반 형식으로 저장되고 날짜·지역·계정으로 분할된다. 질의할 때 분할 조건을 걸면 스캔량이 크게 줄어든다. 조건 없이 전체를 훑는 질의 하나가 한 달치 조회 비용을 쓸 수 있다.

## 언제 도입할 가치가 있는가

계정이 몇 개 안 되고 로그가 적으면 굳이 필요 없다. 계정이 여러 개이고, 여러 도구가 같은 로그를 봐야 하고, 도구 교체 가능성이 있을 때 값을 한다. 규모가 작다면 CloudTrail 을 S3 에 모으고 Athena 로 질의하는 것으로 충분하다.

## 바로 확인하기

레이크가 만들어졌는지와 수집 중인 원본을 본다.

\`\`\`bash
aws securitylake list-data-lakes --regions ap-northeast-2 \\
  --query 'dataLakes[].{지역:region,상태:createStatus,버킷:s3BucketArn}'

aws securitylake list-log-sources \\
  --query 'sources[].{계정:account,원본:sources[].sourceName}' --output json | head -30
\`\`\`

조회 비용을 줄이는 질의 형태를 정해 둔다.

\`\`\`sql
-- 분할 조건 없이 전체를 훑으면 스캔량이 폭증한다
SELECT time, api.operation, actor.user.uid, src_endpoint.ip
  FROM amazon_security_lake_table_ap_northeast_2_cloud_trail_mgmt_2_0
 WHERE eventday BETWEEN '20260901' AND '20260903'   -- 반드시 기간 조건
   AND api.operation = 'ConsoleLogin'
   AND actor.user.type = 'Root'
 LIMIT 100;
\`\`\`

## 실제로 이렇게 터진다

로그를 여러 계정과 리전에 흩어 둔 채로 조사한 사례가 있다. 같은 사건을 보려고 계정을 넘나들며 쿼리를 다시 짰다. 형식도 서비스마다 달라 시간 대부분이 정규화에 들어갔다.

반대로 전부 모았지만 보존 정책을 안 걸어 저장 비용이 계속 늘어난 경우도 있다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 모으면 분석이 된다 | 질의 도구가 따로 필요하다 |
| 모든 로그가 지원된다 | 지원 소스가 정해져 있다 |
| 형식 변환을 직접 해야 한다 | 표준 스키마로 정규화된다 |
| 비용은 저장뿐이다 | 변환·질의 비용이 붙는다 |
| 다른 도구를 대체한다 | 저장·정규화 계층이다 |

## 무엇이 좋아지는가

| 이전 | 이후 |
| --- | --- |
| 서비스마다 다른 형식 | 표준 스키마 하나 |
| 계정별 개별 조회 | 한곳에서 질의 |
| 보존 정책 제각각 | 계층별 일괄 정책 |
| 외부 도구 연동 개별 구현 | 구독자 방식으로 연결 |

## 비용 관리

| 항목 | 조절 방법 |
| --- | --- |
| 수집 | 필요한 소스만 |
| 저장 | 보존 기간·계층 전환 |
| 질의 | 파티션 활용 |
| 구독 | 필요한 구독자만 |

시간 파티션을 쓰지 않는 질의가 비용의 주범이다. 조사할 때도 기간을 먼저 좁히는 습관이 필요하다.

\`\`\`bash
# 어떤 소스를 모으고 있는지
aws securitylake list-log-sources \
  --query 'sources[].[account,sourceTypes[].awsLogSource.sourceName]' --output text

# 보존 정책이 걸려 있는지 — 안 걸려 있으면 비용이 계속 는다
aws securitylake list-data-lakes \
  --query 'dataLakes[].[region,lifecycleConfiguration.expiration.days]' --output table
\`\`\`

먼저 조사에 실제로 쓰는 소스 서너 개로 시작하고, 질의 패턴이 정착한 뒤 넓히는 편이 낫다.

## 참고

- Amazon Security Lake 사용 설명서
- Open Cybersecurity Schema Framework (OCSF) 규격
- Amazon Security Lake 요금 페이지`,
    diagram: {
      type: 'flow',
      caption: '로그가 모이는 경로',
      steps: [
        { label: '여러 원본', note: 'AWS·사내·타 클라우드' },
        { label: '공통 스키마 변환', note: '형식 통일' },
        { label: '보안 계정 S3', note: '분할 저장' },
        { label: '구독자 조회', note: '도구는 바꿔도 데이터는 남는다' },
      ],
    },
    diagram2: {
      type: 'layers',
      caption: '비용이 붙는 층',
      layers: [
        { label: '원본 로그 생성', note: '흐름 로그·CloudTrail' },
        { label: '수집·정규화', note: 'Security Lake 과금' },
        { label: 'S3 저장', note: '보관 기간·클래스' },
        { label: '조회 스캔', note: '질의 조건에 좌우' },
      ],
    },
  },
  {
    slug: 'aws-audit-manager',
    title: 'Audit Manager 로 증적 자동 수집하기',
    body: `감사 통보를 받고 증적을 모으기 시작하면 몇 주가 사라진다. 문제는 증적이 없는 것이 아니라 흩어져 있고, 그것이 어느 통제 항목에 해당하는지 매번 사람이 판단해야 한다는 점이다. Audit Manager 는 통제 항목마다 어떤 자료가 증적이 되는지 미리 연결해 두고, 그 자료를 자동으로 계속 모은다.

## 무엇을 확인할 수 있는가?

| 기능 | 내용 |
| --- | --- |
| 프레임워크 | 표준 통제 목록 (규정별 사전 정의) |
| 자동 증적 수집 | Config·CloudTrail·Security Hub 결과 연결 |
| 수동 증적 | 문서·화면 캡처 업로드 |
| 평가 보고서 | 통제별 증적 묶음 |
| 위임 검토 | 담당자에게 통제 단위로 배정 |
| 변경 이력 | 증적의 시점과 출처 기록 |

![통제 항목과 증적의 연결](/img/posts/aws-audit-manager.svg)

## 켜는 순서

\`\`\`
1. Config·CloudTrail·Security Hub 를 먼저 켠다 — 증적 원천
2. 대상 프레임워크 선택 (또는 사내 통제로 사용자 정의)
3. 평가 생성 — 범위 계정과 서비스 지정
4. 통제별 담당자 위임
5. 자동 수집되지 않는 항목은 수동 증적 절차 지정
6. 주기적으로 보고서 생성해 상태 확인
\`\`\`

## 비용은 어떻게 붙는가

**수집한 증적 건수** 기준으로 과금된다. 평가 범위가 넓고 계정이 많을수록 증적이 많이 쌓인다. 또한 원천이 되는 Config 와 CloudTrail 비용이 별도로 든다는 점을 함께 봐야 한다.

즉 실제 비용은 세 곳에서 나온다. 원천 서비스 비용, Audit Manager 증적 수집 비용, 증적을 담는 S3 저장 비용이다. 평가를 여러 개 동시에 돌리면 같은 증적이 중복 수집될 수 있으므로 필요한 평가만 활성 상태로 둔다.

![비용이 나오는 세 곳](/img/posts/aws-audit-manager-2.svg)

## 사내 통제를 사용자 정의로 만든다

표준 프레임워크가 우리 상황과 맞지 않는 경우가 많다. 사내 보안 정책의 통제 항목을 그대로 사용자 정의 프레임워크로 만들고, 각 항목에 어떤 자료가 증적이 되는지 연결하면 내부 점검에도 쓸 수 있다.

## 자동화되지 않는 항목이 남는다

교육 이수 기록, 계약서, 물리 보안, 사람이 하는 절차는 자동 수집되지 않는다. 이런 항목은 수동 증적으로 등록하되, 누가 언제 올리는지 주기를 정해 두어야 감사 직전에 몰리지 않는다.

## 바로 확인하기

평가가 돌고 있는지와 증적이 쌓이는지 본다.

\`\`\`bash
aws auditmanager get-assessment --assessment-id "$ASSESSMENT_ID" \\
  --query 'assessment.metadata.{이름:name,상태:status,범위계정:scope.awsAccounts[].id}'

# 통제별 증적 수집 상태
aws auditmanager get-evidence-folders-by-assessment \\
  --assessment-id "$ASSESSMENT_ID" --max-results 20 \\
  --query 'evidenceFolders[].{통제:controlName,증적수:totalEvidence,평가:assessmentReportSelectionCount}' \\
  --output table
\`\`\`

증적이 0인 통제를 찾아 수동 절차를 정한다.

\`\`\`bash
aws auditmanager get-evidence-folders-by-assessment \\
  --assessment-id "$ASSESSMENT_ID" --max-results 100 \\
  --query 'evidenceFolders[?totalEvidence==\`0\`].controlName' --output text | tr '\\t' '\\n'
\`\`\`

## 실제로 이렇게 터진다

감사 대응을 매번 손으로 한 사례가 있다. 스크린샷을 찍고 표를 만들고, 감사가 끝나면 그 자료는 버려졌다. 다음 감사 때 같은 일을 처음부터 다시 했다.

반대로 자동 수집을 켜 두었지만 증적이 무엇을 뜻하는지 아무도 설명하지 못한 경우도 있다. 감사인은 자동 수집 자체를 신뢰하지 않았다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 켜면 감사를 통과한다 | 증적을 모을 뿐이다 |
| 모든 통제가 자동 수집된다 | 상당수는 수동 증적이다 |
| 감사인이 그대로 받는다 | 설명이 붙어야 받는다 |
| 프레임워크는 그대로 쓴다 | 우리 환경에 맞게 손봐야 한다 |
| 비용이 없다 | 평가·증적 수집 기준으로 붙는다 |

## 자동과 수동의 경계

| 통제 성격 | 수집 |
| --- | --- |
| 설정 상태 | 자동 |
| 접근 기록 | 자동 |
| 취약점 조치 | 자동 |
| 정책 문서 존재 | 수동 |
| 교육 실시 | 수동 |
| 책임자 승인 | 수동 |

자동으로 채워지는 것은 절반 정도다. 나머지를 누가 언제 올릴지 정하지 않으면 감사 직전에 몰린다.

## 실질적인 운영

1. 대상 규정 하나로 시작한다
2. 자동 수집되는 통제와 수동 통제를 나눈다
3. 수동 통제마다 담당자와 주기를 정한다
4. 매달 미수집 통제를 점검한다 — 감사 직전이 아니라
5. 증적마다 한 줄 설명을 붙인다

\`\`\`bash
# 진행 중 평가와 미수집 통제 — 매달 이 숫자를 본다
aws auditmanager get-assessment --assessment-id "$A" \
  --query 'assessment.framework.controlSets[].controls[].[name,response]' \
  --output text | grep -c MANUAL
\`\`\`

감사는 한 달 작업이 아니라 상시 상태 관리다. 도구는 그 전환을 도울 뿐, 대신해 주지 않는다.

## 참고

- AWS Audit Manager 사용 설명서 — 프레임워크와 증적
- AWS Audit Manager 요금 페이지
- ISO/IEC 27001 및 ISMS-P 인증 기준`,
    diagram: {
      type: 'steps',
      caption: '증적이 쌓이는 과정',
      steps: [
        { label: '통제 목록 선택', note: '표준 또는 사내 정의' },
        { label: '증적 원천 연결', note: 'Config·CloudTrail·Security Hub' },
        { label: '자동 수집', note: '상시 축적' },
        { label: '보고서 생성', note: '감사 시 꺼내 쓴다' },
      ],
    },
    diagram2: {
      type: 'bars',
      caption: '감사 준비 소요(경향)',
      unit: '상대값',
      items: [
        { label: '통보 후 수집', value: 100, note: '몇 주' },
        { label: '수동 상시 축적', value: 45 },
        { label: '자동 증적 수집', value: 15, note: '꺼내는 작업만' },
      ],
    },
  },
]
