#!/bin/bash
# Q2b: 물리로는 상관없어야 할 작은 흔들기 × 값 짝 — 한 번에 한 판 (nice 15) · 칸 ll_10_100 에서 LEGS 를 런타임에 바꿈
#  쓰는 법: S=<scratch> bash run_pert.sh  → $S/r29/tsub/pert.jsonl
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=$S/r29/tsub/pert.jsonl
: > "$OUT"
cd "$S/p2/r6/mx/cells/ll_10_100"
SETS=("base:" "e13m125:--ecc=1.3 --lm=1.25" "e117m125:--ecc=1.17 --lm=1.25" "e13:--ecc=1.3" "m125:--lm=1.25")
PERT=("none:" "dz+0.5:--dz=0.5" "dz-0.5:--dz=-0.5" "dz+1:--dz=1" "dz-1:--dz=-1" "dz+2:--dz=2" "dz-2:--dz=-2" "dz+3:--dz=3" "dz-3:--dz=-3" "dz+5:--dz=5" "dz-5:--dz=-5"
      "dx+1:--dx=1" "dx-1:--dx=-1" "dx+2:--dx=2" "dx-2:--dx=-2" "mv.44:--mv=0.44" "mv.445:--mv=0.445" "mv.455:--mv=0.455" "mv.46:--mv=0.46" "nud+1:--nudge=1" "nud-1:--nudge=-1")
for s in "${SETS[@]}"; do
  for p in "${PERT[@]}"; do
    nice -n 15 node "$HERE/lab.mjs" --root=. ${s#*:} ${p#*:} --tag="${s%%:*}|${p%%:*}" --out="$OUT" 2>&1 | grep -v deprecated
  done
done
