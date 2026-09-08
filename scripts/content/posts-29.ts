import type { SeedPost } from './types'

/** 281~290 — 메시징·배치·비동기 처리 */
export const posts29: SeedPost[] = [
  {
    slug: 'kafka-acl',
    title: 'Kafka 토픽 접근 통제와 인증 설정',
    body: `Kafka 는 기본 설정에서 인증도 인가도 없다. 접속할 수 있으면 모든 토픽을 읽고 쓸 수 있다. 그런데 스트림에는 주문 내역, 사용자 행동, 결제 이벤트가 흐른다. 데이터베이스에는 권한을 촘촘히 걸고 같은 데이터가 지나가는 스트림은 열어 두는 구성이 흔하다.

## 열려 있으면 무엇이 가능한가?

| 동작 | 결과 |
| --- | --- |
| 임의 토픽 구독 | 전 이벤트 열람 |
| 임의 토픽 생산 | 위조 이벤트 주입 |
| 컨슈머 그룹 오프셋 변경 | 재처리 유발, 중복 반영 |
| 토픽 삭제 | 데이터 손실 |
| 설정 변경 | 보관 기간 축소로 증거 삭제 |

위조 이벤트 주입이 특히 위험하다. 하위 시스템은 스트림을 신뢰하므로, 주입된 결제 완료 이벤트가 그대로 처리된다.

![인증 없는 스트림의 위험](/img/posts/kafka-acl.svg)

## 인증과 인가를 함께 켠다

인증만 켜면 "누구인지"는 알지만 무엇을 할 수 있는지는 제한되지 않는다. 두 개를 같이 설정한다.

\`\`\`properties
# 인증 — 상호 TLS 또는 SASL
listeners=SASL_SSL://:9093
sasl.enabled.mechanisms=SCRAM-SHA-512
ssl.client.auth=required

# 인가 — 기본 거부로 두는 것이 핵심
authorizer.class.name=org.apache.kafka.metadata.authorizer.StandardAuthorizer
allow.everyone.if.no.acl.found=false
super.users=User:kafka-admin
\`\`\`

기본 거부 설정을 빼면 규칙이 없는 토픽은 전부 허용된다. 새로 만든 토픽이 조용히 열리는 원인이 이것이다.

\`\`\`bash
# 서비스별로 필요한 것만 — 생산자는 쓰기, 소비자는 읽기 + 그룹
kafka-acls --bootstrap-server localhost:9093 --add \\
  --allow-principal User:order-service --operation Write --topic orders
kafka-acls --bootstrap-server localhost:9093 --add \\
  --allow-principal User:billing-service --operation Read --topic orders \\
  --group billing-consumer
\`\`\`

![주체별 권한 분리](/img/posts/kafka-acl-2.svg)

## 지금 상태를 확인하는 방법

\`\`\`bash
# 인가 설정 — 기본 허용이면 즉시 조치
kafka-configs --bootstrap-server localhost:9093 --describe --entity-type brokers |
  grep -E 'authorizer|allow.everyone'

# 규칙이 없는 토픽 목록 — 기본 거부라면 동작하지 않고, 기본 허용이라면 전부 열려 있다
comm -23 <(kafka-topics --bootstrap-server localhost:9093 --list | sort) \\
         <(kafka-acls --bootstrap-server localhost:9093 --list 2>/dev/null |
           grep -oP 'topic=\\K[^,]+' | sort -u)

# 평문 리스너가 남아 있는지
kafka-broker-api-versions --bootstrap-server localhost:9092 >/dev/null 2>&1 &&
  echo '평문 9092 가 열려 있습니다'
\`\`\`

## 스트림에 담기는 데이터도 줄인다

권한을 걸어도 스트림에 개인정보 전체를 실어 보내면 열람 가능한 주체가 그만큼 위험을 진다. 이벤트에는 식별자와 변경된 값만 담고, 필요한 쪽이 권한으로 조회하게 하는 구조가 안전하다. 그리고 보관 기간을 필요한 만큼만 두어 오래된 이벤트가 쌓이지 않게 한다.

## 참고

- Apache Kafka 문서 — Security, Authorization and ACLs
- OWASP — Access Control Cheat Sheet
- NIST SP 800-53 AC-3 Access Enforcement`,
    diagram: {
      type: 'flow',
      caption: '위조 이벤트 주입',
      steps: [
        { label: '스트림 접속', note: '인증 없음' },
        { label: '이벤트 생산', note: '형식만 맞추면 됨' },
        { label: '하위 시스템 처리', note: '스트림을 신뢰' },
        { label: '상태 변경 반영', note: '결제·권한 등', danger: true },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '설정 조합',
      x: ['기본 거부', '기본 허용'],
      y: ['인증 켜짐', '인증 없음'],
      cells: ['안전', '새 토픽 노출', '접속만 막힘', '전부 노출'],
    },
  },
  {
    slug: 'queue-trust-boundary',
    title: '메시지 큐를 신뢰 경계로 다루기',
    body: `요청을 큐에 넣고 워커가 처리하는 구조에서는, 워커 입장에서 메시지가 어디서 왔는지 알 수 없다. 그래서 API 진입점에서 하던 검증이 큐 뒤에서는 생략되기 쉽다. 큐는 내부 구성 요소지만 신뢰 경계로 다뤄야 한다 — 메시지는 입력이고, 입력은 검증 대상이다.

## 진입점 검증만으로 부족한 이유는 무엇인가?

| 상황 | 결과 |
| --- | --- |
| 다른 서비스가 직접 큐에 넣는다 | 진입점 검증을 건너뜀 |
| 재처리 도구로 메시지를 재투입한다 | 오래된 형식이 그대로 |
| 개발자가 수동으로 넣는다 | 검증 없는 데이터 |
| 큐 자체가 노출됐다 | 임의 메시지 주입 |
| 메시지에 권한 정보가 담겨 있다 | 위조로 권한 상승 |

![큐 앞뒤의 검증 위치](/img/posts/queue-trust-boundary.svg)

## 메시지 설계 원칙

권한을 메시지에 담지 않는 것이 가장 중요하다. "이 작업은 관리자 권한으로 실행" 같은 필드가 있으면 그 필드가 곧 공격 표면이다. 주체 식별자만 담고 권한은 처리 시점에 다시 조회한다.

\`\`\`json
{
  "schemaVersion": 3,
  "messageId": "01J8...",           // 멱등 처리 키
  "actorId": "u_1042",              // 누가 요청했는지만
  "action": "export_orders",        // 허용 목록에 있는 값
  "params": { "from": "2026-01-01", "to": "2026-03-31" },
  "issuedAt": "2026-09-08T01:22:31Z"
}
\`\`\`

\`\`\`ts
// 워커의 처리 순서 — 검증, 권한 재조회, 멱등 확인
const msg = Schema.parse(raw)                      // 형식 위반은 폐기
if (Date.now() - Date.parse(msg.issuedAt) > 86_400_000) return drop('오래된 메시지')
if (await seen(msg.messageId)) return ack()        // 중복 처리 방지
const actor = await loadActor(msg.actorId)         // 권한은 여기서 조회
if (!can(actor, msg.action)) return drop('권한 없음')
await handle(msg)
\`\`\`

![워커의 검증 순서](/img/posts/queue-trust-boundary-2.svg)

## 처리 실패를 어떻게 다루는가

실패한 메시지를 무한 재시도하면 장애가 증폭되고, 그냥 버리면 데이터가 사라진다. 실패 큐로 옮기고 사람이 판단하는 구조가 안전하다. 그런데 실패 큐에는 처리되지 못한 원본 데이터가 남으므로, 그 큐도 같은 등급으로 보호하고 보관 기간을 정해야 한다.

재시도 자체가 공격 수단이 되는 경우도 있다. 처리에 비용이 드는 작업이 무한히 재시도되면 그것이 자원 소진으로 이어진다. 그래서 재시도 횟수를 정하는 것은 안정성 문제이면서 보안 문제이기도 하다. 형식이 잘못된 메시지는 재시도해도 결과가 같으므로 즉시 실패 큐로 보내고, 일시적 오류만 재시도하도록 오류를 구분하는 것이 옳다.

| 항목 | 설정 방향 |
| --- | --- |
| 재시도 횟수 | 3~5회, 지수 백오프 |
| 실패 큐 | 별도 큐, 접근 통제 동일 |
| 실패 큐 보관 | 기간 지정, 자동 파기 |
| 알림 | 유입 속도 기준 경보 |

## 큐 접근을 어떻게 확인하는가

\`\`\`bash
# 큐 정책에 넓은 주체가 들어 있는지 (AWS SQS 예)
aws sqs get-queue-attributes --queue-url "$Q" --attribute-names Policy |
  python3 -c 'import sys,json; p=json.load(sys.stdin)["Attributes"].get("Policy","{}");
d=json.loads(p); [print(s.get("Principal"), s.get("Action")) for s in d.get("Statement",[])]'

# 실패 큐에 쌓인 양 — 늘어나면 형식 변경이나 침해 시도 신호
aws sqs get-queue-attributes --queue-url "$DLQ" \\
  --attribute-names ApproximateNumberOfMessages
\`\`\`

## 참고

- OWASP — Input Validation Cheat Sheet
- AWS 문서 — SQS 대기열 정책, 배달 못한 편지 대기열
- NIST SP 800-53 SI-10 Information Input Validation`,
    diagram: {
      type: 'matrix',
      caption: '검증 위치',
      x: ['워커도 검증', '워커는 신뢰'],
      y: ['큐 접근 제한', '큐 노출'],
      cells: ['안전', '내부 주입 가능', '이중 방어', '임의 실행'],
    },
    diagram2: {
      type: 'steps',
      caption: '처리 단계',
      steps: [
        { label: '형식 검증', note: '스키마 위반 폐기' },
        { label: '신선도 확인', note: '오래된 메시지 폐기' },
        { label: '멱등 확인', note: '중복 방지' },
        { label: '권한 재조회', note: '메시지 값 불신' },
      ],
    },
  },
  {
    slug: 'batch-job-identity',
    title: '배치 작업 실행 계정과 권한 설계',
    body: `야간 배치는 대개 전권 계정으로 돌아간다. 여러 시스템을 건드리니 편의상 넓은 권한을 주고, 한 번 돌기 시작하면 아무도 다시 보지 않는다. 그런데 배치는 대량 데이터를 다루고 사람의 확인 없이 실행되므로, 침해 시 피해가 가장 큰 실행 경로다.

## 배치가 위험한 이유는 무엇인가?

| 특성 | 위험 |
| --- | --- |
| 넓은 권한 | 한 번의 침해로 광범위 접근 |
| 사람 확인 없음 | 이상 동작이 그대로 진행 |
| 대량 처리 | 유출·삭제 규모가 크다 |
| 오래된 코드 | 검토 대상에서 빠져 있다 |
| 자격 증명 하드코딩 | 저장소·서버에 평문 |
| 실패 알림 부재 | 멈춘 것도 모른다 |

![배치 침해 시 확산 범위](/img/posts/batch-job-identity.svg)

## 작업 단위로 계정을 나눈다

하나의 배치 계정을 공유하면 권한이 모든 배치의 합집합이 된다. 작업별로 계정을 만들고 그 작업이 쓰는 것만 허용한다.

\`\`\`
정산 배치      결제 테이블 읽기 + 정산 테이블 쓰기
발송 배치      대상 목록 읽기 + 발송 이력 쓰기 + 메일 API
정리 배치      로그 테이블 삭제 권한만
지표 배치      복제본 읽기 전용
\`\`\`

권한을 나누면 작업이 늘어날 때마다 계정을 만들어야 하는데, 그 작업을 인프라 코드에 넣어 두면 부담이 크지 않다.

![작업별 권한 분리](/img/posts/batch-job-identity-2.svg)

## 자격 증명을 어떻게 다루는가

배치 서버에 키 파일을 두는 방식은 그 서버가 침해되면 끝난다. 실행 환경이 신원을 증명하고 짧은 자격 증명을 받는 구조로 옮긴다.

\`\`\`bash
# 나쁜 방식 — 파일에 평문
# export DB_PASS=$(cat /opt/batch/.dbpass)

# 나은 방식 — 실행 시점에 발급받고 프로세스 안에서만 사용
CREDS=$(aws sts assume-role --role-arn "$BATCH_ROLE" \\
  --role-session-name "settle-$(date +%s)" --duration-seconds 3600)
export AWS_ACCESS_KEY_ID=$(echo "$CREDS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["Credentials"]["AccessKeyId"])')
# 종료 시 환경 변수는 함께 사라진다

# 평문 자격 증명이 남아 있는지 점검
grep -rlE 'password|passwd|secret|token' /opt/batch --include='*.sh' --include='*.conf' 2>/dev/null
\`\`\`

## 실행 결과를 반드시 남긴다

배치가 무엇을 몇 건 처리했는지 남기지 않으면, 이상 동작을 알아챌 방법이 없다. 처리 건수를 지표로 내보내고 평소 범위를 벗어나면 경보를 띄운다. 정상이 1만 건인 작업이 100만 건을 처리했다면 그것 자체가 신호다.

| 남길 항목 | 쓰임 |
| --- | --- |
| 시작·종료 시각 | 지연 탐지 |
| 처리 건수 | 이상 규모 탐지 |
| 실패 건수와 원인 | 품질 관리 |
| 실행 계정과 호스트 | 조사 |

## 참고

- NIST SP 800-53 AC-6 Least Privilege, AU-2 Event Logging
- AWS 문서 — IAM 역할과 임시 자격 증명
- OWASP — Secrets Management Cheat Sheet`,
    diagram: {
      type: 'bars',
      caption: '실행 경로별 위험(상대값)',
      unit: '상대값',
      items: [
        { label: '공용 전권 배치 계정', value: 40 },
        { label: '평문 자격 증명', value: 25 },
        { label: '결과 미기록', value: 20, note: '탐지 불가' },
        { label: '작업별 계정', value: 8 },
        { label: '임시 자격 증명', value: 5 },
      ],
    },
    diagram2: {
      type: 'layers',
      caption: '권한 설계 계층',
      layers: [
        { label: '작업별 신원', note: '공용 계정 폐지' },
        { label: '필요한 자원만', note: '테이블·API 단위' },
        { label: '임시 자격 증명', note: '수명 제한' },
        { label: '실행 기록', note: '건수 기반 경보' },
      ],
    },
  },
  {
    slug: 'cron-job-security',
    title: '크론 작업 보안 점검 항목 정리',
    body: `크론은 오래된 도구라 검토 대상에서 빠진다. 그런데 침해 후 지속성을 확보하는 가장 흔한 수단이 크론 등록이고, 반대로 정상 크론 작업이 권한 상승 경로가 되는 경우도 많다. 작업 목록을 한 번 정리하는 것만으로 양쪽이 함께 개선된다.

## 권한 상승이 어떻게 일어나는가?

| 문제 | 왜 위험한가 |
| --- | --- |
| 루트로 실행되는 작업 | 스크립트 변조 시 루트 획득 |
| 쓰기 권한이 열린 스크립트 | 누구나 내용을 바꿀 수 있다 |
| 상대 경로 실행 | PATH 조작으로 다른 파일 실행 |
| 인자에 담긴 비밀값 | 프로세스 목록에 노출 |
| 예상 밖 등록 | 침해 지속성 |
| 결과 미확인 | 실패가 방치된다 |

스크립트 파일의 쓰기 권한이 열려 있는데 루트로 실행되는 조합이 가장 흔하고 가장 위험하다.

![크론을 통한 권한 상승](/img/posts/cron-job-security.svg)

## 한 번에 훑는 점검 명령

\`\`\`bash
# 모든 사용자의 크론 + 시스템 크론 + systemd 타이머를 한자리에 모은다
for u in $(cut -d: -f1 /etc/passwd); do
  crontab -l -u "$u" 2>/dev/null | sed "s|^|[$u] |"
done
cat /etc/crontab /etc/cron.d/* 2>/dev/null | grep -vE '^\\s*#|^\\s*$'
systemctl list-timers --all --no-pager | head -20

# 루트로 실행되면서 파일 권한이 느슨한 스크립트 — 가장 위험한 조합
grep -rhoE '/[A-Za-z0-9_./-]+\\.(sh|py|pl)' /etc/crontab /etc/cron.d/ 2>/dev/null |
  sort -u | while read -r f; do
    [ -f "$f" ] || continue
    perm=$(stat -c '%a %U %G' "$f")
    case "$perm" in *2\\ *|*3\\ *|*6\\ *|*7\\ *) echo "쓰기 열림: $perm $f";; esac
  done
\`\`\`

## 안전하게 작성하는 규칙

세 가지만 지키면 대부분의 문제가 사라진다.

1. 절대 경로만 쓴다 — 명령과 파일 모두
2. 비밀값은 인자로 넘기지 않고 파일이나 환경에서 읽는다
3. 실행 계정을 최소 권한으로 두고 루트를 기본값으로 삼지 않는다

\`\`\`
# 나쁜 예 — 상대 경로, 인자에 비밀값, 루트 실행
0 3 * * * root cd /opt/app && ./sync.sh --token=abc123

# 나은 예 — 절대 경로, 전용 계정, 비밀값은 파일 권한으로 보호
0 3 * * * appsvc /usr/bin/flock -n /run/sync.lock /opt/app/bin/sync.sh
\`\`\`

flock 을 붙이면 앞 실행이 끝나지 않았을 때 겹쳐 도는 것을 막는다. 겹쳐 도는 배치가 데이터 중복과 장애의 흔한 원인이다.

![작성 규칙](/img/posts/cron-job-security-2.svg)

## 예상 밖 등록을 어떻게 탐지하는가

크론 관련 경로를 파일 무결성 감시 대상에 넣고, 변경이 배포 창구 밖에서 일어났는지 확인한다. 그리고 등록된 작업 목록을 정기적으로 뽑아 지난 목록과 비교하면, 새로 생긴 항목이 바로 드러난다. 이 비교를 자동화해 두면 침해 탐지 수단이 하나 늘어난다.

## 참고

- crontab(5) 매뉴얼
- MITRE ATT&CK — T1053.003 Scheduled Task/Job: Cron
- CIS Benchmark — cron 권한 설정 절`,
    diagram: {
      type: 'flow',
      caption: '변조를 통한 권한 상승',
      steps: [
        { label: '일반 사용자 권한', note: '최초 침해' },
        { label: '쓰기 열린 스크립트 발견', note: '권한 확인' },
        { label: '내용 변조', note: '명령 삽입' },
        { label: '루트로 실행됨', note: '다음 주기에', danger: true },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '위험 조합',
      x: ['파일 권한 엄격', '쓰기 열림'],
      y: ['전용 계정 실행', '루트 실행'],
      cells: ['안전', '그 계정 권한', '검토 필요', '루트 획득'],
    },
  },
  {
    slug: 'event-replay',
    title: '이벤트 재생 공격과 멱등 키 설계',
    body: `같은 요청을 다시 보내는 것만으로 결제가 두 번 되거나 포인트가 두 번 적립되면, 그것은 공격 수단이 된다. 네트워크 오류로 인한 정상 재시도와 악의적 재전송은 서버 입장에서 구분되지 않는다. 그래서 "몇 번 보내도 결과가 같다"는 성질을 처음부터 설계에 넣어야 한다.

## 어디에서 중복이 생기는가?

| 원인 | 성격 |
| --- | --- |
| 클라이언트 재시도 | 정상, 반드시 발생 |
| 게이트웨이 재전송 | 정상, 타임아웃 시 |
| 큐의 최소 한 번 전달 | 정상, 설계상 |
| 사용자의 이중 클릭 | 정상, 흔하다 |
| 공격자의 의도적 재전송 | 악의 |
| 캡처된 요청 재사용 | 악의 |

앞의 네 가지가 이미 상시 발생하므로, 멱등 처리는 보안 조치라기보다 기본 요건이다. 그것이 갖춰지면 재생 공격도 함께 막힌다.

![중복 요청이 들어오는 경로](/img/posts/event-replay.svg)

## 멱등 키를 어떻게 설계하는가

키는 클라이언트가 만들고 서버가 기억한다. 서버가 만들면 재시도할 때 다른 키가 되어 의미가 없다.

\`\`\`
키 생성    클라이언트가 요청 단위로 UUID 생성, 재시도 시 같은 값 사용
키 범위    사용자 + 동작 + 키 로 유일성 보장
저장       처리 결과와 함께 저장. 같은 키 재요청 시 저장된 결과를 반환
보관 기간  24시간 이상. 짧으면 늦은 재시도가 중복 처리된다
동시성     같은 키의 동시 요청은 하나만 처리 (유일 제약 또는 잠금)
\`\`\`

\`\`\`sql
-- 유일 제약이 경쟁 조건까지 막아 준다. 애플리케이션 조회만으로는 부족하다.
CREATE TABLE idempotency (
  actor_id   text        NOT NULL,
  action     text        NOT NULL,
  key        text        NOT NULL,
  result     jsonb       NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, action, key)
);
\`\`\`

![키 처리 흐름](/img/posts/event-replay-2.svg)

## 서명과 신선도로 재사용을 막는다

멱등 처리는 중복 실행을 막지만, 캡처된 요청이 나중에 쓰이는 것 자체는 남는다. 외부에서 들어오는 요청에는 서명과 시각을 함께 요구한다.

\`\`\`ts
// 시각·논스·서명을 함께 검증한다. 하나라도 빠지면 재사용 여지가 남는다.
if (Math.abs(Date.now() - ts * 1000) > 300_000) return reject('시각 오차')
if (await nonceSeen(nonce)) return reject('재사용된 논스')
if (!timingSafeEqual(sign(ts, nonce, rawBody), header)) return reject('서명 불일치')
await markNonce(nonce, 600)      // 허용 오차보다 길게 보관
\`\`\`

## 무엇을 시험해야 하는가

같은 요청을 연달아 두 번, 그리고 동시에 두 번 보내는 시험을 자동 테스트에 넣는다. 순차 중복은 대개 막히지만 동시 중복은 통과하는 경우가 많다 — 조회 후 삽입 사이의 틈 때문이다.

\`\`\`bash
# 동시 재전송 시험 — 결과가 하나만 만들어져야 한다
for i in 1 2 3 4 5; do
  curl -s -X POST https://stg.example.com/api/payments \\
    -H "Idempotency-Key: 11111111-1111-1111-1111-111111111111" \\
    -H 'Content-Type: application/json' -d '{"amount":1000}' &
done; wait
\`\`\`

## 참고

- IETF draft — The Idempotency-Key HTTP Header Field
- OWASP — Web Security Testing Guide, 재생 공격 시험
- Stripe API 문서 — 멱등 요청 설계`,
    diagram: {
      type: 'flow',
      caption: '중복 처리 방지',
      steps: [
        { label: '클라이언트 키 생성', note: '재시도 시 동일' },
        { label: '유일 제약 삽입', note: '경쟁 조건 차단' },
        { label: '처리 후 결과 저장', note: '키와 함께' },
        { label: '재요청 시 결과 반환', note: '재실행 없음' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '방어 조합',
      x: ['서명·신선도 검증', '검증 없음'],
      y: ['멱등 처리', '멱등 없음'],
      cells: ['안전', '중복은 막힘', '재사용 차단', '재생 성립'],
    },
  },
  {
    slug: 'third-party-callback',
    title: '외부 서비스 콜백 검증 설계 기준',
    body: `결제 대행사나 배송 업체가 결과를 알려 주는 콜백은, 그 내용으로 시스템 상태가 바뀐다. 그런데 주소만 알면 누구나 호출할 수 있는 상태로 열려 있는 경우가 많다. "결제 완료" 를 스스로 보내면 결제 없이 주문이 확정되는 구조가 실제로 자주 발견된다.

## 어떤 검증이 빠지는가?

| 검증 | 빠질 때의 결과 |
| --- | --- |
| 서명 확인 | 누구나 위조 호출 |
| 원본 조회 대조 | 금액·상태 위조 |
| 시각 확인 | 오래된 응답 재사용 |
| 중복 처리 방지 | 같은 결과 여러 번 반영 |
| 상태 전이 확인 | 취소된 주문이 다시 완료됨 |
| 출발지 제한 | 임의 위치에서 호출 |

![콜백 위조가 성립하는 경로](/img/posts/third-party-callback.svg)

## 서명 검증보다 원본 조회가 확실하다

콜백은 알림으로만 다루고, 실제 값은 상대 시스템에 다시 물어보는 방식이 가장 안전하다. 서명 방식은 업체마다 다르고 구현 실수가 잦은데, 원본 조회는 실수의 여지가 적다.

\`\`\`ts
// 콜백은 "확인해 보라"는 신호로만 취급한다
app.post('/callback/pay', async (req, res) => {
  res.status(200).end()                                  // 먼저 수신 응답
  const { orderId } = parse(req.body)                    // 식별자만 신뢰
  const real = await pg.getPayment(orderId)              // 값은 원본에서
  if (real.status !== 'PAID') return
  if (real.amount !== (await orders.get(orderId)).amount) return alert('금액 불일치')
  await orders.markPaid(orderId, real.transactionId)     // 멱등 처리
})
\`\`\`

금액을 대조하는 한 줄이 중요하다. 금액을 조작한 결제 시도가 실제로 흔하다.

![콜백 처리 순서](/img/posts/third-party-callback-2.svg)

## 상태 전이를 명시한다

허용된 전이만 반영하면 순서가 뒤바뀐 콜백이 문제를 만들지 않는다. 콜백은 순서를 보장하지 않으므로 취소 뒤에 완료가 도착할 수 있다.

\`\`\`
대기 → 완료      허용
대기 → 취소      허용
완료 → 환불      허용
취소 → 완료      거부   ← 순서 뒤바뀜 또는 위조
완료 → 완료      무시   ← 중복
\`\`\`

## 무엇을 시험하고 무엇을 기록하는가

시험은 세 가지다 — 서명 없이 호출, 금액을 바꿔 호출, 같은 콜백을 두 번 호출. 세 경우 모두 상태가 바뀌지 않아야 한다.

\`\`\`bash
# 서명 없이 호출했을 때 거부되는지
curl -s -o /dev/null -w '%{http_code}\\n' -X POST https://stg.example.com/callback/pay \\
  -H 'Content-Type: application/json' -d '{"orderId":"A1","status":"PAID","amount":1000}'
# 401 또는 403 이어야 한다. 200 이면 위조 가능하다는 뜻이다.
\`\`\`

기록에는 원본 조회 결과와 반영 여부를 함께 남긴다. 분쟁이 생겼을 때 이 기록이 근거가 된다.

## 참고

- OWASP — Web Hook Security 관련 지침, Input Validation Cheat Sheet
- PCI DSS 요구사항 6.2, 안전한 개발
- 각 결제 대행사 개발 문서의 결과 통보 검증 절`,
    diagram: {
      type: 'steps',
      caption: '위조 시나리오',
      steps: [
        { label: '콜백 주소 파악', note: '문서·트래픽' },
        { label: '완료 상태 전송', note: '서명 없음' },
        { label: '주문 확정', note: '결제 없이' },
        { label: '상품 발송', note: '손실 발생' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '검증 방식',
      x: ['원본 조회', '콜백 값 신뢰'],
      y: ['금액 대조', '대조 없음'],
      cells: ['안전', '값 위조 가능', '조회 결과만', '전면 위조'],
    },
  },
  {
    slug: 'sftp-automation',
    title: '파일 전송 자동화 통제와 계정 분리',
    body: `기관이나 협력사와 데이터를 주고받는 일은 여전히 파일 전송으로 이뤄진다. 오래 굳어진 구성이라 손대지 않는 경우가 많은데, 공용 계정 하나로 여러 상대가 접속하고, 홈 디렉터리에 수년간의 파일이 쌓여 있고, 비밀번호는 문서에 적혀 있는 상태가 흔하다.

## 무엇을 확인해야 하는가?

| 항목 | 흔한 문제 |
| --- | --- |
| 계정 | 여러 상대가 공용 계정 사용 |
| 인증 | 비밀번호 방식, 문서에 기록 |
| 경로 격리 | 상위 디렉터리 접근 가능 |
| 파일 잔존 | 처리 후에도 계속 보관 |
| 암호화 | 파일 자체는 평문 |
| 접속 제한 | 출발지 주소 제한 없음 |
| 기록 | 누가 무엇을 올렸는지 불명 |

![공용 계정과 경로 노출](/img/posts/sftp-automation.svg)

## 상대별 계정과 경로 격리

상대마다 계정을 따로 만들고 지정한 디렉터리 밖으로 나갈 수 없게 묶는다. 셸 접근은 주지 않는다.

\`\`\`
Match Group sftp-partners
  ChrootDirectory /srv/sftp/%u        # 자기 디렉터리 밖으로 못 나간다
  ForceCommand internal-sftp -l INFO  # 셸 없음, 전송 기록 남김
  AllowTcpForwarding no
  X11Forwarding no
  PermitTunnel no
  PasswordAuthentication no           # 공개키 또는 인증서만
\`\`\`

포트 포워딩을 막는 것이 중요하다. 막지 않으면 파일 전송 계정이 내부망 진입 통로가 된다.

![격리 구성](/img/posts/sftp-automation-2.svg)

## 파일 수명을 정한다

받은 파일을 처리한 뒤 그대로 두면, 그 디렉터리가 개인정보 저장소가 된다. 처리 완료 후 이동하고 보관 기간이 지나면 파기한다.

\`\`\`bash
# 수신 → 처리 → 보관 → 파기 흐름을 파일 이동으로 표현한다
/srv/sftp/partner-a/inbound     수신 (상대가 쓰기만)
/srv/data/staging               처리 대기 (상대는 접근 불가)
/srv/data/archive               보관, 암호화, 보유 기간 태그
파기                            보유 기간 경과 시 자동 삭제

# 오래 남은 파일 찾기 — 대개 예상보다 많다
find /srv/sftp -type f -mtime +30 -printf '%TY-%Tm-%Td %10s %p\\n' | sort | head -20
\`\`\`

## 점검 명령

\`\`\`bash
# 설정 실제 적용값 — 파일과 다를 수 있다
sshd -T -C user=partner-a 2>/dev/null |
  grep -E 'chrootdirectory|forcecommand|allowtcpforwarding|passwordauthentication'

# 전송 기록 — 누가 무엇을 언제
journalctl -u ssh --since '7 days ago' | grep -E 'internal-sftp|opened|closed' | tail -20

# 비밀번호 인증이 남은 계정
awk -F: '$2 !~ /^[*!]/ && $2 != "" {print $1}' /etc/shadow 2>/dev/null
\`\`\`

## 옮겨 갈 방향

파일 전송 자체를 줄이는 것이 근본이다. 상대가 API 를 제공한다면 그쪽이 안전하다 — 인증이 명확하고, 파일이 남지 않고, 기록이 요청 단위로 남는다. 당장 바꿀 수 없다면 최소한 파일을 암호화해 전송하고, 복호화 키를 다른 경로로 관리한다.

## 참고

- OpenSSH sshd_config(5) — Match, ChrootDirectory, internal-sftp
- NIST SP 800-53 SC-8 Transmission Confidentiality and Integrity
- 개인정보보호법, 개인정보 처리 위탁 시 안전조치`,
    diagram: {
      type: 'matrix',
      caption: '계정 구성',
      x: ['상대별 계정', '공용 계정'],
      y: ['경로 격리', '격리 없음'],
      cells: ['안전', '주체 불명', '타 상대 파일 열람', '내부망 노출'],
    },
    diagram2: {
      type: 'steps',
      caption: '파일 수명',
      steps: [
        { label: '수신', note: '상대는 쓰기만' },
        { label: '처리 대기 이동', note: '상대 접근 차단' },
        { label: '보관', note: '암호화·기간 태그' },
        { label: '파기', note: '기간 경과 자동' },
      ],
    },
  },
  {
    slug: 'bulk-export-risk',
    title: '대량 내보내기 기능의 위험과 상한',
    body: `엑셀 내보내기 버튼은 업무 편의를 위해 만들어지고, 권한 검토에서 자주 빠진다. 화면에서는 한 페이지씩 보이던 데이터가 이 버튼 하나로 전부 파일이 되어 나간다. 내부자에 의한 유출 사고에서 가장 많이 쓰인 경로가 정상 권한으로 실행한 대량 내보내기다.

## 화면 조회와 무엇이 다른가?

| 구분 | 화면 조회 | 내보내기 |
| --- | --- | --- |
| 한 번에 나가는 양 | 수십 건 | 수만~수십만 건 |
| 마스킹 | 적용되는 경우가 많다 | 원본 값이 그대로 |
| 기록 | 조회 이력 남김 | 누락되는 경우가 많다 |
| 이후 통제 | 화면 밖으로 안 나감 | 파일로 자유롭게 이동 |
| 권한 검토 | 메뉴 단위로 검토됨 | 부가 기능으로 취급 |

![화면 조회와 내보내기의 차이](/img/posts/bulk-export-risk.svg)

## 내부자 유출을 어떤 통제로 막는가

기능을 없앨 수는 없으므로 조건을 붙인다. 다섯 가지를 함께 적용하면 실효가 있다.

1. 건수 상한 — 한 번에 내보낼 수 있는 양을 업무 기준으로 제한
2. 일일 누적 상한 — 여러 번 나눠 받는 것을 막는다
3. 별도 권한 — 조회 권한과 내보내기 권한을 분리
4. 승인 절차 — 상한을 넘으면 결재를 거치게 한다
5. 기록과 알림 — 실행 사실을 남기고 관리자에게 알린다

\`\`\`ts
// 상한을 서버에서 판정한다. 화면에서만 막으면 API 직접 호출로 우회된다.
const LIMIT_PER_CALL = 1_000
const LIMIT_PER_DAY  = 5_000

const asked = await countRows(filter)
if (asked > LIMIT_PER_CALL) throw new AppError('한 번에 1,000건까지 내보낼 수 있습니다')
const today = await exportedToday(actor.id)
if (today + asked > LIMIT_PER_DAY) throw new AppError('일일 한도를 초과했습니다')

await audit.log('export', { actor: actor.id, rows: asked, filter, fields: cols })
if (asked > 500) await notify.securityTeam({ actor: actor.id, rows: asked })
\`\`\`

![상한과 승인 흐름](/img/posts/bulk-export-risk-2.svg)

## 파일에 무엇을 담을지 정한다

필요한 열만 담는 것이 가장 효과적인 축소다. 대개 화면에 보이는 모든 열이 파일에 들어가는데, 실제 업무에는 그중 일부만 필요하다. 그리고 파일에 내보낸 사람과 시각을 워터마크로 남기면, 유출 시 출처 추적이 가능해진다.

| 항목 | 방향 |
| --- | --- |
| 열 선택 | 업무에 필요한 것만, 기본값을 좁게 |
| 식별자 | 원본 대신 대체 식별자 |
| 워터마크 | 내보낸 사람·시각·목적 |
| 파일 보호 | 비밀번호 또는 만료 링크 |

## 이상 사용을 어떻게 찾는가

내보내기 기록을 사람 단위로 집계해 평소 범위를 벗어난 경우를 본다. 퇴사 예정자의 내보내기 증가는 특히 눈여겨볼 신호다.

\`\`\`sql
SELECT actor_id, date_trunc('day', at) AS d, count(*) AS runs, sum(rows) AS rows
FROM audit_export
WHERE at > now() - interval '30 days'
GROUP BY 1, 2
HAVING sum(rows) > 10000
ORDER BY rows DESC;
\`\`\`

## 참고

- OWASP — Access Control Cheat Sheet, Logging Cheat Sheet
- 개인정보보호법 시행령, 개인정보 다운로드 통제와 접속기록
- NIST SP 800-53 AC-6, AU-6 Audit Review`,
    diagram: {
      type: 'bars',
      caption: '한 번에 나가는 데이터 양(상대값)',
      unit: '상대값',
      items: [
        { label: '내보내기(무제한)', value: 100 },
        { label: '내보내기(상한 적용)', value: 20 },
        { label: 'API 페이지 조회', value: 8 },
        { label: '화면 조회', value: 2 },
      ],
    },
    diagram2: {
      type: 'flow',
      caption: '요청 처리',
      steps: [
        { label: '건수 산정', note: '서버에서 판정' },
        { label: '상한 검사', note: '회당·일일' },
        { label: '초과 시 승인', note: '결재 경로' },
        { label: '기록과 알림', note: '워터마크 삽입' },
      ],
    },
  },
  {
    slug: 'notification-abuse',
    title: '알림 발송 기능 오용 방지 설계',
    body: `메일이나 문자를 보내는 기능은 남에게 피해를 주는 데 쓰일 수 있다. 비밀번호 재설정 메일을 반복 요청해 특정인의 메일함을 채우거나, 인증번호 발송을 반복해 요금을 발생시키거나, 발송 내용에 임의 문구를 넣어 우리 도메인으로 피싱을 보낸다. 발송 기능은 외부에 영향을 주는 동작이므로 별도 통제가 필요하다.

## 어떤 오용이 실제로 일어나는가?

| 수법 | 피해 |
| --- | --- |
| 재설정 메일 반복 요청 | 대상자 메일함 폭주, 서비스 신뢰 저하 |
| 인증번호 반복 발송 | 문자 요금, 대상자 괴롭힘 |
| 초대 기능 남용 | 우리 도메인으로 스팸 발송 |
| 발송 내용 주입 | 본문에 피싱 링크 삽입 |
| 수신자 목록 조작 | 대량 발송 |
| 발송 결과로 계정 존재 확인 | 계정 목록 수집 |

마지막 항목은 특히 놓치기 쉽다. "등록되지 않은 주소입니다" 와 "메일을 보냈습니다" 를 구분해 응답하면 계정 존재가 노출된다.

![발송 기능 오용 경로](/img/posts/notification-abuse.svg)

## 통제 항목

\`\`\`
대상자 기준 한도    같은 수신자에게 하루 N 통 이내  ← 요청자 기준만으로는 부족
요청자 기준 한도    IP·계정별 시간당 한도
전역 한도           서비스 전체 발송량 상한 + 급증 경보
내용 고정           본문은 서버 템플릿, 사용자 입력은 값으로만
응답 통일           존재 여부와 무관하게 같은 응답
비용 감시           발송 단가 × 건수를 지표로 감시
\`\`\`

대상자 기준 한도가 핵심이다. 요청자 기준만 걸면 공격자가 주소를 바꿔 가며 같은 사람을 계속 괴롭힐 수 있다.

\`\`\`ts
const perTarget = await rate.hit(\`notify:to:\${hash(email)}\`, { limit: 5, window: '1d' })
const perActor  = await rate.hit(\`notify:by:\${clientIp}\`,   { limit: 20, window: '1h' })
if (!perTarget.allowed || !perActor.allowed) return sameResponse()   // 응답은 동일하게
await mailer.send(TEMPLATES.resetPassword, { to: email, link })      // 본문은 템플릿
\`\`\`

![한도 적용 지점](/img/posts/notification-abuse-2.svg)

## 피싱 본문 주입을 어떻게 막는가

사용자가 넣은 이름이 그대로 본문에 들어가면, 줄바꿈과 링크를 섞어 다른 내용을 만들 수 있다. 값으로만 넣고, 헤더에 들어가는 값은 특히 엄격하게 검증한다.

| 자리 | 위험 | 처리 |
| --- | --- | --- |
| 본문 텍스트 | 링크 삽입 | 이스케이프, 링크 자동 변환 금지 |
| 제목 | 줄바꿈 주입 | 개행 제거 |
| 수신자 헤더 | 헤더 주입으로 참조 추가 | 형식 검증, 개행 금지 |
| 회신 주소 | 사칭 | 사용자 입력 금지 |

## 무엇을 감시하는가

발송량과 비용을 지표로 두고 급증을 잡는다. 그리고 반송률과 스팸 신고율을 함께 본다 — 오용이 진행되면 이 수치가 먼저 움직이고, 방치하면 도메인 평판이 떨어져 정상 메일도 도달하지 않게 된다.

\`\`\`bash
# 수신자별 발송 집계 — 한 사람에게 몰린 발송을 찾는다
psql -Atc "SELECT to_hash, count(*) FROM mail_log
           WHERE at > now() - interval '1 day'
           GROUP BY 1 HAVING count(*) > 10 ORDER BY 2 DESC LIMIT 20"
\`\`\`

## 참고

- OWASP — Authentication Cheat Sheet, 계정 열거 방지
- OWASP — Email Header Injection 관련 지침
- NIST SP 800-53 SC-5 Denial-of-Service Protection`,
    diagram: {
      type: 'matrix',
      caption: '한도 기준',
      x: ['대상자 기준 있음', '없음'],
      y: ['요청자 기준 있음', '없음'],
      cells: ['안전', '주소 변경으로 우회', '대상자 보호만', '무제한 오용'],
    },
    diagram2: {
      type: 'layers',
      caption: '통제 계층',
      layers: [
        { label: '요청 단계', note: '한도·응답 통일' },
        { label: '내용 생성', note: '템플릿 고정' },
        { label: '발송 계층', note: '전역 상한' },
        { label: '감시', note: '비용·반송률' },
      ],
    },
  },
  {
    slug: 'async-error-handling',
    title: '비동기 작업 오류 처리와 정보 노출',
    body: `백그라운드 작업이 실패하면 그 내용이 어딘가에 기록된다. 그런데 실패 기록에는 처리하던 데이터가 그대로 들어가는 경우가 많다. 스택 트레이스에 변수값이 붙고, 재시도를 위해 원본 메시지가 저장되고, 오류 추적 도구로 그 전체가 외부 서비스에 전송된다. 결과적으로 통제된 저장소 밖에 개인정보 사본이 생긴다.

## 오류 기록이 어디로 흘러가는가?

| 경로 | 문제 |
| --- | --- |
| 애플리케이션 로그 | 장기 보관, 넓은 조회 권한 |
| 실패 큐 | 원본 메시지 전체 보관 |
| 오류 추적 서비스 | 외부 전송, 국외 이전 가능성 |
| 알림 메시지 | 채팅방에 데이터가 그대로 |
| 재시도 저장소 | 무기한 남는 경우 |

채팅 알림이 특히 위험하다. 참여자 전원이 볼 수 있고 검색되며 보관 기간 통제가 없다.

![오류 정보가 퍼지는 경로](/img/posts/async-error-handling.svg)

## 무엇을 남기고 무엇을 지우는가

오류를 재현하는 데 필요한 것은 데이터 자체가 아니라 데이터의 모양이다. 식별자와 형태만 남기면 조사에 충분하다.

\`\`\`ts
// 나쁜 예 — 처리 대상이 그대로 기록에 들어간다
logger.error('결제 처리 실패', { error: err, payload })

// 나은 예 — 식별자와 형태만
logger.error('결제 처리 실패', {
  code: err.code,
  messageId: payload.messageId,
  actorId: payload.actorId,
  fields: Object.keys(payload),            // 값이 아니라 열 이름만
  amountRange: bucket(payload.amount),     // 값이 필요하면 구간으로
})
\`\`\`

민감 필드 목록을 한곳에 정의하고 기록 직전에 일괄 제거하는 방식이 실수를 줄인다.

\`\`\`ts
const REDACT = /^(password|token|authorization|card|ssn|email|phone|address)$/i
const scrub = (o: unknown): unknown =>
  typeof o !== 'object' || o === null ? o
  : Array.isArray(o) ? o.map(scrub)
  : Object.fromEntries(Object.entries(o).map(([k, v]) =>
      [k, REDACT.test(k) ? '[제거]' : scrub(v)]))
\`\`\`

![기록 전 정제](/img/posts/async-error-handling-2.svg)

## 실패 큐의 보관 기간

실패한 메시지는 조사와 재처리를 위해 남기지만, 무기한 두면 개인정보가 계속 존재한다. 기간을 정하고, 그 안에 처리하지 못한 것은 요약만 남기고 본문을 지운다.

| 단계 | 기간 | 내용 |
| --- | --- | --- |
| 즉시 재시도 | 수 분 | 원본 유지 |
| 실패 큐 | 7~14일 | 원본 유지, 접근 통제 |
| 요약 보관 | 90일 | 식별자와 오류 코드만 |
| 파기 | 이후 | 전량 삭제 |

## 외부 오류 추적 도구를 쓸 때

전송 전 정제가 라이브러리 설정으로 가능한지 확인하고, 그것만 믿지 말고 애플리케이션 단계에서도 제거한다. 그리고 그 도구가 데이터를 어디에 보관하는지 확인해야 한다 — 국외 이전에 해당하면 별도 절차가 필요하다.

\`\`\`bash
# 로그에 민감값이 남는지 표본 점검
grep -hoE '"(password|token|authorization|card|ssn)"\\s*:\\s*"[^"]+' \\
  /var/log/app/*.log 2>/dev/null | sort | uniq -c | head
\`\`\`

## 참고

- OWASP — Logging Cheat Sheet, Error Handling Cheat Sheet
- 개인정보보호법, 개인정보 국외 이전 요건
- NIST SP 800-53 SI-11 Error Handling`,
    diagram: {
      type: 'flow',
      caption: '데이터가 남는 지점',
      steps: [
        { label: '작업 실패', note: '예외 발생' },
        { label: '오류 기록', note: '값이 함께' },
        { label: '실패 큐 저장', note: '원본 보관' },
        { label: '외부 전송·알림', note: '통제 밖 사본', danger: true },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '기록 방식',
      x: ['식별자·형태만', '값 그대로'],
      y: ['보관 기간 있음', '무기한'],
      cells: ['적절', '기간 내 노출', '식별자만 잔존', '사본 누적'],
    },
  },
]
