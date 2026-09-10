const R = String.raw
export default {

'envelope-encryption-design': R`## 도입 전 점검표

구조를 만들기 전에 다음에 답할 수 있어야 한다. 하나라도 비면 나중에 복구 불가나 성능 문제로 돌아온다.

| 질문 | 답 |
| --- | --- |
| 데이터 키 범위 | 테넌트·레코드 중 무엇 |
| 평문 키 수명 | 사용 직후 폐기 |
| 암호문 키 위치 | 데이터와 함께 |
| 백업 범위 | 암호문 키 포함 |
| 키 서비스 장애 | 캐시 또는 중단 |
| 문맥 정보 | 오사용 방지 |

문맥 정보를 키 서비스 호출에 넣으면 같은 데이터 키가 다른 테넌트에 쓰이는 실수가 복호화 단계에서 걸린다.`,

'crypto-inventory': R`## 수집 스크립트

한 번 만들어 두면 반기마다 돌려 목록을 갱신할 수 있다.

\`\`\`bash
# 코드에서 암호 관련 호출 위치
grep -rnEi 'aes|rsa|ecdsa|sha1|sha256|md5|3des|hmac|pbkdf2|bcrypt|argon2' \
  --include='*.java' --include='*.ts' --include='*.py' --include='*.go' src/ \
  | grep -v test | awk -F: '{print $1}' | sort | uniq -c | sort -rn | head -20

# 실제 통신에서 협상된 방식
echo | openssl s_client -connect api.example.com:443 2>/dev/null \
  | grep -E 'Protocol|Cipher|Server Temp Key'
\`\`\`

코드 검색으로 후보를 뽑고 실제 통신으로 확인한다. 두 결과가 다르면 설정으로 결정되는 부분이 있다는 뜻이다.`,

'password-storage-migration': R`## 전환 진행률 측정

형식별 분포를 보면 전환이 실제로 진행되는지 알 수 있다.

\`\`\`bash
psql -Atc "SELECT split_part(password_hash, '\$', 2) AS 방식, count(*)
           FROM users GROUP BY 1 ORDER BY 2 DESC"
\`\`\`

활성 사용자가 로그인하면서 자연히 옮겨간다. 3개월 뒤에도 남아 있는 것은 휴면 계정이다. 그 시점에 다음 로그인 시 재설정을 요구하도록 전환한다.

전환이 멈춰 있다면 재해시 코드가 실제로 동작하는지 확인한다. 조용히 실패하는 경우가 있다.`,

'searchable-data-protection': R`## 대체 가능성 먼저 확인

암호화하기 전에 그 컬럼으로 무엇을 하는지 실제 질의를 본다.

\`\`\`bash
# 해당 컬럼이 조건에 쓰인 질의 유형
psql -Atc "SELECT left(query, 120), calls FROM pg_stat_statements
           WHERE query ILIKE '%phone%' ORDER BY calls DESC LIMIT 10"
\`\`\`

정확 일치만 있으면 해시 컬럼으로 해결된다. 부분 일치나 정렬이 있으면 그 기능이 정말 필요한지 기획과 확인한다. 대체 식별자로 검색하게 하면 문제가 사라지는 경우가 많다.`,

'tls-configuration-audit': R`## 전 구간 점검 스크립트

외부만 보면 내부 구간이 남는다. 목록을 만들어 한 번에 돌린다.

\`\`\`bash
while read -r host port; do
  printf '%-32s ' "$host:$port"
  echo | openssl s_client -connect "$host:$port" -servername "$host" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null || echo '(연결 실패)'
done < endpoints.txt
\`\`\`

목록에 외부 서비스뿐 아니라 로드밸런서 뒤, 데이터베이스 연결, 서비스 간 통신을 모두 넣는다. 만료일이 가까운 것과 연결이 실패하는 것이 조치 대상이다.`,

'random-number-misuse': R`## 발급된 값 점검

코드를 고쳐도 이미 발급된 값이 예측 가능하면 그대로 위험하다.

\`\`\`bash
# 보안 용도에 일반 난수를 쓰는 위치
grep -rnE 'Math\.random|rand\(\)|mt_rand|Random\(\)' src/ \
  | grep -iE 'token|session|key|nonce|salt|code|secret|reset' | head -20
\`\`\`

하나라도 나오면 그 값으로 발급된 것을 전부 무효화하고 다시 발급한다. 코드만 고치고 기존 값을 두면 노출이 계속된다.

발급 시각이 기록돼 있다면 언제부터 안전한 방식으로 만들어졌는지 기준을 정해 그 이전 값만 교체할 수 있다.`,

'data-retention-automation': R`## 시험 실행부터

삭제는 되돌릴 수 없다. 먼저 대상만 세어 본다.

\`\`\`bash
psql -Atc "SELECT '삭제 대상', count(*) FROM access_log
           WHERE at < now() - interval '1 year'
           UNION ALL
           SELECT '전체', count(*) FROM access_log"
\`\`\`

비율이 예상과 맞는지 확인한다. 예상보다 많으면 조건이 잘못됐을 가능성이 높다. 며칠간 대상 수만 기록하다 안정되면 실제 삭제를 켠다.

일별 삭제 상한을 함께 걸어 조건 오류로 대량 삭제되는 것을 막는다.`,

'pseudonymization-practice': R`## 재식별 위험 측정

처리 후 준식별자 조합으로 혼자인 행이 있는지 본다.

\`\`\`bash
psql -Atc "SELECT count(*) FROM (
             SELECT birth_year, gender, zip3, count(*) n
             FROM pseudo_data GROUP BY 1,2,3 HAVING count(*) < 5) t"
\`\`\`

0 이 아니면 그 조합에 해당하는 사람이 특정될 수 있다. 범주화 단위를 넓히거나 해당 행을 제외한다.

기준을 5로 잡는 것이 일반적이지만 데이터 성격에 따라 다르다. 민감 항목이 포함되면 더 높게 잡는다.`,

'secure-deletion': R`## 사본 경로 그리기

삭제 요청을 처리하려면 데이터가 어디까지 갔는지 알아야 한다.

| 경로 | 확인 방법 |
| --- | --- |
| 복제본 | 복제 지연 확인 |
| 검색 색인 | 색인 문서 조회 |
| 캐시 | 키 패턴 조회 |
| 로그 | 보존 기간 확인 |
| 분석 시스템 | 적재 파이프라인 |
| 백업 | 세대 주기 |
| 위탁처 | 계약·요청 경로 |

이 표를 시스템마다 채워 두면 삭제 요청 처리가 절차가 된다. 새 시스템을 붙일 때 이 표를 갱신하는 것을 도입 절차에 넣는다.`,

'backup-encryption-keys': R`## 복구 훈련 시나리오

문서 검토가 아니라 실제로 해 본다.

| 단계 | 확인 |
| --- | --- |
| 1 | 주 담당자 없이 시작 |
| 2 | 키 보관 위치 찾기 |
| 3 | 접근 권한 확인 |
| 4 | 백업 복호화 |
| 5 | 데이터 무결성 확인 |
| 6 | 소요 시간 기록 |

1단계가 핵심이다. 주 담당자가 있으면 문제가 드러나지 않는다. 대체 인력만으로 진행해 보면 권한과 문서의 빈틈이 나온다.

훈련 후 사용한 키는 교체한다. 훈련 자체가 노출이다.`,
}
