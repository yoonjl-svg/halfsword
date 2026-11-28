#!/usr/bin/env bash
# r41 정직 심판 — 싸움 장면(tools/sim/honesty.mjs --scene=fight) 바탕 칸 r32_a 대 재는 칸 pierce1 (FP 10 · 230 · FF 0) · 레이피어 · 장검 · 씨앗 4001 · 4002 · 30 s
#  쓰는 법: S=<임시 폴더> bash run_honesty.sh → $S/r41/out/hon_*.json · .log
set -u
: "${S:?S 를 임시 작업 폴더로}"
D="$(cd "$(dirname "$0")" && pwd)"; O="$S/r41/out"
jobs=()
for w in rapier longsword; do for sd in 4001 4002; do
  jobs+=("$S/p2/r6/mx/cells/r32_a|hon_base_${w}_${sd}|--weapon=$w --seed=$sd")
  for fp in 10 230; do jobs+=("$S/r41/cells/pierce1|hon_fp${fp}_${w}_${sd}|--fp=$fp --ff=0 --weapon=$w --seed=$sd"); done
done; done
printf '%s\n' "${jobs[@]}" | xargs -P 2 -I{} bash -c 'IFS="|" read -r cell name extra <<< "{}"; cd "$cell" && nice -n 15 node "'"$D"'/honesty_fp.mjs" --root=. --scene=fight --secs=30 $extra --json="'"$O"'/$name.json" > "'"$O"'/$name.log" 2>&1; echo "$name 끝"'
