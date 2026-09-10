const R = String.raw
export default {

'landing-zone-design': R`## 지금 상태 확인

이미 계정이 여럿이라면 현재 구조를 먼저 그린다.

\`\`\`bash
aws organizations list-accounts --query 'Accounts[].[Id,Name,Status]' --output table
aws organizations list-roots --query 'Roots[0].Id' --output text \
  | xargs -I{} aws organizations list-organizational-units-for-parent --parent-id {} \
      --query 'OrganizationalUnits[].Name' --output text
\`\`\`

조직 단위가 없거나 하나뿐이면 정책을 차등 적용할 수 없는 상태다. 환경별로 단위를 만드는 것부터 시작한다. 계정을 옮기는 것은 자원 이동 없이 되므로 구조 정리는 지금도 가능하다.`,

'cloud-network-segmentation': R`## 실제 통신 수집

규칙을 좁히기 전에 무엇이 실제로 오가는지 본다.

\`\`\`bash
aws logs start-query --log-group-name /aws/vpc/flowlogs \
  --start-time $(($(date +%s) - 604800)) --end-time $(date +%s) \
  --query-string 'fields srcaddr, dstaddr, dstport
                  | filter action = "ACCEPT"
                  | stats count() by srcaddr, dstaddr, dstport
                  | sort count desc | limit 100'
\`\`\`

일주일 치를 모으면 실제 통신 관계도가 나온다. 이 목록에 없는 규칙이 정리 대상이다. 반대로 목록에 있는데 규칙이 없으면 다른 경로로 통신하고 있다는 뜻이므로 확인이 필요하다.`,

'iam-policy-review': R`## 사용 기록 집계

줄이기 전에 실제 호출을 본다. 기간은 최소 90일, 가능하면 1년으로 잡는다.

\`\`\`bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue="$ROLE" \
  --start-time "$(date -u -v-90d +%Y-%m-%dT%H:%M:%SZ)" --max-items 5000 \
  --query 'Events[].EventName' --output text \
  | tr '\t' '\n' | sort | uniq -c | sort -rn
\`\`\`

여기 나오지 않는 동작이 축소 대상이다. 다만 분기·연간 작업이 빠질 수 있으므로 새 정책을 감사 모드로 먼저 적용해 거부될 호출을 확인한다.`,

'cloud-storage-public-check': R`## 공개 노출 전수 점검

버킷 단위와 객체 단위를 함께 본다.

\`\`\`bash
for b in $(aws s3api list-buckets --query 'Buckets[].Name' --output text); do
  blk=$(aws s3api get-public-access-block --bucket "$b" \
        --query 'PublicAccessBlockConfiguration.BlockPublicAcls' --output text 2>/dev/null)
  pol=$(aws s3api get-bucket-policy-status --bucket "$b" \
        --query 'PolicyStatus.IsPublic' --output text 2>/dev/null)
  [ "$blk" != "True" ] || [ "$pol" = "True" ] && printf '%-40s 차단=%s 공개정책=%s\n' "$b" "$blk" "$pol"
done
\`\`\`

출력이 있으면 조치 대상이다. 조직 정책으로 공개를 금지하면 이 점검이 예외 확인용으로 바뀐다.`,

'serverless-permission-model': R`## 과도한 권한 함수 찾기

함수 수가 많으면 손으로 볼 수 없다. 역할에 붙은 정책을 훑는다.

\`\`\`bash
aws lambda list-functions --query 'Functions[].[FunctionName,Role]' --output text \
| while read -r fn role; do
    aws iam list-attached-role-policies --role-name "$(basename "$role")" \
      --query 'AttachedPolicies[].PolicyName' --output text 2>/dev/null \
      | grep -qiE 'admin|fullaccess|poweruser' && echo "$fn"
  done
\`\`\`

나온 함수부터 권한을 좁힌다. 같은 역할을 여러 함수가 공유하고 있다면 분리가 먼저다. 배포 도구가 함수 정의에서 권한을 도출하도록 바꾸면 이후에는 자동으로 유지된다.`,

'multi-account-guardrails': R`## 위반 현황 먼저

정책을 강제하기 전에 지금 얼마나 어긋나 있는지 센다.

\`\`\`bash
aws configservice describe-compliance-by-config-rule \
  --compliance-types NON_COMPLIANT \
  --query 'ComplianceByConfigRules[].[ConfigRuleName,Compliance.ComplianceContributorCount.CappedCount]' \
  --output text | sort -k2 -rn
\`\`\`

위반이 많은 규칙부터 팀과 협의한다. 위반 0인 규칙은 바로 강제로 전환해도 된다. 이 숫자를 매주 보면 정리 진행 상황이 보인다.`,

'infrastructure-drift': R`## 매일 검사하기

어긋남은 생긴 날 발견해야 원인을 찾을 수 있다.

\`\`\`bash
terraform plan -detailed-exitcode -no-color > /tmp/plan.txt 2>&1
case $? in
  0) echo '일치' ;;
  2) echo '어긋남'; grep -E '^\s*[~+-]' /tmp/plan.txt | head -30 ;;
  *) echo '오류'; tail -20 /tmp/plan.txt ;;
esac
\`\`\`

정기 작업으로 돌리고 어긋남이 생기면 알림을 받는다. 감사 로그와 대조하면 누가 언제 무엇을 바꿨는지도 알 수 있다.`,

'cloud-incident-isolation': R`## 격리 준비물

사고 시점에 만들면 늦다. 미리 만들고 절차서에 명령을 그대로 적어 둔다.

\`\`\`bash
# 격리용 보안 그룹 — 아웃바운드 없음
SG=$(aws ec2 create-security-group --group-name quarantine \
      --description 'incident isolation' --vpc-id "$VPC" \
      --query GroupId --output text)
aws ec2 revoke-security-group-egress --group-id "$SG" \
  --protocol -1 --port -1 --cidr 0.0.0.0/0
\`\`\`

조사자 주소에서의 인바운드만 열어 둔다. 격리 시에는 인스턴스의 보안 그룹을 이것으로 교체하면 되고, 종료하지 않으므로 메모리가 남는다.`,

'cloud-log-cost-control': R`## 비용 구성 확인

무엇이 비용을 만드는지 보고 줄일 곳을 정한다.

\`\`\`bash
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -v-30d +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY --metrics UnblendedCost \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon CloudWatch"]}}' \
  --group-by Type=DIMENSION,Key=USAGE_TYPE \
  --query 'ResultsByTime[0].Groups[].[Keys[0],Metrics.UnblendedCost.Amount]' --output text \
  | sort -k2 -rn | head
\`\`\`

수집과 색인이 상위에 있으면 계층 분리로 줄일 수 있다. 저장이 상위면 보존 기간을 본다.`,

'shared-responsibility-gaps': R`## 도입 시 확인표

서비스마다 이 표를 채운다. 빈칸이 남으면 그것이 사각지대다.

| 항목 | 누가 | 확인한 방법 |
| --- | --- | --- |
| 백업 주체·기간 |  | 복원 시험 |
| 패치 주체·주기 |  | 문서·공지 |
| 로그 보존·접근 |  | 실제 조회 |
| 암호화 기본값 |  | 설정 확인 |
| 계정 회수 |  | 절차 확인 |
| 사고 통지 기한 |  | 계약 조항 |

세 번째 열이 비어 있으면 문서만 읽은 것이다. 백업은 복원해 보고, 로그는 실제로 조회해 봐야 확인한 것이다.`,
}
