import type { SeedPost } from './types'

/** 271~280 — 데이터베이스와 데이터 저장소 */
export const posts28: SeedPost[] = [
  {
    slug: 'postgres-row-security',
    title: 'PostgreSQL 행 수준 보안 설계와 한계',
    body: `여러 조직의 데이터를 한 테이블에 담는 구조에서는, 애플리케이션 코드가 조건절을 빠뜨리는 순간 다른 조직의 데이터가 나간다. 행 수준 보안은 그 판정을 데이터베이스로 내린다. 조건절을 잊어도 데이터베이스가 걸러 주므로, 인가 누락이라는 가장 흔한 결함의 마지막 안전망이 된다.

## 애플리케이션 조건절과 무엇이 다른가?

| 구분 | 조건절로만 | 행 수준 보안 |
| --- | --- | --- |
| 누락 시 | 전체 노출 | 정책이 걸러 냄 |
| 새 질의 추가 | 매번 검토 필요 | 자동 적용 |
| 관리 도구 접속 | 통제 밖 | 같은 정책 적용 |
| 배치 작업 | 별도 확인 | 같은 정책 적용 |
| 성능 | 예측 가능 | 계획에 영향 가능 |

![조건절 누락과 정책 적용 경로](/img/posts/postgres-row-security.svg)

## 접근 통제 정책 설계와 적용

세션 변수로 현재 주체를 넘기고 정책이 그것을 참조하는 방식이 일반적이다. 중요한 것은 애플리케이션이 접속하는 역할이 테이블 소유자가 아니어야 한다는 점이다. 소유자는 정책을 우회한다.

\`\`\`sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;   -- 소유자에게도 적용

CREATE POLICY tenant_read ON orders FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_write ON orders FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- 접속 직후 반드시 설정. 커넥션 풀에서는 매 요청마다 다시 설정해야 한다.
SET LOCAL app.tenant_id = '...';
\`\`\`

![세션 변수와 정책 판정](/img/posts/postgres-row-security-2.svg)

## 커넥션 풀에서 생기는 함정

풀은 접속을 재사용한다. SET 으로 설정한 값이 다음 요청까지 남으면 다른 조직의 문맥으로 질의가 나간다. SET LOCAL 을 쓰고 트랜잭션 단위로 감싸는 것이 안전하다. 그리고 값이 비었을 때 정책이 어떻게 동작하는지 반드시 시험한다 — 설정이 빠지면 아무것도 안 보여야 하는데, 조건 작성에 따라 전부 보이는 경우가 있다.

## 무엇을 확인해야 하는가

정책이 켜져 있어도 우회 경로가 남아 있으면 의미가 없다.

\`\`\`sql
-- 정책이 없는 테이블 — 멀티테넌시 대상인데 빠진 것을 찾는다
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;

-- 정책을 우회하는 역할 — BYPASSRLS 와 슈퍼유저
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
WHERE rolsuper OR rolbypassrls;

-- 애플리케이션 역할이 테이블 소유자인지
SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public';
\`\`\`

## 시험 없이는 신뢰하지 않는다

정책은 조용히 실패한다. 조건이 항상 참이 되도록 작성돼 있어도 오류가 나지 않는다. 그래서 테넌트 경계 시험을 자동 테스트로 넣는다 — A 조직 문맥에서 B 조직의 식별자로 조회해 0건이 나오는지 확인하는 테스트를 테이블마다 만든다.

## 참고

- PostgreSQL 문서 — Row Security Policies
- OWASP — Authorization Cheat Sheet
- NIST SP 800-53 AC-3 Access Enforcement`,
    diagram: {
      type: 'matrix',
      caption: '누락 시 결과',
      x: ['정책 있음', '정책 없음'],
      y: ['조건절 있음', '조건절 빠짐'],
      cells: ['안전', '안전', '정책이 차단', '전체 노출'],
    },
    diagram2: {
      type: 'flow',
      caption: '판정 순서',
      steps: [
        { label: '요청 인증', note: '조직 식별' },
        { label: '세션 변수 설정', note: '트랜잭션 단위' },
        { label: '질의 실행', note: '조건절과 무관' },
        { label: '정책 적용', note: '행 단위 필터' },
      ],
    },
  },
  {
    slug: 'mysql-privilege-audit',
    title: 'MySQL 계정 권한 점검과 정리 순서',
    body: `운영 중인 데이터베이스의 계정 목록을 뽑아 보면, 쓰이지 않는 계정과 필요 이상의 권한이 반드시 나온다. 개발 초기에 만든 전권 계정이 그대로 애플리케이션에 쓰이고 있거나, 접속 호스트 제한이 % 로 열려 있는 경우가 흔하다. 권한을 좁히는 작업은 코드 변경 없이 가능한 것부터 하면 위험이 적다.

## 어떤 권한이 특히 위험한가?

| 권한 | 위험 |
| --- | --- |
| GRANT OPTION | 스스로 권한을 늘릴 수 있다 |
| FILE | 서버 파일 읽기·쓰기 |
| SUPER | 대부분의 통제 우회 |
| PROCESS | 다른 세션의 질의 노출 |
| CREATE USER | 계정 생성 |
| SHUTDOWN | 서비스 정지 |
| 전역 ALL PRIVILEGES | 위 전부 포함 |

애플리케이션 계정에 위 권한이 있으면, 애플리케이션 취약점 하나가 데이터베이스 서버 장악으로 확대된다.

![권한 범위와 확대 경로](/img/posts/mysql-privilege-audit.svg)

## 접속 호스트 제한이 먼저다

권한을 좁히는 작업은 애플리케이션 동작에 영향을 준다. 반면 접속 가능한 출발지를 좁히는 것은 대개 영향이 없고 효과가 크다. 여기서부터 시작한다.

\`\`\`
1단계  host 가 '%' 인 계정을 실제 접속 주소로 교체
2단계  쓰지 않는 계정 비활성화 (삭제 전 관찰 기간)
3단계  전역 권한을 스키마·테이블 단위로 축소
4단계  읽기 전용 용도를 별도 계정으로 분리
5단계  관리 계정은 사람별로 발급, 공용 계정 폐지
\`\`\`

![단계별 영향도](/img/posts/mysql-privilege-audit-2.svg)

## 지금 상태를 뽑는 질의

\`\`\`sql
-- 위험 권한 보유 계정
SELECT user, host, Super_priv, File_priv, Process_priv, Create_user_priv, Grant_priv
FROM mysql.user
WHERE Super_priv='Y' OR File_priv='Y' OR Grant_priv='Y' OR Create_user_priv='Y';

-- 어디서든 접속 가능한 계정
SELECT user, host FROM mysql.user WHERE host IN ('%','') ORDER BY user;

-- 최근 쓰이지 않은 계정 (성능 스키마 활성 필요)
SELECT u.user, u.host, MAX(a.EVENT_TIME) AS last_seen
FROM mysql.user u
LEFT JOIN performance_schema.accounts a
  ON a.USER = u.user AND (a.HOST = u.host OR u.host = '%')
GROUP BY u.user, u.host ORDER BY last_seen;

-- 비밀번호가 없거나 만료 정책이 없는 계정
SELECT user, host, plugin, password_expired, password_lifetime
FROM mysql.user WHERE authentication_string = '' OR password_lifetime IS NULL;
\`\`\`

## 최소 권한으로 좁힌 뒤 확인할 것

권한을 줄이면 예상 못 한 기능이 깨진다. 배치 작업과 마이그레이션 도구가 대표적이다. 그래서 축소는 시험 환경에서 한 주기를 돌린 뒤 반영하고, 되돌릴 수 있게 변경 전 권한을 기록해 둔다.

\`\`\`sql
-- 변경 전 기록 — 되돌릴 때 이 결과가 근거가 된다
SELECT CONCAT('SHOW GRANTS FOR ', QUOTE(user), '@', QUOTE(host), ';')
FROM mysql.user WHERE user NOT LIKE 'mysql.%';
\`\`\`

## 참고

- MySQL 문서 — Privileges Provided by MySQL, Account Management
- CIS Benchmark for MySQL
- NIST SP 800-53 AC-6 Least Privilege`,
    diagram: {
      type: 'flow',
      caption: '권한 과다의 결과',
      steps: [
        { label: '애플리케이션 취약점', note: '인젝션 등' },
        { label: '데이터베이스 질의 실행', note: '계정 권한으로' },
        { label: '파일·시스템 권한 사용', note: 'FILE·SUPER' },
        { label: '서버 장악', note: '데이터 넘어서', danger: true },
      ],
    },
    diagram2: {
      type: 'bars',
      caption: '단계별 업무 영향(상대값)',
      unit: '상대값',
      items: [
        { label: '접속 주소 제한', value: 5, note: '영향 적음' },
        { label: '미사용 계정 정리', value: 10 },
        { label: '전역 권한 축소', value: 30 },
        { label: '읽기 전용 분리', value: 25 },
        { label: '공용 계정 폐지', value: 30 },
      ],
    },
  },
  {
    slug: 'redis-exposure',
    title: 'Redis 노출 사고와 접근 통제 설정',
    body: `Redis 는 기본 설정에서 인증이 없고, 오래된 버전은 모든 주소에서 접속을 받는다. 캐시라서 중요하지 않다고 생각하기 쉬운데, 세션 식별자와 인증 토큰이 들어 있는 경우가 많다. 게다가 명령으로 파일을 쓸 수 있어서, 노출된 Redis 는 데이터 유출을 넘어 서버 장악 경로가 된다.

## 노출되면 무엇까지 가능한가?

| 단계 | 가능한 것 |
| --- | --- |
| 조회 | 세션·토큰·캐시된 개인정보 열람 |
| 변조 | 세션 주입으로 다른 사용자 흉내 |
| 삭제 | 전체 데이터 삭제, 서비스 장애 |
| 설정 변경 | 저장 경로 변경 |
| 파일 쓰기 | 인증 키 파일·예약 작업 심기 |
| 모듈 적재 | 임의 코드 실행 |

세션 저장소로 쓰고 있다면 조회 단계만으로도 전 사용자 계정 탈취가 성립한다.

![노출에서 서버 장악까지](/img/posts/redis-exposure.svg)

## 최소 설정 네 가지

\`\`\`
bind 127.0.0.1 ::1              # 필요한 주소만. 사설 대역이라도 명시
protected-mode yes              # 인증 없을 때 외부 접속 거부
requirepass <긴 무작위 값>       # 또는 ACL 사용자 기반 인증
rename-command CONFIG ""        # 설정 변경·모듈 적재 명령 봉쇄
rename-command MODULE ""
\`\`\`

버전 6 이상은 사용자별 ACL 을 쓸 수 있다. 애플리케이션에는 필요한 명령과 키 범위만 허용한다.

\`\`\`
ACL SETUSER app on >비밀값 ~session:* ~cache:* +@read +@write -@dangerous
ACL SETUSER app resetchannels
\`\`\`

![명령 범위 제한](/img/posts/redis-exposure-2.svg)

## 정말 닫혀 있는지 어떻게 확인하는가

설정 파일이 아니라 실제 동작으로 확인한다. 컨테이너 환경에서는 파일과 실행 인자가 다른 경우가 많다.

\`\`\`bash
# 어디에 바인딩되어 있는지 — 0.0.0.0 이면 즉시 조치
ss -tlnp | grep 6379

# 인증 없이 접속되는지 — 외부 대역에서 실행해 본다
redis-cli -h target.example.com ping 2>&1 | head -1        # PONG 이면 문제
redis-cli -h target.example.com --no-auth-warning info keyspace 2>&1 | head -3

# 실행 중 설정값 — 파일과 다를 수 있다
redis-cli config get bind protected-mode requirepass appendonly 2>/dev/null

# 세션·토큰성 키가 들어 있는지 (운영에서는 scan 사용, keys 는 금지)
redis-cli --scan --pattern 'sess*' --count 100 | head
\`\`\`

## 네트워크로도 막는다

애플리케이션 설정은 배포 사고로 바뀔 수 있다. 보안 그룹과 방화벽에서 6379 를 애플리케이션 대역만 허용하고, 인터넷 경로를 아예 없앤다. 관리 목적 접속은 배스천이나 세션 관리 도구를 거치게 한다. 설정과 네트워크 두 겹으로 막아 두면 한쪽이 실수로 열려도 사고가 되지 않는다.

## 참고

- Redis 문서 — Security, ACL
- MITRE ATT&CK — T1190 Exploit Public-Facing Application
- NIST SP 800-53 SC-7 Boundary Protection`,
    diagram: {
      type: 'steps',
      caption: '노출 후 진행',
      steps: [
        { label: '무인증 접속', note: '기본 설정' },
        { label: '세션 키 열람', note: '계정 탈취' },
        { label: '저장 경로 변경', note: 'CONFIG SET' },
        { label: '파일 쓰기·모듈 적재', note: '코드 실행' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '이중 차단',
      x: ['네트워크 제한', '네트워크 개방'],
      y: ['인증 설정', '인증 없음'],
      cells: ['안전', '인증에 의존', '내부 위험만', '즉시 침해'],
    },
  },
  {
    slug: 'mongodb-auth',
    title: 'MongoDB 인증 설정과 역할 분리',
    body: `MongoDB 는 인증을 켜지 않으면 접속한 누구나 전체 데이터베이스를 다룰 수 있다. 개발 편의로 인증 없이 띄운 인스턴스가 그대로 운영에 올라가는 사고가 반복된다. 인증을 켜는 것은 설정 한 줄이지만, 그다음에 역할을 나누지 않으면 애플리케이션 계정이 관리자 권한을 갖는 상태로 남는다.

## 왜 인증만으로는 부족한가?

인증을 켜고 계정 하나를 만들어 root 역할을 주면, 애플리케이션 침해 시 데이터베이스 전체가 넘어간다. 컬렉션 단위로 필요한 동작만 허용해야 피해가 그 범위에 머문다.

| 역할 | 범위 | 용도 |
| --- | --- | --- |
| root | 전체 | 사용 금지에 가깝게 |
| dbOwner | 한 데이터베이스 전체 | 마이그레이션 임시 |
| readWrite | 한 데이터베이스 읽기·쓰기 | 애플리케이션 기본 |
| read | 읽기만 | 분석·리포트 |
| 사용자 정의 역할 | 컬렉션·동작 단위 | 권한 축소 |

![역할 범위와 침해 시 피해](/img/posts/mongodb-auth.svg)

## 접근 통제 설정과 역할 구성

\`\`\`
# 설정 파일
security:
  authorization: enabled
net:
  bindIp: 127.0.0.1,10.0.1.20      # 0.0.0.0 금지
  tls:
    mode: requireTLS
\`\`\`

\`\`\`js
// 컬렉션과 동작을 좁힌 사용자 정의 역할
db.createRole({
  role: 'appOrders',
  privileges: [
    { resource: { db: 'shop', collection: 'orders' }, actions: ['find', 'insert', 'update'] },
    { resource: { db: 'shop', collection: 'items' },  actions: ['find'] },
  ],
  roles: [],
})
db.createUser({ user: 'app', pwd: passwordPrompt(), roles: ['appOrders'] })
\`\`\`

![권한 구성 방향](/img/posts/mongodb-auth-2.svg)

## 점검 질의

\`\`\`js
// 인증이 켜져 있는지, 어디에 바인딩됐는지
db.adminCommand({ getParameter: 1, authenticationMechanisms: 1 })
db.adminCommand({ getCmdLineOpts: 1 }).parsed

// 광범위 역할 보유 계정
db.getSiblingDB('admin').system.users.find(
  { 'roles.role': { $in: ['root', 'dbOwner', 'userAdminAnyDatabase', 'readWriteAnyDatabase'] } },
  { user: 1, db: 1, roles: 1 },
)

// 인증 실패·성공 감사 설정 여부
db.adminCommand({ getParameter: 1, auditAuthorizationSuccess: 1 })
\`\`\`

## 이미 노출됐다면 무엇을 확인하는가

인증 없이 열려 있던 기간이 있다면 데이터가 이미 복제됐을 가능성을 전제로 한다. 접속 기록에서 낯선 주소를 찾고, 삭제된 컬렉션과 남겨진 안내 문서를 확인한다. 노출된 데이터에 개인정보가 있으면 유출 신고 요건을 검토해야 한다. 그리고 같은 구성으로 만든 다른 인스턴스가 있는지 함께 본다 — 한 곳이 열려 있으면 대개 여러 곳이 열려 있다.

## 참고

- MongoDB 문서 — Security Checklist, Role-Based Access Control
- CIS Benchmark for MongoDB
- 개인정보보호법 유출 통지·신고 기준`,
    diagram: {
      type: 'layers',
      caption: '권한 축소 단계',
      layers: [
        { label: '인증 활성화', note: '첫 관문' },
        { label: '데이터베이스 단위 역할', note: 'readWrite' },
        { label: '컬렉션·동작 단위', note: '사용자 정의 역할' },
        { label: '네트워크 제한', note: '바인딩·방화벽' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '침해 시 피해 범위',
      x: ['역할 축소', 'root 사용'],
      y: ['인증 켜짐', '인증 없음'],
      cells: ['그 컬렉션', '전체 데이터베이스', '전체', '전체 + 조작'],
    },
  },
  {
    slug: 'elasticsearch-exposure',
    title: 'Elasticsearch 색인 노출 막는 방법',
    body: `검색 엔진에는 원본 데이터가 평문으로 복제되어 들어간다. 데이터베이스에는 암호화와 접근 통제를 걸어 두고, 같은 데이터가 담긴 색인은 인증 없이 열어 두는 경우가 많다. 로그 분석용으로 띄운 인스턴스에 개인정보가 그대로 들어가 있는 상황도 흔하다. 색인은 데이터베이스와 같은 등급으로 다뤄야 한다.

## 색인에 무엇이 들어가는가?

| 유입 경로 | 흔히 섞이는 것 |
| --- | --- |
| 애플리케이션 로그 | 요청 본문, 토큰, 개인정보 |
| 검색용 색인 | 이름·연락처·주소 |
| 오류 추적 | 스택 트레이스와 변수값 |
| 감사 로그 | 계정 식별자 |
| 데이터 동기화 | 원본 테이블 전체 |

데이터 분류 기준을 색인에도 적용해, 어떤 등급의 데이터가 어느 색인에 들어가는지 목록을 만드는 것이 출발점이다.

![데이터가 색인으로 복제되는 경로](/img/posts/elasticsearch-exposure.svg)

## 최소 통제 항목

\`\`\`yaml
# 보안 기능 활성화와 전송 구간 암호화
xpack.security.enabled: true
xpack.security.http.ssl.enabled: true
xpack.security.transport.ssl.enabled: true
network.host: 10.0.1.20          # 0.0.0.0 금지
# 위험한 기능 차단
action.destructive_requires_name: true
script.allowed_types: none        # 스크립트 실행 불필요하면 끈다
\`\`\`

역할은 색인 패턴과 문서 조건까지 좁힐 수 있다. 부서별 대시보드에는 문서 수준 조건을 걸어 다른 부서 로그가 보이지 않게 한다.

\`\`\`json
{
  "indices": [{
    "names": ["logs-web-*"],
    "privileges": ["read"],
    "query": { "term": { "team": "web" } },
    "field_security": { "grant": ["*"], "except": ["req.headers.authorization", "user.email"] }
  }]
}
\`\`\`

![역할·문서·필드 단위 제한](/img/posts/elasticsearch-exposure-2.svg)

## 지금 열려 있는지 확인한다

\`\`\`bash
# 인증 없이 응답하는지 — 색인 목록이 나오면 즉시 조치
curl -s --max-time 5 'http://target.example.com:9200/_cat/indices?v' | head

# 보안 기능 상태와 전송 암호화
curl -s -u "$ES_USER:$ES_PASS" 'https://es.example.com:9200/_xpack?filter_path=features.security' 

# 색인별 문서 수와 크기 — 예상 밖 색인을 찾는다
curl -s -u "$ES_USER:$ES_PASS" 'https://es.example.com:9200/_cat/indices?v&s=store.size:desc' | head -20

# 민감 필드가 색인에 있는지 매핑에서 확인
curl -s -u "$ES_USER:$ES_PASS" 'https://es.example.com:9200/logs-*/_mapping' |
  python3 -c 'import sys,json,re; d=json.load(sys.stdin);
print("\\n".join(sorted({f for v in d.values() for f in json.dumps(v) .split(chr(34)) if re.match(r"^(password|token|authorization|ssn|card|email|phone)", f, re.I)})))'
\`\`\`

## 색인 단계에서 걸러 내는 것이 근본 해법

권한으로 가리는 것은 이미 들어온 데이터를 감추는 일이다. 수집 파이프라인에서 민감 필드를 제거하거나 마스킹하면 색인에 아예 남지 않는다. 그리고 보유 기간을 색인 수명 정책으로 정해, 오래된 색인이 자동으로 삭제되게 한다. 로그를 무기한 쌓아 두는 것은 비용 문제이기도 하고 유출 시 피해 규모의 문제이기도 하다.

## 참고

- Elastic 문서 — Secure the Elastic Stack, Field and document level security
- OWASP — Logging Cheat Sheet
- 개인정보보호법, 개인정보 보유 기간과 파기`,
    diagram: {
      type: 'flow',
      caption: '데이터 복제 경로',
      steps: [
        { label: '원본 데이터베이스', note: '통제 있음' },
        { label: '수집 파이프라인', note: '여기서 걸러야 한다' },
        { label: '검색 색인', note: '평문 저장' },
        { label: '대시보드 공유', note: '통제 밖 확산', danger: true },
      ],
    },
    diagram2: {
      type: 'layers',
      caption: '통제 지점',
      layers: [
        { label: '수집 단계 제거', note: '근본 해법' },
        { label: '필드 수준 제한', note: '민감 필드 제외' },
        { label: '문서 수준 조건', note: '팀별 분리' },
        { label: '수명 정책', note: '보유 기간 강제' },
      ],
    },
  },
  {
    slug: 'db-audit-log',
    title: '데이터베이스 감사 로그 설계 기준',
    body: `개인정보를 다루는 시스템은 누가 어떤 데이터를 조회했는지 남겨야 한다. 그런데 전체 질의를 다 남기면 로그가 원본 데이터만큼 커지고, 질의문에 개인정보가 그대로 들어가 로그 자체가 유출 대상이 된다. 무엇을 남기고 무엇을 남기지 않을지 정하는 것이 설계의 핵심이다.

## 무엇을 남겨야 조사와 규정을 함께 만족하는가?

| 항목 | 남기는 이유 |
| --- | --- |
| 접속 주체와 출발지 | 누가 어디서 |
| 접속·종료 시각 | 기간 특정 |
| 대상 테이블과 동작 | 무엇을 했는지 |
| 영향 행 수 | 대량 조회 판단 |
| 질의 식별자 | 애플리케이션 추적과 연결 |
| 실패한 접근 | 시도 자체가 신호 |

질의문 전체보다 위 항목이 조사에 더 쓸모 있다. 대량 조회 판단에는 영향 행 수가 결정적이다.

![남길 항목과 조사 활용](/img/posts/db-audit-log.svg)

## 어디에서 남길 것인가

| 위치 | 장점 | 한계 |
| --- | --- | --- |
| 애플리케이션 | 사용자 문맥이 있다 | 직접 접속을 못 잡는다 |
| 데이터베이스 감사 기능 | 모든 접속을 잡는다 | 사용자 문맥이 없다 |
| 프록시·게이트웨이 | 중앙 집중 | 우회 경로가 남을 수 있다 |

한쪽만으로는 부족하다. 애플리케이션에서 사용자 문맥을 남기고, 데이터베이스에서 직접 접속을 잡는 조합이 실무적이다. 두 로그를 잇는 열쇠로 추적 id 를 질의 주석에 넣는 방법이 널리 쓰인다.

\`\`\`sql
-- 애플리케이션이 붙이는 주석. 데이터베이스 로그에도 남아 두 로그가 이어진다.
SELECT /* trace=7f3a9c user=1042 */ id, name FROM customers WHERE id = ?;
\`\`\`

![두 로그를 잇는 방법](/img/posts/db-audit-log-2.svg)

## 로그 자체를 보호한다

감사 로그에는 조회 대상의 식별자가 남는다. 로그를 데이터베이스 관리자가 지울 수 있으면 감사 의미가 없다. 세 가지를 함께 둔다.

1. 로그를 그 데이터베이스 밖으로 즉시 전송한다
2. 전송된 로그는 추가만 가능한 저장소에 둔다
3. 로그 조회 권한을 데이터베이스 운영과 분리한다

## 설정과 누락을 어떻게 점검하는가

\`\`\`sql
-- PostgreSQL: 무엇이 기록되는지
SHOW log_statement; SHOW log_min_duration_statement; SHOW log_connections;
SELECT name, setting FROM pg_settings WHERE name LIKE 'pgaudit%';

-- MySQL: 감사 플러그인 상태와 일반 로그
SELECT PLUGIN_NAME, PLUGIN_STATUS FROM information_schema.PLUGINS
WHERE PLUGIN_NAME LIKE '%audit%';
SHOW VARIABLES LIKE 'general_log%';
\`\`\`

\`\`\`bash
# 대량 조회 탐지 — 하루 조회 상한을 넘긴 계정을 뽑는 예
awk '/SELECT/ && /rows=/ {match($0,/rows=([0-9]+)/,m); s[$5]+=m[1]}
     END {for (u in s) if (s[u] > 100000) print u, s[u]}' /var/log/postgresql/*.log
\`\`\`

## 참고

- pgaudit 프로젝트 문서, MySQL Enterprise Audit
- 개인정보보호법 시행령, 접속기록 보관과 점검
- NIST SP 800-53 AU-2 Event Logging, AU-9 Protection of Audit Information`,
    diagram: {
      type: 'layers',
      caption: '기록 위치',
      layers: [
        { label: '애플리케이션', note: '사용자 문맥' },
        { label: '데이터베이스', note: '직접 접속 포함' },
        { label: '외부 저장소', note: '추가만 가능' },
        { label: '조회 권한 분리', note: '운영과 분리' },
      ],
    },
    diagram2: {
      type: 'flow',
      caption: '두 로그 연결',
      steps: [
        { label: '요청에 추적 id 부여', note: '진입점' },
        { label: '질의 주석에 삽입', note: 'trace=…' },
        { label: '양쪽 로그에 기록', note: '앱·DB' },
        { label: '조사 시 결합', note: '사용자까지 추적' },
      ],
    },
  },
  {
    slug: 'connection-pool-rotation',
    title: '커넥션 풀과 자격 증명 회전 설계',
    body: `데이터베이스 비밀번호를 바꾸기로 정해도 실제로는 미뤄진다. 바꾸면 애플리케이션이 접속하지 못하고, 재배포 없이 반영할 방법이 없기 때문이다. 그래서 몇 년 된 비밀번호가 그대로 남는다. 회전을 전제로 설계하면 이 문제가 사라진다 — 무중단으로 바꿀 수 있는 구조를 먼저 만드는 것이 순서다.

## 왜 회전이 미뤄지는가?

| 원인 | 결과 |
| --- | --- |
| 설정 파일에 값이 박혀 있다 | 재배포 필요 |
| 여러 서비스가 같은 계정을 쓴다 | 동시 교체 필요 |
| 풀이 접속을 오래 유지한다 | 언제 반영되는지 불명 |
| 배치·수동 작업이 같은 값을 쓴다 | 누락 발생 |
| 실패 시 되돌릴 방법이 없다 | 시도 자체를 피한다 |

![회전이 막히는 지점](/img/posts/connection-pool-rotation.svg)

## 두 개의 자격 증명을 번갈아 쓴다

계정을 하나 더 만들어 번갈아 교체하면 어느 순간에도 유효한 값이 두 개 있다. 교체 중 접속 실패 구간이 사라진다.

\`\`\`
현재 app_a 사용 중
1. app_b 비밀번호를 새로 만든다              (app_a 는 그대로 유효)
2. 비밀 저장소의 '현재' 포인터를 app_b 로 옮긴다
3. 애플리케이션이 새 접속부터 app_b 를 쓴다   (기존 접속은 유지)
4. 기존 접속이 모두 재생성될 때까지 기다린다
5. app_a 비밀번호를 무작위로 바꿔 무효화한다
\`\`\`

![번갈아 교체](/img/posts/connection-pool-rotation-2.svg)

## 풀 설정이 회전 속도를 정한다

접속을 무한정 유지하는 설정이면 새 자격 증명이 언제 반영되는지 알 수 없다. 최대 수명을 정해 두면 그 시간 안에 전부 새 접속으로 교체된다.

| 설정 | 권장 방향 |
| --- | --- |
| 최대 수명 | 30~60분 — 회전 반영 시간의 상한 |
| 유휴 제거 시간 | 10분 내외 |
| 획득 대기 시간 | 짧게 — 장애 시 빠른 실패 |
| 검증 질의 | 가볍게, 실패 시 접속 폐기 |

\`\`\`ts
// 자격 증명을 매 접속 시점에 읽어 온다. 시작 시 한 번만 읽으면 회전이 반영되지 않는다.
const pool = new Pool({
  maxLifetimeSeconds: 1800,
  idleTimeoutMillis: 600_000,
  connectionTimeoutMillis: 3_000,
  password: async () => (await secrets.get('db/current')).password,
})
\`\`\`

## 임시 자격 증명이 더 나은 선택인 경우

비밀 관리 도구가 요청 시점에 짧은 수명의 계정을 만들어 주는 방식을 쓰면 회전이라는 작업 자체가 없어진다. 유출된 값도 곧 만료되므로 사고 대응도 단순해진다. 클라우드 환경에서는 역할 기반 접속을 쓰면 비밀번호가 아예 필요 없다.

\`\`\`bash
# 회전이 실제로 되고 있는지 — 마지막 변경 시각을 본다
psql -Atc "SELECT rolname, rolvaliduntil FROM pg_roles WHERE rolcanlogin ORDER BY 2"
# 오래 유지된 접속 — 최대 수명 설정이 없다는 신호
psql -Atc "SELECT usename, count(*), min(backend_start) FROM pg_stat_activity GROUP BY 1"
\`\`\`

## 참고

- HashiCorp Vault — Database Secrets Engine, 동적 자격 증명
- AWS 문서 — Secrets Manager 회전, IAM 데이터베이스 인증
- NIST SP 800-53 IA-5 Authenticator Management`,
    diagram: {
      type: 'matrix',
      caption: '회전 가능성',
      x: ['저장소에서 조회', '설정 파일에 박음'],
      y: ['접속 수명 제한', '수명 무제한'],
      cells: ['무중단 회전', '재배포 필요', '반영 시점 불명', '사실상 불가'],
    },
    diagram2: {
      type: 'steps',
      caption: '번갈아 교체 절차',
      steps: [
        { label: '두 번째 계정 갱신', note: '첫 계정 유효' },
        { label: '포인터 전환', note: '새 접속부터 적용' },
        { label: '접속 재생성 대기', note: '최대 수명만큼' },
        { label: '이전 계정 무효화', note: '유출 시 피해 차단' },
      ],
    },
  },
  {
    slug: 'stored-procedure-injection',
    title: '저장 프로시저와 SQL 인젝션 오해',
    body: `저장 프로시저를 쓰면 SQL 인젝션이 막힌다는 말이 오래 돌았다. 사실이 아니다. 프로시저 안에서 문자열을 이어 붙여 동적 질의를 실행하면 그 지점이 그대로 인젝션 취약점이 된다. 오히려 애플리케이션 코드 검사 도구가 프로시저 내부를 못 보기 때문에, 발견되지 않은 채 오래 남는다.

## 어떤 경우에 취약해지는가?

| 구현 방식 | 안전성 |
| --- | --- |
| 매개변수를 조건절에 그대로 사용 | 안전 |
| 매개변수를 문자열로 이어 붙여 실행 | 취약 |
| 테이블·컬럼 이름을 매개변수로 받아 조합 | 취약 |
| ORDER BY 절을 문자열로 조합 | 취약 |
| 동적 질의 + 매개변수 바인딩 | 안전 |

바인딩할 수 없는 자리, 즉 식별자와 정렬 기준을 다룰 때 문제가 생긴다. 그 자리는 값이 아니라 코드이기 때문이다.

![안전한 구현과 취약한 구현](/img/posts/stored-procedure-injection.svg)

## 취약한 예와 고친 예

\`\`\`sql
-- 취약: 정렬 기준을 이어 붙인다
CREATE PROCEDURE list_orders(IN sort_col VARCHAR(64))
BEGIN
  SET @q = CONCAT('SELECT * FROM orders ORDER BY ', sort_col);
  PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
END

-- 고침: 허용 목록으로 코드 조각을 고정한다
CREATE PROCEDURE list_orders(IN sort_key VARCHAR(16))
BEGIN
  SET @col = CASE sort_key
    WHEN 'date'   THEN 'created_at'
    WHEN 'amount' THEN 'total_amount'
    ELSE 'id' END;                       -- 입력이 코드가 되지 않는다
  SET @q = CONCAT('SELECT * FROM orders ORDER BY ', @col);
  PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
END
\`\`\`

동적 질의를 아예 안 쓰는 것이 가장 좋고, 써야 한다면 조합되는 부분을 허용 목록으로 고정한다.

![입력이 코드가 되는 자리](/img/posts/stored-procedure-injection-2.svg)

## 실행 권한 설정이 피해 범위를 정한다

프로시저를 정의자 권한으로 실행하면 호출자가 갖지 않은 권한으로 동작한다. 편리하지만 인젝션이 성립했을 때 피해가 그 권한만큼 커진다. 필요한 경우에만 쓰고, 그때는 프로시저 내부 검증을 더 엄격하게 한다.

## 어떻게 찾아내는가

프로시저 정의문을 데이터베이스에서 직접 뽑아 검사한다. 소스 저장소에만 있는 것을 검사하면 실제 운영에 배포된 것과 다를 수 있다.

\`\`\`sql
-- PostgreSQL: 동적 실행이 들어간 함수
SELECT n.nspname, p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND p.prosrc ~* '\\mEXECUTE\\M' AND p.prosrc ~ '\\|\\||format\\(|CONCAT';

-- MySQL: 문자열 조합이 들어간 루틴
SELECT ROUTINE_SCHEMA, ROUTINE_NAME
FROM information_schema.ROUTINES
WHERE ROUTINE_DEFINITION REGEXP 'PREPARE|CONCAT'
  AND ROUTINE_SCHEMA NOT IN ('sys','mysql');
\`\`\`

## 참고

- OWASP — SQL Injection Prevention Cheat Sheet
- CWE-89 SQL Injection in Stored Procedures
- PostgreSQL 문서 — quote_ident, format 함수`,
    diagram: {
      type: 'matrix',
      caption: '구현 방식과 위험',
      x: ['바인딩 사용', '문자열 조합'],
      y: ['값만 다룸', '식별자·정렬 다룸'],
      cells: ['안전', '취약', '허용 목록 필요', '취약'],
    },
    diagram2: {
      type: 'flow',
      caption: '입력이 코드가 되는 경로',
      steps: [
        { label: '사용자 입력', note: '정렬 기준·컬럼명' },
        { label: '문자열 조합', note: 'CONCAT' },
        { label: '동적 실행', note: 'PREPARE·EXECUTE' },
        { label: '질의 구조 변경', note: '인젝션 성립', danger: true },
      ],
    },
  },
  {
    slug: 'read-replica-access',
    title: '읽기 전용 복제본 접근 통제 설계',
    body: `분석과 리포트 때문에 읽기 전용 복제본을 만들고, 여러 부서에 접속을 열어 준다. 쓰기가 안 되니 안전하다고 보기 쉬운데, 복제본에는 원본과 똑같은 데이터가 들어 있다. 원본에 걸어 둔 통제가 복제본에는 없는 경우가 많아서, 우회 경로가 되기 쉽다.

## 원본과 복제본의 통제 차이

| 통제 | 원본 | 복제본에서 흔히 빠지는 것 |
| --- | --- | --- |
| 접근 권한 | 최소 권한 | 부서 공용 계정 |
| 마스킹 | 조회 화면에서 처리 | 원본 값 그대로 |
| 조회 상한 | 애플리케이션에서 제한 | 제한 없음 |
| 접속기록 | 남긴다 | 설정 누락 |
| 네트워크 | 애플리케이션 대역만 | 사무실 전체 허용 |

복제본은 원본과 같은 데이터 등급이므로 같은 통제를 걸어야 한다. 편의를 위해 만든 통로가 가장 넓은 문이 되는 상황이 흔하다.

![원본과 복제본의 통제 격차](/img/posts/read-replica-access.svg)

## 어떻게 설계하는가

용도를 나누고 용도별로 다른 것을 제공하는 방식이 실무적이다.

\`\`\`
운영 복제본     애플리케이션 읽기 분산용. 사람 접속 금지
분석 복제본     가명처리·마스킹 적용 후 복제. 부서 접속 허용
추출 요청       원본 접근이 꼭 필요한 경우, 승인 후 한시 계정
\`\`\`

분석 복제본을 만들 때 민감 컬럼을 변환해 넣으면, 그 뒤의 권한 관리 부담이 크게 줄어든다. 권한으로 가리는 것보다 데이터를 아예 다르게 만드는 것이 확실하다.

![용도별 분리](/img/posts/read-replica-access-2.svg)

## 읽기 전용이라도 남는 위험

| 위험 | 설명 |
| --- | --- |
| 대량 추출 | 전체 테이블 내려받기 |
| 재식별 | 여러 테이블 결합으로 개인 특정 |
| 자원 고갈 | 무거운 질의로 복제 지연·장애 |
| 반출 | 결과를 파일로 저장해 외부 이동 |

조회 상한과 질의 시간 제한을 걸고, 대량 조회를 경보로 잡는다.

\`\`\`sql
-- 계정별 자원 제한 (PostgreSQL)
ALTER ROLE analyst SET statement_timeout = '60s';
ALTER ROLE analyst SET temp_file_limit = '1GB';
ALTER ROLE analyst SET default_transaction_read_only = on;

-- 복제본에서 남는 접속과 조회 이력 확인
SELECT usename, client_addr, state, query_start,
       left(query, 80) AS q
FROM pg_stat_activity WHERE usename <> 'app' ORDER BY query_start;
\`\`\`

## 점검 항목

복제본이 몇 개 있고 누가 접속할 수 있는지부터 센다. 대개 목록이 없다. 클라우드 콘솔에서 인스턴스를 뽑아 원본과 대조하고, 각 복제본의 접속 허용 대역과 계정을 확인한다. 목록에 없는 복제본, 즉 누군가 임시로 만들어 남겨 둔 것이 가장 위험하다.

## 참고

- PostgreSQL 문서 — Hot Standby, 역할별 설정
- 개인정보보호법 시행령, 접속기록과 안전조치
- NIST SP 800-53 AC-6 Least Privilege, SC-28 Protection of Information at Rest`,
    diagram: {
      type: 'matrix',
      caption: '통제 일치 여부',
      x: ['같은 통제 적용', '통제 누락'],
      y: ['원본', '복제본'],
      cells: ['정상', '해당 없음', '정상', '우회 경로'],
    },
    diagram2: {
      type: 'layers',
      caption: '용도별 제공',
      layers: [
        { label: '운영 복제본', note: '애플리케이션만' },
        { label: '분석 복제본', note: '가명처리 후' },
        { label: '한시 추출', note: '승인·기록' },
      ],
    },
  },
  {
    slug: 'migration-exposure',
    title: '데이터 마이그레이션 중 노출 막기',
    body: `데이터를 옮기는 작업은 짧고 예외적이라는 이유로 통제 밖에서 진행된다. 덤프 파일이 개인 노트북에 남고, 임시로 열어 둔 네트워크 경로가 그대로 남고, 전권 계정이 작업용으로 만들어졌다가 잊힌다. 침해 조사에서 원인으로 자주 지목되는 것이 이 임시 작업의 잔여물이다.

## 개인정보가 어떤 잔여물로 남는가?

| 잔여물 | 위험 |
| --- | --- |
| 덤프 파일 | 평문 개인정보가 파일로 존재 |
| 임시 전권 계정 | 회수되지 않으면 상시 통로 |
| 열어 둔 방화벽 규칙 | 만료 없이 유지 |
| 작업용 버킷 | 공개 설정으로 남는 경우 |
| 스크립트 내 접속 정보 | 저장소에 커밋됨 |
| 로그에 남은 질의 | 데이터가 로그로 복제 |

![임시 작업이 남기는 것](/img/posts/migration-exposure.svg)

## 시작 전에 정하는 다섯 가지

작업 계획에 아래를 미리 적어 두면 대부분 예방된다. 작업이 끝난 뒤 정리하려 하면 반드시 빠진다. 마이그레이션은 대개 주말이나 야간에 몰려서, 끝난 뒤에는 정리보다 휴식이 앞선다. 그래서 정리 항목은 작업 계획서의 마지막 단계가 아니라 별도 점검표로 만들어 다음 근무일에 확인하는 편이 낫다.

1. 덤프를 어디에 두고 언제 지울지 — 경로와 삭제 시각을 먼저 정한다
2. 작업 계정의 권한 범위와 만료 시각
3. 열 네트워크 경로와 닫을 시각
4. 데이터를 옮기는 동안의 암호화 방식
5. 작업 후 확인할 점검 목록과 담당자

![작업 전후 통제](/img/posts/migration-exposure-2.svg)

## 옮기는 동안의 보호

가능하면 파일을 만들지 않고 직접 전송한다. 파일이 생기면 그 파일의 수명 관리가 새 과제가 된다.

\`\`\`bash
# 파일을 남기지 않고 옮긴다 (중간 저장 없음)
pg_dump -h old.example.com -U migrate --no-owner shop |
  psql -h new.example.com -U migrate shop

# 파일이 필요하면 만들 때 암호화하고, 복호화 키는 별도 경로로 전달
pg_dump -h old.example.com -U migrate shop |
  age -r "$RECIPIENT_PUBKEY" > shop-$(date +%F).sql.age

# 임시 파일 흔적 확인 — 작업 후 반드시 실행
find / -xdev \\( -name '*.sql' -o -name '*.dump' -o -name '*.csv' \\) \\
  -newermt '-7 days' -size +10M 2>/dev/null | head -20
\`\`\`

## 작업이 끝난 뒤 점검

정리 목록을 확인 가능한 명령으로 만들어 두면 누락이 드러난다. 사람이 기억으로 확인하는 항목은 빠지고, 명령으로 확인하는 항목은 빠지지 않는다. 아래 세 가지는 대부분의 마이그레이션에서 공통으로 남는 것이라 그대로 재사용할 수 있다.

\`\`\`bash
# 남은 작업 계정
psql -Atc "SELECT rolname, rolvaliduntil FROM pg_roles
           WHERE rolname LIKE '%migrate%' OR rolname LIKE '%temp%'"

# 만료 없이 열린 규칙 — 태그로 작업 규칙을 표시해 두면 이렇게 찾을 수 있다
aws ec2 describe-security-groups \\
  --query "SecurityGroups[].IpPermissions[?contains(to_string(@),'0.0.0.0/0')]" | head -20

# 작업용 버킷의 공개 설정
aws s3api get-public-access-block --bucket migration-temp-2026 2>&1 | head -5
\`\`\`

## 참고

- NIST SP 800-88, 매체 정보 파기 지침
- OWASP — Sensitive Data Exposure 관련 지침
- 개인정보보호법, 개인정보 처리 위탁과 안전조치`,
    diagram: {
      type: 'flow',
      caption: '작업 흐름과 위험 지점',
      steps: [
        { label: '임시 계정 발급', note: '만료 지정 필요' },
        { label: '경로 개방', note: '닫을 시각 지정' },
        { label: '데이터 이동', note: '파일 없이 또는 암호화' },
        { label: '정리 확인', note: '목록 기반 점검' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '계획 유무의 차이',
      x: ['만료·삭제 계획 있음', '계획 없음'],
      y: ['파일 생성 없음', '파일 생성'],
      cells: ['잔여물 없음', '경로 잔존', '수명 관리됨', '평문 파일 잔존'],
    },
  },
]
