# Netlify로 배포하기 (AI 교정 포함)

Netlify는 **앱과 Gemini 교정 프록시를 같은 도메인**에서 호스팅할 수 있어
CORS 설정이 필요 없고 가장 간단합니다. API 키는 Netlify 환경변수에만 저장되어
브라우저나 코드에 노출되지 않습니다.

---

## 1. Google AI Studio API 키 발급 (무료)

1. https://aistudio.google.com 접속 → Google 계정 로그인
2. 우측 상단 **Get API key → Create API key**
3. 생성된 키 복사 (카드 등록 불필요, 무료 티어)

---

## 2. Netlify에 사이트 배포

### 방법 A — GitHub 연동 (권장)

1. https://app.netlify.com 로그인 → **Add new site → Import an existing project**
2. **GitHub** 선택 → `chichiboo123/mdpencil` 저장소 선택
3. 빌드 설정은 `netlify.toml`에 이미 들어 있어 자동 인식됩니다:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. **Deploy** 클릭

> 배포할 브랜치는 Netlify의 **Site configuration → Build & deploy → Branches**
> 에서 지정할 수 있습니다. (예: `main` 또는 작업 브랜치)

### 방법 B — CLI로 배포

```bash
npm install -g netlify-cli
netlify login
netlify init     # 또는 netlify deploy --build --prod
```

---

## 3. API 키 입력 (가장 중요)

Netlify 대시보드에서:

1. **Site configuration → Environment variables → Add a variable**
2. 다음을 추가:

| Key | Value | 필수 |
|-----|-------|------|
| `GEMINI_API_KEY` | 1단계에서 받은 키 | ✅ 필수 |
| `GEMINI_MODEL` | `gemini-2.5-flash` | 선택 |
| `ALLOWED_ORIGIN` | 본인 사이트 주소 (예: `https://mdpencil.netlify.app`) | 선택(권장) |

3. 저장 후 **Deploys → Trigger deploy → Deploy site** 로 재배포
   (환경변수는 재배포해야 적용됩니다)

---

## 4. 함수 동작 확인

배포가 끝나면 프록시 주소는 둘 중 하나입니다(둘 다 동작):

```
https://<your-site>.netlify.app/.netlify/functions/gemini
https://<your-site>.netlify.app/api/gemini
```

브라우저 콘솔이나 터미널에서 테스트:

```bash
curl -X POST https://<your-site>.netlify.app/api/gemini \
  -H "Content-Type: application/json" \
  -d '{"text":"# 교 육 과정 속 배 움","lang":"ko"}'
```

`{ "text": "# 교육과정 속 배움" }` 같은 교정 결과가 오면 성공입니다.

---

## 5. 앱에서 AI 교정 켜기

배포된 사이트를 열고 우측 상단 **⚙️ 설정**:

- **AI 교정 사용** 체크
- **프록시 주소** 입력:
  - 같은 Netlify 사이트를 쓰면 짧게 **`/api/gemini`** 만 입력해도 됩니다.
  - GitHub Pages 등 다른 곳에서 앱을 쓰는 경우 전체 주소
    `https://<your-site>.netlify.app/api/gemini` 를 입력하고,
    위 3단계에서 `ALLOWED_ORIGIN` 을 그 GitHub Pages 주소로 설정하세요.
- **저장**

이제 이미지를 업로드하면 OCR 후 Gemini가 띄어쓰기·오타·영어/일본어
인식 오류를 교정합니다. 교정에 실패하면 자동으로 원본 OCR 결과를 보여줍니다.

---

## 참고: 무료 티어 한도

Gemini 무료 티어는 모델별 분당 요청 수(RPM)·일일 요청 수(RPD) 제한이 있습니다.
교육용 소량 사용에는 충분합니다. 한도를 초과하면(429 오류) 앱은 원본 OCR
결과로 폴백하므로 앱이 멈추지는 않습니다.
