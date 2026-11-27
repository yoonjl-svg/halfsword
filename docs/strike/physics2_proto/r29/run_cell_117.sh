#!/bin/bash
# r29 가운데 값 칸 하나 × 144 판 (사장님 11/28 '가운데 값 1.17 칸도 … 네 뜻대로 측정해봐' · 일꾼 없이 · 떼어서): S=<scratch> setsid nohup bash run_cell_117.sh > /dev/null 2>&1 &
#  칸 ll_117_125 = 정해진 값 칸 ll_13_125 사본에서 'ecc: 1.3,' 줄만 'ecc: 1.17,' 로 (한도 × 1.25 는 같음). 묶음 0 300 600 624 648 672 — 한 번에 하나(뛰기 값 찾기와 CPU 를 나눠 씀).
#  표: 바탕 r24_om · 정해진 값 ll_13_125 와 나란히 → $S/r29/cell117_table.txt · 끝 표시 $S/r29/DONE_cell117
set -u
H=$(cd "$(dirname "$0")" && pwd); C=$S/p2/r6/mx/cells; mkdir -p $S/r29
[ -d $C/ll_117_125 ] || { echo "칸 없음" > $S/r29/cell117.log; exit 1; }
for off in 0 300 600 624 648 672; do OFFS="$off" SCRATCH=$S bash $H/../r22/q2.sh ll_117_125 >> $S/r29/cell117.log 2>&1; done
TREE=/home/user/halfsword node $H/../r22/sum.mjs $S/p2/r10f2/out r24_om ll_13_125 ll_117_125 --offs=0,300,600,624,648,672 > $S/r29/cell117_table.txt 2>&1
date -u +%T > $S/r29/DONE_cell117
