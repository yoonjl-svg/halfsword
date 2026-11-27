#!/bin/bash
# 인과 시험: 1.3 + × 1.25 를 t0 부터만 켬 (그 전은 1.0 · 1.0) · 자르기 몫만 / 걸음 몫만 → $S/r29/tsub/t0.jsonl
#  쓰는 법: S=<scratch> bash run_t0.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=$S/r29/tsub/t0.jsonl
: > "$OUT"
cd "$S/p2/r6/mx/cells/ll_10_100"
for t in 1 2 4 6 8 9 9.5 10 10.2 10.4 10.5 10.6 10.7 10.8 11; do
  nice -n 15 node "$HERE/lab.mjs" --root=. --ecc=1.3 --lm=1.25 --t0=$t --tag="t0|$t" --out="$OUT" 2>&1 | grep -v deprecated
done
for sd in clamp gait; do for p in "none:" "dz+1:--dz=1" "dz-1:--dz=-1" "dz+2:--dz=2" "dz-2:--dz=-2" "dz+5:--dz=5" "dz-5:--dz=-5" "dx+1:--dx=1" "dx-1:--dx=-1" "mv.44:--mv=0.44" "mv.46:--mv=0.46" "nud+1:--nudge=1"; do
  nice -n 15 node "$HERE/lab.mjs" --root=. --ecc=1.3 --lm=1.25 --side=$sd ${p#*:} --tag="side_$sd|${p%%:*}" --out="$OUT" 2>&1 | grep -v deprecated
done; done
for hk in kneeExt hipFlex anklePlantar; do
  nice -n 15 node "$HERE/lab.mjs" --root=. --ecc=1.3 --lm=1.25 --hold=$hk --tag="hold|$hk" --out="$OUT" 2>&1 | grep -v deprecated
done
