# 맞짱로 — 격투 클리커 게임

수련하고, 강화하고, 골목의 왕이 되어라!

모바일웹 격투 클리커 게임 프로토타입.

## 게임 플레이

1. **수련** — 도구를 탭해서 펀치/킥 스탯을 올리고 원(돈)을 벌자
2. **강화** — 원으로 스탯을 영구 강화, 수련 도구도 업그레이드
3. **골목** — 5개 골목에 도전! 잡졸 5명 + 보스를 쓰러뜨려라
4. **배틀** — 좌펀치 → 우펀치 → 킥 3단 콤보로 적을 처치
5. **패시브** — 클리어한 골목에서 자동으로 원이 들어온다

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | React 19 + TypeScript |
| 빌드 | Vite 8 |
| 상태관리 | Zustand (vanilla store) |
| 큰 숫자 | break_infinity.js |
| 사운드 | Web Audio API (프로시저럴 생성) |
| PWA | Service Worker + manifest.json |
| 배포 | Vercel |

## 프로젝트 구조

```
src/
├── engine/            # 순수 TS 게임 로직 (React 의존성 없음)
│   ├── store.ts       # Zustand vanilla store
│   ├── formulas.ts    # 데미지, 강화비용, 적HP 공식
│   ├── types.ts       # 타입 정의
│   ├── numberFormat.ts    # 만/억/조 한국식 포매터
│   ├── gameLoop.ts    # 10Hz 게임 틱 루프
│   ├── soundManager.ts    # Web Audio 효과음
│   └── debugLog.ts    # 콘솔 디버그 도구
├── scenes/            # React 씬 컴포넌트 (lazy import)
│   ├── TrainingScene.tsx
│   ├── UpgradeScene.tsx
│   ├── MapScene.tsx
│   └── BattleScene.tsx
├── ui/                # 공통 UI 컴포넌트
├── hooks/             # useGameStore, useGameLoop
└── App.tsx            # 씬 라우터 + 네비게이션
```

## 로컬 개발

```bash
npm install
npm run dev
```

`http://localhost:3000` 에서 실행됩니다.
모바일 테스트: 같은 네트워크에서 `http://<IP>:3000` 접속.

## 빌드

```bash
npm run build            # 프로덕션 빌드
npm run build:analyze    # 번들 크기 분석 (시각화)
npm run preview          # 빌드 결과 미리보기
```

## 배포 (Vercel)

```bash
npx vercel
```

또는 GitHub 저장소 연동 후 push 시 자동 배포.
`vercel.json`에 SPA fallback, 에셋 캐시 헤더 설정 포함.

## 개발자 도구

- 개발 모드 우측 하단 🛠 버튼 (프로덕션에서는 숨김)
- 브라우저 콘솔: `mazzangDebug.logBalance()`

## 라이선스

MIT
