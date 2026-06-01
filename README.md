# ✏️ 몽당(MD)연필

> 이미지·PDF 속 글자를 **Markdown 형식의 디지털 텍스트**로 변환하는 교육용 도구

학습지, 안내문, 대본, 칠판 사진 등 종이·화면 속 텍스트를 브라우저에서 바로 OCR로 추출하고, 보기 좋은 Markdown 문서로 정리합니다. **모든 처리는 브라우저 안에서 이루어지며, 서버나 외부 유료 API를 사용하지 않습니다.** (이미지가 외부로 전송되지 않아 개인정보에 안전합니다.)

🔗 한국어 · English · 日本語 지원

---

## ✨ 주요 기능

- 🖼️ **이미지 OCR** — JPG, PNG, WEBP에서 텍스트 추출
- 📄 **PDF OCR** — 여러 페이지를 한 번에 처리
- 📋 **붙여넣기 지원** — `Ctrl+V`로 클립보드 이미지 바로 변환
- 📐 **구조 자동 복원** — 줄 bounding box(높이·간격)로 제목·문단을 복원 (완전성 우선, 텍스트 손실 없음)
- 🧹 **노이즈 보수적 제거** — 역슬래시·기호 군집 등 명백한 쓰레기만 제거 (정상 본문은 보존)
- 📝 **Markdown 자동 구조화** — 제목·목록·문단을 자동 인식
- 🧰 **마크다운 서식 툴바** — 제목·굵게·목록·인용·코드·링크 등을 버튼으로 손쉽게 삽입/토글
- 📚 **마크다운 문법 가이드** — 소스↔결과를 나란히 보여주는 문법 도움말 (편집기 '문법' 버튼)
- ✨ **AI 교정 (선택)** — Google AI Studio(Gemini)로 띄어쓰기·오타·다국어 인식 오류를 교정 (본인 무료 API 키 + 프록시 필요 · 배포 가이드: [Netlify](netlify/README.md) / [Cloudflare Worker](worker/README.md))
- 👀 **실시간 미리보기** — 편집/미리보기 탭 전환
- 🔊 **음성 읽기(TTS)** — 인식한 언어로 결과를 읽어줌 (속도 조절, 긴 글 끊김 방지)
- 📥 **복사 & 다운로드** — 클립보드 복사 또는 `.md` 파일 저장
- 📊 **글자/단어 수** 실시간 표시
- 🌐 **다국어 UI** — 한국어/영어/일본어
- ♿ **접근성** — 스크린리더 안내, 키보드 조작, 포커스 관리

---

## 🚀 사용 방법

1. 이미지(JPG, PNG, WEBP)나 PDF를 **끌어다 놓거나** 클릭해서 선택, 또는 `Ctrl+V`로 붙여넣기
2. **인식 언어**(한국어/English/日本語)를 선택
3. OCR이 자동으로 텍스트를 추출하고 Markdown으로 정리
4. 결과를 자유롭게 편집
5. **복사**, **다운로드(.md)**, **음성 읽기**로 활용

---

## 🧠 OCR 파이프라인 (완전성 우선 + 구조 복원)

설계 원칙은 **① 인식된 텍스트를 절대 잃지 않는다(완전성) → ② 기하 정보로 구조를 복원한다 → ③ 명백한 노이즈만 보수적으로 정리한다** 입니다. 모든 처리는 **무료·온디바이스**로 동작합니다.

| 단계 | 처리 | 목적 |
|------|------|------|
| 1. 전처리 | 그레이스케일 + 대비 정규화 + 확대(≈300DPI) | 텍스트 가독성 향상 (※ 하드 이진화는 사진을 노이즈로 만들어 **의도적으로 생략**, 이진화는 Tesseract 내부 적응형 처리에 위임) |
| 2. 인식 | Tesseract `PSM 6`(단일 블록) | 영역을 건너뛰지 않고 **본문 전체를 누락 없이** 인식 |
| 3. 구조 복원 | 줄 **bounding box** 분석 | 줄 높이 → 제목(#/##), 세로 간격 → 문단 구분. `marker`·`MinerU` 같은 문서 파서의 기하 기반 방식 |
| 4. 노이즈 정리 | 보수적 패턴 필터 | 역슬래시·기호 군집·숫자-글자 접합 등 **명백한** 쓰레기 줄만 제거 |

> ⚙️ **설계 변경 이력**: 초기 버전은 단어별 confidence가 낮으면 버렸으나, 한국어 OCR은 정답이어도 신뢰도가 40~70으로 낮게 나오는 경우가 많아 **정상 텍스트까지 손실**되는 문제가 있었습니다. 그래서 신뢰도로 텍스트를 버리지 않고, 인식된 모든 단어를 보존한 뒤 **기하 정보로 구조만 복원**하도록 변경했습니다. 구조 복원본이 원문 글자수의 90% 미만이면 원문으로 자동 폴백하여 완전성을 보장합니다.

### ⚠️ 알아두기

- OCR은 화면의 **모든 글자**를 읽으려 하므로, SNS 스크린샷처럼 좋아요 수·시간·아이콘이 많은 이미지는 일부 노이즈가 남을 수 있습니다. 남은 부분은 편집기에서 쉽게 지울 수 있습니다.
- 선명하고 글자가 큰, 텍스트 위주의 이미지일수록 인식률이 높습니다.
- 참고한 오픈소스: [Tesseract.js](https://github.com/naptha/tesseract.js), [Tesseract 공식 품질 개선 가이드](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html), [datalab-to/marker](https://github.com/datalab-to/marker), [opendatalab/MinerU](https://github.com/opendatalab/MinerU)

---

## 🛠️ 기술 스택

| 구분 | 사용 기술 |
|------|-----------|
| 프레임워크 | [React 18](https://react.dev/) + [Vite 6](https://vitejs.dev/) |
| OCR 엔진 | [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0, 브라우저 내장 OCR) |
| PDF 렌더링 | [PDF.js](https://github.com/mozilla/pdf.js) (Apache-2.0) |
| 다국어 | [i18next](https://www.i18next.com/) + react-i18next |
| 음성 읽기 | Web Speech API (`SpeechSynthesis`, 브라우저 내장) |
| 폰트/아이콘 | [Pretendard](https://github.com/orioncactus/pretendard), Black Han Sans, Material Icons |
| 배포 | GitHub Pages (정적 호스팅) |

모든 핵심 라이브러리는 **오픈소스·무료**이며, 추론·변환이 전부 클라이언트에서 실행되어 **운영 비용이 들지 않습니다.**

---

## 💻 로컬에서 실행하기

```bash
# 의존성 설치
npm install

# 개발 서버 (http://localhost:5173)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

> Node.js 18+ 권장.

---

## 📁 프로젝트 구조

```
src/
├─ App.jsx                # 앱 진입점·상태 관리·OCR 작업 흐름
├─ components/
│  ├─ Header.jsx          # 로고·언어 선택·도움말
│  ├─ UploadZone.jsx      # 드래그&드롭/붙여넣기 업로드 + 파일 검증
│  ├─ Preview.jsx         # 원본 이미지·PDF 페이지 미리보기
│  ├─ Editor.jsx          # Markdown 편집/미리보기 + 글자·단어 수
│  ├─ Toolbar.jsx         # 복사·다운로드(.md)·지우기
│  ├─ TtsControls.jsx     # 음성 읽기 컨트롤
│  ├─ HelpModal.jsx       # 사용법 안내(접근성 다이얼로그)
│  └─ Footer.jsx
├─ utils/
│  ├─ ocr.js              # 전처리 + Tesseract + 신뢰도 기반 노이즈 제거
│  ├─ pdf.js              # PDF.js 페이지 렌더링
│  ├─ markdown.js         # OCR 텍스트 정리·구조화·HTML/TTS 변환
│  └─ tts.js              # Web Speech API 컨트롤러 (청크 분할)
└─ i18n/                  # ko / en / ja 번역
```

---

## ♿ 접근성

- Toast·로딩 상태에 `aria-live` 적용 (스크린리더 안내)
- 도움말 모달: `role="dialog"`, 포커스 이동·복원, `Esc` 닫기
- 아이콘 전용 버튼에 `aria-label`
- 업로드 영역 키보드 조작(`Enter`/`Space`) 지원

---

## 📄 라이선스 / 크레딧

Created by **교육뮤지컬 꿈꾸는 치수쌤** — [litt.ly/chichiboo](https://litt.ly/chichiboo)

오픈소스 라이브러리(Tesseract.js, PDF.js, React, i18next 등)의 각 라이선스를 따릅니다.
