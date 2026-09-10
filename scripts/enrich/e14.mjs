const R = String.raw
export default {

'cloud-metadata': R`## 실제로 이렇게 터진다

서버 측 요청 위조 하나로 계정이 넘어간 사례에서, 경로는 언제나 같다. 애플리케이션이 사용자가 준 주소로 요청을 보내고, 그 주소가 메타데이터 엔드포인트였다. 응답에는 인스턴스 역할의 임시 자격 증명이 들어 있었다.

컨테이너 환경에서는 더 넓다. 호스트의 메타데이터가 파드에서도 보이면, 파드 하나가 노드 역할 권한을 갖는다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 내부 주소라 외부에서 못 닿는다 | 서버가 대신 요청한다 |
| 토큰 필수 모드면 끝이다 | 구버전 허용이 남아 있는 경우가 많다 |
| 컨테이너는 격리돼 있다 | 기본은 호스트 메타데이터가 보인다 |
| 역할 권한이 좁아서 괜찮다 | 대개 생각보다 넓다 |
| 애플리케이션만 고치면 된다 | 인프라 설정이 더 확실하다 |

## 층을 겹친다

| 층 | 조치 |
| --- | --- |
| 메타데이터 | 토큰 필수 모드, 응답 홉 제한 |
| 컨테이너 | 파드에서 메타데이터 접근 차단 |
| 역할 | 권한 최소화, 조건 부여 |
| 애플리케이션 | 아웃바운드 주소 검증 |
| 네트워크 | 외부 호출 전용 워커 분리 |

응답 홉 제한이 효과가 크다. 값을 1로 두면 컨테이너 안에서 온 요청은 응답을 받지 못한다.

## 점검과 적용

\`\`\`bash
# 토큰 없이 응답하는 인스턴스 찾기
aws ec2 describe-instances \
  --query 'Reservations[].Instances[].[InstanceId,MetadataOptions.HttpTokens,MetadataOptions.HttpPutResponseHopLimit]' \
  --output text | awk '$2!="required" || $3>1'

# 토큰 필수로 전환하고 홉 제한을 건다
aws ec2 modify-instance-metadata-options --instance-id i-0abc \
  --http-tokens required --http-put-response-hop-limit 1 --http-endpoint enabled
\`\`\`

전환 전에 애플리케이션이 새 방식을 지원하는지 확인한다. 오래된 SDK 는 토큰 요청을 하지 않는다.`,

'cross-account-role': R`## 실제로 이렇게 터진다

외부 업체에 역할 수임 권한을 주면서 신뢰 정책에 계정 번호만 넣은 사례가 있다. 그 업체는 여러 고객을 같은 계정에서 관리했고, 다른 고객이 우리 역할 이름을 추측해 수임할 수 있었다. 이른바 혼란된 대리인 문제다.

내부에서도 같은 일이 생긴다. 개발 계정 역할이 운영 계정 역할을 수임할 수 있게 열어 두면 계정 분리가 무의미해진다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 계정 번호를 지정하면 안전하다 | 그 계정의 누구나 수임할 수 있다 |
| 역할 이름을 어렵게 하면 된다 | 추측이 아니라 문서에 적혀 있다 |
| 외부 ID 는 비밀이 아니다 | 비밀은 아니지만 조건으로 작동한다 |
| 읽기 전용이면 위험이 낮다 | 설정과 자격 증명이 다 읽힌다 |
| 한 번 주면 회수가 어렵다 | 신뢰 정책 한 줄이다 |

## 신뢰 정책에 무엇을 넣는가

| 조건 | 막는 것 |
| --- | --- |
| 외부 ID | 혼란된 대리인 |
| 출발지 계정 | 다른 계정의 수임 |
| 출발지 역할 지정 | 그 계정의 다른 주체 |
| 다단계 인증 여부 | 사람 수임 시 |
| 출발지 대역 | 예상 밖 위치 |
| 세션 시간 제한 | 장기 사용 |

외부 업체에는 외부 ID 를 반드시 요구한다. 업체가 우리마다 다른 값을 쓰면 고객 간 혼선이 막힌다.

\`\`\`json
{
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::999988887777:root" },
  "Action": "sts:AssumeRole",
  "Condition": {
    "StringEquals": { "sts:ExternalId": "우리만의-무작위-값" },
    "Bool": { "aws:MultiFactorAuthPresent": "true" }
  }
}
\`\`\`

## 점검 절차

\`\`\`bash
# 조건 없이 외부 계정을 신뢰하는 역할
aws iam list-roles --query 'Roles[].[RoleName,AssumeRolePolicyDocument]' --output json |
python3 -c 'import sys,json,urllib.parse
for name, doc in json.load(sys.stdin):
    d = doc if isinstance(doc, dict) else json.loads(urllib.parse.unquote(doc))
    for s in d.get("Statement", []):
        p = s.get("Principal", {})
        if p.get("AWS") and not s.get("Condition"):
            print("조건 없음:", name, p["AWS"])'
\`\`\``,

'container-runtime': R`## 실제로 이렇게 터진다

컨테이너 하나가 침해된 뒤 노드 전체가 넘어간 사례에서, 그 컨테이너는 특권 모드로 돌고 있었다. 개발 중 편의를 위해 켰고 그대로 배포됐다.

도커 소켓을 마운트한 경우도 흔하다. 컨테이너 안에서 다른 컨테이너를 만들 수 있으니, 사실상 호스트 권한이다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 컨테이너는 가상머신처럼 격리된다 | 커널을 공유한다 |
| 루트로 실행해도 컨테이너 안이다 | 탈출 시 호스트 루트가 된다 |
| 특권 모드는 편의 기능이다 | 격리를 사실상 해제한다 |
| 소켓 마운트는 흔한 방식이다 | 호스트 제어권을 주는 것이다 |
| 이미지가 작으면 안전하다 | 실행 권한이 더 중요하다 |

## 탈출 경로

| 설정 | 위험 |
| --- | --- |
| 특권 모드 | 거의 모든 격리 해제 |
| 도커 소켓 마운트 | 호스트 제어 |
| 호스트 네임스페이스 공유 | 프로세스·네트워크 노출 |
| 호스트 경로 쓰기 마운트 | 파일 조작으로 탈출 |
| 위험한 커널 권한 추가 | 모듈 적재·장치 접근 |
| 루트 사용자 실행 | 탈출 시 권한 상속 |

## 무엇을 강제하는가

\`\`\`yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
  seccompProfile:
    type: RuntimeDefault
\`\`\`

정책으로 클러스터 전체에 강제하면 개별 배포에서 빠뜨려도 막힌다.

\`\`\`bash
# 특권 모드나 위험한 마운트를 쓰는 파드
kubectl get pods -A -o json |
python3 -c 'import sys,json
for p in json.load(sys.stdin)["items"]:
    ns, name = p["metadata"]["namespace"], p["metadata"]["name"]
    if p["spec"].get("hostPID") or p["spec"].get("hostNetwork"):
        print(ns, name, "호스트 네임스페이스")
    for v in p["spec"].get("volumes") or []:
        hp = (v.get("hostPath") or {}).get("path", "")
        if "docker.sock" in hp or hp in ("/", "/etc", "/var/run"):
            print(ns, name, "위험한 마운트", hp)
    for c in p["spec"]["containers"]:
        sc = c.get("securityContext") or {}
        if sc.get("privileged"): print(ns, name, c["name"], "특권 모드")
        if sc.get("allowPrivilegeEscalation") is not False: print(ns, name, c["name"], "권한 상승 허용")'
\`\`\``,

'k8s-network-policy': R`## 실제로 이렇게 터진다

파드 하나가 침해된 뒤 클러스터 안 모든 서비스에 접근된 사례가 있다. 네트워크 정책이 하나도 없었고, 기본값은 전부 허용이다. 데이터베이스 파드도 같은 클러스터에 있었다.

정책을 만들었는데 적용되지 않은 경우도 있다. CNI 플러그인이 네트워크 정책을 지원하지 않았다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 네임스페이스가 격리한다 | 네트워크는 기본 전부 허용이다 |
| 정책을 만들면 적용된다 | CNI 가 지원해야 한다 |
| 인그레스만 막으면 된다 | 반출은 이그레스로 나간다 |
| 라벨로 충분히 좁혀진다 | 라벨이 바뀌면 정책이 헐거워진다 |
| 서비스 메시가 대신한다 | 계층이 다르다, 함께 쓴다 |

## 어떻게 시작하는가

전면 차단부터 걸면 서비스가 멈춘다. 관찰 후 좁힌다.

1. CNI 가 네트워크 정책을 지원하는지 확인한다
2. 현재 통신을 관찰한다 — 흐름 로그나 메시 지표
3. 네임스페이스마다 기본 거부 정책을 준비하되 적용하지 않는다
4. 관찰 결과로 허용 규칙을 만든다
5. 시험 네임스페이스부터 기본 거부를 적용한다
6. 순차 확대하고, 거부 로그를 감시한다

\`\`\`yaml
# 기본 거부 — 인그레스와 이그레스 모두
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: prod }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
# DNS 는 반드시 열어야 한다 — 빠뜨리면 전부 실패한다
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-dns, namespace: prod }
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to: [{ namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } } }]
      ports: [{ protocol: UDP, port: 53 }, { protocol: TCP, port: 53 }]
\`\`\`

DNS 를 빠뜨리는 것이 가장 흔한 실수다. 이름 해석이 막히면 전 통신이 실패한다.

\`\`\`bash
# 정책이 없는 네임스페이스 — 전부 허용 상태다
comm -23 <(kubectl get ns -o name | sed 's|namespace/||' | sort) \
         <(kubectl get networkpolicy -A -o jsonpath='{.items[*].metadata.namespace}' | tr ' ' '\n' | sort -u)
\`\`\``,

'config-drift': R`## 실제로 이렇게 터진다

인프라 코드로 관리한다고 했지만 실제 환경의 30% 가 콘솔에서 손으로 바뀐 사례가 있다. 급할 때 콘솔에서 고치고 코드에 반영하지 않는 관행이 쌓였다. 코드를 다시 적용하는 순간 그 변경이 사라져 장애가 났다.

보안 설정이 조용히 풀린 경우도 있다. 누군가 조사 목적으로 버킷을 공개로 바꾸고 되돌리지 않았다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 코드로 관리하니 실제도 같다 | 손으로 바꾼 것이 있다 |
| 코드 검사를 통과하면 안전하다 | 실제 상태는 다를 수 있다 |
| 드리프트는 재적용으로 해결된다 | 필요한 변경까지 사라진다 |
| 콘솔 접근을 막으면 된다 | 긴급 상황에는 열어야 한다 |
| 탐지만 하면 된다 | 처리 절차가 있어야 한다 |

## 무엇을 탐지하는가

| 대상 | 우선순위 |
| --- | --- |
| 공개 접근 설정 | 최우선 |
| 보안 그룹 규칙 | 높음 |
| 암호화·로깅 활성 여부 | 높음 |
| 권한 정책 | 높음 |
| 태그 | 중간 |
| 인스턴스 크기 | 낮음 |

전부 탐지하면 소음이 된다. 보안에 영향을 주는 항목만 경보로 올리고 나머지는 보고서로 둔다.

## 처리 절차

1. 드리프트를 발견하면 누가 언제 바꿨는지 확인한다 — 감사 로그
2. 정당한 변경이면 코드에 반영한다
3. 정당하지 않으면 되돌리고 원인을 확인한다
4. 반복되면 콘솔 권한을 조정하거나 절차를 만든다
5. 긴급 변경 경로를 공식화한다 — 사후 반영 의무 포함

긴급 경로를 공식화하지 않으면 비공식 경로가 계속 쓰인다.

\`\`\`bash
# 코드와 실제의 차이 — 종료 코드 2 면 드리프트가 있다
terraform plan -detailed-exitcode -refresh-only
echo "exit=$?"

# 누가 바꿨는지 — 감사 로그에서 콘솔 변경을 찾는다
aws cloudtrail lookup-events --lookup-attributes AttributeKey=ReadOnly,AttributeValue=false \
  --start-time "$(date -u -v-7d +%FT%TZ)" \
  --query 'Events[?contains(to_string(@), \`ConsoleLogin\`) == \`false\`].[EventTime,Username,EventName]' \
  --output text | head -20
\`\`\``,
}
