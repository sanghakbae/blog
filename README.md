# blog.sanghak.kr

자유 주제 개인 블로그. 글을 쓰면 **본문을 분석해 태그(최대 3개)가 자동으로 붙고**,
사이드바의 태그를 누르면 그 태그가 달린 글이 모입니다.

- 프론트: Vite + React + TypeScript + Tailwind (SPA)
- 데이터: Firebase Firestore
- 인증: Firebase Auth — Google OAuth
- 이미지: Cloudflare R2 (Worker 경유 업로드)
- 태그 분석: Claude (`claude-opus-5`) — Worker 안에서만 호출
- 배포: GitHub Actions → GitHub Pages

## 태그가 만들어지는 방식

1. 에디터에서 발행하면 제목·본문과 **이미 존재하는 태그 목록**을 Worker `/tags` 로 보냅니다.
2. Worker 가 Claude 에게 글 전체를 읽히고, "이 글이 실제로 무엇에 대한 글인지" 를 기준으로
   태그를 최대 3개까지 받아옵니다. 같은 주제면 기존 태그를 재사용하도록 유도해 표기만 다른
   중복 태그가 생기지 않게 합니다.
3. 결과를 에디터에서 근거와 함께 확인하고(원하면 빼고) 저장합니다.
4. 저장 시 `tags/{태그}` 문서의 `count` 를 증감시켜 사이드바 목록을 만듭니다.

태그 3개 제한은 프론트, Worker, Firestore 규칙 세 곳에서 모두 걸려 있습니다.

## 데이터 구조

```
posts/{id}   title, body, excerpt, tags[≤3], published, createdAt, updatedAt
tags/{태그}   name, count
```

## 처음 설정하기

### 1. Firebase

1. 콘솔에서 프로젝트 생성 → 웹 앱 추가 → 설정값을 `.env.local` 에 채웁니다 (`.env.example` 참고).
2. Authentication → Google 로그인 사용 설정. 승인된 도메인에 `blog.sanghak.kr` 추가.
3. Firestore 생성 후 규칙과 인덱스 배포:

```bash
firebase deploy --only firestore
```

`firestore.rules` 안의 관리자 이메일 목록도 함께 수정하세요.

### 2. Cloudflare Worker (이미지 + 태그 분석)

```bash
cd worker
npx wrangler r2 bucket create blog-images
npx wrangler secret put ANTHROPIC_API_KEY
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
