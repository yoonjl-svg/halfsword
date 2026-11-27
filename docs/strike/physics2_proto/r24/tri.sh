#!/bin/bash
# r24 A4: 새로 실패한 단위 시험 셋을 씨앗 여덟으로 가름 (행동 바뀜인가 씨앗 운인가). 쓰는 법: bash tri.sh <나무> <나옴 파일>
#  시험 파일을 그 나무 tools/sim/_tri_*.test.mjs 로 복사하며 씨앗만 R24_SEED 로 바꿔 (ai_intercept: 씨앗 묶음 [1,2,3,8] → [씨앗] · schielhau_strike: tsubameRun(1 → 씨앗 · special_cooldown: body 의 seed 3 → 씨앗)
#  씨앗 1 ~ 8 마다 그 시험 하나만 돌려 통과/실패를 적고, 복사본은 지움. nice 15 · 한 번에 하나.
T=$1; OUT=$2; cd $T || exit 1; : > $OUT
sed 's/for (const seed of \[1, 2, 3, 8\])/for (const seed of [+process.env.R24_SEED])/' tools/sim/ai_intercept.test.mjs > tools/sim/_tri_icp.test.mjs
sed 's/tsubameRun(1, { immortal: true, dur: 14, ghostDown: true })/tsubameRun(+process.env.R24_SEED, { immortal: true, dur: 14, ghostDown: true })/' tools/sim/schielhau_strike.test.mjs > tools/sim/_tri_sch.test.mjs
sed "s/const G = newRound({ walls: true, seed: 3, weapon, weapon2: 'longsword', gap: 2.4 });/const G = newRound({ walls: true, seed: +process.env.R24_SEED, weapon, weapon2: 'longsword', gap: 2.4 });/" tools/sim/special_cooldown.test.mjs > tools/sim/_tri_cool.test.mjs
for s in 1 2 3 4 5 6 7 8; do
  for p in "_tri_icp|판에서 쓰임: 막기 굴림" "_tri_sch|제비 베기 견줌 판" "_tri_cool|제비 베기: 나감"; do
    f=${p%%|*}; n=${p#*|}
    r=$(R24_SEED=$s nice -n 15 node --test --test-name-pattern="$n" tools/sim/$f.test.mjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' ')
    echo "$f seed $s $r" >> $OUT
  done
done
rm -f tools/sim/_tri_icp.test.mjs tools/sim/_tri_sch.test.mjs tools/sim/_tri_cool.test.mjs
date -u +%T >> $OUT
