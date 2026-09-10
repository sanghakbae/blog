const R = String.raw
export default {

'detection-rule-lifecycle': R`## 규칙 건강 점검

동작하지 않는 규칙을 찾는 것부터 시작한다.

\`\`\`bash
psql -Atc "SELECT rule_id, name,
                  coalesce(to_char(last_matched_at,'YYYY-MM-DD'),'없음') AS 마지막매칭,
                  fp_rate AS 오탐률
           FROM detection_rules WHERE enabled
           ORDER BY last_matched_at NULLS FIRST" | head -30
\`\`\`

매칭이 없는 규칙은 죽었거나 원래 드문 것이다. 목록에 올려 두고 하나씩 이유를 확인한다. 오탐률이 높은 규칙은 조정 대상이고, 조정이 어려우면 끄는 편이 낫다.`,

'alert-triage-workflow': R`## 처리량 측정

지금 감당 가능한 수준인지 숫자로 본다.

\`\`\`bash
psql -Atc "SELECT date_trunc('day', at) d,
                  count(*) AS 전체,
                  count(*) FILTER (WHERE auto_closed) AS 자동종결,
                  count(*) FILTER (WHERE NOT auto_closed) AS 사람검토
           FROM alerts WHERE at > now() - interval '14 days'
           GROUP BY 1 ORDER BY 1"
\`\`\`

사람 검토 수를 담당 인원으로 나눈 값이 하루 20을 넘으면 제대로 못 보고 있는 것이다. 자동 종결 비율을 올리는 것이 인원을 늘리는 것보다 빠르다.`,

'log-normalization': R`## 파싱 실패율 감시

형식이 바뀌면 파싱이 깨지고, 조용히 데이터가 빈다.

\`\`\`bash
psql -Atc "SELECT source, count(*) AS 전체,
                  count(*) FILTER (WHERE parsed IS NULL) AS 실패,
                  round(100.0*count(*) FILTER (WHERE parsed IS NULL)/count(*),1) AS 실패율
           FROM raw_logs WHERE at > now() - interval '1 day'
           GROUP BY 1 ORDER BY 실패율 DESC"
\`\`\`

실패율이 갑자기 오르면 원본 형식이 바뀐 것이다. 이 지표를 대시보드에 두면 형식 변경을 그날 안다.`,

'security-metrics-that-matter': R`## 지표 한 장

경영 보고에는 다섯 개를 넘기지 않는다. 전부 줄어야 좋은 방향으로 고른다.

| 지표 | 이번 분기 | 지난 분기 |
| --- | --- | --- |
| 미조치 고위험 취약점 | | |
| 평균 조치 소요 일수 | | |
| 관리되지 않는 자산 비율 | | |
| 상시 관리자 권한 계정 수 | | |
| 다중 인증 미적용 계정 수 | | |

빈칸을 채우는 것이 첫 작업이다. 채울 수 없는 항목이 있다면 그 자체가 개선 대상이다. 측정할 수 없으면 관리할 수도 없다.`,

'threat-hunting-hypothesis': R`## 가설 기록 양식

한 회차를 이 형태로 남기면 다음 회차에 재사용된다.

\`\`\`
가설      서비스 계정이 평소 안 쓰던 리전에서 호출됐다
데이터    감사 로그 90일
질의      계정별 리전 분포
정상 범위 계정마다 리전 1~2개
결과      계정 3개가 3개 리전 사용 — 확인 결과 정상 배포
후속      리전 목록을 기준선으로 저장, 벗어나면 경보
소요      2시간
\`\`\`

결과가 정상이어도 기준선을 얻었다. 그것을 규칙으로 만들면 다음부터 자동으로 본다.`,

'siem-tuning': R`## 상위 규칙부터

경보 분포는 대개 한쪽에 몰려 있다. 상위 열 개만 처리해도 크게 준다.

\`\`\`bash
psql -Atc "SELECT rule_name, count(*) c,
                  count(*) FILTER (WHERE verdict='false_positive') fp
           FROM alerts WHERE at > now() - interval '7 days'
           GROUP BY 1 ORDER BY c DESC LIMIT 15"
\`\`\`

건수가 많고 오탐 비율이 높은 것부터 본다. 표본 몇 건을 열어 정상 활동인지 확인하고, 맞으면 제외 조건을 넣는다. 무엇을 제외했고 무엇을 포기했는지 함께 기록한다.`,

'canary-token-usage': R`## 배치 목록

어디에 무엇을 심었는지 기록하지 않으면 나중에 정리하지 못한다.

| 토큰 | 위치 | 심은 날 | 경보 대상 |
| --- | --- | --- | --- |
| 가짜 액세스 키 | 웹 서버 설정 파일 | | |
| 가짜 계정 | 데이터베이스 회원 테이블 | | |
| 추적 문서 | 공유 폴더 기밀 폴더 | | |
| 가짜 API 키 | 저장소 예시 설정 | | |

이 문서 자체가 민감하므로 접근을 제한한다. 토큰이 정상 업무에서 쓰이지 않는지 심은 뒤 일주일간 확인한다.`,

'baseline-establishment': R`## 기준선 수집 질의

요일과 시간대를 함께 보는 것이 핵심이다.

\`\`\`bash
psql -Atc "SELECT extract(dow from at)::int d, extract(hour from at)::int h,
                  count(*) c, round(avg(count(*)) over (), 1) 전체평균
           FROM auth_log WHERE at > now() - interval '28 days'
           GROUP BY 1,2 ORDER BY 1,2" | head -40
\`\`\`

평일 업무 시간과 야간·주말의 차이가 크면 단일 임계값은 쓸 수 없다. 시간대별 상위 백분위를 기준으로 잡으면 오탐이 크게 준다.`,

'attack-simulation-purple': R`## 결과 기록표

기법별로 어느 단계에서 끊겼는지 남긴다. 이 표가 탐지 능력의 현황이다.

| 기법 | 로그 | 전송 | 파싱 | 규칙 | 경보 | 대응 |
| --- | --- | --- | --- | --- | --- | --- |
| 자격 증명 덤프 | | | | | | |
| 예약 작업 등록 | | | | | | |
| 원격 서비스 생성 | | | | | | |
| 대량 데이터 조회 | | | | | | |

한 칸이라도 비면 그 기법은 탐지되지 않는다. 분기마다 갱신하면 개선 추이가 보인다. 새 기법을 추가할 때 행만 늘리면 된다.`,

'log-integrity-protection': R`## 전송 끊김 감지

로그가 없는 것이 조용해서인지 끊겨서인지 구분해야 한다.

\`\`\`bash
psql -Atc "SELECT host, max(at) AS 마지막수신,
                  now() - max(at) AS 경과
           FROM log_heartbeat GROUP BY 1
           HAVING now() - max(at) > interval '15 minutes'
           ORDER BY 2"
\`\`\`

주기 신호를 보내게 하면 이 질의로 끊긴 호스트를 알 수 있다. 신호가 끊긴 시점이 침해 시작 시점과 겹치면 은폐 시도를 의심한다.`,
}
