# Spirit Type — Generative Pattern Applier

## 프로젝트 개요
글자를 입력하면 자연현상 기반 제너러티브 패턴을 글자 형태에 적용하는 WebGL2 툴.
Vite + React 18 + TypeScript. 브라우저에서 직접 실행, 별도 서버 불필요.

**Repo:** https://github.com/frognation/spirit-type-generative-pattern-applier
**배포(GitHub Pages):** https://frognation.github.io/spirit-type-generative-pattern-applier/

---

## 로컬 개발

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ 생성
```

---

## 아키텍처

```
src/
├── types.ts               # AppState, EffectName, 파라미터 타입 전체
├── Simulation.ts          # WebGL2 컨트롤러. 캔버스 + 디스플레이 셰이더 + 이펙트 관리
├── App.tsx                # React root. state 관리, useEffect로 Simulation 초기화
├── App.css / index.css    # 스타일 (dark/light CSS 변수)
├── main.tsx               # createRoot 진입점
├── components/
│   ├── Sidebar.tsx        # 272px 우측 패널 (Text / Effect / Color / Canvas 섹션)
│   └── Toolbar.tsx        # 하단 glassmorphism 툴바 (play/step/reset/export/REC)
├── effects/               # BaseEffect를 상속하는 각 이펙트
│   ├── BaseEffect.ts      # 추상 베이스: tick(), getDisplayTexture(), getSrcType(), toSVG()
│   ├── PhysarumEffect.ts  # WebGL2 피직사룸 슬라임 (GPU 에이전트 + 트레일)
│   ├── RDEffect.ts        # Gray-Scott 반응확산 (WebGL2 ping-pong)
│   ├── WaveEffect.ts      # 원형파 간섭 (WebGL2 fragment shader)
│   ├── GoLEffect.ts       # Game of Life CPU (Classic/Highlife/34Life)
│   ├── DLAEffect.ts       # DLA 확산 집적 CPU
│   ├── VoronoiEffect.ts   # 보로노이 CPU + SVG 시드 점 export
│   ├── CAEffect.ts        # 셀룰러 오토마타 CPU (Brian's Brain/Seeds/Morley)
│   └── FractalEffect.ts   # Space Colonization CPU + SVG line export
└── utils/
    ├── textMask.ts        # 글자 → Float32Array 마스크 (offscreen canvas)
    └── webgl.ts           # compileShader, linkProgram, makeR32F, makeRGBA32F, makeFBO 등
```

---

## 이펙트 목록 (EffectName)

| ID | 레이블 | 방식 | getSrcType() |
|----|--------|------|-------------|
| `physarum` | Physarum | WebGL2 GPU | 0 |
| `physarum` + `physarumOuter=true` | Hate | WebGL2 GPU, 글자 바깥에서 성장 | 0 |
| `rd-maze` | RD Maze | WebGL2 GPU (f=0.029, k=0.057) | 1 |
| `rd-spots` | RD Spots | WebGL2 GPU (f=0.034, k=0.0618) | 1 |
| `gol` | Life | CPU → RGBA8 tex upload | 4 |
| `dla` | DLA | CPU → RGBA8 tex upload | 4 |
| `voronoi` | Voronoi | CPU → RGBA8 tex upload | 4 |
| `wave` | Wave | WebGL2 GPU fragment | 3 |
| `ca` | CA | CPU → RGBA8 tex upload | 4 |
| `fractal` | Fractal | CPU → RGBA8 tex upload | 4 |

---

## 핵심 설계 포인트

### "Hate" outer 모드
`physarumOuter=true`일 때:
- 마스크를 반전해 에이전트가 글자 바깥에서 성장
- 디스플레이 셰이더의 `u_outerMode=1`이 트레일 위에 흰 글자 형태를 `max()` 합성

### RD 마스크 플래그
RD 상태 텍스처의 `.b` 채널에 maskFlag(0 또는 1) 저장.
디스플레이: `t = maskFlag * (1 - clamp(B * 3.5, 0, 1))` → 글자 바깥은 항상 배경색.

### 디스플레이 셰이더 통일
모든 이펙트(GPU/CPU)가 동일한 WebGL 디스플레이 셰이더를 통과함.
`u_srcType`으로 분기, `u_colorMode`로 BW/2tone/3tone 컬러 맵 적용.

### 상태 업데이트 두 가지
- `setState()` — 300ms 디바운스 후 `sim.reset()` (마스크/이펙트 재생성)
- `setParamLive()` — 즉시 `sim.updateState()` (셰이더 유니폼만 갱신, 리빌드 없음)

---

## 배포
GitHub Actions (`.github/workflows/deploy.yml`)가 `main` 브랜치 push마다
`npm run build` → `dist/` → `gh-pages` 브랜치로 자동 배포.

---

## 남은 작업 / 개선 아이디어
- [ ] Physarum 에이전트 수 변경 시 reset 없이 실시간 조절
- [ ] 모바일 터치 지원
- [ ] 더 많은 폰트 옵션 (Google Fonts 연동)
- [ ] 이펙트 블렌딩 (두 이펙트 믹스)
- [ ] 배경 이미지 임포트 후 마스크로 사용
