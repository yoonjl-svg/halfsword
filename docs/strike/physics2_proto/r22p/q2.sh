#!/bin/bash
# r22p 넘어짐 · 싸움 값 · 자세 표본 줄 (r22/q2.sh 꼴): OFFS="0 300" SCRATCH=$S bash q2.sh <칸...>
#  도구는 이 폴더의 fall_cost.mjs (r22 복사 + --posture 자세 표본 · perFight). 끝난 일은 건너뜀 · 둘까지 나란히 · nice 15.
#  칸 이름 'fb_base' 는 나옴 폴더를 fb_base_r22p 로 (바탕 다시 돌림: 넘어짐 수가 fb_base_r21 과 같아야 하고, 판마다 죽음 · 자세 표본을 더 얻음)
#  칸: $SCRATCH/p2/r6/mx/cells/<칸> · 나옴: $SCRATCH/p2/r10f2/out/<칸>/fall_<묶음>.json · ring · posture_<묶음>.json · 끝 표시: $SCRATCH/r22p/DONE_<칸들>_<묶음들>
J=${SCRATCH:?흩어 놓는 곳}/p2/r10f2; C=$SCRATCH/p2/r6/mx/cells; O=$J/out; TOOL=$(cd "$(dirname "$0")" && pwd)/fall_cost.mjs
one() { cell=$1; off=$2; out=$cell; [ $cell = fb_base ] && out=fb_base_r22p; T=$C/$cell; D=$O/$out; mkdir -p $D
  [ -s $D/fall_$off.json ] && return
  ( cd $T && nice -n 15 node $TOOL --root=. --fights=24 --offset=$off --rows --all --mech --json=$D/fall_$off.json.tmp --ringOut=$D/ring_$off.json --posture=$D/posture_$off.json > $D/fall_$off.txt 2>&1 ) && mv $D/fall_$off.json.tmp $D/fall_$off.json; }
export -f one; export J C O TOOL
CELLS="$*"; OFFS=${OFFS:-0 300}; mkdir -p $SCRATCH/r22p; MARK=$SCRATCH/r22p/DONE_$(echo $CELLS | tr ' ' _)_$(echo $OFFS | tr ' ' _)
for off in $OFFS; do for c in $CELLS; do echo "$c $off"; done; done | xargs -P2 -L1 bash -c 'one $0 $1'
date -u +%T > $MARK
