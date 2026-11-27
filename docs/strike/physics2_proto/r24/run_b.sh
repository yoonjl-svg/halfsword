#!/bin/bash
# r24 읽기 뒤 다시 재기 (A0 · A2 · A4 · A5 · 지적 1 의 K 참값 · 법칙 맞춤) — 시뮬레이션 둘까지 · nice 15.
#  쓰는 법: S=<scratch> SLOT=a|b setsid nohup bash run_b.sh > /dev/null 2>&1 &   (a = 넘어짐과 함께 도는 줄 하나 · b = 넘어짐 끝난 뒤 다른 한 줄)
#  나옴: $S/r24/b/ · 끝 표시 $S/r24/b/<일>.done · 바탕 나무 = $S/r24/base (origin/main src) · 이 나무 = wt_leg · 칸 r24_leg2 (fb_base 사본 + 이 나무 src)
set -u
H=$(cd "$(dirname "$0")" && pwd); T=$(cd $H/../../../.. && pwd); O=$S/r24/b; mkdir -p $O; B=$S/r24/base
C=$S/p2/r6/mx/cells; CELL=$C/r24_leg2
one() { local name=$1; shift; [ -f $O/$name.done ] && return; "$@"; touch $O/$name.done; }
if [ "$SLOT" = a ]; then
  one legs_new  bash -c "cd $T && nice -n 15 node tools/sim/legs_battery.mjs --root=. --n=8 --fights=0 --weapons=longsword --json=$O/legs_new.json > $O/legs_new.txt 2>&1"
  one legs_base bash -c "cd $B && nice -n 15 node tools/sim/legs_battery.mjs --root=. --n=8 --fights=0 --weapons=longsword --json=$O/legs_base.json > $O/legs_base.txt 2>&1"
  one kc_lunge  bash -c "cd $T && R24_ROOT=$T R24_KC=$O/kc_lunge.jsonl R24_KC_EVERY=10 nice -n 15 node --import file://$H/kcheck.mjs tools/sim/legs_battery.mjs --only=reqlunge --n=2 --weapons=longsword --nohonesty --fights=0 --quiet > $O/kc_lunge.log 2>&1"
  one kc_walk   bash -c "cd $T && R24_ROOT=$T R24_KC=$O/kc_walk.jsonl R24_KC_EVERY=10 nice -n 15 node --import file://$H/kcheck.mjs tools/sim/honesty.mjs --scene=walk --weapon=longsword > $O/kc_walk.log 2>&1"
  one cons_walk bash -c "cd $T && R24_ROOT=$T R24_CONS=$O/cons_walk.json nice -n 15 node --import file://$H/consist.mjs tools/sim/honesty.mjs --scene=walk --weapon=longsword > $O/cons_walk.log 2>&1"
  one cons_lunge bash -c "cd $T && R24_ROOT=$T R24_CONS=$O/cons_lunge.json nice -n 15 node --import file://$H/consist.mjs tools/sim/legs_battery.mjs --only=reqlunge --n=2 --weapons=longsword --nohonesty --fights=0 --quiet > $O/cons_lunge.log 2>&1"
  one a0        bash -c "nice -n 15 node $H/same_seed.mjs run $B $T $O/a0 > $O/a0.txt 2>&1"
  one tests     bash -c "cd $T && nice -n 15 node --test --test-concurrency=1 tools/sim/*.test.mjs > $O/tests.txt 2>&1"
  touch $O/A.done
else
  until [ -f $S/r24/DONE_falls_r24_leg2 ]; do sleep 30; done
  one gate bash -c "for t in balance_gate.mjs balance_scenes.mjs; do [ -f $CELL/tools/sim/\$t ] || cp $T/tools/sim/\$t $CELL/tools/sim/\$t; done; cd $CELL && nice -n 15 node tools/sim/balance_gate.mjs --root=. --seeds=100-139 --jobs=1 --json=$O/gate.json > $O/gate.txt 2>&1"
  until [ -f $O/A.done ]; do sleep 30; done
  # 값 (A5): 12 판 묶음을 바탕 ‖ 이 나무 나란히 · 세 번
  for k in 1 2 3; do
    one cost$k bash -c "( cd $B && R24_ROOT=$B nice -n 15 node --import file://$H/count_steps.mjs tools/sim/fights12.mjs > $O/cost_base_$k.txt 2>&1 ) & ( cd $T && R24_ROOT=$T nice -n 15 node --import file://$H/count_steps.mjs tools/sim/fights12.mjs > $O/cost_new_$k.txt 2>&1 ) & wait"
  done
  touch $O/B.done
fi
