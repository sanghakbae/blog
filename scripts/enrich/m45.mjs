const R = String.raw
export default {

'dns-security-operations': R`## 방치 레코드 찾기

가리키는 대상이 사라진 레코드가 선점 위험을 만든다.

\`\`\`bash
# CNAME 대상이 응답하지 않는 레코드
while read -r name type value; do
  [ "$type" = "CNAME" ] || continue
  host "$value" >/dev/null 2>&1 || echo "대상 없음: $name -> $value"
done < records.txt

# 인증서 기록으로 우리가 모르는 하위 도메인 확인
curl -s "https://crt.sh/?q=%25.example.com&output=json" \
  | python3 -c 'import json,sys;print("\n".join(sorted({r["name_value"] for r in json.load(sys.stdin)})))' | head -30
\`\`\`

인증서 기록에서 목록에 없는 이름이 나오면 관리 밖 자산이다. 서비스를 내릴 때 레코드도 함께 지우는 절차를 만든다.`,

'bastion-host-operations': R`## 우회 경로 찾기

점프 서버를 만들었다고 그 경로만 쓰는 것은 아니다.

\`\`\`bash
# 관리 포트가 점프 서버 외에서도 열려 있는지
aws ec2 describe-security-groups \
  --query 'SecurityGroups[].[GroupId,GroupName,IpPermissions]' --output json \
  | jq -r '.[] | select(.[2][]?.ToPort == 22) | "\(.[0]) \(.[1])"'
\`\`\`

점프 서버 보안 그룹 외에 22번이 열린 그룹이 나오면 우회 경로다. 왜 필요한지 확인하고 정리한다.

세션 기록이 외부로 전송되는지도 확인한다. 점프 서버에만 있으면 침해 시 함께 사라진다.`,

'zero-trust-migration': R`## 전환 진행 측정

무엇이 옮겨졌고 무엇이 남았는지 숫자로 본다.

| 항목 | 현재 | 목표 |
| --- | --- | --- |
| 통합 인증 연동 앱 | | 전체 |
| 관리 단말 등록률 | | 100% |
| VPN 없이 접근 가능한 앱 | | 다수 |
| VPN 접근 범위 | | 최소 |
| 요청 단위 검증 앱 | | 확대 |

첫 두 줄이 전제 조건이다. 이것이 낮으면 나머지가 진행되지 않는다. 새 애플리케이션부터 적용하면 기존을 건드리지 않고 비율을 올릴 수 있다.`,

'ddos-response-plan': R`## 기준선 기록

공격을 알아채려면 평소를 알아야 한다.

\`\`\`bash
# 시간대별 정상 트래픽 — 평시에 한 번 재 둔다
aws cloudwatch get-metric-statistics --namespace AWS/ApplicationELB \
  --metric-name RequestCount --dimensions Name=LoadBalancer,Value="$LB" \
  --start-time "$(date -u -v-14d +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 3600 --statistics Sum Maximum \
  --query 'Datapoints[].[Timestamp,Sum]' --output text | sort | tail -20
\`\`\`

이 값을 절차서에 적어 둔다. 공격 중에 "평소보다 많다" 를 판단할 근거가 된다.`,

'asset-inventory-automation': R`## 사각지대 계산

관리 대상과 실제 자원을 대조한다.

\`\`\`bash
comm -23 \
  <(aws ec2 describe-instances --filters Name=instance-state-name,Values=running \
      --query 'Reservations[].Instances[].InstanceId' --output text | tr '\t' '\n' | sort) \
  <(aws ssm describe-instance-information \
      --query 'InstanceInformationList[].InstanceId' --output text | tr '\t' '\n' | sort)
\`\`\`

출력된 인스턴스가 사각지대다. 이 숫자를 지표로 관리하면 관리 범위가 넓어진다. 패치 준수율보다 이 값이 먼저다.`,

'vpn-alternatives': R`## 실제 접근 대상 조사

범위를 줄이려면 무엇에 접근하는지 알아야 한다.

\`\`\`bash
# VPN 연결 후 실제로 도달한 대상
awk '$0 ~ /vpn/ {print $NF}' /var/log/flow.log \
  | sort | uniq -c | sort -rn | head -30
\`\`\`

목록이 나오면 웹 기반과 그 외로 나눈다. 웹 기반을 인증 프록시로 옮기면 대부분이 VPN 없이 처리된다. 남은 대상만 VPN 범위로 제한하면 접근 범위가 크게 준다.`,

'network-monitoring-blindspots': R`## 공백 목록 만들기

메우지 못한 구간을 문서로 남긴다. 조사 때 미리 알고 있어야 한다.

| 구간 | 수집 여부 | 대체 수단 | 비고 |
| --- | --- | --- | --- |
| 인터넷 경계 | | | |
| 구간 간 | | | |
| 서브넷 내부 | | | |
| 컨테이너 간 | | | |
| SaaS 접근 | | | |
| 원격 단말 | | | |

수집이 안 되는 구간에 대체 수단이 없으면 그 영역은 조사가 불가능하다. 위험이 큰 순서로 메운다. 데이터 계층으로 향하는 통신이 우선이다.`,

'internal-ca-operations': R`## 발급 현황 확인

수명이 긴 인증서와 폐기 체계 유무를 본다.

\`\`\`bash
# 발급된 인증서의 남은 기간
for c in certs/*.pem; do
  printf '%-40s ' "$c"
  openssl x509 -in "$c" -noout -enddate
done | sort -k2
\`\`\`

수명이 1년을 넘는 것이 많으면 자동 발급·갱신 체계를 먼저 만든다. 짧은 수명이 가능해지면 폐기 체계 없이도 실질적인 통제가 된다.

루트 키가 온라인 서버에 있는지도 확인한다.`,

'wireless-network-security': R`## 무단 접속점 탐지

정기적으로 주변 신호를 훑는다.

\`\`\`bash
# 주변 무선 신호 목록 (관리 도구가 없으면 수동 스캔)
nmcli -f SSID,BSSID,SIGNAL,SECURITY dev wifi list | head -30
\`\`\`

승인 목록에 없는 신호가 사무실 안에서 강하게 잡히면 무단 접속점일 수 있다. 유선 포트에 새 장비가 붙었는지도 함께 확인한다.

방문자망에서 내부 시스템에 접근되는지도 실제로 시험해 본다.`,

'network-change-control': R`## 만료 지난 임시 규칙

태그로 관리하면 자동으로 찾을 수 있다.

\`\`\`bash
aws ec2 describe-security-groups --query 'SecurityGroups[].[GroupId,Tags]' --output json \
  | jq -r --arg today "$(date +%Y-%m-%d)" '
      .[] | select(.[1] != null)
      | select(any(.[1][]; .Key=="expires" and .Value < $today))
      | .[0]'
\`\`\`

출력된 그룹이 정리 대상이다. 규칙 추가 시 만료 태그를 필수로 만들면 이 점검이 자동으로 작동한다.

흐름 로그와 대조해 실제 트래픽이 없는 규칙도 함께 정리한다.`,
}
