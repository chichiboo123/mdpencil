# Gemini OCR 교정 프록시 (Cloudflare Worker)

몽당(MD)연필의 **AI 교정** 기능은 Google AI Studio(Gemini) API를 사용합니다.
이 앱은 GitHub Pages 정적 사이트라서 API 키를 코드에 넣으면 누구나 훔쳐볼 수
있습니다. 그래서 키를 **이 Worker의 비밀(secret)** 에만 보관하고, 프런트엔드는
Worker 주소만 호출합니다.

## 1. Google AI Studio API 키 발급 (무료)

1. https://aistudio.google.com 접속 후 Google 계정 로그인
2. 우측 상단 **Get API key → Create API key**
3. 생성된 키 복사 (카드 등록 불필요, 무료 티어)

## 2. Worker 배포

```bash
npm install -g wrangler     # 최초 1회
wrangler login              # 브라우저로 Cloudflare 로그인

cd worker
wrangler deploy             # gemini-proxy.js 배포
wrangler secret put GEMINI_API_KEY   # ← 위에서 받은 키 붙여넣기
```

배포가 끝나면 다음과 같은 주소가 출력됩니다:

```
https://gemini-proxy.<your-account>.workers.dev
```

## 3. (권장) 호출 도메인 제한

`wrangler.toml` 의 `ALLOWED_ORIGIN` 을 본인 사이트 주소로 바꾸면, 그 사이트에서만
프록시를 쓸 수 있어 무료 할당량이 보호됩니다.

```toml
[vars]
ALLOWED_ORIGIN = "https://chichiboo123.github.io"
```

바꾼 뒤 `wrangler deploy` 를 다시 실행하세요.

## 4. 앱에 연결

앱 우측 상단 **⚙️ 설정**을 열고:

- **AI 교정 사용** 체크
- **프록시 주소**에 2단계의 Worker 주소 붙여넣기
- 저장

이제 이미지를 업로드하면 OCR 후 Gemini가 띄어쓰기·오타·영어 인식을 교정합니다.

---

### 다른 호스팅을 쓰고 싶다면

Vercel / Netlify Functions 등에서도 동일한 계약으로 만들면 됩니다:

```
POST  { "text": "...", "lang": "ko" }   →   200  { "text": "교정된 마크다운" }
```

`gemini-proxy.js` 의 핸들러 로직을 해당 플랫폼 형식으로 옮기고, 환경변수에
`GEMINI_API_KEY` 를 등록하면 됩니다.
