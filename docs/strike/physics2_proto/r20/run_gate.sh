#!/bin/bash
# 오늘 기준선: 관문 두 씨앗 묶음 (한 번에 시뮬레이션 하나 · nice 10 · 끊기면 다시 부르면 씨앗 저장(--cache)에서 이어 돎)
#  부르기: setsid nohup bash docs/strike/physics2_proto/r20/run_gate.sh <나무> <결과 폴더 = $S/r20> > /dev/null 2>&1 &
#  끝 표시: <결과 폴더>/gate.done
T=${1:-.}; O=${2:?결과 폴더}; D=$(cd "$(dirname "$0")" && pwd); mkdir -p "$O"
cd "$T" || exit 1
for B in 4001-4040 4041-4080; do
  [ -f "$O/gate_$B.json" ] || nice -n 10 node "$D/../../../../tools/sim/wb_gate.mjs" --root=. --seeds=$B --cache="$O/cache" --json="$O/gate_$B.json" > "$O/gate_$B.txt" 2>&1
done
[ -f "$O/gate_4001-4040.json" ] && [ -f "$O/gate_4041-4080.json" ] && touch "$O/gate.done"
