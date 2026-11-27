#!/bin/bash
# r29 뛰기 값 다시 찾기 — 정해진 다리 값의 몸에서 (사장님 11/28 '뛰기 값 다시 찾기 돌려' · 일꾼 없이 · 떼어서 · 구조는 안 건드림 = 여섯째 시도가 아님)
#  쓰는 법: S=<scratch> setsid nohup bash run_hop_search.sh [분=90] > /dev/null 2>&1 &
#  까닭: 정해진 값에서만 못 넘는 세 줄(거른 땅 힘 · 몸통 숙임 · 흐르는 빠르기)이 뛰기 값을 다시 맞추면 돌아오는지 — 여섯째 시도를 여쭐 때 '진짜로 못 넘는 줄'의 수를 바로 세우려고.
#  찾기 = 뛰기 나무의 찾기 대본 그대로(search_ll.mjs · 본 판 0-7 로 점수) → 가장 좋은 값 나무(best_tree.mjs) → 본 판 0-7 · 안 본 판 100-123 관문 → 고친 줄로 다시 판정(rejudge.mjs)
#  나옴 $S/hop_ll/search/ · $S/hop_ll/out/{best_values,g_best_*,rejudge_best_*}.txt · 끝 표시 $S/hop_ll/DONE_search
set -u
H=$(cd "$(dirname "$0")" && pwd); R=$S/hop_ll; O=$R/out; MIN=${1:-90}; mkdir -p $R/search $O
W=$R/h_13_125 nice -n 15 node $H/search_ll.mjs $R/search es_ll $MIN > $R/search/es_ll.log 2>&1
node $H/best_tree.mjs $R/search/es_ll.jsonl $R/h_13_125 $R/h_13_125_best > $O/best_values.txt 2>&1
for sd in 0-7 100-123; do ( cd $R/h_13_125_best && nice -n 15 node tools/sim/run_gate.mjs --root=$R/h_13_125_best --stage=hop --seeds=$sd --jobs=2 --out=$R/cache_h_13_125_best > $O/g_best_$sd.txt 2> $O/g_best_$sd.err ); done
d=$(ls -d $R/cache_h_13_125_best/*/ | head -1)
node $H/rejudge.mjs "정해진 다리 값 + 다시 찾은 뛰기 값 · 본 판 0-7" $d/hop.*.0-7.json --gateTxt=$O/g_best_0-7.txt > $O/rejudge_best_seen.txt 2>&1
node $H/rejudge.mjs "정해진 다리 값 + 다시 찾은 뛰기 값 · 안 본 판 100-123" $d/hop.*.100-123.json --gateTxt=$O/g_best_100-123.txt > $O/rejudge_best_unseen.txt 2>&1
date -u +%T > $R/DONE_search
