#!/bin/bash
# usage: run_gates.sh <checkout> <outdir>
M=$1; O=$2; cd "$M"
run(){ set=$1; shift; echo "== $set: $*" >> $O/logs/gates.log; NODE_V8_COVERAGE=$O/raw/$set nice -n 15 node "$@" > "$O/logs/$set-$(basename $1 .mjs).out" 2>&1; echo "exit $?" >> $O/logs/gates.log; }
run A tools/sim/fights12.mjs
run A tools/sim/live_battery.mjs
run A tools/sim/finish_thrust.mjs 1 --stand
run Bx tools/sim/match_twin.mjs
run Bx tools/sim/corr_s0.mjs --limits=on,off
run Bx tools/sim/weapon_smoke.mjs
run Bx tools/sim/team_fights.mjs 6 60 --modes=2v2,3v3,2v1 --jobs=1
echo DONE >> $O/logs/gates.log
