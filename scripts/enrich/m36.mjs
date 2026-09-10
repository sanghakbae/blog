const R = String.raw
export default {

'response-splitting': R`## 바로 확인하기

응답 헤더에 요청 값이 반영되는 지점을 하나씩 확인한다. 프레임워크가 걸러 주더라도 앞단 구성에서 다시 조합될 수 있으므로 실제 응답을 본다.

\`\`\`bash
# 리다이렉트 파라미터에 제어 문자를 넣어 응답 헤더를 본다
curl -sI "https://example.com/go?to=%0d%0aX-Test:%201" | grep -i '^x-test' \
  && echo '주입됨 — 조치 필요' || echo '차단됨'

# 다운로드 헤더에 원본 파일명이 그대로 들어가는지
curl -sI "https://example.com/files/1" | grep -i content-disposition
\`\`\`

주입된 헤더가 보이면 즉시 조치 대상이다. 다운로드 헤더에 인코딩되지 않은 이름이 보이면 파일명 처리부터 고친다.`,

'websocket-authorization': R`## 바로 확인하기

두 계정으로 연결을 열고 서로의 대상을 구독해 본다. 메시지가 오면 구독 권한 검사가 없는 것이다.

\`\`\`bash
# 다른 사용자 대상 구독 시도 — 거부되어야 한다
websocat -H="Authorization: Bearer $TOKEN_A" wss://example.com/ws <<'EOF'
{"type":"subscribe","target":"user:B"}
EOF
\`\`\`

응답이 오면 취약하다. 이어서 권한을 회수한 뒤 기존 연결이 끊기는지, 토큰 만료 후 재인증을 요구하는지도 확인한다. 세 가지가 모두 통과해야 구독 통제가 완성된 것이다.`,

'cors-preflight-pitfalls': R`## 바로 확인하기

임의 출처를 넣어 응답 헤더를 본다. 요청 출처가 그대로 반영되면 사실상 전체 허용이다.

\`\`\`bash
for o in https://attacker.example https://app.example.com.evil.com null; do
  printf '%-40s ' "$o"
  curl -sI -H "Origin: $o" https://api.example.com/me \
    | grep -i 'access-control-allow-origin' || echo '(없음)'
done
\`\`\`

세 경우 모두 허용 헤더가 나오면 안 된다. 특히 유사 도메인이 통과하면 접두사나 부분 문자열 검사를 쓰고 있는 것이다. 자격 증명 허용 헤더가 함께 있으면 우선순위를 최고로 올린다.`,

'client-side-path-traversal': R`## 바로 확인하기

프런트 번들에서 경로에 변수를 직접 넣는 곳을 찾는다.

\`\`\`bash
# 인코딩 없이 변수를 경로에 넣는 호출
grep -rnE '(fetch|axios\.[a-z]+)\([^)]*[$][{]' src/ \\
  | grep -v encodeURIComponent | head -20
\`\`\`

찾은 각 위치에서 그 값이 어디서 오는지 추적한다. 사용자 입력이나 외부 응답에서 왔다면 조치 대상이다. 서버 응답에서 온 식별자라도 그 응답이 사용자 입력의 영향을 받는다면 같다.

수정은 인코딩 한 줄이면 끝나지만, 찾는 것이 일이다. 공통 요청 계층을 만들어 두면 다음부터 이 검색이 필요 없어진다.`,

'json-parser-differences': R`## 바로 확인하기

계층 간 파서가 같은 문서를 같게 읽는지 확인한다.

\`\`\`bash
D='{"role":"user","role":"admin","amount":9007199254740993}'
echo "$D" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("py ",d)'
echo "$D" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>console.log("node",JSON.parse(s)))'
\`\`\`

중복 키의 결과와 큰 정수 값이 다르면 그 차이가 계층 간에 존재한다. 게이트웨이와 서비스가 서로 다른 언어라면 반드시 확인한다.

연동 규약에 중복 키 거부와 큰 수의 문자열 전달을 명시하고, 스키마 검증에서 알 수 없는 필드를 제거하도록 설정한다.`,

'file-upload-content-check': R`## 바로 확인하기

저장된 파일의 실제 형식과 제공 헤더를 함께 본다.

\`\`\`bash
# 저장 파일의 실제 형식
for f in uploads/*; do printf '%-40s %s\n' "$f" "$(file -b --mime-type "$f")"; done | head

# 제공 시 헤더 — 형식 고정과 추측 방지가 있어야 한다
curl -sI https://cdn.example.com/u/2f9c1a7e.bin \
  | grep -iE 'content-type|content-disposition|x-content-type-options'
\`\`\`

실제 형식과 저장 시 판정한 형식이 다르면 검사가 이름만 보고 있는 것이다. 제공 헤더에 형식 추측 방지가 없으면 브라우저가 내용을 해석할 수 있다.`,

'xxe-and-xml-parsers': R`## 바로 확인하기

XML 을 다루는 위치를 찾고 각각의 설정을 확인한다.

\`\`\`bash
# 파서 생성 지점
grep -rnE 'DocumentBuilderFactory|SAXParser|XMLReader|etree\.parse|new XMLParser' src/ | head -20

# 문서 파일을 처리하는 위치 — 내부가 XML 이다
grep -rniE 'xlsx|docx|pptx|svg|opendocument' src/ | head -10
\`\`\`

각 위치에서 문서 형식 선언 거부와 외부 엔티티 비활성화가 설정돼 있는지 본다. 공통 팩토리를 만들어 그것만 쓰게 하면 새 코드에서 반복되지 않는다.`,

'open-redirect-chains': R`## 바로 확인하기

되돌아올 주소를 받는 지점에 여러 형태를 넣어 본다.

\`\`\`bash
for t in "//attacker.example" "https://attacker.example" "/\\attacker.example" \
         "https://app.example.com.evil.com"; do
  printf '%-40s ' "$t"
  curl -sI "https://example.com/login?next=$(printf %s "$t" | jq -sRr @uri)" \
    | grep -i '^location' || echo '(이동 없음)'
done
\`\`\`

외부 주소로 이동하는 응답이 하나라도 있으면 조치 대상이다. 특히 두 슬래시로 시작하는 형태가 통과하는 경우가 많다. 인증 연동의 되돌아올 주소 등록 목록도 함께 확인한다.`,

'web-cache-deception': R`## 바로 확인하기

인증 상태로 가짜 확장자 경로를 요청해 응답과 캐시 헤더를 본다.

\`\`\`bash
U=https://example.com/mypage/nonexistent.css
curl -sI -H "Cookie: session=$S" "$U" | grep -iE 'HTTP/|cache-control|age|x-cache'
curl -sI "$U" | grep -iE 'HTTP/|age|x-cache'   # 인증 없이 두 번째 요청
\`\`\`

첫 요청이 200 이면 라우팅이 뒤 경로를 무시하는 것이다. 두 번째 요청에서 Age 값이 보이면 이미 캐시된 상태다. 둘 다 해당하면 즉시 조치한다.`,

'client-side-validation-trap': R`## 바로 확인하기

화면을 거치지 않고 직접 호출해 본다.

\`\`\`bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"itemId":1,"qty":-5,"total":0,"role":"admin"}' \
  https://api.example.com/orders
\`\`\`

400 이 아니면 서버 검증이 부족한 것이다. 음수 수량, 0 원 금액, 권한 필드 세 가지를 함께 넣어 보면 대량 할당과 값 검증을 한 번에 확인할 수 있다.

주요 엔드포인트에 대해 이 시험을 자동화해 파이프라인에 넣으면 회귀를 막을 수 있다.`,
}
