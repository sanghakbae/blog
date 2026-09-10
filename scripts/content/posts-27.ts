import type { SeedPost } from './types'

/** 261~270 — 리눅스 서버와 업무 단말 하드닝 */
export const posts27: SeedPost[] = [
  {
    slug: 'linux-hardening-order',
    title: '리눅스 서버 하드닝 점검 순서',
    body: `하드닝 문서는 대개 항목이 수백 개다. 전부 적용하려다 지쳐서 아무것도 안 하는 경우가 많다. 실제로 침해를 막는 것은 그중 소수이고, 나머지는 이미 배포판 기본값이 안전하거나 위험이 이론적이다. 효과가 큰 순서로 정렬해 위에서부터 처리하는 것이 현실적이다.

## 공격 표면을 무엇부터 줄여야 하는가?

| 순서 | 항목 | 막는 것 |
| --- | --- | --- |
| 1 | 열린 포트 정리 | 최초 침입 경로 |
| 2 | 원격 접속 인증 강화 | 대입 공격 |
| 3 | 패치 자동 적용 | 알려진 취약점 |
| 4 | sudo 권한 축소 | 권한 상승 |
| 5 | 불필요 서비스 제거 | 공격 표면 |
| 6 | 감사 로그 수집 | 조사 가능성 |
| 7 | 파일 권한 정리 | 정보 노출 |
| 8 | 커널 파라미터 | 남은 기법 |

위 세 개만 처리해도 실제 침해 시도의 대부분이 막힌다. 8번은 앞의 것이 끝난 뒤에 해도 늦지 않다.

![항목별 효과와 작업량](/img/posts/linux-hardening-order.svg)

## 지금 상태를 한 번에 뽑는다

문서를 읽기 전에 현재 상태를 확인한다. 대개 예상과 다르다.

\`\`\`bash
# 실제로 듣고 있는 포트와 그 프로세스 — 0.0.0.0 바인딩이 위험 대상
ss -tulpnH | awk '{print $1, $5, $7}' | sort -u

# 최근 로그인 실패 상위 주소 — 대입 공격을 받고 있는지
journalctl -u ssh --since '7 days ago' 2>/dev/null | grep -oE 'from [0-9.]+' |
  sort | uniq -c | sort -rn | head

# 적용되지 않은 보안 업데이트 수
{ apt-get -s upgrade 2>/dev/null | grep -c '^Inst.*security' ||
  dnf updateinfo list security 2>/dev/null | wc -l; } | head -1

# setuid 실행 파일 — 배포판 기본 외에 있으면 확인 대상
find / -xdev -perm -4000 -type f 2>/dev/null | sort
\`\`\`

## 기준선은 도구로 재고 사람이 판단한다

CIS 기준선 점검 도구를 돌리면 수백 개 항목의 통과 여부가 나온다. 그 결과를 그대로 다 고치려 하지 말고, 세 부류로 나눈다.

\`\`\`
적용    업무 영향 없고 효과 있음        → 바로 반영, 구성 관리로 고정
예외    업무가 깨짐                     → 이유와 만료일을 기록
무시    이 환경에 해당 없음             → 판단 근거만 남긴다
\`\`\`

![점검 결과 분류](/img/posts/linux-hardening-order-2.svg)

## 한 번 맞춘 설정을 어떻게 유지하는가

손으로 고친 설정은 장비를 다시 만들면 사라진다. 구성 관리 도구나 이미지 빌드 과정에 넣어야 유지된다. 그리고 분기마다 점검 도구를 다시 돌려 드리프트를 확인한다. 하드닝은 한 번의 작업이 아니라 상태를 지키는 일이다.

## 실제로 이렇게 터진다

강화 스크립트를 운영 서버에 한 번에 적용한 사례가 있다. 수백 개 설정이 동시에 바뀌었고 서비스가 멈췄다. 어느 항목 때문인지 찾지 못해 전부 되돌렸다.

또 하나는 강화는 했지만 패치를 안 한 경우다. 설정 점검은 통과했고 알려진 취약점으로 침해됐다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 체크리스트를 다 통과하면 안전하다 | 패치와 노출 관리가 먼저다 |
| 한 번에 적용하면 효율적이다 | 원인 추적이 불가능해진다 |
| 기준 문서를 그대로 쓴다 | 환경에 맞는 예외가 있다 |
| 강화하면 성능이 떨어진다 | 대부분 영향이 없다 |
| 설정만 하면 유지된다 | 표류를 감시해야 한다 |

## 효과 순서

| 순위 | 항목 | 이유 |
| --- | --- | --- |
| 1 | 패치 최신화 | 알려진 취약점이 가장 흔한 경로 |
| 2 | 불필요 서비스 제거 | 공격면 자체를 줄인다 |
| 3 | 네트워크 노출 최소화 | 도달할 수 없으면 공격 못 한다 |
| 4 | 계정·권한 정리 | 침해 후 확산 차단 |
| 5 | 인증 강화 | 키 기반, 다중 인증 |
| 6 | 로그·감사 | 탐지와 조사 |
| 7 | 커널·파일시스템 옵션 | 잔여 위험 감소 |

위에서부터 한다. 7번을 먼저 하고 1번을 안 하는 경우가 실제로 많다.

## 적용 방법

1. 시험 장비에 적용한다
2. 항목을 그룹으로 나눠 순차 적용한다
3. 각 그룹 적용 후 서비스 동작을 확인한다
4. 예외를 사유와 함께 기록한다
5. 구성 관리 도구로 코드화한다
6. 표류를 정기 점검한다

5번까지 가야 유지된다. 손으로 한 강화는 다음 서버에서 반복되지 않는다.

## 현황 확인

\`\`\`bash
# 열려 있는 포트와 그 프로세스 — 3번 항목의 출발점
ss -tulpn | awk 'NR>1 {print $1, $5, $7}' | sort -u

# 로그인 가능한 계정
awk -F: '$7 !~ /(nologin|false)$/ {print $1, $7}' /etc/passwd

# 미적용 보안 패치 수
command -v dnf >/dev/null \
  && dnf updateinfo list security 2>/dev/null | wc -l \
  || apt list --upgradable 2>/dev/null | grep -c security
\`\`\`

세 숫자를 먼저 본다. 열린 포트가 스무 개이고 보안 패치가 밀려 있다면, 커널 옵션을 손보는 것은 순서가 아니다.

## 참고

- CIS Benchmarks for Linux 배포판별 문서
- NIST SP 800-123, 서버 보안 일반 지침
- OpenSCAP 프로젝트 — 자동 점검 도구`,
    diagram: {
      type: 'bars',
      caption: '항목별 효과(상대값)',
      unit: '상대값',
      items: [
        { label: '포트 정리', value: 25 },
        { label: '접속 인증', value: 22, note: '대입 차단' },
        { label: '패치', value: 20 },
        { label: 'sudo 축소', value: 15 },
        { label: '로그 수집', value: 10, note: '조사' },
        { label: '커널 설정', value: 8 },
      ],
    },
    diagram2: {
      type: 'flow',
      caption: '점검 결과 처리',
      steps: [
        { label: '도구로 점검', note: '기준선 대조' },
        { label: '세 부류로 분류', note: '적용·예외·무시' },
        { label: '구성 관리에 반영', note: '재생성에도 유지' },
        { label: '분기 재점검', note: '드리프트 확인' },
      ],
    },
  },
  {
    slug: 'sudo-policy',
    title: 'sudo 정책 설계와 실행 기록 남기기',
    body: `sudo 는 권한을 나눠 주는 도구인데, 실제로는 대부분 ALL 로 설정되어 권한을 통째로 넘기는 데 쓰인다. 그러면 계정 하나가 곧 관리자 하나가 되고, 누가 무엇을 했는지도 알기 어렵다. 명령 단위로 좁히고 실행 내용을 남기면, 같은 편의성을 유지하면서 권한 상승 경로가 크게 줄어든다.

## ALL 설정이 왜 위험한가?

| 설정 | 실제로 얻는 권한 |
| --- | --- |
| ALL=(ALL) ALL | 루트 셸 — 사실상 관리자 |
| ALL=(ALL) NOPASSWD: ALL | 비밀번호 없이 관리자 |
| 특정 명령 허용 + 셸 탈출 가능 | 루트 셸 |
| 편집기 실행 허용 | 임의 파일 쓰기 → 루트 |
| 인터프리터 실행 허용 | 임의 코드 실행 → 루트 |
| 명령 단위 + 인자 고정 | 그 동작만 |

편집기나 인터프리터를 허용하면 명령을 좁힌 의미가 사라진다. 셸을 띄울 수 있는 명령 목록은 널리 정리되어 있으므로 허용 목록을 만들 때 대조한다.

![허용 범위와 실제 권한](/img/posts/sudo-policy.svg)

## 최소 권한으로 명령을 좁히는 방법

역할별로 별칭을 만들고 필요한 명령만 넣는다. 인자까지 고정하는 것이 중요하다. 서비스 재시작을 허용할 때 서비스 이름을 비워 두면 어떤 서비스든 다룰 수 있다.

\`\`\`
Cmnd_Alias WEB_OPS = /bin/systemctl restart nginx, \\
                     /bin/systemctl reload nginx, \\
                     /usr/bin/tail -n * /var/log/nginx/*
Cmnd_Alias DENIED  = /bin/su, /bin/bash, /usr/bin/vi, /usr/bin/python3

%web-ops ALL = (root) WEB_OPS, !DENIED
Defaults:%web-ops  log_output, iolog_dir=/var/log/sudo-io/%{user}
Defaults           timestamp_timeout=5, passwd_tries=3, requiretty
\`\`\`

거부 목록을 함께 쓰는 이유는, 나중에 누가 허용 목록을 넓혔을 때의 안전장치다.

![역할별 권한 분리](/img/posts/sudo-policy-2.svg)

## 실행 기록은 어디까지 남기는가

기본 설정은 어떤 명령을 실행했는지만 남긴다. 대화형 세션의 실제 입출력까지 남기려면 별도 설정이 필요하다. 조사에서 차이가 크다.

| 수준 | 남는 것 | 비용 |
| --- | --- | --- |
| 기본 | 명령줄, 사용자, 시각 | 없음 |
| log_output | 세션 입출력 전체 | 저장 공간 |
| 원격 전송 | 장비 침해에도 보존 | 수집 구성 |

입출력 기록에는 비밀번호가 섞일 수 있으므로 접근 통제를 함께 걸어야 한다.

## 현재 설정을 어떻게 점검하는가

\`\`\`bash
# 문법 오류 확인 — 잘못 고치면 sudo 자체가 잠긴다
visudo -c

# 사용자별 실제 허용 명령 — 상속된 그룹까지 반영된 결과
for u in $(getent passwd | awk -F: '$3>=1000{print $1}'); do
  echo "== $u"; sudo -l -U "$u" 2>/dev/null | sed -n '/may run/,$p'
done

# NOPASSWD 와 ALL 이 남아 있는 줄
grep -rnE 'NOPASSWD|\\(ALL\\)\\s*ALL' /etc/sudoers /etc/sudoers.d/ 2>/dev/null
\`\`\`

## 실제로 이렇게 터진다

편의를 위해 모든 명령을 비밀번호 없이 허용한 사례가 있다. 웹 애플리케이션 취약점으로 서비스 계정이 뚫리자 그대로 관리자 권한이 됐다.

또 하나는 특정 명령만 허용했지만 그 명령이 셸을 띄울 수 있었던 경우다. 편집기나 페이저를 통해 임의 명령이 실행됐다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 명령을 제한하면 안전하다 | 셸 탈출이 가능한 명령이 많다 |
| 비밀번호 없이 해도 된다 | 계정 탈취 시 즉시 상승 |
| 와일드카드로 좁힐 수 있다 | 우회 경로가 생긴다 |
| 로그가 남으니 괜찮다 | 사후 확인일 뿐이다 |
| 개발 서버는 상관없다 | 자격 증명이 거기 있다 |

## 셸 탈출이 가능한 명령

| 유형 | 예 |
| --- | --- |
| 편집기 | 외부 명령 실행 기능 |
| 페이저 | 셸 호출 기능 |
| 인터프리터 | 임의 코드 실행 |
| 아카이브 도구 | 옵션으로 명령 실행 |
| 검색 도구 | 실행 옵션 |

허용 목록을 만들 때 각 명령이 셸을 띄울 수 있는지 확인한다. 하나라도 있으면 제한이 무의미하다.

## 와일드카드의 함정

경로에 와일드카드를 쓰면 의도하지 않은 대상까지 포함된다. 상대 경로나 상위 디렉터리 참조로 우회가 가능하다. 전체 경로를 명시하고 와일드카드를 피한다.

## 안전한 정책의 형태

| 원칙 | 방법 |
| --- | --- |
| 전체 경로 명시 | 명령의 절대 경로 |
| 인자 고정 | 가능하면 인자까지 지정 |
| 비밀번호 요구 | 서비스 계정 외에는 필수 |
| 셸 탈출 가능 명령 배제 | 대체 방법 마련 |
| 로그 원격 전송 | 로컬 삭제 대비 |
| 정기 검토 | 반기 1회 |

## 현황 점검

\`\`\`bash
# 비밀번호 없이 전체 명령이 허용된 항목 — 최우선 정리 대상
grep -rn 'NOPASSWD' /etc/sudoers /etc/sudoers.d/ | grep -E 'ALL\s*$|ALL$'

# 설정 문법 검증 — 잘못 쓰면 아무도 못 쓰게 된다
visudo -c
\`\`\`

수정 전에 반드시 문법 검증을 한다. 잘못된 설정 파일 하나로 모두가 권한 상승 수단을 잃는 상황이 생긴다.

## 대안

특정 작업을 위해 관리자 권한이 필요하다면, 그 작업만 하는 스크립트를 만들고 그것만 허용한다. 스크립트는 인자를 검증하고 셸 확장을 차단한다. 명령 목록을 늘리는 것보다 안전하다.

## 참고

- sudoers(5) 매뉴얼 — Command_Alias, log_output
- GTFOBins — 셸 탈출이 가능한 명령 목록
- NIST SP 800-53 AC-6(9) Auditing Use of Privileged Functions`,
    diagram: {
      type: 'matrix',
      caption: '허용 범위와 결과',
      x: ['셸 탈출 불가', '셸 탈출 가능'],
      y: ['명령·인자 고정', 'ALL 허용'],
      cells: ['의도한 권한', '루트와 동등', '루트와 동등', '루트와 동등'],
    },
    diagram2: {
      type: 'layers',
      caption: '역할별 명령 묶음',
      layers: [
        { label: '웹 운영', note: '서비스 재시작·로그 조회' },
        { label: '디비 운영', note: '백업·상태 확인' },
        { label: '시스템 관리', note: '패치·계정, 승인 필요' },
      ],
    },
  },
  {
    slug: 'ssh-certificate-auth',
    title: 'SSH 인증서 기반 접속으로 키 정리',
    body: `서버마다 authorized_keys 를 관리하면 시간이 지나면서 아무도 지우지 않은 공개키가 쌓인다. 퇴사자 키가 남아 있어도 알기 어렵고, 서버 수가 늘면 회수 자체가 불가능해진다. SSH 인증서를 쓰면 서버에 신뢰할 기관 하나만 등록하고, 접속 권한은 짧은 수명의 인증서 발급으로 관리한다.

## 공개키 방식은 무엇이 문제인가?

| 문제 | 공개키 | 인증서 |
| --- | --- | --- |
| 권한 회수 | 서버마다 파일 수정 | 발급 중단으로 즉시 |
| 만료 | 없음 | 수명 지정 |
| 대상 제한 | 서버별 배포 | 인증서에 주체·조건 기록 |
| 감사 | 어떤 키인지 추적 어려움 | 발급 기록이 근거 |
| 서버 추가 | 전체 키 재배포 | 신뢰 기관만 등록 |

![공개키 배포와 인증서 발급 비교](/img/posts/ssh-certificate-auth.svg)

## 구성 요소와 신뢰 방향

두 방향의 인증서를 함께 쓰는 것이 완성된 구성이다. 사용자 인증서는 서버가 사람을 믿는 근거이고, 호스트 인증서는 사람이 서버를 믿는 근거다. 호스트 인증서를 쓰면 접속할 때마다 나오는 지문 확인 문구가 사라지고, 중간자 위험도 줄어든다.

\`\`\`
사용자 인증서   발급기관이 사용자 공개키에 서명 → 서버가 기관을 신뢰
호스트 인증서   발급기관이 서버 공개키에 서명 → 클라이언트가 기관을 신뢰
수명            업무 시간 단위(8~12시간)로 짧게
principals      계정 이름 또는 역할 이름을 인증서에 기록
\`\`\`

![양방향 신뢰 구성](/img/posts/ssh-certificate-auth-2.svg)

## 어떻게 도입하는가

기존 공개키를 남겨 둔 상태에서 인증서를 병행해 붙이고, 사용률이 올라간 뒤 공개키를 제거한다. 한 번에 바꾸면 접속 불가 상황이 생긴다.

\`\`\`bash
# 서버 — 신뢰할 발급기관 등록
echo 'TrustedUserCAKeys /etc/ssh/ca_user.pub'      >> /etc/ssh/sshd_config
echo 'HostCertificate   /etc/ssh/ssh_host_ed25519_key-cert.pub' >> /etc/ssh/sshd_config
sshd -t && systemctl reload sshd

# 발급 — 수명 8시간, 사용할 계정 이름 지정
ssh-keygen -s ca_user -I 'baesh@example.com' -n deploy,ops \\
  -V +8h -z "$(date +%s)" user_key.pub

# 확인 — 인증서 내용과 만료
ssh-keygen -L -f user_key-cert.pub | sed -n '1,12p'
\`\`\`

## 남은 공개키를 어떻게 찾는가

인증서로 옮긴 뒤에도 파일에 남은 키가 접속을 허용한다. 정리 전에 목록을 만든다.

\`\`\`bash
# 전 계정의 authorized_keys 와 등록 시점 — 주인 없는 키를 찾는다
for h in $(cat hosts.txt); do
  ssh "$h" 'for f in /home/*/.ssh/authorized_keys /root/.ssh/authorized_keys; do
    [ -f "$f" ] && awk -v f="$f" "{print f, \\$3}" "$f"; done' 2>/dev/null
done | sort | uniq -c | sort -rn
\`\`\`

주석 필드에 사람 이름이 없거나, 재직자 명부에 없는 이름이 나오면 회수 대상이다.

## 실제로 이렇게 터진다

공개키를 서버마다 배포한 사례가 있다. 서버가 수백 대였고, 퇴사자 키를 회수할 때 전 서버를 확인해야 했다. 몇 대를 빠뜨렸고 그 사실을 몇 달 뒤 알았다.

또 하나는 인증서 방식으로 옮기면서 기존 공개키 파일을 지우지 않은 경우다. 옛 경로가 그대로 살아 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 공개키 방식이면 충분하다 | 배포·회수가 문제다 |
| 인증서는 웹용이다 | SSH 도 인증서를 쓴다 |
| 도입이 복잡하다 | 서버 설정 두 줄이다 |
| 만료를 길게 잡아야 편하다 | 짧을수록 회수가 쉽다 |
| 호스트 키는 그대로 둔다 | 호스트도 인증서로 하면 경고가 사라진다 |

## 무엇이 달라지나

| 항목 | 공개키 | 인증서 |
| --- | --- | --- |
| 배포 | 서버마다 | 필요 없음 |
| 회수 | 서버마다 삭제 | 만료 대기 또는 폐기 목록 |
| 유효 기간 | 없음 | 있음 |
| 권한 제한 | 파일 옵션 | 인증서에 포함 |
| 감사 | 키 지문 | 발급 기록 |

가장 큰 이득은 회수다. 유효 기간을 짧게 두면 회수 작업 자체가 대부분 사라진다.

## 설계

| 항목 | 권장 |
| --- | --- |
| 사용자 인증서 수명 | 8~12시간 |
| 호스트 인증서 수명 | 수개월 |
| 발급 조건 | 다중 인증 통과 후 |
| 원칙 이름 | 개인 식별자 포함 |
| 강제 명령 | 필요 시 인증서에 포함 |
| 서명 키 보관 | 하드웨어 또는 관리 서비스 |

서명 키가 유출되면 전 서버가 열린다. 이 키의 보호 수준이 전체 체계의 수준이다.

## 전환 절차

1. 인증 기관 키를 만들고 안전하게 보관한다
2. 서버에 신뢰 설정을 추가한다
3. 인증서와 기존 공개키를 병행 허용한다
4. 사용자에게 발급 도구를 배포한다
5. 기존 공개키 사용 현황을 로그로 확인한다
6. 사용이 없어지면 공개키 파일을 제거한다

5번 없이 6번을 하면 누군가 접속하지 못한다. 로그로 확인한 뒤 정리한다.

\`\`\`bash
# 어떤 방식으로 인증했는지 — 전환 진행 상황 확인
grep 'Accepted' /var/log/auth.log | grep -oE 'publickey|certificate' | sort | uniq -c

# 서버에 남아 있는 개별 공개키 — 정리 대상
find /home -name authorized_keys -exec wc -l {} +
\`\`\`

## 참고

- OpenSSH — ssh-keygen 인증서 발급, CERTIFICATES 절
- NIST SP 800-53 IA-5 Authenticator Management
- CIS Benchmark — SSH Server Configuration`,
    diagram: {
      type: 'matrix',
      caption: '키 관리 방식 비교',
      x: ['만료 있음', '만료 없음'],
      y: ['중앙 발급', '서버별 배포'],
      cells: ['인증서 방식', '회수 누락', '해당 없음', '공개키 누적'],
    },
    diagram2: {
      type: 'flow',
      caption: '접속 흐름',
      steps: [
        { label: '발급 요청', note: '신원 확인 후' },
        { label: '단기 인증서 발급', note: '8~12시간' },
        { label: '서버 접속', note: '기관 서명 검증' },
        { label: '만료로 자동 회수', note: '파일 수정 없음' },
      ],
    },
  },
  {
    slug: 'selinux-apparmor',
    title: 'SELinux 와 AppArmor 선택 기준',
    body: `침해가 일어난 뒤 피해 범위를 정하는 것은 프로세스가 무엇에 접근할 수 있었는지다. 웹 서버가 뚫렸을 때 웹 문서만 읽히는 것과 시스템 전체가 읽히는 것은 다른 사고다. 강제 접근 통제는 그 경계를 커널에서 정한다. 대개 "복잡해서 끈다"로 끝나지만, 켜 두는 것과 끄는 것의 차이가 크다.

## 두 방식은 무엇이 다른가?

| 구분 | SELinux | AppArmor |
| --- | --- | --- |
| 판정 기준 | 라벨(파일·프로세스에 부여) | 경로 |
| 표현력 | 높음 | 중간 |
| 학습 부담 | 큼 | 작음 |
| 파일 이동 시 | 라벨 따라감 | 경로 바뀌면 규칙 밖 |
| 기본 채택 | RHEL 계열 | 우분투·SUSE 계열 |
| 문제 진단 | 감사 로그 + 도구 | 로그가 단순 |

배포판 기본을 그대로 쓰는 것이 대체로 옳다. 다른 것을 얹으면 배포판이 제공하는 정책을 못 쓴다.

![라벨 기반과 경로 기반 판정](/img/posts/selinux-apparmor.svg)

## 끄지 않고 넘기는 순서

문제가 나면 끄는 대신 허용 모드로 두고 필요한 규칙을 모은다. 허용 모드는 차단하지 않고 위반만 기록하므로 업무 영향 없이 정책을 다듬을 수 있다.

\`\`\`
1. 허용 모드로 전환             차단 없이 위반 기록만
2. 업무를 한 주기 돌린다        월말 배치까지 포함
3. 기록에서 규칙 생성           도구가 초안을 만들어 준다
4. 필요한 것만 추려 반영        넓은 허용은 검토 후
5. 강제 모드로 전환             이후 위반은 실제 문제
\`\`\`

![허용 모드에서 강제 모드로](/img/posts/selinux-apparmor-2.svg)

## 상태와 위반 기록을 확인하는 방법

\`\`\`bash
# SELinux — 상태와 최근 차단 내역
getenforce; sestatus | sed -n '1,8p'
ausearch -m AVC -ts recent 2>/dev/null | audit2allow -w | head -30
# 규칙 초안 생성 (내용을 반드시 읽고 추린다)
ausearch -m AVC -ts today 2>/dev/null | audit2allow -M mypolicy && cat mypolicy.te

# AppArmor — 프로필별 모드와 위반
aa-status | sed -n '1,10p'
journalctl -k --since today | grep -i 'apparmor=.DENIED' | tail -20
\`\`\`

## 어디까지 적용하는 것이 현실적인가

전 시스템에 세밀한 정책을 만드는 것은 대부분 실패한다. 인터넷에 노출된 프로세스부터 시작한다 — 웹 서버, 리버스 프록시, 업로드 처리, 이미지 변환. 이 네 부류만 프로필 안에 넣어도 침해 시 피해 범위가 크게 줄어든다. 나머지는 배포판 기본 정책을 강제 모드로 유지하는 선에서 둔다.

## 실제로 이렇게 터진다

설치 후 애플리케이션이 동작하지 않아 강제 모드를 끈 사례가 있다. 그 상태로 몇 년이 지났고, 나중에 웹 서버 취약점으로 침해됐을 때 아무 제약이 없었다.

또 하나는 정책 오류를 해결하려고 광범위한 허용 규칙을 넣은 경우다. 사실상 꺼진 것과 같았다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 끄는 게 정상이다 | 침해 시 확산을 막는 마지막 층이다 |
| 문제가 생기면 끄면 된다 | 허용 모드로 두고 조사하면 된다 |
| 정책 작성이 너무 어렵다 | 로그에서 생성할 수 있다 |
| 성능이 느려진다 | 대부분 체감 차이가 없다 |
| 다른 방어가 있으면 불필요하다 | 다른 층이 뚫렸을 때 작동한다 |

## 무엇을 막는가

침해가 성공한 뒤가 이 계층의 자리다. 웹 서버 프로세스가 뚫려도, 그 프로세스가 접근할 수 있는 파일과 네트워크가 정책으로 제한된다.

| 상황 | 제약 |
| --- | --- |
| 웹 서버가 임의 파일 읽기 | 지정 경로만 허용 |
| 웹 서버가 외부 접속 시도 | 차단 |
| 데이터베이스가 셸 실행 | 차단 |
| 프로세스가 설정 변경 | 차단 |

## 끄지 않고 해결하는 절차

1. 강제 모드를 끄지 말고 허용 모드로 바꾼다
2. 애플리케이션을 정상 동작시킨다
3. 거부 로그를 수집한다
4. 로그에서 필요한 규칙을 생성한다
5. 생성된 규칙을 검토한다 — 과도한 것은 좁힌다
6. 강제 모드로 되돌린다

4번에서 도구가 규칙을 만들어 준다. 그대로 쓰지 말고 5번에서 범위를 확인한다.

\`\`\`bash
# 거부 로그 확인
ausearch -m AVC -ts recent 2>/dev/null | head -20

# 로그에서 규칙 생성 — 검토 후 적용
ausearch -m AVC -ts recent | audit2allow -M mypolicy
cat mypolicy.te

# 현재 모드
getenforce || aa-status --enabled && echo apparmor
\`\`\`

## 흔한 원인

| 증상 | 대개의 원인 |
| --- | --- |
| 비표준 경로 접근 실패 | 파일 레이블 |
| 비표준 포트 바인딩 실패 | 포트 레이블 |
| 홈 디렉터리 접근 실패 | 불리언 설정 |
| 네트워크 연결 실패 | 불리언 설정 |

대부분 레이블이나 불리언 하나로 해결된다. 새 정책을 쓸 일은 생각보다 적다.

## 참고

- Red Hat — Using SELinux, 허용 모드 운영
- Ubuntu Server Guide — AppArmor
- NIST SP 800-53 AC-3 Access Enforcement`,
    diagram: {
      type: 'matrix',
      caption: '판정 방식의 차이',
      x: ['파일 이동 있음', '파일 이동 없음'],
      y: ['라벨 기반', '경로 기반'],
      cells: ['규칙 유지', '규칙 유지', '규칙 이탈', '규칙 유지'],
    },
    diagram2: {
      type: 'steps',
      caption: '적용 순서',
      steps: [
        { label: '허용 모드', note: '기록만' },
        { label: '한 주기 관찰', note: '배치 포함' },
        { label: '규칙 추출', note: '초안 검토' },
        { label: '강제 모드', note: '이후 위반은 신호' },
      ],
    },
  },
  {
    slug: 'systemd-sandboxing',
    title: 'systemd 서비스 격리 옵션 적용',
    body: `서비스를 루트로 띄우고 나서 강제 접근 통제를 얹으려면 정책 작성이 필요하다. 그런데 systemd 유닛 파일에 몇 줄을 넣는 것만으로도 상당한 격리를 얻을 수 있다. 별도 도구가 필요 없고 커널 기능을 바로 쓰기 때문에, 하드닝 작업 중 비용 대비 효과가 가장 좋은 편이다.

## 어떤 옵션이 무엇을 막는가?

| 옵션 | 효과 |
| --- | --- |
| ProtectSystem=strict | 시스템 경로 전체 읽기 전용 |
| ProtectHome=yes | 사용자 홈 접근 차단 |
| PrivateTmp=yes | 임시 디렉터리 분리 |
| NoNewPrivileges=yes | setuid 를 통한 권한 상승 차단 |
| PrivateDevices=yes | 장치 파일 접근 제한 |
| RestrictAddressFamilies | 소켓 종류 제한 |
| SystemCallFilter=@system-service | 불필요한 시스템 호출 차단 |
| CapabilityBoundingSet | 남길 권한만 명시 |
| ReadWritePaths | 쓰기 허용 경로만 열기 |

NoNewPrivileges 하나만 켜도 침해 후 권한 상승 경로가 줄어든다. 대부분의 서비스가 부작용 없이 받아들인다.

![옵션이 차단하는 경로](/img/posts/systemd-sandboxing.svg)

## 실제 유닛 파일 구성

읽기 전용을 기본으로 두고, 필요한 쓰기 경로만 여는 방식이 안전하다. 반대로 하면 빠지는 것이 생긴다.

\`\`\`ini
[Service]
User=appsvc
ExecStart=/usr/local/bin/app

NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
SystemCallFilter=@system-service
SystemCallErrorNumber=EPERM
CapabilityBoundingSet=
ReadWritePaths=/var/lib/app /var/log/app
\`\`\`

![읽기 전용 기본 + 예외 경로](/img/posts/systemd-sandboxing-2.svg)

## 얼마나 격리됐는지 어떻게 아는가

systemd 는 유닛별 노출도를 점수로 알려 준다. 작업 전후를 비교하면 효과를 바로 확인할 수 있다.

\`\`\`bash
# 노출도 — 낮을수록 격리가 강하다. 항목별로 무엇이 열려 있는지 함께 나온다
systemd-analyze security app.service | head -40

# 전 서비스 중 노출도가 높은 것부터 — 작업 대상 목록이 된다
systemctl list-units --type=service --state=running --no-legend |
  awk '{print $1}' | while read -r u; do
    printf '%s %s\\n' "$(systemd-analyze security "$u" 2>/dev/null | tail -1 | awk '{print $2}')" "$u"
  done | sort -rn | head -15
\`\`\`

## 적용하다 서비스가 깨질 때

시스템 호출 필터가 원인인 경우가 많다. SystemCallErrorNumber 를 EPERM 으로 두면 프로세스가 죽지 않고 오류만 받으므로 원인 파악이 쉽다. 그리고 유닛을 고칠 때는 배포판 파일을 직접 수정하지 말고 드롭인 디렉터리에 덧붙인다 — 패치로 원본이 갱신돼도 설정이 유지된다.

## 실제로 이렇게 터진다

서비스 유닛을 만들면서 실행 사용자만 지정한 사례가 있다. 그 계정은 일반 사용자였지만 파일시스템 전체를 읽을 수 있었고, 다른 서비스의 설정 파일에서 자격 증명을 찾을 수 있었다.

또 하나는 강한 제약을 한 번에 넣어 서비스가 시작조차 못 한 경우다. 원인을 찾지 못하고 전부 제거했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 컨테이너가 아니면 격리가 안 된다 | 서비스 관리자가 격리 기능을 제공한다 |
| 사용자 분리면 충분하다 | 읽기 범위가 남는다 |
| 설정이 복잡하다 | 몇 줄로 큰 효과가 난다 |
| 전부 켜면 좋다 | 하나씩 확인해야 한다 |
| 성능 부담이 크다 | 대부분 무시할 수준이다 |

## 효과 대비 부담이 좋은 항목

| 항목 | 효과 |
| --- | --- |
| 시스템 경로 읽기 전용 | 높음 |
| 임시 디렉터리 분리 | 높음 |
| 홈 디렉터리 접근 차단 | 높음 |
| 커널 조정 차단 | 높음 |
| 권한 상승 차단 | 높음 |
| 장치 접근 제한 | 중간 |
| 시스템 호출 필터 | 중간 — 조정 필요 |

앞의 다섯 개는 대부분의 서비스에서 그대로 적용된다. 마지막 항목은 서비스마다 확인이 필요하다.

## 적용 방법

한 번에 넣지 않고 하나씩 추가하며 동작을 확인한다.

\`\`\`ini
[Service]
User=appsvc
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
NoNewPrivileges=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
ReadWritePaths=/var/lib/myapp /var/log/myapp
\`\`\`

쓰기가 필요한 경로만 명시적으로 연다. 이 목록이 짧을수록 좋다.

## 얼마나 강화됐는지 확인

\`\`\`bash
# 서비스별 노출 점수 — 낮을수록 격리가 강하다
systemd-analyze security myapp.service | tail -5

# 전체 서비스 순위 — 위험한 것부터 손본다
systemd-analyze security --no-pager | sort -k2 -rn | head -15
\`\`\`

점수는 참고 지표다. 낮추는 것 자체가 목표는 아니지만, 인터넷에 노출된 서비스가 목록 상위에 있다면 우선 손볼 대상이다.

## 문제가 생기면

서비스가 시작되지 않으면 방금 추가한 항목을 하나 빼고 다시 시작한다. 로그에 권한 거부가 남으므로 어느 경로가 필요한지 알 수 있다. 그 경로를 쓰기 허용 목록에 넣는다.

## 참고

- systemd.exec(5) — 샌드박싱 옵션 전체
- systemd-analyze(1) — security 부속 명령
- NIST SP 800-53 SC-39 Process Isolation`,
    diagram: {
      type: 'layers',
      caption: '격리 계층',
      layers: [
        { label: '파일 시스템', note: '읽기 전용 + 예외 경로' },
        { label: '권한', note: 'capability 제거, 상승 차단' },
        { label: '커널 인터페이스', note: '시스템 호출 필터' },
        { label: '네트워크', note: '소켓 종류 제한' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '설정 방향',
      x: ['예외만 허용', '전부 허용'],
      y: ['읽기 전용 기본', '쓰기 기본'],
      cells: ['권장', '누락 발생', '의미 없음', '격리 없음'],
    },
  },
  {
    slug: 'kernel-hardening-sysctl',
    title: '커널 파라미터 보안 설정 점검',
    body: `sysctl 로 바꾸는 커널 설정은 하드닝 문서마다 목록이 다르고, 대부분 최신 배포판에서는 이미 안전한 기본값이다. 그래서 목록을 그대로 복사해 넣는 것은 효과가 없고 때로 통신을 깨뜨린다. 지금 값이 무엇인지 확인하고, 기본값과 다른 것 중 위험한 것만 고치는 방식이 맞다.

## 실제로 확인할 값은 어느 것인가?

| 파라미터 | 권장 | 이유 |
| --- | --- | --- |
| net.ipv4.conf.all.rp_filter | 1 | 출발지 위조 패킷 차단 |
| net.ipv4.conf.all.accept_redirects | 0 | 경로 변경 유도 차단 |
| net.ipv4.conf.all.accept_source_route | 0 | 경로 지정 우회 차단 |
| net.ipv4.tcp_syncookies | 1 | 연결 고갈 완화 |
| net.ipv4.ip_forward | 0 | 라우터가 아니면 끈다 |
| kernel.randomize_va_space | 2 | 주소 배치 무작위화 |
| kernel.dmesg_restrict | 1 | 커널 메시지 노출 제한 |
| kernel.kptr_restrict | 2 | 커널 주소 노출 제한 |
| fs.protected_hardlinks | 1 | 링크를 통한 권한 우회 차단 |
| fs.suid_dumpable | 0 | 특권 프로세스 덤프 차단 |

![설정이 막는 경로](/img/posts/kernel-hardening-sysctl.svg)

## 기본값과 다른 것만 찾는다

전부 나열하지 말고 차이를 본다. 손으로 바뀌어 있거나 오래된 하드닝 스크립트가 남긴 값이 드러난다.

\`\`\`bash
# 권장값과 현재값 비교 — 다른 것만 출력
cat > /tmp/want <<'EOF'
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.all.accept_source_route=0
net.ipv4.tcp_syncookies=1
kernel.randomize_va_space=2
kernel.dmesg_restrict=1
kernel.kptr_restrict=2
fs.protected_hardlinks=1
fs.suid_dumpable=0
EOF
while IFS='=' read -r k v; do
  now=$(sysctl -n "$k" 2>/dev/null) || continue
  [ "$now" = "$v" ] || printf '%-45s 현재 %-6s 권장 %s\\n' "$k" "$now" "$v"
done < /tmp/want
\`\`\`

## ip_forward 를 함부로 끄지 않는다

컨테이너 런타임과 가상화, VPN 종단은 패킷 전달이 필요하다. 하드닝 목록을 그대로 적용해 이 값을 0 으로 만들면 컨테이너 네트워크가 통째로 멈춘다. 장비의 역할을 먼저 판단해야 하는 대표적인 항목이다.

| 장비 역할 | ip_forward |
| --- | --- |
| 일반 응용 서버 | 0 |
| 컨테이너 호스트 | 1 (런타임이 요구) |
| VPN·게이트웨이 | 1 |

![역할별 판단](/img/posts/kernel-hardening-sysctl-2.svg)

## 설정을 유지하는 방법

sysctl 명령으로 바꾼 값은 재부팅에 사라진다. 파일로 남기고, 값이 실제로 적용됐는지 재부팅 후 다시 확인한다. 여러 파일이 겹치면 마지막에 읽힌 값이 이긴다는 점이 흔한 혼선의 원인이다.

\`\`\`bash
printf '%s\\n' 'kernel.kptr_restrict=2' > /etc/sysctl.d/90-hardening.conf
sysctl --system | tail -5
sysctl -a --pattern 'kptr_restrict'         # 적용 결과 확인
\`\`\`

## 참고

- Linux 커널 문서 — Documentation/admin-guide/sysctl/
- CIS Benchmark — Network Parameters, Kernel Parameters 절
- NIST SP 800-123, 운영체제 강화`,
    diagram: {
      type: 'layers',
      caption: '설정 영역',
      layers: [
        { label: '네트워크', note: '위조·경로 변경 차단' },
        { label: '메모리', note: '주소 배치 무작위화' },
        { label: '정보 노출', note: '커널 주소·메시지' },
        { label: '파일 시스템', note: '링크·덤프 제한' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: 'ip_forward 판단',
      x: ['전달 필요', '전달 불필요'],
      y: ['컨테이너·VPN 호스트', '일반 서버'],
      cells: ['1 유지', '해당 없음', '해당 없음', '0 으로'],
    },
  },
  {
    slug: 'auditd-rules',
    title: '리눅스 감사 로그 규칙 설계하기',
    body: `auditd 는 커널 수준에서 파일 접근과 시스템 호출을 기록한다. 조사에 강력하지만 규칙을 넓게 걸면 성능이 떨어지고 로그가 폭주한다. 흔히 인터넷의 규칙 파일을 그대로 넣고 며칠 뒤 디스크가 차서 끄게 된다. 무엇을 조사하려는지 정하고 그 목적에 필요한 규칙만 남기는 것이 요령이다.

## 무엇을 남겨야 조사가 되는가?

| 목적 | 규칙 대상 |
| --- | --- |
| 계정 변경 추적 | /etc/passwd, /etc/shadow, /etc/sudoers |
| 권한 상승 확인 | setuid 실행, sudo 사용 |
| 지속성 확보 탐지 | cron 디렉터리, systemd 유닛 경로 |
| 설정 변조 확인 | /etc/ssh, 방화벽 규칙 |
| 모듈 적재 감시 | init_module, finit_module |
| 감사 우회 시도 | auditd 설정 변경, 로그 삭제 |

시스템 호출 전체를 거는 규칙은 넣지 않는다. 파일 감시와 소수의 호출로도 위 목적은 달성된다.

![규칙 대상과 조사 목적](/img/posts/auditd-rules.svg)

## 규칙 파일 예시

키 이름을 붙이는 것이 중요하다. 나중에 그 키로만 검색할 수 있어서 조사 속도가 달라진다.

\`\`\`
## 계정·권한
-w /etc/passwd  -p wa -k identity
-w /etc/shadow  -p wa -k identity
-w /etc/sudoers -p wa -k privilege
-w /etc/sudoers.d/ -p wa -k privilege

## 지속성
-w /etc/crontab -p wa -k persistence
-w /etc/cron.d/ -p wa -k persistence
-w /etc/systemd/system/ -p wa -k persistence

## 커널 모듈
-a always,exit -F arch=b64 -S init_module,finit_module,delete_module -k modules

## 감사 자체 보호 (마지막에 두어야 뒤 규칙 변경을 막는다)
-w /etc/audit/ -p wa -k auditconfig
-e 2
\`\`\`

마지막 줄의 -e 2 는 규칙을 잠근다. 재부팅 없이는 바꿀 수 없으므로 시험이 끝난 뒤에 넣는다. 규칙은 위에서 아래로 평가되고 먼저 맞는 규칙이 이기므로 순서가 결과를 바꾼다. 제외 규칙을 뒤에 두면 앞의 넓은 규칙에 걸려 아무 효과가 없다. 그래서 좁은 제외를 먼저, 넓은 감시를 나중에 배치한다.

![규칙 순서와 잠금](/img/posts/auditd-rules-2.svg)

## 로그가 넘치지 않게 하려면

버퍼와 처리 방식을 함께 정한다. 기본값은 로그가 밀릴 때 이벤트를 버리므로, 정작 침해 시각의 기록이 비어 있을 수 있다. 손실 건수를 주기적으로 확인해 버퍼 크기를 조정하고, 디스크가 찼을 때의 동작을 미리 정해 둔다. 감사 로그가 멈추면 시스템을 멈추도록 설정하는 것이 규정상 필요한 환경도 있고, 서비스 연속성이 우선인 환경도 있다. 어느 쪽이든 사고가 난 뒤에 정하면 늦다.

\`\`\`bash
# 손실 여부 확인 — lost 가 늘어나면 버퍼를 키운다
auditctl -s

# 버퍼와 속도 제한
auditctl -b 16384 -r 500

# 저장 정책 — 공간이 차면 어떻게 할지 미리 정한다
grep -E 'max_log_file|num_logs|space_left_action|disk_full_action' /etc/audit/auditd.conf
\`\`\`

## 어떻게 검색하는가

키로 좁혀 보는 습관을 들인다. 전체를 훑으면 조사 시간이 늘어난다.

\`\`\`bash
ausearch -k privilege -ts today -i | tail -40
ausearch -k identity  -ts recent -i | grep -E 'name=|auid=' | tail -20
aureport --auth --summary -ts this-week
\`\`\`

## 참고

- auditctl(8), auditd.conf(5) 매뉴얼
- Linux Audit 프로젝트 — 규칙 작성 지침
- NIST SP 800-92, 로그 관리 지침`,
    diagram: {
      type: 'layers',
      caption: '감시 영역',
      layers: [
        { label: '계정과 권한', note: 'passwd·sudoers' },
        { label: '지속성 경로', note: 'cron·systemd' },
        { label: '커널 모듈', note: '적재·제거' },
        { label: '감사 자체', note: '설정 변경 감시' },
      ],
    },
    diagram2: {
      type: 'flow',
      caption: '규칙 도입 순서',
      steps: [
        { label: '목적 정의', note: '무엇을 조사할 것인가' },
        { label: '좁은 규칙 적용', note: '파일 감시 중심' },
        { label: '손실 확인', note: '버퍼 조정' },
        { label: '규칙 잠금', note: '-e 2' },
      ],
    },
  },
  {
    slug: 'file-integrity-monitoring',
    title: '파일 무결성 감시 운영과 오탐 줄이기',
    body: `침해 후 공격자는 설정을 바꾸고 실행 파일을 심는다. 파일 무결성 감시는 그 변화를 알아채는 수단이다. 문제는 정상 운영에서도 파일이 끊임없이 바뀐다는 점이다. 감시 대상을 좁히지 않으면 하루에 수천 건이 나와 아무도 보지 않게 된다. 감시할 것과 무시할 것을 나누는 작업이 도구 선택보다 중요하다.

## 어디를 감시하고 어디를 빼는가?

| 감시 | 제외 |
| --- | --- |
| /etc 설정 파일 | 로그 디렉터리 |
| /bin, /sbin, /usr/bin 실행 파일 | 캐시·임시 디렉터리 |
| 부팅 관련 파일 | 데이터베이스 데이터 파일 |
| cron·systemd 유닛 | 애플리케이션 업로드 경로 |
| 인증 관련 파일 | 패키지 관리자 작업 중 변경 |
| 웹 문서 루트 | 세션·소켓 파일 |

패키지 업데이트는 정상 변경이지만 무결성 도구에는 대량 변경으로 보인다. 패치 창구 시간대를 예상 변경으로 처리하는 규칙을 함께 넣는다.

![감시 대상과 제외 대상](/img/posts/file-integrity-monitoring.svg)

## 기준값은 어느 시점에 만드는가

침해 후에 기준값을 만들면 변조된 상태가 정상으로 등록된다. 장비를 만든 직후, 서비스 배포 전에 만들어야 한다. 그리고 기준값 자체를 그 장비에 두면 함께 변조되므로 별도 위치에 보관한다.

\`\`\`
기준 생성   이미지 빌드 직후 → 서명 후 외부 저장소에 보관
정상 변경   패치·배포 시 기준 갱신 + 갱신 이유 기록
검사        주기 실행 + 부팅 시 1회
경보        제외 목록 밖 변경만, 변경 내용 요약 포함
\`\`\`

![기준값 관리 흐름](/img/posts/file-integrity-monitoring-2.svg)

## 어떤 도구로 시작하는가

전용 제품 없이도 시작할 수 있다. 이미 있는 수단을 먼저 쓰는 편이 정착에 유리하다.

| 수단 | 특징 |
| --- | --- |
| 패키지 검증 | 설치 파일 변조를 즉시 확인, 설정은 제외 |
| AIDE | 기준값 방식, 설정이 단순 |
| auditd 파일 감시 | 누가 바꿨는지까지 기록 |
| 단말 탐지 제품 | 실시간, 상관 분석 연계 |

\`\`\`bash
# 패키지에 속한 파일의 변조 — 가장 빠른 첫 점검
rpm -Va 2>/dev/null | grep -E '^..5' | head -20         # RHEL 계열
dpkg --verify 2>/dev/null | head -20                     # 데비안 계열

# AIDE 기준 생성과 검사
aide --init && mv /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz
aide --check | sed -n '1,30p'
\`\`\`

## 경보를 받았을 때 판단 순서

변경 사실만으로는 판단이 안 된다. 세 가지를 함께 본다 — 그 시각에 패치나 배포가 있었는지, 누가 접속해 있었는지, 같은 시각에 다른 장비에서도 같은 변경이 있었는지. 한 장비에서만, 접속 기록 없이, 배포 창구 밖에서 일어난 변경이 실제 신호다.

## 참고

- AIDE 프로젝트 문서 — 설정과 기준값 관리
- NIST SP 800-53 SI-7 Software, Firmware, and Information Integrity
- PCI DSS 요구사항 11.5, 변경 탐지 메커니즘`,
    diagram: {
      type: 'matrix',
      caption: '변경 판정',
      x: ['배포 창구 안', '배포 창구 밖'],
      y: ['여러 장비 동일', '한 장비만'],
      cells: ['정상 배포', '검토', '패치 누락 가능', '침해 의심'],
    },
    diagram2: {
      type: 'steps',
      caption: '기준값 수명',
      steps: [
        { label: '이미지 빌드 직후 생성', note: '서비스 배포 전' },
        { label: '외부 보관', note: '장비와 분리' },
        { label: '정상 변경 시 갱신', note: '이유 기록' },
        { label: '주기 검사', note: '제외 목록 적용' },
      ],
    },
  },
  {
    slug: 'disk-encryption-boot',
    title: '디스크 암호화와 부팅 신뢰 사슬',
    body: `노트북을 분실했을 때 데이터가 읽히는지는 디스크 암호화 여부로 갈린다. 그런데 암호화를 켜 놓고도 키를 어디에 두느냐에 따라 효과가 달라진다. 부팅 과정이 변조되면 키가 그대로 넘어가는 구성도 있다. 암호화와 부팅 검증은 함께 설계해야 의미가 있다.

## 어떤 위협을 막고 어떤 것을 못 막는가?

| 상황 | 디스크 암호화 효과 |
| --- | --- |
| 분실·도난 후 오프라인 분석 | 막는다 |
| 폐기 장비의 데이터 잔존 | 막는다 |
| 디스크 반출 후 다른 장비 연결 | 막는다 |
| 켜져 있는 장비의 원격 침해 | 못 막는다 |
| 로그인 상태에서의 유출 | 못 막는다 |
| 부팅 변조 후 키 탈취 | 부팅 검증이 있어야 막는다 |

암호화는 "꺼진 장비"를 보호한다. 켜진 장비의 보호는 다른 통제의 몫이다.

![보호 범위 경계](/img/posts/disk-encryption-boot.svg)

## 키를 어디에 두는가

| 방식 | 편의 | 위험 |
| --- | --- | --- |
| 부팅 시 비밀번호 입력 | 낮음 | 사람 의존, 서버에 부적합 |
| TPM 에 봉인 | 높음 | 부팅 변조 시 자동 해제 위험 |
| TPM + PIN | 중간 | 권장 구성 |
| 네트워크 기반 자동 해제 | 서버에 적합 | 대역 통제 필요 |
| 파일에 키 저장 | 매우 높음 | 사실상 암호화 무효 |

TPM 단독은 편하지만, 부팅 구성이 변조돼도 조건이 맞으면 키를 내준다. PIN 을 더하면 사람 요소가 하나 남아 그 경로가 닫힌다.

![키 보관 방식과 위험](/img/posts/disk-encryption-boot-2.svg)

## 서버는 어떻게 하는가

서버는 부팅마다 사람이 비밀번호를 넣을 수 없다. 네트워크 기반 자동 해제를 쓰면, 지정한 서버가 응답할 때만 잠금이 풀린다. 디스크를 뽑아 다른 곳에서 켜면 해제되지 않는다.

\`\`\`bash
# 암호화 상태 확인 — 어떤 장치가 잠금 대상인지
lsblk -o NAME,FSTYPE,MOUNTPOINT,TYPE | grep -E 'crypt|LUKS'
cryptsetup luksDump /dev/nvme0n1p3 | sed -n '1,20p'

# 등록된 키 슬롯과 잠금 해제 방식 — 예상 밖 슬롯이 있으면 회수 대상
cryptsetup luksDump /dev/nvme0n1p3 | grep -A3 '^Keyslots'
systemd-cryptenroll --tpm2-device=list
\`\`\`

## 도입할 때 함께 준비할 것

복구 키 없이 배포하면 사용자가 잠긴 장비를 들고 오는 사고가 반드시 생긴다. 복구 키는 중앙에 보관하고, 그 접근 자체를 기록한다. 그리고 폐기 절차에 키 파기를 넣는다 — 키를 지우면 디스크를 지우지 않아도 데이터가 읽히지 않으므로 폐기가 훨씬 빠르고 확실해진다.

## 참고

- Microsoft — BitLocker 그룹 정책 설정, 복구 키 관리
- systemd-cryptenroll(1), Clevis·Tang 네트워크 기반 해제
- NIST SP 800-111, 저장 데이터 암호화 지침`,
    diagram: {
      type: 'matrix',
      caption: '보호되는 상태',
      x: ['장비 꺼짐', '장비 켜짐'],
      y: ['암호화 있음', '암호화 없음'],
      cells: ['보호됨', '다른 통제 필요', '노출', '노출'],
    },
    diagram2: {
      type: 'bars',
      caption: '키 보관 방식의 안전도(상대값)',
      unit: '상대값',
      items: [
        { label: 'TPM + PIN', value: 35 },
        { label: '네트워크 해제', value: 30, note: '서버' },
        { label: '비밀번호 입력', value: 25 },
        { label: 'TPM 단독', value: 15, note: '부팅 변조' },
        { label: '파일 저장', value: 2, note: '무효' },
      ],
    },
  },
  {
    slug: 'macos-endpoint-baseline',
    title: 'macOS 업무 기기 보안 기준 만들기',
    body: `개발 인력이 많은 조직은 업무 기기 상당수가 macOS 다. 그런데 보안 기준은 윈도 기준으로만 만들어져 있고, 맥은 "관리 안 되는 장비"로 남아 있는 경우가 흔하다. 기본값이 비교적 안전한 편이라 방치되기 쉽지만, 확인해야 할 항목은 분명히 있다.

## 최소한 무엇을 확인해야 하는가?

| 항목 | 확인 내용 |
| --- | --- |
| FileVault | 디스크 암호화 켜짐, 복구 키 보관 |
| 시스템 무결성 보호 | 활성 상태 유지 |
| 방화벽 | 켜짐, 들어오는 연결 제한 |
| 자동 업데이트 | 보안 업데이트 자동 적용 |
| 화면 잠금 | 유휴 시간과 즉시 비밀번호 요구 |
| 게이트키퍼 | 서명 확인 유지 |
| 로그인 항목 | 예상 밖 자동 실행 없음 |
| 원격 접속 | 화면 공유·원격 로그인 꺼짐 |
| 프로파일 | 관리 프로파일 설치 상태 |

![확인 항목과 위험](/img/posts/macos-endpoint-baseline.svg)

## 관리 도구가 있어야 유지된다

사용자에게 안내만 하면 시간이 지나며 흩어진다. 기기 관리 도구로 설정을 프로파일로 내려보내고, 이탈 상태를 보고받는 구조가 필요하다. 그리고 프로파일로 강제할 것과 사용자 판단에 맡길 것을 나누어 두면 마찰이 줄어든다.

\`\`\`
강제       디스크 암호화, 화면 잠금, 방화벽, 자동 업데이트
차단       원격 로그인 기본 차단, 서명 확인 우회 차단
기록       기기 목록, 운영체제 버전, 이탈 항목
사용자 판단 배경·독 구성 같은 업무 무관 항목
\`\`\`

![관리 범위 구분](/img/posts/macos-endpoint-baseline-2.svg)

## 상태를 어떻게 점검하는가

\`\`\`bash
# 암호화·무결성·방화벽
fdesetup status
csrutil status
/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate --getblockall

# 자동 업데이트 설정
defaults read /Library/Preferences/com.apple.SoftwareUpdate 2>/dev/null |
  grep -E 'AutomaticCheckEnabled|CriticalUpdateInstall|AutomaticDownload'

# 원격 접속 활성 여부 — 개발 편의로 켜 두고 잊는 경우가 많다
systemsetup -getremotelogin
launchctl print-disabled system | grep -i 'screensharing\\|vnc'

# 자동 실행 항목과 설치된 관리 프로파일
launchctl list | awk 'NR>1 && $3 !~ /^com.apple/ {print $3}' | sort | head -20
profiles -P 2>/dev/null | head
\`\`\`

## 개발 장비에서 특히 문제가 되는 것

개발 인력의 장비에는 자격 증명이 많다. 클라우드 접근 키, 저장소 토큰, 데이터베이스 접속 정보가 파일로 남아 있다. 기기 통제만으로는 이것을 못 막는다. 자격 증명을 단기 발급으로 바꾸고, 평문 파일로 남지 않게 하는 작업을 함께 해야 한다.

\`\`\`bash
# 평문으로 남은 자격 증명 흔적 찾기
ls -la ~/.aws/credentials ~/.kube/config ~/.docker/config.json 2>/dev/null
grep -rlE 'AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}' ~/ --include='*' 2>/dev/null | head
\`\`\`

## 참고

- Apple Platform Security 문서 — FileVault, 시스템 무결성 보호
- macOS Security Compliance Project — 기준선 생성 도구
- CIS Benchmark for Apple macOS`,
    diagram: {
      type: 'layers',
      caption: '통제 계층',
      layers: [
        { label: '저장 데이터', note: '디스크 암호화' },
        { label: '실행', note: '서명 확인·무결성 보호' },
        { label: '접근', note: '화면 잠금·원격 접속 차단' },
        { label: '자격 증명', note: '단기 발급으로 전환' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '관리 방식',
      x: ['프로파일 강제', '안내만'],
      y: ['보안 필수 항목', '업무 무관 항목'],
      cells: ['유지됨', '시간이 지나며 이탈', '불필요한 마찰', '적절'],
    },
  },
]
