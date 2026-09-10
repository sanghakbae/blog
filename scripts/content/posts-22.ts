import type { SeedPost } from './types'

/** 211~220 — AWS 보안 서비스: 자격 증명·데이터·운영 */
export const posts22: SeedPost[] = [
  {
    slug: 'aws-kms-policy',
    title: 'AWS KMS 키 정책 설계와 비용 구조',
    body: `KMS 에서 실제로 어려운 부분은 암호화가 아니라 키 정책이다. IAM 정책과 키 정책이 함께 걸리는 구조라 "권한을 줬는데 안 된다"와 "안 줬는데 된다"가 모두 생긴다. 여기에 회전과 호출량이 비용으로 이어지므로, 키를 몇 개로 나눌지가 보안과 요금을 동시에 정한다.

## 권한이 어떻게 결정되는가?

키에 대한 접근은 키 정책이 출발점이다. 키 정책이 IAM 에 위임하지 않으면 IAM 에서 아무리 허용해도 접근되지 않는다.

| 조건 | 결과 |
| --- | --- |
| 키 정책에서 계정 IAM 위임 | IAM 정책으로 제어 가능 |
| 키 정책에 주체 직접 명시 | 그 주체는 IAM 없이도 가능 |
| 위임도 명시도 없음 | 아무도 못 쓴다 (관리자 포함) |
| 서비스 제어 정책이 거부 | 위 전부와 무관하게 차단 |

![키 접근이 결정되는 순서](/img/posts/aws-kms-policy.svg)

## 사용 권한과 관리 권한을 나눈다

같은 주체가 키를 쓸 권한과 키 정책을 바꿀 권한을 함께 가지면, 스스로 권한을 넓혀 전부 복호화할 수 있다. 애플리케이션 역할에는 암복호화만, 정책 변경은 별도 관리자에게 둔다.

\`\`\`
애플리케이션 역할   Encrypt, Decrypt, GenerateDataKey
관리자 역할         PutKeyPolicy, ScheduleKeyDeletion, EnableKeyRotation
감사 역할           DescribeKey, GetKeyPolicy (읽기만)
\`\`\`

## 키를 몇 개로 나눌 것인가

하나로 다 쓰면 권한을 좁힐 수 없고, 너무 잘게 나누면 관리와 비용이 는다. 보호 경계가 다른 단위로 나누는 것이 기준이다.

![키 분리 기준](/img/posts/aws-kms-policy-2.svg)

## 비용은 어떻게 붙는가

- **키 저장** — 고객 관리형 키마다 월 단위 요금. 삭제 예약 중에도 과금
- **API 호출** — 암복호화·데이터 키 생성 호출 건수
- **자동 회전** — 회전으로 생긴 키 버전마다 저장 요금이 추가로 붙는다

호출 요금은 봉투 암호화로 크게 줄일 수 있다. 데이터마다 KMS 를 부르지 않고, 데이터 키를 한 번 받아 재사용하는 방식이다. 데이터 키 캐시를 쓰면 호출이 수백 분의 일로 준다.

AWS 관리형 키는 저장 요금이 없지만 정책을 우리가 정할 수 없다. 통제가 필요한 데이터에는 고객 관리형 키를 쓰고, 그 외에는 관리형 키로 두는 구분이 비용과 통제를 함께 잡는다.

## 복호화 호출을 탐지 신호로

키 사용은 CloudTrail 에 남는다. 주체별 복호화 호출량을 기준선으로 두고 급증을 경보로 만들면, 대량 유출 시도가 그 자체로 탐지된다.

## 바로 확인하기

키 목록과 회전 설정을 본다.

\`\`\`bash
aws kms list-keys --query 'Keys[].KeyId' --output text | tr '\\t' '\\n' | while read -r k; do
  meta=$(aws kms describe-key --key-id "$k" \\
    --query 'KeyMetadata.{설명:Description,관리:KeyManager,상태:KeyState}' --output text)
  rot=$(aws kms get-key-rotation-status --key-id "$k" --query 'KeyRotationEnabled' --output text 2>/dev/null)
  printf '%-40s %-30s 회전=%s\\n' "$k" "$meta" "$rot"
done
\`\`\`

키 정책에 과도한 주체가 없는지 확인한다.

\`\`\`bash
aws kms get-key-policy --key-id "$KEY_ID" --policy-name default --output text \\
  | python3 -m json.tool | grep -B2 -A4 '"Principal"'
# "AWS": "*" 가 조건 없이 있으면 계정 밖에서도 접근 가능한 상태다
\`\`\`

## 실제로 이렇게 터진다

키 정책에서 루트를 제외하고 특정 역할만 남긴 사례가 있다. 그 역할이 삭제되자 키를 아무도 관리할 수 없게 됐다. 키 정책은 키 자체에 붙어 있어서, 밖에서 고칠 방법이 없다.

또 하나는 키 정책을 넓게 열어 두고 신원 정책으로만 통제한 경우다. 계정 안의 누구나 키를 쓸 수 있는 상태였다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 신원 정책으로 통제하면 된다 | 키 정책이 먼저 허용해야 한다 |
| 루트를 빼면 더 안전하다 | 복구 불가 상태가 된다 |
| 키를 지우면 즉시 사라진다 | 대기 기간이 있다 |
| 관리형 키로 충분하다 | 정책을 손댈 수 없다 |
| 별칭이 키다 | 별칭은 이름표일 뿐이다 |

## 관리형 키와 고객 관리 키

| 항목 | 관리형 | 고객 관리 |
| --- | --- | --- |
| 정책 수정 | 불가 | 가능 |
| 교체 주기 | 고정 | 설정 가능 |
| 계정 간 공유 | 불가 | 가능 |
| 삭제 | 불가 | 가능 |
| 비용 | 없음 | 키당 월 요금 |

계정 간 공유나 정책 통제가 필요하면 고객 관리 키를 쓴다. 그렇지 않다면 관리형이 관리 부담이 적다.

## 안전한 키 정책의 뼈대

1. 루트에 관리 권한을 남긴다 — 복구 경로
2. 키 관리자와 키 사용자를 분리한다
3. 사용 권한은 조건으로 좁힌다 — 어떤 서비스를 통해서인지
4. 삭제 권한은 별도 주체에만 준다

관리자와 사용자를 분리하면, 사용 권한을 가진 주체가 정책을 고쳐 스스로 권한을 넓히는 경로가 막힌다.

## 점검

\`\`\`bash
# 키 정책에 루트 관리 권한이 남아 있는지 — 없으면 복구 불가 위험
for k in $(aws kms list-keys --query 'Keys[].KeyId' --output text); do
  aws kms get-key-policy --key-id "$k" --policy-name default --output text 2>/dev/null \
    | grep -q ':root' || echo "루트 없음: $k"
done

# 교체가 켜져 있는지
aws kms get-key-rotation-status --key-id "$K" --query 'KeyRotationEnabled'
\`\`\`

## 참고

- AWS KMS 개발자 안내서 — 키 정책과 권한
- AWS KMS 요금 페이지
- NIST SP 800-57, 키 관리 권고`,
    diagram: {
      type: 'layers',
      caption: '키 접근 판정 순서',
      layers: [
        { label: '서비스 제어 정책', note: '계정 상한' },
        { label: '키 정책', note: '출발점 — 위임 여부' },
        { label: 'IAM 정책', note: '위임됐을 때만 의미' },
        { label: '권한 부여', note: '임시 위임' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '키 분리 기준',
      x: ['보호 경계별', '서비스별'],
      y: ['환경 분리', '공용'],
      cells: ['권장', '권한 축소 어려움', '관리 부담 큼', '통제 불가'],
    },
  },
  {
    slug: 'aws-secrets-manager',
    title: 'Secrets Manager 와 파라미터 스토어 선택',
    body: `AWS 에서 비밀값을 둘 곳은 크게 둘이다. Secrets Manager 와 Systems Manager 파라미터 스토어. 기능이 겹쳐 보이지만 회전 자동화와 요금 구조가 달라서, 무엇을 담느냐에 따라 답이 갈린다. 결론부터 말하면 회전이 필요한 자격 증명은 Secrets Manager, 그 외 설정값은 파라미터 스토어다.

## 무엇이 다른가?

| 항목 | Secrets Manager | 파라미터 스토어 |
| --- | --- | --- |
| 자동 회전 | 내장 (RDS 등 연동) | 직접 구현 |
| 요금 | 비밀값당 월 요금 + 호출 | 표준은 무료, 고급은 유료 |
| 크기 제한 | 크다 | 표준은 작다 |
| 교차 계정 공유 | 리소스 정책 지원 | 제한적 |
| 버전 관리 | 단계 라벨 | 버전 이력 |
| 복제 | 다지역 복제 내장 | 직접 구성 |

![무엇을 어디에 둘 것인가](/img/posts/aws-secrets-manager.svg)

## 나누는 기준

\`\`\`
Secrets Manager    데이터베이스 자격 증명, 외부 API 키(회전 필요),
                   교차 계정 공유가 필요한 비밀값
파라미터 스토어      기능 플래그, 엔드포인트 주소, 튜닝 값,
                   회전이 없는 설정값 (SecureString 으로 암호화)
어디에도 두지 않음   워크로드 아이덴티티로 대체 가능한 자격 증명
\`\`\`

마지막 줄이 중요하다. 가장 좋은 비밀값은 존재하지 않는 비밀값이다. 클라우드 자원 접근은 역할로 해결되므로 키를 만들 필요가 없는 경우가 많다.

## 회전을 실제로 켜야 의미가 있다

Secrets Manager 를 쓰면서 회전을 켜지 않으면 파라미터 스토어보다 비싼 저장소일 뿐이다. RDS 같은 관리형 데이터베이스는 회전 함수가 제공되므로 켜기만 하면 된다. 직접 만든 회전 함수는 두 키를 동시에 유효하게 두는 단계가 있어야 무중단으로 돈다.

![회전 단계](/img/posts/aws-secrets-manager-2.svg)

## 비용은 어떻게 붙는가

- **Secrets Manager** — 저장한 비밀값 개수 × 월 요금 + API 호출 1만 건 단위
- **파라미터 스토어 표준** — 저장 무료, 표준 처리량 무료
- **파라미터 스토어 고급** — 파라미터당 월 요금 + 호출 요금
- **고급 처리량** — 호출량이 많으면 별도 옵션

비밀값 개수가 곧 비용이므로, 관련된 값을 하나의 비밀값에 JSON 으로 묶으면 개수를 줄일 수 있다. 다만 권한을 나눠야 하는 값은 묶으면 안 된다. 권한 경계와 비용 사이의 판단이다.

호출 요금은 캐시로 줄인다. 애플리케이션이 시작할 때 한 번 읽고 메모리에 두는 것만으로 호출이 크게 준다. 다만 회전 후 갱신을 받는 경로가 있어야 한다.

## 애플리케이션에서 읽는 방법

환경 변수로 값을 주입하면 프로세스 목록과 로그에 노출될 수 있다. 실행 시점에 SDK 로 직접 읽고 메모리에만 두는 편이 안전하다. 컨테이너에서는 사이드카나 에이전트로 파일에 마운트하는 방식도 쓴다.

## 바로 확인하기

회전이 켜져 있는지부터 본다.

\`\`\`bash
aws secretsmanager list-secrets \\
  --query 'SecretList[].{이름:Name,회전:RotationEnabled,주기:RotationRules.AutomaticallyAfterDays,마지막회전:LastRotatedDate}' \\
  --output table
\`\`\`

오래 쓰이지 않은 비밀값은 정리 대상이다.

\`\`\`bash
aws secretsmanager list-secrets \\
  --query 'SecretList[?LastAccessedDate==null].{이름:Name,생성:CreatedDate}' --output table
# 만들어 놓고 한 번도 읽지 않은 비밀값 — 삭제 후보이자 비용 낭비
\`\`\`

## 실제로 이렇게 터진다

비밀을 옮겨 놓고 코드의 옛 값을 지우지 않은 사례가 있다. 저장소 이력에 그대로 남아 있었고, 실제로 유효한 자격 증명이었다.

자동 교체를 켜 두었지만 애플리케이션이 값을 시작할 때 한 번만 읽는 경우도 있다. 교체가 일어난 새벽에 서비스가 인증 실패로 멈췄다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 옮기면 끝이다 | 옛 값 폐기가 남는다 |
| 교체를 켜면 안전하다 | 앱이 새 값을 읽어야 한다 |
| 매번 조회해도 된다 | 호출 비용과 지연이 붙는다 |
| 파라미터 저장소와 같다 | 교체·계정 간 공유가 다르다 |
| 삭제하면 바로 없어진다 | 복구 대기 기간이 있다 |

## 교체를 켜기 전 확인할 것

| 항목 | 확인 |
| --- | --- |
| 앱이 값을 다시 읽는가 | 캐시 만료 또는 재시도 로직 |
| 이중 자격 증명 방식인가 | 무중단 교체의 전제 |
| 교체 실패 시 알림이 오는가 | 조용히 실패하면 나중에 터진다 |
| 교체 시각이 트래픽 낮은 때인가 | 영향 최소화 |

이중 자격 증명 방식은 두 개의 계정을 번갈아 쓴다. 교체 중에도 하나는 항상 유효하므로 중단이 없다.

## 파라미터 저장소와 어떻게 나누나

| 대상 | 어디에 |
| --- | --- |
| 데이터베이스 자격 증명 | 비밀 관리자 — 교체 필요 |
| 외부 API 키 | 비밀 관리자 |
| 기능 플래그 | 파라미터 저장소 |
| 엔드포인트 주소 | 파라미터 저장소 |
| 인증서 개인키 | 인증서 관리자 |

비밀 관리자는 비밀당 월 요금이 있다. 비밀이 아닌 설정까지 넣으면 비용이 는다.

\`\`\`bash
# 교체가 꺼져 있는 비밀
aws secretsmanager list-secrets \
  --query 'SecretList[?!RotationEnabled].[Name,LastAccessedDate]' --output table

# 오래 안 쓰인 비밀 — 폐기 후보
aws secretsmanager list-secrets \
  --query 'SecretList[].[Name,LastAccessedDate]' --output text | sort -k2 | head -20
\`\`\`

## 참고

- AWS Secrets Manager 사용 설명서 — 회전
- AWS Systems Manager 파라미터 스토어 문서
- AWS Secrets Manager 요금 페이지`,
    diagram: {
      type: 'matrix',
      caption: '저장 위치 선택',
      x: ['회전 필요', '회전 불필요'],
      y: ['비밀값', '설정값'],
      cells: ['Secrets Manager', '파라미터 스토어', '해당 없음', '파라미터 스토어'],
    },
    diagram2: {
      type: 'steps',
      caption: '무중단 회전 단계',
      steps: [
        { label: '새 값 생성', note: '옛 값 유지' },
        { label: '대상에 설정', note: '두 값 모두 유효' },
        { label: '검증', note: '새 값으로 접속 확인' },
        { label: '옛 값 폐기', note: '되돌릴 수 있게 기록' },
      ],
    },
  },
  {
    slug: 'aws-cloudhsm',
    title: 'CloudHSM 이 필요한 경우와 부담',
    body: `KMS 로 충분한데 CloudHSM 을 도입해 운영 부담만 늘리는 경우가 있고, 반대로 규정상 필요한데 KMS 로 버티다 심사에서 지적받는 경우도 있다. 두 서비스는 대체재가 아니라 요구 수준이 다른 선택지다. 판단 기준은 성능이 아니라 "키에 누가 접근할 수 있는가"를 어디까지 증명해야 하느냐다.

## 무엇이 다른가?

| 항목 | KMS | CloudHSM |
| --- | --- | --- |
| 키 통제 | AWS 가 관리하는 서비스 | 우리가 전용 장비를 통제 |
| 서비스 제공자 접근 | 서비스 경계 안 | 우리만 접근 |
| 운영 부담 | 거의 없음 | 클러스터·정족수·백업 직접 |
| 가용성 | 서비스가 보장 | 직접 이중화 |
| 요금 | 키·호출 단위 | 장비 시간 단위 |
| 표준 인터페이스 | AWS API | PKCS#11 등 업계 표준 |

![통제 경계의 차이](/img/posts/aws-cloudhsm.svg)

## 필요한 경우

- 규정이 특정 등급의 하드웨어 모듈을 명시할 때
- 서비스 제공자가 키에 접근할 수 없어야 한다는 요건이 있을 때
- 업계 표준 인터페이스를 요구하는 기존 시스템이 있을 때
- 인증서 발급 기관처럼 키 하나가 전체 신뢰의 근원일 때

그 외에는 KMS 가 실수 여지를 줄이고 운영이 가볍다.

## 운영 부담이 실제 비용이다

CloudHSM 은 클러스터를 직접 구성하고, 관리자 자격 증명을 정족수로 나눠 보관하고, 백업과 복원 절차를 검증해야 한다. 담당자가 바뀌면 인계가 필요하고, 자격 증명을 잃으면 키를 되찾을 수 없다.

![운영에서 준비해야 할 것](/img/posts/aws-cloudhsm-2.svg)

## 비용은 어떻게 붙는가

**HSM 인스턴스 시간당 요금**이 기본이다. 가용성을 위해 최소 두 대 이상을 다른 가용 영역에 두므로 그만큼 곱해진다. 호출량과 무관하게 상시 과금되는 구조라, 사용량이 적어도 고정비가 크다.

KMS 는 키 저장과 호출 단위라 소규모에서 훨씬 저렴하다. 반대로 호출이 극단적으로 많은 워크로드에서는 CloudHSM 의 고정비가 유리해지는 지점이 생긴다. 다만 그 지점은 대개 봉투 암호화와 데이터 키 캐시로 KMS 호출을 줄여 해결된다.

## 중간 선택지

KMS 사용자 지정 키 스토어를 쓰면 KMS 인터페이스를 그대로 쓰면서 키 재료는 CloudHSM 클러스터에 둘 수 있다. 애플리케이션은 KMS 를 부르고, 키는 우리 장비 안에 있는 구성이다. 규정 요건과 운영 편의를 함께 만족해야 할 때 검토할 만하다.

## 바로 확인하기

클러스터 상태와 백업을 확인한다.

\`\`\`bash
aws cloudhsmv2 describe-clusters \\
  --query 'Clusters[].{ID:ClusterId,상태:State,HSM수:length(Hsms),백업정책:BackupPolicy}' \\
  --output table

aws cloudhsmv2 describe-backups \\
  --query 'Backups[].{ID:BackupId,상태:BackupState,생성:CreateTimestamp}' --output table | head
\`\`\`

정족수 절차가 문서로 있는지도 함께 점검한다. 기술 설정보다 이쪽이 자주 빠진다.

\`\`\`
점검 항목
  관리자 자격 증명을 몇 명이 나눠 갖는가
  몇 명이 모여야 키 작업이 가능한가
  담당자 변경 시 인계 절차가 문서로 있는가
  백업에서 복원해 본 적이 있는가
\`\`\`

## 실제로 이렇게 터진다

규정 문구만 보고 도입했다가 운영을 감당하지 못한 사례가 있다. 클러스터 관리, 사용자 관리, 백업, 가용성 확보가 전부 직접 할 일이었고, 담당자가 한 명 퇴사하자 아무도 손대지 못했다.

또 하나는 클러스터를 단일 노드로 운영한 경우다. 노드 장애로 서명 기능이 멈췄다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 키 관리 서비스보다 무조건 안전하다 | 운영 실패 위험이 더 크다 |
| 관리형이라 편하다 | 대부분을 직접 해야 한다 |
| 규정이 항상 요구한다 | 요구 조건을 확인해야 한다 |
| 성능이 더 좋다 | 통신 지연이 추가된다 |
| 비용이 비슷하다 | 시간당 과금이라 훨씬 크다 |

## 언제 실제로 필요한가

| 상황 | 필요성 |
| --- | --- |
| 전용 하드웨어를 규정이 명시 | 필요 |
| 키를 클라우드 사업자도 접근 못 해야 함 | 필요 |
| 특정 암호 알고리즘 요구 | 확인 필요 |
| 일반적인 저장 데이터 암호화 | 불필요 |
| 규정 감사 대비 | 대개 불필요 |

규정을 근거로 도입할 때는 조항의 실제 문구를 확인한다. "안전한 키 관리" 정도의 표현이라면 관리형 키 서비스로 충분한 경우가 많다.

## 도입한다면 반드시

1. 최소 두 개 이상의 가용 영역에 노드를 둔다
2. 백업 정책과 복구 절차를 문서로 만든다
3. 관리자를 두 명 이상 둔다 — 한 명 부재로 멈추면 안 된다
4. 복구 훈련을 정기적으로 한다
5. 비용을 월 단위로 추적한다

\`\`\`bash
# 노드 수와 배치 — 하나면 단일 장애점이다
aws cloudhsmv2 describe-clusters \
  --query 'Clusters[].[ClusterId,State,Hsms[].AvailabilityZone]' --output text
\`\`\`

기술보다 운영 체계가 먼저다. 그것을 갖출 수 없다면 도입하지 않는 편이 안전하다.

## 참고

- AWS CloudHSM 사용 설명서
- AWS CloudHSM 요금 페이지
- FIPS 140-3 보안 요건 등급`,
    diagram: {
      type: 'matrix',
      caption: '요구 수준에 따른 선택',
      x: ['규정 명시 있음', '없음'],
      y: ['운영 역량 있음', '없음'],
      cells: ['CloudHSM', 'KMS 로 충분', '사용자 지정 키 스토어 검토', 'KMS'],
    },
    diagram2: {
      type: 'layers',
      caption: '직접 책임지는 범위',
      layers: [
        { label: '클러스터 구성', note: '다중 가용 영역' },
        { label: '정족수 관리', note: '자격 증명 분산 보관' },
        { label: '백업·복원', note: '검증까지' },
        { label: '인계 절차', note: '담당자 변경 대비' },
      ],
    },
  },
  {
    slug: 'aws-identity-center',
    title: 'IAM Identity Center 로 계정 접근 통합',
    body: `계정마다 IAM 사용자를 만들면 계정 수만큼 자격 증명이 늘고, 퇴사 처리에서 반드시 하나가 남는다. IAM Identity Center 는 사내 통합 인증과 연결해 사람이 계정에 들어가는 경로를 하나로 모은다. 장기 액세스 키를 없애는 가장 현실적인 방법이기도 하다.

## 무엇이 달라지는가?

| 항목 | IAM 사용자 | Identity Center |
| --- | --- | --- |
| 자격 증명 | 계정마다 별도 | 사내 계정 하나 |
| 액세스 키 | 장기 키 | 임시 자격 증명 |
| 퇴사 처리 | 계정마다 회수 | 사내 계정 비활성으로 일괄 |
| 다단계 인증 | 계정마다 설정 | 사내 정책 상속 |
| 권한 관리 | 계정별 IAM | 권한 집합을 계정에 배정 |
| 감사 | 계정별 확인 | 접근 이력 일원화 |

![사람이 계정에 들어가는 경로](/img/posts/aws-identity-center.svg)

## 권한 집합을 어떻게 설계하는가

권한 집합은 "역할 × 대상 계정"으로 배정된다. 역할을 잘게 나누면 배정 조합이 폭증하고, 크게 나누면 최소 권한에서 멀어진다. 직무 단위로 나누고 계정 유형별로 다르게 배정하는 방식이 균형이 맞는다.

\`\`\`
권한 집합 예
  ReadOnly          모든 계정에 배정
  Developer         개발 계정에만
  Operator          운영 계정, 세션 시간 짧게
  SecurityAudit     전 계정, 읽기 전용
  BreakGlass        운영 계정, 승인 후 임시 배정
\`\`\`

## 세션 시간을 짧게

권한이 강한 집합일수록 세션을 짧게 둔다. 작업이 끝나면 자동으로 만료되므로 자격 증명이 오래 살아 있지 않다. 개발용은 길게, 운영용은 한 시간 이내로 두는 구분이 일반적이다.

![권한 집합과 세션 설계](/img/posts/aws-identity-center-2.svg)

## 명령줄 접근도 함께 옮긴다

콘솔만 통합하고 명령줄은 여전히 장기 액세스 키를 쓰면 절반만 한 것이다. Identity Center 는 명령줄 로그인을 지원하므로, 개발자 환경의 액세스 키를 없앨 수 있다. 이 전환이 실제 위험 감소의 대부분을 차지한다.

## 비용은 어떻게 붙는가

**IAM Identity Center 자체는 추가 요금이 없다.** 사내 통합 인증 공급자 쪽 비용만 든다. 즉 장기 액세스 키를 없애는 데 드는 AWS 비용은 0이다.

안 쓸 이유가 거의 없는 서비스이고, 계정이 두세 개만 되어도 도입 효과가 바로 나온다.

## 남아 있는 IAM 사용자를 정리한다

전환 후에도 자동화용 IAM 사용자가 남는다. 그중 상당수는 역할이나 워크로드 아이덴티티로 대체할 수 있다. 남길 것은 소유 팀과 만료일을 기록하고, 액세스 키에 회전 주기를 건다.

## 바로 확인하기

아직 남아 있는 장기 액세스 키를 찾는다.

\`\`\`bash
aws iam list-users --query 'Users[].UserName' --output text | tr '\\t' '\\n' | while read -r u; do
  aws iam list-access-keys --user-name "$u" \\
    --query "AccessKeyMetadata[].[UserName,AccessKeyId,CreateDate,Status]" --output text
done
\`\`\`

Identity Center 배정 현황도 확인한다.

\`\`\`bash
INST=$(aws sso-admin list-instances --query 'Instances[0].InstanceArn' --output text)
aws sso-admin list-permission-sets --instance-arn "$INST" --output text \\
  --query 'PermissionSets' | tr '\\t' '\\n' | while read -r ps; do
  aws sso-admin describe-permission-set --instance-arn "$INST" --permission-set-arn "$ps" \\
    --query 'PermissionSet.{이름:Name,세션시간:SessionDuration}' --output text
done
\`\`\`

## 실제로 이렇게 터진다

권한 세트를 관리자 권한 하나로 만들어 전 팀에 붙인 사례가 있다. 개별 사용자 관리는 없어졌지만 권한은 오히려 넓어졌다. 편의만 얻고 통제는 잃은 셈이다.

세션 기간을 최대로 설정한 경우도 있다. 하루 종일 유효한 자격 증명이 노트북에 남아 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 도입하면 권한이 정리된다 | 권한 설계는 별개다 |
| 사용자 계정을 없앨 수 있다 | 자동화용은 남는다 |
| 세션 기간은 길수록 편하다 | 노출 시간이 그만큼 늘어난다 |
| 권한 세트는 적을수록 좋다 | 너무 적으면 과도해진다 |
| 감사 로그가 통합된다 | 계정별 로그를 봐야 한다 |

## 권한 세트를 어떻게 나누나

| 세트 | 대상 | 세션 |
| --- | --- | --- |
| 읽기 전용 | 전체 | 8시간 |
| 개발 | 개발팀, 개발 계정 | 8시간 |
| 운영 배포 | 배포 담당, 운영 계정 | 4시간 |
| 관리자 | 소수, 승인 후 | 1시간 |
| 침해 대응 | 대응 담당 | 1시간 |

권한이 넓을수록 세션을 짧게 한다. 관리자 세션이 8시간이면 그 자격 증명이 8시간 동안 유효하다.

## 기존 사용자 계정에서 옮기기

1. 사람이 쓰는 계정과 자동화 계정을 구분한다
2. 사람 계정의 실제 사용 권한을 조사한다
3. 그 결과로 권한 세트를 만든다 — 기존 정책을 복사하지 않는다
4. 병행 운영 기간을 둔다
5. 사람 계정의 콘솔 로그인과 액세스 키를 비활성화한다
6. 자동화 계정은 역할 기반으로 따로 정리한다

3번이 핵심이다. 기존 정책을 그대로 옮기면 넓은 권한이 그대로 따라온다.

\`\`\`bash
# 권한 세트별 세션 기간 — 관리자 세트가 길면 조정 대상
aws sso-admin list-permission-sets --instance-arn "$I" --query 'PermissionSets' --output text \
  | tr '\t' '\n' | while read -r ps; do
      aws sso-admin describe-permission-set --instance-arn "$I" --permission-set-arn "$ps" \
        --query 'PermissionSet.[Name,SessionDuration]' --output text
    done
\`\`\`

## 참고

- AWS IAM Identity Center 사용 설명서
- AWS IAM Identity Center 요금 (추가 비용 없음)
- NIST SP 800-53, AC-2 계정 관리`,
    diagram: {
      type: 'flow',
      caption: '통합 인증으로 계정에 들어가는 경로',
      steps: [
        { label: '사내 계정 로그인', note: '다단계 인증 정책 상속' },
        { label: '권한 집합 선택', note: '역할 × 대상 계정' },
        { label: '임시 자격 증명', note: '세션 시간 제한' },
        { label: '작업과 기록', note: '접근 이력 일원화' },
      ],
    },
    diagram2: {
      type: 'bars',
      caption: '권한 집합별 세션 시간',
      unit: '시간',
      items: [
        { label: 'ReadOnly', value: 8 },
        { label: 'Developer', value: 4 },
        { label: 'Operator', value: 1 },
        { label: 'BreakGlass', value: 1, note: '승인 후 임시 배정' },
      ],
    },
  },
  {
    slug: 'aws-session-manager',
    title: 'Session Manager 로 배스천 없애기',
    body: `배스천 호스트를 운영하려면 그 서버 자체를 지켜야 하고, 키를 나눠 주고, 세션 기록을 따로 붙여야 한다. Session Manager 를 쓰면 인바운드 포트를 열지 않고도 인스턴스에 접속할 수 있다. 접속 권한은 IAM 으로, 기록은 CloudTrail 과 로그로 남으므로 배스천에서 하던 일이 대부분 대체된다.

## 무엇이 해결되는가?

| 항목 | 배스천 | Session Manager |
| --- | --- | --- |
| 인바운드 포트 | 22 번 개방 필요 | 열지 않음 |
| 자격 증명 | SSH 키 배포 | IAM 권한 |
| 접속 기록 | 직접 구성 | 기본 제공 |
| 세션 내용 | 직접 기록 | S3·CloudWatch 로 저장 |
| 서버 관리 | 배스천 자체 패치 | 없음 |
| 네트워크 | 공인 주소 또는 VPN | 엔드포인트 경유 가능 |

![인바운드 없이 접속하는 구조](/img/posts/aws-session-manager.svg)

## 전제 조건

\`\`\`
1. 인스턴스에 SSM 에이전트 (최신 AMI 는 기본 포함)
2. 인스턴스 역할에 SSM 관리 권한
3. 인터넷 경로 또는 VPC 엔드포인트 세 개
   (ssm, ssmmessages, ec2messages)
4. 접속자 IAM 권한 — 대상 태그로 제한 가능
\`\`\`

인터넷 없는 사설 서브넷이라면 엔드포인트가 필요하다. 이때 엔드포인트 시간당 비용이 붙는다.

## 세션 기록을 반드시 켠다

기본 설정에서는 세션 내용이 저장되지 않는다. 무엇을 했는지 남기려면 문서 설정에서 로그 대상을 지정해야 한다. 이 설정이 없으면 배스천보다 오히려 추적성이 떨어진다.

![기록 설정 여부](/img/posts/aws-session-manager-2.svg)

## 권한을 태그로 좁힌다

모든 인스턴스에 접속 가능한 권한을 주면 배스천 때와 다를 바 없다. 인스턴스 태그를 조건으로 걸어 담당 서비스에만 접속하도록 좁힌다.

\`\`\`json
{
  "Effect": "Allow",
  "Action": "ssm:StartSession",
  "Resource": "arn:aws:ec2:*:*:instance/*",
  "Condition": { "StringEquals": { "ssm:resourceTag/Team": "payments" } }
}
\`\`\`

## 포트 포워딩으로 데이터베이스까지

Session Manager 는 포트 포워딩을 지원하므로, 데이터베이스 접속도 배스천 없이 할 수 있다. 로컬 포트를 인스턴스를 거쳐 데이터베이스로 연결하는 방식이라, 개발자 노트북에 사설 대역 접근을 열지 않아도 된다.

## 비용은 어떻게 붙는가

**Session Manager 자체는 추가 요금이 없다.** 다만 다음이 붙을 수 있다.

- VPC 엔드포인트 — 사설 서브넷에서 쓸 때 시간당 + 처리량
- 세션 로그 저장 — S3 또는 CloudWatch Logs 비용
- 인스턴스 비용 — 배스천을 없애면 오히려 줄어든다

배스천 인스턴스와 그 관리 비용을 없애는 쪽이 대개 더 크다.

## 바로 확인하기

접속 가능한 인스턴스와 기록 설정을 본다.

\`\`\`bash
aws ssm describe-instance-information \\
  --query 'InstanceInformationList[].{ID:InstanceId,에이전트:AgentVersion,상태:PingStatus}' \\
  --output table

# 세션 기록 설정
aws ssm get-document --name SSM-SessionManagerRunShell --document-format JSON \\
  --query 'Content' --output text | python3 -m json.tool | grep -A6 s3BucketName
\`\`\`

배스천이 아직 남아 있는지도 확인한다.

\`\`\`bash
aws ec2 describe-security-groups \\
  --filters Name=ip-permission.from-port,Values=22 Name=ip-permission.cidr,Values=0.0.0.0/0 \\
  --query 'SecurityGroups[].{그룹:GroupId,이름:GroupName}' --output table
\`\`\`

## 실제로 이렇게 터진다

접속 경로를 이 방식으로 바꿨는데 로깅을 켜지 않은 사례가 있다. 누가 언제 접속했는지는 남았지만 무엇을 했는지는 남지 않았다. 감사에서 지적을 받았다.

또 하나는 SSH 포트를 닫지 않은 경우다. 새 경로를 만들었을 뿐 옛 경로가 그대로 열려 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 도입하면 SSH 를 안 쓴다 | 포트를 닫아야 안 쓰게 된다 |
| 명령 기록이 남는다 | 세션 로깅을 켜야 남는다 |
| 인터넷이 필요하다 | 엔드포인트로 폐쇄망도 된다 |
| 키 관리가 없어진다 | 권한 관리로 옮겨 갈 뿐이다 |
| 파일 전송이 안 된다 | 포워딩으로 가능하다 |

## 무엇이 좋아지나

| 이전 | 이후 |
| --- | --- |
| 22번 포트 개방 | 인바운드 없음 |
| 키 배포·회수 | 권한으로 통제 |
| 접속 이력 서버마다 | 중앙 기록 |
| 명령 기록 없음 | 세션 로그 |
| 접속 경로 제각각 | 하나로 통일 |

## 도입 체크리스트

1. 에이전트가 최신인지 확인한다
2. 인스턴스 역할에 필요한 권한을 붙인다
3. 세션 로깅을 켠다 — 로그 그룹 또는 객체 스토리지
4. 폐쇄망이면 엔드포인트를 만든다
5. 접속을 시험한다
6. 보안 그룹에서 22번 포트를 닫는다
7. 키 페어를 회수한다

6번과 7번을 하지 않으면 도입한 것이 아니라 추가한 것이다.

\`\`\`bash
# 22번 포트가 열려 있는 보안 그룹 — 도입 후에도 남아 있으면 정리 대상
aws ec2 describe-security-groups \
  --filters Name=ip-permission.to-port,Values=22 \
  --query 'SecurityGroups[].[GroupId,GroupName]' --output table

# 세션 로깅 설정
aws ssm get-document --name SSM-SessionManagerRunShell \
  --query 'Content' --output text | grep -i cloudWatchLogGroupName
\`\`\`

## 참고

- AWS Systems Manager Session Manager 사용 설명서
- AWS Systems Manager 요금 페이지
- CIS Controls v8, 6 접근 통제 관리`,
    diagram: {
      type: 'flow',
      caption: '접속 경로',
      steps: [
        { label: 'IAM 권한 확인', note: '태그 조건으로 제한' },
        { label: '엔드포인트 경유', note: '인바운드 포트 없음' },
        { label: '세션 시작', note: '에이전트가 연결' },
        { label: '기록 저장', note: 'S3·CloudWatch' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '기록 설정과 추적성',
      x: ['세션 기록 켬', '끔'],
      y: ['태그로 권한 제한', '전체 접근'],
      cells: ['배스천보다 낫다', '누가 무엇을 했는지 모름', '범위만 좁음', '배스천보다 못하다'],
    },
  },
  {
    slug: 'aws-patch-manager',
    title: 'Patch Manager 운영과 예외 관리',
    body: `패치가 밀리는 이유는 몰라서가 아니라 적용했다가 장애가 날까 봐 미루기 때문이다. Patch Manager 는 패치 기준선과 적용 창을 정해 두고 자동으로 돌린다. 도구를 켜는 것보다 어려운 부분은 기준선을 어떻게 잡고 예외를 어떻게 관리하느냐다.

## 무엇을 정해야 하는가?

| 항목 | 내용 |
| --- | --- |
| 패치 기준선 | 어떤 분류·심각도를 자동 승인할지 |
| 승인 유예 | 배포 후 며칠 뒤 적용할지 |
| 적용 창 | 언제 재부팅까지 허용할지 |
| 대상 그룹 | 태그로 묶은 인스턴스 |
| 예외 목록 | 적용하지 않을 패치 |
| 준수 보고 | 미적용 인스턴스 추적 |

![기준선과 적용 창](/img/posts/aws-patch-manager.svg)

## 유예 기간이 실제 안전장치다

배포 직후 패치는 문제가 있을 수 있다. 승인 유예를 며칠 두면 문제가 알려진 뒤에 적용된다. 다만 긴급 취약점은 유예 없이 즉시 적용하는 별도 기준선을 두어야 한다.

\`\`\`
일반 기준선   중요·보안 패치, 배포 후 7일 유예, 주말 새벽 적용
긴급 기준선   지정 패치만, 유예 없음, 승인 후 즉시
개발 환경     유예 0일 — 문제를 먼저 발견하는 역할
\`\`\`

개발 환경을 먼저 패치해 문제를 걸러내는 순서가 중요하다.

## 재부팅을 어떻게 다룰지 정한다

재부팅 없이 적용되는 패치와 그렇지 않은 것이 있다. 적용 창에서 재부팅을 허용하지 않으면 패치는 설치되지만 적용되지 않은 상태로 남는다. 준수 보고에서는 적용된 것으로 보여 착시가 생긴다.

![적용과 재부팅](/img/posts/aws-patch-manager-2.svg)

## 예외에 기한을 붙인다

특정 패치를 미뤄야 하는 경우가 있다. 예외 목록에 넣되 사유와 재검토 시점을 함께 기록한다. 기한 없는 예외가 쌓이면 준수율은 높은데 실제로는 오래된 취약점이 남아 있는 상태가 된다.

## 비용은 어떻게 붙는가

**Patch Manager 자체는 추가 요금이 없다.** Systems Manager 기본 기능이다. 다만 다음이 관련된다.

- 인스턴스 프로필과 에이전트 — 비용 없음
- 패치 다운로드 트래픽 — 인터넷 경로면 NAT 처리 비용
- 준수 결과를 Config 로 보낼 때 — Config 비용

사설 서브넷에서 NAT 를 거쳐 패치를 받으면 데이터 전송 비용이 붙는다. 지역 저장소나 S3 엔드포인트를 쓰면 줄일 수 있다.

## 바로 확인하기

준수 상태부터 본다.

\`\`\`bash
aws ssm describe-instance-patch-states \\
  --instance-ids $(aws ec2 describe-instances \\
    --query 'Reservations[].Instances[].InstanceId' --output text) \\
  --query 'InstancePatchStates[].{인스턴스:InstanceId,미설치:MissingCount,실패:FailedCount,재부팅:RebootOption,마지막:OperationEndTime}' \\
  --output table
\`\`\`

미설치가 많은 인스턴스의 상세를 본다.

\`\`\`bash
aws ssm describe-instance-patches --instance-id "$ID" \\
  --filters Key=State,Values=Missing \\
  --query 'Patches[].{제목:Title,분류:Classification,심각도:Severity}' --output table | head -20
\`\`\`

## 실제로 이렇게 터진다

패치 정책을 만들었지만 대상 태그가 붙지 않은 인스턴스가 절반이었던 사례가 있다. 보고서에는 준수율 100% 로 나왔다 — 대상에 포함된 것만 세었기 때문이다.

또 하나는 패치 창을 재부팅 없이 설정한 경우다. 커널 패치가 설치됐지만 적용되지 않은 채 몇 달이 지났다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 준수율이 높으면 안전하다 | 대상에서 빠진 것을 봐야 한다 |
| 설치하면 적용된다 | 재부팅이 필요한 것이 있다 |
| 기본 기준선이면 된다 | 승인 지연 기간을 정해야 한다 |
| 전부 자동화하면 된다 | 운영 서버는 단계가 필요하다 |
| 보고서가 현실이다 | 에이전트 없는 서버는 안 보인다 |

## 진짜 지표는 무엇인가

| 지표 | 의미 |
| --- | --- |
| 준수율 | 대상 중 패치된 비율 — 불완전 |
| 관리 대상 비율 | 전체 인스턴스 중 에이전트 있는 비율 |
| 재부팅 대기 수 | 설치했지만 적용 안 된 것 |
| 최장 미패치 기간 | 가장 오래된 위험 |

준수율보다 관리 대상 비율이 먼저다. 보이지 않는 서버는 준수율 계산에 들어가지도 않는다.

## 단계적 배포

| 단계 | 대상 | 지연 |
| --- | --- | --- |
| 1 | 개발 | 즉시 |
| 2 | 시험 | 3일 |
| 3 | 운영 일부 | 7일 |
| 4 | 운영 전체 | 14일 |

긴급 취약점은 이 순서를 압축하되 건너뛰지는 않는다. 개발에서 한 번은 돌려 본다.

\`\`\`bash
# 에이전트가 없는 인스턴스 — 이것이 진짜 사각지대다
comm -23 \
  <(aws ec2 describe-instances --filters Name=instance-state-name,Values=running \
      --query 'Reservations[].Instances[].InstanceId' --output text | tr '\t' '\n' | sort) \
  <(aws ssm describe-instance-information \
      --query 'InstanceInformationList[].InstanceId' --output text | tr '\t' '\n' | sort)

# 재부팅 대기 중인 인스턴스
aws ssm describe-instance-patch-states \
  --instance-ids $(aws ssm describe-instance-information --query 'InstanceInformationList[].InstanceId' --output text) \
  --query 'InstancePatchStates[].[InstanceId,InstalledPendingRebootCount]' --output text | awk '$2>0'
\`\`\`

## 참고

- AWS Systems Manager Patch Manager 사용 설명서
- NIST SP 800-40, 패치 관리 계획
- CIS Controls v8, 7 지속적 취약점 관리`,
    diagram: {
      type: 'steps',
      caption: '패치가 적용되는 흐름',
      steps: [
        { label: '기준선 정의', note: '분류·심각도·유예' },
        { label: '개발 환경 선적용', note: '문제 조기 발견' },
        { label: '적용 창 실행', note: '재부팅 허용 여부' },
        { label: '준수 확인', note: '미적용 추적' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '설치와 적용',
      x: ['재부팅 허용', '미허용'],
      y: ['패치 설치됨', '미설치'],
      cells: ['실제 적용', '설치만 되고 미적용', '해당 없음', '취약 상태'],
    },
  },
  {
    slug: 'aws-backup-vault-lock',
    title: 'Backup Vault Lock 으로 백업 지키기',
    body: `랜섬웨어 대응에서 결정적인 것은 백업의 개수가 아니라 공격자가 지울 수 없는 사본이 하나라도 있느냐다. 운영 권한으로 지워지는 백업은 침해 상황에서 함께 사라진다. Backup Vault Lock 은 보관 기간 안에는 누구도 백업을 지우거나 기간을 줄이지 못하게 만든다. 계정 관리자도 예외가 아니다.

## 무엇을 막는가?

| 위협 | Vault Lock 적용 후 |
| --- | --- |
| 침해자가 백업 삭제 | 불가능 |
| 보관 기간 단축 | 불가능 |
| 라이프사이클 조작 | 불가능 |
| 볼트 자체 삭제 | 백업이 남아 있으면 불가능 |
| 계정 관리자 실수 | 방지됨 |

![지울 수 있는 백업과 없는 백업](/img/posts/aws-backup-vault-lock.svg)

## 두 가지 모드가 있다

- **거버넌스 모드** — 특정 권한을 가진 주체는 해제할 수 있다. 실수 방지용
- **규정 준수 모드** — 유예 기간이 지나면 누구도 해제할 수 없다. 랜섬웨어 대비용

규정 준수 모드는 되돌릴 수 없으므로 유예 기간 동안 설정을 반드시 검증해야 한다. 보관 기간을 잘못 길게 잡으면 그 기간 내내 저장 비용을 내야 한다.

\`\`\`
설정 시 결정할 것
  최소 보관 기간   이보다 짧게 설정할 수 없다
  최대 보관 기간   이보다 길게 설정할 수 없다
  유예 기간        규정 준수 모드에서 되돌릴 수 있는 기간 (최소 3일)
\`\`\`

## 계정을 분리하면 더 강해진다

같은 계정 안에 두면 계정 자체가 장악됐을 때 다른 경로로 문제가 생길 수 있다. 백업 전용 계정에 사본을 복제하고 그 계정의 볼트를 잠그면, 운영 계정 침해와 백업이 분리된다.

![계정 분리와 잠금 조합](/img/posts/aws-backup-vault-lock-2.svg)

## 복구 훈련이 검증이다

잠가 두기만 하고 복원해 본 적이 없으면 복구 가능 여부를 모른다. 분기마다 격리 환경에서 실제로 복원하고 걸린 시간을 기록한다. 그 시간이 우리가 감당할 수 있는 중단 시간이다.

## 비용은 어떻게 붙는가

- **백업 저장** — 보관한 데이터 양. 웜·콜드 저장 계층에 따라 다름
- **복원** — 복원한 데이터 양
- **교차 지역·교차 계정 복사** — 전송량
- **Vault Lock** — 추가 요금 없음

잠금 자체는 무료지만, 보관 기간을 길게 잡으면 저장 비용이 그만큼 늘고 줄일 수 없다는 점이 실질 비용이다. 규정 준수 모드를 켜기 전에 보관 기간과 예상 용량을 계산해 둔다.

## 바로 확인하기

볼트 잠금 상태를 본다.

\`\`\`bash
aws backup list-backup-vaults \\
  --query 'BackupVaultList[].{이름:BackupVaultName,잠금:Locked,최소보관:MinRetentionDays,최대보관:MaxRetentionDays}' \\
  --output table
\`\`\`

실제로 삭제가 막히는지 시험한다. 테스트용 복구 지점으로만 한다.

\`\`\`bash
aws backup delete-recovery-point \\
  --backup-vault-name locked-vault \\
  --recovery-point-arn "$TEST_RP_ARN" 2>&1 | tail -2
# AccessDenied 또는 InvalidRequest 가 나와야 정상이다
\`\`\`

교차 계정 복사가 도는지도 확인한다.

\`\`\`bash
aws backup list-backup-plans --query 'BackupPlansList[].BackupPlanName' --output text
aws backup get-backup-plan --backup-plan-id "$PLAN_ID" \\
  --query 'BackupPlan.Rules[].{규칙:RuleName,복사:CopyActions[].DestinationBackupVaultArn}'
\`\`\`

## 실제로 이렇게 터진다

랜섬웨어 대응을 위해 백업을 늘렸지만, 백업 자체가 같은 계정 같은 권한 아래 있었던 사례가 있다. 침해자가 관리자 권한을 얻자 백업부터 지웠다.

또 하나는 잠금을 준수 모드로 걸었다가 보존 기간 설정을 잘못한 경우다. 되돌릴 수 없어 불필요한 저장 비용을 몇 년간 부담해야 했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 백업이 있으면 복구된다 | 백업이 지워지면 없다 |
| 잠금은 언제든 풀 수 있다 | 준수 모드는 못 푼다 |
| 같은 계정에 둬도 된다 | 함께 침해된다 |
| 복구 시험은 가끔 하면 된다 | 안 해 본 백업은 없는 것과 같다 |
| 거버넌스 모드면 충분하다 | 권한만 있으면 풀린다 |

## 두 모드의 차이

| 항목 | 거버넌스 | 준수 |
| --- | --- | --- |
| 해제 | 특정 권한으로 가능 | 불가 |
| 실수 방지 | 가능 | 가능 |
| 침해자 대응 | 권한 탈취 시 무력 | 유효 |
| 되돌리기 | 가능 | 유예 기간 후 불가 |

랜섬웨어 대비가 목적이라면 준수 모드여야 의미가 있다. 대신 유예 기간 동안 설정을 반드시 재검토한다.

## 구조를 어떻게 잡나

1. 백업 전용 계정을 별도로 둔다
2. 그 계정으로 복사본을 보낸다
3. 금고에 잠금을 건다
4. 운영 계정의 권한으로는 그 금고를 못 건드리게 한다
5. 복구 절차를 문서로 만들고 분기마다 시험한다

5번을 빼면 앞의 넷이 소용없다. 복구 시험에서 발견되는 문제가 대부분이다 — 권한 부족, 절차 부재, 담당자 부재.

\`\`\`bash
# 금고 잠금 상태
aws backup list-backup-vaults \
  --query 'BackupVaultList[].[BackupVaultName,Locked,MinRetentionDays]' --output table

# 최근 복구 시험 기록 — 없다면 그것이 문제다
aws backup list-restore-jobs --by-created-after "$(date -u -v-90d +%Y-%m-%d)" \
  --query 'RestoreJobs[].[CompletionDate,Status]' --output text | head
\`\`\`

## 참고

- AWS Backup 개발자 안내서 — Vault Lock
- AWS Backup 요금 페이지
- NIST SP 800-34, 비상 계획 수립 지침`,
    diagram: {
      type: 'matrix',
      caption: '백업 보호 상태',
      x: ['볼트 잠금', '잠금 없음'],
      y: ['계정 분리', '같은 계정'],
      cells: ['랜섬웨어 대비 완성', '계정 장악 시 위험', '운영 권한으로 삭제 가능', '백업이 없는 것과 같음'],
    },
    diagram2: {
      type: 'steps',
      caption: '잠금 적용 순서',
      steps: [
        { label: '보관 기간 산정', note: '용량과 비용 계산' },
        { label: '거버넌스 모드 시험', note: '설정 검증' },
        { label: '유예 기간 관찰', note: '되돌릴 수 있는 구간' },
        { label: '규정 준수 모드', note: '되돌릴 수 없음' },
      ],
    },
  },
  {
    slug: 'aws-acm',
    title: 'ACM 인증서 자동 갱신과 실패 원인',
    body: `인증서 만료로 인한 장애는 예고까지 되는데도 반복된다. ACM 은 발급과 갱신을 자동으로 해 주므로 이 문제를 대부분 없앤다. 다만 자동 갱신이 조용히 실패하는 조건이 몇 가지 있고, ACM 이 다루지 못하는 인증서도 남는다. 자동화가 닿는 범위와 닿지 않는 범위를 나눠 봐야 한다.

## 무엇이 자동인가?

| 항목 | 자동 여부 |
| --- | --- |
| 공개 인증서 발급 | 자동 (검증 후) |
| 갱신 | 만료 전 자동 시도 |
| AWS 서비스 연결 | ELB·CloudFront·API Gateway 등 |
| 사설 인증서 | 사설 CA 로 발급·갱신 |
| 가져온 인증서 | 갱신 자동화 없음 |
| EC2 에 직접 설치 | 지원 안 됨 |

마지막 두 줄이 사각지대다. 외부에서 발급받아 가져온 인증서와 인스턴스에 직접 설치한 인증서는 여전히 사람이 챙겨야 한다.

![자동화가 닿는 범위](/img/posts/aws-acm.svg)

## 자동 갱신이 실패하는 조건

- DNS 검증 레코드가 지워졌다
- 도메인 소유가 이전됐다
- 인증서가 어떤 서비스에도 연결돼 있지 않다
- 메일 검증 방식을 썼는데 응답하지 않았다
- CAA 레코드가 발급 기관을 막고 있다

첫 번째가 가장 흔하다. DNS 정리를 하다가 검증 레코드를 함께 지우면 다음 갱신에서 실패한다. 그 레코드는 갱신마다 다시 확인되므로 계속 남겨 두어야 한다.

![갱신 실패 원인](/img/posts/aws-acm-2.svg)

## DNS 검증을 쓴다

메일 검증은 사람이 클릭해야 하므로 갱신이 자동화되지 않는다. DNS 검증을 쓰면 레코드가 남아 있는 한 갱신이 자동으로 진행된다. 발급 시점에 방식을 정하므로 처음부터 DNS 검증을 고른다.

## 만료 경보를 별도로 건다

ACM 은 만료 임박을 이벤트로 알려주지만, 그 이벤트를 받는 경로가 없으면 아무도 모른다. EventBridge 로 받아 알림을 보내고, Config 규칙으로 남은 일수를 준수 상태로 관리하면 놓치지 않는다.

## 비용은 어떻게 붙는가

- **공개 인증서** — 발급과 갱신 모두 무료
- **사설 CA** — CA 하나당 월 요금 + 발급한 인증서 수
- **가져온 인증서** — 저장 자체는 무료

사설 CA 는 고정비가 있으므로, 내부 통신용 인증서가 많지 않다면 다른 방식을 검토할 수 있다. 반대로 서비스 간 상호 TLS 를 넓게 쓴다면 CA 하나로 다수 발급이 가능해 단가가 낮아진다.

## 바로 확인하기

만료가 가까운 인증서와 갱신 자격을 함께 본다.

\`\`\`bash
aws acm list-certificates --query 'CertificateSummaryList[].CertificateArn' --output text \\
  | tr '\\t' '\\n' | while read -r arn; do
  aws acm describe-certificate --certificate-arn "$arn" \\
    --query 'Certificate.{도메인:DomainName,만료:NotAfter,갱신자격:RenewalEligibility,상태:Status,사용중:length(InUseBy)}' \\
    --output text
done | sort -k2
\`\`\`

검증 레코드가 아직 있는지 확인한다.

\`\`\`bash
aws acm describe-certificate --certificate-arn "$ARN" \\
  --query 'Certificate.DomainValidationOptions[].{도메인:DomainName,상태:ValidationStatus,레코드:ResourceRecord.Name}' \\
  --output table

# 그 레코드가 실제로 조회되는지
dig +short CNAME "_abc123.example.com"
# 비어 있으면 다음 갱신에서 실패한다
\`\`\`

## 실제로 이렇게 터진다

인증서 만료로 서비스가 멈춘 사례가 있다. 자동 갱신이 켜져 있었지만 도메인 검증 레코드가 지워져 갱신에 실패했다. 실패 알림은 아무도 보지 않는 메일함으로 갔다.

수동으로 가져온 인증서를 쓰면서 만료를 달력에만 적어 둔 경우도 있다. 담당자가 바뀌면서 그 일정이 사라졌다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 자동 갱신이면 안심이다 | 검증 레코드가 유지돼야 한다 |
| 실패하면 알려 준다 | 알림을 설정해야 본다 |
| 어디서든 쓸 수 있다 | 리전과 서비스 제약이 있다 |
| 가져온 인증서도 갱신된다 | 직접 갱신해야 한다 |
| 만료 전에 여유가 많다 | 갱신 시도는 만료 훨씬 전에 시작된다 |

## 검증 방식 선택

| 방식 | 자동 갱신 | 권장 |
| --- | --- | --- |
| DNS 검증 | 가능 | 권장 |
| 이메일 검증 | 매번 수동 | 피한다 |

DNS 검증으로 만들고 검증 레코드를 지우지 않는 것이 원칙이다. 레코드를 정리하다 지우는 사고가 실제로 자주 난다.

## 만료 감시

만료 알림은 두 겹으로 둔다. 서비스 자체 이벤트와 외부에서 실제 인증서를 확인하는 점검.

\`\`\`bash
# 만료 임박·갱신 실패 인증서
aws acm list-certificates --certificate-statuses ISSUED EXPIRED \
  --query 'CertificateSummaryList[].[DomainName,NotAfter,RenewalEligibility]' --output text \
  | sort -k2 | head -20

# 실제 서비스 인증서 확인 — 발급된 것과 배포된 것이 다를 수 있다
echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null \
  | openssl x509 -noout -dates -subject
\`\`\`

발급 목록과 실제 배포 상태가 다른 경우가 있다. 새 인증서를 발급했지만 로드밸런서에 붙이지 않은 상태다. 외부 점검이 그것을 잡는다.

## 참고

- AWS Certificate Manager 사용 설명서
- AWS Certificate Manager 요금 페이지
- CA/Browser Forum Baseline Requirements`,
    diagram: {
      type: 'matrix',
      caption: '자동화 범위',
      x: ['ACM 발급', '외부 발급'],
      y: ['AWS 서비스 연결', 'EC2 직접 설치'],
      cells: ['완전 자동', '수동 갱신 필요', '지원 안 됨', '가장 위험'],
    },
    diagram2: {
      type: 'bars',
      caption: '갱신 실패 원인 비중(경향)',
      unit: '상대값',
      items: [
        { label: '검증 레코드 삭제', value: 55 },
        { label: '어디에도 미연결', value: 20 },
        { label: '메일 검증 미응답', value: 15 },
        { label: 'CAA 충돌', value: 10 },
      ],
    },
  },
  {
    slug: 'aws-guardduty-runtime',
    title: 'GuardDuty 런타임 보호와 악성코드 검사',
    body: `로그 기반 탐지는 이미 일어난 통신과 API 호출을 본다. 그런데 컨테이너 안에서 무슨 프로세스가 떴는지, 어떤 파일이 실행됐는지는 로그에 남지 않는다. GuardDuty 런타임 모니터링과 악성코드 보호는 그 구간을 채운다. 다만 에이전트가 붙고 스캔이 도는 만큼 비용과 운영 부담이 함께 생긴다.

## 무엇을 추가로 볼 수 있는가?

| 기능 | 보는 것 |
| --- | --- |
| 런타임 모니터링 | 프로세스 실행, 파일 접근, 네트워크 연결 |
| 악성코드 보호(EBS) | 볼륨 스냅샷을 떠서 검사 |
| 악성코드 보호(S3) | 업로드된 객체 검사 |
| 컨테이너 대상 | EKS·ECS·Fargate 워크로드 |
| EC2 대상 | 인스턴스 내부 행위 |

로그 기반 탐지가 "이 인스턴스가 이상한 곳과 통신했다"까지라면, 런타임 모니터링은 "어떤 프로세스가 그 통신을 만들었다"까지 알려준다. 조사에서 이 차이가 크다.

![로그 탐지와 런타임 탐지의 범위](/img/posts/aws-guardduty-runtime.svg)

## 에이전트 배포 방식

EKS 는 애드온으로, ECS·EC2 는 SSM 을 통해 자동 배포할 수 있다. 자동 관리를 켜면 새 워크로드에도 자동으로 붙는다. 다만 에이전트가 자원을 쓰므로 요청·제한 설정을 확인해야 한다.

\`\`\`
확인할 것
  에이전트 CPU·메모리 사용량
  노드당 자원 여유
  자동 배포 대상 범위 (태그로 제외 가능)
  커널 버전 호환성
\`\`\`

## 악성코드 검사의 동작 방식

EBS 검사는 볼륨 스냅샷을 떠서 별도 환경에서 검사하므로 워크로드에 영향이 거의 없다. S3 검사는 업로드 시점에 객체를 검사하고 결과를 태그로 남긴다. 사용자 업로드를 받는 서비스에서 특히 유용하다.

![검사가 도는 방식](/img/posts/aws-guardduty-runtime-2.svg)

## 비용은 어떻게 붙는가

기존 GuardDuty 요금과 별도 축으로 붙는다.

- **런타임 모니터링** — 보호 대상 vCPU 시간 또는 워크로드 시간
- **EBS 악성코드 검사** — 검사한 데이터 양(GB)
- **S3 악성코드 검사** — 검사한 객체 수와 데이터 양

런타임 모니터링은 상시 과금이므로 워크로드 규모에 비례한다. 개발 계정 전체에 켜기보다 운영 계정과 민감 워크로드에 먼저 적용하는 것이 일반적이다. EBS 검사는 탐지가 발생했을 때만 도는 설정과 상시 스캔 설정이 있어, 후자는 비용이 커진다.

## 켜기 전에 판단할 것

- 이미 다른 단말 탐지 도구가 컨테이너를 덮고 있는가 — 중복 투자
- 컨테이너가 읽기 전용 루트로 잠겨 있는가 — 위험이 이미 낮음
- 사용자 업로드를 받는가 — S3 검사 효과가 큼
- 조사에서 프로세스 정보가 필요했던 적이 있는가

## 바로 확인하기

기능별 활성 상태를 본다.

\`\`\`bash
DET=$(aws guardduty list-detectors --query 'DetectorIds[0]' --output text)
aws guardduty get-detector --detector-id "$DET" \\
  --query 'Features[].{기능:Name,상태:Status,추가설정:AdditionalConfiguration[].{이름:Name,상태:Status}}' \\
  --output json
\`\`\`

에이전트가 실제로 붙었는지 확인한다.

\`\`\`bash
aws guardduty get-coverage-statistics --detector-id "$DET" \\
  --statistics-type COUNT_BY_COVERAGE_STATUS \\
  --query 'CoverageStatistics.CountByCoverageStatus'

kubectl get pods -n amazon-guardduty -o wide 2>/dev/null | head
\`\`\`

## 실제로 이렇게 터진다

컨테이너 환경에서 이미지 스캔만 하고 실행 중 행위는 보지 않은 사례가 있다. 이미지에는 취약점이 없었지만, 실행 중에 외부에서 내려받은 스크립트가 채굴을 시작했다. 이미지 스캔으로는 보이지 않는다.

에이전트를 일부 노드에만 배포한 경우도 있다. 공격자는 하필 그 노드에 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 이미지 스캔이면 충분하다 | 실행 중 행위는 다른 문제다 |
| 자동으로 전 노드에 배포된다 | 배포 방식을 정해야 한다 |
| 성능 영향이 없다 | 자원을 소모한다 |
| 탐지하면 막아 준다 | 대응은 따로 구성한다 |
| 비용이 작다 | vCPU 시간 기준이라 규모에 비례한다 |

## 무엇을 잡는가

| 행위 | 탐지 |
| --- | --- |
| 컨테이너 탈출 시도 | 가능 |
| 외부 스크립트 실행 | 가능 |
| 채굴 프로세스 | 가능 |
| 자격 증명 접근 | 가능 |
| 정상 애플리케이션 취약점 악용 | 부분적 |

빌드 시점에 없던 것이 실행 시점에 나타나는 경우를 잡는 것이 이 도구의 자리다.

## 배포 방식

| 방식 | 성격 |
| --- | --- |
| 자동 관리 | 서비스가 에이전트를 배포·갱신 |
| 수동 배포 | 직접 관리, 버전 통제 가능 |

특별한 이유가 없으면 자동 관리가 낫다. 수동으로 하면 갱신을 잊는다.

## 배포 후 확인할 것

에이전트가 붙지 않은 노드가 있으면 그곳이 사각지대다.

\`\`\`bash
# 런타임 보호 대상 중 에이전트 상태
aws guardduty list-coverage --detector-id "$DET" \
  --filter-criteria '{"FilterCriterion":[{"CriterionKey":"COVERAGE_STATUS","FilterCondition":{"Equals":["UNHEALTHY"]}}]}' \
  --query 'Resources[].[ResourceDetails.EksClusterDetails.ClusterName,CoverageStatus,Issue]' \
  --output text
\`\`\`

상태가 비정상인 노드를 방치하면 배포율만 높고 실효는 없다. 주간 점검 항목에 넣는다.

## 참고

- Amazon GuardDuty 사용 설명서 — 런타임 모니터링과 악성코드 보호
- Amazon GuardDuty 요금 페이지
- MITRE ATT&CK for Containers`,
    diagram: {
      type: 'layers',
      caption: '탐지 범위의 층',
      layers: [
        { label: 'CloudTrail 기반', note: 'API 호출' },
        { label: '네트워크 기반', note: '흐름·DNS' },
        { label: '런타임', note: '프로세스·파일 실행' },
        { label: '악성코드 검사', note: '볼륨·객체 내용' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '적용 범위 판단',
      x: ['민감 워크로드', '일반'],
      y: ['운영 계정', '개발 계정'],
      cells: ['먼저 적용', '단계적', '선택적', '비용 대비 낮음'],
    },
  },
  {
    slug: 'aws-trusted-advisor',
    title: 'AWS Trusted Advisor 보안 점검 활용법',
    body: `AWS Trusted Advisor 는 AWS 계정 설정을 점검해 보안·비용·성능·한도 항목을 알려준다. 별도 설정 없이 바로 결과가 나오므로, 새 계정을 인수받았거나 현황을 빠르게 파악해야 할 때 첫 화면으로 쓸 만하다. 다만 지원 플랜에 따라 볼 수 있는 항목이 다르고, Security Hub 와 겹치는 부분이 있어 역할을 나눠 써야 한다.

## AWS 계정에서 어떤 항목을 점검하는가?

| 점검 항목 | 내용 |
| --- | --- |
| 보안 그룹 개방 | 특정 포트가 전체 개방됐는지 |
| S3 버킷 권한 | 공개 읽기·쓰기 |
| 루트 계정 MFA | 다단계 인증 설정 여부 |
| IAM 사용 | 사용자·정책 존재 여부 |
| 액세스 키 회전 | 오래된 키 |
| 로그 설정 | CloudTrail 활성화 |
| RDS 공개 접근 | 퍼블릭 액세스 설정 |
| 서비스 한도 | 한도 임박 (가용성 관련) |

![지원 플랜별 볼 수 있는 범위](/img/posts/aws-trusted-advisor.svg)

## 지원 플랜에 따라 다르다

기본·개발자 플랜에서는 핵심 보안 점검 일부만 제공된다. 비즈니스·엔터프라이즈 플랜에서 전체 점검과 API 접근이 열린다. 그래서 자동화에 쓰려면 플랜 조건을 먼저 확인해야 한다.

## Security Hub 와 어떻게 나눠 쓰는가

겹치는 항목이 많다. 역할을 이렇게 나누면 중복이 줄어든다.

\`\`\`
Trusted Advisor   빠른 현황 파악, 서비스 한도, 비용 관점
Security Hub      표준 기반 상시 점검, 조직 집계, 결과 통합
Config            변경 이력과 시점, 사용자 정의 규칙
\`\`\`

상시 운영 지표는 Security Hub 로 두고, Trusted Advisor 는 계정 인수·정기 점검 시 훑는 용도로 쓰는 것이 현실적이다.

![도구별 역할 분담](/img/posts/aws-trusted-advisor-2.svg)

## 서비스 한도 점검이 의외로 중요하다

보안 항목만 보다가 한도 점검을 놓치기 쉽다. 한도에 걸리면 자동 확장이 멈추고, 그것이 곧 가용성 사고가 된다. 트래픽 급증이나 공격 상황에서 한도가 걸리면 대응 자체가 불가능해진다.

## 비용은 어떻게 붙는가

**Trusted Advisor 자체에는 요금이 없다.** 대신 지원 플랜 구독료에 포함된 기능이다. 즉 전체 점검을 쓰려면 비즈니스 이상 플랜의 월 구독이 전제다.

플랜 비용은 월 사용액에 비례하는 구조라, 사용량이 큰 조직일수록 부담이 커진다. 다만 그런 조직은 대개 지원 채널이 필요해 이미 가입해 있는 경우가 많다.

## 바로 확인하기

점검 결과를 API 로 뽑는다. 비즈니스 이상 플랜이 필요하다.

\`\`\`bash
# 보안 범주 점검 목록
aws support describe-trusted-advisor-checks --language ko \\
  --query 'checks[?category==\`security\`].{ID:id,이름:name}' --output table 2>/dev/null \\
  || echo '지원 플랜이 낮아 API 접근이 불가능합니다'
\`\`\`

경고 상태인 항목만 추린다.

\`\`\`bash
for id in $(aws support describe-trusted-advisor-checks --language ko \\
  --query 'checks[?category==\`security\`].id' --output text); do
  aws support describe-trusted-advisor-check-result --check-id "$id" --language ko \\
    --query '{점검:checkId,상태:result.status,문제자원:length(result.flaggedResources)}' --output text
done | grep -v ok
\`\`\`

## 실제로 이렇게 터진다

점검 결과를 비용 항목만 보고 보안 항목은 지나친 사례가 있다. 공개 스냅샷 경고가 몇 달째 떠 있었다. 스냅샷에는 데이터베이스 전체가 들어 있었다.

지원 등급이 낮아 보안 점검이 일부만 보이는 것을 모르고 "문제 없음" 으로 판단한 경우도 있다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 전체 점검이 다 보인다 | 지원 등급에 따라 다르다 |
| 보안 도구를 대체한다 | 기초 점검 수준이다 |
| 결과가 실시간이다 | 갱신 주기가 있다 |
| 비용 항목만 유용하다 | 보안 항목이 더 급하다 |
| 경고가 없으면 안전하다 | 점검 범위가 좁다 |

## 보안 항목 중 급한 것

| 항목 | 왜 급한가 |
| --- | --- |
| 공개 스냅샷 | 데이터 전체 노출 |
| 공개 버킷 권한 | 데이터 노출 |
| 전체 개방 보안 그룹 | 직접 공격 경로 |
| 루트 다중 인증 미설정 | 계정 탈취 시 전면 침해 |
| 노출된 액세스 키 | 즉시 침해 |

공개 스냅샷은 실수로 만들어지고 오래 남는다. 목록에 뜨면 그날 처리한다.

## 다른 도구와 어떻게 나누나

| 도구 | 자리 |
| --- | --- |
| 이 서비스 | 기초 점검, 계정 위생 |
| 보안 허브 | 표준 기반 상세 점검 |
| 설정 기록 서비스 | 변경 이력, 사용자 규칙 |

기초 점검을 이것으로 하고, 깊은 점검은 다른 도구에 맡긴다. 이것만으로 충분하다고 보면 놓치는 것이 많다.

\`\`\`bash
# 경고·주의 상태인 점검 — 보안 항목부터 본다
aws support describe-trusted-advisor-checks --language ko \
  --query 'checks[].[category,id,name]' --output text | grep '^security'
\`\`\`

지원 등급이 기본이면 이 호출 자체가 되지 않는다. 그 경우 콘솔에서 볼 수 있는 항목이 제한적이라는 사실을 전제로 다른 도구를 준비한다.

## 참고

- AWS Trusted Advisor 사용 설명서
- AWS Support 플랜 비교
- AWS Well-Architected Framework 보안 기둥`,
    diagram: {
      type: 'layers',
      caption: '지원 플랜과 점검 범위',
      layers: [
        { label: '기본·개발자', note: '핵심 보안 점검 일부' },
        { label: '비즈니스', note: '전체 점검 + API' },
        { label: '엔터프라이즈', note: '전담 지원 포함' },
        { label: '공통', note: '서비스 한도 점검' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '도구 역할 분담',
      x: ['상시 운영', '일회성 점검'],
      y: ['표준 기반', '한도·비용 관점'],
      cells: ['Security Hub', '외부 진단', 'Config', 'Trusted Advisor'],
    },
  },
]
