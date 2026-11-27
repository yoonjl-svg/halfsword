#!/bin/bash
# Q2a: 값 격자 ecc × 한도 배율 (씨앗 1 · 흔들기 없음) → $S/r29/tsub/grid.jsonl
#  쓰는 법: S=<scratch> bash run_grid.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=$S/r29/tsub/grid.jsonl
: > "$OUT"
cd "$S/p2/r6/mx/cells/ll_10_100"
for e in 1.0 1.1 1.17 1.2 1.3 1.4; do for m in 1.00 1.10 1.20 1.25 1.30; do
  nice -n 15 node "$HERE/lab.mjs" --root=. --ecc=$e --lm=$m --tag="g|$e|$m" --out="$OUT" 2>&1 | grep -v deprecated
done; done
