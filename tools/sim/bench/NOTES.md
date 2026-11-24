# NOTES — 물리 2.0 타격 사슬 벤치 (이어받는 사람용 · 끊겨도 남게) — 2 회차 끝 상태

## 지금 상태: 끝남 (RESULT.md 있음). 저장소는 건드리지 않음 · 커밋 없음.

## 한 명령씩 (모두 결정적)
- `node t_main.mjs` (5 분) → out/main.txt · out/main.json  |  `node t_digest.mjs` (1 초 · main.json 필요) → out/digest.txt
- `node t_contact.mjs` (70 초) → out/contact.txt · out/contact.json
- `node t_miss.mjs` (75 초) → out/miss.txt  |  `node t_thrust.mjs` (10 초) → out/thrust.txt
- `node t_sens.mjs` (4 분) → out/sens.txt  |  `node t_ref.mjs` (2 초) → out/ref.txt
- `python3 make_result.py` → RESULT.md (글은 RESULT_body.md · 표는 out/*.txt 에서 그대로 끼움)
- out/old/ = 1 회차가 남긴 출력과 고치기 전 출력(견줌용). dev/ = 살펴보던 임시 스크립트(c0 접촉 한 칸 · m0 ~ m3 멈춤 구간 따라가기).

## 넘겨받은 것 (1 회차) — 읽고 돌려 봄
- lib.mjs(윗몸 사슬 · 근육: 등척 한도 · Hill · 활성 35 ms) · cuts.mjs((i) 끝점 힘 · (ii) 차례 활성) · game.mjs((iii) 게임 꼴) · thrust.mjs · t_main/t_ref/t_sens/t_thrust · tune.mjs/t_tune_i.mjs/gains_i.json
- 쓸 만했다. 수동 낙하 에너지 잔차 −0.05 J(관절 끝에 닿기 전) · t_ref 는 저장된 값과 바이트까지 같게 다시 나옴.

## 2 회차에 고친 것
1. thrust.mjs 87 줄: 한 줄 안의 `//` 주석이 닫는 괄호까지 먹어 모듈이 안 읽혔다(1 회차가 고치다 끊긴 자리) → `/* */` 로.
2. cuts.mjs 멈춤 구간의 땅 제동: 이득 675 N·m/(rad/s) 는 d·dt/I ≈ 9 라 골반이 느려진 뒤 ± 상한으로 떨었다 → 골반 yaw 관성에 맞춘 이득(d·dt/I = 0.5). `brakeGroundOld: true` 로 예전 꼴.
3. cuts.mjs / game.mjs: 접촉 고리 `hook {init, pre, post}` · `noBrake` · `relax('trunk'|'limp')` · `brakeI` · summarize 가 `iPk` 를 내보냄 · row.qCh. 고리를 안 주면 예전과 같다.
4. lib.mjs: Model.step 이 `M.evq`(있으면)로 world.step. Muscles 에 `hillAvg` · `hillImp` 선택(둘 다 기본 끔 — 아래 '몸통 떨림').

## 2 회차에 새로 지은 것
- contact.mjs + t_contact.mjs (접촉) · t_miss.mjs (빗나간 뒤) · t_thrust.mjs 의 표 T4 · t_digest.mjs · make_result.py · RESULT_body.md

## 알아낸 것 (한 줄씩 · 자세한 것은 RESULT.md)
- 칼날 70 % 유효 질량(8 ms) = 칼 자유 값 × 1.02 ~ 1.11. 방식 · 손 수 · 손목 한도 · 몸통 밂과 무관. 판정식의 0.26 ~ 0.31 배.
- 사슬 방식에서 손목 근육 일 ≈ 0. 큰 감기는 땅이 54 %. 운동학 몫으로는 손목이 여전히 46 ~ 59 %.
- (ii) 큰 감기 24 ~ 27 m/s — 사람 잰 값(칼끝 9 ~ 14 · 사브르 17.5 ~ 19.5)보다 빠르다. 벤치는 위쪽 끝.
- 힘–빠르기를 끄면 × 1.57. 칸마다 찾은 때는 14 % 만 준다. 손목 한도는 빠르기에 무관.
- 찌르기 덧댐 3.5 kg 은 두 손이면 맞고 한 손은 약 2 kg. × 2.0 은 근거 없음.

## 못 푼 것 (다음 사람이 먼저 볼 것)
1. **몸통 떨림**: 허리 · 등 휨 축에서 가슴 · 배가 스텝마다 반대로 ± 1 ~ 3 rad/s. `hill: false` 면 사라짐(dev/m1.mjs --nohill). 명시 Hill 이 몸통(vmax 3.6 · 활성 100 ~ 250 N·m)에서 d·dt/I > 2.
   해 본 것: 두 스텝 평균(hillAvg) → 주기 4 스텝 떨림으로 더 커짐 · 한 번 편 암시(hillImp) → 조금 줄지만 남음. 해 볼 것: Hill 을 관절 축마다 나눠 암시로 · 또는 몸통 vmax 를 올리고 토크를 낮추는 같은 곡선의 다른 표현 · 또는 몸통 휨 축만 Hill 에서 뺌(자세 버팀이라 빠르게 안 돎).
   닿는 곳: 받침 힘 · 모멘트(표 G) · 몸통 멈춤 시간(표 M). 칼 빠르기 · 접촉에는 거의 안 닿음(wnPost 를 바꿔도 ± 1 m/s).
2. 멈춤 법칙에 자세 잡는 항이 없다 → 몸통 멈춤 0.5 ~ 0.9 s 는 위쪽 값. 되돌아오는 시간은 안 쟀다.
3. 레이피어 큰 세로 베기에서 에너지 + 30 ~ 36 J 가 생긴다(잔차 양수). 원인 안 봄(한 손 · 손 머리 위 자세 · 밧줄 한도 의심).
4. (i) 이득은 48 벌에서 고른 한 벌. 작은 빗겨 베기 벗어남 0.49 m.
5. (iii) 은 큰 감기에서 겨눈 선을 못 넘는다(게임에서도 그런지 모름).
6. 접촉은 엔진이 한 스텝에 끝냄 → 힘 최고 · 닿은 시간은 해상도 밖. 손목 굳히기(함께 수축)는 모형에 없음.

## 작업 중 놓인 파일
- `LEAD_CORRECTION.md` (16:54 에 이 디렉터리에 생김 — 내가 만든 것 아님). 내용: '게임 칼이 사람보다 느리지 않다'는 과제 문장은 지나쳤으니 거둔다 · 칼끝 빠르기와 칼 각속도를 사람 값 옆에 놓고 정하지 말 것 · 마디별 몫은 참고 값 · 견줌의 머리는 차례와 관절별 일.
  사람 표(C15)와 맞는 말이라 따랐다: t_digest 표 H 에 칼 각속도 열을 넣고 RESULT §0 · §3 · §7 의 글을 고쳤다.
