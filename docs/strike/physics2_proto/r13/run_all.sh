#!/bin/bash
# 두 줄로 나눠 돌린다 (한 번에 시뮬레이션 둘까지). 나무 = $S/p2/r6/mx/cells/bw_250 · 결과 = $S/p2/r13/out
cd "$(dirname "$0")/../r6/mx/cells/bw_250" || exit 1
O=../../../../r13/out; J=../../../../r13/vs_src.mjs
lane1() {
  node $J --root=. --scene=cut --cut=desc --seeds=3001-3160 --json=$O/cut_desc.json > $O/cut_desc.txt 2>&1
  node $J --root=. --scene=cut --cut=horiz --seeds=3001-3060 --json=$O/cut_horiz.json > $O/cut_horiz.txt 2>&1
  node $J --root=. --scene=thrust --weapon=rapier --seeds=3001-3060 --json=$O/thr_rapier.json > $O/thr_rapier.txt 2>&1
  node $J --root=. --scene=thrust --weapon=longsword --seeds=3001-3120 --json=$O/thr_long.json > $O/thr_long.txt 2>&1
  node $J --root=. --scene=thrustai --weapon=rapier --seeds=3001-3012 --json=$O/thrai_rapier.json > $O/thrai_rapier.txt 2>&1
  touch $O/lane1.done
}
lane2() {
  node $J --root=. --scene=cutai --cut=desc --seeds=3001-3024 --json=$O/cutai_desc.json > $O/cutai_desc.txt 2>&1
  node $J --root=. --scene=cutai --cut=horiz --seeds=3001-3048 --json=$O/cutai_horiz.json > $O/cutai_horiz.txt 2>&1
  node $J --root=. --scene=thrustai --weapon=longsword --seeds=3001-3040 --json=$O/thrai_long.json > $O/thrai_long.txt 2>&1
  touch $O/lane2.done
}
lane1 & lane2 & wait
touch $O/all.done
