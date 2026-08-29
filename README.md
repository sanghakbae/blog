# blog.sanghak.kr

자유 주제 개인 블로그. 글을 쓰면 **본문을 분석해 태그가 붙고**, 사이드바의 태그를 누르면
그 태그가 달린 글이 모입니다. 현재 보안 실무 글 100편이 올라가 있습니다.

- 프론트: Vite + React + TypeScript + Tailwind (SPA)
- 데이터: Firebase Firestore (글·태그·댓글·감사 로그·보안 설정)
- 인증: Firebase Auth — Google OAuth
- 이미지: Cloudflare R2 + Worker (업로드와 서빙을 한 Worker 가 처리)
- 배포: GitHub Actions → GitHub Pages

## 기능

**읽는 쪽**

- 글 목록 — 잡지 목차형, 글 번호는 최신 글이 가장 큼
- 태그 사이드바 — 세로 공간에 들어가는 만큼 자동으로 표시
- 검색 (⌘K) — 제목·태그·요약·본문에 가중치를 둔 점수 정렬, 방향키 이동
- 글마다 목차(현재 위치 표시), 읽는 시간, 이전·다음 글, 같은 태그의 글
- 댓글 — 구글 로그인 사용자가 작성·수정·삭제
- MD / PDF 내려받기 — PDF 는 인쇄 대화상자 없이 바로 파일로 저장
- 화면 테마 — 시스템 / 밝게 / 어둡게 (상단 바는 항상 짙은 회색)

**쓰는 쪽** (`/admin`)

- 글 — 목록, 작성, 수정, 삭제
- 감사 로그 — 로그인·발행·삭제·업로드 기록. 규칙상 추가만 가능하고 수정·삭제가 불가능
- SEO / GEO — 글마다 점검 결과와 포털별 색인 상태
- 보안 — 세션 정보, 관리자 계정, 글쓰기 잠금 등

에디터는 서식 툴바, 실시간 분할 미리보기, 단축키(⌘B/I/K/S, ⌘⌥2·3), 로컬 초안 자동 저장,
이미지 붙여넣기·드래그 업로드를 지원합니다.

## 태그가 만들어지는 방식

외부 API 없이 브라우저 안에서 본문을 분석합니다 ([localTagger.ts](src/lib/localTagger.ts)).

핵심은 **태그를 통제된 용어집에서만 고른다**는 점입니다. 본문에서 단어를 뽑는 방식은
'실수', '전체', '공개' 같은 일반 명사를 태그로 만듭니다. 기술 블로그의 태그는 분류 체계여야
하므로 [vocabulary.ts](src/lib/vocabulary.ts) 에 정의된 105개 기술 용어만 후보가 됩니다.

1. 코드블록·이미지·URL 을 걷어내고 제목(×6)·소제목(×3)·강조(×2)·도입부(×1.8)로 가중치를 준다
2. 용어집 항목이 본문 어디에 몇 번 나오는지 센다
3. 제목·소제목에 있거나 본문에서 4회 이상 다뤄져야 후보가 된다 — 스쳐 지나간 언급은 뺀다
4. 모든 글에 흔한 용어는 IDF 로 감점하고, 이미 쓰는 태그는 재사용을 유도한다
5. 가장 중심적인 주제 점수의 45% 미만은 버린다 — 억지로 세 개를 채우지 않는다

에디터는 후보를 점수·근거와 함께 보여주고 상위 3개를 기본 선택합니다. 눌러서 바꿀 수 있습니다.

## SEO / GEO

SPA 라 GitHub Pages 가 `/posts/xxx` 에 404 를 돌려주고 있었습니다. 화면은 폴백으로 떴지만
상태 코드가 404 라 검색엔진이 색인하지 않습니다. 그래서 빌드 후
[prerender.mts](scripts/prerender.mts) 가 Firestore 에서 발행글을 읽어 정적 파일을 만듭니다.

- `/posts/<id>/index.html`, `/tags/<tag>/index.html` — 실제 파일이므로 200 응답
- 글별 title·description·OG·canonical
- JSON-LD: `BlogPosting`, 질문형 소제목이 있으면 `FAQPage`
- 본문 HTML 을 `#root` 안에 미리 넣어 크롤러가 자바스크립트 없이 읽는다
- `sitemap.xml`, `robots.txt`, `llms.txt` (답변 엔진용 안내문)

관리 콘솔의 SEO / GEO 탭은 글마다 아래를 점검합니다.

| 영역 | 항목 |
| --- | --- |
| 에디토리얼 | 본문 분량, 요약문, 제목 길이 |
| SEO | 검색 결과 설명, 핵심어, 태그, 소제목 구조, 주소 형태 |
| GEO | 답변용 첫 문단, 질문형 소제목, 출처 표기, 개체 지정, 표·목록 유무 |
| 이미지 | 본문 이미지, 대체 텍스트 |

색인 상태는 글마다 구글·네이버·빙 배지로 표시됩니다. `↗` 로 `site:` 검색을 열어 확인하고,
이름을 누르면 확인 표시가 남습니다(노란 바탕). 색인 여부를 사이트가 자동으로 알아낼 방법은
없습니다 — 검색 결과를 긁는 것은 각 사 약관 위반이고, 공식 API 는 OAuth 서버가 필요합니다.

## 데이터 구조

```
posts/{id}          title, body, excerpt, tags[≤3], published, author,
                    indexStatus{google,naver,bing}, createdAt, updatedAt
posts/{id}/comments/{id}   body, authorUid, authorName, authorPhoto, createdAt, editedAt
tags/{태그}          name, count
audit/{id}          at, action, actorEmail, actorUid, target, detail   (추가 전용)
settings/security   postingLocked, reauthAfterMinutes, allowImageUpload
```

글·태그·댓글·감사 로그·보안 설정은 모두 Firestore 에 있습니다. 게시글 도식 100개는 저장소의
정적 파일(`public/img/posts/*.svg`)이고, 에디터에서 올리는 이미지만 R2 에 저장됩니다.

## 보안 설정

관리 콘솔의 보안 탭에서 바꾸며, [firestore.rules](firestore.rules) 가 설정 문서를 직접 읽어
**서버에서 강제**합니다. 브라우저를 조작해도 우회되지 않습니다.

| 설정 | 효과 |
| --- | --- |
| 글쓰기 잠금 | 켜면 관리자라도 글 생성·수정·삭제가 규칙 단계에서 거부된다 |
| 재인증 요구 주기 | 마지막 로그인 후 N분이 지나면 발행·삭제 전 재로그인을 요구한다 (기본 꺼짐) |
| 이미지 업로드 | 끄면 에디터에서 업로드가 막힌다 |

## 개발

```bash
npm install
npm run dev
```

`.env.local` 에 Firebase 설정을 넣습니다 (`.env.example` 참고).
Firestore 에 접근할 수 없는 환경에서는 `VITE_LOCAL_DATA=1` 로 고정 데이터를 씁니다.

```bash
npx tsx scripts/seed.mts --local   # src/dev/seed-data.json 생성
npx tsx scripts/seed.mts --dry     # 제목과 태그만 확인
```

## 배포

`main` 에 푸시하면 GitHub Actions 가 빌드하고 Pages 에 올립니다.
빌드는 `vite build` 뒤에 정적 페이지 생성까지 포함합니다.

새 글을 쓴 뒤 검색 포털에 알리려면 다음을 실행합니다.

```bash
npm run build && npm run indexnow
```

IndexNow 는 한 번 제출하면 Bing·Naver·Yandex·Seznam 이 함께 받습니다. 구글은 IndexNow 에
참여하지 않으므로 Search Console 에 제출한 `sitemap.xml` 로 처리됩니다(등록·제출 완료).

## 처음 설정하기

### Firebase

1. 콘솔에서 프로젝트 생성 → 웹 앱 추가 → 설정값을 `.env.local` 에 채웁니다
2. Authentication → Google 로그인 사용 설정, 승인된 도메인에 `blog.sanghak.kr` 추가
3. Firestore 규칙에 [firestore.rules](firestore.rules) 내용을 게시합니다
4. 복합 색인 세 개를 만듭니다 — `published+createdAt`(양방향), `tags+published+createdAt`

관리자 이메일은 `firestore.rules` 와 `VITE_ADMIN_EMAILS` 두 곳에 있어야 합니다.

### Cloudflare Worker (이미지)

```bash
cd worker
npx wrangler r2 bucket create blog-images
npx wrangler deploy
```

`wrangler.jsonc` 의 `FIREBASE_PROJECT_ID`, `ADMIN_EMAILS`, `ALLOWED_ORIGIN` 을 채웁니다.
배포된 주소를 `VITE_UPLOAD_ENDPOINT` 에 넣습니다. Worker 가 업로드와 서빙을 함께 처리하므로
별도 공개 도메인이나 공개 버킷 설정은 필요 없습니다.

### GitHub Pages

- Settings → Pages → Source 를 **GitHub Actions** 로
- Custom domain 에 `blog.sanghak.kr` (`public/CNAME` 도 함께 커밋되어 있음)
- DNS 에 `blog` CNAME → `sanghakbae.github.io`
- Settings → Secrets and variables → Actions → **Variables** 에 `VITE_*` 값 등록
- Worker 를 CI 에서 배포하려면 **Secrets** 에 `CLOUDFLARE_API_TOKEN` (없으면 건너뜁니다)
