#!/bin/bash
# r24 A2 · A4 · A5 · A1(싸움) 묶음 — 늘 시뮬레이션 둘까지 · nice 15. 쓰는 법: S=<scratch> setsid nohup bash run_a2.sh > /dev/null 2>&1 &
#  칸 r24_leg = $S/p2/r6/mx/cells/fb_base 의 사본에 src 만 이 나무(wt_leg)의 src 로 (넘어짐 · 관문용). 나옴: $S/r24/a2/ · 넘어짐 = $S/p2/r10f2/out/r24_leg/
#  끝 표시: $S/r24/a2/<일>.done
set -u
H=$(cd "$(dirname "$0")" && pwd); T=$(cd $H/../../../.. && pwd); O=$S/r24/a2; mkdir -p $O
C=$S/p2/r6/mx/cells; CELL=$C/r24_leg
if [ ! -d $CELL ]; then cp -a $C/fb_base $CELL; rm -rf $CELL/src; cp -r $T/src $CELL/src; fi
R22=/home/user/halfsword/docs/strike/physics2_proto/r22
# 1) 넘어짐 48 판 (offset 0 · 300 — 둘 나란히)
[ -f $O/falls.done ] || { SCRATCH=$S OFFS="0 300" bash $R22/q2.sh r24_leg > $O/falls.log 2>&1; touch $O/falls.done; }
# 2) 균형 관문 (씨앗 100-139 · 관문 도구가 둘 나란히)
[ -f $O/gate.done ] || { for t in balance_gate.mjs balance_scenes.mjs; do [ -f $CELL/tools/sim/$t ] || cp $T/tools/sim/$t $CELL/tools/sim/$t; done
  ( cd $CELL && nice -n 15 node tools/sim/balance_gate.mjs --root=. --seeds=100-139 --jobs=2 --json=$O/gate.json > $O/gate.txt 2>&1 ); touch $O/gate.done; }
# 3) 다리 묶음 (이 나무) ‖ 단위 시험 (이 나무 · 하나씩)
[ -f $O/legs_tests.done ] || {
  ( cd $T && nice -n 15 node tools/sim/legs_battery.mjs --root=. --n=8 --fights=0 --weapons=longsword --json=$O/legs.json > $O/legs.txt 2>&1 ) &
  ( cd $T && nice -n 15 node --test --test-concurrency=1 tools/sim/*.test.mjs > $O/tests.txt 2>&1 ) &
  wait; touch $O/legs_tests.done; }
# 4) 값 (A5): 12 판 묶음을 바탕 ‖ 이 나무 나란히 (같은 때 · 같은 짐) — 세계 스텝을 세어 벽시계 ÷ 흉내 낸 초 (count_steps.mjs)
[ -f $O/cost.done ] || {
  ( cd $S/r24/base && R24_ROOT=$S/r24/base nice -n 15 node --import file://$H/count_steps.mjs tools/sim/fights12.mjs > $O/cost_base.txt 2>&1 ) &
  ( cd $T && R24_ROOT=$T nice -n 15 node --import file://$H/count_steps.mjs tools/sim/fights12.mjs > $O/cost_new.txt 2>&1 ) &
  wait; touch $O/cost.done; }
# 5) A1 싸움 (이 나무 · 40 스텝마다 · 두 몸)
[ -f $O/a1fight.done ] || { mkdir -p $S/r24/a13; ( cd $T && R19_ROOT=$T R19_OUT=$S/r24/a13/new_fight.jsonl R19_EVERY=40 R19_TDWIN=0 R19_WHO=all nice -n 15 node --import file://$H/probe24.mjs tools/sim/fights12.mjs > $S/r24/a13/new_fight.log 2>&1 ); touch $O/a1fight.done; }
touch $O/ALL.done
