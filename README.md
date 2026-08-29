# blog.sanghak.kr

자유 주제 개인 블로그. 글을 쓰면 **본문을 분석해 태그(최대 3개)가 자동으로 붙고**,
사이드바의 태그를 누르면 그 태그가 달린 글이 모입니다.

- 프론트: Vite + React + TypeScript + Tailwind (SPA)
- 데이터: Firebase Firestore
- 인증: Firebase Auth — Google OAuth
- 이미지: Cloudflare R2 (Worker 경유 업로드)
- 태그 분석: 브라우저 내 TF-IDF 분석 (외부 API·키 없음)
- 배포: GitHub Actions → GitHub Pages

## 태그가 만들어지는 방식

외부 API 나 키 없이 브라우저 안에서 본문을 분석합니다 ([localTagger.ts](src/lib/localTagger.ts)).

1. 코드블록·이미지·URL 을 걷어내고 제목(×4)·소제목(×2.5)·강조(×2)·도입부(×1.6)·본문(×1) 으로
   구역을 나눠 가중치를 줍니다.
2. 한국어 조사·어미를 벗겨 "블로그를"·"블로그는" 을 같은 말로 묶고, 용언 조각("했나", "만들어")은
   버립니다.
3. **이 블로그의 다른 글 전체를 코퍼스로 TF-IDF 를 계산합니다.** 모든 글에 흔한 말은 점수가
   떨어지고, 이 글에서만 두드러지는 말이 올라옵니다.
4. 되풀이되는 두 어절은 복합어로 합치고, 낱말과 복합어가 겹치면 하나만 남깁니다.
5. 이미 쓰고 있는 태그와 같으면 점수를 올려(×1.7) 표기만 다른 중복 태그가 생기지 않게 합니다.

에디터는 후보를 점수·근거와 함께 보여주고 상위 3개를 기본 선택합니다. 눌러서 바꿀 수 있습니다.

한계: 형태소 분석기가 아니라 규칙 기반이라 본문에 없는 상위 개념(예: 글은 이직 얘기인데 태그는
`커리어`)은 뽑지 못합니다. 뽑히는 건 어디까지나 본문에 실제로 나온 말입니다.

## 데이터 구조

```
posts/{id}          title, body, excerpt, tags[≤3], published, createdAt, updatedAt
tags/{태그}          name, count
audit/{id}          at, action, actorEmail, actorUid, target, detail, userAgent   (추가 전용)
settings/security   postingLocked, reauthAfterMinutes, allowImageUpload
```

글·태그·감사 로그·보안 설정은 모두 Firestore 에 있습니다. 이미지 원본만 R2 에 두고
그 URL 을 본문에 남깁니다.

## 관리 콘솔

`/admin` 아래 세 개의 탭이 있습니다.

- **글** — 목록, 작성, 수정, 삭제
- **감사 로그** — 로그인·발행·삭제·업로드 기록. 규칙상 추가만 가능하고 수정·삭제가 불가능합니다.
- **보안** — 현재 세션 정보, 관리자 계정 목록, 아래 설정

보안 설정은 Firestore 규칙이 직접 읽어 서버에서 강제합니다.

| 설정 | 효과 |
| --- | --- |
| 글쓰기 잠금 | 켜면 관리자라도 글 생성·수정·삭제가 규칙 단계에서 거부됩니다 |
| 재인증 요구 주기 | 마지막 로그인 후 N분이 지나면 발행·삭제 전 구글 재로그인을 요구합니다 |
| 이미지 업로드 | 끄면 에디터에서 업로드가 막힙니다 |

## 처음 설정하기

### 1. Firebase

1. 콘솔에서 프로젝트 생성 → 웹 앱 추가 → 설정값을 `.env.local` 에 채웁니다 (`.env.example` 참고).
2. Authentication → Google 로그인 사용 설정. 승인된 도메인에 `blog.sanghak.kr` 추가.
3. Firestore 생성 후 규칙과 인덱스 배포:

```bash
firebase deploy --only firestore
```

`firestore.rules` 안의 관리자 이메일 목록도 함께 수정하세요.

### 2. Cloudflare Worker (이미지 업로드)

```bash
cd worker
npx wrangler r2 bucket create blog-images
npx wrangler deploy
```

`wrangler.jsonc` 의 `FIREBASE_PROJECT_ID`, `PUBLIC_BASE_URL`(R2 공개 도메인),
`ALLOWED_ORIGIN`, `ADMIN_EMAILS` 를 채워야 합니다.

### 3. GitHub Pages

- Settings → Pages → Source 를 **GitHub Actions** 로 설정
- Settings → Pages → Custom domain 에 `blog.sanghak.kr` (`public/CNAME` 도 함께 커밋되어 있음)
- DNS 에 `blog` CNAME → `sanghakbae.github.io`
- Settings → Secrets and variables → Actions → **Variables** 에 `VITE_*` 값 등록
- Worker 자동 배포를 쓰려면 **Secrets** 에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## 개발

```bash
npm install
npm run dev
```

`/admin` 에서 글을 쓰고 관리합니다. 이미지는 본문에 붙여넣거나 끌어다 놓으면 R2 로 올라갑니다.
