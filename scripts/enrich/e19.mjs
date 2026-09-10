const R = String.raw
export default {

'dns-rebinding': R`## 실제로 이렇게 터진다

내부 대역 검증을 통과한 뒤 실제 연결에서 내부로 간 사례가 있다. 도메인을 검사할 때는 공인 주소를 응답했고, 실제 요청 시점에는 내부 주소를 응답했다. 검사와 사용 사이의 시간 차를 이용한 것이다.

브라우저에서도 성립한다. 사용자가 공격자 페이지를 열어 두면, 그 페이지가 사용자의 내부망 기기에 요청을 보낼 수 있다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 주소를 검사하면 안전하다 | 검사 후 바뀔 수 있다 |
| 짧은 캐시가 문제다 | 캐시가 없어도 성립한다 |
| 서버만 해당한다 | 브라우저에서도 성립한다 |
| 내부 서비스는 인증이 있다 | 없는 경우가 많다 |
| 드문 공격이다 | 도구가 공개돼 있다 |

## 어떻게 막는가

| 조치 | 적용 |
| --- | --- |
| 해석된 주소로 연결 | 이름을 다시 해석하지 않는다 |
| 연결 직전 재검증 | 소켓 단계에서 확인 |
| 최소 캐시 시간 강제 | 리졸버 설정 |
| 내부 서비스에 인증 | 근본 대책 |
| Host 헤더 검증 | 예상한 이름만 처리 |

핵심은 검사한 주소로 직접 연결하는 것이다. 이름으로 다시 연결하면 그 사이에 바뀔 수 있다.

\`\`\`ts
import { lookup } from 'node:dns/promises'
import ipaddr from 'ipaddr.js'
import http from 'node:http'

const DENY = ['private', 'loopback', 'linkLocal', 'uniqueLocal', 'reserved']

async function safeFetch(urlStr: string) {
  const url = new URL(urlStr)
  const { address } = await lookup(url.hostname)
  if (DENY.includes(ipaddr.parse(address).range())) throw new Error('내부 주소')

  // 검사한 주소로 직접 연결하고, Host 헤더만 원래 이름으로 둔다
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: address,                      // 이름이 아니라 주소로
      port: url.port || 80,
      path: url.pathname + url.search,
      headers: { Host: url.hostname },
    }, resolve)
    req.on('error', reject)
    req.end()
  })
}
\`\`\`

내부 서비스에 인증을 붙이는 것이 근본 대책이다. 재바인딩이 성립해도 인증이 없으면 아무것도 못 한다.

\`\`\`bash
# 내부 서비스가 인증 없이 응답하는지
for h in $(cat internal-hosts.txt); do
  c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://$h/")
  [ "$c" = "200" ] && echo "$h 인증 없이 200"
done
\`\`\``,

'service-mesh-mtls': R`## 실제로 이렇게 터진다

상호 TLS 를 켰다고 했는데 평문 허용 모드였던 사례가 있다. 전환 중 호환을 위해 허용 모드로 두었고 그대로 남았다. 암호화되지 않은 통신이 계속 있었지만 지표를 보지 않았다.

인증서 만료로 전 서비스가 멈춘 경우도 있다. 자동 갱신이 한 컴포넌트에서만 실패했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 켜면 전부 암호화된다 | 허용 모드면 평문도 통과한다 |
| 상호 TLS 면 인가까지 된다 | 누구인지만 안다 |
| 사이드카가 알아서 한다 | 사이드카가 빠진 파드가 있다 |
| 인증서는 자동이라 안심이다 | 갱신 실패를 감시해야 한다 |
| 내부망이라 불필요하다 | 확산 차단 효과가 크다 |

## 전환 순서

한 번에 강제하면 통신이 끊긴다. 단계를 나눈다.

1. 사이드카를 전 워크로드에 주입한다 — 빠진 것을 먼저 찾는다
2. 허용 모드로 두고 평문 비율 지표를 본다
3. 평문 통신을 하나씩 없앤다 — 대개 외부 연동과 레거시
4. 네임스페이스 단위로 강제 모드로 올린다
5. 전체 강제 후에도 평문 지표를 감시한다

\`\`\`bash
# 사이드카가 빠진 파드 — 강제 모드로 올리면 통신이 끊긴다
kubectl get pods -A -o json |
python3 -c 'import sys,json
for p in json.load(sys.stdin)["items"]:
    names = [c["name"] for c in p["spec"]["containers"]]
    if "istio-proxy" not in names:
        print(p["metadata"]["namespace"], p["metadata"]["name"])'

# 네임스페이스별 상호 TLS 모드
kubectl get peerauthentication -A \
  -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,MODE:.spec.mtls.mode
\`\`\`

## 인가는 별도로 둔다

상호 TLS 는 "누가 부르는가" 만 답한다. "무엇을 할 수 있는가" 는 인가 정책이다.

\`\`\`yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata: { name: billing-allow, namespace: prod }
spec:
  selector: { matchLabels: { app: billing } }
  action: ALLOW
  rules:
    - from: [{ source: { principals: ['cluster.local/ns/prod/sa/orders'] } }]
      to: [{ operation: { methods: ['GET', 'POST'], paths: ['/internal/*'] } }]
\`\`\`

기본 거부 정책을 함께 두지 않으면 이 허용 정책은 의미가 없다.`,

'private-link': R`## 실제로 이렇게 터진다

데이터베이스를 인터넷에 노출한 채로 방화벽으로만 막은 사례가 있다. 규칙 하나가 잘못 열리자 즉시 스캔에 잡혔다. 애초에 공인 주소가 없었다면 규칙 실수가 사고로 이어지지 않았다.

관리형 서비스도 마찬가지다. 기본 설정이 공개 엔드포인트인 경우가 많다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 방화벽으로 막으면 된다 | 규칙 실수 한 번이면 열린다 |
| 공인 주소가 있어도 접근은 통제된다 | 스캔 대상이 된다 |
| 사설 연결은 복잡하다 | 대부분 설정 몇 줄이다 |
| 내부 통신은 이미 사설이다 | 관리형 서비스는 공개 경로를 쓴다 |
| 비용이 더 든다 | 데이터 전송 비용이 오히려 줄기도 한다 |

## 무엇을 사설로 옮기는가

| 대상 | 우선순위 |
| --- | --- |
| 데이터베이스 | 최우선 |
| 캐시·검색 | 높음 |
| 오브젝트 스토리지 | 높음 — 반출 통제도 함께 |
| 비밀 관리 서비스 | 높음 |
| 컨테이너 레지스트리 | 중간 |
| 관리 API | 중간 |

스토리지를 사설 엔드포인트로 옮기면 반출 통제도 함께 가능해진다. 엔드포인트 정책으로 우리 버킷만 허용하면, 침해되어도 외부 버킷으로 데이터를 보낼 수 없다.

\`\`\`json
{
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": ["s3:GetObject", "s3:PutObject"],
    "Resource": ["arn:aws:s3:::our-bucket/*"],
    "Condition": { "StringEquals": { "aws:PrincipalAccount": "111122223333" } }
  }]
}
\`\`\`

## 점검 절차

\`\`\`bash
# 공인 주소가 붙은 데이터베이스
aws rds describe-db-instances \
  --query 'DBInstances[?PubliclyAccessible==\`true\`].[DBInstanceIdentifier,Endpoint.Address]' \
  --output table

# 사설 엔드포인트가 없는 서비스
aws ec2 describe-vpc-endpoints \
  --query 'VpcEndpoints[].[ServiceName,VpcEndpointType,State]' --output table
\`\`\``,

'nat-egress-ip': R`## 실제로 이렇게 터진다

협력사가 우리 접속 주소를 허용 목록에 넣어야 했는데, 주소가 계속 바뀐 사례가 있다. 인스턴스마다 다른 공인 주소로 나갔고, 확장하면 새 주소가 생겼다. 연동이 간헐적으로 실패했다.

반대로 주소를 고정했는데 그 주소가 노출돼 표적이 된 경우도 있다. 아웃바운드 전용인데 인바운드도 열려 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 나가는 주소는 신경 안 써도 된다 | 상대가 허용 목록을 요구한다 |
| 고정하면 관리가 끝난다 | 확장·리전 추가 시 늘어난다 |
| 주소가 곧 인증이다 | 보조 수단일 뿐이다 |
| 하나면 충분하다 | 가용성을 위해 여러 개 필요하다 |
| 노출돼도 무해하다 | 공격 표면이 된다 |

## 어떻게 구성하는가

| 항목 | 권장 |
| --- | --- |
| 개수 | 가용 영역마다 하나 이상 |
| 안정성 | 탄력적 주소로 고정 |
| 문서화 | 주소 목록과 용도를 관리 |
| 통지 | 변경 시 상대에게 사전 통지 |
| 인바운드 | 완전 차단 |
| 대체 | 주소 대신 상호 TLS 나 서명 |

주소 기반 허용은 보조 수단이다. 상대가 요구하면 제공하되, 인증은 별도로 둔다.

## 주소가 늘어나는 것을 관리한다

1. 나가는 주소 목록을 한곳에서 관리한다
2. 새 리전·가용 영역 추가 시 목록을 갱신한다
3. 상대에게 알릴 절차와 기한을 정한다
4. 목록을 공개 가능한 형태로 제공한다 — 문서나 API
5. 사용하지 않는 주소는 회수한다

\`\`\`bash
# 지금 나가는 주소 목록 — 상대에게 줄 자료
aws ec2 describe-nat-gateways \
  --query 'NatGateways[?State==\`available\`].[NatGatewayId,NatGatewayAddresses[].PublicIp]' \
  --output text

# 실제로 어떤 주소로 나가는지 확인 — 서버에서
curl -s https://api.ipify.org; echo
\`\`\`

여러 서버에서 같은 값이 나와야 고정된 것이다. 다르면 경로가 여러 개다.`,

'load-balancer-headers': R`## 실제로 이렇게 터진다

접속 주소를 헤더에서 그대로 읽은 사례가 있다. 클라이언트가 그 헤더를 직접 보내자 원하는 주소로 위장할 수 있었다. 주소 기반 차단과 한도가 모두 우회됐다.

반대로 프록시를 신뢰하지 않아 모든 접속이 같은 주소로 보인 경우도 있다. 한도가 전체에 걸려 정상 사용자가 막혔다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 헤더에 있는 주소가 실제다 | 클라이언트가 넣을 수 있다 |
| 첫 번째 값이 실제다 | 신뢰 경계에 따라 다르다 |
| 마지막 값이 안전하다 | 프록시 수를 알아야 한다 |
| 프레임워크가 알아서 한다 | 설정해야 동작한다 |
| 하나만 보면 된다 | 여러 헤더가 섞여 온다 |

## 어떻게 판별하는가

신뢰하는 프록시 수를 알아야 한다. 그 수만큼 뒤에서 세어 가져온다.

| 상황 | 방법 |
| --- | --- |
| 프록시 1단 | 헤더의 마지막 값 |
| 프록시 여러 단 | 신뢰 홉 수만큼 뒤에서 |
| 클라우드 로드밸런서 | 전용 헤더 사용 |
| CDN + 로드밸런서 | CDN 전용 헤더 우선 |

가장 확실한 것은 앞단에서 헤더를 덮어쓰는 것이다. 클라이언트가 보낸 값을 지우고 우리가 다시 쓴다.

\`\`\`nginx
# 클라이언트가 보낸 값을 무시하고 우리가 정한다
proxy_set_header X-Forwarded-For $remote_addr;      # 덧붙이지 않고 덮어쓴다
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
\`\`\`

\`\`\`ts
// 신뢰 홉 수를 명시한다 — 자동 추론에 맡기지 않는다
app.set('trust proxy', 2)     // CDN + 로드밸런서

// 직접 파싱한다면 뒤에서 세어 온다
function clientIp(req, trustedHops = 2) {
  const chain = (req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim())
  return chain[chain.length - trustedHops] ?? req.socket.remoteAddress
}
\`\`\`

\`\`\`bash
# 헤더를 위조해 보내 봤을 때 그대로 반영되는지
curl -s https://stg.example.com/api/whoami -H 'X-Forwarded-For: 1.2.3.4'
# 응답에 1.2.3.4 가 나오면 위조가 가능하다
\`\`\``,
}
