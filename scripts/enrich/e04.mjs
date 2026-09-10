const R = String.raw
export default {

'iam-least-privilege': R`## 실제로 이렇게 터진다

유출된 접근 키 하나로 계정 전체가 넘어간 사례에서, 그 키의 정책은 관리자 권한이었다. 처음에는 특정 버킷 접근만 필요했는데 오류가 나자 권한을 넓혔고, 동작한 뒤에 다시 좁히지 않았다. "일단 열고 나중에 좁히기" 의 나중은 오지 않는다.

역할에 붙은 정책이 스무 개인 경우도 흔하다. 각각은 좁은데 합집합이 넓어서, 실제 권한이 무엇인지 아무도 설명하지 못한다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 관리형 정책은 안전하다 | 이름과 달리 범위가 넓은 것이 많다 |
| 읽기 전용이면 위험하지 않다 | 설정과 자격 증명이 다 읽힌다 |
| 정책을 좁히면 장애가 난다 | 사용 기록으로 좁히면 거의 없다 |
| 조건은 복잡해서 안 쓴다 | 조건 한 줄이 정책 열 줄보다 낫다 |
| 사람 계정만 관리하면 된다 | 역할과 서비스 계정이 더 많다 |

## 사용 기록으로 좁히는 절차

추측하지 않고 실제 호출을 근거로 삼는다.

1. 최근 90일 이상 호출 기록을 모은다 — 분기 배치가 포함되도록
2. 서비스별·동작별로 실제 호출된 것만 남긴다
3. 새 정책을 만들되 먼저 기존 정책과 병행한다
4. 거부 로그를 관찰한다 — 빠진 권한이 여기서 드러난다
5. 2주 뒤 옛 정책을 떼고, 거부 경보를 유지한다

\`\`\`bash
# 역할이 최근에 실제로 쓴 서비스 목록 (액세스 어드바이저)
ROLE=arn:aws:iam::111122223333:role/app-role
ID=$(aws iam generate-service-last-accessed-details --arn "$ROLE" --query JobId --output text)
sleep 5
aws iam get-service-last-accessed-details --job-id "$ID" \
  --query 'ServicesLastAccessed[].[ServiceName,TotalAuthenticatedEntities,LastAuthenticated]' \
  --output text | awk '$2 > 0'
\`\`\`

## 조건으로 좁히기

동작 목록을 줄이는 것보다 조건을 붙이는 편이 효과가 클 때가 많다.

| 조건 | 막는 것 |
| --- | --- |
| 출발지 대역 | 유출된 키의 외부 사용 |
| 리전 제한 | 감시가 없는 리전 사용 |
| 태그 일치 | 다른 팀 자원 접근 |
| 다단계 인증 여부 | 세션 없는 특권 동작 |
| 시간 | 업무 외 시간 변경 |`,

'bucket-exposure': R`## 실제로 이렇게 터진다

백업 파일이 담긴 버킷이 공개로 열려 있던 사례가 반복된다. 대개 처음부터 공개로 만든 것이 아니라, 정적 파일을 서빙하려고 잠깐 열었다가 되돌리지 않은 경우다. 버킷 이름은 규칙적이라 추측으로 찾을 수 있고, 자동 탐색 도구도 널려 있다.

객체 단위 권한이 남은 경우도 있다. 버킷 정책은 잠갔는데 개별 객체에 공개 권한이 붙어 있어서, 목록은 안 보여도 주소를 알면 열린다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 이름이 복잡해서 못 찾는다 | 사전 공격과 로그 수집으로 찾힌다 |
| 목록이 안 보이면 안전하다 | 개별 객체 주소로 접근된다 |
| 버킷 정책만 보면 된다 | 객체 ACL 과 계정 설정이 따로 있다 |
| 내부용이라 공개일 리 없다 | 대부분의 사고가 내부용 버킷이다 |
| 암호화했으니 괜찮다 | 저장 암호화는 공개 접근을 막지 않는다 |

## 무엇을 잠그는가

| 계층 | 설정 |
| --- | --- |
| 계정 | 공개 접근 차단을 계정 전체에 강제 |
| 버킷 | 공개 접근 차단 4가지 모두 |
| 객체 ACL | 비활성화 — 소유자 강제 |
| 정책 | 명시적 주체만, 와일드카드 금지 |
| 전송 | HTTPS 강제 조건 |
| 감사 | 데이터 이벤트 로깅 |

객체 ACL 을 아예 비활성화하는 것이 관리 부담을 크게 줄인다. 권한이 버킷 정책 한 곳으로 모인다.

## 점검 절차

\`\`\`bash
# 계정 전체 공개 차단 상태
aws s3control get-public-access-block --account-id "$ACCOUNT" 2>&1 | head -8

# 버킷별 공개 여부 — 한 번에 훑는다
for b in $(aws s3api list-buckets --query 'Buckets[].Name' --output text); do
  s=$(aws s3api get-bucket-policy-status --bucket "$b" \
        --query 'PolicyStatus.IsPublic' --output text 2>/dev/null || echo '-')
  o=$(aws s3api get-bucket-ownership-controls --bucket "$b" \
        --query 'OwnershipControls.Rules[0].ObjectOwnership' --output text 2>/dev/null || echo '-')
  printf '%-40s 공개 %-6s 소유권 %s\n' "$b" "$s" "$o"
done
\`\`\`

공개 여부가 true 로 나오는 것은 즉시, 소유권이 BucketOwnerEnforced 가 아닌 것은 계획을 세워 처리한다.`,

'cloud-audit-log': R`## 실제로 이렇게 터진다

침해 조사에서 로그가 90일치밖에 없어 최초 침입 시점을 특정하지 못한 사례가 있다. 공격자가 들어온 것은 다섯 달 전이었다. 보관 기간을 비용 때문에 줄였는데, 그 결정이 조사 가능성을 결정했다.

로그를 같은 계정에 두었다가 함께 지워진 경우도 있다. 권한을 얻은 공격자가 가장 먼저 하는 일 중 하나가 기록 삭제다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 기본 로깅이면 충분하다 | 데이터 이벤트는 따로 켜야 한다 |
| 한 리전만 켜면 된다 | 안 쓰는 리전이 공격 무대가 된다 |
| 같은 계정에 두면 편하다 | 침해되면 함께 지워진다 |
| 90일이면 충분하다 | 발견까지 걸리는 시간이 더 길다 |
| 로그가 있으면 조사가 된다 | 검색 가능한 상태여야 한다 |

## 어떻게 구성하는가

| 항목 | 권장 |
| --- | --- |
| 범위 | 전 리전, 조직 전체 |
| 대상 | 관리 이벤트 + 민감 자원의 데이터 이벤트 |
| 저장 위치 | 별도 보안 계정 |
| 변경 방지 | 객체 잠금, 삭제 불가 기간 |
| 보관 | 검색 가능 90일 + 저비용 1년 이상 |
| 무결성 | 다이제스트 검증 활성 |
| 경보 | 로깅 중지·설정 변경 시 즉시 |

마지막 항목이 중요하다. 로깅을 끄는 행위 자체가 가장 강한 침해 신호다.

## 점검 절차

\`\`\`bash
# 전 리전·조직 범위인지, 로그 검증이 켜져 있는지
aws cloudtrail describe-trails \
  --query 'trailList[].[Name,IsMultiRegionTrail,IsOrganizationTrail,LogFileValidationEnabled,S3BucketName]' \
  --output table

# 실제로 기록 중인지 — 만들어 두고 꺼 둔 경우가 있다
for t in $(aws cloudtrail describe-trails --query 'trailList[].Name' --output text); do
  printf '%-28s ' "$t"
  aws cloudtrail get-trail-status --name "$t" --query 'IsLogging' --output text
done

# 데이터 이벤트가 켜져 있는지
aws cloudtrail get-event-selectors --trail-name main \
  --query 'EventSelectors[].DataResources' --output json | head -20
\`\`\``,

'container-image': R`## 실제로 이렇게 터진다

이미지 하나에 취약점이 900건 나온 경우가 있다. 원인은 코드가 아니라 베이스 이미지였다. 범용 배포판 전체를 담은 이미지를 썼고, 우리가 쓰지 않는 패키지가 대부분이었다. 애플리케이션은 바이너리 하나면 충분했다.

빌드 도구가 최종 이미지에 남는 경우도 흔하다. 컴파일러와 패키지 관리자가 그대로 있으면 침해 후 공격자가 쓸 도구가 이미 준비된 셈이다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| latest 태그를 쓰면 최신이라 안전하다 | 무엇이 배포됐는지 재현할 수 없다 |
| 취약점 수가 적은 이미지가 안전하다 | 도달 가능성이 다르다 |
| 스캔을 통과하면 끝이다 | 새 취약점은 계속 나온다 |
| 알파인이면 항상 낫다 | 라이브러리 차이로 문제가 생기기도 한다 |
| 이미지는 한 번 만들면 된다 | 정기 재빌드가 패치의 실체다 |

## 무엇을 기준으로 고르는가

| 기준 | 확인 |
| --- | --- |
| 크기 | 작을수록 공격 표면이 작다 |
| 포함 도구 | 셸·패키지 관리자·컴파일러 유무 |
| 갱신 주기 | 배포자가 얼마나 자주 올리는지 |
| 서명·출처 | 출처 증명이 있는지 |
| 실행 사용자 | 루트가 아닌 기본 사용자 |
| 고정 방식 | 태그가 아니라 다이제스트로 |

## 줄이는 절차

1. 다단계 빌드로 바꾼다 — 빌드 도구가 최종 이미지에 남지 않는다
2. 실행에 필요한 것만 남긴 최소 베이스로 옮긴다
3. 태그 대신 다이제스트로 고정한다
4. 루트가 아닌 사용자로 실행하고 파일 시스템을 읽기 전용으로 둔다
5. 주간 자동 재빌드를 걸어 베이스의 패치를 받는다

\`\`\`bash
# 최종 이미지에 셸과 패키지 관리자가 남아 있는지
docker run --rm --entrypoint sh app:latest -c 'command -v sh apt apk yum gcc curl' 2>/dev/null
# 아무것도 안 나오면 잘 줄인 것이다

# 다이제스트로 고정돼 있는지
grep -rn '^FROM' Dockerfile | grep -v '@sha256:' && echo '태그로 고정돼 있다'
\`\`\``,

'k8s-rbac': R`## 실제로 이렇게 터진다

파드 하나가 침해된 뒤 클러스터 전체가 넘어간 사례에서, 그 파드의 서비스 계정에 시크릿 읽기 권한이 있었다. 다른 네임스페이스의 시크릿까지 읽을 수 있었고, 거기에 데이터베이스 자격 증명이 있었다.

기본 서비스 계정에 토큰이 자동 마운트되는 것도 흔한 문제다. 애플리케이션이 API 서버를 쓰지 않는데도 토큰이 파일로 들어가 있다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 네임스페이스가 분리하면 격리된다 | 클러스터 범위 권한이 그것을 넘는다 |
| 읽기 권한은 위험하지 않다 | 시크릿 읽기는 자격 증명 획득이다 |
| 기본 설정이면 안전하다 | 토큰 자동 마운트가 기본이다 |
| 개발 클러스터는 느슨해도 된다 | 같은 이미지와 자격 증명을 쓴다 |
| 역할이 많으면 세밀한 것이다 | 합집합이 넓으면 의미가 없다 |

## 권한 상승 경로

| 가진 권한 | 도달 가능한 것 |
| --- | --- |
| 시크릿 읽기 | 다른 서비스의 자격 증명 |
| 파드 생성 | 노드에 임의 컨테이너 실행 |
| 파드 exec | 실행 중 컨테이너 안으로 |
| 노드 프록시 | kubelet 을 통한 우회 |
| 역할 바인딩 생성 | 스스로 권한 상승 |
| 특권 컨테이너 허용 | 노드 탈출 |

마지막 두 개가 특히 위험하다. 바인딩을 만들 수 있으면 다른 권한이 없어도 스스로 관리자가 된다.

## 점검 절차

\`\`\`bash
# 클러스터 관리자 권한을 가진 주체
kubectl get clusterrolebindings -o json |
python3 -c 'import sys,json
for b in json.load(sys.stdin)["items"]:
    if b["roleRef"]["name"] in ("cluster-admin",):
        for s in b.get("subjects") or []:
            print(b["metadata"]["name"], s.get("kind"), s.get("name"), s.get("namespace",""))'

# 시크릿을 읽을 수 있는 역할
kubectl get clusterroles,roles -A -o json |
python3 -c 'import sys,json
for r in json.load(sys.stdin)["items"]:
    for rule in r.get("rules") or []:
        if "secrets" in (rule.get("resources") or []) and set(rule.get("verbs") or []) & {"get","list","watch","*"}:
            print(r["kind"], r["metadata"].get("namespace",""), r["metadata"]["name"])'

# 토큰이 필요 없는데 자동 마운트되는 파드
kubectl get pods -A -o json |
python3 -c 'import sys,json
for p in json.load(sys.stdin)["items"]:
    if p["spec"].get("automountServiceAccountToken") is not False:
        print(p["metadata"]["namespace"], p["metadata"]["name"])' | head -20
\`\`\``,
}
