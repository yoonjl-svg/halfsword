#!/bin/bash
# r22 (r21/q2.sh 복사 · 끝 표시만 $SCRATCH/r22 로) 넘어짐 · 싸움 값 줄: OFFS="0 300" SCRATCH=$S bash q2.sh <칸...> — v3base/q.sh 와 같은 도구 인자(fall_context 를 fall_cost.mjs 로 — 같은 판 · 넘어짐 수에 cost 를 더 적음)
#  끝난 일은 건너뜀(다시 켜도 됨) · 둘까지 나란히 · nice 15. 칸 이름 'fb_base' 는 나옴 폴더를 fb_base_r21 로(옛 바탕 결과를 안 덮음)
#  칸: $SCRATCH/p2/r6/mx/cells/<칸> · 나옴: $SCRATCH/p2/r10f2/out/<칸>/ · 끝 표시: $SCRATCH/r22/DONE_<칸들>_<묶음들>
J=${SCRATCH:?흩어 놓는 곳}/p2/r10f2; C=$SCRATCH/p2/r6/mx/cells; O=$J/out; TOOL=$(cd "$(dirname "$0")" && pwd)/fall_cost.mjs
one() { cell=$1; off=$2; out=$cell; [ $cell = fb_base ] && out=fb_base_r21; T=$C/$cell; D=$O/$out; mkdir -p $D
  [ -s $D/fall_$off.json ] && return
  ( cd $T && nice -n 15 node $TOOL --root=. --fights=24 --offset=$off --rows --all --mech --json=$D/fall_$off.json.tmp --ringOut=$D/ring_$off.json > $D/fall_$off.txt 2>&1 ) && mv $D/fall_$off.json.tmp $D/fall_$off.json; }
export -f one; export J C O TOOL
CELLS="$*"; OFFS=${OFFS:-0 300}; mkdir -p $SCRATCH/r22; MARK=$SCRATCH/r22/DONE_$(echo $CELLS | tr ' ' _)_$(echo $OFFS | tr ' ' _)
for off in $OFFS; do for c in $CELLS; do echo "$c $off"; done; done | xargs -P2 -L1 bash -c 'one $0 $1'
date -u +%T > $MARK
