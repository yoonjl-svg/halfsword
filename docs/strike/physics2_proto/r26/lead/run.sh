#!/bin/bash
# r26 빈손 비킴 갈래: 새 간격 벌 6 (씨앗 11 ~ 16 — 씨앗은 판을 안 바꿈 · 간격이 바꿈) × 치는 셋 × 막는 셋 — 시뮬 하나씩 · nice 15
# bash run.sh <출력 폴더> <칸>...   (칸 = $S/p2/r6/mx/cells/<칸> · 있으면 건너뜀)
S=${S:?}; L=$(cd $(dirname $0) && pwd); O=$1; shift; mkdir -p $O
declare -A G=([11]=1.332,1.482,1.632,1.782 [12]=1.340,1.490,1.640,1.790 [13]=1.348,1.498,1.648,1.798 [14]=1.356,1.506,1.656,1.806 [15]=1.364,1.514,1.664,1.814 [16]=1.372,1.522,1.672,1.822)
for s in ${SEEDS:-11 12 13 14 15 16}; do for c in "$@"; do for a in longsword rapier zweihander; do
  f=$O/pq_${c}_${a}_$s; C=$S/p2/r6/mx/cells/$c
  [ -s $f.json ] || (cd $C && nice -n 15 env SEED=$s ATK=$a GAPS=${G[$s]} ROOT=$C OUT=$f.json node $L/parry_part.mjs longsword,rapier,zweihander > $f.txt 2>&1)
done; done; done
date > $O/RUN_DONE_$(echo "$@" | tr ' ' _)
