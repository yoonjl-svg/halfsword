# r39 짓기 — 확인표 28: AI 가 찌르기 탭 앞에서만 손가락을 뗌 (판 4001 ~ 4040 · 칸 `$S/r39/cells/ai_line`)

## 결과 먼저 (일꾼의 판 · 선임의 판 9201 ~ 9240 은 안 씀)
| 줄 | 바탕 r32_a | 새 칸 | 금 | 판정 (4001 ~ 4040) |
|---|---|---|---|---|
| D1 AI 레이피어 탭 빠른 줄 (> 8 m/s · 관문 rows) | 174 / 390 (44.6 %) | **35 / 350 (10.0 %)** | 바탕의 ¼ = 11.2 % 아래 | 넘음 [잰] (빠듯함 — 금과 1.2 %p 차) |
| D2 사람 길 줄 (rapier far · near · longsword far · near · cut) | — | 120 · 40 · 120 · 40 · 160 / 같음 480 / 480 | 글자까지 같음 | 넘음 [잰] |
| D4 지문 넷 (near_rapier · near_longsword · cut_desc · parry) | — | 모두 차 0 (`모두 0: true`) | 바뀜 0 | 넘음 [잰] |
| D4 단위 시험 | 깨짐 38 | 깨짐 38 · 새로 깨짐 0 · 새로 통과 0 | 새로 깨짐 0 | 넘음 [잰] |
| D5 장검 AI 줄 (cut · near · mid · far · farClose) | 249 · 173 · 78 · 8 · 3 | 같은 줄 101 · 70 · 36 · 8 · 3 | 글자까지 같음 | **못 넘음** [잰] — 아래 |
| D3 넘어짐 (선임이 잼 · 일꾼은 12 판만 봄) | 씨앗 1 ~ 12 의 줄 15 (스스로 2) [읽은 · fall_0 24 판 목록에서] | 11 (스스로 1) | 소음 안 | 크게 무너지지 않음 [잰] |
| D6 규칙 | — | 스위치 없음 · 사람과 같은 입력 뜻(손가락 뗌) · 이름 갈래 없음 · 몸 코드 안 바꿈 · 새 값 하나(0.4 s · [확인 전]) | — | 스스로 봄 (선임 판정) |

- **D5 갈림의 자리 [잰]**: 다른 장검 씨앗은 4011 · 4020 · 4027 · 4034 · 4040 (5 / 40). 4011 을 스텝마다 견줌: 처음 갈리는 스텝 1941 (16.175 s) = 장검 AI(P)가 **급소 찌르기 탭**(기술 stichOchsL · vital 'thrust' → startStrike 가 skill.thrust 를 부름)을 내기로 한 그 스텝. 바탕에선 그 스텝에 탭이 나가고 새 칸에선 기다림이 시작됨. 장검의 기다림은 판 40 개에 모두 5 번 → 다른 씨앗 수 5 와 같다(나머지 넷의 첫 스텝은 안 봄 [어림]).
  → 장검의 탭 아닌 칼(베기 · stich 기술 길)은 그 탭 앞까지 한 스텝도 다르지 않다. 판 안에 탭이 한 번 끼면 그 뒤 싸움이 갈린다. **'탭을 안 쓰는 줄이 글자까지 같음'은 장검 AI 도 급소 찌르기는 탭으로 내므로 이 꼴로는 못 지킨다** — 줄의 뜻(탭을 안 쓰는 판)을 '탭이 낀 판 빼고'로 바꾸면 넘지만 바꾸지 않았다. 선임 몫.
- 관문 끝줄 `GATE wholebody: FAIL (3 of 16)` · PASS / FAIL 이 적힌 줄의 갈래가 바탕과 같다(바탕도 같은 FAIL) [잰].

## D7 읽는 값 (trace — 관문 rows 를 그대로 다시 냄: 레이피어 350 획 · 빠른 35 · 맞음 171) [잰]
| 값 | 바탕 | 새 칸 |
|---|---|---|
| AI 레이피어 탭 수 | 390 | 350 |
| 맞음 몫 모두 · 가까운 장면 | 56.4 % · 63.1 % (101 / 160) | **48.9 % · 58.2 % (124 / 213)** |
| 장면별 획 near · mid · far · farClose | 160 · 80 · 57 · 93 | 213 · 73 · 45 · 19 (기다리는 동안 다가가서 가까운 장면이 늚) |
| 탭 → 맞음 가운데 (탭 부름 → 맞음) | 0.296 s | 0.400 s (기다림 미포함 · 기다림까지면 그 위에 아래 길이) |
| 상처 stab / cut / blunt | 94 / 2 / 124 | 77 / 0 / 94 (stab 몫 43 → 45 %) |
| 빠른 줄에서 난 맞음 | 104 | 17 |
| 탭 앞 쉼 무게 가운데 | 0.00 | 0.66 |
| 손가락 뗀 기다림 수 (레이피어 · 장검) | — | 349 · 5 |
| 기다림 끝 line / cap(0.4 s) / abort / lost | — | 206 / 136 / 0 / 7 (레이피어) · 5 / 0 / 0 / 0 (장검) |
| 기다림 길이 가운데 · 90 % | — | 0.287 s · 0.400 s (레이피어) · 장검 0.200 · 0.267 |
| 기다리는 동안 AI 가 맞은 상처 | — | 5 (기다림 4 개에서) |
| 장검 AI 찌르기 (빠른 · 맞음) | 39 / 262 · 129 | 38 / 260 · 128 |
- lost 7 = 기다리는 중 공격 꼴이 abortAttack 아닌 길로 바뀐 것(그 순간부터 aiFingerHeld 는 꼴대로 돌아감 · 남은 tapLine 은 다음 startAttack 이 지움) [읽은 코드 · 갈래는 안 가림].
- 상한에 걸린 몫 39 % — 쉼 무게 따라가기가 느림(휘두르지 않을 때 26 × 0.3 = 7.8 rad/s 임계 감쇠 → 0.5 까지 약 0.22 s [어림 · fighter.js 1436 식]).

## 지은 것과 자리 (패치 `docs/strike/physics2_proto/r39/ai_line.patch` · 바탕 사본에 `patch -p1` 로 붙음 확인 · 파일 셋)
| 파일 | 바꾼 것 |
|---|---|
| src/skill.js `aiFingerHeld` | `a.tapLine && mode 'attack' && phase 'approach'` 이면 false(손가락 뗌). 나머지 그대로 — 이 함수는 fighter.js `armHeld`(앞 바닥 frontW · armClrT)도 읽으므로 기다리는 동안 그 둘도 사람이 손을 뗀 것과 같게 됨(몸 코드는 안 바꿈 · 입력 뜻이 같은 길로 감) |
| src/ai.js `tapLineHold(dt)` (새 · startStrike 바로 위) | 처음 부름: 탭 길일 때만 tapLine 을 켬 — `t.kind 'thrust'` · 속임 · 비기 · 연습 · 마무리(why 'finish') · inquartata 운동학 칼 · artKey 가 아님 · `thrustStyle` 이거나 vital 'thrust'(= startStrike 가 skill.thrust 를 부르는 조건) · 보정 v2 · 탭 · 찍기 중 아님 · 기력 있음. 다음부터: 쉼 무게 ≥ 0.5(fighter.js pronateRest 의 가운데 — 새 수 아님) 이고 명령 칼 방향(aimDirW) ↔ 찌르기 선(칼 → 탭이 겨눌 점: 급소 점 · 머리(aimRaw.y > headPad · 이탈리아 아님) · 가슴) 각이 앞 스텝보다 안 줄면 놓음 · 상한 AI_TAP_LINE.wait |
| src/ai.js 다가감 | ① 다가감 맨 앞: tapLine 이면 기다리거나 놓고 startStrike(막기로 안 돌아섬 · 발 · 손 패드는 다가감 그대로) ② 닿는 거리 때 startStrike 앞 ③ approachStep 의 startStrike 앞 ④ startAttack 이 tapLine = null |
| src/config.js | `AI_TAP_LINE = { wait: 0.4 }` [확인 전 · 시간 사다리 · §6 의 상한과 같은 값] |
- 안 건드림: updateThrust · skill.thrust · 사람 길 · fighter.js · 막기 · 묶임 · 베기 · 기술 길 · flowInto(흐름은 곧장 startStrike — 안 기다림).
- 손가락은 **탭을 부르는 순간까지만** 뗌(과제 글자대로). 탭 동안은 다시 '댐'이라 쉼 무게가 당김 0.11 s 동안 도로 내려간다 — 그래도 D1 은 넘음. 탭 끝까지 떼는 꼴은 재지 않음.

## 해 보고 안 된 것
- 없음(꼴 하나만 지어 쟀음 · 값 훑기 없음).

## 못 가린 것
- D1 10.0 % 는 금 11.2 % 에 빠듯 — 선임의 판에서 뒤집힐 수 있다.
- 장검 D5 다른 씨앗 넷(4020 · 4027 · 4034 · 4040)의 첫 갈림은 안 봄(기다림 수 5 와 같아 같은 까닭으로 어림).
- 탭 → 맞음이 탭 부름부터 재도 0.296 → 0.400 s 로 는 까닭(장면이 가까운 쪽으로 옮겨진 탓인지 · 뻗음이 달라진 탓인지) 안 가림.
- lost 7 의 갈래 · 기다리는 동안 맞은 5 상처의 갈래 안 봄. AI 장검 손목 한도(확인표 18)와의 겹침은 안 봄.
- 넘어짐은 12 판 한 번(바탕은 24 판 목록의 앞 12 판을 읽어 견줌 · 같은 대본 같은 판이지만 바탕 12 판 따로 돌림은 안 함).

## 다시 돌리는 법 (칸 안에서 · 한 번에 둘 · nice 15)
```
C=$S/r39/cells/ai_line; B=$S/p2/r6/mx/cells/r32_a; P=/home/user/halfsword/docs/strike/physics2_proto
cd $C && nice -n 15 node tools/sim/wb_gate.mjs --root=. --seeds=4001-4040 --cache=$S/r39/out/gc --json=$S/r39/out/gate.json
node $P/r35/proto_gate_cmp.mjs --a=$S/r32b/a/gate_4001-4040.json --b=$S/r39/out/gate.json        # D1 · D2 · D5
cd $C && nice -n 15 node $P/r39/ai_line_trace.mjs --root=. --out=$S/r39/out --seeds=4001-4040 --hon=0 --tag=new   # 바탕 칸에서 --tag=base
node $P/r39/ai_line_sum.mjs --trace=$S/r39/out/trace_new.json --waits=$S/r39/out/waits_new.json     # D7
cd $C && nice -n 15 node $P/r23/fp_compare.mjs --root=. --json=$S/r39/out/fp.json && node $P/r23/fp_compare.mjs --a=$S/r32b/a/fp.json --b=$S/r39/out/fp.json
cd $C && nice -n 15 node --test --test-concurrency=1 --test-reporter=tap tools/sim/*.test.mjs > $S/r39/out/tests.tap
grep '^not ok' $S/r39/out/tests.tap | sed 's/^not ok [0-9]* - //' | sort | comm -13 <(sort $S/r35/judge/tests_fail_base.txt) -
cd $C && nice -n 15 node tools/sim/fall_context.mjs --fights=12 --offset=0 --rows --all
```
- 장검 첫 갈림: `$S/r39/w/div.mjs --root=. --seed=4011 --w=longsword --out=…` 를 두 칸에서 돌려 스텝마다 칼 자리 견줌(임시 대본).

## 결과 자리 (`$S/r39/out/`)
gate.json · gate.txt · gate_cmp.txt · trace_{new,base}.json · waits_{new,base}.json · sum_{new,base}.txt · fp.json · fp_cmp.txt · tests.tap · tests_fail_new.txt · fall12.{txt,json} · `$S/r39/w/div_{base,new}_4011.json`
