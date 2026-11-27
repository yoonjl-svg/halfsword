#!/bin/bash
# r29 뛰기 관문(제자리 뜀)을 같은 다리 힘 값으로 (감사가 더한 일 · 일꾼 없이 · 떼어서): S=<scratch> setsid nohup bash run_hop.sh [찾기 분=90] > /dev/null 2>&1 &
#  나무: $S/hop_ll/{h_10_100,h_13_125,h_117_125} — 뛰기 나무(wt_run 74fe061a)의 src · tools 사본에 port_hop.mjs 로 한도 셈을 옮긴 것.
#  ① h_10_100 관문(판 0-7)이 뛰기 나무의 관문 줄과 같은지(옮김이 수를 안 바꿈) ② 값 칸 둘 × 판 0-7 · 안 본 판 100-123 (뛰기 값 그대로)
#  ③ 값 칸 둘의 땅 힘 표(거르지 않음 · 20 Hz · 25 Hz) ④ 값 칸 144 판이 끝난 뒤($S/r29/DONE_cells) h_13_125 에서 뛰기 값 찾기(search_ll.mjs) → 가장 좋은 값으로 판 0-7 · 100-123
#  한 번에 관문 하나(그 안에서 시뮬 둘) · nice 15. 나옴 $S/hop_ll/out/ · 끝 표시 $S/hop_ll/DONE_gates · $S/hop_ll/DONE_search
set -u
H=$(cd "$(dirname "$0")" && pwd); R=$S/hop_ll; O=$R/out; MIN=${1:-90}; mkdir -p $O; rm -f $R/DONE_gates $R/DONE_search
gate() { # 나무 이름 · 판 범위 · 나옴 이름
  [ -s $O/$3.txt ] && grep -q '^GATE hop' $O/$3.txt && return
  ( cd $R/$1 && nice -n 15 node tools/sim/run_gate.mjs --root=$R/$1 --stage=hop --seeds=$2 --jobs=2 --out=$R/cache_$1 > $O/$3.txt 2> $O/$3.err ); }
force() { # 나무 이름 · 판 범위 · 나옴 이름 (관문 캐시의 hop.<무기>.<판 범위>.json)
  local d; d=$(ls -d $R/cache_$1/*/ | head -1); local fs=""
  for w in longsword rapier zweihander; do [ -f $d/hop.$w.$2.json ] && fs="$fs $d/hop.$w.$2.json"; done
  node $H/../../r27/hop_force_table.mjs $fs > $O/$3.txt 2>&1; }
gate h_10_100 0-7 g_10_100_seen
tail -n +2 $S/p2/r10/build/s5/gate_hop.txt | grep -v '^      ' > $O/ref_seen.cmp; tail -n +2 $O/g_10_100_seen.txt | grep -v '^      ' > $O/new_seen.cmp
if cmp -s $O/ref_seen.cmp $O/new_seen.cmp; then echo "옮김 확인: h_10_100 관문 줄 = 뛰기 나무 관문 줄 (같음)" > $O/port_same.txt; else echo "옮김 확인: 다름" > $O/port_same.txt; diff $O/ref_seen.cmp $O/new_seen.cmp >> $O/port_same.txt; fi
for t in h_13_125 h_117_125; do gate $t 0-7 g_${t}_seen; gate $t 100-123 g_${t}_unseen; done
for t in h_10_100 h_13_125 h_117_125; do force $t 0-7 f_${t}_seen; done
date -u +%T > $R/DONE_gates
while [ ! -f $S/r29/DONE_cells ]; do sleep 30; done
mkdir -p $R/search; W=$R/h_13_125 nice -n 15 node $H/search_ll.mjs $R/search es_ll $MIN > $R/search/es_ll.log 2>&1
node $H/best_tree.mjs $R/search/es_ll.jsonl $R/h_13_125 $R/h_13_125_best > $O/best_values.txt 2>&1
gate h_13_125_best 0-7 g_h_13_125_best_seen; gate h_13_125_best 100-123 g_h_13_125_best_unseen; force h_13_125_best 0-7 f_h_13_125_best_seen
date -u +%T > $R/DONE_search
