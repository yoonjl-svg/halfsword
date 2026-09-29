#!/bin/bash
cd /tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/exp
O=../out/duel
r(){ out=$1; shift; env OUT=$O/$out.json "$@" node tools/sim/duelstats.mjs 10 30 2>/dev/null | tail -1 > $O/$out.txt; }
( r duel_longsword_base W=longsword; r duel_longsword_plate W=longsword LOOK=heinrich; r duel_rapier_base W=rapier; r duel_rapier_spd1 W=rapier SPD=1; r duel_rapier_nocap W=rapier CAP=1e9 ) &
( r duel_lightsaber_base W=lightsaber; r duel_lightsaber_spd1 W=lightsaber SPD=1; r duel_lightsaber_spd05 W=lightsaber SPD=0.5; r duel_longsword_spd1 W=longsword SPD=1; r duel_sabre_base W=sabre ) &
wait; echo done
