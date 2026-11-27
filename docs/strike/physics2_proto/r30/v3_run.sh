#!/bin/bash
# r30 V2 (ii) · V3: 고친 나무에서 장면마다 심판을 붙여 돌리고 엿보기(tap.mjs)로 다리 관절 셈을 모은 뒤 표를 만든다. 한 번에 한 과정 · nice 15.
#  쓰는 법: S=<작업 폴더> bash v3_run.sh   (나무 $S/wt_judge · 결과 $S/r30/v3/)
set -u
: "${S:?S 를 정해 주세요}"
W="$S/wt_judge"; H="$(cd "$(dirname "$0")" && pwd)"; OUT="$S/r30/v3"; mkdir -p "$OUT"
cd "$W"
for sc in stand walk back strafe; do
  R30_TAP_OUT="$OUT/tap_$sc.json" nice -n 15 node --import "file://$H/tap.mjs" tools/sim/honesty.mjs --scene=$sc --weapon=longsword --json="$OUT/sum_$sc.json" > "$OUT/log_$sc.txt" 2>&1
done
R30_TAP_OUT="$OUT/tap_reqlunge.json" nice -n 15 node --import "file://$H/tap.mjs" "$H/v3_reqlunge.mjs" --n=2 --weapon=longsword > "$OUT/log_reqlunge.txt" 2>&1
R30_TAP_OUT="$OUT/tap_fights12.json" nice -n 15 node --import "file://$H/tap.mjs" "$H/v3_fights12.mjs" > "$OUT/log_fights12.txt" 2>&1
node "$H/v3_table.mjs" "$OUT" > "$OUT/table.txt"
cat "$OUT/table.txt"
