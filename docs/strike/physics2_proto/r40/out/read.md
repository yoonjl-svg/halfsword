# r40 차이만 읽기 — 확인표 18 갈래 (가) `wrist25.patch` · 11/28

결론: **막는 지적 1** (심판 도구가 값 없는 나무에서 옛 줄을 바꿈 · 고침 한 줄). 몸 쪽(fighter · config)은 막을 것 없음.
표시: [잰] 이번에 돌림 · [읽은] 코드 / 기록 · 판 4001 ~ 4010 만 · 9000 대 안 돌림.

## 0. 결과 먼저
| 볼 것 | 판정 | 근거 |
|---|---|---|
| ① 마지막 토크인가 | 맞음 | 자름은 `sword.addTorque` 바로 앞, 날 세우기 · 무게 버팀(tempoGravity 길 포함) 다 더한 뒤. 아래팔 · 가슴 반작용이 같은 `torque` 를 써 짝 맞음 [읽은]. 칼에 거는 다른 길: offHand `addForceAtPoint`(지렛대 · 일부러 안 자름) · combat 충격(판정) · 관절 구속뿐 [읽은 · grep] |
| ② 값 한 곳 · 25 | 맞음 | `ARM.wristLimit: 25` 하나 · fighter · honesty 둘 다 읽음 [읽은] |
| ③ 규칙 | 맞음 | 스위치 · 환경 변수 · 사람/AI/무기 이름 갈래 없음 (도구의 `weaponCfg.twoHand` 는 무기 성질 · 도구 안) [읽은] |
| ④ 심판 도구 | **막음** | 아래 B1 |
| ⑤ patch -p1 | 붙음 | 바탕 사본 `$S/r40/read_chk/base` 에 붙인 뒤 칸 src · tools 와 `diff -r` 같음 · data 도 같음 [잰] |
| ⑥ 다시 재기 | 같음 | 아래 §2 |

## 1. 막는 지적
**B1. config 에 `ARM.wristLimit` 이 없는 나무에서 새 honesty 의 칼 관절 옛 줄이 100 % 로 바뀜** [잰]
- `WRIST_JUDGE.limit = CFG?.ARM?.wristLimit ?? null` → 관절 표 칼 한도 null → `tot > null` 이 `tot > 0` 으로 읽혀 넘은 몫이 거의 다 참.
- 잰 것: 새 도구(칸 wrist25) `--root=` 바탕 r32_a · stroke · 츠바이 · 4001 → 칼 `73/25(73.0%)` 이 `73/null(100.0%)` · 전달 `69.8%` → `100.0%` · 새 가름 줄도 `한도 null 넘은 몫 100.0%`. 경고 한 줄만 붙음. 출력 `$S/r40/read_chk/{old,new}_on_base.{txt,json}`.
- 왜 막나: W5 '옛 줄 그대로' 는 짓는 쪽이 같은 몸(새 칸)에서만 견줌. 본판에 들어가면 저장소 honesty 를 다른 나무에 대는 도구(`legs_battery` · `getup_ledger` 는 '늘 이 저장소의 장부' + `--root`)와 선임의 바탕 ↔ 새 견줌에서 값 없는 옛 나무는 칼 줄이 다 깨짐 (한 손 칼 포함).
- 고침(제안 · 선임 판단): 값이 없을 때 null 로 견주지 않기. 예) `?? 25` 에 출처 '옛 못박은 25 (값 없는 나무)' + 지금 경고 줄 유지 — 한 나무 안에서는 수 하나. 또는 한도 null 이면 넘은 몫 칸을 null 로.

## 2. 다시 잰 수 (칸 wrist25 · 사람 길 베기 hcut · 4001 ~ 4010)
| 것 | 짓는 쪽 | 다시 | 같음 |
|---|---|---|---|
| hcut 줄 80 개(장검 40 · 츠바이 40)의 스텝 기록 | split_new.json | 스텝까지 80/80 같음 (`cmp_rows.mjs`) | 같음 [잰] |
| W1 츠바이 wr > 26 (4001 ~ 4010 만) | 사선 0.57 · 가로 0.34 % (20 판) | 사선 0.69 · 가로 0.27 · 세로 0 % · 장검 0/0/0 % | 금 1 % 안 [잰] |
| stroke 츠바이 4001 새 가름 줄 | 손목 몫 > 25 46.9 % · 최고 821.8 | txt 바이트까지 같음 | 같음 [잰] |
| W5 같은 몸 옛 ↔ 새 도구 (츠바이) | 새 줄 한 줄 · swordSplit 칸만 | 같음 (json 나머지 같음) | 같음 [잰] |
- W2 · W3 은 같은 줄의 tipPk · tTip 에서 나오므로 줄이 같으면 같음 [어림 · feel_sum 은 안 돌림].

## 3. 곁 지적 (안 막음)
| # | 것 |
|---|---|
| N1 | `debug.wristTorque` · `debug.wristCap` 은 자르기 앞 값 → wrist_split 의 `sat`(wt ÷ cap) 이 자름을 안 보임. 측정용이라 몸엔 무관 [읽은] |
| N2 | 새 가름의 wr = meas − 지렛대 = **몸 안 쌍 갈래 모두**(서보 + 그 밖 칼에 건 쌍) + 구속. wrist_split 은 서보 밖 갈래를 oth 로 뺌 → 칼에 서보 · 빈손 밖 쌍이 걸리면 정의가 갈림. 지금 src 엔 그런 길 없음 [읽은] · '같은 정의' 는 지금 몸에서만 참 |
| N3 | 새 가름은 놓기(placed) 스텝을 안 뺌 (wrist_split 은 뺌). stroke 4001 은 놓기 0 이라 영향 없음 [잰] |
| N4 | stroke 의 손목 몫 > 25 (장검 21 · 츠바이 47 % · 최고 821.8) 은 서보가 아닌 몫(관절 구속 어림) — 새 줄이 '손목 관절 몫 한도 넘음' 으로 읽혀 뒤에 판정 줄로 오해될 수 있음. 까닭 모름 |
| N5 | hcut 에서 wr > 25 는 아직 장검 2.7 ~ 29 · 츠바이 9 ~ 71 % (wr ≈ 서보 25 + 작은 잔차) — W1 문턱 26 이라 넘음. 25 로 읽으면 못 넘음 [잰] |
| N6 | AI 관문 줄 · 지문 · 단위 시험(새로 깨짐 1 · cavazione_tap:255)은 다시 안 잼 — 짓는 쪽 주장 그대로 |

## 4. 다시 돌리는 법
```
P=/home/user/halfsword/docs/strike/physics2_proto; O=$S/r40/read_chk
cd $S/r40/cells/wrist25 && nice -n 15 node $P/r37/wrist_split.mjs --root=. --scene=hcut --w=zweihander --seeds=4001-4010 --out=$O/hcut --tag=zw   # 장검도 --w=longsword --tag=ls
node $O/cmp_rows.mjs $S/r40/out/hcut/split_new.json $O/hcut/split_ls.json $O/hcut/split_zw.json
cd $O/hcut && node $P/r40/w1_sum.mjs 다시=split_ls.json 다시=split_zw.json
# B1: cd $S/p2/r6/mx/cells/r32_a && nice -n 15 node $S/r40/cells/wrist25/tools/sim/honesty.mjs --root=. --scene=stroke --weapon=zweihander --seed=4001
```
- name_policy: 위반 0 [잰]. 저장소 파일은 안 바꿈.

## 5. 다음 할 일
- B1 고친 뒤(고치기 1) 바탕 나무 + 새 도구에서 옛 줄이 옛 도구와 글자까지 같은지 셋 무기로 다시 봄.
