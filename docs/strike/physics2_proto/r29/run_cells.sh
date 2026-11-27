#!/bin/bash
# r29 남은 값 칸 셋 × 144 판 (이끄는 이가 돌림 · 떼어서): S=<scratch> setsid nohup bash run_cells.sh > /dev/null 2>&1 &
#  칸 ll_13_100 · ll_10_125 · ll_14_125 (없으면 mk_cells.mjs 로 만듦) × 묶음 0 300 600 624 648 672 — 한 번에 하나(q2.sh 를 칸 하나 · 묶음 하나로 부름) · 1 분 부하 4.5 넘으면 기다림.
#  표: r22/sum.mjs (바탕 r24_om · E3 의 ll_10_100 · ll_13_125 과 함께) → $S/r29/cells_table.txt · 끝 표시 $S/r29/DONE_cells
set -u
H=$(cd "$(dirname "$0")" && pwd); C=$S/p2/r6/mx/cells; M=$S/r29/DONE_cells; rm -f $M; mkdir -p $S/r29
wait_load() { while awk '{exit !($1>4.5)}' /proc/loadavg; do sleep 20; done; }
for c in ll_13_100 ll_10_125 ll_14_125; do [ -d $C/$c ] || S=$S node $H/mk_cells.mjs $c >> $S/r29/run_cells.log 2>&1; done
for off in 0 300 600 624 648 672; do for c in ll_13_100 ll_10_125 ll_14_125; do
  wait_load; OFFS="$off" SCRATCH=$S bash $H/../r22/q2.sh $c >> $S/r29/run_cells.log 2>&1
done; done
TREE=/home/user/halfsword node $H/../r22/sum.mjs $S/p2/r10f2/out r24_om ll_10_100 ll_13_125 ll_13_100 ll_10_125 ll_14_125 --offs=0,300,600,624,648,672 > $S/r29/cells_table.txt 2>&1
date -u +%T > $M
