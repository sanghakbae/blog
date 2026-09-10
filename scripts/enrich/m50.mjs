const R = String.raw
export default {

'browser-extension-risk': R`## 설치 현황 확인

무엇이 설치돼 있는지 먼저 본다. 예상 밖의 것이 나온다.

\`\`\`bash
# 관리 도구가 있으면 목록을 뽑는다. 없으면 표본 조사로 시작한다.
# macOS 크롬 예: 프로필별 확장 디렉터리
ls ~/Library/Application\ Support/Google/Chrome/*/Extensions 2>/dev/null | head -20
\`\`\`

목록이 나오면 각 확장의 요구 권한을 확인한다. 모든 사이트 접근을 요구하는 것이 우선 검토 대상이다.

업무 프로필과 개인 프로필을 나누도록 안내하는 것만으로도 노출 범위가 크게 준다.`,

'email-authentication-setup': R`## 보고서 읽기

인증에 실패하는 발신을 하나씩 확인한다.

| 발신 IP | 건수 | 인증 결과 | 추정 출처 | 조치 |
| --- | --- | --- | --- | --- |
| | | | | |

우리 것이면 발신 목록에 등록하고, 아니면 사칭이다. 사칭이 확인되면 거부 모드 전환을 앞당길 근거가 된다.

설정을 마친 뒤에도 보고서를 계속 받는다. 부서에서 새 도구를 도입하면 실패로 나타난다.`,

'security-headers-checklist': R`## 적용 상태 확인

배포 후 실제 응답을 본다. 설정했다고 적용된 것이 아니다.

\`\`\`bash
for p in / /api/health /static/app.js; do
  printf '\n== %s\n' "$p"
  curl -sI "https://example.com$p" \
    | grep -iE 'strict-transport|content-security|x-content-type|referrer-policy|permissions-policy'
done
\`\`\`

경로마다 다른 경우가 있다. 앞단 프록시와 애플리케이션이 각자 헤더를 붙이면 충돌하거나 누락된다.

한곳에서 관리하도록 정리하고 이 확인을 배포 점검 항목에 넣는다.`,

'vulnerability-disclosure-policy': R`## 창구 점검

제보하려는 사람이 실제로 우리를 찾을 수 있는지 확인한다.

\`\`\`bash
curl -s https://example.com/.well-known/security.txt
curl -sI https://example.com/.well-known/security.txt | head -1
\`\`\`

파일이 없으면 제보자가 연락처를 찾지 못한다. 만료일이 지났으면 갱신한다.

접수 주소가 실제로 수신되는지도 시험한다. 아무도 보지 않는 주소로 설정된 경우가 있다. 자동 회신이 즉시 가는지 함께 확인한다.`,

'security-in-startups': R`## 여섯 가지 점검

우선순위 항목이 실제로 되어 있는지 본다.

| 항목 | 상태 | 확인 방법 |
| --- | --- | --- |
| 다중 인증 전면 적용 | | 계정 목록 조회 |
| 백업 복원 시험 | | 실제로 복원 |
| 관리자 권한 정리 | | 보유자 목록 |
| 자산 목록 | | 최신 여부 |
| 패치 관리 | | 미적용 수 |
| 로그 수집 | | 보존 기간 |

두 번째 항목이 가장 자주 비어 있다. 백업은 있는데 복원해 본 적이 없다. 그것부터 한다.`,

'security-review-of-vendors-tools': R`## 미등록 도구 찾기

목록에 없는 사용을 발견하는 것이 시작이다.

\`\`\`bash
# 회사 계정으로 로그인한 외부 서비스
grep -iE 'saml|oauth' /var/log/auth-proxy.log \
  | grep -oE 'sp=[a-z0-9.-]+' | sort | uniq -c | sort -rn | head -20

# 법인카드 SaaS 결제 내역과 대조
comm -23 <(cut -d, -f2 card-saas.csv | sort -u) <(cut -f1 approved-tools.txt | sort -u)
\`\`\`

나온 것을 벌하지 말고 목록에 등록하고 등급을 매긴다. 파악되지 않은 사용이 가장 위험하다.`,

'incident-severity-communication': R`## 통지 경로 시험

훈련에서 실제로 보내 본다.

| 경로 | 대상 | 도달 확인 | 소요 |
| --- | --- | --- | --- |
| 전화 | 1차 책임자 | | |
| 전화 | 대체 책임자 | | |
| 채널 알림 | 대응팀 | | |
| 메일 | 경영진 | | |

도달하지 않는 경로가 반드시 하나는 나온다. 번호가 바뀌었거나 알림이 꺼져 있다. 분기마다 확인한다.

새벽 시간대에도 도달하는지 별도로 확인한다.`,

'annual-security-review': R`## 외부 시각 점검

안에서 보는 것과 밖에서 보이는 것이 다르다.

\`\`\`bash
# 우리 도메인의 하위 이름 (인증서 기록)
curl -s "https://crt.sh/?q=%25.example.com&output=json" \
  | python3 -c 'import json,sys;print("\n".join(sorted({r["name_value"] for r in json.load(sys.stdin)})))' \
  | head -40

# 응답하는 것만 추리기
while read -r h; do
  curl -s -o /dev/null -m 3 -w "%{http_code} $h\n" "https://$h" 2>/dev/null
done < subdomains.txt | grep -v '^000'
\`\`\`

목록에 없는 이름이 응답하면 관리 밖 자산이다. 매년 몇 개씩 나온다.`,
}
