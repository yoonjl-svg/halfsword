#!/bin/bash
# gates.sh <checkout> <outdir> : the director's six gate values + match_twin + team_fights, stdout and stderr kept apart
M=$1; O=$2; cd "$M"
run(){ n=$1; shift; nice -n 10 node "$@" > "$O/logs/$n.out" 2> "$O/logs/$n.err"; echo "$n exit $?" >> "$O/logs/gates.log"; }
: > "$O/logs/gates.log"
run fights12 tools/sim/fights12.mjs
run live_battery tools/sim/live_battery.mjs
run finish_thrust_stand tools/sim/finish_thrust.mjs 1 --stand
run finish_thrust_down tools/sim/finish_thrust.mjs 1
run corr_s0 tools/sim/corr_s0.mjs --limits=on,off
run weapon_smoke tools/sim/weapon_smoke.mjs
run match_twin tools/sim/match_twin.mjs
run team_fights tools/sim/team_fights.mjs 6 60 --modes=2v2,3v3,2v1 --jobs=1
echo DONE >> "$O/logs/gates.log"
