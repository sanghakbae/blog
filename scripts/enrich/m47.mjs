const R = String.raw
export default {

'payment-idempotency': R`## 동시 요청 시험

같은 키로 동시에 보내 하나만 처리되는지 확인한다.

\`\`\`bash
K=$(uuidgen)
seq 20 | xargs -P 20 -I{} curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST -H "Idempotency-Key: $K" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"amount":1000}' \
  https://api.example.com/payments | sort | uniq -c
\`\`\`

200 이 하나이고 나머지가 200(저장된 결과) 또는 409 여야 한다. 여러 건이 실제로 처리됐다면 고유 제약이나 조건부 삽입이 빠진 것이다.`,

'card-data-scope-reduction': R`## 로그 점검

카드 번호 형식이 로그에 남는지 정기적으로 확인한다.

\`\`\`bash
# 로그에 카드 번호 형식이 있는지 (검사용, 결과는 즉시 폐기)
grep -rEo '\b[0-9]{13,19}\b' /var/log/app/*.log 2>/dev/null \
  | awk -F: '{print $1}' | sort | uniq -c | head
\`\`\`

파일 이름만 확인하고 값은 보지 않는다. 나오면 그 지점의 로깅을 수정하고 기존 로그를 폐기한다.

오류 보고 도구에도 요청 본문이 들어가는 경우가 있다. 그쪽 설정도 함께 확인한다.`,

'fraud-detection-basics': R`## 규칙 효과 측정

네 숫자를 함께 본다. 하나만 개선하면 다른 것이 나빠진다.

\`\`\`bash
psql -Atc "SELECT date_trunc('week', at) w,
  count(*) FILTER (WHERE blocked AND fraud) 정탐차단,
  count(*) FILTER (WHERE blocked AND NOT fraud) 오탐차단,
  count(*) FILTER (WHERE NOT blocked AND fraud) 통과된부정,
  count(*) FILTER (WHERE manual_review) 수동검토
FROM orders WHERE at > now() - interval '3 months' GROUP BY 1 ORDER BY 1"
\`\`\`

오탐 차단의 매출 손실과 통과된 부정의 손실을 함께 계산해 임계값을 정한다.`,

'refund-abuse-prevention': R`## 반복 환불 계정 확인

자동 차단 전에 사람이 본다.

\`\`\`bash
psql -Atc "SELECT user_id, count(*) 주문,
                  count(*) FILTER (WHERE refunded) 환불,
                  round(100.0*count(*) FILTER (WHERE refunded)/count(*),1) 비율,
                  string_agg(DISTINCT refund_reason, ',') 사유
           FROM orders WHERE created_at > now() - interval '180 days'
           GROUP BY 1 HAVING count(*) >= 5 AND
                  count(*) FILTER (WHERE refunded) >= 3
           ORDER BY 비율 DESC LIMIT 20"
\`\`\`

사유가 상품 문제로 몰려 있으면 악용이 아니라 상품 개선이 필요한 것이다.`,

'financial-api-security': R`## 대사 확인

양측 기록이 맞는지 정기적으로 본다.

\`\`\`bash
psql -Atc "SELECT date_trunc('day', at) d,
                  count(*) 우리기록,
                  count(*) FILTER (WHERE reconciled) 대사완료,
                  count(*) FILTER (WHERE status='unknown') 상태불명
           FROM payment_tx WHERE at > now() - interval '14 days'
           GROUP BY 1 ORDER BY 1"
\`\`\`

상태 불명이 남아 있으면 조회로 확정한다. 추측으로 처리하면 금액이 어긋난다. 대사 미완이 쌓이면 연동에 문제가 있다는 신호다.`,

'healthcare-data-handling': R`## 열람 기록 점검

담당 관계가 없는 열람을 찾는다.

\`\`\`bash
psql -Atc "SELECT v.staff_id, v.patient_id, v.at
           FROM record_views v
           LEFT JOIN care_relations c
             ON c.staff_id = v.staff_id AND c.patient_id = v.patient_id
           WHERE c.id IS NULL AND v.at > now() - interval '30 days'
           ORDER BY v.at DESC LIMIT 30"
\`\`\`

정당한 사유가 있는 경우도 있으므로 목록을 담당 부서와 함께 확인한다. 점검이 이뤄진다는 사실 자체가 부적절한 열람을 억제한다.`,

'ecommerce-account-takeover': R`## 탈취 신호 조합

단일 신호보다 조합이 정확하다.

\`\`\`bash
psql -Atc "SELECT o.user_id, o.at, o.amount
           FROM orders o
           JOIN addresses a ON a.user_id = o.user_id
           WHERE a.created_at > o.at - interval '1 hour'
             AND o.amount > 300000
             AND o.at > now() - interval '7 days'
           ORDER BY o.at DESC"
\`\`\`

배송지를 추가한 직후 고액 주문이 나오는 조합이 전형적인 패턴이다. 이 조합에 추가 인증을 요구하면 상당수가 막힌다.`,

'saas-tenant-security': R`## 격리 회귀 시험

배포마다 자동으로 확인한다.

\`\`\`bash
# 테넌트 A 토큰으로 테넌트 B 자원 접근 — 전부 403/404 여야 한다
for id in $B_RESOURCE_IDS; do
  code=$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN_A" "https://api.example.com/items/$id")
  [ "$code" = "200" ] && echo "격리 실패: $id"
done
\`\`\`

새 엔드포인트를 추가할 때 이 목록에도 추가하는 것을 규칙으로 만든다. 격리 회귀는 조용히 일어난다.`,

'gaming-abuse-prevention': R`## 통계적 이상 찾기

물리적으로 불가능한 수치를 먼저 본다.

\`\`\`bash
psql -Atc "SELECT user_id, sum(gold_gained) 획득, count(*) 세션,
                  round(sum(gold_gained)::numeric / nullif(sum(play_seconds),0) * 3600, 0) 시간당
           FROM play_sessions WHERE at > now() - interval '7 days'
           GROUP BY 1 ORDER BY 시간당 DESC NULLS LAST LIMIT 20"
\`\`\`

상위 몇 명이 나머지와 자릿수가 다르면 조사 대상이다. 즉시 정지하지 않고 관찰하며 기록을 모은 뒤 일괄 조치하면 탐지 방식이 덜 노출된다.`,

'iot-device-lifecycle': R`## 갱신 현황

버전 분포를 보면 관리 밖 기기가 드러난다.

\`\`\`bash
psql -Atc "SELECT firmware_version, count(*) 대수,
                  max(last_seen_at) 최근접속
           FROM devices GROUP BY 1 ORDER BY 대수 DESC"
\`\`\`

옛 버전이 특정 지역이나 모델에 몰려 있으면 원인이 있다. 갱신이 실패하는지, 접속이 안 되는지 확인한다.

오래 접속하지 않은 기기는 고장이거나 분실이다. 자격 증명을 무효화할 대상이다.`,
}
