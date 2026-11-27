#!/bin/bash
# Q2b 둘째 묶음: 흔들기 20 가지 더 (바탕 · 1.3 + × 1.25 · 1.17 + × 1.25) → $S/r29/tsub/pert2.jsonl
#  쓰는 법: S=<scratch> bash run_pert2.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=$S/r29/tsub/pert2.jsonl
: > "$OUT"
cd "$S/p2/r6/mx/cells/ll_10_100"
SETS=("base:" "e13m125:--ecc=1.3 --lm=1.25" "e117m125:--ecc=1.17 --lm=1.25")
PERT=("dz+0.1:--dz=0.1" "dz-0.1:--dz=-0.1" "dz+0.2:--dz=0.2" "dz-0.2:--dz=-0.2" "dz+4:--dz=4" "dz-4:--dz=-4" "dz+7:--dz=7" "dz-7:--dz=-7" "dz+10:--dz=10" "dz-10:--dz=-10"
      "dx+0.5:--dx=0.5" "dx-0.5:--dx=-0.5" "dx+3:--dx=3" "dx-3:--dx=-3" "mv.442:--mv=0.442" "mv.448:--mv=0.448" "mv.452:--mv=0.452" "mv.458:--mv=0.458" "nud+0.5:--nudge=0.5" "nud-0.5:--nudge=-0.5")
for s in "${SETS[@]}"; do
  for p in "${PERT[@]}"; do
    nice -n 15 node "$HERE/lab.mjs" --root=. ${s#*:} ${p#*:} --tag="${s%%:*}|${p%%:*}" --out="$OUT" 2>&1 | grep -v deprecated
  done
done
