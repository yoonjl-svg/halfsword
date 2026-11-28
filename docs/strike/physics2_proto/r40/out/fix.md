# r40 고치기 — 막는 지적 B1 (심판 도구가 값 없는 나무에서 칼 옛 줄을 바꿈) · 11/28

`$S` = 임시 폴더. 칸 `$S/r40/cells/wrist25` 의 `tools/sim/honesty.mjs` 만 고침(src 안 건드림). 바탕 `$S/p2/r6/mx/cells/r32_a`(안 고침). 판 4001 ~ 4020 · stroke 4001 만 · 9000 대 안 돌림.
표시: [잰] 이번 시뮬 · [읽은] 코드 / 기록.

## 0. 결과 먼저
| 줄 | 금 | 잰 값 | 판정 |
|---|---|---|---|
| B1 바탕 몸 + 고친 도구 ↔ 바탕 몸 + 옛 도구 (stroke · 4001 · 무기 셋) | 옛 줄 글자까지 같음 | 레이피어 · 장검 · 츠바이 txt 옛 줄 모두 같음 · 더해진 줄만: 경고 1(셋 다) + 가름 1(두 손 칼 둘) · json 다른 잎 = swordSplit 1 (장검 · 츠바이) · 0 (레이피어) · 츠바이 칼 `73/25(73.0%)` 그대로 (고치기 전 `73/null(100.0%)`) [잰] | 고쳐짐 |
| W1 손목 몫 > 26 (hcut 4001 ~ 4020) | ≤ 1 % | 장검 0 · 0 · 0 % · 츠바이 사선 0.57 · 가로 0.34 · 세로 0 % [잰] | 넘음 (짓기 때와 바이트까지 같음) |
| W2 칼끝 가장 빠름 ÷ 바탕 | ≥ 0.95 | 장검 0.99 · 0.99 · 1.00 · 츠바이 0.96 · 1.04 · 1.00 · 레이피어 1.00 · 1.00 · 1.00 [잰] | 넘음 |
| W3 가장 빠름까지 늦어짐 | 장검 ≤ 10 · 츠바이 ≤ 45 · 레이피어 ≤ 10 ms | 장검 +4 · +8 · +9 · 츠바이 +29 · +17 · +12 · 레이피어 0 · 0 · 0 [잰] | 넘음 (장검 세로 +9 · 금에 1 ms) |
| W5 같은 몸(새 칸) 옛 도구 ↔ 고친 도구 | 한 손 글자까지 · 옛 줄 같음 | 레이피어 txt · json 같음 · 장검 · 츠바이 txt 새 줄 1 · json 다른 잎 swordSplit 1 만 [잰] | 넘음 |
| 고친 도구 ↔ 고치기 전 도구 (새 몸) | — | txt · json 셋 다 바이트까지 같음 [잰] (값이 있는 나무에선 바뀐 것 없음) | — |
- hcut 다시 잼: 새 칸 · 바탕 칸 둘 다 `split_*.json` rows 240 줄이 짓기 때(`$S/r40/out/hcut`)와 같음 · w1 · feel 표 바이트까지 같음 [잰].
- 패치 `docs/strike/physics2_proto/r40/wrist25.patch` 새로 적음 · 바탕 사본(`$S/r40/fix/pchk`)에 `patch -p1` 로 붙고 칸 src · tools 와 `diff -r` 같음 [잰]. name_policy 위반 0 [잰].

## 1. 바꾼 것 (honesty.mjs 두 곳 · 패치에서 바뀐 건 이것뿐)
| 자리 | 전 | 후 |
|---|---|---|
| `WRIST_JUDGE` | `limit: CFG?.ARM?.wristLimit ?? null` | config 값이 있으면 그 값 (`fromConfig: true`) · 없으면 `limit: 25` · `from: '옛 못박은 25 (config ARM.wristLimit 없음)'` · `fromConfig: false` |
| 경고 줄 | `joints.sword.limit == null` 일 때 | `!WRIST_JUDGE.fromConfig` 일 때 `경고: … 못 읽음 — 옛 못박은 25 … 로 견줌` |
- 고른 쪽: 읽는 쪽 제안 둘 가운데 `?? 25` + 출처 + 경고 유지 (읽는 쪽 메모가 '예)' 로 먼저 든 쪽). 25 는 새 값 아님 = 옛 honesty 의 칼 관절 한도 [읽은]. 한 나무 안에선 수 하나 그대로(값 있으면 config 만 읽음).
- 안 고른 쪽(한도 null 이면 넘은 몫 null): 옛 줄 글자가 바뀌므로 안 씀. 선임이 다르게 고르면 두 줄만 바꾸면 됨.
- 몸(src · config · fighter) 안 건드림 → W4 · W7 은 다시 안 잼 (몸 같음 · 짓기 표 그대로) [어림].

## 2. 남은 것 · 못 가린 것 (안 고침 · 막는 지적 아님)
- 읽는 쪽 곁 지적 N1 ~ N6 그대로 (N4: stroke 손목 몫 > 25 가 서보 밖 몫 · 까닭 모름 — 바탕 몸에서도 장검 21.2 · 츠바이 54.0 % [잰]).
- 값 없는 나무에선 경고 줄이 한 손 칼에도 한 줄 더해짐 (옛 줄은 같음) — '새 줄만 더해짐' 안.
- 새로 깨지는 단위 시험 1 (cavazione_tap:255) 까닭 안 봄 (짓기 때 그대로).

## 3. 해 보고 안 된 것
- 없음. (hcut 첫 다시 재기 뒤 `tail -1 a b` 꼴 오류는 출력만의 문제 · 결과 파일 멀쩡.)

## 4. 다시 돌리는 법
```
P=/home/user/halfsword/docs/strike/physics2_proto; F=$S/r40/fix
# B1 · W5 (6 판 · 둘씩)
$F/w5/run.sh
for w in rapier longsword zweihander; do diff $S/r40/out/w5/oldtool_basebody_$w.txt $F/w5/fixtool_basebody_$w.txt
  node $P/r40/jcmp.mjs $S/r40/out/w5/oldtool_basebody_$w.json $F/w5/fixtool_basebody_$w.json
  node $P/r40/jcmp.mjs $S/r40/out/w5/oldtool_newbody_$w.json $F/w5/fixtool_newbody_$w.json; done
# W1 ~ W3 (두 칸 · 약 50 분)
cd <칸> && nice -n 15 node $P/r37/wrist_split.mjs --root=. --scene=hcut --seeds=4001-4020 --out=$F/hcut --tag=<new|base>
cd $F/hcut && node $P/r40/w1_sum.mjs 바탕=split_base.json 새=split_new.json; node $P/r37/feel_sum.mjs 바탕=split_base.json 새=split_new.json
```
- 결과 자리: `$S/r40/fix/{w5/, hcut/w1.out, hcut/feel.out, wrist25.patch, pchk/}` · 새 대본 `docs/strike/physics2_proto/r40/jcmp.mjs` (json 다른 잎 세기 · 재기만).

## 5. 다음 할 일
- 선임: 판 9401 ~ 9420 으로 W1 ~ W3 · W5 다시 재기 · W4 48 판. 넘으면 본판 요청(패치 · 짓기 표 · 이 메모).
