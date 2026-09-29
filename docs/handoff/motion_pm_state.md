# 인체 동작 연구 PM — 상태 (늘 최신으로 둔다)

- 갱신: 2026-09-29 낮 (KST). 새 세션은 이 파일만 읽고 이어받는다.
- 세션: `session_013YFFvQRnDedG7CTF1eVknA` · 브랜치 `claude/pm-motion-research`. **`docs/motion`·`tools/motion` 만 건드리면 디렉터가 검토 없이 main 에 병합한다.** 새 일을 시작하기 전에 main 을 한 번 병합해 둔다.
- 디렉터: `session_014nJCzE4hyxiYc9innhSUng` ("Stillness game director handoff", 사장님 확정). `01NDJ…`(보관됨)·`01Kc…`(은퇴)에는 보내지 않는다.
- 역할: main `docs/pm_roles_charter.md` 부록 A (9/29부터 기본값 시행).

## 일하는 규칙 (디렉터 9/29)

- 보고: 하루 한 번 **18:00 KST**, 10줄 안, "끝남 / 진행 중 / 안 함" + 커밋 해시. 막혔을 때만 그 전에. 확인용 답장은 보내지 않는다.
  보내는 법: `create_trigger`(persistent_session_id = 디렉터, 일정 없음) → `fire_trigger`. 늘 새 트리거.
- 일이 끝나고 다음 지시가 없으면 "대기" 한 줄만 보내고 멈춘다. 폴링·자체 알림 반복 금지. 이미 검증한 것은 다시 검증하지 않는다.
- `src/` 는 건드리지 않는다. 코드·문서·커밋에 AI 모델 이름을 쓰지 않는다. 문서·보고는 한국어 쉬운 말.
- 사람 값은 참고이지 한도가 아니다. 제한·상한·조건은 제안만 하고 넣지 않는다(사장님 몫). 난이도 테스트 금지.
- 비용·저자 연락은 사장님 허락 뒤에만.

## 지금까지 만든 것

| 무엇 | 어디 |
|---|---|
| 롱소드 기준 클립 `stillness-motion-clip/2` 48개 (8 베기 × 좌우 × 작게·보통·크게) + 8자 흐름 2 + 런지 찌르기 2, 크기별 파일 + `index.json` (디렉터: 한 파일에 합치지 말 것) | `docs/motion/clips` |
| 츠바이핸더 크게 벌 v0 8개 (Zornhau·Oberhau·Mittelhau·Unterhau × 좌우) + 따로 `index.json`. 배율은 제안(`build_zweihander.mjs` PROPOSAL, `zweihander_table.md`) | `docs/motion/clips/zweihander` |
| 세이버 moulinet 크게 벌 v0 8개 + 레이피어 런지 2개 (한손: 빈손 채널, 게임 한손 자세표). `build_onehand.mjs` PROPOSAL, `onehand_table.md` | `docs/motion/clips/sabre`, `docs/motion/clips/rapier` |
| 클립 검사기 `validate_clip.mjs` (규칙 = `clip_format.md` §6, 코드 = `lib/clip_rules.mjs` 브라우저에서도 돎). 빌드 도구 넷이 끝에서 스스로 돌린다. 70벌 모두 통과 | `tools/motion` |
| 게임 기록 `stillness-motion-record/1`: 지금 게임 팔 베기 5 (hybrid 걸음, 2 s 서 있기), 시험판 팔·결심 베기 8 (claude/wbs-impl d781ab9) | `docs/motion/records` |
| 문서: README(처음 볼 곳) · longsword_cuts · spec_table(자동, §7 복귀·시작·끝 자세) · evaluation · targets(초안) · clip_format(clip/2, 재설계 atlas 채널 대조 §3-6) · compare_game(자동) · review_wbs_trial · lunge_flow · flow_table/lunge_table(자동) · weapon_body · sources | `docs/motion` |
| 비교 화면 (막대 인형 + 게임 기록 겹치기 + 다섯 기준) | `tools/motion/viewer.html` (vite), 공개 페이지 https://claude.ai/artifact/9WQuMAwtePPqLZjM5o49cC — 게시본은 viewer.html 의 `BEGIN-ARTIFACT`…`END-BODY` 사이를 떼어 `MOTION_DATA_BASE = './'` 로 바꾸고 clips·records 를 옆에 둔 것 |

## 열린 요청

- 디렉터 9/29 과제: (a) 채널 대조·빠진 채널 채우기 — **끝남** (a489576, clip/2). (b) 복귀 구간 표본·끝 자세와 가장 가까운 게임 자세 — **끝남** (a489576, spec_table §7: 52벌 모두 시작·끝 자세 = 목표 자세, 손 오차 0 cm). (c) 보통 벌 사이 자세·감기 직후 손목 넘침 — **R2 시험판 뒤에**.
- 디렉터 9/29 11:48 과제: ① 검사기 — **끝남** ② 츠바이핸더 large v0 — **끝남** ③ 세이버 moulinet 4무리 · 레이피어 런지 large v0 — **끝남(9/29 앞당김)**. 한손 자세표는 guards.js ONE_HAND 글을 읽어 검사(게임이 BASE_ONE 을 내보내면 그걸로 — 디렉터에게 제안). 연구 ASS 문헌 결과 오면 붙임 ④ 그다음 score.mjs (compare.mjs 에서 채점 함수를 떼어 버전 붙임: 기준 대비 손 오차·위상 오차·최고 순서·칼 방향·동작 범위, 디렉터 chain.mjs 가 부름).
- R2 시험판이 나오면 소견 (디렉터 chain.mjs 는 record/1 형식으로 기록을 낸다).
- 사장님 질문 3개(모캡 자료 요청·직접 촬영·Meyer 번역서)와 논문 사이트 네트워크 차단 — 디렉터가 사장님께 올림. 답 전에는 연락·비용 없음.

## 다시 만들기

```bash
node tools/motion/build_clips.mjs     # 클립 48 + index.json + spec_table.md (다른 도구가 끼운 흐름·런지 항목은 지킨다)
node tools/motion/build_flow.mjs      # 8자 흐름 2 + flow_table.md (build_clips 뒤)
node tools/motion/build_lunge.mjs     # 런지 찌르기 2 + lunge_table.md (build_clips 뒤)
node tools/motion/record_game.mjs     # 지금 게임 기록 (hybrid, 2 s 서 있기)
WBS_REV=d781ab9 node tools/motion/record_wbs.mjs --root=<claude/wbs-impl 체크아웃>
node tools/motion/compare.mjs         # compare_game.md
node tools/motion/qa_clips.mjs        # 겹침 검사 (칼 ↔ 몸, 아래팔 ↔ 몸통)
node tools/motion/build_zweihander.mjs # 츠바이핸더 크게 벌 8 + zweihander_table.md (build_clips 뒤)
node tools/motion/build_onehand.mjs   # 세이버 8 + 레이피어 런지 2 + onehand_table.md (build_lunge 뒤)
node tools/motion/validate_clip.mjs   # 클립 검사 (clip_format.md §6). 빌드 셋이 끝에서 스스로 돌린다 — 어긋나면 종료 코드 1
npx vite                              # → /tools/motion/viewer.html
```

## 알려진 흠 (다음 할 일 후보)

- 크게 감기 초반 등 8벌에서 아래팔이 몸통에 0.01~0.22 s 동안 25~40% 들어간다(쥔 손이 가슴 앞에 가까워 팔꿈치로는 못 비킴) — 키를 고칠 거리. 칼이 몸을 지나가는 클립은 없다.
- 보통 벌 감기에서 손목(아래팔-칼) 각이 160° 를 넘는 베기가 있다(Zwerch 175° 등) — 디렉터: R2 뒤에.
- 논문 본문을 못 읽어(네트워크 정책) 런지·세이버·테니스 수치는 검색 요약이다.
- 츠바이핸더: 빈 팔 아래팔이 몸통에 들어가는 순간 — Mittelhau 오른쪽 감기 초반 0.28 s 동안 53% (롱소드 같은 곳 41%), Unterhau 왼쪽 35%. 롱소드 키 모양을 늘인 것이라 몬탄테다운 흐름·리카소 쥐기는 없다.
- 왼쪽 벌은 오른손잡이 몸의 거울이라 온전한 거울이 아니다(clip_format §2) — 가운데 자세는 게임 값, 거울 손이 팔 길이를 넘으면 당김.
- 세이버: 칼끝 최고 때 손목 몫 63~79%(같은 측정으로 롱소드 43~66%) — 팔꿈치·어깨 원을 키우는 재저작 거리. 레이피어는 게임 자세(왼발 앞) 때문에 앞발 런지 — 오른발 패서타는 다음. 세이버 Oberhau 칼이 감기 때 머리 뒤 0.05 m 를 지남.
