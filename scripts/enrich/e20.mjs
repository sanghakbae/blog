const R = String.raw
export default {

'aws-guardduty': R`## 실제로 이렇게 터진다

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
\`\`\``,

'aws-security-hub': R`## 실제로 이렇게 터진다

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
\`\`\``,

'aws-config': R`## 실제로 이렇게 터진다

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

기록 대상을 줄일 때는 보안 관련 자원 유형을 남긴다. 보안 그룹, IAM, 버킷 정책은 이력이 가장 자주 필요하다.`,

'aws-cloudtrail': R`## 실제로 이렇게 터진다

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
\`\`\``,

'aws-inspector': R`## 실제로 이렇게 터진다

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
\`\`\``,
}
