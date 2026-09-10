import type { SeedPost } from './types'

/** 301~310 — Azure·GCP 와 멀티클라우드 운영 */
export const posts31: SeedPost[] = [
  {
    slug: 'azure-rbac',
    title: 'Azure 역할 할당과 관리 그룹 설계',
    body: `Azure 권한은 관리 그룹, 구독, 리소스 그룹, 리소스의 네 계층으로 상속된다. 상위에 준 권한은 하위 전체에 미치므로, 편의로 구독 수준에 소유자를 붙이면 그 아래 모든 것에 대한 전권이 된다. 계층을 어떻게 나누고 권한을 어느 높이에 붙일지가 설계의 핵심이다.

## 어떤 역할이 실제로 위험한가?

| 역할 | 범위 | 위험 |
| --- | --- | --- |
| 소유자 | 전체 + 권한 부여 | 스스로 권한을 늘릴 수 있다 |
| 참여자 | 전체 리소스 변경 | 데이터 접근 대부분 가능 |
| 사용자 액세스 관리자 | 권한 부여만 | 소유자로 승격 가능 |
| 역할별 데이터 접근 | 저장소·키 등 | 데이터 유출 경로 |
| 읽기 권한자 | 조회 | 설정 정보 수집 |

권한 부여 능력을 가진 역할이 가장 위험하다. 참여자는 데이터를 만질 수 있지만 권한을 늘릴 수는 없어서 피해가 그 범위에 머문다.

![상속 계층과 권한 범위](/img/posts/azure-rbac.svg)

## 관리 그룹으로 금지선을 긋는다

역할 할당으로 허용을 관리하고, 정책으로 금지를 관리한다. 두 개를 함께 써야 실수와 우회가 함께 막힌다.

\`\`\`
루트 관리 그룹      전 조직 공통 금지 (공개 IP 금지, 허용 리전 제한)
  └ 운영            승인된 구성만, 변경은 파이프라인으로
  └ 개발            자유도 높음, 비용 상한과 자동 삭제
  └ 샌드박스        인터넷 노출 전면 금지

정책 효과   Deny(차단) · Audit(기록) · DeployIfNotExists(자동 보정)
도입 순서   Audit 으로 시작 → 위반 목록 확인 → Deny 로 전환
\`\`\`

![허용과 금지의 분담](/img/posts/azure-rbac-2.svg)

## 상시 권한을 없앤다

특권 역할을 상시 부여하지 않고 필요할 때 승격받게 하면, 자격 증명이 탈취돼도 곧바로 쓰이지 않는다. 승격 기록이 남는 것도 이점이다. 상시 권한이 없으면 "누가 소유자인가" 라는 질문이 "누가 소유자로 승격할 수 있는가" 로 바뀌고, 그 목록은 훨씬 짧게 유지된다. 그리고 사용자에게 직접 역할을 붙이지 않고 그룹에 붙이면, 입퇴사와 조직 변경이 권한에 자동으로 반영된다. 사용자 직접 할당은 시간이 지나면 아무도 관리하지 않는 잔여물이 된다.

| 설정 | 권장 |
| --- | --- |
| 승격 최대 시간 | 2~8시간 |
| 승인 필요 | 소유자·사용자 액세스 관리자는 필수 |
| 다단계 인증 | 승격 시 재확인 |
| 알림 | 승격 발생 시 보안팀 통지 |

## 지금 상태를 뽑는 명령

\`\`\`bash
# 넓은 범위에 붙은 특권 역할 — 구독·관리 그룹 수준의 소유자를 찾는다
az role assignment list --all --include-inherited \\
  --query "[?roleDefinitionName=='Owner' || roleDefinitionName=='User Access Administrator'].
           {주체:principalName, 역할:roleDefinitionName, 범위:scope}" -o table

# 사용자에게 직접 붙은 할당 — 그룹 기반으로 옮길 대상
az role assignment list --all \\
  --query "[?principalType=='User'].{주체:principalName, 역할:roleDefinitionName, 범위:scope}" -o table

# 사용자 정의 역할에 위험한 동작이 들어 있는지
az role definition list --custom-role-only true \\
  --query "[].{이름:roleName, 동작:permissions[0].actions}" -o json | head -40
\`\`\`

## 실제로 이렇게 터진다

구독 수준에 기여자 역할을 준 사례가 있다. 편했지만 그 계정 하나로 구독 전체의 자원을 만들고 지울 수 있었다. 개발자 계정이 피싱으로 털리자 운영 자원이 삭제됐다.

또 하나는 역할을 관리 그룹 수준에서 부여하고 상속을 잊은 경우다. 하위 구독 전체에 적용된다는 것을 몰랐다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 기여자면 안전하다 | 자원 생성·삭제가 다 된다 |
| 역할 할당 범위는 좁다 | 상속된다 |
| 소유자만 위험하다 | 사용자 액세스 관리자도 상승 가능 |
| 거부 규칙으로 막으면 된다 | 예외 처리가 복잡하다 |
| 내장 역할이면 충분하다 | 사용자 지정 역할이 필요할 때가 많다 |

## 범위와 상속

| 범위 | 영향 |
| --- | --- |
| 관리 그룹 | 하위 전 구독 |
| 구독 | 하위 전 자원 그룹 |
| 자원 그룹 | 그 안의 자원 |
| 자원 | 해당 자원만 |

가능한 한 좁은 범위에 부여한다. 자원 그룹 단위가 실무적인 기본선이다.

## 위험한 역할

| 역할 | 위험 |
| --- | --- |
| 소유자 | 전권 + 권한 부여 |
| 사용자 액세스 관리자 | 스스로 권한 상승 가능 |
| 기여자 | 자원 조작 전권 |
| 특정 서비스 관리자 | 해당 서비스 전권 |

권한 부여 능력이 있는 역할이 가장 위험하다. 소수에게만 주고 상시 부여를 피한다.

## 점검

\`\`\`bash
# 구독 범위 이상의 넓은 역할 할당 — 검토 대상
az role assignment list --all --include-inherited \
  --query "[?roleDefinitionName=='Owner' || roleDefinitionName=='User Access Administrator'].[principalName,roleDefinitionName,scope]" \
  -o table

# 사용자 지정 역할 목록
az role definition list --custom-role-only true --query '[].roleName' -o tsv
\`\`\`

## 상시 권한 줄이기

넓은 역할은 상시 부여하지 않고 필요할 때 승인받아 활성화하는 방식으로 옮긴다.

| 역할 | 방식 |
| --- | --- |
| 소유자 | 승인 후 활성화, 짧은 기간 |
| 사용자 액세스 관리자 | 승인 후 활성화 |
| 기여자 | 자원 그룹 범위로 축소 |
| 읽기 권한 | 상시 가능 |

## 사용자 지정 역할

내장 역할이 넓으면 필요한 작업만 담은 역할을 만든다. 개발자에게 필요한 것이 배포와 로그 조회뿐이라면, 그 두 가지만 담은 역할이 기여자보다 훨씬 안전하다.

## 참고

- Microsoft — Azure RBAC 모범 사례, Azure Policy 효과
- Microsoft — Privileged Identity Management
- NIST SP 800-53 AC-6 Least Privilege`,
    diagram: {
      type: 'layers',
      caption: '권한 상속',
      layers: [
        { label: '관리 그룹', note: '조직 공통 금지선' },
        { label: '구독', note: '환경 경계' },
        { label: '리소스 그룹', note: '수명 단위' },
        { label: '리소스', note: '최소 부여 지점' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '허용과 금지',
      x: ['정책 금지 있음', '없음'],
      y: ['최소 역할', '넓은 역할'],
      cells: ['안전', '실수 여지', '금지선으로 방어', '전권'],
    },
  },
  {
    slug: 'azure-key-vault',
    title: 'Azure Key Vault 접근 통제와 비용',
    body: `키와 비밀값을 한곳에 모으면 관리가 쉬워지는 대신, 그 한곳이 뚫리면 전부 나간다. Key Vault 를 도입할 때 가장 자주 발생하는 문제는 접근 정책을 넓게 열어 두는 것과, 볼트를 하나만 만들어 모든 환경이 공유하는 구성이다.

## 무엇을 저장하고 어떻게 나누는가?

| 저장 대상 | 성격 |
| --- | --- |
| 비밀값 | 접속 문자열, API 키 |
| 키 | 암호화·서명용, 꺼낼 수 없게 보관 가능 |
| 인증서 | 발급·갱신 자동화 포함 |

볼트는 환경과 신뢰 경계 단위로 나눈다. 운영과 개발이 같은 볼트를 쓰면, 개발 권한이 운영 비밀값 접근으로 이어진다.

\`\`\`
kv-prod-app        운영 애플리케이션 비밀값
kv-prod-infra      인프라·인증서
kv-dev-app         개발 (운영 값 복사 금지)
접근 주체          관리 ID(사람 아님) 우선, 사람은 승격 후 임시로만
\`\`\`

![볼트 분리와 접근 주체](/img/posts/azure-key-vault.svg)

## 접근 통제 모델을 하나로 고른다

접근 정책 방식과 역할 기반 방식이 함께 존재해서 혼선이 생긴다. 역할 기반으로 통일하는 것이 관리와 감사에 유리하다.

| 구분 | 접근 정책 | 역할 기반 |
| --- | --- | --- |
| 부여 단위 | 볼트 전체 | 볼트·개별 항목 |
| 조건부 접근 | 어려움 | 가능 |
| 감사 일관성 | 별도 | 다른 자원과 동일 |
| 권장 | 신규는 사용 안 함 | 권장 |

\`\`\`bash
# 역할 기반으로 전환하고, 항목 단위로 부여한다
az keyvault update --name kv-prod-app --enable-rbac-authorization true
az role assignment create --role 'Key Vault Secrets User' \\
  --assignee-object-id "$MI_OBJECT_ID" --assignee-principal-type ServicePrincipal \\
  --scope "/subscriptions/$SUB/resourceGroups/rg-prod/providers/Microsoft.KeyVault/vaults/kv-prod-app/secrets/db-password"
\`\`\`

![접근 경로 설계](/img/posts/azure-key-vault-2.svg)

## 비용은 어떻게 붙는가

과금은 저장량이 아니라 요청 수와 키 종류로 계산된다. 그래서 캐시 없이 매 요청마다 비밀값을 조회하는 구현이 비용을 만든다.

| 과금 항목 | 계산 기준 |
| --- | --- |
| 비밀값·인증서 작업 | 요청 1만 건 단위 |
| 소프트웨어 보호 키 작업 | 요청 1만 건 단위 |
| HSM 보호 키 | 키별 월 사용료 + 요청 수 |
| 관리형 HSM | 시간당 풀 사용료(요청과 무관) |
| 인증서 갱신 | 갱신 건당 |

애플리케이션은 시작 시 한 번 읽고 메모리에 두거나, 짧은 캐시를 둔다. 회전을 고려해 캐시 수명을 회전 주기보다 짧게 잡는다. 관리형 HSM 은 요청 수와 무관하게 시간당 과금이므로, 규정상 필요하지 않다면 처음부터 선택하지 않는 편이 낫다. 반대로 소프트웨어 보호 키는 요청 단위 과금이라 트래픽이 늘면 비용도 함께 늘어난다. 어느 쪽이든 비용 구조를 알고 캐시를 설계하면 예상 밖 청구가 나오지 않는다.

## 무엇을 점검하는가

\`\`\`bash
# 삭제 보호와 논리적 삭제 — 없으면 실수나 침해로 영구 삭제될 수 있다
az keyvault show --name kv-prod-app \\
  --query '{purgeProtection:properties.enablePurgeProtection, softDelete:properties.enableSoftDelete, rbac:properties.enableRbacAuthorization, publicNetwork:properties.publicNetworkAccess}'

# 네트워크 노출 — 사설 엔드포인트 없이 공개면 검토 대상
az keyvault show --name kv-prod-app --query 'properties.networkAcls'

# 접근 기록이 수집되는지
az monitor diagnostic-settings list \\
  --resource "$(az keyvault show -n kv-prod-app --query id -o tsv)" -o table
\`\`\`

## 실제로 이렇게 터진다

비밀 저장소를 만들고 접근 정책을 넓게 준 사례가 있다. 여러 애플리케이션이 같은 저장소를 공유했고, 하나가 침해되자 전부의 비밀이 나갔다.

또 하나는 삭제 보호를 켜지 않은 경우다. 실수로 저장소를 지웠고, 복구할 수 없었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 저장소 하나면 충분하다 | 환경·용도별로 나눠야 한다 |
| 접근 정책이면 관리가 쉽다 | 역할 기반이 더 세밀하다 |
| 삭제하면 되돌릴 수 있다 | 보호 설정이 있어야 한다 |
| 네트워크 제한은 불필요하다 | 공용 엔드포인트가 열려 있다 |
| 감사 로그는 자동이다 | 진단 설정을 켜야 한다 |

## 저장소 분리 기준

| 기준 | 이유 |
| --- | --- |
| 환경 | 개발이 운영 비밀에 닿지 않게 |
| 애플리케이션 | 침해 범위 제한 |
| 민감도 | 접근 통제 수준 차등 |
| 지역 | 규정 요구 |

저장소를 나누는 비용은 낮고 얻는 격리는 크다. 공유하지 않는 것이 기본이다.

## 필수 설정

| 항목 | 설정 |
| --- | --- |
| 일시 삭제 | 활성화 |
| 삭제 보호 | 활성화 |
| 접근 모델 | 역할 기반 |
| 네트워크 | 개인 엔드포인트 또는 방화벽 |
| 진단 로그 | 활성화, 장기 보존 |
| 만료 알림 | 인증서·비밀 만료 전 |

삭제 보호는 켜면 되돌릴 수 없으므로 신중히 결정하되, 운영 저장소에는 켜는 것이 맞다.

## 접근 권한 설계

| 주체 | 권한 |
| --- | --- |
| 애플리케이션 | 지정 비밀 읽기만 |
| 배포 파이프라인 | 필요한 비밀 읽기 |
| 운영자 | 목록·읽기 |
| 보안 담당 | 관리 |

애플리케이션에는 목록 조회 권한도 주지 않는다. 필요한 비밀의 이름을 알고 그것만 읽으면 된다.

## 점검

\`\`\`bash
# 보호 설정이 꺼진 저장소
az keyvault list --query "[?!properties.enablePurgeProtection].[name,resourceGroup]" -o table

# 공용 접근이 열린 저장소
az keyvault list \
  --query "[?properties.networkAcls.defaultAction=='Allow'].[name,resourceGroup]" -o table

# 만료가 임박한 비밀
az keyvault secret list --vault-name "$V" \
  --query "[?attributes.expires!=null].[name,attributes.expires]" -o table
\`\`\`

## 만료 관리

비밀과 인증서에 만료일을 설정하고 알림을 받는다. 만료일이 없는 비밀은 영원히 교체되지 않는다. 만료일 설정 자체가 교체 절차를 강제하는 장치다.

## 참고

- Microsoft — Key Vault 보안 권장 사항, RBAC 전환 안내
- Microsoft — Key Vault 가격 책정 페이지의 과금 단위
- NIST SP 800-57, 키 관리 권고`,
    diagram: {
      type: 'layers',
      caption: '분리 기준',
      layers: [
        { label: '환경별 볼트', note: '운영·개발 분리' },
        { label: '용도별 볼트', note: '앱·인프라' },
        { label: '항목 단위 권한', note: '역할 기반' },
        { label: '네트워크 제한', note: '사설 엔드포인트' },
      ],
    },
    diagram2: {
      type: 'bars',
      caption: '비용을 만드는 요인(상대값)',
      unit: '상대값',
      items: [
        { label: '요청 수', value: 45, note: '캐시로 줄인다' },
        { label: '관리형 HSM 풀', value: 30, note: '시간당' },
        { label: 'HSM 키 수', value: 15 },
        { label: '인증서 갱신', value: 10 },
      ],
    },
  },
  {
    slug: 'gcp-org-policy',
    title: 'GCP 조직 정책으로 금지선 긋기',
    body: `IAM 은 무엇을 허용할지 정하고, 조직 정책은 무엇을 아예 불가능하게 만들지 정한다. 권한이 있는 사람도 조직 정책이 막은 일은 못 한다. 그래서 "공개 접근 금지" 처럼 반드시 지켜야 할 규칙은 IAM 이 아니라 조직 정책에 두어야 한다.

## 어떤 제약을 먼저 걸어야 하는가?

| 제약 | 막는 것 |
| --- | --- |
| 도메인 제한 공유 | 외부 계정에 권한 부여 |
| 공개 접근 방지 | 스토리지 버킷 전체 공개 |
| 외부 IP 금지 | 인스턴스의 공개 주소 부여 |
| 서비스 계정 키 생성 금지 | 장기 키 파일 유출 |
| 리소스 위치 제한 | 데이터의 물리적 위치 이탈 |
| 기본 서비스 계정 권한 제한 | 편집자 권한 자동 부여 |

서비스 계정 키 생성 금지가 특히 효과가 크다. 유출 사고에서 가장 자주 등장하는 것이 저장소에 커밋된 키 파일이다.

![조직 정책과 IAM 의 역할 분담](/img/posts/gcp-org-policy.svg)

## 계층과 적용 순서

정책은 조직, 폴더, 프로젝트 순으로 상속된다. 상위에서 금지한 것을 하위에서 풀 수 있게 하려면 예외를 명시해야 하고, 그 예외 목록이 곧 위험 목록이 된다.

\`\`\`
조직            공통 금지 (외부 공유·공개 접근·키 생성)
  └ 폴더:운영    추가 금지 (리전 제한, 변경은 파이프라인만)
  └ 폴더:개발    일부 완화 + 만료 기한
적용 순서       Dry-run 으로 위반 확인 → 예외 정리 → 강제 적용
\`\`\`

\`\`\`bash
# 먼저 시뮬레이션으로 영향 확인 (강제 전)
gcloud resource-manager org-policies set-policy policy.yaml \\
  --organization "$ORG_ID" --dry-run 2>/dev/null || true

# 현재 적용된 정책과 상속 상태
gcloud resource-manager org-policies list --organization "$ORG_ID"
gcloud resource-manager org-policies describe \\
  constraints/compute.vmExternalIpAccess --project "$PROJECT" --effective
\`\`\`

![적용 순서](/img/posts/gcp-org-policy-2.svg)

## IAM 쪽에서 함께 조일 것

조직 정책으로 금지선을 그은 뒤, IAM 은 조건을 붙여 좁힌다. 시간과 자원 조건을 쓰면 상시 권한을 줄일 수 있다.

\`\`\`bash
# 만료 조건이 붙은 권한 부여 — 잊어도 자동으로 사라진다
gcloud projects add-iam-policy-binding "$PROJECT" \\
  --member="user:ops@example.com" --role='roles/compute.admin' \\
  --condition='expression=request.time < timestamp("2026-10-01T00:00:00Z"),title=temp-access'

# 기본 권한이 넓게 붙은 주체 찾기 — 편집자·소유자
gcloud projects get-iam-policy "$PROJECT" --format=json |
  python3 -c 'import sys,json; d=json.load(sys.stdin)
[print(b["role"], m) for b in d["bindings"] if b["role"] in ("roles/owner","roles/editor") for m in b["members"]]'
\`\`\`

## 무엇을 감시하는가

정책 변경 자체를 감시 대상으로 둔다. 조직 정책을 푸는 행위는 정상 업무일 수도 있지만 침해의 준비 단계일 수도 있다. 변경 감사 로그에 경보를 걸고, 변경 사유를 함께 기록하는 절차를 둔다.

## 실제로 이렇게 터진다

조직 정책 없이 프로젝트를 늘린 사례가 있다. 누군가 버킷을 전체 공개로 만들었고, 몇 달 뒤 검색엔진에서 발견됐다. 정책 하나면 애초에 불가능했을 설정이었다.

또 하나는 정책을 조직 전체에 강하게 걸었다가 정당한 작업이 막힌 경우다. 예외 처리 방법을 몰라 정책 자체를 해제했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 권한 관리로 충분하다 | 권한이 있어도 못 하게 막는 층이 필요하다 |
| 정책은 나중에 걸면 된다 | 이미 만들어진 자원은 그대로다 |
| 예외를 못 만든다 | 하위 노드에서 재정의할 수 있다 |
| 정책이 많을수록 안전하다 | 관리 불가능해진다 |
| 즉시 적용된다 | 기존 자원에는 소급되지 않는다 |

## 효과가 큰 정책

| 정책 | 효과 |
| --- | --- |
| 공개 접근 방지 | 버킷·자원 공개 차단 |
| 외부 사용자 도메인 제한 | 조직 밖 계정 추가 차단 |
| 서비스 계정 키 생성 제한 | 장기 자격 증명 차단 |
| 리전 제한 | 승인된 지역만 |
| 공용 IP 제한 | 인터넷 직접 노출 차단 |
| 기본 서비스 계정 권한 제한 | 과도한 기본 권한 차단 |

서비스 계정 키 생성 제한이 특히 효과적이다. 유출되는 자격 증명의 상당수가 이 키다.

## 계층 구조

| 수준 | 용도 |
| --- | --- |
| 조직 | 전사 공통 금지 사항 |
| 폴더 | 환경·부서별 차등 |
| 프로젝트 | 개별 예외 |

정책은 조직에 걸고 예외는 하위에서 재정의한다. 예외마다 사유를 기록한다.

## 도입 순서

1. 감사 모드로 현황을 파악한다 — 무엇이 위반인지
2. 위반 자원 목록을 만든다
3. 신규에만 적용되는 것을 확인하고 정책을 건다
4. 기존 위반 자원을 순차 정리한다
5. 예외가 필요한 프로젝트를 식별해 재정의한다

3번이 중요하다. 정책은 새 자원에만 적용되므로, 기존 위반은 따로 정리해야 한다.

\`\`\`bash
# 조직에 적용된 정책 목록
gcloud resource-manager org-policies list --organization="$ORG"

# 특정 정책의 실효 값 — 상속과 재정의를 반영한 결과
gcloud resource-manager org-policies describe \
  constraints/iam.disableServiceAccountKeyCreation \
  --project="$P" --effective
\`\`\`

## 참고

- Google Cloud — Organization Policy Service, 제약 조건 목록
- Google Cloud — IAM Conditions
- NIST SP 800-53 CM-7 Least Functionality`,
    diagram: {
      type: 'matrix',
      caption: '통제 수단의 역할',
      x: ['조직 정책 있음', '없음'],
      y: ['IAM 최소 권한', '넓은 권한'],
      cells: ['안전', '실수 가능', '금지선이 방어', '무제한'],
    },
    diagram2: {
      type: 'flow',
      caption: '도입 절차',
      steps: [
        { label: '시뮬레이션', note: '영향 확인' },
        { label: '위반 목록 정리', note: '예외 판단' },
        { label: '강제 적용', note: '조직·폴더' },
        { label: '변경 감시', note: '해제 시 경보' },
      ],
    },
  },
  {
    slug: 'gcp-workload-identity',
    title: 'GCP 서비스 계정 키 없애는 방법',
    body: `서비스 계정 키 파일은 만료가 없고, 어디서든 쓸 수 있고, 파일 하나로 그 계정의 모든 권한을 준다. 저장소 커밋, 로컬 다운로드 폴더, 컨테이너 이미지 안에서 발견되는 대표적인 유출 대상이다. 워크로드 아이덴티티를 쓰면 키 파일 없이 실행 환경이 스스로 신원을 증명한다.

## 키 파일이 왜 위험한가?

| 특성 | 결과 |
| --- | --- |
| 만료 없음 | 유출되면 계속 유효 |
| 위치 제약 없음 | 외부에서도 사용 가능 |
| 회수 감지 어려움 | 누가 쓰는지 모른다 |
| 복사 흔적 없음 | 유출 여부를 알 수 없다 |
| 파일 형태 | 실수로 커밋·전송되기 쉽다 |

![키 파일 유출 경로](/img/posts/gcp-workload-identity.svg)

## 실행 환경별 대체 방법

키 없이 인증하는 방법은 실행 위치에 따라 다르다. 어디서 돌리든 대체 수단이 있다.

\`\`\`
GCP 안(GKE)        워크로드 아이덴티티 — 파드의 서비스 계정을 연결
GCP 안(VM·함수)    첨부된 서비스 계정 — 메타데이터로 토큰 발급
AWS·Azure 에서     워크로드 아이덴티티 제휴 — 그쪽 신원으로 GCP 토큰 교환
CI 파이프라인      OIDC 토큰 제휴 — 저장소·워크플로 조건까지 제한
사람              사용자 계정 로그인 + 짧은 권한 승격
\`\`\`

제휴를 쓸 때는 조건을 좁히는 것이 중요하다. 저장소 이름과 브랜치까지 지정하지 않으면, 같은 CI 를 쓰는 다른 저장소가 우리 권한을 얻는다.

\`\`\`bash
# CI 용 제휴 — 특정 저장소·브랜치만 허용
gcloud iam workload-identity-pools providers create-oidc gh \\
  --location=global --workload-identity-pool=ci-pool \\
  --issuer-uri='https://token.actions.githubusercontent.com' \\
  --attribute-mapping='google.subject=assertion.sub,attribute.repo=assertion.repository' \\
  --attribute-condition='assertion.repository=="example/app" && assertion.ref=="refs/heads/main"'
\`\`\`

![제휴 구성](/img/posts/gcp-workload-identity-2.svg)

## 남은 키를 찾아 지우는 순서

한꺼번에 지우면 무엇이 멈출지 모른다. 사용 여부를 먼저 확인한다.

\`\`\`bash
# 모든 서비스 계정의 사용자 관리 키와 생성 시각
for sa in $(gcloud iam service-accounts list --format='value(email)'); do
  gcloud iam service-accounts keys list --iam-account="$sa" \\
    --managed-by=user --format="value('$sa',name,validAfterTime)" 2>/dev/null
done

# 최근 90일간 인증에 쓰인 적 없는 키 — 활동 분석으로 확인
gcloud logging read \\
  'protoPayload.authenticationInfo.serviceAccountKeyName!="" ' \\
  --freshness=90d --format='value(protoPayload.authenticationInfo.serviceAccountKeyName)' |
  sort -u > /tmp/used-keys.txt
\`\`\`

쓰이지 않은 키를 먼저 비활성화하고, 문제가 없으면 삭제한다. 비활성화는 되돌릴 수 있어서, 무엇이 멈추는지 확인하는 안전한 방법이다. 그리고 조직 정책으로 새 키 생성을 금지해 다시 늘어나지 않게 한다. 금지하지 않으면 정리한 만큼 다시 생긴다. 예외가 꼭 필요한 프로젝트는 별도 폴더로 옮겨 그곳에만 완화 정책을 적용하고, 그 폴더 목록 자체를 위험 목록으로 관리한다.

## 실제로 이렇게 터진다

서비스 계정 키 파일을 컨테이너 이미지에 넣은 사례가 있다. 이미지가 공개 저장소에 올라갔고, 키는 만료되지 않는 것이었다.

또 하나는 워크로드 신원을 도입했지만 서비스 계정 권한을 그대로 둔 경우다. 키는 없앴지만 권한은 여전히 넓었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 키 파일이 편하다 | 유출되면 만료가 없다 |
| 키를 잘 관리하면 된다 | 관리 실패가 반복된다 |
| 전환하면 안전해진다 | 권한 정리가 함께 필요하다 |
| 설정이 복잡하다 | 몇 단계면 된다 |
| 온프레미스에서는 못 쓴다 | 연합 방식이 있다 |

## 무엇이 달라지나

| 항목 | 키 파일 | 워크로드 신원 |
| --- | --- | --- |
| 만료 | 없음 | 짧은 수명 |
| 유출 시 | 계속 유효 | 곧 무효 |
| 배포 | 파일 전달 필요 | 불필요 |
| 회수 | 키 삭제 | 바인딩 해제 |
| 감사 | 키 단위 | 워크로드 단위 |

## 전환 절차

1. 클러스터에 워크로드 신원을 활성화한다
2. 서비스 계정과 쿠버네티스 계정을 연결한다
3. 워크로드에 계정을 지정한다
4. 동작을 확인한다
5. 기존 키를 비활성화한다
6. 사용이 없음을 확인하고 삭제한다

5번과 6번을 분리한다. 비활성화 후 며칠간 오류가 없어야 삭제한다.

## 남은 키 찾기

\`\`\`bash
# 사용자 관리 키가 있는 서비스 계정 — 전환 대상
for sa in $(gcloud iam service-accounts list --format='value(email)'); do
  n=$(gcloud iam service-accounts keys list --iam-account="$sa" \
        --managed-by=user --format='value(name)' | wc -l)
  [ "$n" -gt 0 ] && echo "$sa 키 $n개"
done
\`\`\`

## 권한도 함께 정리

키를 없애는 것과 권한을 줄이는 것은 다른 작업이다. 전환 시점이 권한을 다시 보기 좋은 때다.

| 확인 | 방법 |
| --- | --- |
| 실제 사용 권한 | 최근 90일 사용 기록 |
| 부여된 권한 | 역할 바인딩 |
| 차이 | 사용하지 않는 권한 회수 |

권한 추천 기능이 사용 기록을 근거로 축소안을 제시한다. 그대로 적용하기보다 검토 후 반영한다.

## 참고

- Google Cloud — Workload Identity Federation, GKE Workload Identity
- Google Cloud — 서비스 계정 키 관리 권장 사항
- NIST SP 800-53 IA-5 Authenticator Management`,
    diagram: {
      type: 'flow',
      caption: '키 없는 인증',
      steps: [
        { label: '실행 환경 신원', note: '파드·VM·CI' },
        { label: '증명 제시', note: 'OIDC 토큰' },
        { label: '조건 검증', note: '저장소·브랜치' },
        { label: '짧은 토큰 발급', note: '파일 없음' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '자격 증명 형태',
      x: ['수명 제한', '무기한'],
      y: ['환경에 묶임', '어디서나 사용'],
      cells: ['권장', '위치 제한만', '단기 노출', '키 파일'],
    },
  },
  {
    slug: 'workload-identity-federation',
    title: '클라우드 간 신원 연동 설계와 조건',
    body: `한 클라우드의 워크로드가 다른 클라우드 자원에 접근해야 하는 상황이 늘고 있다. 이때 상대 클라우드의 장기 키를 발급받아 쓰는 것이 가장 쉬운 길이지만, 그 키가 곧 관리 부담과 유출 위험이 된다. 신원 연동을 쓰면 각 환경의 신원을 서로 인정하게 만들어 키 없이 접근할 수 있다.

## 연동의 기본 구조는 무엇인가?

신뢰 관계를 만들고, 조건을 붙이고, 짧은 자격 증명을 받는다. 세 단계 모두 필요하다.

| 단계 | 하는 일 | 빠뜨리면 |
| --- | --- | --- |
| 발급자 등록 | 상대 신원 제공자를 신뢰 | 연동 자체가 안 됨 |
| 조건 지정 | 어떤 주체만 허용할지 | 제3자가 우리 권한 획득 |
| 역할 매핑 | 어떤 권한을 줄지 | 과다 권한 |
| 수명 제한 | 토큰 유효 시간 | 탈취 시 장기 사용 |

조건 지정이 가장 자주 잘못된다. 발급자만 신뢰하고 주체를 제한하지 않으면, 그 발급자를 쓰는 모든 사람이 우리 권한을 얻는다.

![연동 신뢰 구조](/img/posts/workload-identity-federation.svg)

## 조건을 어디까지 좁히는가

공용 CI 서비스를 발급자로 쓸 때는 조직, 저장소, 브랜치, 환경까지 조건에 넣는다. 조건 하나가 빠지면 경계가 무너진다.

\`\`\`json
{
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": "repo:example/app:environment:production"
    }
  }
}
\`\`\`

sub 값에 와일드카드를 쓰면 범위가 크게 넓어진다. \`repo:example/*\` 는 조직의 모든 저장소를 허용한다는 뜻이고, 포크에서 실행된 워크플로까지 포함될 수 있다.

![조건 범위](/img/posts/workload-identity-federation-2.svg)

## 방향별 구성

| 방향 | 수단 |
| --- | --- |
| AWS → GCP | 워크로드 아이덴티티 제휴 |
| GCP → AWS | OIDC 공급자 + 역할 수임 |
| Azure → AWS | 앱 등록 + OIDC 제휴 |
| CI → 각 클라우드 | 파이프라인 OIDC 토큰 |
| 쿠버네티스 → 클라우드 | 서비스 계정 토큰 제휴 |

## 무엇을 점검하는가

연동 설정은 한 번 만들고 잊기 쉬운데, 조건이 넓게 열려 있으면 조용한 위험으로 남는다.

\`\`\`bash
# AWS — OIDC 신뢰 정책에서 조건이 없는 역할 찾기
aws iam list-roles --query 'Roles[?AssumeRolePolicyDocument.Statement[?Principal.Federated]]' |
  python3 -c 'import sys,json; rs=json.load(sys.stdin)
for r in rs:
  for s in r["AssumeRolePolicyDocument"]["Statement"]:
    if s.get("Principal",{}).get("Federated") and not s.get("Condition"):
      print("조건 없음:", r["RoleName"])'

# GCP — 제휴 공급자의 속성 조건 확인
gcloud iam workload-identity-pools providers list \\
  --workload-identity-pool=ci-pool --location=global \\
  --format='table(name, attributeCondition)'
\`\`\`

조건이 비어 있는 항목은 즉시 조치 대상이다. 그리고 연동으로 발급된 자격 증명의 사용 기록을 감사 로그에서 확인해, 예상 밖 주체가 쓰고 있지 않은지 본다.

## 실제로 이렇게 터진다

파이프라인에서 클라우드 자격 증명을 저장소 비밀로 관리한 사례가 있다. 포크 저장소의 워크플로가 그 비밀에 접근할 수 있는 설정이었고, 외부 기여자가 가져갔다.

또 하나는 연합을 설정하면서 신뢰 조건을 느슨하게 둔 경우다. 저장소 소유자만 확인하고 브랜치를 보지 않아, 아무 브랜치에서나 운영 배포가 가능했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 비밀 저장소에 넣으면 안전하다 | 접근 범위가 넓다 |
| 연합을 쓰면 자동으로 안전하다 | 신뢰 조건이 핵심이다 |
| 조건은 저장소만 보면 된다 | 브랜치·환경까지 봐야 한다 |
| 설정이 어렵다 | 한 번 하면 유지된다 |
| 파이프라인만 해당한다 | 온프레미스 워크로드도 가능하다 |

## 신뢰 조건에 넣을 것

| 항목 | 이유 |
| --- | --- |
| 발급자 | 어느 신원 제공자인가 |
| 저장소 | 우리 저장소인가 |
| 브랜치·태그 | 운영 배포는 특정 브랜치만 |
| 환경 | 승인된 환경인가 |
| 워크플로 파일 | 지정한 워크플로인가 |

저장소만 확인하면 아무 브랜치에서나 운영 자격 증명을 받을 수 있다. 브랜치 조건이 반드시 필요하다.

## 조건 예

\`\`\`json
{
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": "repo:org/app:environment:production"
    }
  }
}
\`\`\`

환경 조건을 쓰면 저장소의 환경 보호 규칙과 연동된다. 승인자를 지정하면 배포에 사람의 승인이 필요해진다.

## 환경별 분리

| 환경 | 조건 | 권한 |
| --- | --- | --- |
| 개발 | 모든 브랜치 | 개발 자원만 |
| 스테이징 | 지정 브랜치 | 스테이징 자원 |
| 운영 | 환경 + 승인 | 운영 자원, 최소 |

## 점검

\`\`\`bash
# 신뢰 정책에 브랜치·환경 조건이 있는지 — 없으면 넓게 열린 상태다
aws iam get-role --role-name gha-deploy \
  --query 'Role.AssumeRolePolicyDocument.Statement[].Condition' --output json
\`\`\`

sub 조건에 와일드카드가 있거나 조건 자체가 없으면 검토 대상이다.

## 남은 장기 자격 증명

연합을 도입한 뒤에도 옛 액세스 키가 저장소 비밀에 남아 있는 경우가 많다. 목록을 만들어 정리한다. 남아 있으면 도입 효과가 절반이다.

## 참고

- AWS 문서 — OIDC 자격 증명 공급자, 신뢰 정책 조건
- Google Cloud — Workload Identity Federation 속성 조건
- GitHub 문서 — OIDC 를 사용한 클라우드 인증`,
    diagram: {
      type: 'flow',
      caption: '연동 접근',
      steps: [
        { label: '워크로드 실행', note: '다른 클라우드' },
        { label: '신원 토큰 획득', note: '플랫폼 발급' },
        { label: '조건 검증', note: '주체·환경' },
        { label: '단기 자격 증명', note: '역할 범위 내' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '조건 설정',
      x: ['주체까지 지정', '발급자만 지정'],
      y: ['환경 조건 있음', '없음'],
      cells: ['안전', '제3자 접근 가능', '범위 넓음', '전면 개방'],
    },
  },
  {
    slug: 'presigned-url',
    title: '사전 서명 URL 발급과 만료 관리',
    body: `버킷을 공개하지 않고 파일을 내려주는 표준적인 방법이 사전 서명 URL 이다. 그런데 이 주소는 그 자체가 접근 권한이다. 만료가 길거나 발급 조건이 느슨하면, 공개 버킷과 실질적으로 같아진다. 채팅에 붙여 넣은 링크가 몇 달 뒤에도 유효한 상황이 흔하다.

## 어떤 실수가 반복되는가?

| 실수 | 결과 |
| --- | --- |
| 만료를 일 단위로 설정 | 링크 공유로 무제한 확산 |
| 인가 없이 발급 | 다른 사용자 파일 주소 획득 |
| 객체 키를 입력으로 받음 | 임의 경로 접근 |
| 쓰기 권한 URL 남발 | 임의 파일 업로드 |
| 발급 기록 없음 | 유출 시 추적 불가 |
| 로그·리퍼러로 노출 | 주소가 외부로 새어 나감 |

객체 키를 클라이언트가 지정하게 만드는 구현이 가장 위험하다. 그 순간 접근 통제가 사라진다.

![주소 자체가 권한이 되는 구조](/img/posts/presigned-url.svg)

## 스토리지 버킷 접근을 어떻게 좁히는가

\`\`\`ts
// 인가를 먼저 판정하고, 경로는 서버가 만든다
const file = await files.get(fileId)
if (!can(actor, 'read', file)) throw new Forbidden()

const url = await s3.getSignedUrl('getObject', {
  Bucket: BUCKET,
  Key: file.storageKey,                  // 클라이언트 입력이 아니다
  Expires: 300,                          // 5분
  ResponseContentDisposition: \`attachment; filename="\${safe(file.name)}"\`,
})
await audit.log('file.presign', { actor: actor.id, fileId, ttl: 300 })
\`\`\`

업로드용 URL 은 조건을 더 붙인다. 크기와 형식을 서명에 포함하면 그 범위를 벗어난 업로드가 거부된다.

\`\`\`ts
const post = await s3.createPresignedPost({
  Bucket: BUCKET,
  Key: \`uploads/\${actor.id}/\${randomUUID()}\`,
  Conditions: [['content-length-range', 1, 10 * 1024 * 1024], ['eq', '$Content-Type', 'image/png']],
  Expires: 120,
})
\`\`\`

![발급 절차](/img/posts/presigned-url-2.svg)

## 만료 시간은 어떻게 정하는가

용도별로 다르다. 사용자가 즉시 쓰는 것은 짧게, 배치가 쓰는 것은 작업 시간에 맞춘다.

| 용도 | 만료 |
| --- | --- |
| 화면에서 즉시 열기 | 1~5분 |
| 내려받기 링크 | 5~15분 |
| 업로드 | 2~10분 |
| 배치 처리 | 작업 예상 시간 + 여유 |
| 외부 공유 | 발급하지 않고 별도 공유 기능으로 |

외부에 오래 공유해야 하는 파일은 사전 서명 URL 이 아니라 별도의 공유 기능으로 다룬다 — 열람 기록과 회수 기능이 필요하기 때문이다. 서명 URL 은 발급된 뒤 서버가 개입할 방법이 없어서, 잘못 발급한 것을 되돌릴 수 없다. 되돌릴 필요가 있는 접근이라면 처음부터 우리 서버를 거치게 하고, 그 자리에서 인가를 판정하는 편이 낫다. 대역폭 부담이 걱정된다면 짧은 만료로 발급하고 필요할 때마다 다시 발급하는 방식이 절충안이다.

## 점검 방법

\`\`\`bash
# 버킷이 공개돼 있지 않은지 (서명 URL 을 쓰는 전제)
aws s3api get-public-access-block --bucket "$BUCKET" 2>&1 | head -5
aws s3api get-bucket-policy --bucket "$BUCKET" 2>/dev/null |
  grep -o '"Principal":[^,]*' | sort -u

# 발급된 URL 이 만료 후 실제로 거부되는지
curl -s -o /dev/null -w '%{http_code}\\n' "$OLD_PRESIGNED_URL"   # 403 이어야 한다
\`\`\`

## 실제로 이렇게 터진다

파일 내려받기용 서명 URL 의 유효 기간을 7일로 둔 사례가 있다. 그 주소가 채팅으로 전달되고 캡처로 남으면서, 일주일 내내 누구나 접근할 수 있었다.

또 하나는 업로드용 서명 URL 에 조건을 걸지 않은 경우다. 파일 크기와 형식을 제한하지 않아 임의 파일이 올라갔다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 주소가 길어서 안전하다 | 전달되면 누구나 쓴다 |
| 유효 기간은 길수록 편하다 | 노출 창이 그만큼 길다 |
| 업로드는 위험이 적다 | 임의 파일이 들어온다 |
| 발급하면 통제가 끝난다 | 취소가 어렵다 |
| 로그가 남는다 | 발급 기록을 따로 남겨야 한다 |

## 유효 기간

| 용도 | 권장 |
| --- | --- |
| 즉시 내려받기 | 1~5분 |
| 사용자 다운로드 링크 | 15분 |
| 업로드 | 15분 |
| 배치 처리 | 작업 시간 + 여유 |
| 이메일 첨부 대체 | 사용하지 않는다 |

메일이나 메신저로 전달될 링크에는 서명 URL 을 쓰지 않는다. 로그인 후 접근하는 페이지를 거치게 한다.

## 업로드 조건

| 조건 | 이유 |
| --- | --- |
| 최대 크기 | 자원 고갈 방지 |
| 콘텐츠 유형 | 예상 형식만 |
| 키 접두사 | 지정 경로에만 |
| 암호화 헤더 | 저장 암호화 강제 |

조건 없이 발급하면 그 버킷이 임의 파일 저장소가 된다. 정책 기반 업로드 방식을 쓰면 조건을 서명에 포함할 수 있다.

## 취소 방법

서명 URL 은 발급 후 개별 취소가 어렵다. 필요한 경우를 대비한 수단을 미리 정한다.

| 방법 | 효과 |
| --- | --- |
| 짧은 유효 기간 | 기본 — 대부분 이것으로 충분 |
| 서명 키 교체 | 전체 무효화 |
| 객체 이동·삭제 | 해당 객체만 |
| 버킷 정책 조건 | 출발지 제한 등 |

## 발급 기록

\`\`\`bash
# 발급 기록을 남기는 서버 측 로그 예 — 누가 무엇에 대해 받았는지
# actor, object_key, expires_at, purpose, ip

# 실제 접근은 접근 로그에서 확인
aws s3api get-bucket-logging --bucket "$B" --query 'LoggingEnabled'
\`\`\`

발급 기록과 접근 기록을 대조하면, 발급받은 사람과 실제 사용한 사람이 다른 경우를 발견할 수 있다.

## 대안

민감한 파일은 서명 URL 대신 애플리케이션이 중계하는 방식이 안전하다. 요청마다 권한을 확인할 수 있고, 접근 기록도 정확하다. 대용량 파일이 아니라면 이쪽이 낫다.

## 참고

- AWS 문서 — 사전 서명 URL 사용, 게시 정책 조건
- OWASP — Access Control Cheat Sheet
- NIST SP 800-53 AC-3 Access Enforcement`,
    diagram: {
      type: 'flow',
      caption: '발급과 사용',
      steps: [
        { label: '인가 판정', note: '서버에서' },
        { label: '경로 결정', note: '서버가 생성' },
        { label: '짧은 만료로 서명', note: '분 단위' },
        { label: '발급 기록', note: '추적 가능' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '설정에 따른 위험',
      x: ['짧은 만료', '긴 만료'],
      y: ['서버가 경로 결정', '클라이언트 지정'],
      cells: ['안전', '링크 확산', '임의 접근', '공개 버킷과 같음'],
    },
  },
  {
    slug: 'cost-anomaly-detection',
    title: '클라우드 비용 급증으로 침해 알아채기',
    body: `침해가 가장 먼저 드러나는 곳이 청구서인 경우가 많다. 탈취한 자격 증명으로 암호화폐 채굴 인스턴스를 띄우거나, 대량 데이터를 외부로 전송하거나, 스팸 발송에 서비스를 쓰면 비용이 먼저 튄다. 비용 감시는 재무 업무로 분류되지만 실질적으로는 탐지 수단이다.

## 어떤 비용 변화가 침해 신호인가?

| 변화 | 의심 행위 |
| --- | --- |
| 특정 리전의 컴퓨트 급증 | 쓰지 않는 리전에 채굴 인스턴스 |
| 데이터 송신 비용 급증 | 대량 반출 |
| 함수 실행 횟수 급증 | 자동화된 남용 |
| 메일·문자 발송 급증 | 스팸 발송 |
| 스토리지 요청 급증 | 전체 목록 열거·다운로드 |
| GPU 인스턴스 신규 | 채굴·모델 학습 |

쓰지 않는 리전에서 자원이 생기는 것이 가장 명확한 신호다. 공격자는 감시가 약한 리전을 고른다.

![비용으로 드러나는 침해](/img/posts/cost-anomaly-detection.svg)

## 어떻게 감지 체계를 만드는가

절대 금액이 아니라 변화율로 본다. 그리고 계정·리전·서비스 단위로 나눠 봐야 작은 침해도 잡힌다. 전체 합계만 보면 큰 서비스의 정상 변동에 묻힌다.

\`\`\`
분해 단위   계정 × 리전 × 서비스 × 사용 유형
기준선      최근 14일의 같은 요일·시간대
경보        기준선의 3배 초과 또는 미사용 리전에서 과금 발생
확인        해당 자원의 생성 주체와 시각을 감사 로그에서 조회
차단        미사용 리전을 조직 정책으로 아예 금지
\`\`\`

미사용 리전 금지가 감시보다 효과적이다. 쓸 수 없으면 감시할 필요도 없다.

![감지와 차단](/img/posts/cost-anomaly-detection-2.svg)

## 확인 명령

\`\`\`bash
# 리전별·서비스별 비용 — 예상 밖 리전이 있는지
aws ce get-cost-and-usage --time-period Start=2026-08-25,End=2026-09-08 \\
  --granularity DAILY --metrics UnblendedCost \\
  --group-by Type=DIMENSION,Key=REGION Type=DIMENSION,Key=SERVICE \\
  --query 'ResultsByTime[-1].Groups[?Metrics.UnblendedCost.Amount>\`1\`].[Keys,Metrics.UnblendedCost.Amount]' \\
  --output text | sort -k3 -rn | head -20

# 최근 생성된 인스턴스와 생성 주체 — 비용 신호를 감사 로그로 확인
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=RunInstances \\
  --start-time 2026-09-01 \\
  --query 'Events[].{시각:EventTime, 주체:Username, 리전:AwsRegion}' --output table | head -20
\`\`\`

## 비용 상한도 함께 둔다

감시는 사후이고, 상한은 사전이다. 개발 계정에는 예산 상한과 자동 정지를 걸어 두면 사고 규모가 제한된다. 운영 계정에 자동 정지를 거는 것은 위험하므로, 운영에는 경보만 두고 대응 절차를 준비한다.

| 환경 | 조치 |
| --- | --- |
| 샌드박스 | 예산 초과 시 자원 정지 |
| 개발 | 경보 + 승인 없는 고비용 자원 차단 |
| 운영 | 경보 + 즉시 확인 절차 |

## 실제로 이렇게 터진다

탈취된 자격 증명으로 채굴 인스턴스가 대량 생성된 사례가 있다. 청구서를 월말에 확인하는 구조였고, 3주간 발견되지 않았다.

또 하나는 예산 알림을 걸었지만 수신자가 퇴사자였던 경우다. 알림은 갔고 아무도 받지 못했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 비용은 재무 문제다 | 침해의 가장 빠른 신호다 |
| 월별 확인이면 된다 | 며칠이면 큰 금액이 된다 |
| 예산 알림이면 충분하다 | 급증 탐지가 더 빠르다 |
| 알림을 걸면 끝이다 | 수신자와 절차가 필요하다 |
| 작은 계정은 위험이 적다 | 한도까지 쓸 수 있다 |

## 비용이 침해 신호인 이유

| 침해 유형 | 비용 신호 |
| --- | --- |
| 암호화폐 채굴 | 컴퓨트 급증 |
| 데이터 유출 | 외부 전송량 급증 |
| 스팸 발송 | 메일·SMS 급증 |
| 봇넷 | 네트워크 급증 |
| 저장소 남용 | 스토리지 급증 |

기술적 탐지보다 비용 지표가 먼저 움직이는 경우가 많다. 특히 채굴은 비용이 가장 빠른 신호다.

## 감시 설정

| 항목 | 설정 |
| --- | --- |
| 예산 알림 | 월 예산의 50·80·100% |
| 급증 탐지 | 일일 평균 대비 배수 |
| 서비스별 | 평소 안 쓰는 서비스 사용 |
| 리전별 | 사용하지 않는 리전 |
| 수신자 | 그룹 주소, 개인 아님 |

리전별 감시가 특히 유용하다. 쓰지 않는 리전에서 비용이 발생하면 거의 확실히 문제다.

## 대응 절차

1. 알림 수신
2. 어떤 서비스·리전인지 확인
3. 정상 배포인지 담당팀에 확인
4. 아니면 관련 자원 조회
5. 생성한 주체 확인
6. 자격 증명 무효화 및 자원 정리

3번을 건너뛰고 자원을 지우면 정상 작업을 망칠 수 있다. 확인 절차를 절차서에 넣는다.

\`\`\`bash
# 어제 대비 급증한 서비스
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -v-7d +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity DAILY --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[-1].Groups[].[Keys[0],Metrics.UnblendedCost.Amount]' \
  --output text | awk '$2 > 10'
\`\`\`

## 한도 설정

비용 급증을 막는 가장 확실한 방법은 자원 생성 한도다. 인스턴스 유형 제한, 리전 제한, 서비스 제한을 조직 정책으로 걸어 두면 급증 자체가 일어나지 않는다.

## 참고

- AWS 문서 — Cost Anomaly Detection, Budgets 작업
- Google Cloud — 예산 알림과 자동 대응
- NIST SP 800-53 SI-4 System Monitoring`,
    diagram: {
      type: 'bars',
      caption: '침해 시 먼저 튀는 항목(경향)',
      unit: '상대값',
      items: [
        { label: '컴퓨트·GPU', value: 40, note: '채굴' },
        { label: '데이터 송신', value: 25, note: '반출' },
        { label: '함수 실행', value: 15 },
        { label: '발송 서비스', value: 12, note: '스팸' },
        { label: '스토리지 요청', value: 8 },
      ],
    },
    diagram2: {
      type: 'flow',
      caption: '대응 순서',
      steps: [
        { label: '비용 경보', note: '단위별 변화율' },
        { label: '자원 확인', note: '무엇이 생겼나' },
        { label: '주체 추적', note: '감사 로그' },
        { label: '자격 증명 무효화', note: '자원 정리' },
      ],
    },
  },
  {
    slug: 'cloud-tagging-policy',
    title: '클라우드 태그 정책과 자산 목록 유지',
    body: `클라우드 자산은 누구나 만들 수 있고 아무도 지우지 않는다. 몇 달 뒤에는 이 자원이 무엇을 위한 것이고 누가 책임자인지 아무도 모르는 상태가 된다. 태그는 그 정보를 자원 자체에 붙여 두는 수단이고, 보안 관점에서는 자산 목록의 기반이다.

## 어떤 태그가 실제로 쓸모 있는가?

| 태그 | 쓰임 |
| --- | --- |
| 소유자 | 문의·조치 대상 확인 |
| 서비스 | 침해 시 영향 범위 판단 |
| 환경 | 운영·개발 구분, 정책 적용 |
| 데이터 등급 | 통제 수준 결정 |
| 만료일 | 임시 자원 정리 |
| 비용 센터 | 청구 분배 |

데이터 등급 태그가 보안에는 가장 중요하다. 어느 자원에 민감 데이터가 있는지 알아야 통제와 조사의 우선순위를 정할 수 있다.

![태그가 없을 때 생기는 공백](/img/posts/cloud-tagging-policy.svg)

## 강제하지 않으면 채워지지 않는다

안내만으로는 절반도 붙지 않는다. 생성 시점에 필수 태그가 없으면 만들 수 없게 하는 것이 유일하게 작동하는 방법이다.

\`\`\`
정책        필수 태그 누락 시 생성 거부 (조직 정책·SCP)
자동 보정   상속 가능한 태그는 상위에서 자동 부여
점검        태그 없는 자원 목록을 주간 보고
정리        만료일이 지난 자원은 알림 후 정지 → 삭제
\`\`\`

\`\`\`json
{
  "Effect": "Deny",
  "Action": ["ec2:RunInstances", "rds:CreateDBInstance", "s3:CreateBucket"],
  "Resource": "*",
  "Condition": { "Null": { "aws:RequestTag/Owner": "true" } }
}
\`\`\`

![강제와 보정](/img/posts/cloud-tagging-policy-2.svg)

## 태그 없는 자산을 어떻게 찾는가

\`\`\`bash
# 필수 태그가 빠진 자원 — 자원 그룹 태깅 API 로 한 번에
aws resourcegroupstaggingapi get-resources --resources-per-page 100 \\
  --query 'ResourceTagMappingList[?!(Tags[?Key==\`Owner\`])].ResourceARN' --output text |
  tr '\\t' '\\n' | head -30

# 만료일이 지난 자원
aws resourcegroupstaggingapi get-resources \\
  --tag-filters Key=ExpiresOn --query 'ResourceTagMappingList[].[ResourceARN,Tags[?Key==\`ExpiresOn\`].Value|[0]]' \\
  --output text | awk -v today="$(date +%F)" '$2 < today {print}'

# GCP — 라벨 없는 인스턴스
gcloud compute instances list --format='value(name,zone,labels)' | awk '$3==""'
\`\`\`

## 태그를 신뢰할 수 있게 유지하는 법

태그는 틀릴 수 있다. 퇴사한 사람이 소유자로 남아 있거나, 환경 태그가 실제와 다른 경우가 흔하다. 그래서 태그 값을 인사 정보와 서비스 목록에 대조하는 점검을 정기적으로 돌린다. 소유자가 재직자 명부에 없으면 그 자원은 주인 없는 자산으로 분류해 별도로 다룬다.

## 실제로 이렇게 터진다

자원에 태그가 없어 소유자를 알 수 없던 사례가 있다. 보안 점검에서 문제가 발견됐지만 누구에게 연락할지 몰라 몇 주가 지났다.

또 하나는 태그 이름이 제각각이던 경우다. 같은 뜻인데 표기가 달라 집계가 되지 않았다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 태그는 비용 관리용이다 | 보안 대응에 필수다 |
| 나중에 붙이면 된다 | 붙이지 못한다 |
| 자유롭게 쓰면 된다 | 표기가 갈라지면 무용지물 |
| 태그가 많을수록 좋다 | 유지되지 않는다 |
| 강제는 불편하다 | 없으면 아무도 안 붙인다 |

## 필수 태그

| 태그 | 용도 |
| --- | --- |
| 소유자 | 연락할 대상 |
| 환경 | 운영·개발 구분 |
| 서비스 | 어느 서비스의 자원인가 |
| 데이터 등급 | 민감도 |
| 비용 센터 | 청구 귀속 |

다섯 개를 넘기지 않는다. 많으면 유지되지 않는다. 소유자와 환경 둘만이라도 강제하면 보안 대응이 크게 빨라진다.

## 표기 규칙

| 항목 | 규칙 |
| --- | --- |
| 키 이름 | 소문자, 하이픈 |
| 값 | 허용 목록 |
| 소유자 | 개인이 아닌 팀 주소 |
| 환경 | prod / stg / dev 만 |

값을 자유 입력으로 두면 표기가 갈라진다. 정책으로 허용 값을 제한한다.

## 강제 방법

| 수단 | 효과 |
| --- | --- |
| 조직 정책 | 태그 없으면 생성 불가 |
| 인프라 코드 검사 | 배포 전 차단 |
| 정기 점검 | 누락 자원 목록 |
| 자동 태그 | 생성자 정보 자동 기입 |

생성 시점에 막는 것이 가장 효과적이다. 사후 점검은 이미 만들어진 자원을 정리하는 데 시간이 든다.

## 누락 자원 찾기

\`\`\`bash
# 소유자 태그가 없는 자원
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Owner --query 'ResourceTagMappingList[].ResourceARN' --output text \
  | tr '\t' '\n' | sort > /tmp/tagged.txt   # 태그가 있는 자원 목록과 전체를 비교한다
\`\`\`

## 보안 대응에서의 역할

| 상황 | 태그가 하는 일 |
| --- | --- |
| 취약점 발견 | 담당자에게 즉시 연락 |
| 침해 조사 | 영향 범위 산정 |
| 긴급 차단 | 운영 자원 구분 |
| 데이터 유출 | 민감도 판단 |
| 정리 작업 | 미사용 자원 식별 |

태그가 없으면 이 모든 판단에 시간이 든다. 사고 대응 속도가 태그 정합성에 달려 있다.

## 참고

- AWS 문서 — 태그 지정 모범 사례, 서비스 제어 정책 조건
- Google Cloud — 라벨과 태그, 조직 정책
- NIST SP 800-53 CM-8 System Component Inventory`,
    diagram: {
      type: 'matrix',
      caption: '태그 관리 상태',
      x: ['생성 시 강제', '안내만'],
      y: ['정기 점검', '점검 없음'],
      cells: ['목록 유지', '점차 이탈', '누락 축적', '주인 없는 자산'],
    },
    diagram2: {
      type: 'layers',
      caption: '태그의 쓰임',
      layers: [
        { label: '데이터 등급', note: '통제 수준 결정' },
        { label: '소유자·서비스', note: '조치 대상' },
        { label: '환경', note: '정책 적용 단위' },
        { label: '만료일', note: '자동 정리' },
      ],
    },
  },
  {
    slug: 'region-restriction',
    title: '리전 제한과 데이터 위치 통제 설계',
    body: `데이터가 어느 나라에 저장되는지는 규정 문제이면서 보안 문제다. 개인정보 국외 이전은 별도 근거가 필요하고, 계약에 데이터 위치가 명시된 경우도 많다. 그런데 클라우드에서는 리전을 바꾸는 것이 드롭다운 한 번이라, 의도 없이 규정을 위반하기 쉽다.

## 어디에서 위치가 어긋나는가?

| 지점 | 흔한 문제 |
| --- | --- |
| 자원 생성 | 기본 리전이 해외로 설정됨 |
| 백업·복제 | 다른 리전으로 자동 복제 |
| 로그 수집 | 로그 저장소가 해외 |
| 오류 추적 도구 | 외부 서비스가 해외 보관 |
| CDN 캐시 | 엣지에 응답 사본 |
| 관리형 서비스 | 일부 기능이 특정 리전에서만 처리 |

백업 복제와 로그 저장소가 특히 자주 어긋난다. 본 데이터는 국내에 두고 사본은 해외에 두는 구성이 무의식적으로 만들어진다.

![데이터가 국외로 나가는 경로](/img/posts/region-restriction.svg)

## 조직 정책으로 리전을 못 박는다

권한이 있어도 허용된 리전 밖에는 만들 수 없게 한다. 이것이 개별 검토보다 확실하다.

\`\`\`json
{
  "Effect": "Deny",
  "NotAction": ["iam:*", "organizations:*", "cloudfront:*", "route53:*", "support:*"],
  "Resource": "*",
  "Condition": { "StringNotEquals": { "aws:RequestedRegion": ["ap-northeast-2"] } }
}
\`\`\`

전역 서비스는 특정 리전에서만 호출되므로 예외로 둬야 한다. 이 예외를 빼면 계정 관리 자체가 막힌다.

\`\`\`bash
# GCP — 자원 위치 제한
gcloud resource-manager org-policies set-policy - --organization "$ORG_ID" <<'EOF'
constraint: constraints/gcp.resourceLocations
listPolicy:
  allowedValues: ['in:asia-northeast3-locations']
EOF
\`\`\`

![허용 목록과 예외](/img/posts/region-restriction-2.svg)

## 이미 나가 있는 것을 찾는다

정책을 걸기 전에 현재 상태를 확인해야 한다. 정책만 걸면 기존 자원은 남고 새 작업만 막힌다.

\`\`\`bash
# 리전별 자원 유무 — 예상 밖 리전을 찾는다
for r in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  n=$(aws ec2 describe-instances --region "$r" \\
      --query 'length(Reservations[].Instances[])' --output text 2>/dev/null)
  b=$(aws rds describe-db-instances --region "$r" \\
      --query 'length(DBInstances)' --output text 2>/dev/null)
  [ "$n" != "0" ] || [ "$b" != "0" ] && echo "$r 인스턴스 $n 데이터베이스 $b"
done

# 버킷의 리전과 복제 설정
for b in $(aws s3api list-buckets --query 'Buckets[].Name' --output text); do
  loc=$(aws s3api get-bucket-location --bucket "$b" --query LocationConstraint --output text)
  rep=$(aws s3api get-bucket-replication --bucket "$b" 2>/dev/null | grep -o '"Bucket":[^,]*' | head -1)
  echo "$b $loc $rep"
done
\`\`\`

## 규정 쪽에서 함께 준비할 것

기술 통제만으로는 부족하다. 국외 이전이 필요한 서비스가 있다면 근거와 고지, 계약을 갖춰야 한다. 그리고 어떤 데이터가 어느 나라에 있는지 정리한 표를 유지한다 — 심사와 계약 검토에서 반복적으로 요구되는 자료다.

## 실제로 이렇게 터진다

쓰지 않는 리전에 자원이 만들어진 사례가 있다. 탐지 서비스는 주 리전에만 켜져 있었고, 그 리전에서 몇 달간 채굴이 돌았다.

또 하나는 리전을 제한하면서 전역 서비스를 함께 막은 경우다. 인증과 결제 관련 기능이 동작하지 않았다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 안 쓰는 리전은 문제없다 | 감시도 없다 |
| 제한하면 불편하다 | 필요한 리전만 열면 된다 |
| 전 리전에 탐지를 켜면 된다 | 비용이 든다 |
| 리전 제한이 간단하다 | 전역 서비스 예외가 필요하다 |
| 규정과 무관하다 | 데이터 위치 요건이 있다 |

## 왜 제한하나

| 이유 | 효과 |
| --- | --- |
| 탐지 사각지대 제거 | 감시 없는 곳이 없어진다 |
| 비용 통제 | 예상 밖 사용 차단 |
| 데이터 주권 | 규정 요건 충족 |
| 운영 단순화 | 관리 대상 축소 |

## 전역 서비스 예외

리전 제한 정책을 걸 때 전역 서비스를 예외로 두지 않으면 기능이 멈춘다.

| 유형 | 처리 |
| --- | --- |
| 신원·권한 관리 | 예외 |
| 청구·계정 관리 | 예외 |
| 콘텐츠 전송 | 예외 |
| 도메인 이름 서비스 | 예외 |
| 인증서 (일부 용도) | 특정 리전 필요 |

전역 서비스는 특정 리전에서 호출되도록 되어 있는 경우가 있다. 그 리전을 함께 허용한다.

## 적용 절차

1. 현재 자원이 있는 리전을 전부 조사한다
2. 필요한 리전을 정한다
3. 불필요한 리전의 자원을 정리한다
4. 정책을 감사 모드로 적용해 위반을 확인한다
5. 강제 모드로 전환한다
6. 남은 리전에 탐지 서비스를 켠다

1번에서 예상 밖의 리전에 자원이 있는 경우가 많다. 시험 삼아 만들고 잊은 것들이다.

\`\`\`bash
# 전 리전의 실행 중 인스턴스 — 예상 밖 리전을 찾는다
for r in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  n=$(aws ec2 describe-instances --region "$r" \
        --filters Name=instance-state-name,Values=running \
        --query 'length(Reservations[].Instances[])' --output text 2>/dev/null)
  [ "$n" != "0" ] && [ -n "$n" ] && echo "$r: $n"
done
\`\`\`

## 한국 환경에서

개인정보 국외 이전 요건이 있으므로 리전 제한이 규정 대응과도 맞물린다. 어떤 데이터가 어느 리전에 있는지 문서로 정리하고, 정책으로 그것을 강제한다.

## 참고

- 개인정보보호법, 개인정보의 국외 이전 요건과 고지
- AWS 문서 — aws:RequestedRegion 조건 키
- Google Cloud — Resource Location Restriction 제약`,
    diagram: {
      type: 'flow',
      caption: '위치 통제 순서',
      steps: [
        { label: '현재 위치 조사', note: '전 리전 확인' },
        { label: '허용 리전 정의', note: '전역 서비스 예외' },
        { label: '정책 강제', note: '새 자원 차단' },
        { label: '기존 자원 이전', note: '복제·로그 포함' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '통제 상태',
      x: ['정책 강제', '검토만'],
      y: ['기존 자원 정리', '미정리'],
      cells: ['준수', '이탈 발생', '잔존 위험', '통제 없음'],
    },
  },
  {
    slug: 'cloud-exit-plan',
    title: '클라우드 종료 계획과 데이터 회수',
    body: `서비스를 접거나 공급자를 바꿀 때 데이터를 어떻게 가져오고 남은 것을 어떻게 지우는지는, 계약을 맺을 때 정해 두는 편이 낫다. 종료 시점에는 협상력이 없고 시간도 없다. 그리고 지웠다는 사실을 확인할 방법을 미리 마련해 두지 않으면, 데이터가 남아 있는지 알 수 없다.

## 무엇을 미리 정해야 하는가?

| 항목 | 정해 둘 내용 |
| --- | --- |
| 반출 형식 | 표준 형식으로 받을 수 있는지 |
| 반출 기간 | 계약 종료 후 며칠까지 접근 가능한지 |
| 반출 비용 | 데이터 송신 비용 부담 주체 |
| 삭제 시점 | 종료 후 며칠 내 파기 |
| 삭제 증명 | 파기 확인서 또는 로그 제공 |
| 백업 사본 | 백업에서의 삭제 시점 |

백업 사본이 자주 빠진다. 본 데이터는 지웠는데 백업에 수개월 남아 있는 경우가 많다.

![종료 시 남는 사본](/img/posts/cloud-exit-plan.svg)

## 종속을 줄이는 설계

종료 계획은 설계 단계의 문제이기도 하다. 특정 공급자의 고유 기능에 깊이 의존하면 옮기는 비용이 급격히 커진다. 어디까지 종속을 허용할지 미리 정한다.

\`\`\`
낮은 종속    컴퓨트·오브젝트 스토리지·관계형 데이터베이스 (표준에 가깝다)
중간 종속    관리형 큐·인증·모니터링 (대체 가능하나 작업 필요)
높은 종속    고유 데이터베이스·서버리스 조합·머신러닝 서비스
판단 기준    핵심 데이터는 낮은 종속 계층에, 부가 기능은 종속 허용
\`\`\`

![종속 수준 판단](/img/posts/cloud-exit-plan-2.svg)

## 반출을 정기적으로 시험한다

계약서에 적혀 있어도 실제로 해 보지 않으면 종료 시점에 문제가 드러난다. 백업 복구 시험과 같은 성격이다.

| 시험 항목 | 확인 내용 |
| --- | --- |
| 전량 반출 소요 시간 | 며칠 걸리는지 |
| 형식 호환성 | 다른 환경에서 읽히는지 |
| 누락 여부 | 건수와 용량 대조 |
| 비용 | 송신 비용 실측 |

\`\`\`bash
# 반출 대상 규모 파악 — 시간과 비용 추정의 근거
aws s3 ls s3://prod-data --recursive --summarize | tail -3
aws rds describe-db-snapshots --query 'DBSnapshots[].[DBSnapshotIdentifier,AllocatedStorage]' --output table

# 삭제 후 확인 — 남아 있는 자원과 스냅샷을 찾는다
aws rds describe-db-snapshots --snapshot-type manual \\
  --query 'DBSnapshots[].[DBSnapshotIdentifier,SnapshotCreateTime]' --output table
aws backup list-recovery-points-by-backup-vault --backup-vault-name Default \\
  --query 'RecoveryPoints[].[RecoveryPointArn,CreationDate]' --output table | head
\`\`\`

## 삭제를 확실하게 만드는 방법

키를 우리가 관리하면 삭제가 훨씬 간단해진다. 데이터를 우리 키로 암호화해 두었다면, 키를 파기하는 것으로 사본 전체가 읽을 수 없게 된다. 공급자의 저장소에 무엇이 남았는지 확인할 수 없는 상황에서도 이 방법은 성립한다.

## 실제로 이렇게 터진다

계약 종료를 앞두고 데이터를 옮기려 했지만 반출 비용이 예상보다 크게 나온 사례가 있다. 수 테라바이트의 전송 요금이 이전 계획에 없었다.

또 하나는 관리형 서비스에 깊이 묶여 있어 대체 구현에 몇 달이 걸린 경우다. 계약 연장 협상에서 협상력이 없었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 옮길 일이 없다 | 규정·비용·인수합병으로 생긴다 |
| 데이터만 옮기면 된다 | 서비스 대체가 더 어렵다 |
| 반출은 무료다 | 전송 요금이 크다 |
| 계획은 나중에 세운다 | 필요할 때는 늦다 |
| 이전 계획은 불신 표현이다 | 협상력과 위험 관리다 |

## 무엇이 묶여 있나

| 요소 | 이전 난이도 |
| --- | --- |
| 가상 머신 | 낮음 |
| 객체 저장소 | 낮음 — 비용은 큼 |
| 관리형 데이터베이스 | 중간 |
| 관리형 큐·스트림 | 중간 |
| 서버리스 함수 | 높음 |
| 고유 서비스 | 매우 높음 |

고유 서비스에 의존할수록 이전이 어렵다. 편의와 종속의 교환이라는 것을 도입 시점에 인식한다.

## 이전 계획에 담을 것

| 항목 | 내용 |
| --- | --- |
| 데이터 목록 | 무엇이 얼마나 |
| 반출 비용 추산 | 전송 요금 |
| 반출 시간 | 대역폭 기준 |
| 대체 방안 | 서비스별 |
| 소요 인력·기간 | 현실적 추산 |
| 최소 실행 가능 시나리오 | 급할 때의 축소판 |

마지막 항목이 실질적이다. 전부 옮기는 계획은 실행되지 않는다. 핵심만 옮기는 최소 계획이 있어야 한다.

## 종속을 낮추는 방법

| 방법 | 효과 |
| --- | --- |
| 표준 인터페이스 사용 | 대체 가능 |
| 추상화 계층 | 구현 교체 용이 |
| 컨테이너 기반 | 실행 환경 이식 |
| 인프라 코드 | 재구축 가능 |
| 데이터 표준 형식 | 반출 용이 |

전부 적용하면 클라우드의 이점을 잃는다. 핵심 자산에만 적용하고 나머지는 종속을 감수하는 판단이 현실적이다.

## 정기 확인

\`\`\`bash
# 저장 용량 — 반출 비용과 시간 추산의 근거
aws s3api list-buckets --query 'Buckets[].Name' --output text | tr '\t' '\n' \
  | while read -r b; do
      aws cloudwatch get-metric-statistics --namespace AWS/S3 \
        --metric-name BucketSizeBytes --dimensions Name=BucketName,Value="$b" \
          Name=StorageType,Value=StandardStorage \
        --start-time "$(date -u -v-2d +%Y-%m-%dT00:00:00Z)" \
        --end-time "$(date -u +%Y-%m-%dT00:00:00Z)" \
        --period 86400 --statistics Average \
        --query "join(' ', ['$b', to_string(Datapoints[0].Average)])" --output text
    done
\`\`\`

연 1회 이전 계획을 갱신한다. 데이터가 늘면 비용과 시간도 늘어난다. 숫자가 최신이어야 판단에 쓸 수 있다.

## 참고

- ISO/IEC 27017, 클라우드 서비스 정보보안 통제
- NIST SP 800-88, 매체 정보 파기 지침
- 개인정보보호법, 위탁 종료 시 개인정보 파기와 반환`,
    diagram: {
      type: 'layers',
      caption: '남을 수 있는 사본',
      layers: [
        { label: '운영 데이터', note: '삭제 요청 대상' },
        { label: '백업·스냅샷', note: '별도 기간 남는다' },
        { label: '로그·감사 기록', note: '보관 의무와 충돌' },
        { label: '공급자 내부 복제', note: '확인 어려움' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '삭제 확실성',
      x: ['우리 키로 암호화', '공급자 키'],
      y: ['삭제 증명 있음', '없음'],
      cells: ['확실', '키 파기로 대체', '증명에 의존', '확인 불가'],
    },
  },
]
