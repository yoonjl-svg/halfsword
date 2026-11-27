#!/bin/bash
# r22 둘째 걸음(고친 차례): SCRATCH=$S nohup bash chain2.sh <칸...> & — 첫 걸음 끝 표시(DONE_stage1 · 또는 env WAITFOR 의 표시)를 기다린 뒤 고른 칸을 묶음 600 624 648 672 로 더 돌려 144 판을 채움(q2.sh · 둘씩 · nice).
#  고른 까닭은 기록 r22_leg_capacity.md 의 '둘째 걸음 고르기'. 끝 표시: $SCRATCH/r22/DONE_stage2_<칸들>
R=${SCRATCH:?}/r22; HERE=$(cd "$(dirname "$0")" && pwd)
until [ -f $R/${WAITFOR:-DONE_stage1} ]; do sleep 30; done
cd $HERE && OFFS="600 624 648 672" bash q2.sh "$@"
date -u +%T > $R/DONE_stage2_$(echo "$@" | tr ' ' _)
