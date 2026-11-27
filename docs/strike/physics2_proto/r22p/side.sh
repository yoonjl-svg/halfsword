#!/bin/bash
# r22p 균형 관문 (r22/side2.sh 복사 · 나옴만 $SCRATCH/r22p) (r21/side.sh 꼴): SCRATCH=$S bash side2.sh <칸...> — 칸마다 tools/sim/balance_gate.mjs (씨앗 100-139 · 둘씩 · nice) 를 차례로. 끝난 것은 건너뜀.
#  관문 도구는 저장소 tools/sim/balance_gate.mjs · balance_scenes.mjs 를 칸 사본 tools/sim 에 복사해 칸 안에서 돈다(r21 의 sb_body 와 같은 방법 · 저장소 tools 는 안 건드림).
#  나옴: $SCRATCH/r22p/gate_<칸>.json · .txt · 끝 표시 $SCRATCH/r22p/DONE_gate_<칸들>
R=${SCRATCH:?}/r22p; C=$SCRATCH/p2/r6/mx/cells; REPO=$(cd "$(dirname "$0")/../../../.." && pwd)
for c in "$@"; do
  [ -s $R/gate_$c.json ] && continue
  for t in balance_gate.mjs balance_scenes.mjs; do [ -f $C/$c/tools/sim/$t ] || cp $REPO/tools/sim/$t $C/$c/tools/sim/$t; done
  ( cd $C/$c && nice -n 15 node tools/sim/balance_gate.mjs --root=. --seeds=100-139 --jobs=2 --json=$R/gate_$c.json.tmp > $R/gate_$c.txt 2>&1 ) && mv $R/gate_$c.json.tmp $R/gate_$c.json
done
date -u +%T > $R/DONE_gate_$(echo "$@" | tr ' ' _)
