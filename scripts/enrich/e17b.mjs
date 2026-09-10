const R = String.raw
export default {

'impersonation': R`## 실제로 이렇게 터진다

고객 지원을 위한 대리 로그인이 기록 없이 쓰인 사례가 있다. 상담원이 고객 계정으로 들어가 문제를 확인했는데, 그 계정의 활동 로그에는 고객 본인이 한 것으로 남았다. 나중에 분쟁이 생겼을 때 누가 한 일인지 구분할 수 없었다.

대리 상태에서 결제까지 가능했던 경우도 있다. 제한이 없었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 지원 목적이라 문제없다 | 권한 남용 경로다 |
| 기록은 남는다 | 대리 여부가 구분되지 않는 경우가 많다 |
| 상담원은 신뢰할 수 있다 | 계정 탈취와 실수가 있다 |
| 고객에게 알릴 필요 없다 | 알리는 것만으로 남용이 준다 |
| 전 기능을 써야 지원이 된다 | 대부분은 조회로 충분하다 |

## 무엇을 제한하는가

| 항목 | 기준 |
| --- | --- |
| 사유 입력 | 필수, 티켓 번호 연결 |
| 시간 제한 | 30분 등 짧게 |
| 기능 제한 | 결제·출금·권한 변경 금지 |
| 대상자 통지 | 시작 시 또는 종료 후 |
| 기록 | 대리 여부를 별도 필드로 |
| 승인 | 민감 계정은 관리자 승인 |

기록에서 대리 여부를 구분하는 것이 핵심이다. 나중에 그 계정의 행위가 본인 것인지 상담원 것인지 답할 수 있어야 한다.

\`\`\`ts
// 세션에 대리 정보를 함께 담고, 모든 기록에 남긴다
type Actor = { userId: string; impersonatedBy?: string; reason?: string; ticket?: string }

await audit.log(action, {
  userId: actor.userId,
  actualActor: actor.impersonatedBy ?? actor.userId,   // 실제 수행자
  impersonation: !!actor.impersonatedBy,
  reason: actor.reason,
  ticket: actor.ticket,
})

// 위험한 동작은 대리 상태에서 막는다
const BLOCKED_WHEN_IMPERSONATING = new Set(['payment.create', 'withdraw', 'role.grant', 'password.change'])
if (actor.impersonatedBy && BLOCKED_WHEN_IMPERSONATING.has(action)) {
  throw new Forbidden('대리 로그인 상태에서는 할 수 없는 동작입니다')
}
\`\`\`

## 점검 항목

\`\`\`sql
-- 사유 없이 시작된 대리 세션, 오래 유지된 세션
SELECT staff_id, target_user_id, started_at, ended_at, reason, ticket
FROM impersonation_sessions
WHERE reason IS NULL
   OR ticket IS NULL
   OR coalesce(ended_at, now()) - started_at > interval '1 hour'
ORDER BY started_at DESC LIMIT 30;
\`\`\``,

'session-fixation': R`## 실제로 이렇게 터진다

로그인 시 세션 식별자를 새로 발급하지 않은 사례가 있다. 공격자가 자기 식별자를 피해자 브라우저에 심어 두고, 피해자가 로그인하면 그 식별자가 인증된 세션이 됐다. 공격자는 처음부터 그 값을 알고 있었다.

권한이 올라갈 때도 같은 문제가 생긴다. 일반 사용자가 관리자로 전환될 때 식별자를 유지하면 같은 경로가 열린다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 식별자가 예측 불가능하면 안전하다 | 고정 공격은 예측이 필요 없다 |
| 로그인하면 새 세션이 생긴다 | 프레임워크 설정에 따라 다르다 |
| 쿠키만 쓰면 안전하다 | 주소로 세션을 넘기는 경로가 남을 수 있다 |
| 로그아웃하면 정리된다 | 서버에서 지우지 않으면 남는다 |
| 흔하지 않은 공격이다 | 설정 하나로 생긴다 |

## 언제 식별자를 재발급하는가

| 시점 | 이유 |
| --- | --- |
| 로그인 성공 | 핵심 |
| 권한 상승 | 관리자 전환 등 |
| 비밀번호 변경 | 기존 세션 무효화와 함께 |
| 추가 인증 통과 | 권한 범위가 바뀐다 |
| 로그아웃 | 기존 식별자 폐기 |

## 함께 확인할 것

1. 세션 식별자를 주소로 전달하는 경로가 없는가
2. 로그인 전 세션에 어떤 데이터가 담기는가 — 장바구니 등은 이관 필요
3. 로그아웃 시 서버 세션이 실제로 지워지는가
4. 동시 세션 수에 상한이 있는가
5. 세션 목록을 사용자가 볼 수 있는가

\`\`\`bash
# 로그인 전후 식별자 비교
BEFORE=$(curl -sI https://stg.example.com/login | grep -oiE 'sessionid=[^;]+')
AFTER=$(curl -sI -X POST https://stg.example.com/login \
          -H "Cookie: $BEFORE" -d 'id=test&pw=test' | grep -oiE 'sessionid=[^;]+')
echo "전: $BEFORE"
echo "후: $AFTER"
[ "$BEFORE" = "$AFTER" ] && echo '재발급되지 않는다 — 고정 공격에 취약'
\`\`\``,

'remember-me': R`## 실제로 이렇게 터진다

자동 로그인 토큰이 만료 없이 발급된 사례가 있다. 한 번 로그인하면 영구히 유지됐고, 기기를 잃어버려도 회수할 방법이 없었다. 토큰은 사용자 식별자를 그대로 담고 있어서 값을 바꾸면 다른 사람이 됐다.

토큰 재사용을 탐지하지 않은 경우도 있다. 탈취된 토큰과 정상 토큰이 동시에 쓰였지만 아무 신호가 없었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 편의 기능이라 위험이 낮다 | 장기 자격 증명이다 |
| 암호화하면 안전하다 | 탈취 시 그대로 쓰인다 |
| 만료를 길게 해야 편하다 | 회전하면 길어도 안전하다 |
| 기기 정보를 넣으면 안전하다 | 위조 가능하다 |
| 로그아웃하면 사라진다 | 서버에서 지워야 한다 |

## 어떻게 설계하는가

토큰을 사용할 때마다 새것으로 바꾸는 회전 방식이 표준이다.

| 항목 | 설계 |
| --- | --- |
| 값 | 무작위, 사용자 정보 미포함 |
| 저장 | 서버에 해시로, 기기 정보와 함께 |
| 수명 | 절대 만료 + 유휴 만료 |
| 회전 | 사용 시 새 토큰 발급, 이전 무효 |
| 재사용 감지 | 이미 쓴 토큰이 다시 오면 전체 폐기 |
| 범위 | 자동 로그인 세션은 권한 축소 |

마지막 항목이 중요하다. 자동 로그인으로 들어온 세션에서는 결제·설정 변경 전에 재인증을 요구한다.

\`\`\`ts
const row = await rememberTokens.findByHash(sha256(presented))
if (!row) return null

if (row.usedAt) {
  // 이미 사용된 토큰이 다시 왔다 — 탈취 가능성이 높다
  await rememberTokens.revokeFamily(row.familyId)
  await alerts.security('자동 로그인 토큰 재사용', { userId: row.userId })
  return null
}

await rememberTokens.markUsed(row.id)
const next = await rememberTokens.issue(row.userId, row.familyId)   // 회전
return { userId: row.userId, token: next, elevated: false }         // 권한 축소
\`\`\`

## 사용자에게 무엇을 보여 주는가

기기 목록과 마지막 사용 시각을 보여 주고 개별 해제를 제공한다. 사용자가 스스로 이상을 알아채는 유일한 수단이다.`,

'logout-everywhere': R`## 실제로 이렇게 터진다

비밀번호를 바꿨는데 기존 세션이 그대로 유지된 사례가 있다. 계정이 탈취된 것을 알고 비밀번호를 바꿨지만, 공격자의 세션은 계속 살아 있었다.

전체 로그아웃 기능은 있었는데 API 토큰은 빠진 경우도 있다. 화면 세션만 끊기고 발급된 토큰은 유효했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 비밀번호를 바꾸면 세션이 끊긴다 | 명시적으로 처리해야 한다 |
| 로그아웃하면 다 끝난다 | 그 기기만이다 |
| 세션만 끊으면 된다 | 토큰·자동 로그인·연동 앱이 남는다 |
| 사용자가 알아서 한다 | 목록을 보여줘야 판단할 수 있다 |
| 즉시 반영된다 | 캐시 때문에 지연될 수 있다 |

## 무엇을 함께 끊는가

| 대상 | 놓치기 쉬움 |
| --- | --- |
| 웹 세션 | 기본 |
| 모바일 앱 세션 | 별도 저장소 |
| 갱신 토큰 | 서버 저장 |
| 자동 로그인 토큰 | 별도 테이블 |
| API 키 | 대개 유지가 맞다 |
| 연동 앱 권한 | 사용자 선택 |

API 키는 보통 유지한다. 사용자가 명시적으로 선택하게 하는 편이 낫다.

## 언제 자동으로 끊는가

| 상황 | 처리 |
| --- | --- |
| 비밀번호 변경 | 현재 기기 외 전부 |
| 다단계 수단 변경 | 전부 |
| 계정 복구 완료 | 전부 |
| 관리자 정지 | 전부 |
| 의심 활동 감지 | 전부 + 알림 |

## 사용자 화면에 무엇을 두는가

기기·위치·마지막 사용 시각을 보여 주고 개별·전체 해제를 제공한다. 목록이 없으면 사용자는 이상을 알아챌 수 없다.

\`\`\`ts
// 일괄 폐기는 기준 시각으로 — 목록을 지우지 않아도 된다
await users.update(userId, { tokensInvalidBefore: Math.floor(Date.now() / 1000) })
await sessions.deleteAllFor(userId, { except: currentSessionId })
await rememberTokens.revokeAllFor(userId)
await refreshTokens.revokeAllFor(userId)
await notify.user(userId, '모든 기기에서 로그아웃되었습니다')
\`\`\`

검증 시 발급 시각을 기준 시각과 비교하면, 폐기 목록을 크게 유지하지 않아도 된다.`,

'device-authorization': R`## 실제로 이렇게 터진다

TV 앱 로그인에서 코드가 짧고 만료가 길었던 사례가 있다. 네 자리 코드에 만료가 30분이라 무차별 대입이 가능했다. 공격자가 코드를 맞히면 그 기기가 피해자 계정으로 연결됐다.

사용자에게 무엇을 승인하는지 보여 주지 않은 경우도 있다. 코드만 입력하면 승인되어, 피싱으로 코드를 받아 낼 수 있었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 코드가 짧아야 편하다 | 대입 가능성이 커진다 |
| 만료가 길어야 편하다 | 공격 창이 넓어진다 |
| 코드만 맞으면 된다 | 무엇을 승인하는지 보여야 한다 |
| 기기 화면에 코드가 있으니 안전하다 | 코드를 전달받는 피싱이 있다 |
| 승인 후에는 안전하다 | 기기 목록에서 회수 가능해야 한다 |

## 무엇을 정하는가

| 항목 | 권장 |
| --- | --- |
| 코드 길이 | 8자 이상, 혼동 문자 제외 |
| 만료 | 5~10분 |
| 시도 제한 | 5회 후 코드 폐기 |
| 폴링 간격 | 서버가 지정, 초과 시 거부 |
| 승인 화면 | 기기 종류·위치·요청 시각 표시 |
| 사후 관리 | 기기 목록에서 해제 가능 |

승인 화면에 정보를 보여 주는 것이 피싱 방어의 핵심이다. "거실 TV 에서 로그인 요청" 을 보면 사용자가 판단할 수 있다.

## 흐름

1. 기기가 코드 발급을 요청한다
2. 기기 화면에 사용자 코드와 확인 주소를 표시한다
3. 사용자가 다른 기기에서 로그인하고 코드를 입력한다
4. 승인 화면에 무엇을 승인하는지 보여 준다
5. 승인하면 기기가 폴링으로 토큰을 받는다
6. 기기 목록에 등록되어 나중에 해제할 수 있다

\`\`\`ts
// 코드 생성 — 혼동되는 문자를 뺀다
const ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ23456789'   // 0/O, 1/I 제외
const userCode = Array.from(crypto.randomBytes(8))
  .map((b) => ALPHABET[b % ALPHABET.length]).join('')
  .replace(/(.{4})/, '$1-')                        // BCDF-GHJK

await deviceCodes.create({
  userCode, deviceCode: crypto.randomUUID(),
  expiresAt: new Date(Date.now() + 8 * 60_000),    // 8분
  attempts: 0, interval: 5,
})
\`\`\`

\`\`\`bash
# 코드 대입 시도가 있는지 — 실패가 몰리면 신호다
psql -Atc "
  SELECT date_trunc('hour', at) AS h, count(*) FILTER (WHERE NOT ok) AS fail
  FROM device_code_attempts WHERE at > now() - interval '24 hours'
  GROUP BY 1 ORDER BY 1 DESC LIMIT 24"
\`\`\``,
}
