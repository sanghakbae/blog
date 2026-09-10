const R = String.raw
export default {

'prompt-injection-defense': R`## 위험 조합 점검

읽기와 쓰기가 한 세션에 함께 있는 구성을 찾는다.

| 에이전트 | 외부 내용 읽기 | 쓰기 도구 | 외부 전송 | 판단 |
| --- | --- | --- | --- | --- |
| | | | | |

세 열이 모두 예이면 가장 위험한 조합이다. 외부 내용을 읽은 뒤에는 되돌릴 수 없는 작업을 승인 없이 하지 못하게 한다.

이 표를 에이전트마다 채워 보면 어디를 먼저 손봐야 하는지 드러난다. 도구 목록만 보고는 알 수 없다.`,

'llm-data-boundary': R`## 전송 내용 확인

무엇이 실제로 나가는지 한 번 찍어 본다.

\`\`\`bash
# 요청 본문에 개인정보 형식이 있는지 (개발 환경에서)
grep -oE '[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' \
  /var/log/llm-requests.log | sort -u | head
\`\`\`

문맥에 자동으로 포함되는 정보가 있다. 사용자 프로필, 이전 대화, 첨부 문서가 그렇다. 의도한 것만 나가는지 확인한다.

로그 자체에 그 내용이 남는 것도 문제다. 확인 후 로깅 설정을 조정한다.`,

'ai-agent-audit-trail': R`## 조사 가능성 확인

실제 세션 하나를 골라 재구성해 본다.

\`\`\`bash
psql -Atc "SELECT step, tool, source, result, rows_affected
           FROM agent_trace WHERE session_id = :sid ORDER BY step"
\`\`\`

이 결과만으로 "어떤 데이터에 접근했고 무엇을 바꿨나" 에 답할 수 있어야 한다. 답할 수 없으면 기록 항목이 부족한 것이다.

특히 쓰기 도구의 대상과 영향 행 수가 있어야 한다. 없으면 사고 시 범위를 산정할 수 없다.`,

'model-endpoint-security': R`## 비용 급증 감시

토큰 사용량을 계정별로 본다.

\`\`\`bash
psql -Atc "SELECT account, date_trunc('hour', at) h, sum(tokens) 토큰
           FROM inference_log WHERE at > now() - interval '2 days'
           GROUP BY 1,2 HAVING sum(tokens) > 1000000
           ORDER BY 토큰 DESC LIMIT 20"
\`\`\`

평소 사용량의 몇 배가 넘는 시간대가 있으면 확인한다. 예산 상한을 걸고 초과 시 자동으로 제한하는 장치가 함께 있어야 한다.

내부용 엔드포인트도 인증과 제한을 건다. 침해 후 경로가 된다.`,

'training-data-governance': R`## 데이터 목록

어떤 모델이 어떤 데이터로 만들어졌는지 추적할 수 있어야 한다.

| 데이터셋 | 출처 | 권리 근거 | 개인정보 처리 | 사용 모델 |
| --- | --- | --- | --- | --- |
| | | | | |

문제가 생겼을 때 영향 범위를 이 표로 판단한다. 라이선스 문제가 발견되면 해당 데이터를 쓴 모델을 전부 찾아야 한다.

삭제 요청 대응 방침도 함께 정한다. 원본 삭제와 다음 학습 제외까지가 현실적인 범위다.`,

'ai-output-attribution': R`## 사용 현황 파악

정책을 만들기 전에 지금 어디에 쓰고 있는지 조사한다.

| 업무 | 용도 | 검토 여부 | 대외 노출 | 위험 |
| --- | --- | --- | --- | --- |
| | | | | |

현업에 물어보면 예상보다 많은 곳에서 쓰고 있다. 이미 쓰는 방식을 모르고 정책을 만들면 현실과 어긋난다.

대외 노출이 있고 검토가 없는 항목이 우선 대상이다. 그것부터 검토 절차를 붙인다.`,

'ai-supply-chain-risk': R`## 구성 요소 목록

취약점 공개 시 영향 범위를 즉시 판단할 수 있어야 한다.

\`\`\`bash
# 설치된 도구와 확장의 권한 요구 확인
cat mcp-servers.json 2>/dev/null \
  | jq -r '.servers[] | "\(.name) \(.permissions // [] | join(","))"'
\`\`\`

권한이 기능에 비해 과도한 것을 찾는다. 파일 읽기만 필요한 도구가 네트워크와 실행 권한을 요구하면 이유를 확인한다.

모델과 데이터셋도 해시와 함께 목록에 넣는다. 내부 저장소를 거치게 하면 목록이 자동으로 유지된다.`,

'ai-red-teaming': R`## 반복 시험

확률적이므로 한 번으로 판단하지 않는다.

\`\`\`bash
for i in $(seq 1 20); do
  curl -s -X POST -H "Authorization: Bearer $T" \
    -H 'Content-Type: application/json' \
    -d @attempt.json https://api.example.com/chat \
    | jq -r '.output' | grep -qi "$FORBIDDEN" && echo "성공 $i"
done | wc -l
\`\`\`

20번 중 몇 번 성공하는지가 실제 위험도다. 한 번도 성공하지 않아야 완화된 것이고, 한 번이라도 성공하면 실제 서비스에서는 자주 일어난다.

완화 후 같은 시험을 다시 돌려 회귀를 확인한다.`,

'ai-incident-response': R`## 변경 이력 확인

문제가 생기면 최근 변경부터 본다.

\`\`\`bash
git log --oneline -20 -- prompts/ config/model.yaml
psql -Atc "SELECT changed_at, changed_by, field, old_value IS NOT NULL
           FROM ai_config_history ORDER BY changed_at DESC LIMIT 10"
\`\`\`

프롬프트나 모델 버전 변경 직후에 문제가 나타나는 경우가 많다. 코드처럼 관리하고 있으면 되돌리기가 한 번에 된다.

콘솔에서 직접 수정하는 경로를 막아야 이 조사가 가능해진다.`,

'ai-governance-committee': R`## 도입 목록 유지

어디서 무엇을 쓰는지 목록이 있어야 규정 변화에 대응할 수 있다.

| 용도 | 모델·서비스 | 데이터 등급 | 위험도 | 승인일 | 재검토 |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

재검토 열이 지난 항목을 정기적으로 본다. 상황이 바뀌었을 수 있다.

목록에 없는 사용이 발견되면 벌하지 말고 등록부터 한다. 파악되지 않은 사용이 가장 위험하다.`,
}
