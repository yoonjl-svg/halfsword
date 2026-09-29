# 출처 — 층별, 이용 조건, 읽은 깊이 (동작 연구 PM)

- 작성: 2026-09-29. 클립 JSON 의 `sources` 칸은 `tools/motion/lib/sources.mjs` 의 id 를 가리키고, 거기에 같은 내용이 들어 있다.
- **읽은 깊이를 솔직히 적는다.** 이 세션의 웹 읽기 도구는 거의 모든 사이트(Wiktenauer, Springer, IEEE, ResearchGate, CMU, PubMed 등)에서 막혔다. 그래서 **본문을 연 자료는 없고**, 모두 검색 결과 요약(snippet)이나 초록 수준이다. 숫자는 다른 곳에서 한 번 더 확인해야 한다.
  - 표기: `snippet` 검색 요약 · `abstract` 초록 · `full` 본문 · `memory` 확인 전 기억

## 0. 다른 세션이 이미 모은 출처 (옮기지 않고 링크만)

| 문서 | 브랜치 | 내용 |
|---|---|---|
| `docs/handoff/motion_research_handoff.md` (커밋 fc590ee) | `claude/pm-weapons` | 무기-검술 연구 인계서: 교본 계보, 모캡·생체역학 자료표(CMU·5MUDM·Delp·Holzbaur·SwordSTEM), 버린 시도 |
| `docs/weapon_motion_research.md`, `docs/pole_motion_research.md` | `claude/pm-weapons` | 무기 유형별 검술 동작 원전 조사, 자루 무기 동작 |
| `docs/weapon_motion_sources_one_pole.md`, `docs/weapon_motions.md` | `claude/pm-weapons-balance` | 무기 PM 동작 라이브러리 출처·자세표 |
| `docs/reference/combatlab_handoff_2026-09-27.md` | `main` | 이전 Unity CombatLab: Fiore Getty 원고 특정(22r·23r·23v), CMU swordplay 거절 경위 |

## 0-1. 이 세션에서 막힌 곳 (EGRESS 차단 — 다시 시도하지 않는다)

웹 본문 읽기 도구와 curl 이 프록시에서 거절됨(2026-09-29): wiktenauer.com, link.springer.com, ieeexplore.ieee.org, researchgate.net, mocap.cs.cmu.edu, pubmed.ncbi.nlm.nih.gov, pmc.ncbi.nlm.nih.gov, jstage.jst.go.jp, semanticscholar.org, zenodo.org, cdn.jsdelivr.net(curl). 검색 결과 요약만 받았다.

## 1. 교본 원문·도판 [원전]

| 자료 | 무엇에 썼나 | 이용 조건 | 읽은 깊이 |
|---|---|---|---|
| Liechtenauer Zettel (14세기) 다섯 비밀 베기 구절 | Zwerch·Schiel·Scheitel·Krump 의 목적(무엇을 꺾나) | 퍼블릭 도메인 | memory |
| Joachim Meyer, *Gründtliche Beschreibung der Kunst des Fechtens* (1570) | 분노의 자세(왼발 앞, 칼 오른 어깨, 칼날 등 뒤로), 네 곧은 베기, "모든 베기는 제 걸음", 베기 그림(세로·가로·사선) | 원문·도판 퍼블릭 도메인 | snippet (번역 인용 통해) |
| Pseudo-Hans Döbringer 주해 (1389, Hs.3227a) | 오른쪽에서 베며 오른발로 내딛기 | 원문 퍼블릭 도메인 | snippet |
| Sigmund Ringeck 주해 (15세기) | Zornhau 문장(오른 어깨에서 앞날로 세게, 약하면 칼끝을 얼굴로) | 원문 퍼블릭 도메인 | snippet |
| Fiore, Getty MS Ludwig XV 13 (22r·23r·23v) | 이번 v0 에는 쓰지 않음 (CombatLab 인계서의 내려베기 참고 기록만 물려받음) | Getty Open Content (이미지 자유 이용 — 조건 재확인 필요) | 이전 프로젝트 기록 |

## 2. 번역·해설 [2차]

| 자료 | 이용 조건 | 비고 |
|---|---|---|
| Forgeng 역 Meyer, *The Art of Combat* (Greenhill 2006 / Frontline 2015) | **저작권 있음** — 짧은 인용만 | 본문 확인하려면 책을 사야 한다(비용 → 사장님께 여쭘) |
| Wiktenauer 번역들 (Trosclair Ringeck, Lindholm Döbringer, Garber–Chidester Meyer 초벌 번역 PDF) | Wiktenauer 자체 글은 CC BY-SA 4.0, **번역마다 조건이 다름**(토론 페이지 표). 일부는 특별 허락으로만 올라 있음 | 조건 미확인 — 문장 인용은 짧게, 게임 안 글로 옮기지 않는다 |
| 해설 블로그 (grauenwolf, swordfight.uk, scholarvictoria) | 인용만 | Meyer 네 곧은 베기, 걸음 규칙 |
| **"Zornhau 끝 = 왼쪽 바꿈·옆 지킴"** | — | 현대 Meyer 수련의 관행으로 적었다 [기억]. Meyer 원문에서 확인 못 함 |

## 3. 모션 캡처 논문·데이터 [측정]

| 자료 | 내용 | 이용 조건 | 지금 상태 |
|---|---|---|---|
| Klempous·Kluwak·Kulbacki·Rozenblit 외, 독일 롱소드 다섯 비밀 베기 모캡 (PJAIT Human Motion Lab, Bytom; IEEE CINTI 2021, EUROCAST 2022 LNCS 13789) | Zornhau·Schielhau·Zwerchhau·Krumphau·Scheitelhau, 숙련자 1명 + 초보들, Vicon Plug-in Gait 39 마커 + 근전도 16, 영상 | **공개 안 됨.** "HML 에 요청하면 접근 가능"(초록). 재사용 조건 불명 | **가장 필요한 자료.** 얻으려면 연구소·저자 연락이 필요 → **사장님께 먼저 여쭘** |
| Grontman 외, "Analysis of sword fencing training evaluation possibilities using Motion Capture techniques", IEEE SoSE 2020 | 4명(전문 1), Zwerchhau·Schielhau 칼끝 마커 궤적 그림 | 논문 — 그림 값 인용 | 초록만. ResearchGate 에 PDF 가 있을 수 있음(열지 못함) |
| CMU Graphics Lab Motion Capture, subject 02 trial 07·08·09 "swordplay" (120 Hz) | 일반 칼놀림, 유파 검술 아님 | 연구·상업 제품 포함 사용 가능, **데이터 자체 재판매 금지**(변환본 포함), 출처 표기 요청 | 이전 CombatLab 에서 그대로 재생했다가 거절됨(뻣뻣함·뒤틀림). 여기서는 쓰지 않음 |
| Murase 외, 검도 8단 머리치기 모캡 (ISBS 2020) | 10명, 최대 노력 머리·손목 치기 | 논문 | 초록만 — 숫자 없음 |
| Choi 외, 거합 내려베기 (ISBS) | 32 마커 60 Hz, 숙련자는 벨 때 무게중심 속도가 초보보다 약 0.6 m/s 빠름 | 논문 | 초록만 |

## 4. 스포츠 생체역학 (칼 자료가 없는 칸의 "다른 동작 참고") [측정 2차]

| 자료 | 쓴 숫자 | 읽은 깊이 |
|---|---|---|
| Cheetham 외 2008 (골프 프로 vs 아마추어 운동 사슬) | 순서 골반 → 가슴 → 팔 → 채, 팔→채 간격이 골반→팔 간격의 2배 넘음 | snippet |
| 골프 최고 각속도 (출처 불확실, ResearchGate 333377321 추정) | 골반 480±82 · 가슴 605±87 · 앞팔 1310±236 °/s | snippet |
| TPI / Cheetham 2001 X-factor | 어깨 90° · 골반 50° → 40°. 내려치기 시작 때 X-factor 를 더 벌림(stretch) | snippet |
| Welch 외 1995 (JOSPT 22(5), 야구 타격) | 골반 714 → 어깨 937 °/s | snippet |
| Escamilla 외 2009 (야구) | 성인 윗몸 857 °/s, 배트 30 m/s | snippet |
| SwordSTEM (Sean Franklin) "How fast do swords move" | 힘 뺀 오른쪽 내려베기, 베는 부분 최고 약 20 m/s, 닿기 몇 인치 앞에서 최고 | snippet |
| George Turner (ARMA) "Sword Motions and Impacts" | 롱소드 칼끝 약 75 mph ≈ 33.5 m/s | snippet |
| AAOS 관절 가동 범위 (1965; Greene & Heckman 1994) | 어깨 굽힘·벌림 180°, 팔꿈치 150°, 손목 굽힘 80°·폄 70°, 가슴허리 돌림 45°, 엉덩이 돌림 45° | snippet |
| ISBS 엘리트 펜싱 런지 | 길이 1.24 m (0.88~1.86), 엉덩이 속도 1.97 m/s, 몸통 앞기울기 17.5° | snippet |
| 검도 머리치기 시간 (Sports Biomechanics 2026) | 대학 선수 머리치기 0.818±0.085 s, 손목치기 0.745±0.101 s | snippet |

## 5. 추정 [추정]

- 몸 모형 치수는 게임 뼈대(`src/fighter.js`) 그대로. 사람 팔(어깨→칼자루 약 0.63~0.66 m)보다 짧다(0.565 m).
- 키프레임 자세·시간, 운동 사슬 간격(골반 −130 / 가슴 −90 ms 를 빠른 곡선의 최고로), 베는 면(겨눈 방향)은 위 자료의 범위 안에서 정했다.
- 손목 한계 약 135°(두손 망치 쥐기 약 90° + 옆굽힘·굽힘) — 측정 자료 없음.
- 허점 어림(앞이 빈 시간)의 띠 크기(가슴 앞 0.45 m, 0.3 m)는 정의일 뿐 측정이 아니다.

## 6. 확보하지 못한 것 · 사장님께 여쭐 것

1. **독일 롱소드 다섯 비밀 베기 모캡(PJAIT HML)** — 지금 이 일에 가장 맞는 사람 측정이다. 얻으려면 연구소에 요청해야 하고(저자 협의), 연구용으로만 줄 가능성이 있다.
   게임에 동작을 그대로 쓰지 않고 **관절각·시간·칼끝 속도 같은 수치를 대조용으로만** 쓰는 조건으로 요청해도 될지.
2. **직접 촬영** — HEMA 수련자(동의) 또는 사장님을 폰 두 대(정면·옆, 120~240 fps)로 찍고, 이용 조건이 확인된 자세 추정 도구로 관절을 뽑는다. 사람·시간·장소가 든다.
3. **번역서 구입** — Forgeng 역 Meyer (약 3~4만 원). 본문으로 다섯 베기·걸음 문장을 확인한다.
4. 이 세션에서 웹 본문 읽기가 막혀 있다. 원문 대조(Wiktenauer 전사, 논문 PDF)는 웹이 열린 곳에서 다시 해야 한다.
