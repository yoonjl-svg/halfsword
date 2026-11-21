#!/bin/bash
# run.sh <scratch> : new main (wt3) — six gate values (stdout only), then AI-vs-AI finish trace and the ten-weapon duel set on old (wt2) and new (wt3)
S=$1; O=$S/F4; : > $O/log.txt
g(){ n=$1; shift; (cd $S/wt3 && nice -n 5 node "$@" > $O/new_$n.out 2> $O/new_$n.err); echo "$n exit $? sha $(sed 's/ · [0-9.]* s$//' $O/new_$n.out | sha256sum | cut -c1-8) lines $(wc -l < $O/new_$n.out)" >> $O/log.txt; }
g fights12 tools/sim/fights12.mjs
g live_battery tools/sim/live_battery.mjs
g finish_thrust_stand tools/sim/finish_thrust.mjs 1 --stand
g finish_thrust_down tools/sim/finish_thrust.mjs 1
g corr_s0 tools/sim/corr_s0.mjs --limits=on,off
g weapon_smoke tools/sim/weapon_smoke.mjs
g match_twin tools/sim/match_twin.mjs
g team_fights tools/sim/team_fights.mjs 6 60 --modes=2v2,3v3,2v1 --jobs=1
echo GATESDONE >> $O/log.txt
for w in wt2 wt3; do
  for W in longsword rapier zweihander; do (cd $S/$w && W=$W nice -n 5 node tools/sim/zz_finish_trace.mjs 12 30 > $O/ft_${w}_$W.txt 2>&1); echo "ft $w $W exit $?" >> $O/log.txt; done
done
for w in wt2 wt3; do (cd $S/$w && nice -n 5 node tools/sim/zz_D_fights_real.mjs > $O/D_$w.txt 2>&1); echo "D $w exit $?" >> $O/log.txt; done
echo ALLDONE >> $O/log.txt
