import type { SeedPost } from './types'

/** 201~210 — AWS 보안 서비스: 예방과 경계 */
export const posts21: SeedPost[] = [
  {
    slug: 'aws-waf',
    title: 'AWS WAF 규칙 구성과 요금 계산',
    body: `AWS WAF 는 CloudFront, ALB, API Gateway 앞에 붙여 요청을 검사하는 웹 방화벽이다. 관리형 규칙을 켜는 것만으로 흔한 공격의 상당수가 걸러지지만, 그대로 차단 모드로 올리면 정상 요청까지 막혀 곧 규칙을 끄게 된다. 계산 방식도 규칙 수와 요청 수에 함께 걸리므로 구성이 곧 비용이다.

## 무엇을 막을 수 있는가?

| 규칙 유형 | 막는 것 |
| --- | --- |
| 관리형 공통 규칙 | 인젝션·경로 탐색 등 흔한 패턴 |
| 알려진 악성 입력 | 공개된 취약점 악용 요청 |
| 아이피 평판 목록 | 알려진 악성 대역 |
| 봇 컨트롤 | 자동화 트래픽 분류 |
| 계정 탈취 방지 | 로그인 대입 시도 |
| 사용자 정의 규칙 | 우리 서비스 고유 조건 |
| 요청 수 기반 규칙 | 아이피·헤더별 초과 요청 |

![요청이 규칙을 지나는 순서](/img/posts/aws-waf.svg)

## 켜는 순서

관찰 없이 차단하면 반드시 정상 요청이 막힌다.

\`\`\`
1. 관리형 규칙을 전부 카운트 모드로 붙인다
2. 1~2주 로그를 보고 어떤 규칙이 무엇을 잡는지 확인
3. 오탐이 많은 규칙은 경로·파라미터 단위로 예외 처리
4. 인젝션·경로 탐색 규칙군부터 차단으로 전환
5. 요청 수 기반 규칙 추가 (로그인·검색 등)
6. 봇 컨트롤은 비용을 보고 별도 판단
\`\`\`

## 비용은 어떻게 붙는가

세 축이 곱해진다.

- **웹 ACL 수** — 월 단위 고정
- **규칙 수** — 규칙마다 월 단위 고정
- **요청 수** — 처리한 요청 100만 건 단위

여기에 더해 봇 컨트롤과 계정 탈취 방지 같은 지능형 위협 완화 기능은 별도 축으로 붙는다. 관리형 규칙 그룹 하나는 규칙 하나로 계산되지만, 지능형 기능은 검사한 요청 수에 따라 추가된다.

즉 트래픽이 큰 서비스에서는 요청 수가, 규칙을 많이 붙인 구성에서는 규칙 수가 비용을 좌우한다. 여러 서비스에 같은 웹 ACL 을 공유하면 웹 ACL 수를 줄일 수 있다.

![비용을 결정하는 세 축](/img/posts/aws-waf-2.svg)

## 로그를 어디에 남길지 정한다

WAF 로그는 양이 많다. S3 로 보내 저렴하게 보관하고 필요할 때 질의하는 구성이 일반적이다. CloudWatch Logs 로 바로 보내면 조회는 편하지만 비용이 빠르게 는다. 오탐 분석 기간에만 상세히 남기고, 안정된 뒤에는 차단 요청 위주로 좁히는 방법도 있다.

## 예외는 좁게, 기한과 함께

규칙 전체를 끄면 그 규칙이 막던 모든 경로가 열린다. 경로·파라미터·규칙 식별자를 모두 지정해 좁히고 만료일을 붙인다. 기한 없는 예외가 쌓이는 것이 WAF 운영에서 가장 흔한 부채다.

## 바로 확인하기

붙어 있는 규칙과 모드를 확인한다.

\`\`\`bash
aws wafv2 list-web-acls --scope REGIONAL \\
  --query 'WebACLs[].{이름:Name,ID:Id}' --output table

aws wafv2 get-web-acl --scope REGIONAL --name "$ACL_NAME" --id "$ACL_ID" \\
  --query 'WebACL.Rules[].{이름:Name,우선순위:Priority,동작:keys(Action || OverrideAction)}' \\
  --output table
\`\`\`

차단이 실제로 동작하는지 무해한 요청으로 확인한다.

\`\`\`bash
# 명백한 공격 패턴 — 403 이 나와야 한다
curl -s -o /dev/null -w '인젝션 %{http_code}\\n' "https://www.example.com/?q=%27%20OR%201=1--"
curl -s -o /dev/null -w '경로   %{http_code}\\n' "https://www.example.com/?f=../../../../etc/passwd"

# 정상 요청은 통과해야 한다
curl -s -o /dev/null -w '정상   %{http_code}\\n' -X POST https://www.example.com/api/posts \\
  -H 'Content-Type: application/json' -d '{"body":"SELECT 문 사용법 정리"}'
\`\`\`

## 실제로 이렇게 터진다

관리형 규칙을 전부 차단으로 켰다가 정상 요청이 막힌 사례가 있다. 결제 API 의 본문에 SQL 예약어처럼 보이는 문자열이 들어 있었다. 장애 원인을 찾는 데 몇 시간이 걸렸고, 결국 규칙 전체를 껐다.

반대로 계속 계수 모드로만 두고 몇 달을 보낸 경우도 있다. 로그는 쌓였지만 막은 것은 없었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 켜면 공격이 막힌다 | 조정 없이는 오탐이 먼저 온다 |
| 관리형 규칙이면 충분하다 | 우리 앱에 맞는 규칙이 따로 필요하다 |
| 계수 모드는 임시다 | 도입 절차의 필수 단계다 |
| 로그는 안 봐도 된다 | 조정의 근거가 거기 있다 |
| 우선순위는 상관없다 | 먼저 매칭된 규칙이 결과를 정한다 |

## 도입 순서

1. 관리형 규칙을 전부 계수 모드로 켠다
2. 2주간 로그를 본다 — 어떤 규칙이 무엇을 잡았나
3. 오탐이 없는 규칙부터 차단으로 바꾼다
4. 오탐이 있는 규칙은 범위 축소 규칙을 앞에 둔다
5. 속도 제한 규칙을 추가한다
6. 남은 규칙을 순차 전환한다

한 번에 다 켜는 것과 하나씩 켜는 것의 차이는 장애 여부다.

## 무엇이 실제로 효과가 있나

| 규칙 유형 | 효과 |
| --- | --- |
| 속도 제한 | 높음 — 자동화 공격 대부분을 줄인다 |
| 지역 차단 | 서비스 대상이 국내면 높음 |
| 관리형 공통 규칙 | 중간 — 조정 필요 |
| 평판 목록 | 중간 |
| 사용자 정의 정규식 | 높음 — 우리 앱을 아는 만큼 |

## 로그로 조정하기

\`\`\`bash
# 계수 모드에서 무엇을 잡았는지 — 규칙별 건수
aws logs start-query --log-group-name aws-waf-logs-app \
  --start-time $(($(date +%s) - 604800)) --end-time $(date +%s) \
  --query-string 'fields @timestamp | filter action = "COUNT" | stats count() by terminatingRuleId'
\`\`\`

건수가 압도적으로 많은 규칙이 대개 오탐이다. 그 규칙의 표본 요청을 열어 보면 우리 앱의 정상 패턴인 경우가 많다.

## 비용

요청 수, 규칙 수, 웹 ACL 수로 붙는다. 규칙을 잘게 나눌수록 비용이 는다. 비슷한 조건은 하나의 규칙에 정규식 집합으로 묶는 편이 낫다.

## 참고

- AWS WAF 개발자 안내서 — 관리형 규칙 그룹
- AWS WAF 요금 페이지
- OWASP ModSecurity Core Rule Set 문서`,
    diagram: {
      type: 'flow',
      caption: '요청이 검사되는 순서',
      steps: [
        { label: '요청 도착', note: 'CloudFront·ALB·API Gateway' },
        { label: '우선순위대로 규칙 평가', note: '허용·차단·카운트' },
        { label: '요청 수 규칙', note: '초과 시 차단' },
        { label: '원본 전달', note: '통과한 요청만' },
      ],
    },
    diagram2: {
      type: 'bars',
      caption: '비용 축(트래픽 큰 서비스 경향)',
      unit: '상대값',
      items: [
        { label: '요청 수', value: 60 },
        { label: '지능형 기능', value: 25, note: '봇·계정 탈취' },
        { label: '규칙 수', value: 10 },
        { label: '웹 ACL', value: 5 },
      ],
    },
  },
  {
    slug: 'aws-shield',
    title: 'Shield 기본과 Advanced 선택 기준',
    body: `AWS 계정은 이미 Shield Standard 로 보호되고 있다. 별도로 켤 것도 없고 요금도 없다. 그래서 실제 결정은 하나다. Shield Advanced 를 살 것인가. 이 판단은 공격을 더 막아 주는가가 아니라, 대응 지원과 요금 보호와 규정 요구가 우리에게 필요한가로 내려야 한다.

## 두 가지는 무엇이 다른가?

| 항목 | Standard | Advanced |
| --- | --- | --- |
| 요금 | 없음 | 조직 단위 월 정액 + 데이터 전송 |
| 대상 | 모든 AWS 자원 | 등록한 자원 |
| 완화 범위 | 흔한 계층 3·4 공격 | 정교한 공격 포함 |
| 대응 지원 | 없음 | 전담 대응팀 지원 |
| 요금 보호 | 없음 | 공격으로 늘어난 요금 크레딧 |
| 가시성 | 제한적 | 공격 상세 지표와 보고 |
| WAF 요금 | 별도 | 포함 |

![기본 보호와 추가 보호의 범위](/img/posts/aws-shield.svg)

## 계층별로 막는 위치가 다르다

대역폭을 채우는 공격은 AWS 경계에서 흡수된다. 애플리케이션 계층 공격은 WAF 와 우리 코드가 막아야 한다. Shield Advanced 를 사도 애플리케이션 계층 대응은 여전히 WAF 규칙과 요청 수 제한으로 한다.

\`\`\`
계층 3·4   대역폭·프로토콜 공격  → AWS 경계에서 흡수
계층 7     HTTP 요청 폭주        → WAF 요청 수 규칙·봇 컨트롤
논리       비싼 질의 반복         → 애플리케이션 설계
\`\`\`

## 비용은 어떻게 붙는가

Shield Advanced 는 **조직 단위 월 정액**이 기본이고, 여기에 보호 자원의 데이터 전송량에 따른 요금이 더해진다. 1년 약정이 전제이므로 한두 달 써 보고 끄는 방식이 아니다.

대신 얻는 것이 있다. 공격으로 인해 늘어난 자원 요금을 크레딧으로 돌려받을 수 있고, AWS WAF 사용료가 포함된다. WAF 를 크게 쓰고 있다면 실질 부담이 생각보다 작을 수 있다.

![도입 판단 기준](/img/posts/aws-shield-2.svg)

## 살 만한 경우

- 공격을 실제로 겪었고 재발 가능성이 높다
- 서비스 중단이 곧 큰 금전 손실로 이어진다
- WAF 요금이 이미 상당하다
- 공격 중 전문가 지원 채널이 필요하다
- 계약이나 규정이 요구한다

반대로 트래픽이 작고 공격 이력이 없으며 CloudFront 뒤에 잘 숨어 있다면, 기본 보호와 WAF 구성만으로 충분한 경우가 많다.

## 사기 전에 할 일

원본 서버를 감추고, CloudFront 를 앞에 두고, 요청 수 제한을 걸고, 자동 확장 상한을 정하는 것이 먼저다. 이 기본이 없으면 Advanced 를 사도 애플리케이션 계층에서 그대로 무너진다.

## 바로 확인하기

지금 보호 상태와 등록된 자원을 본다.

\`\`\`bash
# 구독 여부
aws shield describe-subscription \\
  --query 'Subscription.{시작:StartTime,종료:EndTime,자동갱신:AutoRenew}' 2>/dev/null \\
  || echo 'Shield Advanced 미구독 (Standard 는 항상 적용)'

# 보호 대상 자원
aws shield list-protections \\
  --query 'Protections[].{이름:Name,자원:ResourceArn}' --output table 2>/dev/null
\`\`\`

기본 대비부터 확인한다.

\`\`\`bash
# 원본이 직접 노출되는지 — 이것이 안 되면 어떤 보호도 우회된다
curl -s -o /dev/null -w '원본 직접 %{http_code}\\n' --resolve "www.example.com:443:$ORIGIN_IP" \\
  https://www.example.com/

# WAF 요청 수 규칙이 있는지
aws wafv2 get-web-acl --scope CLOUDFRONT --name "$ACL" --id "$ID" \\
  --query 'WebACL.Rules[?Statement.RateBasedStatement].Name' --output text
\`\`\`

## 실제로 이렇게 터진다

기본 보호만 믿고 있다가 애플리케이션 계층 공격에 서비스가 멈춘 사례가 있다. 기본 보호는 네트워크·전송 계층을 다루고, HTTP 요청 폭주는 다른 문제다.

고급 보호를 구독했지만 보호 대상을 등록하지 않은 경우도 있다. 구독만으로는 아무 일도 일어나지 않는다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 모든 공격을 막는다 | 계층별로 다르다 |
| 고급을 사면 자동 적용된다 | 자원을 등록해야 한다 |
| 웹 방화벽과 중복이다 | 역할이 다르고 함께 쓴다 |
| 비용 보상이 자동이다 | 조건과 신청 절차가 있다 |
| 소규모 서비스는 필요 없다 | 요금 폭증 위험은 규모와 무관하다 |

## 계층별로 무엇이 막히나

| 공격 | 기본 | 고급 + 웹 방화벽 |
| --- | --- | --- |
| 대역폭 고갈 | 대체로 막힘 | 막힘 |
| 연결 고갈 | 부분적 | 막힘 |
| HTTP 요청 폭주 | 안 막힘 | 속도 제한으로 대응 |
| 느린 요청 공격 | 안 막힘 | 부분적 |
| 특정 API 표적 | 안 막힘 | 사용자 규칙 필요 |

애플리케이션 계층은 결국 웹 방화벽의 몫이다. 고급 보호의 가치는 대응 팀 지원과 요금 보호에 있다.

## 고급 보호를 살 이유가 있는 경우

1. 공격 시 자동 확장으로 요금이 폭증할 구조다
2. 공격 대응을 도와줄 내부 인력이 없다
3. 서비스 중단이 계약상 문제가 된다
4. 보호 대상이 여러 계정에 걸쳐 있다

셋 이상 해당하면 값을 한다. 하나도 해당하지 않으면 기본 보호와 웹 방화벽 조합이 낫다.

## 준비해 둘 것

\`\`\`bash
# 보호 대상이 실제로 등록돼 있는지
aws shield list-protections \
  --query 'Protections[].[Name,ResourceArn]' --output table

# 공격 이력
aws shield list-attacks \
  --start-time TimeRange="{FromInclusive=$(date -u -v-30d +%Y-%m-%dT%H:%M:%SZ)}" \
  --query 'AttackSummaries[].[StartTime,AttackVectors[].VectorType]' --output text
\`\`\`

공격은 준비 상태를 시험한다. 연락 체계, 권한, 대응 절차를 평시에 문서로 만들어 두는 것이 구독보다 먼저다.

## 참고

- AWS Shield 개발자 안내서
- AWS Shield 요금 페이지
- AWS DDoS 대응 모범 사례 백서`,
    diagram: {
      type: 'layers',
      caption: '공격 계층과 대응 위치',
      layers: [
        { label: '대역폭 공격', note: 'AWS 경계에서 흡수' },
        { label: '프로토콜 공격', note: '경계 장비' },
        { label: 'HTTP 요청 폭주', note: 'WAF 요청 수 규칙' },
        { label: '비싼 질의 반복', note: '애플리케이션 설계' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: 'Advanced 도입 판단',
      x: ['공격 이력 있음', '없음'],
      y: ['중단 손실 큼', '작음'],
      cells: ['도입 근거 충분', '기본 대비 강화 우선', 'WAF 비용 비교', '기본으로 충분'],
    },
  },
  {
    slug: 'aws-network-firewall',
    title: 'Network Firewall 로 아웃바운드 통제',
    body: `보안 그룹과 네트워크 ACL 은 아이피와 포트까지만 본다. 그래서 "이 도메인으로만 나갈 수 있다" 같은 규칙을 만들 수 없다. Network Firewall 은 VPC 경계에 상태 기반 검사와 도메인 기준 필터를 넣어 준다. 아웃바운드 통제와 서버 측 요청 위조 차단을 네트워크 층에서 하려면 필요한 구성이다.

## 무엇을 할 수 있는가?

| 기능 | 내용 |
| --- | --- |
| 도메인 목록 필터 | 허용·차단 도메인 지정 |
| 상태 기반 규칙 | 세션을 따라가며 검사 |
| 서명 기반 탐지 | 알려진 악성 트래픽 패턴 |
| TLS 검사 | 암호화 구간 내용 확인 |
| 흐름·경보 로그 | 무엇이 오갔는지 기록 |
| 중앙 관리 | 여러 VPC 에 정책 배포 |

![VPC 경계에서 나가는 트래픽을 검사한다](/img/posts/aws-network-firewall.svg)

## 보안 그룹과 무엇이 다른가

보안 그룹은 인스턴스 단위, 아이피·포트 기준, 상태 저장이다. Network Firewall 은 VPC 경계에서 도메인과 패턴까지 본다. 겹치는 것이 아니라 층이 다르므로 함께 쓴다.

\`\`\`
보안 그룹        인스턴스 단위 · 아이피/포트
네트워크 ACL      서브넷 단위 · 상태 없음
Network Firewall  VPC 경계 · 도메인·패턴·세션
\`\`\`

## 배치 방식이 비용을 정한다

VPC 마다 방화벽을 두면 관리도 비용도 커진다. 검사용 VPC 를 하나 두고 전송 게이트웨이로 트래픽을 모아 그곳에서 검사하는 중앙 집중 방식이 일반적이다. 다만 트래픽이 한 곳을 지나므로 처리량 설계가 필요하다.

![분산 배치와 중앙 집중 배치](/img/posts/aws-network-firewall-2.svg)

## 비용은 어떻게 붙는가

- **엔드포인트 시간** — 가용 영역마다 엔드포인트가 뜨고 시간당 과금
- **처리 데이터양(GB)** — 검사한 트래픽 용량
- **전송 게이트웨이 처리량** — 중앙 집중 구성이면 추가

가용 영역 수가 곧 고정비다. 3개 영역에 두면 엔드포인트 3개가 상시 과금된다. 트래픽이 적은 환경에서는 고정비 비중이 커지므로, 개발 계정에는 프록시 방식이 더 경제적일 수 있다.

## TLS 검사는 신중히

암호화 구간을 열어 보려면 우리 인증서를 중간에 넣어야 한다. 개인정보가 오가는 구간을 복호화하는 것이므로 목적과 범위를 문서로 정하고, 검사 대상에서 제외할 구간을 명시한다. 비용도 처리량 기준으로 크게 늘어난다.

## 바로 확인하기

방화벽과 규칙 그룹을 확인한다.

\`\`\`bash
aws network-firewall list-firewalls \\
  --query 'Firewalls[].{이름:FirewallName,ARN:FirewallArn}' --output table

aws network-firewall describe-firewall --firewall-name "$FW" \\
  --query 'Firewall.{VPC:VpcId,서브넷:SubnetMappings[].SubnetId,삭제방지:DeleteProtection}'
\`\`\`

도메인 필터가 실제로 막는지 인스턴스에서 시험한다.

\`\`\`bash
# 허용 목록에 없는 도메인 — 차단돼야 한다
for d in example.com pastebin.com raw.githubusercontent.com; do
  printf '%-32s ' "$d"
  curl -s -m 5 -o /dev/null "https://$d" && echo '허용' || echo '차단'
done
\`\`\`

## 실제로 이렇게 터진다

경로 설정을 잘못해 트래픽이 방화벽을 우회한 사례가 있다. 방화벽은 켜져 있었고 로그도 나왔지만, 정작 검사해야 할 서브넷의 트래픽은 지나가지 않았다.

또 하나는 상태 규칙을 촘촘히 넣었다가 처리량 한계에 걸린 경우다. 지연이 늘었고 원인을 찾는 데 오래 걸렸다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 만들면 트래픽이 지나간다 | 경로를 직접 바꿔야 한다 |
| 보안 그룹을 대체한다 | 계층이 다르다 |
| 규칙이 많을수록 안전하다 | 처리량과 지연에 영향을 준다 |
| 로그는 선택이다 | 검증할 유일한 수단이다 |
| 가용 영역마다 안 만들어도 된다 | 영역별 엔드포인트가 필요하다 |

## 보안 그룹과 무엇이 다른가

| 항목 | 보안 그룹 | 네트워크 방화벽 |
| --- | --- | --- |
| 계층 | 4계층 | 7계층까지 |
| 도메인 기준 | 불가 | 가능 |
| 침입 탐지 규칙 | 불가 | 가능 |
| 적용 지점 | 인스턴스 | 서브넷 경계 |
| 비용 | 없음 | 시간 + 처리량 |

도메인 기준 아웃바운드 통제가 도입의 가장 흔한 이유다. 보안 그룹은 주소만 알고 도메인은 모른다.

## 경로 설정이 핵심이다

트래픽이 방화벽을 지나게 하려면 라우팅 테이블 세 곳을 손봐야 한다.

| 테이블 | 대상 |
| --- | --- |
| 워크로드 서브넷 | 기본 경로를 방화벽 엔드포인트로 |
| 방화벽 서브넷 | 기본 경로를 게이트웨이로 |
| 게이트웨이 라우팅 | 돌아오는 트래픽을 방화벽으로 |

세 번째를 빼먹는 경우가 많다. 그러면 나가는 트래픽만 검사된다.

\`\`\`bash
# 방화벽 엔드포인트가 영역마다 있는지
aws network-firewall describe-firewall --firewall-name "$FW" \
  --query 'FirewallStatus.SyncStates' --output json

# 실제로 통과하는지 — 로그가 나오지 않으면 경로가 틀렸다
aws logs filter-log-events --log-group-name /aws/network-firewall/alert \
  --start-time $((($(date +%s) - 600) * 1000)) --max-items 5 \
  --query 'events[].message' --output text
\`\`\`

## 참고

- AWS Network Firewall 개발자 안내서
- AWS Network Firewall 요금 페이지
- CIS Controls v8, 13 네트워크 모니터링과 방어`,
    diagram: {
      type: 'layers',
      caption: '네트워크 통제의 층',
      layers: [
        { label: '보안 그룹', note: '인스턴스 · 아이피/포트' },
        { label: '네트워크 ACL', note: '서브넷 · 상태 없음' },
        { label: 'Network Firewall', note: 'VPC 경계 · 도메인/패턴' },
        { label: '애플리케이션 검사', note: '요청 내용' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '배치 방식 선택',
      x: ['중앙 집중', '분산 배치'],
      y: ['VPC 다수', 'VPC 소수'],
      cells: ['관리·비용 유리', '엔드포인트 비용 급증', '전송 비용 고려', '단순'],
    },
  },
  {
    slug: 'aws-dns-firewall',
    title: 'Route 53 DNS 방화벽 활용 지점',
    body: `침해된 서버가 명령을 받으려면 대개 이름 해석을 먼저 한다. 그래서 DNS 질의를 보는 것만으로 악성 통신을 초기에 끊을 수 있다. Route 53 Resolver DNS Firewall 은 VPC 안에서 나가는 질의를 도메인 목록으로 걸러 준다. 설정이 단순하고 비용 구조가 명확해 아웃바운드 통제의 첫 단계로 쓰기 좋다.

## 무엇을 막을 수 있는가?

| 대상 | 효과 |
| --- | --- |
| 알려진 악성 도메인 | 명령 제어 연결 차단 |
| 도메인 생성 알고리즘 | 무작위 도메인 질의 차단 |
| 데이터 반출 도메인 | DNS 를 통한 유출 억제 |
| 허용 목록 외 전부 | 강한 통제가 필요한 구간 |
| 조회만 (경보) | 차단 전 관찰 |

![질의 단계에서 끊는다](/img/posts/aws-dns-firewall.svg)

## 규칙 그룹 구성

AWS 가 제공하는 관리형 도메인 목록과 우리가 만든 목록을 함께 쓴다. 우선순위대로 평가되므로 허용 목록을 앞에, 차단 목록을 뒤에 둔다.

\`\`\`
우선순위 10   사내 허용 도메인 (ALLOW)
우선순위 20   AWS 관리형 악성 도메인 (BLOCK)
우선순위 30   AWS 관리형 DGA 목록 (BLOCK)
우선순위 40   사내 차단 목록 (BLOCK)
우선순위 100  나머지 (ALERT 또는 ALLOW)
\`\`\`

## 차단 응답을 무엇으로 할지 정한다

응답 없음, 도메인 없음, 지정한 주소로 응답 중 고를 수 있다. 지정 주소로 응답하게 하면 차단 페이지를 띄우거나 싱크홀로 보내 어떤 호스트가 시도했는지 파악할 수 있다. 조사 편의를 생각하면 싱크홀 방식이 유용하다.

![차단 응답 방식 선택](/img/posts/aws-dns-firewall-2.svg)

## 비용은 어떻게 붙는가

**처리한 질의 수** 기준이다. 도메인 목록 크기나 규칙 수가 아니라 질의량이 비용을 정한다. 컨테이너 환경은 질의가 많으므로 예상보다 클 수 있고, 캐시 설정으로 질의 자체를 줄이면 비용도 함께 줄어든다.

관리형 도메인 목록 사용에 추가 비용이 붙는 경우가 있으므로 목록별 조건을 확인한다.

## 먼저 관찰한다

허용 목록 방식으로 바로 가면 정상 통신이 끊긴다. 몇 주간 경보 모드로 두고 실제로 어떤 도메인이 조회되는지 목록을 만든 뒤, 그 목록을 기준으로 좁힌다. 관찰 단계에서 만든 목록이 그대로 허용 목록이 된다.

## 한계

DNS 를 쓰지 않고 아이피로 직접 접속하는 통신은 막지 못한다. 그래서 아웃바운드 아이피 통제와 함께 써야 한다. 또 자체 해석기를 쓰는 워크로드는 이 경로를 지나지 않으므로, VPC 해석기를 쓰도록 강제하는 설정이 필요하다.

## 바로 확인하기

규칙 그룹이 VPC 에 연결됐는지 본다.

\`\`\`bash
aws route53resolver list-firewall-rule-group-associations \\
  --query 'FirewallRuleGroupAssociations[].{VPC:VpcId,그룹:FirewallRuleGroupId,우선순위:Priority,상태:Status}' \\
  --output table
\`\`\`

인스턴스에서 실제로 차단되는지 확인한다.

\`\`\`bash
# 관리형 목록에 있는 도메인 형태로 시험 (실제 악성 도메인은 쓰지 않는다)
dig +short test-block.example.internal
# 차단 응답 방식에 따라 NXDOMAIN, 응답 없음, 싱크홀 주소 중 하나가 나온다

# 질의 로그가 남는지
aws logs tail /aws/route53resolver/dns-firewall --since 10m --format short | head
\`\`\`

## 실제로 이렇게 터진다

악성 도메인 차단 목록만 켜 두고 자체 목록을 관리하지 않은 사례가 있다. 사내 정책상 금지된 서비스로의 통신은 그대로 나갔다.

반대로 차단 목록을 과하게 넣어 패키지 저장소가 막힌 경우도 있다. 배포가 실패했고 원인을 찾는 데 반나절이 걸렸다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| DNS 를 막으면 통신이 막힌다 | 주소를 직접 쓰면 우회된다 |
| 관리형 목록이면 충분하다 | 자체 목록이 실효를 낸다 |
| 차단하면 끝이다 | 무엇이 막혔는지 봐야 한다 |
| 성능에 영향이 없다 | 질의 경로가 하나 늘어난다 |
| 로그가 필요 없다 | 감염 탐지의 좋은 신호다 |

## 무엇에 강한가

| 목적 | 적합성 |
| --- | --- |
| 악성 도메인 통신 차단 | 높음 |
| 감염 단말 탐지 | 매우 높음 — 질의 자체가 신호 |
| 데이터 유출 통제 | 중간 — 우회 가능 |
| 정책상 금지 서비스 차단 | 높음 |
| 완전한 통신 차단 | 낮음 — 다른 계층 필요 |

가장 값을 하는 것은 차단보다 탐지다. 내부에서 이상한 도메인을 물어봤다는 사실 자체가 강한 신호다.

## 단계적 적용

1. 전부 경보 모드로 시작한다
2. 로그에서 정상 질의를 확인한다
3. 사내 저장소·CDN 도메인을 허용 목록에 넣는다
4. 악성 목록부터 차단으로 바꾼다
5. 자체 금지 목록을 추가한다

\`\`\`bash
# 차단·경보된 질의 — 감염 의심 단말을 여기서 찾는다
aws logs start-query --log-group-name /aws/route53/resolver \
  --start-time $(($(date +%s) - 86400)) --end-time $(date +%s) \
  --query-string 'fields srcaddr, query_name | filter firewall_action != "ALLOW" | stats count() by srcaddr, query_name'
\`\`\`

한 단말이 같은 이상 도메인을 반복 질의하면 조사 대상이다. 사람이 브라우저로 한 번 들어간 것과 프로그램이 주기적으로 물어보는 것은 패턴이 다르다.

## 참고

- Amazon Route 53 Resolver DNS Firewall 개발자 안내서
- Amazon Route 53 요금 페이지
- MITRE ATT&CK — Command and Control, DNS`,
    diagram: {
      type: 'flow',
      caption: '악성 통신이 끊기는 지점',
      steps: [
        { label: '침해된 워크로드', note: '명령 서버 접속 시도' },
        { label: 'DNS 질의', note: 'VPC 해석기 경유' },
        { label: '규칙 평가', note: '허용·차단·경보' },
        { label: '차단과 기록', note: '어떤 호스트가 시도했는지' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '차단 응답 방식',
      x: ['싱크홀 응답', '응답 없음'],
      y: ['조사 필요', '단순 차단'],
      cells: ['시도 호스트 파악', '원인 추적 어려움', '과할 수 있음', '가장 단순'],
    },
  },
  {
    slug: 'aws-vpc-flow-logs',
    title: 'VPC 흐름 로그 설계와 비용 관리',
    body: `흐름 로그는 어떤 주소가 어떤 주소로 얼마나 통신했는지를 남긴다. 침해 조사에서 확산 범위를 확인하고, 방화벽 규칙을 정리하고, 예상 못 한 통신을 찾는 데 쓰인다. 문제는 양이다. 아무 설계 없이 전부 켜면 로그 비용이 워크로드 비용을 넘어서기도 한다.

## 무엇을 확인할 수 있는가?

| 질문 | 흐름 로그로 답하기 |
| --- | --- |
| 이 인스턴스가 어디와 통신했나 | 목적지 주소·포트 집계 |
| 침해 후 어디까지 번졌나 | 시간대별 내부 통신 |
| 이 보안 그룹 규칙이 쓰이나 | 해당 포트 트래픽 유무 |
| 거부된 통신이 있나 | 거부 레코드 |
| 대량 반출이 있었나 | 바이트 수 급증 |

![흐름 로그가 답하는 질문](/img/posts/aws-vpc-flow-logs.svg)

## 어디에 붙일지 정한다

VPC 전체, 서브넷, 인터페이스 단위로 켤 수 있다. 범위가 좁을수록 양이 준다. 운영 VPC 는 전체, 개발은 필요한 서브넷만 켜는 식으로 나눈다.

\`\`\`
운영 VPC        전체 · 모든 트래픽
데이터 서브넷    전체 · 거부 포함
개발 VPC        거부 트래픽만 또는 미사용
관리 대역       전체 · 보관 기간 길게
\`\`\`

## 필드를 고른다

기본 형식에는 없는 필드가 조사에 유용한 경우가 많다. 반대로 쓰지 않는 필드를 넣으면 용량만 는다. 흔히 추가하는 것은 흐름 방향, 트래픽 경로, 대상 서비스 이름 정도다.

![기록 범위와 용량](/img/posts/aws-vpc-flow-logs-2.svg)

## 비용은 어떻게 붙는가

흐름 로그 자체에는 요금이 없고, **전달 대상의 비용**이 든다.

- **CloudWatch Logs** — 수집량과 저장량. 조회는 편하지만 비싸다
- **S3** — 저장량 기준. 훨씬 저렴하고 Athena 로 질의
- **Data Firehose** — 전송량 기준

여기에 더해 GuardDuty 가 흐름 로그를 분석하면 그쪽 비용도 함께 는다. 대량 트래픽 환경에서는 S3 로 보내고 압축·분할을 켜는 것이 기본이다.

## 집계 간격과 표본 추출

집계 간격을 길게 잡으면 레코드 수가 줄어든다. 조사 정밀도와 비용을 바꾸는 선택이다. 또 양이 감당되지 않으면 대상 인터페이스를 줄이는 편이 표본을 줄이는 것보다 예측 가능하다.

## 조회를 미리 준비한다

사고가 났을 때 질의문을 처음부터 쓰면 늦다. 자주 쓰는 질의를 미리 만들어 둔다.

## 바로 확인하기

어디에 켜져 있고 어디로 가는지 본다.

\`\`\`bash
aws ec2 describe-flow-logs \\
  --query 'FlowLogs[].{대상:ResourceId,유형:TrafficType,전달:LogDestinationType,형식:LogFormat}' \\
  --output table
\`\`\`

조사용 질의를 준비해 둔다.

\`\`\`sql
-- 특정 인스턴스가 외부로 보낸 바이트 상위 목적지
SELECT dstaddr, sum(bytes) AS total, count(*) AS flows
  FROM vpc_flow_logs
 WHERE srcaddr = '10.20.3.14'
   AND date BETWEEN '2026-09-01' AND '2026-09-03'
   AND dstaddr NOT LIKE '10.%'
 GROUP BY dstaddr
 ORDER BY total DESC
 LIMIT 20;
\`\`\`

## 실제로 이렇게 터진다

침해 조사에서 흐름 로그를 켜지 않았다는 것을 알게 된 사례가 있다. 어디로 얼마나 나갔는지 알 방법이 없었고, 유출 규모를 추정으로만 보고해야 했다.

반대로 전부 켜 두고 보존 정책이 없어 저장 비용이 다른 모든 로그를 합친 것보다 커진 경우도 있다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 패킷 내용이 남는다 | 메타데이터만 남는다 |
| 실시간이다 | 몇 분 지연이 있다 |
| 모든 트래픽이 기록된다 | 일부 트래픽은 제외된다 |
| 기본 형식이면 충분하다 | 사용자 정의 필드가 훨씬 유용하다 |
| 저장은 어디든 같다 | 비용과 질의 방식이 크게 다르다 |

## 저장 위치를 어떻게 고르나

| 위치 | 비용 | 질의 | 적합 |
| --- | --- | --- | --- |
| 로그 그룹 | 높음 | 즉시 | 짧은 보존, 실시간 경보 |
| 객체 스토리지 | 낮음 | 조회 도구 필요 | 장기 보존, 조사 |
| 데이터 스트림 | 중간 | 외부 연동 | 보안 관제 연동 |

실무에서는 두 곳을 함께 쓴다. 최근 며칠은 로그 그룹, 장기 보존은 객체 스토리지로 보낸다.

## 사용자 정의 필드를 꼭 넣는다

기본 형식에는 조사에 필요한 것이 빠져 있다.

| 추가 필드 | 왜 필요한가 |
| --- | --- |
| 흐름 방향 | 들어온 것인지 나간 것인지 |
| 트래픽 경로 | 게이트웨이·엔드포인트 경유 여부 |
| 인스턴스 식별자 | 어느 자원인지 바로 안다 |
| 서브넷·VPC 식별자 | 계정 통합 조회 시 필요 |
| 거부 사유 | 무엇이 막았는지 |

\`\`\`bash
# 외부로 많이 나간 상위 대상 — 유출 조사의 출발점
aws logs start-query --log-group-name /aws/vpc/flowlogs \
  --start-time $(($(date +%s) - 86400)) --end-time $(date +%s) \
  --query-string 'fields dstaddr, bytes | filter flow_direction = "egress" | stats sum(bytes) as total by dstaddr | sort total desc | limit 20'
\`\`\`

평소 나가지 않던 주소로 큰 용량이 나갔다면 그것이 첫 단서다. 기준선을 모르면 이 질의도 소용이 없으므로, 평시에 한 번 돌려 결과를 기록해 둔다.

## 참고

- Amazon VPC 흐름 로그 사용 설명서
- Amazon CloudWatch Logs 및 S3 요금 페이지
- NIST SP 800-92, 로그 관리 지침`,
    diagram: {
      type: 'layers',
      caption: '흐름 로그 활용',
      layers: [
        { label: '침해 확산 조사', note: '내부 통신 추적' },
        { label: '규칙 정리', note: '쓰이지 않는 허용 발견' },
        { label: '반출 탐지', note: '바이트 급증' },
        { label: '연결성 문제 진단', note: '거부 레코드' },
      ],
    },
    diagram2: {
      type: 'bars',
      caption: '전달 대상별 비용(경향)',
      unit: '상대값',
      items: [
        { label: 'CloudWatch Logs', value: 100, note: '조회 편의' },
        { label: 'Data Firehose', value: 45 },
        { label: 'S3 (압축·분할)', value: 15, note: 'Athena 질의' },
      ],
    },
  },
  {
    slug: 'aws-firewall-manager',
    title: 'Firewall Manager 로 정책 일괄 적용',
    body: `계정이 늘어나면 WAF 규칙이 어떤 계정에는 붙고 어떤 계정에는 안 붙는 상태가 된다. 새로 만든 로드 밸런서에 규칙을 붙이는 것을 잊는 일도 반복된다. Firewall Manager 는 조직 전체에 보안 정책을 강제로 적용하고, 새 자원에도 자동으로 붙여 준다. 계정이 몇 개 이상이면 개별 관리보다 이쪽이 확실하다.

## 무엇을 일괄 적용할 수 있는가?

| 정책 유형 | 내용 |
| --- | --- |
| WAF 정책 | 웹 ACL 을 대상 자원에 자동 연결 |
| Shield Advanced | 보호 대상 자동 등록 |
| 보안 그룹 감사 | 금지된 규칙 탐지·교정 |
| 보안 그룹 공통 | 공통 규칙 강제 적용 |
| Network Firewall | VPC 방화벽 배포 |
| DNS 방화벽 | 규칙 그룹 연결 |
| 팔로우 규칙 | 신규 자원 자동 포함 |

![조직 전체에 정책을 밀어 넣는다](/img/posts/aws-firewall-manager.svg)

## 전제 조건이 있다

Firewall Manager 를 쓰려면 몇 가지가 먼저 갖춰져야 한다. 이 준비가 실제 도입 작업의 대부분이다.

\`\`\`
1. AWS Organizations 사용 (전체 기능 모드)
2. 보안 계정을 Firewall Manager 관리자로 지정
3. 모든 계정에서 AWS Config 활성화
4. 정책 유형별 전제 서비스 활성화 (WAF·Shield 등)
\`\`\`

Config 가 켜져 있어야 자원 변경을 감지해 정책을 적용할 수 있다.

## 보안 그룹 감사가 특히 유용하다

전 계정을 대상으로 "0.0.0.0/0 에서 관리 포트를 여는 규칙"을 금지하고, 위반이 생기면 알리거나 자동으로 제거할 수 있다. 계정마다 사람이 점검하던 일을 정책 하나로 대체한다.

![적용 범위와 예외 관리](/img/posts/aws-firewall-manager-2.svg)

## 비용은 어떻게 붙는가

**정책 수 × 지역** 기준으로 월 과금된다. 여기에 각 정책이 만들어 내는 실제 자원 비용이 별도로 붙는다. WAF 정책이면 웹 ACL 과 규칙 비용, Network Firewall 정책이면 엔드포인트와 처리량 비용이 그렇다.

즉 Firewall Manager 자체 비용은 관리 비용이고, 실제 지출은 배포되는 보안 자원에서 나온다. 정책을 여러 지역에 나눠 만들면 지역 수만큼 곱해지므로 필요한 지역만 대상으로 잡는다.

## 예외를 어떻게 다룰지 정한다

모든 계정에 같은 정책이 맞지 않는 경우가 있다. 계정 목록이나 태그로 대상을 지정하고, 제외 대상은 사유와 재검토 시점을 기록한다. 예외 계정이 늘어나면 정책의 의미가 사라지므로 예외 수를 지표로 관리한다.

## 바로 확인하기

정책과 준수 상태를 본다.

\`\`\`bash
aws fms list-policies \\
  --query 'PolicyList[].{이름:PolicyName,유형:SecurityServiceType,교정:RemediationEnabled}' \\
  --output table

# 정책별 위반 계정
aws fms list-compliance-status --policy-id "$POLICY_ID" \\
  --query 'PolicyComplianceStatusList[].{계정:MemberAccount,상태:EvaluationResults[0].ComplianceStatus,위반수:EvaluationResults[0].ViolatorCount}' \\
  --output table
\`\`\`

전제 조건이 충족됐는지도 확인한다.

\`\`\`bash
aws fms get-admin-account --query '{관리자:AdminAccount,상태:RoleStatus}'
# Config 가 꺼진 계정이 있으면 그 계정에는 정책이 적용되지 않는다
\`\`\`

## 실제로 이렇게 터진다

계정마다 웹 방화벽 규칙을 따로 만든 사례가 있다. 새 취약점이 나와 규칙을 하나 추가해야 했는데, 계정이 서른 개였다. 며칠에 걸쳐 손으로 적용했고 두 계정을 빠뜨렸다.

반대로 중앙 정책을 강제했다가 팀별 예외를 못 넣어 반발이 생긴 경우도 있다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 방화벽 규칙만 관리한다 | 보안 그룹·DNS 규칙도 대상이다 |
| 켜면 바로 적용된다 | 범위와 적용 방식을 정해야 한다 |
| 예외를 못 만든다 | 태그로 제외할 수 있다 |
| 조직이 없어도 쓴다 | 조직 구성이 전제다 |
| 추가 비용이 없다 | 정책 수 기준으로 붙는다 |

## 무엇을 중앙에서 강제할 가치가 있나

| 대상 | 중앙화 가치 |
| --- | --- |
| 공통 웹 방화벽 규칙 | 높음 — 취약점 대응이 즉시 퍼진다 |
| 보안 그룹 감사 | 높음 — 전체 개방 규칙 탐지 |
| DNS 방화벽 규칙 | 높음 |
| 애플리케이션별 규칙 | 낮음 — 팀이 관리해야 한다 |

공통은 중앙, 개별은 팀. 이 경계를 흐리면 어느 쪽도 제대로 안 된다.

## 적용 방식

| 방식 | 성격 |
| --- | --- |
| 감사만 | 위반을 알려 주고 두지 않는다 |
| 자동 적용 | 없으면 만들고 다르면 고친다 |
| 태그 제외 | 특정 태그를 붙인 자원은 제외 |

처음에는 감사만으로 시작한다. 무엇이 어긋나 있는지 먼저 알고, 팀과 합의한 뒤 자동 적용으로 넘어간다.

\`\`\`bash
# 정책별 위반 계정·자원
aws fms list-compliance-status --policy-id "$P" \
  --query 'PolicyComplianceStatusList[].[MemberAccount,EvaluationResults[0].ComplianceStatus]' \
  --output table
\`\`\`

## 참고

- AWS Firewall Manager 개발자 안내서
- AWS Firewall Manager 요금 페이지
- CIS Controls v8, 4 안전한 설정 관리`,
    diagram: {
      type: 'flow',
      caption: '정책이 적용되는 경로',
      steps: [
        { label: '보안 계정에서 정책 정의', note: '대상 범위 지정' },
        { label: 'Config 가 자원 감지', note: '신규 포함' },
        { label: '정책 자동 적용', note: '누락 없이' },
        { label: '위반 알림·교정', note: '준수 상태 추적' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '계정 수와 관리 방식',
      x: ['일괄 적용', '계정별 개별'],
      y: ['계정 다수', '계정 소수'],
      cells: ['누락 없음', '반드시 빠진다', '과할 수 있음', '수동으로 가능'],
    },
  },
  {
    slug: 'aws-scp-guardrails',
    title: 'SCP 로 계정 전체에 금지선 긋기',
    body: `IAM 정책은 무엇을 허용할지 정하고, 서비스 제어 정책은 계정 안에서 아무도 넘을 수 없는 상한을 정한다. 관리자라도 이 선을 넘지 못한다는 점이 핵심이다. 그래서 "실수로도 이건 안 되게" 만들어야 하는 항목을 여기에 둔다. 잘못 쓰면 배포가 통째로 막히므로 적용 순서가 중요하다.

## 무엇을 막는 데 쓰는가?

| 금지 항목 | 이유 |
| --- | --- |
| CloudTrail 비활성화·삭제 | 감사 로그 보호 |
| GuardDuty·Config 중지 | 탐지 유지 |
| 루트 계정 사용 | 사용 자체를 차단 |
| 승인되지 않은 지역 사용 | 규정·비용 통제 |
| 보안 계정 자원 변경 | 관리 경계 보호 |
| 특정 서비스 사용 | 정책상 금지 서비스 |
| 조직 탈퇴 | 계정 이탈 방지 |

![허용 정책과 상한 정책의 관계](/img/posts/aws-scp-guardrails.svg)

## 허용이 아니라 상한이다

서비스 제어 정책은 권한을 주지 않는다. IAM 이 허용한 것 중에서 걸러낼 뿐이다. 그래서 "SCP 에 허용했는데 안 된다"는 상황은 IAM 쪽 문제이고, "IAM 에 허용했는데 안 된다"는 SCP 쪽 문제다. 이 구분을 모르면 권한 문제를 며칠씩 헤맨다.

## 적용 순서

\`\`\`
1. 조직 단위(OU) 구조를 먼저 정리한다
2. 새 정책을 테스트 OU 에만 붙인다
3. CloudTrail 에서 거부된 호출을 관찰한다
4. 정상 업무가 막히지 않는 것을 확인한 뒤 범위를 넓힌다
5. 운영 OU 는 마지막에 적용한다
6. 비상 해제 절차를 미리 정한다
\`\`\`

## 비용은 어떻게 붙는가

**서비스 제어 정책 자체에는 요금이 없다.** AWS Organizations 기능이므로 추가 비용 없이 쓸 수 있다. 비용 없이 얻는 통제 중 효과가 가장 큰 축에 든다.

다만 잘못 적용했을 때의 비용은 크다. 배포가 막히고 장애 대응이 지연되는 형태로 나타난다. 그래서 요금이 아니라 적용 절차에 신경을 써야 하는 항목이다.

![적용 범위를 넓히는 순서](/img/posts/aws-scp-guardrails-2.svg)

## 예외 계정을 태그나 조건으로 다룬다

특정 역할만 예외로 두고 싶을 때는 조건절을 쓴다. 자동화용 역할을 예외로 두는 것이 흔한데, 그 역할이 넓은 권한을 갖게 되므로 그 역할 자체의 보호가 중요해진다.

## 비상 해제를 준비한다

정책이 장애를 유발할 때 누가 어떻게 풀 수 있는지 미리 정한다. 관리 계정 접근 절차, 승인자, 사후 검토를 문서로 남긴다. 준비가 없으면 장애 중에 관리 계정 접근 방법을 찾느라 시간이 더 든다.

## 바로 확인하기

적용된 정책과 대상을 본다.

\`\`\`bash
aws organizations list-policies --filter SERVICE_CONTROL_POLICY \\
  --query 'Policies[].{이름:Name,ID:Id,관리형:AwsManaged}' --output table

# 특정 OU 에 붙은 정책
aws organizations list-policies-for-target --target-id "$OU_ID" \\
  --filter SERVICE_CONTROL_POLICY --query 'Policies[].Name' --output text
\`\`\`

정책이 실제로 막는지는 거부 로그로 확인한다.

\`\`\`bash
aws cloudtrail lookup-events --max-results 50 \\
  --query 'Events[].CloudTrailEvent' --output text \\
  | python3 -c '
import sys, json
for line in sys.stdin:
    if not line.strip(): continue
    e = json.loads(line)
    if e.get("errorCode") == "AccessDenied" and "Service Control Policy" in str(e.get("errorMessage", "")):
        print(e["eventTime"], e["eventName"], e.get("userIdentity", {}).get("arn", "")[:60])'
\`\`\`

## 실제로 이렇게 터진다

거부 정책을 루트에 붙였다가 배포 파이프라인이 멈춘 사례가 있다. 파이프라인 역할이 그 조건에 걸렸는데, 오류 메시지가 권한 부족으로만 나와 원인을 찾기 어려웠다.

또 하나는 정책을 잔뜩 붙인 뒤 무엇이 왜 막히는지 아무도 설명하지 못하게 된 경우다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 권한을 준다 | 상한을 정할 뿐이다 |
| 관리 계정에도 적용된다 | 적용되지 않는다 |
| 루트 사용자를 막을 수 있다 | 관리 계정 루트는 예외다 |
| 오류가 명확하다 | 일반 권한 오류로 보인다 |
| 붙이면 즉시 확인된다 | 시험 환경에서 먼저 봐야 한다 |

## 실제로 값을 하는 규칙

| 규칙 | 효과 |
| --- | --- |
| 승인된 리전 외 사용 금지 | 매우 높음 — 사각지대를 없앤다 |
| 감사 로그 중지 금지 | 매우 높음 |
| 보안 서비스 비활성화 금지 | 높음 |
| 루트 자격 증명 사용 금지 | 높음 |
| 특정 서비스 금지 | 상황에 따라 |

리전 제한 하나만으로도 탐지 사각지대, 비용, 규정 문제가 함께 줄어든다. 처음 붙일 규칙으로 가장 낫다.

## 안전하게 적용하는 절차

1. 시험 조직 단위를 만들고 계정 하나를 옮긴다
2. 정책을 붙이고 평소 작업을 해 본다
3. 감사 로그에서 거부된 호출을 확인한다
4. 예외가 필요한 역할을 조건으로 제외한다
5. 단계별로 상위 단위에 붙인다

## 예외를 어떻게 다루나

자동화 역할을 통째로 제외하면 상한의 의미가 사라진다. 필요한 동작만 조건으로 좁힌다. 예외마다 사유와 만료일을 문서로 남기고, 만료일에 다시 본다.

\`\`\`bash
# 어떤 단위에 무엇이 붙어 있는지 — 상속을 전부 봐야 한다
aws organizations list-policies-for-target --target-id "$OU" \
  --filter SERVICE_CONTROL_POLICY \
  --query 'Policies[].[Name,Id]' --output table
\`\`\`

## 참고

- AWS Organizations 사용 설명서 — 서비스 제어 정책
- AWS Organizations 요금 (SCP 는 추가 비용 없음)
- NIST SP 800-53, AC-3 접근 시행`,
    diagram: {
      type: 'layers',
      caption: '권한이 결정되는 층',
      layers: [
        { label: '서비스 제어 정책', note: '계정의 상한' },
        { label: '리소스 정책', note: '자원 쪽 허용' },
        { label: 'IAM 정책', note: '주체 쪽 허용' },
        { label: '세션 정책', note: '임시 축소' },
      ],
    },
    diagram2: {
      type: 'steps',
      caption: '적용 범위 확대 순서',
      steps: [
        { label: '테스트 OU', note: '영향 관찰' },
        { label: '거부 로그 확인', note: '정상 업무 차단 여부' },
        { label: '개발 OU', note: '범위 확대' },
        { label: '운영 OU', note: '마지막, 해제 절차 준비' },
      ],
    },
  },
  {
    slug: 'aws-control-tower',
    title: 'AWS Control Tower 도입 판단 기준',
    body: `계정을 여러 개 쓰기 시작하면 계정마다 로그 설정, 기본 통제, 접근 방식이 제각각이 된다. AWS Control Tower 는 이 초기 구성을 정해진 형태로 만들어 주고, 새 계정이 생길 때마다 같은 통제를 자동으로 적용한다. 이미 계정을 여러 개 운영 중이라면 도입 여부를 신중히 판단해야 한다.

## AWS 계정에 무엇이 자동으로 갖춰지는가?

| 항목 | 내용 |
| --- | --- |
| 계정 구조 | 로그 보관·감사 계정 분리 |
| CloudTrail | 조직 추적 자동 구성 |
| Config | 전 계정 활성화 |
| 통제 항목 | 필수·권장·선택 통제 적용 |
| 계정 생성 | 표준 형태로 자동 생성 |
| IAM Identity Center | 접근 관리 연결 |

![새 계정이 표준 형태로 만들어진다](/img/posts/aws-control-tower.svg)

## 통제 항목의 세 가지 성격

- **예방 통제** — 서비스 제어 정책으로 아예 못 하게 막는다
- **탐지 통제** — Config 규칙으로 위반을 찾아낸다
- **사전 예방 통제** — 인프라 코드 배포 시점에 거부한다

필수 통제는 끌 수 없고, 나머지는 조직 단위별로 켜고 끌 수 있다. 어떤 통제를 어느 단위에 적용할지가 실제 설계다.

## 이미 계정이 있다면

기존 계정을 등록할 수 있지만 제약이 있다. 이미 쓰고 있는 CloudTrail 구성이나 Config 설정과 충돌할 수 있고, 등록 과정에서 일부 설정이 바뀐다. 그래서 다음을 먼저 확인한다.

\`\`\`
확인할 것
  기존 조직 추적과의 중복 — 비용 이중 부담
  기존 Config 기록기 설정 충돌
  계정 구조가 Control Tower 가정과 맞는지
  사용 중인 지역이 지원 범위에 있는지
  기존 SCP 와의 충돌
\`\`\`

![신규 도입과 기존 환경 등록](/img/posts/aws-control-tower-2.svg)

## 비용은 어떻게 붙는가

**Control Tower 자체에는 요금이 없다.** 대신 켜지는 서비스의 비용이 든다.

- CloudTrail — 조직 추적 (첫 사본은 무료, 추가 추적은 과금)
- Config — 설정 항목 기록과 규칙 평가. 대개 여기서 가장 크다
- S3 — 로그 저장
- IAM Identity Center — 무료
- 기타 통제가 켜는 서비스

즉 실질 비용은 Config 다. 통제 항목을 많이 켤수록 규칙 평가가 늘어나므로, 계정 수와 자원 수를 곱해 규모를 가늠해야 한다.

## 도입하지 않는 선택도 있다

계정이 두세 개이고 구성이 단순하면 Organizations 와 SCP, 조직 추적을 직접 구성하는 편이 유연하다. Control Tower 는 표준 형태를 강제하므로, 이미 다른 방식으로 잘 굴러가는 환경에서는 제약이 될 수 있다.

## 바로 확인하기

랜딩 존 상태와 통제 적용 현황을 본다.

\`\`\`bash
aws controltower list-landing-zones --query 'landingZones[].arn' --output text

# 적용된 통제
aws controltower list-enabled-controls --target-identifier "$OU_ARN" \\
  --query 'enabledControls[].{통제:controlIdentifier,상태:statusSummary.status}' --output table
\`\`\`

Config 비용의 주원인을 확인한다.

\`\`\`bash
# 기록 항목이 많은 자원 유형 — 여기서 비용이 결정된다
aws configservice get-discovered-resource-counts \\
  --query 'resourceCounts[].{유형:resourceType,수:count}' --output table | head -15
\`\`\`

## 실제로 이렇게 터진다

이미 계정이 수십 개인 상태에서 도입하려다 막힌 사례가 있다. 기존 계정의 구성이 제각각이라 등록 과정에서 계속 실패했다. 결과적으로 새 계정만 관리 대상이 되고 기존 계정은 그대로 남았다.

가드레일을 우회해 직접 자원을 만든 경우도 있다. 관리 밖 자원이 늘면 도구의 그림이 실제와 달라진다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 기존 환경에 쉽게 얹는다 | 기존 계정 등록이 가장 어렵다 |
| 모든 것을 관리해 준다 | 계정 구조와 기본 통제까지다 |
| 나중에 구조를 바꾸기 쉽다 | 초기 설계가 오래 간다 |
| 가드레일을 끄면 된다 | 필수 항목은 끌 수 없다 |
| 추가 비용이 없다 | 구성 요소 서비스 비용이 붙는다 |

## 도입 전에 정해야 할 것

| 결정 | 왜 나중에 바꾸기 어려운가 |
| --- | --- |
| 조직 단위 구조 | 정책 상속의 기준이 된다 |
| 로그 보관 계정과 기간 | 이관이 번거롭다 |
| 계정 발급 절차 | 팀 습관이 굳는다 |
| 공유 네트워크 설계 | 주소 대역 변경이 어렵다 |
| 리전 범위 | 나중에 넓히면 사각지대가 남는다 |

이 다섯 가지를 문서로 정한 뒤 시작한다. 도구가 대신 정해 주지 않는다.

## 이미 계정이 많다면

1. 계정을 용도별로 분류한다 — 운영·개발·시험·폐기 예정
2. 폐기 예정을 먼저 정리한다
3. 표준 구성에 가까운 계정부터 등록한다
4. 어긋나는 계정은 무엇이 다른지 목록으로 만든다
5. 등록 불가 계정은 별도 단위로 두고 정책만 적용한다

전부 등록하려다 멈추는 것보다, 절반을 등록하고 나머지를 목록으로 관리하는 편이 낫다.

\`\`\`bash
# 등록된 계정과 표류 상태
aws controltower list-enabled-controls --target-identifier "$OU" \
  --query 'enabledControls[].[controlIdentifier,statusSummary.status]' --output table
\`\`\`

## 참고

- AWS Control Tower 사용 설명서 — 통제 항목 참조
- AWS Control Tower 요금 (서비스 자체는 무료)
- AWS Well-Architected Framework 보안 기둥`,
    diagram: {
      type: 'steps',
      caption: '계정이 만들어지는 과정',
      steps: [
        { label: '계정 요청', note: '표준 양식' },
        { label: '자동 생성', note: 'OU 배치' },
        { label: '통제 적용', note: '예방·탐지·사전' },
        { label: '접근 연결', note: 'Identity Center' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '도입 판단',
      x: ['신규 구축', '기존 환경'],
      y: ['계정 다수', '계정 소수'],
      cells: ['도입 효과 큼', '등록 전 충돌 검토', '과할 수 있음', '직접 구성이 유연'],
    },
  },
  {
    slug: 'aws-verified-access',
    title: 'Verified Access 로 VPN 없이 접근하기',
    body: `사내 웹 애플리케이션에 접근하려고 VPN 을 붙이면, 붙는 순간 대역 전체가 보인다. Verified Access 는 애플리케이션 단위로 접근을 판단해 VPN 없이 연결해 준다. 요청마다 사용자 신원과 기기 상태를 확인하므로, 제로 트러스트 방식을 AWS 안에서 구현하는 선택지가 된다.

## 무엇이 달라지는가?

| 항목 | VPN | Verified Access |
| --- | --- | --- |
| 접근 단위 | 네트워크 대역 | 애플리케이션 |
| 판단 시점 | 접속 시 1회 | 요청마다 |
| 판단 근거 | 자격 증명 | 사용자 + 기기 상태 + 맥락 |
| 클라이언트 | VPN 앱 필요 | 브라우저만 (웹의 경우) |
| 로그 | 접속 로그 | 요청별 접근 로그 |

![대역 접근과 애플리케이션 단위 접근](/img/posts/aws-verified-access.svg)

## 정책은 무엇으로 쓰는가

정책 언어로 조건을 표현한다. 사용자 그룹, 기기 상태, 시간, 위치 같은 값을 조합할 수 있다. 조건을 코드로 관리하면 검토와 이력이 남는다.

\`\`\`
permit(principal, action, resource)
when {
  context.identity.groups.contains("platform-eng") &&
  context.device.risk_score < 30 &&
  context.identity.email_verified == true
};
\`\`\`

## 기기 상태를 넣어야 의미가 있다

사용자 인증만으로는 VPN 과 크게 다르지 않다. 기기 관리 도구와 연동해 디스크 암호화, 보안 업데이트, 보호 도구 동작 여부를 판단에 넣어야 실질적인 차이가 생긴다. 이 연동이 없으면 이름만 바뀐 VPN 이 된다.

![판단에 들어가는 신호](/img/posts/aws-verified-access-2.svg)

## 비용은 어떻게 붙는가

두 축이다.

- **애플리케이션 시간** — 연결한 애플리케이션(엔드포인트) 수 × 시간
- **처리 데이터양(GB)** — 통과한 트래픽

애플리케이션 수가 고정비이므로, 소수의 내부 도구만 있다면 부담이 작다. 반대로 내부 애플리케이션이 수십 개면 고정비가 커지므로 묶을 수 있는 것은 묶는다.

여기에 신뢰 공급자 쪽 비용(기기 관리 도구 등)은 별도다.

## 무엇에 적합한가

웹 기반 내부 도구가 가장 잘 맞는다. 데이터베이스 접속이나 SSH 같은 프로토콜은 별도 방식이 필요하다. 그래서 전면 대체보다는 VPN 사용 범위를 줄여 가는 수단으로 보는 것이 현실적이다.

## 바로 확인하기

인스턴스와 정책, 로그 설정을 본다.

\`\`\`bash
aws ec2 describe-verified-access-instances \\
  --query 'VerifiedAccessInstances[].{ID:VerifiedAccessInstanceId,설명:Description}' --output table

aws ec2 describe-verified-access-groups \\
  --query 'VerifiedAccessGroups[].{그룹:VerifiedAccessGroupId,정책적용:PolicyEnabled}' --output table
\`\`\`

접근 로그가 남는지 확인한다. 이 로그가 없으면 누가 무엇에 접근했는지 알 수 없다.

\`\`\`bash
aws ec2 describe-verified-access-instance-logging-configurations \\
  --query 'LoggingConfigurations[].{인스턴스:VerifiedAccessInstanceId,대상:AccessLogs}' --output json
\`\`\`

## 실제로 이렇게 터진다

VPN 을 걷어내려고 도입했다가 정책을 단말 조건 없이 만든 사례가 있다. 신원만 확인하고 단말 상태는 보지 않았으니, 관리되지 않는 개인 노트북에서도 내부 앱에 접속됐다.

또 하나는 로그를 남기지 않아, 누가 언제 어떤 앱에 접근했는지 확인할 수 없게 된 경우다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| VPN 을 완전히 대체한다 | HTTP 앱 중심이다 |
| 신원만 보면 된다 | 단말 상태가 절반이다 |
| 도입하면 제로 트러스트다 | 한 조각일 뿐이다 |
| 정책이 단순하다 | 조건을 제대로 쓰면 복잡하다 |
| 로그가 자동으로 남는다 | 설정해야 한다 |

## 어떤 조건을 넣어야 하나

| 조건 | 필요성 |
| --- | --- |
| 신원 제공자 그룹 | 필수 |
| 단말 관리 여부 | 필수 |
| 단말 보안 상태 | 권장 |
| 접속 위치 | 상황에 따라 |
| 시간대 | 민감 앱에 한해 |

신원과 단말을 함께 보지 않으면 기존 VPN 과 실질적으로 같다.

## VPN 과 비교

| 항목 | VPN | 이 방식 |
| --- | --- | --- |
| 접근 단위 | 네트워크 | 애플리케이션 |
| 횡적 이동 | 가능 | 제한 |
| 단말 조건 | 대개 없음 | 정책에 포함 |
| 대상 | 모든 프로토콜 | 주로 HTTP |
| 감사 | 접속 로그 | 요청 단위 |

SSH 나 데이터베이스 접속은 여전히 다른 수단이 필요하다. 전부를 대체한다고 계획하면 도입이 실패한다.

\`\`\`bash
# 정책이 붙어 있는지 — 비어 있으면 신원만 보는 상태다
aws ec2 describe-verified-access-groups \
  --query 'VerifiedAccessGroups[].[VerifiedAccessGroupId,PolicyDocument]' --output text | head
\`\`\`

## 참고

- AWS Verified Access 사용 설명서
- AWS Verified Access 요금 페이지
- NIST SP 800-207, Zero Trust Architecture`,
    diagram: {
      type: 'flow',
      caption: '요청마다 이루어지는 판단',
      steps: [
        { label: '사용자 요청', note: '브라우저에서' },
        { label: '신원 확인', note: 'IdP 연동' },
        { label: '기기 상태 확인', note: '관리 도구 신호' },
        { label: '애플리케이션 연결', note: '조건 충족 시에만' },
      ],
    },
    diagram2: {
      type: 'layers',
      caption: '판단에 들어가는 신호',
      layers: [
        { label: '사용자 신원', note: '그룹·인증 수단' },
        { label: '기기 상태', note: '암호화·패치·보호 도구' },
        { label: '맥락', note: '시간·위치' },
        { label: '자원 조건', note: '애플리케이션별 정책' },
      ],
    },
  },
  {
    slug: 'aws-vpc-endpoint-policy',
    title: 'VPC 엔드포인트 정책으로 반출 막기',
    body: `S3 로 나가는 트래픽을 사설 경로로 바꾸면 인터넷 노출은 사라진다. 그런데 그것만으로는 우리 계정의 자격 증명으로 남의 버킷에 데이터를 올리는 것을 막지 못한다. VPC 엔드포인트 정책과 관련 조건을 함께 쓰면 "우리 조직의 버킷으로만" 같은 제한을 네트워크 경로에 걸 수 있다. 데이터 반출 통제의 핵심 장치다.

## 무엇을 막을 수 있는가?

| 통제 | 내용 |
| --- | --- |
| 엔드포인트 정책 | 이 경로로 접근 가능한 자원 제한 |
| 조직 조건 | 우리 조직 소속 자원만 허용 |
| 자원 정책 조건 | 지정한 VPC·엔드포인트에서만 접근 |
| 신뢰 자격 증명 조건 | 우리 조직 주체만 허용 |

이 조합이 갖춰지면 내부에서 외부 버킷으로 데이터를 밀어 넣는 경로가 닫힌다.

![사설 경로에 조건을 거는 구조](/img/posts/aws-vpc-endpoint-policy.svg)

## 두 방향을 모두 본다

반출은 두 방향에서 일어난다. 우리 자격 증명으로 남의 자원에 쓰는 방향과, 남의 자격 증명으로 우리 자원을 읽는 방향이다. 각각 다른 조건으로 막는다.

\`\`\`
우리 → 외부 자원   엔드포인트 정책에 조직 소속 자원 조건
외부 → 우리 자원   자원 정책에 조직 소속 주체 조건
경로 강제          자원 정책에 지정 엔드포인트 조건
\`\`\`

## 게이트웨이와 인터페이스 엔드포인트

S3 와 DynamoDB 는 게이트웨이 엔드포인트를 쓸 수 있고 이것은 비용이 없다. 나머지 서비스는 인터페이스 엔드포인트를 쓰고 시간당·처리량 과금이 붙는다. 그래서 S3 반출 통제는 비용 부담 없이 바로 적용할 수 있다.

![엔드포인트 유형과 비용](/img/posts/aws-vpc-endpoint-policy-2.svg)

## 비용은 어떻게 붙는가

- **게이트웨이 엔드포인트** — 요금 없음 (S3, DynamoDB)
- **인터페이스 엔드포인트** — 가용 영역별 시간당 요금 + 처리 데이터양
- **엔드포인트 정책** — 추가 요금 없음

인터페이스 엔드포인트를 서비스마다 만들면 고정비가 빠르게 는다. 실제로 쓰는 서비스만 만들고, 여러 VPC 에서 공유할 수 있는 구성을 검토한다. 반대로 NAT 게이트웨이를 거치던 트래픽이 엔드포인트로 바뀌면 NAT 처리 비용이 줄어 상쇄되기도 한다.

## 적용 순서

한 번에 강하게 걸면 정상 통신이 끊긴다. 로그로 관찰한 뒤 좁힌다.

\`\`\`
1. 엔드포인트를 만들고 정책은 전체 허용으로 시작
2. CloudTrail 로 실제 접근 대상 파악
3. 조직 소속 자원만 허용하는 조건 추가
4. 예외가 필요한 외부 버킷을 명시적으로 허용
5. 자원 정책에도 엔드포인트 조건 추가
\`\`\`

## 바로 확인하기

엔드포인트와 정책을 본다.

\`\`\`bash
aws ec2 describe-vpc-endpoints \\
  --query 'VpcEndpoints[].{서비스:ServiceName,유형:VpcEndpointType,VPC:VpcId,정책있음:PolicyDocument!=null}' \\
  --output table
\`\`\`

외부 버킷으로 나가는지 실제로 시험한다.

\`\`\`bash
# 조직 밖 버킷에 쓰기 — 차단돼야 한다
aws s3 cp /tmp/test.txt s3://external-bucket-not-ours/test.txt 2>&1 | tail -2

# 우리 버킷은 정상 동작해야 한다
aws s3 cp /tmp/test.txt s3://our-internal-bucket/test.txt && echo '정상'
\`\`\`

## 실제로 이렇게 터진다

엔드포인트를 만들어 트래픽을 내부로 돌렸지만 정책을 기본값으로 둔 사례가 있다. 기본 정책은 모든 접근을 허용하므로, 내부 경로를 통해 외부 계정의 버킷으로 데이터를 보낼 수 있었다. 유출 통제를 했다고 생각했지만 실제로는 경로만 바꾼 셈이었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 엔드포인트를 쓰면 안전하다 | 기본 정책은 전부 허용이다 |
| 외부로 못 나간다 | 다른 계정 자원에 접근된다 |
| 자원 정책이면 충분하다 | 우리 자원만 통제한다 |
| 정책이 복잡하다 | 조직 조건 한 줄이면 시작된다 |
| 성능에 영향이 있다 | 오히려 경로가 짧아진다 |

## 세 가지 정책의 역할

| 정책 | 통제 대상 |
| --- | --- |
| 자원 정책 | 내 자원에 누가 접근하나 |
| 신원 정책 | 내 주체가 무엇에 접근하나 |
| 엔드포인트 정책 | 이 경로로 어디에 접근하나 |

세 번째가 데이터 유출 통제의 핵심이다. 앞의 둘로는 "우리 자격 증명으로 외부 계정 버킷에 쓰는 행위" 를 막기 어렵다.

## 최소한 넣어야 할 조건

우리 조직의 자원에만 접근하도록 제한한다.

\`\`\`json
{
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "*",
    "Resource": "*",
    "Condition": {
      "StringEquals": { "aws:ResourceOrgID": "o-example" }
    }
  }]
}
\`\`\`

공개 저장소나 외부 협력사 버킷을 써야 한다면 그 자원만 예외로 나열한다. 전면 허용으로 되돌리지 않는다.

## 점검

\`\`\`bash
# 기본 정책 그대로인 엔드포인트 — 조건이 없으면 전부 허용이다
aws ec2 describe-vpc-endpoints \
  --query 'VpcEndpoints[].[VpcEndpointId,ServiceName,PolicyDocument]' --output text \
  | grep -v ResourceOrgID | cut -f1,2
\`\`\`

엔드포인트를 만드는 시점에 정책을 함께 정하는 것이 원칙이다. 나중에 붙이려면 무엇이 깨질지 몰라 손대지 못하게 된다.

## 참고

- Amazon VPC 엔드포인트 정책 사용 설명서
- AWS PrivateLink 요금 페이지
- AWS 데이터 경계(Data Perimeter) 백서`,
    diagram: {
      type: 'matrix',
      caption: '반출 통제 조합',
      x: ['조직 조건 있음', '없음'],
      y: ['사설 경로', '인터넷 경로'],
      cells: ['반출 차단', '남의 버킷으로 가능', '노출 + 반출 가능', '가장 위험'],
    },
    diagram2: {
      type: 'bars',
      caption: '엔드포인트 유형별 고정비',
      unit: '상대값',
      items: [
        { label: '게이트웨이(S3·DynamoDB)', value: 0, note: '요금 없음' },
        { label: '인터페이스 1개', value: 25 },
        { label: '인터페이스 5개', value: 100, note: '영역 수만큼 곱해진다' },
      ],
    },
  },
]
