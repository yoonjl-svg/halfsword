#!/bin/bash
# r22 첫 걸음 줄 잇기: SCRATCH=$S nohup bash chain1.sh & — 값 칸 묶음(q2.sh sd_*) 끝 표시를 기다린 뒤 부호 검사(se_ecc13 · se_src 칸) → se_ecc13 se_ecc15 → se_src 를 48 판씩.
#  한 번에 시뮬 둘까지(부호 검사는 하나씩 · q2.sh 는 둘씩) · nice. 끝 표시: $SCRATCH/r22/DONE_stage1
R=${SCRATCH:?}/r22; C=$SCRATCH/p2/r6/mx/cells; HERE=$(cd "$(dirname "$0")" && pwd)
until [ -f $R/DONE_sd_knee2_sd_hip2_sd_ank2_sd_all125_sd_all15_0_300 ]; do sleep 30; done
for c in se_ecc13 se_src; do
  [ -s $R/sign_$c.txt ] || ( cd $C/$c && nice -n 15 node $HERE/sign_check.mjs --root=. > $R/sign_$c.txt.tmp 2>&1; mv $R/sign_$c.txt.tmp $R/sign_$c.txt )
done
cd $HERE && OFFS="0 300" bash q2.sh se_ecc13 se_ecc15
cd $HERE && OFFS="0 300" bash q2.sh se_src
date -u +%T > $R/DONE_stage1
