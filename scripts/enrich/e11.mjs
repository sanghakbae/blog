const R = String.raw
export default {

'cors-credentials': R`## 실제로 이렇게 터진다

요청 출처를 그대로 응답에 돌려주고 자격 증명 허용까지 켠 사례가 있다. 여러 협력사 도메인을 허용해야 해서 목록 대신 요청 헤더를 반사한 것이다. 그러면 모든 사이트가 허용된 것과 같고, 피해자가 그 사이트를 방문하는 순간 우리 API 를 피해자 권한으로 호출할 수 있다.

접두 일치로 검증한 경우도 뚫린다. 우리 도메인으로 시작하는지만 확인하면 공격자가 그 문자열을 포함한 도메인을 등록하면 된다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| CORS 는 서버를 보호한다 | 브라우저의 읽기를 제한할 뿐이다 |
| 출처를 반사해도 안전하다 | 전체 허용과 같다 |
| 접두 일치면 충분하다 | 문자열을 포함한 도메인 등록이 가능하다 |
| null 출처는 무해하다 | 샌드박스 프레임이 보낸다 |
| 사전 요청이 막아 준다 | 단순 요청에는 사전 요청이 없다 |

## 위험한 조합

| 출처 설정 | 자격 증명 허용 | 결과 |
| --- | --- | --- |
| 정확한 목록 | 허용 | 안전 |
| 정확한 목록 | 미허용 | 안전 |
| 반사 | 허용 | 전면 노출 |
| 와일드카드 | 허용 | 브라우저가 거부(설정 오류) |
| 와일드카드 | 미허용 | 공개 API 로만 |

반사와 자격 증명 허용이 만나는 지점이 사고다. 둘 중 하나만 있으면 피해가 제한된다.

## 올바른 구현

\`\`\`ts
const ALLOWED = new Set(['https://app.example.com', 'https://admin.example.com'])

app.use((req, res, next) => {
  const origin = req.headers.origin
  // 정확히 일치하는 것만. 반사도 접두 비교도 하지 않는다.
  if (origin && ALLOWED.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')          // 캐시가 출처별로 나뉘게
  }
  next()
})
\`\`\`

Vary 헤더가 빠지면 캐시가 한 출처의 응답을 다른 출처에 준다.

## 점검 절차

\`\`\`bash
# 임의 출처를 반사하는지
for o in https://evil.example https://app.example.com.evil.example null; do
  printf '%-36s ' "$o"
  curl -sI https://api.example.com/me -H "Origin: $o" |
    grep -i 'access-control-allow-origin' | tr -d '\r'
  echo
done
# 첫 번째나 두 번째가 그대로 돌아오면 취약하다
\`\`\``,

'clickjacking-defense': R`## 실제로 이렇게 터진다

관리자 화면이 프레임 차단 없이 열려 있던 사례가 있다. 공격자는 투명한 프레임으로 그 화면을 덮고 그 위에 다른 버튼을 놓았다. 관리자가 무해해 보이는 버튼을 누르면 실제로는 프레임 안의 권한 부여 버튼이 눌렸다.

헤더를 붙였는데 효과가 없던 경우도 있다. 옛 헤더만 설정하고 새 정책 지시어를 빼서, 일부 브라우저에서만 동작했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 로그인해야 보이는 화면은 안전하다 | 피해자가 로그인 상태다 |
| 옛 헤더 하나면 충분하다 | 정책 지시어가 표준이다 |
| 프레임 안에서 못 읽으니 무해하다 | 클릭을 훔치는 것이 목적이다 |
| 시각적으로 눈치챈다 | 투명하게 겹친다 |
| 모바일 앱은 무관하다 | 웹뷰가 같은 문제를 갖는다 |

## 무엇을 설정하는가

| 설정 | 역할 |
| --- | --- |
| frame-ancestors | 표준, 어느 사이트가 프레임에 넣을 수 있는지 |
| X-Frame-Options | 옛 브라우저 대비 |
| SameSite 쿠키 | 프레임 안 요청에 쿠키가 안 붙게 |
| 민감 동작 재인증 | 클릭만으로 끝나지 않게 |

프레임을 막는 것과 함께, 되돌릴 수 없는 동작에 재인증을 붙이면 한 번의 클릭으로 끝나지 않는다.

\`\`\`
Content-Security-Policy: frame-ancestors 'self';
X-Frame-Options: SAMEORIGIN
\`\`\`

## 점검 절차

\`\`\`bash
# 주요 경로에서 프레임 차단이 실제로 붙는지
for p in / /admin /admin/users /settings; do
  printf '%-16s ' "$p"
  h=$(curl -sI "https://example.com$p")
  echo "$h" | grep -qi 'frame-ancestors' && printf 'CSP ' || printf '--- '
  echo "$h" | grep -qi 'x-frame-options' && printf 'XFO' || printf '---'
  echo
done
\`\`\`

정적 페이지와 오류 페이지에서 빠지는 경우가 많으니 대표 경로를 여럿 확인한다.`,

'open-redirect': R`## 실제로 이렇게 터진다

로그인 후 원래 페이지로 돌려보내는 파라미터가 검증되지 않은 사례가 있다. 우리 도메인으로 시작하는 링크라 사용자는 믿었고, 로그인 뒤 공격자 사이트로 이동했다. 그 사이트는 우리 로그인 화면을 그대로 흉내 냈다.

토큰이 함께 새는 경우도 있다. 리다이렉트 시 쿼리에 있던 값이 리퍼러로 전달됐다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 리다이렉트는 피해가 없다 | 피싱의 신뢰를 빌려준다 |
| 우리 도메인으로 시작하면 안전하다 | 문자열 검사로는 부족하다 |
| 상대 경로만 받으면 된다 | 두 슬래시로 시작하면 절대 주소다 |
| 인코딩을 풀면 걸러진다 | 이중 인코딩이 있다 |
| 경고 페이지를 두면 된다 | 사용자는 대개 넘긴다 |

## 검증 방법

목록 방식이 가장 안전하다. 자유 입력을 받아야 한다면 파싱해서 호스트를 비교한다.

\`\`\`ts
const ALLOWED_HOSTS = new Set(['example.com', 'app.example.com'])

function safeRedirect(next: string, fallback = '/'): string {
  // 상대 경로만 허용하는 것이 가장 단순하고 안전하다
  if (/^\/(?!\/)/.test(next)) return next

  try {
    const u = new URL(next, 'https://example.com')
    if (u.protocol !== 'https:') return fallback
    if (!ALLOWED_HOSTS.has(u.hostname)) return fallback     // 정확히 일치
    return u.toString()
  } catch {
    return fallback
  }
}
\`\`\`

정규식 \`^\/(?!\/)\` 가 핵심이다. 슬래시 하나로 시작하되 둘은 아닌 것만 상대 경로다.

## 어디를 확인하는가

| 자리 | 흔한 이름 |
| --- | --- |
| 로그인 후 이동 | next, redirect, return, continue |
| 로그아웃 후 | logout_redirect |
| 외부 연동 콜백 | callback, redirect_uri |
| 단축 링크 | url, target |
| 오류 후 복귀 | back, from |

\`\`\`bash
# 리다이렉트가 검증되는지 시험한다
for n in '//evil.example' 'https://evil.example' '/\evil.example' 'https:/\/\evil.example'; do
  printf '%-30s ' "$n"
  curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' \
    "https://stg.example.com/login?next=$(printf %s "$n" | jq -sRr @uri)"
done
# 외부 주소가 redirect_url 에 나오면 취약하다
\`\`\``,

'idor-prevention': R`## 실제로 이렇게 터진다

파일 다운로드 주소가 순차 번호였던 사례가 있다. 자기 파일을 내려받은 뒤 번호를 하나씩 바꾸자 다른 회사의 계약서가 나왔다. 인증은 통과했고 파일 소유 확인만 빠져 있었다.

식별자를 무작위로 바꿔 해결했다고 판단한 경우도 있다. 추측은 어려워졌지만 유출된 식별자에는 여전히 무력했다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 무작위 식별자면 해결된다 | 늦출 뿐, 소유 확인이 필요하다 |
| 목록에 없으면 접근 못 한다 | 상세 조회는 별개 경로다 |
| 조회만 막으면 된다 | 수정·삭제·다운로드가 남는다 |
| 프런트에서 필터링한다 | 응답은 이미 나갔다 |
| 관리자 API 는 숨겨져 있다 | 번들에 경로가 있다 |

## 어디에 검사를 두는가

| 방식 | 안전성 | 이유 |
| --- | --- | --- |
| 조회 후 소유 비교 | 낮음 | 빠뜨리기 쉽고 존재가 노출된다 |
| 질의 조건에 소유 포함 | 높음 | 없으면 결과가 0건 |
| 데이터 계층에서 강제 | 매우 높음 | 우회 질의도 덮인다 |
| 데이터베이스 정책 | 가장 높음 | 애플리케이션 밖에서도 적용 |

질의 조건에 넣는 방식이 실무적 최선이다. 조회 후 비교는 검사를 빠뜨린 코드가 그대로 통과한다.

\`\`\`ts
// 위험 — 먼저 가져오고 나중에 비교한다
const file = await db.file.findUnique({ where: { id } })
if (file.ownerId !== actor.id) throw new Forbidden()

// 안전 — 소유 조건이 질의에 들어간다
const file = await db.file.findFirst({ where: { id, ownerId: actor.id } })
if (!file) return res.status(404).end()      // 존재 여부도 숨긴다
\`\`\`

404 를 주는 것도 의도적이다. 403 은 그 식별자의 자원이 존재한다는 정보를 준다.

## 회귀를 막는 시험

\`\`\`bash
# 다른 사용자의 자원에 접근되는지 — 메서드별로 확인한다
for m in GET PUT PATCH DELETE; do
  printf '%-7s ' "$m"
  curl -s -o /dev/null -w '%{http_code}\n' -X "$m" \
    "https://stg.example.com/api/files/$OTHER_USERS_FILE_ID" \
    -H "Authorization: Bearer $TOKEN_A"
done
# 전부 404 여야 한다. 200 이나 403 이 나오면 검토 대상이다
\`\`\``,

'mass-assignment': R`## 실제로 이렇게 터진다

프로필 수정 API 가 요청 본문을 그대로 모델에 넘긴 사례가 있다. 화면에는 이름과 소개만 있었지만, 요청에 역할 필드를 추가하자 그대로 반영됐다. 사용자가 스스로 관리자가 됐다.

결제 관련 필드가 노출된 경우도 있다. 주문 생성 시 금액 필드를 함께 보내면 서버가 받아들였다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 화면에 없으면 안 보낸다 | 요청은 직접 만든다 |
| 모델이 알아서 걸러 준다 | 기본은 전부 허용이다 |
| 필요한 것만 검증하면 된다 | 허용 목록이어야 한다 |
| 생성만 조심하면 된다 | 수정이 더 위험하다 |
| 중첩 객체는 안 넘어간다 | 관계까지 함께 반영되는 경우가 있다 |

## 허용 목록으로 바꾸기

받을 필드를 명시하는 것이 유일한 해법이다. 제외 목록은 필드가 늘어날 때마다 빠진다.

\`\`\`ts
// 위험 — 요청 본문 전체를 넘긴다
await db.user.update({ where: { id }, data: req.body })

// 안전 — 스키마로 받을 것만 정의하고, 그 밖은 거부한다
const Patch = z.object({
  name: z.string().min(1).max(60),
  bio: z.string().max(500).optional(),
}).strict()                       // 정의되지 않은 키가 오면 실패

const data = Patch.parse(req.body)
await db.user.update({ where: { id: actor.id }, data })
\`\`\`

\`.strict()\` 가 중요하다. 모르는 필드를 조용히 무시하면 공격 시도가 로그에도 안 남는다.

## 응답에도 같은 원칙

입력만 좁히고 출력을 열어 두면 정보가 샌다.

\`\`\`ts
const PUBLIC_FIELDS = ['id', 'name', 'bio', 'avatarUrl'] as const
return res.json(pick(user, PUBLIC_FIELDS))
\`\`\`

## 점검 절차

\`\`\`bash
# 권한 필드를 함께 보내 반영되는지 확인한다
curl -s -X PATCH https://stg.example.com/api/me \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"test","role":"admin","emailVerified":true,"credits":999999}'
curl -s https://stg.example.com/api/me -H "Authorization: Bearer $TOKEN" |
  python3 -c 'import sys,json;d=json.load(sys.stdin);print({k:d.get(k) for k in ("role","emailVerified","credits")})'
# 값이 바뀌었으면 대량 할당이 가능한 것이다
\`\`\``,
}
