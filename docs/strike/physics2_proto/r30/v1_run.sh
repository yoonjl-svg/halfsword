#!/bin/bash
# r30 V1: 고친 나무(wt_judge)와 안 고친 나무(wt_r30base · 같은 커밋 08ebf060)에서 같은 장면을 돌려 출력을 견준다. 한 번에 한 과정 · nice 15.
#  쓰는 법: S=<작업 폴더> bash v1_run.sh   (나무: $S/wt_judge · $S/wt_r30base · 결과: $S/r30/v1/)
set -u
: "${S:?S 를 정해 주세요}"
OUT="$S/r30/v1"; mkdir -p "$OUT"
for T in base judge; do
  W="$S/wt_$T"; [ $T = base ] && W="$S/wt_r30base"
  for sc in stand walk back strafe; do
    (cd "$W" && nice -n 15 node tools/sim/honesty.mjs --scene=$sc --weapon=longsword > "$OUT/${T}_$sc.txt" 2>&1)
  done
  (cd "$W" && nice -n 15 node tools/sim/fights12.mjs > "$OUT/${T}_fights12.txt" 2>&1)
done
node "$(dirname "$0")/v1_cmp.mjs" "$OUT" > "$OUT/result.txt"
cat "$OUT/result.txt"
