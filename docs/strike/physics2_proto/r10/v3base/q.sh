#!/bin/bash
# 넘어짐 흔적 · 지킴 재기 줄: q.sh — 끝난 일은 건너뜀(다시 켜도 됨) · 둘까지 나란히
# 칸: $SCRATCH/p2/r6/mx/cells/fb_{base,bc,b} · 나옴: $SCRATCH/p2/r10f2/out/<칸>/
J=${SCRATCH:?흩어 놓는 곳}/p2/r10f2; C=$SCRATCH/p2/r6/mx/cells; O=$J/out
one() { cell=$1; what=$2; T=$C/$cell; D=$O/$cell; mkdir -p $D
  case $what in
    fall_*) off=${what#fall_}; [ -s $D/fall_$off.json ] && return
      ( cd $T && node tools/sim/fall_context.mjs --fights=24 --offset=$off --rows --all --mech --json=$D/fall_$off.json.tmp --ringOut=$D/ring_$off.json > $D/fall_$off.txt 2>&1 ) && mv $D/fall_$off.json.tmp $D/fall_$off.json ;;
    bat) [ -s $D/bat.txt ] && return
      ( cd $T && node tools/sim/legs_battery.mjs --n=8 --fights=0 --weapons=longsword --json=$D/bat.json > $D/bat.txt.tmp 2>&1 ) && mv $D/bat.txt.tmp $D/bat.txt ;;
    test) [ -s $D/test.txt ] && return
      ( cd $T && node --test --test-concurrency=1 tools/sim/thrust_stuck.test.mjs tools/sim/wrist_audit.test.mjs tools/sim/cavazione_tap.test.mjs tools/sim/stamina_clinch.test.mjs > $D/test.txt.tmp 2>&1; true ) && mv $D/test.txt.tmp $D/test.txt ;;
  esac; }
export -f one; export J C O
{ for off in 600 624 648 672 0 300; do for c in fb_base fb_bc fb_b; do echo "$c fall_$off"; done; done
  for c in fb_base fb_bc fb_b; do echo "$c bat"; echo "$c test"; done; } | xargs -P2 -L1 bash -c 'one $0 $1'
date -u +%T > $O/DONE
