#!/bin/bash
# r29 값 칸 넷 × 144 판 (이끄는 이 · 떼어서): S=<scratch> setsid nohup bash run_cells4.sh > /dev/null 2>&1 &
#  칸 ll_13_100 · ll_10_125 · ll_14_125 + 가운데 값 칸 ll_117_125 (= ll_13_125 사본에서 'ecc: 1.3,' 줄만 'ecc: 1.17,' 로 — 감사가 더한 일)
#  묶음 0 300 600 624 648 672 — 한 번에 하나 · 1 분 부하 4.5 넘으면 기다림 · 표 $S/r29/cells_table.txt · 끝 표시 $S/r29/DONE_cells
set -u
H=$(cd "$(dirname "$0")" && pwd); C=$S/p2/r6/mx/cells; M=$S/r29/DONE_cells; rm -f $M; mkdir -p $S/r29
CELLS="ll_13_100 ll_10_125 ll_14_125 ll_117_125"
wait_load() { while awk '{exit !($1>4.5)}' /proc/loadavg; do sleep 20; done; }
for c in $CELLS; do [ -d $C/$c ] || { echo "칸 없음 $c" >> $S/r29/run_cells.log; exit 1; }; done
for off in 0 300 600 624 648 672; do for c in $CELLS; do
  wait_load; OFFS="$off" SCRATCH=$S bash $H/../r22/q2.sh $c >> $S/r29/run_cells.log 2>&1
done; done
TREE=/home/user/halfsword node $H/../r22/sum.mjs $S/p2/r10f2/out r24_om ll_10_100 ll_13_125 ll_117_125 ll_13_100 ll_10_125 ll_14_125 --offs=0,300,600,624,648,672 > $S/r29/cells_table.txt 2>&1
date -u +%T > $M
