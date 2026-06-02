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
wrangler secret put AI_PASSWORD      # ← (권장) AI 교정 접근 비밀번호
```

> **AI_PASSWORD** 를 설정하면, 앱에서 AI 교정을 처음 누를 때 이 비밀번호를
> 입력해야 동작합니다(브라우저에 1회 저장). 모르는 사람이 내 무료 할당량을
> 쓰지 못하게 막아줍니다.

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

## 3-1. (선택) 다중 모델 폴백 설정

1순위 모델이 무료 티어 한도(429 / Quota Exceeded)에 걸리면 자동으로 다음 순위
모델로 넘어갑니다. 별도 설정 없이도 기본 체인
(`gemini-2.5-flash → gemini-2.5-flash-lite → gemini-2.0-flash → gemini-2.0-flash-lite`)
이 적용됩니다. 우선순위를 직접 바꾸려면 `wrangler.toml` 에 다음을 추가하세요:

```toml
[vars]
# 쉼표로 우선순위를 지정(앞이 1순위). 존재하지 않는 모델 ID는 자동으로 건너뜁니다.
GEMINI_MODELS = "gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.0-flash"
```

> 앱 헤더의 "배터리" 표시로 지금 어떤 모델이 응답했는지 확인할 수 있습니다.
> (1순위=가득 찬 초록, 한도 초과로 하위 모델로 갈수록 노랑→주황→빨강)

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
