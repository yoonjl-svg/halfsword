#!/usr/bin/env bash
# r41 걸음 1 깊이 재기 — 모두 다시 돌리기 (시뮬은 한 번에 둘 · nice 15). S = 임시 작업 폴더 ($S/r41/cells/* 칸 · 결과 $S/r41/out/).
#  바탕 칸(패치 없음 · 상처 줄만): $S/p2/r6/mx/cells/r33_b1 (L1 팔 먼저) · r33_j (L2 팔 기다림) · r32_a (N 가까운 · F 싸움)
#  재는 칸(pierce1.patch 얹음): $S/r41/cells/pierce1_b1 · pierce1_j · pierce1
#  쓰는 법: S=<임시 폴더> bash run_all.sh
set -u
: "${S:?S 를 임시 작업 폴더로}"
D="$(cd "$(dirname "$0")" && pwd)"; O="$S/r41/out"; mkdir -p "$O"
jobs=()
add() { jobs+=("$1|$2|$3|$4"); } # 칸 · 장면 · 이름 · 덧 인자
add "$S/p2/r6/mx/cells/r33_b1" lunge base_L1 ""
add "$S/p2/r6/mx/cells/r33_j" lunge base_L2 ""
add "$S/p2/r6/mx/cells/r32_a" near base_N ""
add "$S/p2/r6/mx/cells/r32_a" fight base_F ""
for ff in 0 26; do for fp in 10 60 230; do
  add "$S/r41/cells/pierce1_b1" lunge "fp${fp}_ff${ff}_L1" "--fp=$fp --ff=$ff"
  add "$S/r41/cells/pierce1_j" lunge "fp${fp}_ff${ff}_L2" "--fp=$fp --ff=$ff"
  add "$S/r41/cells/pierce1" near "fp${fp}_ff${ff}_N" "--fp=$fp --ff=$ff"
  add "$S/r41/cells/pierce1" fight "fp${fp}_ff${ff}_F" "--fp=$fp --ff=$ff"
done; done
printf '%s\n' "${jobs[@]}" | xargs -P 2 -I{} bash -c 'IFS="|" read -r cell scene name extra <<< "{}"; cd "$cell" && nice -n 15 node "'"$D"'/pierce_depth.mjs" --root=. --scene=$scene $extra --json="'"$O"'/$name.json" > "'"$O"'/$name.log" 2>&1; tail -1 "'"$O"'/$name.log" | sed "s/^/$name: /"'
node "$D/pierce_table.mjs" --out="$O" > "$O/table.txt" && echo "표: $O/table.txt"
