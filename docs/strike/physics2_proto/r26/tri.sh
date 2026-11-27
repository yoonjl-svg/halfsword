#!/bin/bash
# 새로 깨진 arm_real 시험 가르기 (씨앗 여덟 · 칸 둘 · 하나씩 · nice): S=$S tri.sh — r9b tri_bx.mjs 의 arm_real(여섯 자리 · 씨앗) · arm_real_p(시작 물리 스텝 흔들기) 갈래
R9=/home/user/halfsword/docs/strike/physics2_proto/r9b; S=${S:?}; MX=$S/p2/r6/mx; O=$S/r26/tri; mkdir -p $O
for k in arm_real arm_real_p; do for c in r26_om r26_new; do f=$O/tri_${k}_$c.jsonl
  [ -s $f ] || nice -n 15 node $R9/tri_bx.mjs $MX/cells/$c $k 1,2,3,4,5,6,7,8 > $f 2> $f.err; done; done
for c in r26_om r26_new; do f=$O/tri_A_$c.jsonl; [ -s $f ] || nice -n 15 node $(dirname $0)/tri_a.mjs $MX/cells/$c > $f 2> $f.err; done
date > $O/TRI_DONE
