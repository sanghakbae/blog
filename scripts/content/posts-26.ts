import type { SeedPost } from './types'

/** 251~260 — 윈도 도메인과 Active Directory */
export const posts26: SeedPost[] = [
  {
    slug: 'ad-tiering',
    title: 'Active Directory 공격 경로와 계층 분리',
    body: `사내 시스템이 도메인에 묶여 있다면, 침해는 대체로 한 대의 업무용 PC 에서 시작해 도메인 관리자 계정으로 끝난다. 중간 경로는 거의 정해져 있다. 관리자가 아무 PC 에나 로그인하면서 자격 증명을 남기고, 공격자는 그 흔적을 주워 다음 장비로 옮겨 간다. 계층을 나눠 이 이동을 끊는 것이 가장 효과가 큰 조치다.

## 권한 상승은 어떤 순서로 일어나는가?

| 단계 | 공격자가 얻는 것 | 끊는 방법 |
| --- | --- | --- |
| 최초 침해 | 일반 사용자 권한 | 단말 탐지, 매크로 차단 |
| 로컬 권한 상승 | 그 PC 의 관리자 | 패치, 로컬 관리자 제거 |
| 자격 증명 수집 | 그 PC 에 남은 다른 계정 | 로그인 계층 제한 |
| 수평 이동 | 다른 PC·서버 | 네트워크 분할, 로컬 계정 분리 |
| 서버 관리자 | 업무 서버 전체 | 관리 계정 분리 |
| 도메인 관리자 | 도메인 전체 | 계층 0 격리 |

![업무 PC 에서 도메인 관리자까지 이어지는 경로](/img/posts/ad-tiering.svg)

## 계층은 세 개로 충분하다

계층 0 은 도메인 컨트롤러와 도메인 관리자, 인증 기반 시스템이다. 계층 1 은 업무 서버와 그 관리자, 계층 2 는 사용자 단말과 지원 인력이다. 규칙은 하나다 — **위 계층 계정은 아래 계층 장비에 절대 로그인하지 않는다**. 관리자가 자기 업무용 PC 에서 도메인 관리자 계정으로 원격 접속을 여는 순간 계층은 무너진다.

![계층별 로그인 허용 방향](/img/posts/ad-tiering-2.svg)

## 로그인 제한을 정책으로 굳힌다

의지에 맡기면 지켜지지 않는다. 그룹 정책의 사용자 권한 할당으로 거부를 명시한다.

\`\`\`
계층 0 그룹 →
  이 컴퓨터에 네트워크를 통해 액세스 거부   : 계층 1·2 장비
  로컬 로그온 거부                          : 계층 1·2 장비
  원격 데스크톱 서비스를 통한 로그온 거부    : 계층 1·2 장비
계층 1 그룹 →
  위 세 항목                                : 계층 2 장비
\`\`\`

## 지금 무엇을 확인할 것인가

도메인 관리자 그룹의 실제 인원부터 센다. 대개 필요한 수보다 훨씬 많다.

\`\`\`powershell
# 특권 그룹 구성원 — 중첩 그룹까지 펼쳐서 본다
'Domain Admins','Enterprise Admins','Schema Admins','Administrators' | ForEach-Object {
  Get-ADGroupMember -Identity $_ -Recursive |
    Select-Object @{n='Group';e={$_}}, name, objectClass
}

# 도메인 관리자가 최근 로그인한 장비 — 계층이 무너진 지점이 여기 나온다
Get-ADUser -Filter 'memberof -RecursiveMatch "CN=Domain Admins,CN=Users,DC=example,DC=com"' \\
  -Properties LastLogonDate, msDS-LastKnownRDN |
  Sort-Object LastLogonDate -Descending | Format-Table name, LastLogonDate
\`\`\`

관리자 계정에 대화형 로그온이 남았는지 이벤트 로그에서 본다.

\`\`\`powershell
# 계층 2 장비에서 특권 계정의 로그온 유형 2(로컬)·10(RDP) 을 찾는다
Get-WinEvent -FilterHashtable @{LogName='Security'; ID=4624; StartTime=(Get-Date).AddDays(-30)} |
  Where-Object { $_.Properties[8].Value -in 2,10 -and $_.Properties[5].Value -match 'adm|admin' } |
  Select-Object TimeCreated, @{n='Account';e={$_.Properties[5].Value}} -First 20
\`\`\`

## 계층을 나눈 뒤에 남는 일

계층 0 계정은 전용 관리 워크스테이션에서만 쓴다. 그 장비는 인터넷과 메일을 쓰지 않는다. 그리고 계층 0 에 속한 자격 증명이 한 번이라도 아래 계층에 노출됐다면 그 계정은 이미 오염된 것으로 보고 비밀번호를 교체한다.

## 실제로 이렇게 터진다

관리자가 자기 계정으로 일반 업무용 PC 에 원격 접속한 사례가 있다. 그 PC 는 이미 감염돼 있었고, 메모리에 남은 관리자 자격 증명이 탈취됐다. 몇 시간 뒤 도메인 전체가 넘어갔다.

계층을 나눴지만 관리 도구를 공용으로 쓴 경우도 있다. 같은 점프 서버에서 모든 계층에 접속했고, 그 서버가 경계를 무너뜨렸다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 계정을 나누면 된다 | 접속하는 단말도 나눠야 한다 |
| 관리자 한 명이면 괜찮다 | 계정 수가 아니라 경로가 문제다 |
| 점프 서버가 있으면 안전하다 | 그 서버의 계층이 정해져야 한다 |
| 서버는 다 같은 계층이다 | 도메인 컨트롤러는 별도다 |
| 도입이 오래 걸린다 | 핵심 규칙 하나부터 시작할 수 있다 |

## 계층 구분

| 계층 | 대상 | 관리 단말 |
| --- | --- | --- |
| 0 | 도메인 컨트롤러, 인증 인프라 | 전용 관리 단말 |
| 1 | 서버, 애플리케이션 | 계층 1 관리 단말 |
| 2 | 사용자 PC | 계층 2 관리 단말 |

## 핵심 규칙 하나

상위 계층 계정으로 하위 계층 시스템에 로그온하지 않는다. 이것 하나만 지켜도 자격 증명 탈취를 통한 상승이 막힌다.

| 금지 | 이유 |
| --- | --- |
| 계층 0 계정으로 사용자 PC 로그온 | 메모리에 남는다 |
| 계층 0 계정으로 서버 원격 접속 | 같은 문제 |
| 계층 1 계정으로 사용자 PC 로그온 | 서버 침해 경로 |

## 기술적으로 강제하기

정책만으로는 지켜지지 않는다. 로그온 권한 자체를 제한한다.

| 방법 | 효과 |
| --- | --- |
| 로그온 거부 정책 | 계층 위반 로그온 차단 |
| 인증 정책 사일로 | 지정 단말에서만 사용 가능 |
| 보호된 사용자 그룹 | 자격 증명 캐시 제한 |
| 관리 단말 분리 | 물리적 경계 |

\`\`\`powershell
# 계층 0 계정이 하위 시스템에 로그온한 이력 — 위반 탐지
Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4624} -MaxEvents 5000 |
  Where-Object { $_.Properties[5].Value -in $Tier0Accounts } |
  Group-Object { $_.MachineName } | Select-Object Name, Count
\`\`\`

도메인 컨트롤러 외의 장비 이름이 나오면 위반이다. 이 조회를 주간 점검에 넣는 것부터 시작한다.

## 참고

- Microsoft — Securing privileged access, Enterprise access model
- NIST SP 800-53 AC-6 Least Privilege
- MITRE ATT&CK — TA0008 Lateral Movement`,
    diagram: {
      type: 'flow',
      caption: '침해에서 도메인 장악까지',
      steps: [
        { label: '업무 PC 침해', note: '메일·웹 경유' },
        { label: '로컬 관리자 획득', note: '패치 누락' },
        { label: '자격 증명 수집', note: '메모리·저장된 자격' },
        { label: '수평 이동', note: '같은 로컬 비밀번호' },
        { label: '도메인 관리자', note: '계층 혼용', danger: true },
      ],
    },
    diagram2: {
      type: 'layers',
      caption: '계층 모델',
      layers: [
        { label: '계층 0 — 도메인 컨트롤러', note: '전용 관리 장비에서만' },
        { label: '계층 1 — 업무 서버', note: '서버 관리자 전용 계정' },
        { label: '계층 2 — 사용자 단말', note: '지원 인력 계정' },
      ],
    },
  },
  {
    slug: 'kerberoasting',
    title: 'Kerberoasting 원리와 서비스 계정 정리',
    body: `도메인에 로그인한 일반 사용자는 누구나 서비스 계정의 티켓을 요청할 수 있다. 그 티켓은 서비스 계정의 비밀번호에서 파생된 키로 암호화되어 있으므로, 받아서 오프라인으로 비밀번호를 맞춰 볼 수 있다. 권한이 없어도 시작할 수 있고 실패해도 흔적이 거의 남지 않아서, 침해 초기에 가장 먼저 시도되는 수법이다.

## 왜 일반 사용자가 그 티켓을 받을 수 있는가?

Kerberos 설계상 서비스 티켓 발급은 인가 판정이 아니다. 티켓을 실제로 쓸 수 있는지는 서비스가 판단한다. 그래서 발급 자체는 막을 수 없고, 막아야 할 것은 **티켓을 풀 수 있게 만드는 조건**이다.

| 조건 | 왜 위험한가 | 조치 |
| --- | --- | --- |
| SPN 이 붙은 일반 사용자 계정 | 티켓 요청 대상이 된다 | 관리형 서비스 계정으로 교체 |
| 짧은 비밀번호 | 오프라인 대입이 성립한다 | 25자 이상 |
| RC4 허용 | 대입 속도가 빠르다 | AES 전용 |
| 특권 그룹 소속 | 성공 시 곧바로 확산 | 권한 회수 |
| 오래된 비밀번호 | 유출 사전에 이미 있다 | 회전 |

![티켓 요청에서 오프라인 대입까지](/img/posts/kerberoasting.svg)

## 관리형 서비스 계정이 근본 해법이다

그룹 관리형 서비스 계정은 비밀번호를 도메인이 생성하고 주기적으로 바꾼다. 240자 무작위 값이라 대입이 성립하지 않는다. 사람이 비밀번호를 알 필요가 없다는 점이 더 중요하다 — 인수인계 문서에 적히지 않는다.

\`\`\`powershell
New-ADServiceAccount -Name svc-web01 -DNSHostName web01.example.com \\
  -PrincipalsAllowedToRetrieveManagedPassword 'WEB-Servers'
Install-ADServiceAccount -Identity svc-web01     # 대상 서버에서
\`\`\`

![계정 종류별 대입 성립 여부](/img/posts/kerberoasting-2.svg)

## 지금 노출된 계정을 센다

SPN 이 붙은 사용자 계정을 뽑아, 비밀번호 나이와 특권 소속을 함께 본다. 이 목록이 곧 공격 대상 목록이다.

\`\`\`powershell
Get-ADUser -Filter 'ServicePrincipalName -like "*"' \\
  -Properties ServicePrincipalName, PasswordLastSet, msDS-SupportedEncryptionTypes, memberOf |
  Select-Object name,
    @{n='SPN';e={$_.ServicePrincipalName -join ','}},
    PasswordLastSet,
    @{n='AES전용';e={($_.'msDS-SupportedEncryptionTypes' -band 24) -gt 0 -and ($_.'msDS-SupportedEncryptionTypes' -band 4) -eq 0}},
    @{n='특권';e={($_.memberOf -match 'Admin') -ne $null}} |
  Sort-Object PasswordLastSet
\`\`\`

## 탐지 규칙은 무엇을 봐야 하는가

이벤트 4769 는 정상 업무에서도 대량으로 발생하므로 단순 집계로는 이상 징후를 못 찾는다. 세 가지를 조합한다.

\`\`\`
조건 1  암호화 유형이 0x17(RC4) 인 4769
조건 2  한 계정이 짧은 시간에 서로 다른 서비스 이름으로 다수 요청
조건 3  요청 주체가 그 서비스를 쓸 이유가 없는 부서
\`\`\`

세 조건을 모두 만족하는 경우만 경보로 올린다. 조건 1 만으로 올리면 알람 피로가 온다.

## 실제로 이렇게 터진다

서비스 계정에 사람이 정한 비밀번호를 쓴 사례가 있다. 일반 도메인 사용자 권한만으로 그 계정의 티켓을 요청해 오프라인에서 해독했고, 비밀번호는 회사명과 숫자 조합이었다. 그 계정은 여러 서버의 관리자였다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 특별한 권한이 필요하다 | 일반 사용자면 된다 |
| 시도하면 탐지된다 | 정상 요청과 구분이 어렵다 |
| 강한 암호화면 안전하다 | 약한 비밀번호가 문제다 |
| 서비스 계정은 적다 | 등록된 서비스 이름이 많다 |
| 비밀번호를 길게 하면 끝이다 | 관리 계정 그룹 정리가 함께 필요하다 |

## 왜 막기 어려운가

티켓 요청은 정상 동작이다. 사용자가 서비스에 접근하려면 티켓을 받아야 한다. 공격자는 그 티켓을 받아 네트워크 밖에서 해독한다. 시도 횟수 제한도, 계정 잠금도 적용되지 않는다.

그래서 대응은 탐지가 아니라 조건 제거다.

## 대응의 우선순위

| 대응 | 효과 |
| --- | --- |
| 서비스 계정을 관리 그룹에서 제거 | 매우 높음 |
| 관리형 서비스 계정으로 전환 | 매우 높음 |
| 비밀번호 25자 이상 무작위 | 높음 |
| 약한 암호화 방식 비활성화 | 중간 |
| 이상 요청 탐지 | 중간 |

첫 두 가지가 근본 대응이다. 해독되더라도 그 계정이 별 권한이 없으면 피해가 제한된다.

## 현황 파악

\`\`\`powershell
# 서비스 이름이 등록된 계정 중 관리 그룹에 속한 것 — 최우선 정리 대상
Get-ADUser -Filter {ServicePrincipalName -like "*"} -Properties ServicePrincipalName, MemberOf, PasswordLastSet |
  Where-Object { $_.MemberOf -match 'Admins' } |
  Select-Object SamAccountName, PasswordLastSet, @{n='SPN';e={$_.ServicePrincipalName -join ','}}
\`\`\`

이 목록이 비어 있어야 한다. 하나라도 나오면 그것이 도메인 침해의 지름길이다.

## 관리형 서비스 계정으로 옮기기

시스템이 비밀번호를 자동 생성하고 주기적으로 바꾼다. 사람이 알 필요도, 알 수도 없다.

| 조건 | 확인 |
| --- | --- |
| 서비스가 지원하는가 | 대부분의 마이크로소프트 서비스는 지원 |
| 여러 서버에서 쓰는가 | 그룹 관리형 계정 사용 |
| 대화형 로그온이 필요한가 | 필요하면 전환 불가 |

전환할 수 없는 계정은 25자 이상 무작위 비밀번호로 두고, 권한을 최소로 줄인다.

## 참고

- Microsoft — Decrypting the Selection of Supported Kerberos Encryption Types
- MITRE ATT&CK — T1558.003 Kerberoasting
- NIST SP 800-63B, 비밀번호 길이 권고`,
    diagram: {
      type: 'steps',
      caption: '공격 흐름',
      steps: [
        { label: 'SPN 목록 조회', note: '일반 사용자 권한으로 가능' },
        { label: '서비스 티켓 요청', note: '이벤트 4769 발생' },
        { label: '오프라인 대입', note: '네트워크 흔적 없음' },
        { label: '비밀번호 획득', note: '특권 계정이면 즉시 확산' },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '계정 종류와 위험',
      x: ['비밀번호 25자 이상', '짧은 비밀번호'],
      y: ['관리형 서비스 계정', '일반 사용자 + SPN'],
      cells: ['대입 불가', '해당 없음', '시간이 걸림', '대입 성립'],
    },
  },
  {
    slug: 'ntlm-relay',
    title: 'NTLM 중계 공격과 서명 강제 설정',
    body: `NTLM 인증은 비밀번호를 주고받지 않고 도전-응답으로 확인한다. 그런데 그 응답이 어느 서버로 가는지는 검증하지 않는다. 그래서 중간에 있는 공격자가 응답을 받아 다른 서버로 그대로 넘기면, 피해자의 권한으로 그 서버에 로그인된다. 비밀번호를 몰라도 성립하므로 비밀번호 정책으로는 막을 수 없다.

## 중계는 어디에서 시작되는가?

공격자는 인증을 유발해야 한다. 대부분 이름 해석 실패를 가로채는 방식이다.

| 유발 수단 | 원리 | 차단 |
| --- | --- | --- |
| LLMNR·NBT-NS 응답 위조 | 오타·없는 이름 조회에 응답 | 두 프로토콜 비활성화 |
| WPAD 자동 검색 | 프록시 설정 조회를 가로챔 | WPAD DNS 등록·비활성화 |
| 문서 내 원격 이미지 | 열면 SMB 로 접속 | 아웃바운드 445 차단 |
| 프린터 버그 유발 | 서버가 먼저 접속하게 만듦 | 패치, 스풀러 정리 |
| 메일 서명 내 UNC 경로 | 미리보기에서 접속 | 메일 게이트웨이 검사 |

![인증 유발에서 다른 서버 로그인까지](/img/posts/ntlm-relay.svg)

## 서명과 채널 바인딩이 실제 방어다

중계를 막는 것은 목적지에서의 검증이다. SMB 서명은 세션에 서명을 붙여 중계된 인증을 무효로 만든다. LDAP 은 서명을, HTTPS 는 채널 바인딩을 강제한다. 각 프로토콜별로 따로 켜야 한다는 점이 흔한 누락 지점이다.

\`\`\`
SMB      서명 필수                 : 클라이언트·서버 양쪽
LDAP     서명 필수 + 채널 바인딩    : 도메인 컨트롤러
HTTP     확장 보호(EPA)             : 인증서 기반 채널 바인딩
전체     NTLM 사용 감사 → 제한 → 차단
\`\`\`

![구간 분리와 서명 적용 지점](/img/posts/ntlm-relay-2.svg)

## 어떤 순서로 켜야 안전한가

바로 차단하면 오래된 장비와 스캐너가 멈춘다. 감사 먼저 켜서 실제 사용처를 파악한다.

1. NTLM 인증 감사 정책을 켜고 2~4주 수집한다
2. 어떤 장비가 NTLM 을 쓰는지, 왜 쓰는지 목록화한다
3. 예외가 필요한 대상만 남기고 나머지에 서명을 강제한다
4. 예외 목록에 만료일을 붙인다

\`\`\`powershell
# 서명 설정 현재값 — 0 이면 강제되지 않은 상태다
Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters' |
  Select-Object requiresecuritysignature, enablesecuritysignature
Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NTDS\\Parameters' |
  Select-Object LDAPServerIntegrity      # 2 = 서명 필수

# LLMNR 비활성화 여부
Get-ItemProperty 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient' -EA 0 |
  Select-Object EnableMulticast          # 0 이어야 한다
\`\`\`

## 남는 위험은 무엇인가

서명을 강제해도 같은 프로토콜 안에서의 중계는 남는다. 그래서 최종 목표는 NTLM 을 끄고 Kerberos 만 쓰는 것이다. 당장 어렵다면 최소한 도메인 컨트롤러와 파일 서버, 인증 관련 시스템에는 예외를 두지 않는다.

## 실제로 이렇게 터진다

내부망에서 이름 확인 실패 응답을 가로채 인증을 유도한 사례가 있다. 사용자가 오타를 낸 공유 폴더 주소에 공격자가 응답했고, 그 인증을 다른 서버로 중계해 접근 권한을 얻었다.

서명을 강제하지 않은 것이 조건이었다. 설정 하나가 전체 경로를 열어 둔 셈이다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 비밀번호를 알아내는 공격이다 | 인증을 그대로 중계한다 |
| 강한 비밀번호면 막힌다 | 무관하다 |
| 외부에서만 가능하다 | 내부망이 주 무대다 |
| 최신 윈도우는 안전하다 | 설정에 달렸다 |
| 완전 비활성화가 유일한 답이다 | 서명 강제로 상당 부분 막힌다 |

## 성립 조건

| 조건 | 제거 방법 |
| --- | --- |
| 이름 확인 브로드캐스트 응답 | 해당 프로토콜 비활성화 |
| 서명 미강제 | 서명 필수로 설정 |
| 채널 바인딩 미적용 | 확장 보호 활성화 |
| 인증 방식 허용 | 최신 인증으로 전환 |

조건 하나만 제거해도 공격이 성립하지 않는다. 서명 강제가 가장 적은 부작용으로 큰 효과를 낸다.

## 단계적 적용

1. 이름 확인 브로드캐스트 프로토콜을 끈다 — 대부분 영향이 없다
2. 파일 공유 서명을 필수로 바꾼다
3. 디렉터리 서비스 서명을 필수로 바꾼다
4. 웹 인증에 채널 바인딩을 적용한다
5. 오래된 인증 방식 사용 현황을 조사한다
6. 사용처를 정리한 뒤 비활성화한다

1번은 즉시 해도 되는 경우가 많다. 2~4번은 오래된 장비가 영향을 받을 수 있으므로 로그를 먼저 본다.

\`\`\`powershell
# 서명 설정 상태 확인
Get-SmbServerConfiguration | Select-Object RequireSecuritySignature, EnableSecuritySignature
Get-SmbClientConfiguration | Select-Object RequireSecuritySignature

# 이름 확인 브로드캐스트 비활성화 여부
Get-NetAdapterBinding -ComponentID ms_tcpip6 | Select-Object Name, Enabled
\`\`\`

## 영향 확인

서명 필수로 바꾸기 전에, 서명을 지원하지 않는 장비가 있는지 확인한다. 복합기, 오래된 NAS, 산업 장비에서 문제가 생기는 경우가 있다. 그런 장비는 별도 네트워크로 분리하는 편이 낫다.

## 참고

- Microsoft — Mitigating NTLM Relay Attacks, KB5005413
- MITRE ATT&CK — T1557.001 LLMNR/NBT-NS Poisoning and SMB Relay
- CISA — Guidance on disabling NTLM`,
    diagram: {
      type: 'flow',
      caption: '중계 성립 조건',
      steps: [
        { label: '이름 해석 실패', note: '오타·없는 공유' },
        { label: '공격자가 응답', note: 'LLMNR·WPAD' },
        { label: '피해자 인증 전송', note: '목적지 검증 없음' },
        { label: '다른 서버로 중계', note: '서명 없으면 성립', danger: true },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '서명 강제 여부와 결과',
      x: ['서명 강제', '서명 없음'],
      y: ['유발 차단됨', '유발 가능'],
      cells: ['안전', '인증만 수집', '중계 무효', '권한 탈취'],
    },
  },
  {
    slug: 'group-policy-baseline',
    title: '그룹 정책으로 보안 기본값 굳히기',
    body: `장비마다 손으로 설정을 맞추면 시간이 지나면서 흩어진다. 그룹 정책은 그 설정을 한곳에서 정하고 계속 되돌려 놓는 수단이다. 중요한 것은 항목을 많이 켜는 것이 아니라, 되돌아가지 않게 만드는 것이다. 정책으로 강제되지 않은 설정은 언젠가 누군가 풀어 놓는다.

## 무엇부터 정책으로 옮겨야 하는가?

효과가 크고 업무 영향이 적은 것부터 넣는다.

| 항목 | 효과 | 업무 영향 |
| --- | --- | --- |
| 로컬 관리자 그룹 구성원 고정 | 수평 이동 차단 | 낮음 |
| LLMNR·NBT-NS 비활성화 | 중계 유발 차단 | 낮음 |
| SMB 서명 필수 | 중계 무효화 | 중간 |
| 오피스 매크로 차단 | 최초 침해 차단 | 중간 |
| 스크립트 로그 기록 | 조사 가능성 확보 | 낮음 |
| 로그인 계층 제한 | 특권 확산 차단 | 높음 |
| 이동식 매체 제한 | 유출 경로 축소 | 높음 |

![정책 적용 순서와 영향도](/img/posts/group-policy-baseline.svg)

## 기준선은 직접 만들지 않는다

Microsoft 가 배포하는 보안 기준선을 가져와 필요한 것만 빼는 방식이 훨씬 빠르고 안전하다. 처음부터 항목을 고르면 빠지는 것이 생긴다. 가져온 뒤 예외를 문서로 남기는 것이 이 방식의 핵심이다.

\`\`\`
1. Security Compliance Toolkit 에서 해당 OS 기준선 내려받기
2. 시험 조직 단위에 적용 → 2주 관찰
3. 업무가 깨진 항목만 예외 처리 + 이유 기록
4. 단계적으로 전체 적용
5. OS 버전이 올라가면 기준선도 갱신
\`\`\`

![예외 관리 흐름](/img/posts/group-policy-baseline-2.svg)

## 적용됐는지 어떻게 확인하는가

정책을 만든 것과 적용된 것은 다르다. 대상 장비에서 결과를 직접 본다.

\`\`\`powershell
# 이 장비에 실제로 적용된 정책과 값
gpresult /h C:\\temp\\gpo.html /f      # 사람이 읽는 보고서
Get-GPResultantSetOfPolicy -ReportType Xml -Path C:\\temp\\rsop.xml

# 정책 적용 실패 이벤트 — 조용히 실패하는 경우가 많다
Get-WinEvent -LogName 'Microsoft-Windows-GroupPolicy/Operational' -MaxEvents 50 |
  Where-Object LevelDisplayName -in 'Error','Warning' |
  Select-Object TimeCreated, Id, Message -First 10
\`\`\`

정책이 걸려 있지 않은 장비를 찾는 것도 함께 한다. 관리 대상에서 빠진 장비가 항상 있다.

\`\`\`powershell
Get-ADComputer -Filter 'Enabled -eq $true' -Properties LastLogonDate, OperatingSystem |
  Where-Object { $_.LastLogonDate -gt (Get-Date).AddDays(-30) } |
  Select-Object name, OperatingSystem, LastLogonDate | Sort-Object OperatingSystem
\`\`\`

## 보안 정책이 늘어난 뒤의 관리

정책 개체가 수십 개가 되면 어떤 설정이 어디서 오는지 아무도 모르게 된다. 개체 수를 늘리지 말고 하나의 기준선 개체를 갱신하는 방식을 유지한다. 예외는 별도 개체로 분리해, 예외 목록만 보면 무엇이 풀려 있는지 알 수 있게 한다.

## 실제로 이렇게 터진다

보안 기준선 템플릿을 그대로 전체에 적용한 사례가 있다. 일부 업무 프로그램이 동작하지 않았고, 원인을 찾지 못해 정책 전체를 되돌렸다. 결국 아무 기준선도 남지 않았다.

또 하나는 정책이 수십 개로 늘어나 적용 순서를 아무도 모르게 된 경우다. 어느 설정이 최종적으로 적용되는지 추적할 수 없었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 템플릿을 적용하면 된다 | 환경에 맞춰 조정해야 한다 |
| 많이 적용할수록 안전하다 | 충돌과 추적 불가가 생긴다 |
| 적용하면 반영된다 | 갱신 주기와 실패가 있다 |
| 설정 값이 곧 상태다 | 실제 적용 결과를 봐야 한다 |
| 되돌리기 쉽다 | 일부 설정은 흔적이 남는다 |

## 안전한 적용 절차

1. 시험용 조직 단위를 만든다
2. 대표 장비 몇 대를 옮긴다
3. 기준선을 적용하고 2주간 업무를 시킨다
4. 문제 항목을 기록하고 예외를 정한다
5. 부서 단위로 단계 적용한다
6. 적용 결과를 실제 장비에서 확인한다

3번의 2주가 핵심이다. 월말 결산이나 특정 주기 업무에서만 쓰는 기능이 있다.

## 정책 구조

| 원칙 | 이유 |
| --- | --- |
| 목적별로 분리 | 무엇이 무엇을 하는지 명확 |
| 개수 최소화 | 순서 추적 가능 |
| 이름에 목적 표시 | 나중에 알아본다 |
| 변경 이력 관리 | 언제 왜 바꿨나 |
| 미사용 정책 삭제 | 적용 시간 단축 |

## 실제 적용 상태 확인

설정한 값과 적용된 값이 다를 수 있다.

\`\`\`powershell
# 특정 장비에 실제 적용된 정책과 실패 항목
gpresult /h C:\Temp\gpo.html /f

# 정책 적용 실패 이벤트
Get-WinEvent -LogName 'Microsoft-Windows-GroupPolicy/Operational' -MaxEvents 200 |
  Where-Object { $_.LevelDisplayName -eq 'Error' } |
  Select-Object TimeCreated, Id, Message -First 10
\`\`\`

적용 실패가 조용히 쌓이는 경우가 많다. 월 1회 무작위 표본으로 확인하는 절차를 두면 발견된다.

## 참고

- Microsoft — Security Compliance Toolkit and Baselines
- CIS Benchmarks for Microsoft Windows
- NIST SP 800-70, 보안 설정 체크리스트`,
    diagram: {
      type: 'bars',
      caption: '항목별 효과(상대값)',
      unit: '상대값',
      items: [
        { label: '로컬 관리자 고정', value: 30, note: '수평 이동' },
        { label: '매크로 차단', value: 25, note: '최초 침해' },
        { label: 'SMB 서명', value: 20, note: '중계' },
        { label: '스크립트 로그', value: 15, note: '조사' },
        { label: '매체 제한', value: 10, note: '유출' },
      ],
    },
    diagram2: {
      type: 'flow',
      caption: '기준선 도입',
      steps: [
        { label: '기준선 가져오기', note: '직접 만들지 않는다' },
        { label: '시험 조직 적용', note: '2주 관찰' },
        { label: '예외 기록', note: '이유와 만료일' },
        { label: '전체 적용', note: '이후 정기 갱신' },
      ],
    },
  },
  {
    slug: 'laps-local-admin',
    title: '로컬 관리자 비밀번호를 LAPS 로 관리',
    body: `장비를 만들 때 이미지에 로컬 관리자 비밀번호를 심어 놓으면, 모든 장비의 비밀번호가 같아진다. 한 대에서 그 값을 얻은 공격자는 나머지 전부에 로그인할 수 있다. 이 하나의 조건이 수평 이동을 가능하게 만드는 가장 흔한 원인이다. LAPS 는 장비마다 다른 값을 자동으로 만들고 주기적으로 바꾼다.

## 같은 비밀번호가 왜 그렇게 위험한가?

| 상황 | 같은 값일 때 | 장비별 다른 값일 때 |
| --- | --- | --- |
| 한 대 침해 | 전 장비 로그인 가능 | 그 한 대에서 멈춤 |
| 자격 증명 수집 | 재사용으로 즉시 확산 | 재사용 불가 |
| 퇴사자 | 알던 값이 계속 유효 | 이미 교체됨 |
| 외주 작업 | 작업 후에도 유효 | 만료 |
| 조사 | 어디서 왔는지 불명 | 장비 특정 가능 |

![공통 비밀번호가 만드는 확산 경로](/img/posts/laps-local-admin.svg)

## 동작 방식과 권한 설계

장비가 스스로 무작위 값을 만들어 자기 컴퓨터 개체의 속성에 저장한다. 그 속성을 읽을 수 있는 대상을 지정하는 것이 설정의 핵심이다. 읽기 권한을 넓게 주면 LAPS 자체가 유출 경로가 된다.

\`\`\`
장비        무작위 값 생성 → AD 컴퓨터 개체 속성에 저장 → 주기마다 교체
읽기 권한   지원 인력 그룹에만, 담당 조직 단위 범위로 한정
읽기 기록   속성 접근을 감사 로그로 남긴다
사용 후     즉시 만료 처리 → 다음 접속은 새 값
\`\`\`

![권한 범위 설계](/img/posts/laps-local-admin-2.svg)

## 도입할 때 함께 정리할 것

LAPS 만 넣고 끝내면 효과가 절반이다. 세 가지를 같이 처리한다.

1. 도메인 사용자를 로컬 관리자 그룹에서 빼고, 그룹 구성원을 정책으로 고정한다
2. 기존 공통 비밀번호로 접속하는 자동화 작업을 찾아 끊는다
3. 로컬 관리자 계정으로 원격 접속하는 경로를 막고 필요한 경우만 예외로 둔다

## 설정과 사용 이력을 어떻게 점검하는가

값이 실제로 채워지고 갱신되는지 본다. 정책만 만들고 확인하지 않아 절반의 장비에 값이 없는 경우가 자주 있다.

\`\`\`powershell
# 값이 없거나 만료가 지난 장비 — 정책이 안 걸린 장비가 여기 나온다
Get-ADComputer -Filter 'Enabled -eq $true' \\
  -Properties 'msLAPS-PasswordExpirationTime', LastLogonDate |
  Select-Object name, LastLogonDate,
    @{n='만료';e={ if ($_.'msLAPS-PasswordExpirationTime') {
      [datetime]::FromFileTime($_.'msLAPS-PasswordExpirationTime') } else { '값 없음' } }} |
  Where-Object { $_.만료 -eq '값 없음' -or $_.만료 -lt (Get-Date) }

# 비밀번호 속성을 읽을 수 있는 주체 — 넓으면 여기서 드러난다
(Get-Acl "AD:$((Get-ADComputer PC-001).DistinguishedName)").Access |
  Where-Object { $_.ObjectType -ne '00000000-0000-0000-0000-000000000000' } |
  Select-Object IdentityReference, ActiveDirectoryRights -Unique
\`\`\`

## 실제로 이렇게 터진다

모든 PC 의 로컬 관리자 비밀번호가 같았던 사례가 있다. 한 대가 감염되자 그 비밀번호로 전 단말에 접근할 수 있었다. 배포 이미지에 들어 있던 값이었고 몇 년째 그대로였다.

또 하나는 관리 도구를 도입했지만 열람 권한을 넓게 준 경우다. 헬프데스크 전원이 전 단말의 관리자 비밀번호를 볼 수 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 로컬 관리자는 잘 안 쓴다 | 침해 시 가장 유용한 계정이다 |
| 비밀번호를 복잡하게 하면 된다 | 같으면 하나가 뚫리면 전부 |
| 계정을 비활성화하면 끝이다 | 복구 상황에 필요하다 |
| 도입하면 안전하다 | 열람 권한이 새 위험이다 |
| 서버는 해당 없다 | 서버도 같은 문제가 있다 |

## 무엇을 해결하나

| 문제 | 해결 |
| --- | --- |
| 공통 비밀번호 | 장비마다 다른 값 |
| 변경 안 됨 | 주기적 자동 변경 |
| 평문 보관 | 디렉터리에 보호 저장 |
| 사용 추적 불가 | 열람 기록 |

## 도입 후 반드시 확인할 것

1. 열람 권한을 최소로 좁힌다 — 누가 어느 범위를 볼 수 있는지
2. 열람 기록을 감사 대상으로 만든다
3. 열람 후 자동 변경을 켠다
4. 변경 주기를 30일 이하로 둔다
5. 적용되지 않은 장비를 찾는다

1번과 5번이 실무에서 가장 자주 빠진다. 헬프데스크에 전 범위 권한을 주면 도입 효과가 줄고, 미적용 장비는 여전히 공통 비밀번호를 쓴다.

\`\`\`powershell
# 관리 대상에서 빠진 장비 — 여기가 사각지대다
Get-ADComputer -Filter {OperatingSystem -like "*Windows*"} -Properties ms-Mcs-AdmPwdExpirationTime |
  Where-Object { -not $_.'ms-Mcs-AdmPwdExpirationTime' } |
  Select-Object Name, DistinguishedName
\`\`\`

## 열람 권한 설계

| 역할 | 범위 |
| --- | --- |
| 1차 지원 | 해당 부서 단말만 |
| 2차 지원 | 전 단말, 승인 후 |
| 서버 담당 | 서버만 |
| 감사 | 열람 기록만 |

범위를 나누면 한 계정이 털려도 전체가 열리지 않는다. 조직 단위별로 권한을 위임하는 것이 기본 형태다.

## 참고

- Microsoft — Windows LAPS overview, 권한 위임 구성
- MITRE ATT&CK — T1078.003 Local Accounts
- NIST SP 800-53 IA-5 Authenticator Management`,
    diagram: {
      type: 'flow',
      caption: '공통 비밀번호 재사용',
      steps: [
        { label: '한 대 침해', note: '메일·취약점' },
        { label: '로컬 관리자 해시 획득', note: '메모리·SAM' },
        { label: '같은 값 재사용', note: '이미지에서 유래' },
        { label: '전 장비 확산', note: '탐지 어려움', danger: true },
      ],
    },
    diagram2: {
      type: 'layers',
      caption: '읽기 권한 범위',
      layers: [
        { label: '조직 단위별 지원 인력', note: '담당 범위만' },
        { label: '보안 담당', note: '조사 목적, 기록 남김' },
        { label: '그 밖의 사용자', note: '읽기 불가' },
      ],
    },
  },
  {
    slug: 'ad-delegation',
    title: 'AD 위임 설정 점검과 최소 권한 적용',
    body: `Active Directory 의 위임은 편리해서 위험하다. "이 계정이 다른 사용자를 대신해 인증할 수 있다"는 설정 하나로, 그 계정을 가진 공격자는 도메인 관리자를 흉내 낼 수 있다. 대부분의 조직에는 오래전 누군가 편의를 위해 켜 놓고 잊은 위임 설정이 남아 있다. 찾아서 지우는 것만으로 큰 경로가 닫힌다.

## 위임 종류별로 무엇이 위험한가?

| 종류 | 설정 위치 | 위험 |
| --- | --- | --- |
| 제약 없는 위임 | 계정 속성 | 접속한 모든 사용자를 흉내 가능 |
| 제약된 위임 | 계정 속성 + 대상 SPN | 지정 서비스 범위에서 흉내 |
| 자원 기반 제약된 위임 | 대상 자원 속성 | 대상 쪽에서 허용 목록 관리 |
| 컴퓨터 개체 생성 권한 | 조직 단위 ACL | 위임 조건을 스스로 만들어 냄 |

제약 없는 위임은 예외 없이 제거 대상이다. 도메인 컨트롤러를 제외하면 정당한 용도가 사실상 없다.

![위임을 통한 권한 상승 경로](/img/posts/ad-delegation.svg)

## 최소 권한으로 바꾸는 순서

위임을 지우기 전에 무엇이 그것에 의존하는지 확인해야 한다. 갑자기 끊으면 업무 시스템의 인증이 깨진다.

1. 위임이 설정된 계정 전체 목록을 만든다
2. 각 계정이 실제로 어떤 서비스에 접근하는지 로그로 확인한다
3. 제약 없는 위임을 자원 기반 제약된 위임으로 바꾼다
4. 대상 목록을 실제 사용 내역으로 좁힌다
5. 특권 계정에는 위임 금지 표시를 걸어 흉내 대상에서 뺀다

![바꿔 가는 단계](/img/posts/ad-delegation-2.svg)

## 지금 남아 있는 설정을 찾는다

세 가지 질의로 대부분 드러난다.

\`\`\`powershell
# 1) 제약 없는 위임 — 도메인 컨트롤러 외에 나오면 제거 검토
Get-ADObject -Filter { TrustedForDelegation -eq $true } -Properties * |
  Select-Object name, objectClass, DistinguishedName

# 2) 제약된 위임 — 어떤 서비스를 대상으로 하는지 함께 본다
Get-ADObject -Filter { msDS-AllowedToDelegateTo -like '*' } \\
  -Properties 'msDS-AllowedToDelegateTo' |
  Select-Object name, @{n='대상';e={$_.'msDS-AllowedToDelegateTo' -join ', '}}

# 3) 자원 기반 위임 — 대상 자원에 누가 허용됐는지
Get-ADComputer -Filter * -Properties 'msDS-AllowedToActOnBehalfOfOtherIdentity' |
  Where-Object { $_.'msDS-AllowedToActOnBehalfOfOtherIdentity' } | Select-Object name
\`\`\`

## 특권 계정을 흉내 대상에서 빼는 방법

위임 정리와 별개로, 도메인 관리자급 계정에는 위임 금지 표시를 걸어 둔다. 이 한 줄이 남은 위임 설정의 피해 범위를 크게 줄인다.

\`\`\`powershell
# 특권 그룹 구성원에게 위임 금지 + 보호된 사용자 그룹 편입
Get-ADGroupMember 'Domain Admins' -Recursive | Where-Object objectClass -eq 'user' |
  ForEach-Object {
    Set-ADAccountControl -Identity $_ -AccountNotDelegated $true
    Add-ADGroupMember -Identity 'Protected Users' -Members $_
  }
\`\`\`

보호된 사용자 그룹은 위임과 NTLM 사용을 함께 막지만, 오래된 서비스와 충돌할 수 있으므로 소수 계정부터 적용한다.

## 실제로 이렇게 터진다

웹 서버에 제약 없는 위임을 설정한 사례가 있다. 관리자가 그 서버에 접속하자 티켓이 서버 메모리에 남았고, 서버를 장악한 공격자가 그 티켓으로 도메인 컨트롤러에 접근했다.

또 하나는 위임 설정을 몇 년 전에 해 두고 잊은 경우다. 이미 쓰지 않는 서비스였다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 위임은 편의 기능이다 | 권한 상승 경로다 |
| 서비스가 필요로 한다 | 대부분 제약 위임으로 충분하다 |
| 설정하면 그대로 둔다 | 정기 점검 대상이다 |
| 제약 위임은 안전하다 | 프로토콜 전환 옵션에 따라 다르다 |
| 서버 관리자만 알면 된다 | 도메인 전체 위험이다 |

## 위임 유형

| 유형 | 위험 |
| --- | --- |
| 제약 없는 위임 | 매우 높음 — 어떤 티켓이든 재사용 |
| 제약 위임 | 중간 — 지정 서비스로 한정 |
| 자원 기반 제약 위임 | 낮음 — 대상이 허용을 제어 |
| 프로토콜 전환 허용 | 높음 — 인증 없이 위임 가능 |

제약 없는 위임은 도메인 컨트롤러 외에는 있어서는 안 된다. 발견하면 그날 처리한다.

## 현황 조사

\`\`\`powershell
# 제약 없는 위임이 설정된 계정·컴퓨터 — 도메인 컨트롤러 외에는 즉시 정리
Get-ADObject -Filter {(UserAccountControl -band 0x80000) -ne 0} -Properties samAccountName |
  Select-Object samAccountName, ObjectClass

# 제약 위임 대상
Get-ADObject -Filter {msDS-AllowedToDelegateTo -like "*"} -Properties msDS-AllowedToDelegateTo |
  Select-Object samAccountName, msDS-AllowedToDelegateTo
\`\`\`

## 정리 순서

1. 제약 없는 위임 목록을 만든다
2. 각각이 실제로 쓰이는지 확인한다
3. 쓰지 않는 것은 해제한다
4. 필요한 것은 제약 위임으로 전환한다
5. 관리자 계정을 위임 대상에서 보호한다

5번은 계정 속성에서 위임 불가로 표시하거나 보호된 사용자 그룹에 넣는다. 위임 설정이 남아 있어도 관리자 티켓은 재사용되지 않는다.

## 민감 계정 보호

| 방법 | 효과 |
| --- | --- |
| 위임 불가 속성 | 해당 계정 티켓 위임 차단 |
| 보호된 사용자 그룹 | 위임·약한 암호화 차단 |
| 인증 정책 | 사용 가능 단말 제한 |

세 가지를 계층 0 계정 전체에 적용하는 것이 기본이다.

## 참고

- Microsoft — Kerberos Constrained Delegation Overview, Protected Users Security Group
- MITRE ATT&CK — T1134.001 Token Impersonation
- NIST SP 800-53 AC-6 Least Privilege`,
    diagram: {
      type: 'steps',
      caption: '위임 악용 흐름',
      steps: [
        { label: '위임 계정 탈취', note: '서비스 계정이 많다' },
        { label: '대상 서비스 확인', note: '속성에 적혀 있다' },
        { label: '특권 사용자 흉내', note: '티켓 요청' },
        { label: '대상 시스템 접근', note: '정상 인증으로 보임' },
      ],
    },
    diagram2: {
      type: 'flow',
      caption: '정리 순서',
      steps: [
        { label: '목록화', note: '세 가지 질의' },
        { label: '사용 확인', note: '로그로 근거' },
        { label: '자원 기반으로 교체', note: '대상 쪽 통제' },
        { label: '특권 계정 보호', note: '위임 금지 표시' },
      ],
    },
  },
  {
    slug: 'dcsync-replication',
    title: 'DCSync 와 도메인 복제 권한 통제',
    body: `도메인 컨트롤러끼리 데이터를 맞추는 복제 기능은, 요청하면 계정의 비밀번호 해시를 넘겨 준다. 이 권한을 가진 계정은 도메인 컨트롤러에 로그인하지 않고도 전 계정의 해시를 한 번에 가져올 수 있다. 명령 한 줄로 끝나고 파일도 남지 않으므로, 권한이 잘못 부여돼 있으면 사실상 도메인 전체가 열린 상태다.

## 어떤 권한이 이 동작을 가능하게 하는가?

세 개의 확장 권한 중 두 개만 있으면 성립한다.

| 권한 | 의미 |
| --- | --- |
| DS-Replication-Get-Changes | 변경분 복제 요청 |
| DS-Replication-Get-Changes-All | 비밀 속성 포함 복제 |
| DS-Replication-Get-Changes-In-Filtered-Set | 필터된 집합 복제 |

앞의 두 개가 함께 부여된 주체가 곧 위험 대상이다. 도메인 컨트롤러 계정과 도메인 관리자 외에 나오면 근거를 확인해야 한다.

![복제 권한으로 해시를 가져오는 경로](/img/posts/dcsync-replication.svg)

## 왜 이런 권한이 붙어 있는가

대부분 도구 설치 과정에서 생긴다. 디렉터리 동기화 제품, 백업 솔루션, 비밀번호 정책 도구, 계정 감사 도구가 설치 시 권한을 요구한다. 설치 당시에는 이유가 있었지만 제품을 지운 뒤에도 권한은 남는다.

![권한이 남는 경로](/img/posts/dcsync-replication-2.svg)

## 지금 누가 가지고 있는지 확인한다

도메인 루트의 접근 제어 목록에서 해당 확장 권한을 가진 주체를 뽑는다.

\`\`\`powershell
$root = (Get-ADDomain).DistinguishedName
$guids = @{
  'DS-Replication-Get-Changes'     = '1131f6aa-9c07-11d1-f79f-00c04fc2dcd2'
  'DS-Replication-Get-Changes-All' = '1131f6ad-9c07-11d1-f79f-00c04fc2dcd2'
}
(Get-Acl "AD:$root").Access |
  Where-Object { $_.ObjectType -in $guids.Values -and $_.AccessControlType -eq 'Allow' } |
  Select-Object IdentityReference,
    @{n='권한';e={ ($guids.GetEnumerator() | Where-Object Value -eq $_.ObjectType).Key }} |
  Sort-Object IdentityReference
\`\`\`

## 탐지 규칙은 어떻게 만드는가

복제는 정상 동작이므로 발생 자체를 막을 수 없다. 요청 주체를 기준으로 판정한다.

\`\`\`
이벤트  4662, 속성에 위 GUID 포함
정상    주체가 도메인 컨트롤러 컴퓨터 계정
이상    주체가 사용자 계정 또는 DC 아닌 컴퓨터 계정  → 즉시 경보
보강    같은 시각의 4624 로그온 원본 주소를 함께 남긴다
\`\`\`

이 규칙은 오탐이 거의 없어서 침해사고 초동 조치의 좋은 방아쇠가 된다. 경보가 뜨면 해당 계정의 비밀번호 교체와 함께 krbtgt 키 교체를 검토한다.

## 권한을 회수한 다음

이미 해시가 유출됐을 가능성을 전제로 정리한다. 특권 계정과 서비스 계정 비밀번호를 교체하고, 자주 쓰이는 계정부터 순서를 정한다. 전 계정을 한꺼번에 바꾸면 업무가 멈추므로 단계를 나눈다.

## 실제로 이렇게 터진다

권한 위임을 정리하면서 복제 권한이 일반 계정에 붙어 있는 것을 발견한 사례가 있다. 과거 마이그레이션 도구가 남긴 설정이었고, 그 계정만 있으면 모든 비밀번호 해시를 가져올 수 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 도메인 관리자만 가능하다 | 복제 권한만 있으면 된다 |
| 컨트롤러에서만 가능하다 | 네트워크 어디서든 가능하다 |
| 탐지가 쉽다 | 정상 복제와 구분해야 한다 |
| 흔한 설정이 아니다 | 마이그레이션 도구가 자주 남긴다 |
| 한 번 정리하면 끝이다 | 새 도구가 다시 부여한다 |

## 무엇이 문제인가

복제 권한은 도메인 컨트롤러끼리 데이터를 주고받기 위한 것이다. 이 권한이 있으면 컨트롤러가 아니어도 비밀번호 해시를 요청할 수 있다. 관리자 계정 해시를 얻으면 그것으로 인증이 가능하다.

## 권한 점검

\`\`\`powershell
# 복제 권한이 부여된 주체 — 컨트롤러 계정 외에는 검토 대상
$root = (Get-ADRootDSE).defaultNamingContext
(Get-Acl "AD:\$root").Access |
  Where-Object { $_.ObjectType -in @(
    '1131f6aa-9c07-11d1-f79f-00c04fc2dcd2',
    '1131f6ad-9c07-11d1-f79f-00c04fc2dcd2') } |
  Select-Object IdentityReference, AccessControlType
\`\`\`

기본으로 나와야 하는 것은 컨트롤러 그룹과 관리 그룹뿐이다. 그 외의 계정이 보이면 왜 붙었는지 확인한다.

## 탐지

정상 복제는 컨트롤러끼리만 일어난다. 컨트롤러가 아닌 주소에서 복제 요청이 오면 이상이다.

| 신호 | 판단 |
| --- | --- |
| 비컨트롤러 주소의 복제 요청 | 즉시 조사 |
| 사용자 계정의 복제 요청 | 즉시 조사 |
| 평소와 다른 시각 | 확인 |

## 대응 순서

1. 복제 권한 목록을 만들고 불필요한 것을 제거한다
2. 비컨트롤러 복제 요청 탐지 규칙을 만든다
3. 관리자 계정 비밀번호를 교체한다 — 이미 유출됐을 수 있다
4. 인증 자격 증명 계정 비밀번호를 두 번 교체한다
5. 권한 변경을 감사 대상에 넣는다

의심 정황이 있으면 3~4번을 먼저 한다. 해시가 나간 뒤에는 권한을 회수해도 이미 유효한 자격 증명이 밖에 있다.

## 참고

- Microsoft — Active Directory Replication 권한, 이벤트 4662
- MITRE ATT&CK — T1003.006 DCSync
- NIST SP 800-53 AU-6 Audit Review, Analysis, and Reporting`,
    diagram: {
      type: 'flow',
      caption: '해시 일괄 수집',
      steps: [
        { label: '복제 권한 보유 계정', note: '도구 설치 잔여물' },
        { label: '복제 요청', note: 'DC 로그인 없이' },
        { label: '전 계정 해시 수신', note: '파일 흔적 없음' },
        { label: '오프라인 활용', note: '골든 티켓까지', danger: true },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '권한 보유 주체 판정',
      x: ['근거 있음', '근거 없음'],
      y: ['DC 컴퓨터 계정', '사용자 계정'],
      cells: ['정상', '점검 대상', '용도 확인', '즉시 회수'],
    },
  },
  {
    slug: 'krbtgt-rotation',
    title: '골든 티켓 대응과 krbtgt 키 회전',
    body: `krbtgt 계정의 키는 도메인 안 모든 Kerberos 티켓의 서명에 쓰인다. 이 키가 유출되면 공격자는 존재하지 않는 계정으로도, 아무 권한이나 담은 티켓을 스스로 만들어 낼 수 있다. 비밀번호를 바꾸거나 계정을 지워도 그 티켓은 계속 통한다. 침해 복구에서 이 키를 교체하지 않으면 정리했다고 말할 수 없다.

## 왜 계정을 지워도 통하는가?

Kerberos 는 티켓의 서명이 맞으면 그 안의 내용을 신뢰한다. 티켓 발급 단계에서 계정 상태를 다시 확인하지 않는 구간이 있기 때문이다.

| 조치 | 위조 티켓에 미치는 효과 |
| --- | --- |
| 사용자 비밀번호 변경 | 없음 |
| 계정 비활성화·삭제 | 없음(발급 없이 만들기 때문) |
| 특권 그룹에서 제거 | 없음(그룹 정보가 티켓 안에 있음) |
| krbtgt 키 교체 1회 | 이전 키 티켓 일부 유효 |
| krbtgt 키 교체 2회 | 무효화 |

![위조 티켓이 통하는 이유](/img/posts/krbtgt-rotation.svg)

## 두 번 교체해야 하는 이유

Active Directory 는 현재 키와 직전 키를 함께 유지한다. 한 번만 바꾸면 직전 키로 만든 티켓이 계속 통한다. 그래서 두 번 바꿔야 하는데, 연달아 바꾸면 정상 티켓도 함께 깨져 인증 장애가 난다. 복제가 끝나고 기존 티켓의 수명이 지난 뒤 두 번째를 실행한다.

\`\`\`
1차 교체 → 모든 DC 로 복제 확인 → 티켓 최대 수명 경과(기본 10시간+갱신 7일)
         → 2차 교체 → 복제 확인
급한 경우  티켓 수명을 임시로 줄여 대기 시간을 단축한다
\`\`\`

![교체 일정](/img/posts/krbtgt-rotation-2.svg)

## 실행과 확인 방법

복제 상태를 먼저 보고, 교체 후에도 다시 본다. 복제가 안 끝난 상태에서 두 번째를 실행하는 것이 가장 흔한 사고다.

\`\`\`powershell
# 교체 전 — 복제 상태와 현재 키 버전
repadmin /replsummary
Get-ADUser krbtgt -Properties msDS-KeyVersionNumber, PasswordLastSet |
  Select-Object msDS-KeyVersionNumber, PasswordLastSet

# 교체 (한 번) — 값은 무시되고 시스템이 무작위 키를 만든다
Set-ADAccountPassword -Identity krbtgt -Reset \\
  -NewPassword (ConvertTo-SecureString (New-Guid).Guid -AsPlainText -Force)

# 전 DC 에 복제됐는지 확인 후 대기, 그다음 한 번 더 실행
repadmin /showobjmeta * "CN=krbtgt,CN=Users,$((Get-ADDomain).DistinguishedName)" |
  Select-String 'unicodePwd|pwdLastSet'
\`\`\`

## 교체 뒤에 생기는 일

작업 후 몇 시간 동안 인증 오류가 늘어난다. 예약 작업과 서비스 계정, 오래 열려 있던 세션이 새 티켓을 받는 과정이다. 미리 공지하고, 실패가 계속되는 서비스는 재시작해 새 티켓을 받게 한다. 침해사고 대응 절차서에 이 작업의 순서와 대기 시간을 미리 적어 두면 실제 상황에서 판단할 일이 줄어든다.

## 실제로 이렇게 터진다

침해 대응에서 관리자 비밀번호를 전부 바꿨지만 인증 자격 증명 계정은 건드리지 않은 사례가 있다. 공격자가 만들어 둔 위조 티켓이 그대로 유효했고, 몇 주 뒤 다시 침입 흔적이 나왔다.

또 하나는 교체를 두 번 연속으로 한 경우다. 이전 값이 사라져 복제가 깨졌고 로그인 장애가 발생했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 관리자 비밀번호만 바꾸면 된다 | 위조 티켓이 남는다 |
| 한 번만 바꾸면 된다 | 두 번 바꿔야 이전 값이 무효 |
| 연속으로 두 번 하면 된다 | 복제 완료를 기다려야 한다 |
| 침해 때만 한다 | 정기 교체가 권장된다 |
| 영향이 없다 | 기존 티켓이 만료된다 |

## 왜 두 번인가

이 계정은 현재 값과 직전 값 두 개를 유지한다. 한 번 바꾸면 직전 값이 여전히 유효하므로 위조 티켓도 유효하다. 두 번 바꿔야 공격자가 알던 값이 완전히 밀려난다.

## 안전한 절차

1. 도메인 컨트롤러 복제 상태를 확인한다
2. 1차 교체를 한다
3. 복제가 모든 컨트롤러에 완료될 때까지 기다린다 — 최소 10시간 권장
4. 복제 완료를 확인한다
5. 2차 교체를 한다
6. 인증 오류를 모니터링한다

3번을 건너뛰면 복제가 어긋나 인증 장애가 난다. 급하더라도 기다려야 한다.

\`\`\`powershell
# 복제 상태 확인 — 오류가 없어야 다음 단계로 간다
repadmin /replsummary
repadmin /showrepl * /csv | ConvertFrom-Csv |
  Where-Object { $_.'Number of Failures' -gt 0 }

# 계정 비밀번호 최종 변경 시각
Get-ADUser krbtgt -Properties PasswordLastSet | Select-Object PasswordLastSet
\`\`\`

## 언제 하는가

| 상황 | 조치 |
| --- | --- |
| 도메인 침해 확인 | 즉시 2회 |
| 복제 권한 오남용 의심 | 2회 |
| 관리자 계정 유출 | 2회 |
| 정기 관리 | 6~12개월마다 1회 |

정기 교체를 해 두면 침해 시 유효 기간이 짧아진다. 다만 정기 교체는 한 번씩만 하고, 침해 대응 때만 두 번 연속으로 한다.

## 교체 후 확인

기존 티켓이 만료되면서 일부 서비스에서 재인증이 필요하다. 배치 작업, 서비스 계정 연결, 신뢰 관계를 교체 후 점검 항목에 넣는다.

## 참고

- Microsoft — AD Forest Recovery: Resetting the krbtgt password
- MITRE ATT&CK — T1558.001 Golden Ticket
- NIST SP 800-61, 침해사고 대응 복구 단계`,
    diagram: {
      type: 'steps',
      caption: '골든 티켓 성립',
      steps: [
        { label: 'krbtgt 키 유출', note: 'DCSync·DC 침해' },
        { label: '티켓 자체 생성', note: '발급 요청 없이' },
        { label: '임의 권한 삽입', note: '그룹 정보 위조' },
        { label: '장기 지속 접근', note: '계정 삭제와 무관' },
      ],
    },
    diagram2: {
      type: 'flow',
      caption: '두 번 교체',
      steps: [
        { label: '1차 교체', note: '직전 키 남음' },
        { label: '복제 확인', note: '전 DC' },
        { label: '수명 경과 대기', note: '정상 티켓 보호' },
        { label: '2차 교체', note: '위조 티켓 무효' },
      ],
    },
  },
  {
    slug: 'windows-audit-policy',
    title: '윈도 감사 로그 설계와 이벤트 선별',
    body: `윈도는 기본 설정으로도 이벤트를 남기지만, 침해 조사에 필요한 항목은 대부분 꺼져 있다. 반대로 다 켜면 하루에 수십 기가가 쌓여 보관 비용이 감당되지 않고 정작 필요한 이벤트가 묻힌다. 조사에서 실제로 쓰이는 이벤트는 스무 개 남짓이다. 그 목록을 정하고 그것만 확실히 남기는 것이 감사 로그 설계다.

## 어떤 이벤트가 실제로 쓰이는가?

| ID | 내용 | 쓰이는 국면 |
| --- | --- | --- |
| 4624 / 4625 | 로그온 성공·실패 | 최초 침해, 수평 이동 |
| 4648 | 명시적 자격 증명 로그온 | 자격 증명 재사용 |
| 4672 | 특권 할당 | 권한 상승 |
| 4688 | 프로세스 생성(명령줄 포함) | 실행 행위 전반 |
| 4698 / 4702 | 예약 작업 생성·변경 | 지속성 확보 |
| 4720 / 4732 | 계정 생성, 그룹 추가 | 백도어 계정 |
| 4769 | 서비스 티켓 요청 | Kerberoasting |
| 4662 | 디렉터리 개체 접근 | DCSync |
| 5140 / 5145 | 공유 접근 | 파일 유출 |
| 7045 | 서비스 설치 | 지속성 확보 |
| 1102 | 감사 로그 삭제 | 흔적 지우기 |

![이벤트와 조사 국면의 연결](/img/posts/windows-audit-policy.svg)

## 켜야 하는 두 가지 설정

기본 상태에서는 두 항목이 빠져 있어 4688 이 반쪽만 남는다. 명령줄 기록과 스크립트 블록 로그를 함께 켠다. 이 두 개가 조사 가능성을 가장 크게 바꾼다.

\`\`\`
컴퓨터 구성 → 관리 템플릿 → 시스템 → 감사 프로세스 만들기
  "프로세스 만들기 이벤트에 명령줄 포함"        : 사용
컴퓨터 구성 → 관리 템플릿 → Windows 구성 요소 → PowerShell
  "스크립트 블록 로깅 켜기"                     : 사용
  "모듈 로깅 켜기"                              : 사용
\`\`\`

명령줄 기록은 비밀번호가 인자로 넘어간 경우 그것까지 남긴다는 점을 유의한다. 로그 접근 통제와 마스킹을 함께 설계해야 한다.

![수집 우선순위와 보관 기간](/img/posts/windows-audit-policy-2.svg)

## 보관 기간은 어떻게 정하는가

침해가 발견되기까지 걸리는 시간을 기준으로 잡는다. 발견 시점에 이미 로그가 지워져 있으면 조사가 성립하지 않는다.

| 구간 | 기간 | 이유 |
| --- | --- | --- |
| 전송 계층 | 7일 | 수집 장애 대비 |
| 검색 가능 | 90일 | 대부분의 조사 범위 |
| 저비용 보관 | 1년 이상 | 뒤늦은 발견, 법적 요구 |

## 설정이 실제로 걸렸는지 확인한다

정책을 만든 것과 이벤트가 남는 것은 다르다. 대상 장비에서 직접 확인한다.

\`\`\`powershell
auditpol /get /category:*                       # 하위 범주별 실제 적용 상태
Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\Audit' -EA 0 |
  Select-Object ProcessCreationIncludeCmdLine_Enabled     # 1 이어야 한다

# 로그 크기와 덮어쓰기 설정 — 작으면 몇 시간 만에 사라진다
Get-WinEvent -ListLog Security, 'Microsoft-Windows-PowerShell/Operational' |
  Select-Object LogName, MaximumSizeInBytes, LogMode, RecordCount
\`\`\`

## 실제로 이렇게 터진다

침해 조사에서 필요한 이벤트가 기록되지 않은 사례가 있다. 기본 감사 정책만 켜져 있었고, 프로세스 생성과 명령줄이 남지 않았다. 무엇이 실행됐는지 알 방법이 없었다.

반대로 모든 감사를 켜서 로그가 수 분 만에 순환된 경우도 있다. 기록은 있었지만 이미 덮여 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 기본 설정이면 충분하다 | 조사에 필요한 것이 빠져 있다 |
| 많이 켤수록 좋다 | 순환으로 덮인다 |
| 로컬 로그면 된다 | 침해자가 지운다 |
| 로그 크기는 기본값이면 된다 | 며칠도 못 버틴다 |
| 이벤트 ID 만 알면 된다 | 필드 내용이 중요하다 |

## 반드시 켜야 할 것

| 항목 | 왜 |
| --- | --- |
| 프로세스 생성 + 명령줄 | 무엇이 실행됐나 |
| 로그온·로그오프 | 누가 언제 어디서 |
| 계정 관리 | 계정·그룹 변경 |
| 특권 사용 | 권한 상승 |
| 개체 접근 (선별) | 민감 파일 접근 |
| 정책 변경 | 감사 설정 변경 자체 |
| 스크립트 블록 로깅 | 난독화된 스크립트 내용 |

명령줄 기록과 스크립트 블록 로깅이 조사에서 가장 큰 차이를 만든다. 이 둘이 없으면 실행 사실만 알고 내용을 모른다.

## 로그가 덮이지 않게

| 항목 | 권장 |
| --- | --- |
| 보안 로그 크기 | 1GB 이상 |
| 전달 | 중앙 수집으로 즉시 전송 |
| 보존 | 중앙에서 1년 이상 |
| 로컬 정책 | 덮어쓰기 허용 (중앙 전송 전제) |

로컬에 오래 두려 하지 말고 중앙으로 보낸다. 침해자가 로컬 로그를 지워도 중앙에는 남는다.

\`\`\`powershell
# 현재 감사 정책 상태 — 성공/실패 모두 기록되는지
auditpol /get /category:* | Select-String -Pattern 'No Auditing' -Context 0,0

# 명령줄 기록 설정 여부
$k = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System\Audit'
Get-ItemProperty $k -Name ProcessCreationIncludeCmdLine_Enabled -ErrorAction SilentlyContinue
\`\`\`

## 조사에서 실제로 보는 이벤트

| 상황 | 확인 |
| --- | --- |
| 초기 침투 | 프로세스 생성, 스크립트 블록 |
| 자격 증명 탈취 | 특권 사용, 프로세스 접근 |
| 횡적 이동 | 로그온 유형 3·10 |
| 지속성 확보 | 서비스 설치, 작업 등록 |
| 흔적 삭제 | 로그 지우기 이벤트 |

마지막 항목은 그 자체가 강한 신호다. 로그 삭제 이벤트에 즉시 경보를 건다.

## 참고

- Microsoft — Audit Policy Recommendations, Advanced security audit policy settings
- MITRE ATT&CK — Data Source: Process Creation, Logon Session
- NIST SP 800-92, 로그 관리 지침`,
    diagram: {
      type: 'layers',
      caption: '조사 국면별 필요 이벤트',
      layers: [
        { label: '최초 침해', note: '4624·4625·4688' },
        { label: '권한 상승', note: '4672·4720·4732' },
        { label: '수평 이동', note: '4648·5140·4769' },
        { label: '지속성·흔적', note: '4698·7045·1102' },
      ],
    },
    diagram2: {
      type: 'bars',
      caption: '보관 기간 설계(일)',
      unit: '일',
      items: [
        { label: '전송 계층', value: 7, note: '장애 대비' },
        { label: '검색 가능', value: 90, note: '조사 주력' },
        { label: '저비용 보관', value: 365, note: '뒤늦은 발견' },
      ],
    },
  },
  {
    slug: 'entra-hybrid-risk',
    title: 'Entra ID 하이브리드 연결의 위험 지점',
    body: `사내 도메인과 클라우드 디렉터리를 연결하면 통합 인증이 편해지는 대신, 두 환경의 위험이 서로 넘어간다. 사내에서 얻은 권한으로 클라우드 테넌트를 장악할 수 있고, 반대 방향도 성립한다. 연결 방식에 따라 넘어가는 경로가 달라지므로, 어떤 방식으로 붙어 있는지부터 확인해야 한다.

## 연결 방식별로 무엇이 위험한가?

| 방식 | 비밀번호 검증 위치 | 주된 위험 |
| --- | --- | --- |
| 비밀번호 해시 동기화 | 클라우드 | 동기화 계정 탈취 시 광범위 |
| 통과 인증 | 사내 에이전트 | 에이전트 서버가 인증 관문 |
| 연합(AD FS) | 사내 AD FS | 서명 인증서 유출 시 토큰 위조 |
| 클라우드 전용 | 클라우드 | 사내 침해와 분리 |

연합 방식에서 서명 인증서가 유출되면 어떤 사용자로든 로그인 토큰을 만들 수 있다. 사내 침해가 곧바로 클라우드 전체 장악으로 이어지는 가장 짧은 경로다.

![두 환경 사이의 권한 이동 경로](/img/posts/entra-hybrid-risk.svg)

## 동기화 서버는 계층 0 이다

디렉터리 동기화 서버는 사내 계정 정보와 클라우드 자격 증명을 모두 다룬다. 그런데 업무 서버와 같은 대역에 두고 일반 관리자가 접속하는 경우가 흔하다. 이 서버는 도메인 컨트롤러와 같은 등급으로 다뤄야 한다.

\`\`\`
동기화 서버   전용 관리 계정, 별도 대역, 인터넷 접근 최소화
동기화 계정   사내 쪽 권한을 필요한 조직 단위로 한정
연결 계정     클라우드 쪽 역할을 디렉터리 동기화 전용으로
인증서        연합을 쓰면 서명 인증서를 HSM 또는 별도 보관
\`\`\`

![동기화 경로 통제](/img/posts/entra-hybrid-risk-2.svg)

## 사내에서 클라우드로 넘어가는 것을 어떻게 막는가

특권 클라우드 역할을 사내 계정과 분리하는 것이 핵심이다. 전역 관리자 역할을 동기화된 계정에 붙이면 사내 침해가 곧 클라우드 침해가 된다.

1. 클라우드 특권 역할은 클라우드 전용 계정에만 부여한다
2. 그 계정에는 패스키를 등록하고 비밀번호 로그인을 막는다
3. 상시 권한을 없애고 필요한 시간에만 승격받게 한다
4. 비상 접근 계정 두 개를 만들어 조건부 접근 정책에서 제외하고, 사용 시 경보를 띄운다

## 지금 확인할 항목

연결 방식과 특권 역할의 출신을 본다.

\`\`\`bash
# 연결 방식 확인 — 도메인별 인증 유형
az rest --method get \\
  --url 'https://graph.microsoft.com/v1.0/domains?$select=id,authenticationType'

# 특권 역할 보유자가 사내 동기화 계정인지 — onPremisesSyncEnabled 가 true 면 검토 대상
az rest --method get \\
  --url "https://graph.microsoft.com/v1.0/directoryRoles" \\
  --query "value[?displayName=='Global Administrator'].id" -o tsv |
while read -r id; do
  az rest --method get \\
    --url "https://graph.microsoft.com/v1.0/directoryRoles/$id/members?\$select=userPrincipalName,onPremisesSyncEnabled"
done
\`\`\`

## 실제로 이렇게 터진다

온프레미스와 클라우드를 연결한 뒤, 동기화 계정의 권한을 확인하지 않은 사례가 있다. 그 계정은 양쪽 모두에 강한 권한을 갖고 있었고, 한쪽 침해가 다른 쪽으로 그대로 이어졌다.

또 하나는 조건부 접근 정책을 만들면서 동기화 계정을 예외로 둔 경우다. 그 계정은 어디서든 다중 인증 없이 접근할 수 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 클라우드로 옮기면 안전해진다 | 연결 지점이 새 위험이다 |
| 동기화 계정은 시스템 계정이다 | 침해 시 양쪽이 뚫린다 |
| 예외는 어쩔 수 없다 | 예외에 조건을 붙일 수 있다 |
| 온프레미스만 지키면 된다 | 클라우드 관리자도 온프레미스에 영향 |
| 동기화 서버는 일반 서버다 | 계층 0 자산이다 |

## 연결이 만드는 경로

| 방향 | 경로 |
| --- | --- |
| 온프레미스 → 클라우드 | 동기화 계정, 인증 연동 |
| 클라우드 → 온프레미스 | 관리 에이전트, 비밀번호 재설정 |
| 양방향 | 동기화 서버 자체 |

동기화 서버는 양쪽 자격 증명을 다룬다. 그래서 도메인 컨트롤러와 같은 등급으로 보호해야 한다.

## 반드시 확인할 것

1. 동기화 서버를 계층 0 으로 분류하고 관리 경로를 분리한다
2. 동기화 계정에 조건부 접근 정책을 적용한다 — 지정 IP 에서만
3. 클라우드 관리자 계정을 온프레미스와 분리한다 — 동기화 대상 제외
4. 비밀번호 되쓰기 기능이 필요한지 재검토한다
5. 동기화 계정의 사용 기록을 감사한다

3번이 중요하다. 클라우드 전역 관리자가 온프레미스에서 동기화된 계정이면, 온프레미스 침해가 클라우드 전체로 이어진다. 클라우드 전용 관리 계정을 별도로 둔다.

## 점검

\`\`\`powershell
# 클라우드 전역 관리자 중 온프레미스에서 동기화된 계정 — 분리 대상
Get-MgDirectoryRoleMember -DirectoryRoleId $globalAdminRoleId |
  ForEach-Object { Get-MgUser -UserId $_.Id -Property OnPremisesSyncEnabled, UserPrincipalName } |
  Where-Object { $_.OnPremisesSyncEnabled } |
  Select-Object UserPrincipalName
\`\`\`

목록이 비어 있어야 한다. 하나라도 있으면 클라우드 전용 관리 계정으로 대체한다.

## 비상 계정과의 관계

클라우드 전용 관리 계정 중 최소 두 개는 조건부 접근 정책에서 제외해 둔다. 정책 오설정으로 전원이 잠기는 상황을 막기 위해서다. 대신 그 계정에는 강력한 다중 인증과 사용 시 즉시 알림을 건다.

## 참고

- Microsoft — Protecting Microsoft 365 from on-premises attacks
- Microsoft — Securing privileged access for hybrid deployments
- MITRE ATT&CK — T1484.002 Domain Trust Modification`,
    diagram: {
      type: 'flow',
      caption: '사내에서 클라우드로',
      steps: [
        { label: '사내 계정 침해', note: '단말·메일' },
        { label: '동기화 서버 접근', note: '계층 혼용' },
        { label: '동기화 계정 탈취', note: '양쪽 권한 보유' },
        { label: '클라우드 테넌트 장악', note: '전역 관리자', danger: true },
      ],
    },
    diagram2: {
      type: 'matrix',
      caption: '특권 계정 출신과 위험',
      x: ['클라우드 전용', '사내 동기화'],
      y: ['상시 권한 없음', '상시 권한'],
      cells: ['권장', '사내 침해 전이', '승격 기록 남음', '즉시 장악'],
    },
  },
]
