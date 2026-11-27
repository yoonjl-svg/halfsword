#!/bin/bash
# S = 작업 자리(scratchpad) 뿌리 — 밖에서 export S=... 로 줌
# 가르기 돌리기: case 마다 본판 · 합친 판 둘을 함께 (시뮬 둘) — 끝나면 tri_<case>.jsonl · 표지 TRI_<case>_DONE
W=$S/p2/r9/main_req; C=$S/p2/r6/mx/cells
SEEDS=${SEEDS:-1,2,3,4,5,6,7,8}
for k in "$@"; do
  [ -f $W/TRI_${k}_DONE ] && continue
  ( cd $C/bf_4_120 && node $W/tri.mjs $C/bf_4_120 $k $SEEDS 2>/dev/null | grep '^{' > $W/tri_${k}_main.jsonl ) &
  ( cd $C/bw_250 && node $W/tri.mjs $C/bw_250 $k $SEEDS 2>/dev/null | grep '^{' > $W/tri_${k}_comb.jsonl ) &
  wait
  date -u +%T > $W/TRI_${k}_DONE
done
date -u +%T > $W/DRIVE_DONE_$1
