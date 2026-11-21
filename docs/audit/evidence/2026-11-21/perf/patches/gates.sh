#!/bin/bash
# usage: gates.sh <tree> <label>  -> writes sha lines to gates_<label>.txt (stdout only)
T=$1; L=$2; O=$(cd $(dirname $0); pwd)/gates_$L.txt; : > $O
cd $T
run(){ name=$1; shift; s=$( (nice -n 10 node "$@" 2>/dev/null) | tee $(dirname $O)/out_${L}_$name.txt | sha256sum | cut -c1-16); echo "$name $s" >> $O; }
run fights12 tools/sim/fights12.mjs
run live_battery tools/sim/live_battery.mjs
run match_twin tools/sim/match_twin.mjs
run finish_thrust tools/sim/finish_thrust.mjs 1 --stand
run corr_s0 tools/sim/corr_s0.mjs --limits=on,off
run weapon_smoke tools/sim/weapon_smoke.mjs
run team_fights tools/sim/team_fights.mjs 6 60 --modes=2v2,3v3,2v1 --jobs=2
cat $O
