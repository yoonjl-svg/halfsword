#!/bin/bash
# 닿은 획이 40 에 모자란 줄만 씨앗을 늘려 다시 (run_all.sh 와 같은 범위로 고친 줄)
cd "$(dirname "$0")/../r6/mx/cells/bw_250" || exit 1
O=../../../../r13/out; J=../../../../r13/vs_src.mjs
( node $J --root=. --scene=cutai --cut=desc --seeds=3001-3024 --json=$O/cutai_desc.json > $O/cutai_desc.txt 2>&1
  node $J --root=. --scene=thrust --weapon=longsword --seeds=3001-3120 --json=$O/thr_long.json > $O/thr_long.txt 2>&1 ) &
node $J --root=. --scene=cutai --cut=horiz --seeds=3001-3048 --json=$O/cutai_horiz.json > $O/cutai_horiz.txt 2>&1 &
wait; touch $O/top.done
