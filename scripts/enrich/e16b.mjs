const R = String.raw
export default {

'file-download-security': R`## 실제로 이렇게 터진다

파일 이름을 그대로 헤더에 넣은 사례가 있다. 이름에 줄바꿈이 들어 있었고, 헤더 주입으로 응답이 조작됐다. 다른 헤더를 덧붙여 캐시를 오염시킬 수 있었다.

콘텐츠 형식을 추론에 맡긴 경우도 있다. 업로드된 HTML 이 브라우저에서 실행되면서 우리 도메인의 스크립트가 됐다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 내려받기만 하니 안전하다 | 브라우저가 실행할 수 있다 |
| 파일 이름은 표시용이다 | 헤더 주입 경로다 |
| 형식은 추론하면 편하다 | 추론이 실행으로 이어진다 |
| 인증된 사용자만 받는다 | 주소가 공유되면 끝이다 |
| 같은 도메인이 편하다 | 쿠키와 스크립트 출처를 공유한다 |

## 응답 헤더로 무엇을 정하는가

| 헤더 | 값 | 이유 |
| --- | --- | --- |
| Content-Type | 검증된 형식 고정 | 추론 방지 |
| X-Content-Type-Options | nosniff | 브라우저 추론 차단 |
| Content-Disposition | attachment + 인코딩된 이름 | 실행 대신 저장 |
| Content-Security-Policy | sandbox | 실행돼도 갇힌다 |
| Cache-Control | private | 공용 캐시 방지 |

## 파일 이름을 어떻게 넣는가

이름에 특수 문자가 들어갈 수 있으므로 인코딩이 필요하다. 한글 이름도 마찬가지다.

\`\`\`ts
function contentDisposition(name: string): string {
  // 제어 문자를 제거하고, 아스키 대체와 인코딩된 이름을 함께 준다
  const clean = name.replace(/[\r\n"\\]/g, '').slice(0, 200)
  const ascii = clean.replace(/[^\x20-\x7e]/g, '_')
  return \`attachment; filename="\${ascii}"; filename*=UTF-8''\${encodeURIComponent(clean)}\`
}

res.setHeader('Content-Type', verifiedMime)          // 추론에 맡기지 않는다
res.setHeader('X-Content-Type-Options', 'nosniff')
res.setHeader('Content-Disposition', contentDisposition(file.name))
res.setHeader('Cache-Control', 'private, no-store')
\`\`\`

제어 문자 제거가 헤더 주입을 막는 부분이다.

## 별도 도메인으로 옮기는 이유

같은 도메인에서 사용자 파일을 서빙하면, 실행 가능한 파일 하나가 우리 출처의 스크립트가 된다. 등록 가능한 다른 도메인에서 서빙하면 그 위험이 사라진다.

\`\`\`bash
# 서빙 헤더 확인
curl -sI "https://files.example.com/d/abc123" |
  grep -iE 'content-type|content-disposition|x-content-type-options|cache-control'
\`\`\``,

'zip-bomb': R`## 실제로 이렇게 터진다

압축 파일 업로드 기능에서 디스크가 가득 찬 사례가 있다. 42KB 파일이 압축을 풀자 수 기가바이트가 됐다. 크기 제한은 업로드 파일에만 있었고 해제 결과에는 없었다.

메모리에서 처리하다 프로세스가 죽은 경우도 있다. 전체를 메모리로 읽는 구현이었다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 업로드 크기를 제한하면 된다 | 해제 후 크기가 문제다 |
| 압축률을 보면 안다 | 미리 알 수 없는 형식도 있다 |
| 디스크가 크면 괜찮다 | 동시 요청이면 금방 찬다 |
| 압축 파일만 위험하다 | 이미지·문서도 확장될 수 있다 |
| 가용성 문제일 뿐이다 | 서비스 중단이 사고다 |

## 무엇을 제한하는가

| 항목 | 이유 |
| --- | --- |
| 업로드 크기 | 첫 관문 |
| 해제 후 총 크기 | 실제 위험 |
| 항목당 크기 | 하나가 거대한 경우 |
| 항목 수 | 작은 파일 수십만 개 |
| 중첩 깊이 | 압축 안의 압축 |
| 처리 시간 | 시간 초과로 차단 |
| 동시 처리 수 | 자원 고갈 방지 |

## 스트리밍으로 처리한다

전체를 읽지 않고 읽으면서 누적 크기를 확인해 중단한다.

\`\`\`ts
const MAX_TOTAL = 200 * 1024 * 1024
const MAX_ENTRY = 50 * 1024 * 1024
const MAX_FILES = 2000

let total = 0
let count = 0

for await (const entry of archive) {
  if (++count > MAX_FILES) throw new Error('항목이 너무 많습니다')
  if (entry.isDirectory) continue
  if (entry.size > MAX_ENTRY) throw new Error('항목이 너무 큽니다')

  let written = 0
  for await (const chunk of entry.stream()) {
    written += chunk.length
    total += chunk.length
    if (written > MAX_ENTRY || total > MAX_TOTAL) throw new Error('압축 해제 한도 초과')
    await out.write(chunk)
  }
}
\`\`\`

선언된 크기를 믿지 않고 실제로 쓴 바이트를 세는 것이 핵심이다. 헤더의 크기 값은 위조할 수 있다.

\`\`\`bash
# 압축률이 비정상적으로 높은 파일 확인
unzip -l suspicious.zip | tail -3
# 압축 크기 대비 해제 크기 비율이 100배를 넘으면 검토 대상이다
\`\`\``,

'svg-upload': R`## 실제로 이렇게 터진다

프로필 이미지로 SVG 를 허용한 사례가 있다. 이미지 형식이라 이미지 처리 경로를 그대로 통과했고, 같은 도메인에서 서빙됐다. 그 안의 스크립트가 실행되면서 우리 출처의 스크립트가 됐다.

외부 자원을 참조하는 SVG 도 문제가 된다. 열람자의 주소가 외부로 전달된다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| SVG 는 이미지다 | XML 문서이고 스크립트를 담는다 |
| 이미지 태그로 넣으면 안전하다 | 직접 열면 실행된다 |
| 검사 도구가 잡는다 | 이미지로 분류돼 통과한다 |
| 스크립트만 지우면 된다 | 이벤트 속성과 외부 참조가 남는다 |
| 아이콘만 받으니 괜찮다 | 확장자로는 구분되지 않는다 |

## 무엇이 위험한가

| 요소 | 위험 |
| --- | --- |
| script 요소 | 코드 실행 |
| 이벤트 속성 | 코드 실행 |
| foreignObject | HTML 삽입 |
| use 외부 참조 | 외부 자원 로드 |
| image 외부 참조 | 주소 유출 |
| 외부 엔티티 | 파일 읽기 |
| CSS import | 외부 로드 |

## 어떻게 처리하는가

세 가지 중 하나를 고른다. 위로 갈수록 안전하다.

1. **래스터로 변환** — SVG 를 받되 PNG 로 바꿔 저장한다. 가장 안전하다
2. **정제 후 저장** — 허용 요소·속성 목록으로 걸러 낸다
3. **별도 도메인 + 다운로드 강제** — 실행돼도 우리 출처가 아니다

\`\`\`ts
// 정제 방식 — 허용 목록으로 남길 것만 정한다
import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

const DOMPurify = createDOMPurify(new JSDOM('').window)
const clean = DOMPurify.sanitize(svgSource, {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ['script', 'foreignObject', 'use'],
  FORBID_ATTR: ['onload', 'onerror', 'onclick', 'href', 'xlink:href'],
})
\`\`\`

정제를 쓰더라도 서빙은 별도 도메인에서 하고 nosniff 와 sandbox 를 함께 건다.

\`\`\`bash
# 이미 저장된 SVG 에 위험 요소가 있는지 확인
grep -rlE '<script|on[a-z]+ *=|foreignObject|xlink:href *= *"https?:' /srv/uploads --include='*.svg' | head
\`\`\``,

'dom-clobbering': R`## 실제로 이렇게 터진다

사용자가 지정한 요소 이름이 전역 변수를 덮어쓴 사례가 있다. 게시글 본문에 특정 이름의 요소를 넣자, 스크립트가 참조하던 설정 객체가 그 요소로 바뀌었다. 값 비교가 예상과 다르게 동작하면서 검사가 우회됐다.

이 공격은 스크립트를 실행하지 않고도 성립한다. 그래서 스크립트를 막는 정책으로는 잡히지 않는다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 스크립트를 막으면 안전하다 | 이 공격은 스크립트가 없다 |
| HTML 만 넣으니 무해하다 | 이름 속성이 전역을 만든다 |
| 새니타이저가 막는다 | 기본 설정은 이름 속성을 허용한다 |
| 드문 공격이다 | 사용자 HTML 을 허용하면 언제나 가능 |
| 최신 브라우저는 다르다 | 표준 동작이다 |

## 어떻게 성립하는가

HTML 요소에 이름이나 식별자를 주면 전역 이름이 만들어진다. 스크립트가 같은 이름의 변수를 확인 없이 쓰면 그 요소를 참조하게 된다.

| 코드 패턴 | 위험 |
| --- | --- |
| 전역 변수 존재 확인 | 요소로 대체돼 참으로 평가 |
| 설정 객체 참조 | 속성 접근이 예상과 다름 |
| 함수 존재 확인 후 호출 | 오류 또는 우회 |
| 값 비교 | 문자열 변환 결과가 다름 |

## 어떻게 막는가

1. 새니타이저에서 이름·식별자 속성을 제거한다
2. 전역 변수를 쓰지 않는다 — 모듈 범위로
3. 존재 확인 대신 타입을 확인한다
4. 설정은 전역이 아니라 불러오는 함수로 제공한다
5. 사용자 HTML 을 별도 출처의 프레임에 넣는다

\`\`\`ts
// 위험 — 요소로 대체될 수 있다
if (window.APP_CONFIG) use(window.APP_CONFIG)

// 안전 — 타입까지 확인하고, 애초에 전역을 쓰지 않는다
import { config } from './config'
use(config)

// 사용자 HTML 을 넣어야 한다면 이름 속성을 제거한다
DOMPurify.sanitize(html, { FORBID_ATTR: ['id', 'name'] })
\`\`\`

\`\`\`bash
# 전역 존재 확인 패턴 찾기
grep -rnE 'if *\( *window\.[A-Za-z_]+ *\)|typeof window\.[A-Za-z_]+ *!== *.undefined' src/ | head
\`\`\``,

'same-origin-policy': R`## 실제로 이렇게 터진다

응답 내용은 못 읽지만 크기와 시간으로 정보가 샌 사례가 있다. 로그인 여부에 따라 응답 크기가 달랐고, 외부 사이트에서 이미지 로드 성공 여부로 그것을 알 수 있었다.

프레임 개수로 정보가 샌 경우도 있다. 검색 결과 수에 따라 프레임 안의 하위 프레임 수가 달랐다.

## 흔한 오해

| 오해 | 실제 |
| --- | --- |
| 동일 출처 정책이 다 막는다 | 읽기만 막는다 |
| 내용을 못 읽으면 안전하다 | 크기·시간·오류로 샌다 |
| CORS 를 안 열면 된다 | 다른 경로가 있다 |
| 부수 채널은 이론적이다 | 실제로 쓰인다 |
| 브라우저가 알아서 막는다 | 설계상 허용되는 동작이다 |

## 무엇이 새어 나가는가

| 관측 대상 | 알 수 있는 것 |
| --- | --- |
| 응답 시간 | 조건 분기, 존재 여부 |
| 오류 발생 여부 | 상태 코드 대략 |
| 리소스 로드 성공 | 인증 상태 |
| 프레임 개수 | 결과 수 |
| 창 크기·이동 | 리다이렉트 여부 |
| 캐시 적중 | 방문 이력 |

## 어떻게 줄이는가

| 조치 | 막는 것 |
| --- | --- |
| Cross-Origin-Resource-Policy | 다른 출처의 리소스 포함 |
| Cross-Origin-Opener-Policy | 창 참조를 통한 관측 |
| frame-ancestors | 프레임 삽입 |
| SameSite 쿠키 | 인증 상태 차이 |
| 응답 길이 균일화 | 크기 관측 |
| 응답 시간 균일화 | 시간 관측 |

앞의 네 개가 실무적으로 효과가 크다. 뒤의 둘은 비용이 크므로 정말 민감한 응답에만 적용한다.

\`\`\`
Cross-Origin-Resource-Policy: same-origin
Cross-Origin-Opener-Policy: same-origin
Content-Security-Policy: frame-ancestors 'self'
\`\`\`

\`\`\`bash
# 인증 상태에 따라 응답 크기가 다른지 — 부수 채널 후보
for c in '' "session=$SESSION"; do
  printf '%-10s ' "\${c:+로그인}"
  curl -s -o /dev/null -w '크기 %{size_download} 시간 %{time_total}\n' \
    https://example.com/api/profile \${c:+-H "Cookie: $c"}
done
\`\`\``,
}
