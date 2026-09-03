import type { SeedPost } from './types'

/** 131~140 — 클라우드·컨테이너와 탐지 운영 */
export const posts14: SeedPost[] = [
  {
    slug: 'cloud-metadata',
    title: '클라우드 메타데이터 서비스 보호',
    body: `클라우드 인스턴스는 자기 자신의 자격 증명을 링크 로컬 주소에서 받아온다. 편리한 구조이지만, 애플리케이션이 임의의 주소로 요청을 보낼 수 있다면 그 주소도 보낼 수 있다. 서버 측 요청 위조 하나로 인스턴스 역할의 임시 자격 증명이 통째로 유출되는 경로가 이것이다. 방어는 세 층으로 겹쳐야 한다.

## 왜 이 경로가 그렇게 위험한가?

메타데이터에서 얻은 자격 증명은 인스턴스에 붙은 역할의 모든 권한을 갖는다. 역할이 넓게 부여돼 있으면 스토리지 전체 조회, 데이터베이스 접근, 다른 인스턴스 제어까지 이어진다. 애플리케이션 취약점 하나가 계정 전체 침해로 확대되는 대표적인 경로다.

![요청 위조에서 자격 증명 유출까지](/img/posts/cloud-metadata.svg)

## 방어 계층

| 계층 | 조치 | 효과 |
| --- | --- | --- |
| 메타데이터 | 토큰 필수 방식만 허용 | 단순 GET 요청 차단 |
| 메타데이터 | 홉 제한을 1로 | 컨테이너에서 접근 차단 |
| 네트워크 | 링크 로컬 주소로 나가는 요청 차단 | 우회 무력화 |
| 애플리케이션 | 해석된 주소 검사 | 1차 차단 |
| IAM | 인스턴스 역할 최소화 | 유출 시 피해 축소 |
| 탐지 | 외부에서의 역할 자격 증명 사용 경보 | 사후 탐지 |

## 토큰 필수 방식이 핵심이다

토큰을 먼저 발급받아야 메타데이터를 읽을 수 있게 하면, 단순 GET 요청만 보낼 수 있는 요청 위조 취약점으로는 접근이 불가능해진다. 토큰 발급이 PUT 요청과 특정 헤더를 요구하기 때문이다. 이 설정 하나가 가장 큰 효과를 낸다.

## 컨테이너에서는 홉 제한을 쓴다

컨테이너 안에서 호스트의 메타데이터로 요청이 가면 파드가 노드 역할을 그대로 쓴다. 홉 제한을 1로 두면 컨테이너 네트워크를 한 번 지난 요청은 거부된다. 파드에는 파드 단위 역할을 별도로 부여해야 한다.

\`\`\`
노드 역할    최소한만 — 로그 전송 등
파드 역할    워크로드별로 분리해 부여
홉 제한      1 — 컨테이너에서 노드 역할 접근 차단
\`\`\`

## 유출을 탐지할 수 있게 만든다

인스턴스 역할의 자격 증명이 인스턴스가 아닌 곳에서 쓰이면 그것은 유출이다. 감사 로그에서 역할 사용의 발신 주소를 확인하는 탐지 규칙을 만들어 두면, 유출을 사후에라도 잡을 수 있다.

## 바로 확인하기

메타데이터 접근 설정을 먼저 확인하고, 실제로 토큰 없이 읽히는지 시험한다.

\`\`\`bash
# 인스턴스별 메타데이터 설정 — HttpTokens 가 required 여야 한다
aws ec2 describe-instances \\
  --query 'Reservations[].Instances[].[InstanceId,MetadataOptions.HttpTokens,MetadataOptions.HttpPutResponseHopLimit]' \\
  --output table

# 인스턴스 안에서: 토큰 없이 읽히면 설정이 열려 있다
curl -s -m 2 http://169.254.169.254/latest/meta-data/iam/security-credentials/ \\
  && echo '토큰 없이 접근 가능 — required 로 변경 필요'
\`\`\`

애플리케이션 쪽 차단도 함께 둔다. 링크 로컬 대역 전체를 막는 것이 핵심이다.

\`\`\`ts
const BLOCKED = ['169.254.0.0/16', '127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']

// 해석된 IP 로 판단하고, 그 IP 로 직접 연결한다.
// 호스트 이름으로 검사하면 DNS 재바인딩으로 우회된다.
\`\`\`

## 참고

- OWASP Cheat Sheet — SSRF Prevention, 클라우드 메타데이터
- 클라우드 공급자별 인스턴스 메타데이터 보안 문서
- MITRE ATT&CK — T1552.005 Cloud Instance Metadata API`,
    diagram: {
      type: 'flow',
      caption: '메타데이터 경로를 통한 권한 확대',
      steps: [
        { label: '요청 위조 취약점', note: '주소를 지정할 수 있는 기능' },
        { label: '메타데이터 조회', note: '링크 로컬 주소', danger: true },
        { label: '임시 자격 증명 획득', note: '인스턴스 역할 권한', danger: true },
        { label: '자원 접근 확대', note: '스토리지·데이터베이스' },
      ],
    },
  },
  {
    slug: 'cross-account-role',
    title: '크로스 계정 역할과 외부 ID 검증',
    body: `계정 분리를 해두어도 계정 간 IAM 역할을 어떻게 열어주느냐에 따라 분리가 무의미해질 수 있다. 특히 외부 업체에 역할을 열어줄 때 신뢰 정책을 계정 단위로만 지정하면, 그 업체의 다른 고객이 우리 자원에 접근할 수 있는 상황이 생긴다. 외부 ID 를 함께 검증하는 것이 이 문제의 표준 해법이다.

## 계정 분리가 무의미해지는 경우는 언제인가?

외부 업체는 자기 계정 하나로 여러 고객의 역할을 맡는다. 신뢰 정책이 그 계정만 확인하면, 업체 고객 중 누구든 우리 역할 이름을 알아내 맡을 수 있다. 역할 이름은 짐작하기 쉽고, 업체 문서에 형식이 공개돼 있는 경우도 많다.

![신뢰 정책의 조건 유무에 따른 차이](/img/posts/cross-account-role.svg)

## IAM 신뢰 정책 점검 항목

| 항목 | 안전한 설정 |
| --- | --- |
| 주체 | 특정 계정 또는 역할까지 지정 |
| 외부 ID | 고객별 고유값 요구 |
| 조건 | 발신 계정·태그·다단계 인증 여부 |
| 세션 시간 | 필요한 만큼만 |
| 권한 | 읽기 전용이 가능하면 읽기 전용 |
| 감사 | 역할 사용 이력 별도 수집 |

## 외부 ID 는 추측 불가한 값으로

외부 ID 를 회사 이름이나 계정 번호로 두면 조건이 있어도 무력하다. 무작위 값으로 만들어 업체와 안전한 경로로 공유하고, 우리 쪽 기록에 남긴다. 업체가 값을 정해 주는 경우에도 그 값이 우리에게 고유한지 확인해야 한다.

\`\`\`
나쁨   ExternalId: "example-corp"
나쁨   ExternalId: "123456789012"       계정 번호는 공개 정보에 가깝다
좋음   ExternalId: 32바이트 무작위 값
\`\`\`

## IAM 역할 위임 사슬을 짧게

IAM 역할이 다른 역할을 맡고, 그 역할이 또 다른 역할을 맡는 구조가 생기면 최종 권한을 아무도 계산하지 못한다. 위임 단계를 한 단계로 제한하고, 역할 목록과 신뢰 관계를 그림으로 관리해야 한다.

## 사용 이력을 감시한다

크로스 계정 역할 사용은 드문 이벤트이므로 탐지 규칙을 만들기 쉽다. 예상되지 않은 시간, 예상되지 않은 발신 계정, 처음 보는 역할 사용을 경보로 만든다.

## 바로 확인하기

모든 역할의 신뢰 정책을 뽑아 외부 계정을 신뢰하는 항목을 찾는다. 조건이 없으면 즉시 조치 대상이다.

\`\`\`bash
# 외부 계정을 신뢰하면서 조건이 없는 역할 찾기
aws iam list-roles --query 'Roles[].[RoleName]' --output text | while read -r r; do
  doc=$(aws iam get-role --role-name "$r" \\
        --query 'Role.AssumeRolePolicyDocument' --output json)
  echo "$doc" | grep -q '"AWS"' || continue
  if ! echo "$doc" | grep -q 'sts:ExternalId'; then
    echo "조건 없음: $r"
  fi
done

# 역할 사용 이력 — 발신 계정별 집계
aws cloudtrail lookup-events \\
  --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRole \\
  --max-results 50 --query 'Events[].CloudTrailEvent' --output text \\
  | python3 -c 'import sys,json;[print(json.loads(l)["userIdentity"].get("accountId")) for l in sys.stdin if l.strip()]' \\
  | sort | uniq -c
\`\`\`

## 참고

- 클라우드 공급자별 크로스 계정 역할 문서
- AWS 보안 블로그 — Confused Deputy 문제와 ExternalId
- NIST SP 800-53, AC-3 접근 시행`,
    diagram: {
      type: 'matrix',
      caption: '신뢰 정책 조건과 위험',
      x: ['외부 ID 검증', '검증 없음'],
      y: ['계정만 지정', '역할까지 지정'],
      cells: ['안전', '타 고객이 맡을 수 있음', '가장 안전', '조건 필요'],
    },
  },
  {
    slug: 'container-runtime',
    title: '컨테이너 런타임 권한과 탈출 경로',
    body: `컨테이너는 가상 머신 수준의 격리가 아니다. 커널을 공유하므로 잘못된 실행 옵션 하나로 호스트 접근이 가능해진다. 이미지 스캔에 집중하고 실행 옵션을 그대로 두는 것이 가장 흔한 실수다. 실제 침해에서 문제가 되는 것은 이미지 안의 취약한 패키지보다 특권 실행과 호스트 자원 마운트다.

## 어떤 설정이 탈출로 이어지는가?

| 설정 | 위험 |
| --- | --- |
| 특권 모드 실행 | 사실상 호스트 권한 |
| 호스트 네트워크 공유 | 호스트 대역 접근 |
| 호스트 프로세스 공간 공유 | 다른 프로세스 관찰·조작 |
| 도커 소켓 마운트 | 임의 컨테이너 생성 = 호스트 장악 |
| 루트 파일시스템 마운트 | 호스트 파일 읽기·쓰기 |
| 위험한 커널 권한 추가 | 모듈 적재, 장치 접근 |
| 루트 사용자로 실행 | 탈출 시 권한이 그대로 |

![실행 옵션이 만드는 호스트 접근 경로](/img/posts/container-runtime.svg)

## 기본값을 안전하게 정한다

개별 워크로드를 검사하는 것보다 안전한 기본값을 강제하는 편이 확실하다. 정책 엔진으로 위험한 옵션이 있는 워크로드를 배포 단계에서 거부하고, 예외는 승인 절차를 거치게 한다.

\`\`\`
기본 강제 항목
  루트가 아닌 사용자로 실행
  루트 파일시스템 읽기 전용
  권한 상승 금지
  불필요한 커널 권한 모두 제거
  호스트 네트워크·프로세스 공간 공유 금지
  도커 소켓 마운트 금지
\`\`\`

## 읽기 전용 루트가 효과가 크다

침해 후 다음 단계는 대개 도구를 내려받아 실행하는 것이다. 파일시스템이 읽기 전용이면 이 단계가 막힌다. 쓰기가 필요한 경로만 임시 볼륨으로 열면 대부분의 애플리케이션이 문제없이 동작한다.

## 이미지도 함께 줄인다

실행 옵션을 잠근 뒤에는 이미지 안의 도구를 줄인다. 셸과 패키지 관리자가 없는 이미지는 침해 후 활동 폭을 크게 제한한다. 디버깅은 임시 진단 컨테이너를 붙이는 방식으로 대체한다.

## 바로 확인하기

지금 돌고 있는 워크로드의 위험 설정을 한 번에 뽑는다.

\`\`\`bash
# 특권 모드와 호스트 공유 설정
kubectl get pods -A -o json | python3 - <<'PY'
import json,sys
d=json.load(sys.stdin)
for p in d['items']:
    s=p['spec']; m=p['metadata']
    flags=[]
    if s.get('hostNetwork'): flags.append('hostNetwork')
    if s.get('hostPID'): flags.append('hostPID')
    for c in s.get('containers',[]):
        sc=c.get('securityContext') or {}
        if sc.get('privileged'): flags.append(f"privileged:{c['name']}")
        if sc.get('runAsNonRoot') is not True: flags.append(f"maybeRoot:{c['name']}")
        if sc.get('readOnlyRootFilesystem') is not True: flags.append(f"rwRoot:{c['name']}")
    for v in s.get('volumes',[]):
        hp=(v.get('hostPath') or {}).get('path')
        if hp: flags.append(f"hostPath:{hp}")
    if flags: print(f"{m['namespace']}/{m['name']}: {', '.join(flags)}")
PY
\`\`\`

도커 환경이라면 실행 중 컨테이너의 옵션을 직접 본다.

\`\`\`bash
docker ps -q | while read -r id; do
  docker inspect "$id" --format \\
   '{{.Name}} privileged={{.HostConfig.Privileged}} net={{.HostConfig.NetworkMode}} mounts={{range .Mounts}}{{.Source}} {{end}}'
done | grep -E 'privileged=true|net=host|/var/run/docker.sock|Source=/ '
\`\`\`

## 참고

- NIST SP 800-190, 애플리케이션 컨테이너 보안 지침
- CIS Docker Benchmark, 런타임 설정 항목
- 쿠버네티스 Pod Security Standards`,
    diagram: {
      type: 'layers',
      caption: '컨테이너 격리 강화 순서',
      layers: [
        { label: '위험 옵션 차단', note: '특권·호스트 공유·소켓 마운트' },
        { label: '비루트 실행', note: '탈출 시 권한 축소' },
        { label: '읽기 전용 루트', note: '도구 설치 차단' },
        { label: '최소 이미지', note: '셸·패키지 관리자 제거' },
      ],
    },
  },
  {
    slug: 'k8s-network-policy',
    title: '쿠버네티스 네트워크 정책 설계',
    body: `기본 상태의 쿠버네티스 클러스터에서는 모든 파드가 서로 통신할 수 있다. 침해된 파드 하나가 클러스터 안의 모든 서비스와 데이터베이스에 도달한다는 뜻이다. 네트워크 정책은 이 기본값을 뒤집는 도구이지만, 한 번에 전면 적용하면 통신이 끊겨 장애가 난다. 순서가 중요하다.

## 왜 적용이 미뤄지는가?

어떤 파드가 어떤 파드와 통신하는지 아무도 정확히 모른다. 목록 없이 정책을 쓰면 반드시 빠뜨린다. 그래서 먼저 실제 통신을 관찰해 목록을 만드는 단계가 필요하다.

![기본 허용 상태와 정책 적용 후](/img/posts/k8s-network-policy.svg)

## 적용 순서

| 단계 | 내용 |
| --- | --- |
| 1 | 통신 흐름 관찰과 목록화 |
| 2 | 이름공간 간 통신 차단부터 적용 |
| 3 | 이름공간별 기본 거부 정책 추가 |
| 4 | 필요한 통신만 허용 규칙으로 명시 |
| 5 | 아웃바운드 정책 적용 |
| 6 | 거부 로그 감시로 누락 확인 |

## 기본 거부는 이름공간 단위로 시작한다

클러스터 전체에 한 번에 걸지 않고 이름공간 하나를 골라 적용한다. 그 이름공간에서 안정화되면 다음으로 넘어간다. 이름공간마다 소유 팀이 다르므로 팀 단위 진행이 되기도 한다.

\`\`\`yaml
# 이름공간 기본 거부 — 이것부터 넣고 필요한 통신을 열어 나간다
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: payments
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
\`\`\`

## DNS 를 먼저 열어야 한다

기본 거부를 걸면 이름 해석이 막혀 모든 통신이 실패한다. 원인을 찾기 어려운 대표적인 함정이다. 아웃바운드 정책을 넣을 때는 클러스터 DNS 로의 통신을 항상 함께 허용한다.

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: payments
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector:
            matchLabels: { kubernetes.io/metadata.name: kube-system }
          podSelector:
            matchLabels: { k8s-app: kube-dns }
      ports:
        - { protocol: UDP, port: 53 }
        - { protocol: TCP, port: 53 }
\`\`\`

## 데이터 계층을 먼저 보호한다

전체를 덮기 전에 효과가 큰 곳부터 한다. 데이터베이스와 캐시 파드에 인바운드 정책을 걸어 지정된 애플리케이션만 접근하게 하면, 몇 개의 정책으로 침해 확산 범위가 크게 줄어든다.

## 바로 확인하기

정책이 실제로 막는지 임시 파드로 확인한다. 정책을 넣었다고 동작한다고 가정하지 않는다.

\`\`\`bash
# 정책이 없는 이름공간에서 데이터베이스로 접근 — 막혀야 정상
kubectl run probe --rm -it --image=busybox --restart=Never -n default -- \\
  sh -c 'nc -z -w3 postgres.payments.svc.cluster.local 5432; echo exit=$?'

# 정책이 적용된 파드 목록 — 비어 있으면 기본 허용 상태다
kubectl get networkpolicy -A

# 정책의 대상 파드 확인
kubectl describe networkpolicy default-deny-all -n payments
\`\`\`

## 참고

- 쿠버네티스 공식 문서 — Network Policies
- NIST SP 800-190, 컨테이너 네트워크 분리
- CIS Kubernetes Benchmark, 네트워크 정책 항목`,
    diagram: {
      type: 'steps',
      caption: '네트워크 정책 도입 순서',
      steps: [
        { label: '통신 흐름 관찰', note: '목록 없이 정책을 쓰지 않는다' },
        { label: '데이터 계층 보호', note: '적은 정책으로 큰 효과' },
        { label: '이름공간 기본 거부', note: 'DNS 허용을 함께' },
        { label: '거부 로그 감시', note: '누락된 통신 발견' },
      ],
    },
  },
  {
    slug: 'config-drift',
    title: '클라우드 설정 드리프트 탐지 운영',
    body: `인프라 코드로 관리한다고 선언해도, 장애 대응 중에 콘솔에서 손으로 바꾼 설정이 남는다. 코드와 실제가 어긋난 상태를 드리프트라고 하고, 이것이 쌓이면 코드는 더 이상 현실을 설명하지 못한다. 보안 관점의 문제는 방화벽 규칙과 권한 설정처럼 위험한 변경이 바로 이런 임시 조치로 들어온다는 점이다.

## 어떻게 생기는가?

- 장애 대응 중 콘솔에서 직접 변경
- 자동화 도구가 코드 밖에서 자원을 만듦
- 공급자가 기본값을 변경
- 수동으로 만든 자원을 코드로 옮기지 않음
- 여러 팀이 같은 자원을 다른 방식으로 관리

![코드와 실제 상태의 어긋남](/img/posts/config-drift.svg)

## 위험도가 높은 항목

| 항목 | 드리프트 시 영향 |
| --- | --- |
| 보안 그룹 규칙 | 의도치 않은 공개 |
| 스토리지 공개 설정 | 데이터 노출 |
| IAM 정책 | 권한 확대 |
| 감사 로그 설정 | 추적 불가 |
| 암호화 설정 | 규정 위반 |
| 백업 정책 | 복구 실패 |

이 항목들은 드리프트 검사 주기를 짧게 하고, 발견 시 자동 복원 대상으로 둘 만하다.

## 탐지와 복원을 나눠 생각한다

모든 드리프트를 자동 복원하면 장애 대응 중 임시 조치를 되돌려 장애를 키운다. 반대로 탐지만 하면 아무도 고치지 않는다. 위험도로 나눠 처리한다.

\`\`\`
자동 복원   공개 설정, 감사 로그 비활성화, 암호화 해제
경보 후 수동 IAM 정책 변경, 보안 그룹 추가
주기 보고서 그 외 태그·설명 등 무해한 차이
\`\`\`

## 임시 변경에 기한을 붙인다

장애 대응 중의 변경을 금지할 수는 없다. 대신 임시 변경 사실을 기록하고 기한을 붙인다. 기한이 지난 임시 변경을 주간 회의 안건으로 올리면, 코드로 되돌리는 작업이 실제로 진행된다.

## 코드 밖 자원을 목록화한다

코드로 관리되지 않는 자원은 드리프트 검사에 잡히지도 않는다. 전체 자원 목록과 코드 상태 파일의 자원 목록을 대조해 차이를 뽑는 것이 출발점이다.

## 바로 확인하기

정기 실행으로 코드와 실제의 차이를 뽑는다. 종료 코드로 판정할 수 있다.

\`\`\`bash
# 드리프트 검사 — 종료 코드 2 면 차이가 있다
terraform plan -detailed-exitcode -refresh-only -no-color > drift.txt
case $? in
  0) echo '차이 없음' ;;
  2) echo '드리프트 발견'; grep -E '^\\s+[~+-]' drift.txt | head -30 ;;
  *) echo '검사 실패' ;;
esac

# 코드로 관리되지 않는 자원 찾기
terraform state list | sed 's/.*\\.//' | sort > managed.txt
aws ec2 describe-security-groups --query 'SecurityGroups[].GroupId' --output text \\
  | tr '\\t' '\\n' | sort > actual.txt
comm -13 managed.txt actual.txt
\`\`\`

위험 항목은 실제 상태를 직접 조회해 판정하는 것이 더 확실하다.

\`\`\`bash
# 전체 공개된 보안 그룹 규칙
aws ec2 describe-security-groups \\
  --filters Name=ip-permission.cidr,Values=0.0.0.0/0 \\
  --query 'SecurityGroups[].[GroupId,GroupName]' --output text
\`\`\`

## 참고

- CIS Controls v8, 4 안전한 설정 관리
- NIST SP 800-128, 설정 관리 기반 보안
- 인프라 코드 도구별 드리프트 검사 문서`,
    diagram: {
      type: 'matrix',
      caption: '드리프트 위험도와 처리 방식',
      x: ['위험도 높음', '위험도 낮음'],
      y: ['자동 복원 가능', '수동 판단 필요'],
      cells: ['즉시 자동 복원', '주기 보고', '경보 후 수동 조치', '기록만'],
    },
  },
  {
    slug: 'terraform-state',
    title: '테라폼 상태 파일 보호와 비밀값',
    body: `인프라 코드의 상태 파일에는 만들어진 자원의 실제 값이 그대로 들어간다. 데이터베이스 비밀번호, 생성된 키, 접속 문자열이 평문으로 남는 경우가 많다. 즉 상태 파일 하나가 인프라 전체의 비밀값 모음이 된다. 저장소에 커밋된 상태 파일이 유출 사고로 이어지는 사례가 반복되는 이유다.

## 무엇이 들어 있는가?

- 자원 속성 전체 — 입력값과 출력값
- 무작위 생성된 비밀번호와 키
- 데이터 소스로 읽어온 값
- 민감 표시를 한 변수의 실제 값
- 자원 간 의존 관계와 식별자

민감 표시는 화면 출력만 가려준다. 상태 파일에는 그대로 저장된다는 점을 자주 오해한다.

![상태 파일이 담는 값과 접근 경로](/img/posts/terraform-state.svg)

## 보호 항목

| 항목 | 조치 |
| --- | --- |
| 저장 위치 | 원격 백엔드. 저장소 커밋 금지 |
| 저장 암호화 | 버킷 암호화와 키 관리 서비스 연동 |
| 접근 권한 | 실행 주체만. 개인 계정 접근 제한 |
| 잠금 | 동시 실행 방지 잠금 설정 |
| 버전 관리 | 이전 버전 보관과 복구 경로 |
| 감사 | 상태 파일 접근 이력 수집 |

## 비밀값은 처음부터 코드 밖에 둔다

가장 확실한 방법은 상태 파일에 비밀값이 들어가지 않게 하는 것이다. 비밀값은 비밀 관리 서비스에 두고, 코드는 그 참조만 다룬다. 애플리케이션이 실행 시점에 직접 읽어 가면 상태 파일에는 참조 경로만 남는다.

\`\`\`
피할 것   코드에서 비밀번호를 생성해 자원에 주입
차선      비밀 관리 서비스에서 읽어 주입 — 상태에는 여전히 남을 수 있다
권장      자원은 비밀 참조만 갖고, 애플리케이션이 실행 시 조회
\`\`\`

## 실행 권한과 상태 접근을 분리한다

파이프라인이 인프라를 만들 권한과 사람이 상태를 읽을 권한은 다르다. 상태 파일 읽기 권한을 넓게 주면 비밀값 열람 권한을 준 것과 같다. 사람은 계획 결과만 보고, 상태 자체는 실행 주체만 접근하게 한다.

## 실수로 커밋된 이력을 처리한다

저장소 이력에 한 번 들어간 값은 브랜치를 지워도 남는다. 이력에서 제거하는 작업과 별개로, 노출된 모든 비밀값은 회전이 필요하다. 회전하지 않으면 제거는 의미가 없다.

## 바로 확인하기

상태 파일에 평문 비밀값이 있는지 직접 확인한다. 있다면 회전 대상 목록이 된다.

\`\`\`bash
# 상태에 담긴 민감 속성 찾기
terraform show -json | python3 - <<'PY'
import json,sys
KEYS=('password','secret','private_key','token','connection_string')
d=json.load(sys.stdin)
def walk(v,path=''):
    if isinstance(v,dict):
        for k,x in v.items():
            if any(s in k.lower() for s in KEYS) and isinstance(x,str) and x:
                print(f"{path}.{k}")
            walk(x,f"{path}.{k}")
    elif isinstance(v,list):
        for i,x in enumerate(v): walk(x,f"{path}[{i}]")
walk(d)
PY

# 저장소 이력에 상태 파일이 들어간 적 있는지
git log --all --name-only --pretty=format: | grep -E 'terraform\\.tfstate' | sort -u
\`\`\`

## 참고

- Terraform 공식 문서 — State, Sensitive Data in State
- OWASP Cheat Sheet — Secrets Management
- CIS Controls v8, 3 데이터 보호`,
    diagram: {
      type: 'layers',
      caption: '상태 파일 보호 계층',
      layers: [
        { label: '비밀값 분리', note: '상태에 들어가지 않게' },
        { label: '원격 백엔드 암호화', note: '저장 암호화와 잠금' },
        { label: '접근 권한 분리', note: '실행 주체만 읽기' },
        { label: '접근 감사', note: '이력 수집과 경보' },
      ],
    },
  },
  {
    slug: 'log-priority',
    title: '보안 로그 수집 우선순위와 비용',
    body: `로그를 전부 모으면 비용이 감당되지 않고, 아껴 모으면 조사할 때 없다. 그래서 무엇을 얼마나 오래 보관할지는 예산 문제가 아니라 조사 가능성 문제로 접근해야 한다. 기준은 하나다. 침해 조사에서 반드시 필요한 질문에 답할 수 있는 로그를 먼저 확보하고, 그다음에 나머지를 줄인다.

## 조사에서 무엇에 답해야 하는가?

- 누가 언제 어디서 로그인했는가
- 어떤 권한이 언제 누구에게 부여됐는가
- 어떤 데이터가 언제 얼마나 조회됐는가
- 어떤 프로세스가 언제 실행됐는가
- 어디로 어느 정도의 데이터가 나갔는가
- 어떤 설정이 언제 누구에 의해 바뀌었는가

이 여섯 가지에 답하지 못하는 로그 구성은 비용이 얼마든 실패한 구성이다.

![조사 질문과 필요한 로그의 대응](/img/posts/log-priority.svg)

## 우선순위와 보관 기간

| 로그 | 우선순위 | 권장 보관 |
| --- | --- | --- |
| 인증·권한 변경 | 1 | 1년 이상 |
| 클라우드 감사 로그 | 1 | 1년 이상 |
| 개인정보 조회 이력 | 1 | 법정 기간 |
| 단말 프로세스 실행 | 2 | 90일 |
| 네트워크 흐름 | 2 | 90일 |
| 애플리케이션 접근 로그 | 2 | 90일 |
| 디버그 로그 | 3 | 7~14일 |

## 뜨거운 저장소와 찬 저장소를 나눈다

최근 30일은 즉시 검색 가능한 저장소에 두고, 그 이후는 저렴한 저장소로 옮긴다. 조사는 대개 최근 데이터로 시작하고, 오래된 데이터는 필요할 때만 꺼낸다. 이 분리만으로 비용이 크게 줄어든다.

\`\`\`
0~30일    즉시 검색 — 탐지와 조사
31~90일   지연 검색 허용 — 소급 조사
91일~     보관 전용 — 필요 시 복원
\`\`\`

## 줄이는 방법은 세 가지다

- 표본 추출 — 흐름 로그처럼 양이 많고 통계로 충분한 것
- 필드 축소 — 조사에 쓰지 않는 필드 제거
- 대상 축소 — 저위험 자산의 상세 로그 등급 하향

무엇을 줄였는지 기록해야 한다. 조사 때 "이 로그는 원래 없다"는 사실을 아는 것과 모르는 것은 큰 차이다.

## 무결성을 지킨다

공격자가 지울 수 있는 로그는 조사 근거가 되지 못한다. 로그는 발생 즉시 별도 계정으로 보내고, 그 저장소는 삭제·수정이 불가능하게 설정한다.

## 바로 확인하기

수집량과 비용의 구성을 먼저 파악한다. 대개 상위 몇 개 소스가 대부분을 차지한다.

\`\`\`bash
# 소스별 수집량 상위 — 줄일 대상 후보
aws logs describe-log-groups \\
  --query 'logGroups[].[logGroupName,storedBytes,retentionInDays]' --output text \\
  | sort -k2 -rn | head -15

# 보관 기간이 설정되지 않은 그룹 — 무한 보관은 비용의 주원인
aws logs describe-log-groups \\
  --query 'logGroups[?retentionInDays==null].logGroupName' --output text | tr '\\t' '\\n'
\`\`\`

수집 여부는 질문 단위로 점검한다.

\`\`\`
점검 질문                                  답할 수 있는가
관리자 계정의 지난 6개월 로그인 위치        예/아니오
어제 특정 사용자의 개인정보 조회 건수        예/아니오
2주 전 특정 서버에서 실행된 프로세스         예/아니오
지난달 외부로 나간 데이터 총량              예/아니오
\`\`\`

## 참고

- NIST SP 800-92, 로그 관리 지침
- CIS Controls v8, 8 감사 로그 관리
- 개인정보의 안전성 확보조치 기준, 접속기록 보관`,
    diagram: {
      type: 'bars',
      caption: '로그 유형별 수집량과 조사 기여도',
      unit: '상대값',
      items: [
        { label: '인증·권한', value: 8, note: '기여도 최상' },
        { label: '클라우드 감사', value: 20, note: '기여도 상' },
        { label: '프로세스 실행', value: 45, note: '기여도 상' },
        { label: '디버그', value: 90, note: '기여도 하' },
      ],
    },
  },
  {
    slug: 'detection-as-code',
    title: '탐지 규칙을 코드로 관리하기',
    body: `탐지 규칙을 콘솔에서 직접 만들면 누가 언제 무엇을 왜 바꿨는지 남지 않는다. 규칙이 수백 개가 되면 중복과 죽은 규칙이 쌓이고, 사고 후 "왜 이건 탐지되지 않았나"에 답할 수 없다. 규칙을 저장소에 두고 리뷰와 테스트를 거쳐 배포하면 이 문제가 대부분 사라진다.

## 코드로 관리하면 무엇이 달라지는가?

| 항목 | 콘솔 관리 | 코드 관리 |
| --- | --- | --- |
| 변경 이력 | 없거나 빈약 | 커밋 단위로 남음 |
| 검토 | 개인 판단 | 리뷰 필수 |
| 테스트 | 운영에서 확인 | 표본 데이터로 사전 검증 |
| 재현 | 어려움 | 환경 재구성 가능 |
| 중복 관리 | 방치 | 검색과 정리 가능 |
| 근거 | 기억에 의존 | 규칙에 문서화 |

![규칙 작성부터 배포까지의 경로](/img/posts/detection-as-code.svg)

## 규칙에 메타데이터를 붙인다

규칙 본문만 있으면 나중에 아무도 손대지 못한다. 무엇을 탐지하려는지, 오탐 시 어떻게 판단하는지, 대응 절차가 무엇인지를 규칙과 함께 둔다.

\`\`\`yaml
id: aws-root-login
title: 루트 계정 콘솔 로그인
severity: high
description: 루트 계정 로그인은 정상 운영에서 발생하지 않아야 한다
tactic: [privilege-escalation]      # ATT&CK 기법 분류와 연결
query: |
  eventName = "ConsoleLogin" AND userIdentity.type = "Root"
false_positives:
  - 계정 초기 설정 작업 — 변경 관리 티켓 확인
response: runbooks/root-login.md
owner: security-ops
tests:
  - { file: samples/root-login.json, expect: match }
  - { file: samples/iam-user-login.json, expect: no-match }
\`\`\`

## 표본 데이터로 시험한다

규칙마다 탐지돼야 하는 표본과 탐지되면 안 되는 표본을 함께 둔다. 규칙을 고칠 때 기존 탐지가 깨지는지 즉시 알 수 있고, 사고 후 새로 만든 규칙에 그 사고의 로그를 표본으로 넣으면 재발 감지가 보장된다.

## 죽은 규칙을 정리한다

한 번도 발동하지 않은 규칙은 두 가지 중 하나다. 정말 그 일이 없었거나, 규칙이 잘못됐거나. 발동 이력이 없는 규칙 목록을 주기적으로 검토해 표본 시험으로 판별한다. 이 과정이 없으면 규칙 수만 늘고 실제 탐지 능력은 떨어진다.

## 기법 분류와 연결한다

규칙마다 대응하는 공격 기법을 표시하면, 어떤 영역에 탐지 규칙이 없는지 한눈에 보인다. 규칙 개수보다 이 공백 지도가 훨씬 유용한 지표다.

## 바로 확인하기

파이프라인에서 규칙을 검증하고 배포한다. 검증 없는 배포는 콘솔 관리와 다르지 않다.

\`\`\`bash
# 문법과 필수 메타데이터 검증
for f in rules/*.yml; do
  python3 - "$f" <<'PY'
import sys,yaml
r=yaml.safe_load(open(sys.argv[1]))
need=['id','title','severity','query','response','owner','tests']
missing=[k for k in need if not r.get(k)]
print(('OK  ' if not missing else 'FAIL') + f" {sys.argv[1]} {missing}")
PY
done

# 표본 데이터로 탐지 여부 시험
./bin/detect-test --rules rules/ --samples samples/ --fail-on-regression
\`\`\`

발동 이력이 없는 규칙을 뽑아 검토 대상으로 올린다.

\`\`\`
정리 기준
  90일간 0회 발동 + 표본 시험 실패  →  규칙 결함, 수정
  90일간 0회 발동 + 표본 시험 통과  →  유지, 근거 기록
  발동 대부분이 오탐               →  조건 보강 또는 폐기
\`\`\`

## 참고

- MITRE ATT&CK 기법 분류 체계
- Sigma 규칙 형식 문서
- NIST SP 800-137, 지속적 모니터링`,
    diagram: {
      type: 'steps',
      caption: '탐지 규칙의 배포 경로',
      steps: [
        { label: '규칙 작성', note: '메타데이터와 표본 포함' },
        { label: '리뷰', note: '탐지 의도와 오탐 판단' },
        { label: '표본 시험', note: '회귀 방지' },
        { label: '배포와 계측', note: '발동 이력 수집' },
      ],
    },
  },
  {
    slug: 'canary-token',
    title: '카나리 토큰으로 침해 조기 탐지',
    body: `침해 탐지에서 가장 어려운 부분은 정상과 비정상을 가르는 일이다. 카나리는 이 문제를 뒤집는다. 정상적으로는 아무도 건드리지 않는 것을 미리 심어두고, 그것이 건드려지면 그 사실 자체가 침해 신호가 된다. 오탐이 거의 없고 구축 비용도 낮아서 효율이 가장 좋은 탐지 수단에 속한다.

## 무엇을 심는가?

| 유형 | 심는 위치 | 발동 의미 |
| --- | --- | --- |
| 미사용 자격 증명 | 설정 파일, 저장소 | 자격 증명 수집 시도 |
| 가짜 문서 | 파일 서버 공유 폴더 | 내부 탐색 진행 |
| 미사용 계정 | 디렉터리 | 계정 목록 수집과 대입 |
| 가짜 데이터 항목 | 데이터베이스 | 대량 조회 또는 유출 |
| 미사용 호스트 | 내부 대역 | 네트워크 스캔 |
| 웹 비콘 | 문서 안 링크 | 문서 외부 반출 |

![정상 접근이 없는 자원과 경보 발생](/img/posts/canary-token.svg)

## 어디에 두는지가 효과를 정한다

공격자가 침해 후 실제로 찾아보는 곳에 둬야 한다. 무작위로 뿌리면 발동하지 않는다. 침해 단계를 따라 생각하면 위치가 정해진다.

\`\`\`
초기 침입 후   설정 파일, 환경 변수 파일, 브라우저 저장 자격 증명
권한 확대      관리자처럼 보이는 미사용 계정
내부 탐색      파일 공유의 "인사자료", "계약서" 폴더
데이터 수집    고객 테이블 안의 가짜 항목
유출 준비      압축·전송 대상이 되는 위치
\`\`\`

## 데이터 유출 탐지에 특히 유용하다

고객 데이터에 실재하지 않는 항목을 섞어 두고, 그 항목의 메일 주소나 전화번호로 접촉이 오면 데이터가 외부로 나갔다는 뜻이 된다. 어느 시점의 사본이 유출됐는지도 심어둔 세대로 추정할 수 있다.

## 경보를 특별하게 다룬다

카나리 경보는 다른 경보와 섞으면 안 된다. 오탐이 거의 없으므로 즉시 호출 수준으로 다루고, 대응 절차를 미리 문서로 만들어 둔다. 발동 시 무엇을 확인하고 누구를 부를지 정해 두지 않으면 신호를 낭비한다.

## 존재를 숨긴다

카나리 위치가 문서로 공유되면 내부자에게는 무력해진다. 위치 목록은 최소 인원만 접근하게 하고, 이름도 카나리임이 드러나지 않게 정한다. 반면 자동화 도구가 잘못 건드리지 않도록 예외 처리는 필요하다.

## 바로 확인하기

간단한 형태부터 심는다. 미사용 자격 증명 하나와 미사용 계정 하나로 시작할 수 있다.

\`\`\`bash
# 사용 이력이 전혀 없어야 하는 자격 증명을 만들고 설정 파일에 남긴다
cat >> /srv/app/config/legacy.env <<'ENV'
# 사용하지 않는 예전 설정 — 삭제 예정
LEGACY_S3_ACCESS_KEY=AKIA0000CANARY00000
LEGACY_S3_SECRET_KEY=canary-placeholder-value
ENV

# 이 키로 어떤 호출이든 발생하면 즉시 경보
aws cloudtrail lookup-events \\
  --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=AKIA0000CANARY00000 \\
  --max-results 5
\`\`\`

데이터 카나리는 조회 자체를 탐지 조건으로 만든다.

\`\`\`sql
-- 정상 업무에서 조회될 이유가 없는 항목
INSERT INTO customers (name, email, phone, note)
VALUES ('점검용', 'canary+db1@example.com', '000-0000-0000', 'do-not-use');

-- 이 항목이 포함된 조회를 감사 로그에서 탐지 규칙으로 잡는다
\`\`\`

## 참고

- MITRE Engage — 기만 기술 개요
- MITRE ATT&CK — Credentials from Password Stores
- NIST SP 800-137, 지속적 모니터링`,
    diagram: {
      type: 'flow',
      caption: '카나리 발동으로 얻는 시간',
      steps: [
        { label: '초기 침입', note: '탐지되지 않을 수 있다' },
        { label: '자격 증명 탐색', note: '카나리 접촉' },
        { label: '즉시 경보', note: '오탐 거의 없음' },
        { label: '격리와 조사', note: '피해 확대 전 개입' },
      ],
    },
  },
  {
    slug: 'cloud-incident',
    title: '클라우드 침해사고 초동 조치 차이',
    body: `클라우드에서의 초동 조치는 서버실에서 하던 것과 다르다. 전원을 뽑는 대신 자격 증명을 무효화하고, 디스크를 떼는 대신 스냅샷을 만든다. 관리 콘솔 접근 자체가 침해 수단이므로 조사 계정을 먼저 확보해야 한다. 순서를 미리 정해두지 않으면 증거를 지우면서 대응하게 된다.

## 무엇이 달라지는가?

| 조치 | 온프레미스 | 클라우드 |
| --- | --- | --- |
| 격리 | 네트워크 케이블 분리 | 보안 그룹 교체로 통신 차단 |
| 전원 | 종료 | 종료하면 메모리 증거 소실 |
| 증거 확보 | 디스크 복제 | 스냅샷 생성 |
| 계정 차단 | 도메인 계정 비활성화 | 자격 증명 무효화와 세션 폐기 |
| 조사 환경 | 별도 장비 | 격리된 조사 계정 |
| 범위 확인 | 자산 목록 | 감사 로그 질의 |

![클라우드 초동 조치 순서](/img/posts/cloud-incident.svg)

## 순서를 미리 정한다

급할 때 판단하면 반드시 순서가 뒤집힌다. 다음 순서를 문서로 만들고 훈련해 둬야 한다.

\`\`\`
1. 조사자용 별도 계정 확보 — 침해된 자격 증명을 쓰지 않는다
2. 스냅샷 생성 — 삭제·종료보다 먼저
3. 네트워크 격리 — 규칙 교체로 통신만 차단, 인스턴스는 유지
4. 자격 증명 무효화 — 노출된 키, 역할 세션, 사용자 세션
5. 감사 로그 보존 — 보관 기간 연장과 별도 계정 복사
6. 범위 확인 — 어떤 자원이 어떤 자격 증명으로 접근됐는지
\`\`\`

## 종료하지 않는다

인스턴스를 종료하면 메모리 증거가 사라지고, 임시 디스크를 쓰는 구성이라면 디스크 내용까지 사라진다. 격리는 통신 차단으로 하고 인스턴스는 살려둔다. 자동 확장 구성에서는 대상 인스턴스를 그룹에서 분리해 교체되지 않도록 해야 한다.

## 자격 증명 무효화가 실제 격리다

클라우드에서는 자격 증명이 곧 접근 경로다. 노출된 액세스 키를 지우는 것만으로는 부족하고, 이미 발급된 임시 세션이 만료될 때까지 유효하다. 역할 세션을 명시적으로 거부하는 정책을 붙여야 즉시 끊긴다.

## 감사 로그를 먼저 지킨다

공격자가 감사 로그 설정을 끄거나 보관 기간을 줄일 수 있다. 사고 인지 직후 로그를 별도 계정으로 복사하고 삭제 방지를 설정한다. 이 조치가 늦으면 조사 자체가 불가능해진다.

## 바로 확인하기

격리와 증거 확보를 정해진 명령으로 즉시 실행할 수 있게 준비해 둔다.

\`\`\`bash
INSTANCE=i-0123456789abcdef0

# 1) 증거 스냅샷 — 격리보다 먼저
for vol in $(aws ec2 describe-instances --instance-ids "$INSTANCE" \\
  --query 'Reservations[].Instances[].BlockDeviceMappings[].Ebs.VolumeId' --output text); do
  aws ec2 create-snapshot --volume-id "$vol" \\
    --description "IR $INSTANCE $(date -u +%FT%TZ)" --query SnapshotId --output text
done

# 2) 통신만 차단 — 종료하지 않는다
aws ec2 modify-instance-attribute --instance-id "$INSTANCE" --groups "$SG_QUARANTINE"

# 3) 노출된 역할 세션 즉시 차단 (발급 시각 기준 거부 정책)
aws iam put-role-policy --role-name "$ROLE" --policy-name ir-deny-old-sessions \\
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Action":"*","Resource":"*",
   "Condition":{"DateLessThan":{"aws:TokenIssueTime":"'"$(date -u +%FT%TZ)"'"}}}]}'
\`\`\`

범위 확인은 감사 로그 질의로 한다.

\`\`\`bash
aws cloudtrail lookup-events --max-results 50 \\
  --lookup-attributes AttributeKey=AccessKeyId,AttributeValue="$LEAKED_KEY" \\
  --query 'Events[].[EventTime,EventName,Username]' --output table
\`\`\`

## 참고

- NIST SP 800-61, 컴퓨터 보안 사고 처리 지침
- 클라우드 공급자별 사고 대응 안내서
- MITRE ATT&CK for Cloud 매트릭스`,
    diagram: {
      type: 'steps',
      caption: '클라우드 초동 조치 순서',
      steps: [
        { label: '조사 계정 확보', note: '침해된 자격 증명 사용 금지' },
        { label: '스냅샷 생성', note: '격리보다 먼저' },
        { label: '통신 차단', note: '종료하지 않는다' },
        { label: '자격 증명 무효화', note: '세션까지 거부' },
      ],
    },
  },
]
