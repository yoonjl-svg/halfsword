#!/bin/bash
# gates_new.sh <checkout> <outdir> : seven gates + the downed-foe finish run, stdout+stderr per gate
M=$1; O=$2; cd "$M"
run(){ n=$1; shift; nice -n 10 node "$@" > "$O/logs/$n.out" 2>&1; echo "$n exit $?" >> "$O/logs/gates.log"; }
: > "$O/logs/gates.log"
run A-fights12 tools/sim/fights12.mjs
run A-live_battery tools/sim/live_battery.mjs
run A-finish_thrust tools/sim/finish_thrust.mjs 1 --stand
run Bx-match_twin tools/sim/match_twin.mjs
run Bx-corr_s0 tools/sim/corr_s0.mjs --limits=on,off
run Bx-weapon_smoke tools/sim/weapon_smoke.mjs
run Bx-team_fights tools/sim/team_fights.mjs 6 60 --modes=2v2,3v3,2v1 --jobs=1
run X-finish_down tools/sim/finish_thrust.mjs 1
echo DONE >> "$O/logs/gates.log"
