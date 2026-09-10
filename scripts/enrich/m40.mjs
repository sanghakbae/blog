const R = String.raw
export default {

'pod-security-standards': R`## 경고 모드로 현황 보기

강제 전에 무엇이 걸리는지 센다.

\`\`\`bash
for ns in $(kubectl get ns -o name | cut -d/ -f2); do
  kubectl label --overwrite ns "$ns" \
    pod-security.kubernetes.io/warn=restricted >/dev/null
done
kubectl get events -A --field-selector reason=FailedCreate -o wide | head -20
\`\`\`

배포 시 경고가 뜨는 워크로드가 조치 대상이다. 목록을 만들어 팀별로 나누고, 이미지와 매니페스트를 고친 순서대로 해당 네임스페이스를 강제로 전환한다.`,

'k8s-rbac-audit': R`## 상승 경로 가진 주체 찾기

관리자 바인딩만 보면 놓친다. 파드 생성과 비밀 읽기도 함께 본다.

\`\`\`bash
kubectl get clusterrolebindings -o json | jq -r '
  .items[] | select(.roleRef.name=="cluster-admin")
  | .subjects[]? | "cluster-admin \(.kind) \(.name)"'

kubectl get clusterroles -o json | jq -r '
  .items[] | select(any(.rules[]?; (.resources[]? == "pods") and (.verbs[]? == "create")))
  | "pod-create \(.metadata.name)"'
\`\`\`

두 목록을 합친 것이 실질적인 관리자 후보다. 파드 보안 표준이 강제되어 있으면 두 번째 목록의 위험이 크게 준다.`,

'container-image-minimal': R`## 이미지별 취약점 수 비교

기본 이미지를 바꾸면 얼마나 줄어드는지 실제로 재 본다.

\`\`\`bash
for img in app:current app:distroless; do
  printf '%-24s ' "$img"
  trivy image --quiet --severity HIGH,CRITICAL --format json "$img" \
    | jq '[.Results[]?.Vulnerabilities // [] | length] | add // 0'
done
\`\`\`

숫자 차이가 전환의 근거가 된다. 대개 한 자릿수로 떨어진다. 이 결과를 보여 주면 팀 설득이 쉬워진다.`,

'k8s-node-hardening': R`## 노드 접근 경로 점검

파드에서 노드나 클라우드 자격 증명에 닿는 경로를 찾는다.

\`\`\`bash
# 런타임 소켓·호스트 경로를 마운트한 파드
kubectl get pods -A -o json | jq -r '
  .items[] | select(any(.spec.volumes[]?; .hostPath != null))
  | "\(.metadata.namespace)/\(.metadata.name) \(.spec.volumes[] | select(.hostPath).hostPath.path)"' | head -20
\`\`\`

소켓이나 시스템 경로가 보이면 즉시 검토한다. 이어서 파드에서 메타데이터 주소로 요청이 나가는지 네트워크 정책으로 막혀 있는지 확인한다.`,

'k8s-secret-handling': R`## 저장소 암호화 확인

설정 하나로 되고 효과가 크므로 먼저 확인한다.

\`\`\`bash
# 저장 데이터 암호화 설정 여부 (관리형 서비스는 콘솔·API 로 확인)
kubectl get secrets -A --no-headers | wc -l
kubectl auth can-i list secrets --all-namespaces --as=system:serviceaccount:default:default
\`\`\`

두 번째 명령이 yes 를 반환하면 기본 서비스 계정이 전 비밀을 읽을 수 있다는 뜻이다. 권한 축소가 급하다. 비밀 개수가 많으면 외부 관리 서비스 연동을 검토한다.`,

'admission-control-policy': R`## 정책 시험 세트

정책을 바꿀 때마다 통과·거부 예시로 확인한다.

\`\`\`bash
for f in policy-tests/should-pass/*.yaml; do
  kubectl apply --dry-run=server -f "$f" >/dev/null 2>&1 || echo "통과해야 하는데 거부: $f"
done
for f in policy-tests/should-fail/*.yaml; do
  kubectl apply --dry-run=server -f "$f" >/dev/null 2>&1 && echo "거부해야 하는데 통과: $f"
done
\`\`\`

이 시험을 파이프라인에 넣으면 정책 변경으로 생기는 회귀를 배포 전에 잡는다.`,

'container-runtime-detection': R`## 사각지대 확인

배포율이 아니라 정상 동작 노드 수를 본다.

\`\`\`bash
kubectl get nodes -o name | wc -l
kubectl get pods -n security -l app=runtime-agent \
  --field-selector status.phase=Running -o name | wc -l
\`\`\`

두 숫자가 다르면 그 차이가 사각지대다. 에이전트가 뜨지 않는 노드는 대개 자원 부족이나 노드 유형 차이가 원인이다. 주간 점검 항목에 넣는다.`,

'image-signing-verification': R`## 검증이 실제로 걸리는지

서명되지 않은 이미지를 배포해 본다.

\`\`\`bash
kubectl run test-unsigned --image=alpine:latest --dry-run=server -o name \
  && echo '통과 — 검증이 없거나 조건이 느슨하다' \
  || echo '차단됨'
\`\`\`

통과하면 검증이 동작하지 않는 것이다. 이어서 다른 주체가 서명한 이미지도 시험한다. 그것까지 통과하면 서명 존재만 보고 주체를 확인하지 않는 상태다.`,

'sidecar-trust': R`## 파드 내 공유 범위 확인

의도하지 않은 공유 설정이 남아 있는지 본다.

\`\`\`bash
kubectl get pods -A -o json | jq -r '
  .items[]
  | select(.spec.shareProcessNamespace == true or .spec.hostNetwork == true
           or .spec.hostPID == true)
  | "\(.metadata.namespace)/\(.metadata.name) pid=\(.spec.shareProcessNamespace // false) net=\(.spec.hostNetwork // false)"'
\`\`\`

디버깅을 위해 켜 두고 잊은 설정이 나오는 경우가 많다. 주 컨테이너의 로컬 관리 포트에 인증이 걸려 있는지도 함께 확인한다.`,

'k8s-audit-log-use': R`## 조사에 쓰는 질의

사고 때 새로 작성하지 않도록 미리 만들어 둔다.

\`\`\`bash
# 최근 권한 관련 변경
jq -r 'select(.objectRef.resource | test("rolebindings|clusterrolebindings"))
       | select(.verb == "create" or .verb == "update")
       | "\(.requestReceivedTimestamp) \(.user.username) \(.objectRef.name)"' audit.log | tail -20

# 익명 접근 성공
jq -r 'select(.user.username == "system:anonymous")
       | select(.responseStatus.code < 400)
       | "\(.requestReceivedTimestamp) \(.verb) \(.requestURI)"' audit.log | head
\`\`\`

두 번째 질의에 결과가 나오면 설정 오류다. 즉시 확인한다.`,
}
