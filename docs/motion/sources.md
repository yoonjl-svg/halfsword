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

## 0-1. 웹 접속 (9/29 밤 다시 시험 — 거의 다 열림)

사장님이 환경 설정에서 사이트 제한을 푸신 뒤(9/29 밤) 다시 시험: **열림** — wiktenauer.com, sprechfenster.org, pubmed·pmc.ncbi.nlm.nih.gov, link.springer.com, en.wikipedia.org, www.gutenberg.org, isbs.org, ojs.ub.uni-konstanz.de, semanticscholar.org(웹), journals.plos.org.
**아직 거절** — idosi.org(403), researchgate.net(403), ieeexplore.ieee.org(418), api.semanticscholar.org(429 = 너무 잦은 요청). 이 셋은 사이트 쪽이 자동 접속을 막는 것이라 환경 설정 문제가 아니다 — 다른 사본(도서관·저자 사본)을 찾는다.
(9/29 낮까지는 위 대부분이 프록시에서 거절돼 검색 요약만 받았다. 표의 `snippet` 표시는 그때 것 — 원문을 읽으면 `full`/`abstract` 로 바꾼다.)

## 0-2. 무기·검술 연구 ASS 표본 점검 (9/29, 디렉터 요청 — 인용 5건, 검색 요약 수준)

| 인용 | 점검 결과 | 고친 것 |
|---|---|---|
| ARMA "롱소드 칼끝 약 33.5 m/s" | **오독** — 측정이 아니라 칼자루(탱) 힘 셈의 가정 예시 (원문 검색 요약으로 다시 확인) | [2차 예시값]으로 낮추고 칼끝 빠르기 근거에서 뺌(README·evaluation·longsword_cuts·targets 문장, Zornhau 클립 `sources`) |
| Chen 2017 "손이 발보다 0.07±0.05 s 먼저" | 값은 맞음. 1차 출처는 Gholipour 외 2008, Chen 은 인용 [2차] | Gholipour 행으로 옮김(`lunge_flow.md`, 런지 빌드 주석) |
| 검도 머리치기 0.818±0.085 s | 확인 | 세부(19명·250 Hz) 더함 |
| Escamilla 2009 윗몸 857 °/s·배트 30 m/s | 확인 | 학술지 더함 |
| Choi 거합 "무게중심 약 0.6 m/s 빠름" | 논문은 있으나 수치를 못 찾음 | ▶검증 필요 표시 |
| (덤) Klempous·Kluwak 롱소드 모캡 | 논문 둘 있음 확인. 39 마커·근전도 16·인원은 확인 못 함 | ▶검증 필요 표시 |

## 0-3. Meyer 1570 본문 대조 (9/29 — 네트워크가 열려 읽음)

`https://sprechfenster.org/meyer/1570/` — Rebecca L. R. Garber 영역과 1570 독일어 원문을 문단(폴리오)마다 나란히 싣는다. 유료 Forgeng 역 대신 이것으로 대조했다. 저장소에는 짧은 인용·폴리오 번호만 둔다.

| 우리 클립·문서의 주장 | Meyer 본문 | 결과 |
|---|---|---|
| Zornhau: 오른 어깨에서 상대 왼쪽 귀·얼굴·가슴으로 사선 | 4장 Ⅰ.11r.5 | 맞음 |
| Zornhau 끝 = 바꿈 | 3장 Ⅰ.9v.3–10r.1: 분노의 자세 → 긴 자세 → 바꿈 | **맞음** (전에는 [기억]) |
| Oberhau: 지붕 → 긴 자세 → 바보 | 3장 [17]: 시작 지붕, 가운데 긴 자세, 끝 바보 | 맞음 — Meyer 는 Oberhau 를 정수리 베기(Schedelhau)라고도 부른다 |
| Mittelhau = Zornhau 와 같되 가로 | 4장 Ⅰ.11v.1 | 맞음 |
| Unterhau: 아래에서 상대 왼팔로 올려 치고 코등이가 머리 위로 | 4장 Ⅰ.11v.2 (끝 = 칼자루 높이 머리 위) · 3장: 옆 지킴 → 긴 자세 → 외뿔(Einhorn) 또는 황소 | 맞음 (끝 왼쪽 황소) |
| 분노의 자세 = 왼발 앞, 칼을 오른 어깨에, 칼날이 등 뒤로 | 3장 [6] | 맞음 — 크게 벌 감기 끝 모양 |
| Schiel·Krump·Zwerch: 분노의 자세·왼발 앞에서 오른발을 상대 왼쪽으로 크게 딛으며 | 4장 [11]–[13] | 맞음. 다만 Zwerchhau 는 **분노의 자세**에서 시작한다 — 지금 작게 벌은 게임 옆 자세, 크게는 쟁기에서 감음 (v1 거리) |
| 베기마다 제 걸음, 같은 때 | 7장 [2] | 맞음 |
| 세이버 moulinet (칼을 머리 둘레로 돌려 다시 벰, 딛으며) | 뒤삭 3장: 긴 자세에서 칼끝을 왼쪽 아래로 떨구고 칼이 늘어진 채 칼자루를 머리 둘레로 올려 다시 벰, 베기마다 오른발 앞으로 | 모양은 맞음. **다른 점**: 뒤삭 베기는 긴 자세(팔 뻗음)에서 멈춘다 — 우리 세이버는 더 아래로 지나간다 (v1 거리) |
| (참고) 게임 쟁기 | Meyer 쟁기 = 오른발 앞, 칼자루를 앞무릎 옆에, 칼끝은 얼굴로 | 게임 자세표 값과 다르다(게임 몫) |

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
| **"Zornhau 끝 = 바꿈(Wechsel)"** | — | **원문 확인(9/29)**: 분노의 자세에서 시작, 반쯤에 긴 자세, 끝에 바꿈 — Meyer 장검 3장 fol. Ⅰ.9v.3–10r.1 "auff halben weg des hauwes ins Langort, und am endt in den Wechsel". 옆 지킴은 끝이 아니라 올려베기의 시작 |
| 19세기 브로드소드·세이버 교본의 moulinet (Allanson-Winn & Phillipps-Wolley 1890, 기병 세이버 교범, Burton 1876 — 본문은 막힘) | 원문 퍼블릭 도메인 | 검색 요약만: 손을 뒤집어 칼을 몸 오른쪽 뒤로 원을 그려 올리고 손은 오른 어깨 가까이, 팔꿈치는 몸 안쪽. 세이버 클립(`moulinet_manuals`) 근거 |
| Figueyredo, *Memorial of the Practice of the Montante* (1651) — 몬탄테 혼자 연습 규칙 32개 | 원문 퍼블릭 도메인, 번역은 조건 확인 전 — 서술만 요약 | 검색 요약만 읽음. 츠바이핸더 클립(`sources` 의 `figueyredo_montante`) 근거: 크게 돌리며 멈추지 않고 잇는다 |

## 3. 모션 캡처 논문·데이터 [측정]

| 자료 | 내용 | 이용 조건 | 지금 상태 |
|---|---|---|---|
| Klempous·Kluwak·Kulbacki·Rozenblit 외, 독일 롱소드 다섯 비밀 베기 모캡 (PJAIT Human Motion Lab, Bytom; IEEE CINTI 2021 pp.137–142, EUROCAST 2022 "Reference Datasets for Analysis of Traditional Japanese and German Martial Arts" LNCS 13789 — 논문 있음 확인, 연구 ASS 표본 점검 9/29) | Zornhau·Schielhau·Zwerchhau·Krumphau·Scheitelhau. 숙련자 1명 + 초보들, Vicon Plug-in Gait 39 마커 + 근전도 16, 영상 — **이 세부는 확인 못 함 ▶검증 필요** | **공개 안 됨.** "HML 에 요청하면 접근 가능"(초록). 재사용 조건 불명 | **가장 필요한 자료.** 얻으려면 연구소·저자 연락이 필요 → **사장님께 먼저 여쭘** |
| Grontman 외, "Analysis of sword fencing training evaluation possibilities using Motion Capture techniques", IEEE SoSE 2020 | 4명(전문 1), Zwerchhau·Schielhau 칼끝 마커 궤적 그림 | 논문 — 그림 값 인용 | 초록만. ResearchGate 에 PDF 가 있을 수 있음(열지 못함) |
| CMU Graphics Lab Motion Capture, subject 02 trial 07·08·09 "swordplay" (120 Hz) | 일반 칼놀림, 유파 검술 아님 | 연구·상업 제품 포함 사용 가능, **데이터 자체 재판매 금지**(변환본 포함), 출처 표기 요청 | 이전 CombatLab 에서 그대로 재생했다가 거절됨(뻣뻣함·뒤틀림). 여기서는 쓰지 않음 |
| Murase 외, 검도 8단 머리치기 모캡 (ISBS 2020) | 10명, 최대 노력 머리·손목 치기 | 논문 | 초록만 — 숫자 없음 |
| Choi·Mukaida·Sekiguchi·Hachimura, 거합 내려베기 (ISBS 2008 "Motion analysis of iaido skill by using motion data") | 32 마커 60 Hz. "숙련자는 벨 때 무게중심 속도가 초보보다 약 0.6 m/s 빠름" — **▶검증 필요**: 초록은 주성분·군집 분석이고 0.6 m/s 는 검색에서 못 찾음 (연구 ASS 표본 점검 9/29) | 논문 | 초록만 |

## 4. 스포츠 생체역학 (칼 자료가 없는 칸의 "다른 동작 참고") [측정 2차]

| 자료 | 쓴 숫자 | 읽은 깊이 |
|---|---|---|
| Cheetham 외 2008 (골프 프로 vs 아마추어 운동 사슬) | 순서 골반 → 가슴 → 팔 → 채, 팔→채 간격이 골반→팔 간격의 2배 넘음 | snippet |
| 골프 최고 각속도 (출처 불확실, ResearchGate 333377321 추정) | 골반 480±82 · 가슴 605±87 · 앞팔 1310±236 °/s | snippet |
| TPI / Cheetham 2001 X-factor | 어깨 90° · 골반 50° → 40°. 내려치기 시작 때 X-factor 를 더 벌림(stretch) | snippet |
| Welch 외 1995 (JOSPT 22(5), 야구 타격) | 골반 714 → 어깨 937 °/s | snippet |
| Escamilla 외 2009 (야구, J. Appl. Biomech. 25(3)) | 성인 윗몸 857 °/s, 배트 30 m/s (청소년 717 °/s·25 m/s) | snippet — 연구 ASS 표본 점검 9/29 확인 |
| SwordSTEM (Sean Franklin) "How fast do swords move" | 힘 뺀 오른쪽 내려베기, 베는 부분 최고 약 20 m/s, 닿기 몇 인치 앞에서 최고 | snippet |
| George Turner (ARMA) "Sword Motions and Impacts" | ~~롱소드 칼끝 약 75 mph ≈ 33.5 m/s~~ → **측정값이 아니다**: 칼자루(탱) 힘을 셈하는 가정 예시("75 mph 로 부딪히면 폼멜 빠르기가 15 mph 쯤 바뀌어야"). [2차 예시값] — 칼끝 빠르기 근거에서 뺐다 (연구 ASS 표본 점검 9/29, 원문 검색 요약으로 확인) | snippet |
| AAOS 관절 가동 범위 (1965; Greene & Heckman 1994) | 어깨 굽힘·벌림 180°, 팔꿈치 150°, 손목 굽힘 80°·폄 70°, 가슴허리 돌림 45°, 엉덩이 돌림 45° | snippet |
| Chen 외 2017 개관 **본문** (PLoS ONE — 9/29 열림) | 런지 최고 빠르기: 무게중심 1.92/1.72 m/s(플뢰레/에페), 칼 2.91/2.49, 앞발 4.56/4.10. 숙련자 칼 2.90±0.30 vs 초보 2.52±0.29 m/s. "숙련자는 앞발보다 칼 든 팔을 먼저 뻗는다"는 Hassan & Klauck 1998 (ISBS) 인용. 손-발 0.07 s 수치는 본문에 없음 | **본문 확인** |
| ISBS 엘리트 펜싱 런지 | 길이 1.24 m (0.88~1.86), 엉덩이 속도 1.97 m/s, 몸통 앞기울기 17.5° | snippet |
| Chen 외 2017 펜싱 생체역학 개관 (PLoS ONE) | 숙련자는 팔이 발보다 먼저. 손-발 시간차는 아래 Gholipour 외 2008 을 인용한 것 [2차] (연구 ASS 표본 점검 9/29) | 검색 요약 (본문 막힘) |
| Gholipour 외 2008 펜싱 런지 입체 촬영 (World J. Sport Sci.; 샤리프대 초보 8명·이란 국가대표, 고속 카메라 3대) | **손이 발보다 먼저 0.07±0.05 s (초보 0.13±0.15 s)** — `lunge_flow.md` 런지 순서의 1차 출처. 엉덩관절 굽힘 숙련 53° / 초보 40°, 앞무릎 굽힘 약 20° → 폄 51±9° | 검색 요약 |
| Mulloy 외 ISBS 펜싱 런지 운동 사슬 | 뒷다리 엉덩이→무릎→발목 순서, 뒷발목 폄 564±132 °/s | 검색 요약 |
| 검도 머리치기 시간 (Sports Biomechanics 2026) | 대학 선수 19명, 머리치기 0.818±0.085 s, 손목치기 0.745±0.101 s (동작 시작~닿기 직전, 250 Hz) | snippet — 연구 ASS 표본 점검 9/29 확인 |

- 무거운 도구의 운동 사슬 [검색 요약]: 회전 투포환의 마지막 동작은 앞 60% 동안 발목·무릎·엉덩이가 **함께** 펴는 밀기, 그 뒤 팔꿈치·손목 차례다(가벼운 던지기의 채찍과 다름) — [DOAJ 초록](https://oalib-perpustakaan.upi.edu/Record/doaj_8e99cb013b1a44bba94b75c1c94b59c0/Description). 단순 팔 모형은 가벼운·무거운 도구의 최적 기법이 다르다고 본다(Alexander 1991 J Theor Biol 계열 — [SFU 학위논문 인용](https://summit.sfu.ca/_flysystem/fedora/sfu_migrate/5750/b15249815.pdf)). 츠바이핸더 운동 사슬 제안(앞섬은 롱소드와 같게, 돌림 곡선만 길게)의 근거.

## 5. 추정 [추정]

- 몸 모형 치수는 게임 뼈대(`src/fighter.js`) 그대로. 사람 팔(어깨→칼자루 약 0.63~0.66 m)보다 짧다(0.565 m).
- 키프레임 자세·시간, 운동 사슬 간격(골반 −130 / 가슴 −90 ms 를 빠른 곡선의 최고로), 베는 면(겨눈 방향)은 위 자료의 범위 안에서 정했다.
- 손목 한계 약 135°(두손 망치 쥐기 약 90° + 옆굽힘·굽힘) — 측정 자료 없음.
- 허점 어림(앞이 빈 시간)의 띠 크기(가슴 앞 0.45 m, 0.3 m)는 정의일 뿐 측정이 아니다.
- 츠바이핸더 크게 벌의 배율(감기 1.3 · 풀기 1.27 · 지나가기 1.5 · 복귀 1.3 · 몸통 돌림 1.2)은 게임 무기 부품 값으로 셈한 관성(2.81배)과 재설계 T0 비(1.27)에서 낸 **제안**이다(`zweihander_table.md` §1). 칼 치수는 게임 스펙 `src/weapons.js`(`sources` 의 `game_weapons`).

## 6. 확보하지 못한 것 · 사장님께 여쭐 것

1. **독일 롱소드 다섯 비밀 베기 모캡(PJAIT HML)** — 지금 이 일에 가장 맞는 사람 측정이다. 얻으려면 연구소에 요청해야 하고(저자 협의), 연구용으로만 줄 가능성이 있다.
   게임에 동작을 그대로 쓰지 않고 **관절각·시간·칼끝 속도 같은 수치를 대조용으로만** 쓰는 조건으로 요청해도 될지.
   → **사장님 답(9/29): 하지 않는다** (저자 연락 없음).
2. ~~직접 촬영~~ — **사장님 답(9/29): 하지 않는다. 계획에서 뺐다.**
3. **번역서 구입** — Forgeng 역 Meyer. **사장님이 사 주시기로 함(9/29).** → 9/29 밤: 무료 Garber 영역 + 1570 독일어 원문(sprechfenster.org, §0-3)을 교차해 **대신하기로 함 — 유료 번역은 없어도 된다.** 사장님이 독일어 원본 파일도 주시기로 함. 받는 형태(제안): 전자책 PDF·EPUB 을 사장님 구글 드라이브 비공개 폴더에 두고 파일 이름·링크를 전달 → 드라이브 연결로 읽는다. **저작물이라 파일은 저장소에 절대 넣지 않고**, 읽고 정리한 메모(짧은 인용·쪽수)만 이 문서와 `longsword_cuts.md` 에 남긴다.
4. ~~웹 본문 읽기 막힘~~ — **사장님이 9/29 밤 여심.** 원문 대조를 다시 하는 중(§0-1·§0-3).
