const R = String.raw
export default {

'phishing-simulation-ethics': R`## 회차별 기록

클릭률이 아니라 신고 지표를 추적한다.

| 회차 | 발송 | 신고 | 클릭 | 자격 증명 입력 | 신고까지 평균 |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

신고 건수와 신고까지 걸린 시간이 실제 대응력을 보여 준다. 클릭률은 미끼 난이도에 따라 크게 달라져 회차 간 비교가 어렵다.

반복 클릭자는 개별 지원 대상으로 두되 명단을 공개하지 않는다. 기술적 보완으로 해결할 수 있는 부분이 대부분이다.`,

'security-awareness-content': R`## 효과 측정

이수율 대신 행동 지표를 본다.

\`\`\`bash
psql -Atc "SELECT date_trunc('quarter', at) q,
                  count(*) FILTER (WHERE type='phishing_report') 피싱신고,
                  count(*) FILTER (WHERE type='security_question') 보안문의,
                  count(*) FILTER (WHERE type='near_miss') 아차사고
           FROM security_events WHERE at > now() - interval '2 years'
           GROUP BY 1 ORDER BY 1"
\`\`\`

세 지표가 함께 오르면 교육이 작동하는 것이다. 보안 문의가 느는 것은 좋은 신호다. 모르는 것을 묻는 문화가 생긴 것이다.`,

'insider-threat-program': R`## 실수 지점 찾기

무엇이 반복되는지 보고 장치를 붙인다.

| 사건 유형 | 건수 | 원인 | 장치 |
| --- | --- | --- | --- |
| 오발송 | | 수신자 확인 없음 | 외부 수신자 경고 |
| 잘못된 공개 설정 | | 기본값 공개 | 기본값 비공개 |
| 대량 반출 실수 | | 확인 단계 없음 | 건수 확인 |
| 권한 과다 부여 | | 승인 없음 | 승인 절차 |

같은 유형이 반복되면 교육이 아니라 장치가 필요하다는 뜻이다. 경고 창 하나가 반복 사고를 크게 줄인다.`,

'social-engineering-defense': R`## 절차 시험

실제로 절차가 작동하는지 확인한다. 사전 합의 후 진행한다.

| 시나리오 | 확인 |
| --- | --- |
| 임원 사칭 긴급 송금 요청 | 재확인 절차 작동 |
| 계좌 변경 요청 | 등록 경로로 확인 |
| 계정 초기화 요청 | 정해진 항목만 확인 |
| 권한 부여 구두 요청 | 시스템 요청으로 유도 |

절차를 지켜 거절한 사람을 보호하고 그 사례를 공유한다. 거절이 정상이라는 인식이 생겨야 다음에도 지켜진다.`,

'offboarding-checklist': R`## 정기 대조

개별 처리에 의존하지 않고 자동으로 찾는다.

\`\`\`bash
# 퇴사자 명단과 활성 계정 대조
comm -12 <(cut -d, -f1 leavers.csv | sort) <(list_active_accounts | sort)

# 외부 서비스별 사용자 목록과 대조
for svc in slack notion figma; do
  echo "== $svc"
  comm -12 <(cut -d, -f1 leavers.csv | sort) <(list_users_"$svc" | sort)
done
\`\`\`

통합 인증에 연결되지 않은 서비스가 문제다. 그런 서비스 목록을 만들어 대조 대상에 넣는다.`,

'security-team-structure': R`## 병목 확인

승인 대기가 쌓이면 구조 문제다.

\`\`\`bash
psql -Atc "SELECT date_trunc('week', requested_at) w,
                  count(*) 요청, avg(approved_at - requested_at) 평균대기
           FROM security_reviews WHERE requested_at > now() - interval '3 months'
           GROUP BY 1 ORDER BY 1"
\`\`\`

평균 대기가 며칠을 넘으면 우회가 시작된다. 승인 대상을 줄이고 자동 검사와 안전한 기본값으로 옮긴다.

요청 건수가 갑자기 줄면 개선된 것이 아니라 요청하지 않게 된 것일 수 있다.`,

'security-onboarding-developers': R`## 첫 주 확인표

신입이 첫 주에 이것을 마쳤는지 본다.

| 항목 | 확인 |
| --- | --- |
| 비밀 관리 도구 설정 | 실제로 값을 가져와 봤나 |
| 커밋 전 검사 설치 | 동작 확인 |
| 사내 라이브러리 안내 | 어디 있는지 안다 |
| 질문 채널 | 가입 |
| 담당 챔피언 | 만났다 |

체크리스트가 아니라 실제로 해 봤는지가 기준이다. 설정 파일만 배포하면 절반은 적용되지 않는다.`,

'security-culture-signals': R`## 분기 관찰

숫자보다 방향을 본다.

| 신호 | 지난 분기 | 이번 분기 | 방향 |
| --- | --- | --- | --- |
| 보안 문의 건수 | | | 늘어야 좋음 |
| 문의 평균 응답 시간 | | | 줄어야 좋음 |
| 아차 사고 신고 | | | 늘어야 좋음 |
| 피싱 신고율 | | | 늘어야 좋음 |
| 예외 요청 건수 | | | 맥락 확인 |
| 우회 경로 발견 | | | 줄어야 좋음 |

응답 시간이 가장 실질적이다. 답이 느리면 나머지 지표가 전부 나빠진다.`,

'security-communication': R`## 전달 경로별 처리율

어떤 경로가 실제로 처리되는지 재 본다.

\`\`\`bash
psql -Atc "SELECT channel, count(*) 전달, count(*) FILTER (WHERE fixed_at IS NOT NULL) 처리,
                  round(100.0*count(*) FILTER (WHERE fixed_at IS NOT NULL)/count(*),1) 처리율
           FROM security_findings WHERE created_at > now() - interval '6 months'
           GROUP BY 1 ORDER BY 처리율 DESC"
\`\`\`

이슈 시스템으로 들어간 것과 메일로 보낸 것의 처리율 차이가 크다. 개발팀이 쓰는 흐름에 넣어야 처리된다.`,

'remote-work-security': R`## 접근 조건 점검

단말 상태가 실제로 확인되는지 본다.

\`\`\`bash
# 등록되지 않은 단말에서의 접근 시도
psql -Atc "SELECT date_trunc('day', at) d, count(*) 시도,
                  count(*) FILTER (WHERE allowed) 허용
           FROM device_access_log
           WHERE NOT managed_device AND at > now() - interval '30 days'
           GROUP BY 1 ORDER BY 1"
\`\`\`

허용 건수가 0이 아니면 조건이 강제되지 않는 경로가 있다. 그 경로를 찾아 막는다. 예외가 필요하면 명시적으로 등록하고 만료를 둔다.`,
}
