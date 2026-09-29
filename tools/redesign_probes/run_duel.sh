#!/bin/bash
# 실험판 src(exp_src.patch) 가 필요하다(SPD/CAP 훅) — 이 저장소 src 에는 적용하지 않았다
cd "$(dirname "$0")/../.." || exit 1
O=tools/redesign_probes/out/duel; mkdir -p $O
r(){ out=$1; shift; env OUT=$O/$out.json "$@" node tools/redesign_probes/duelstats.mjs 10 30 2>/dev/null | tail -1 > $O/$out.txt; }
( r duel_longsword_base W=longsword; r duel_longsword_plate W=longsword LOOK=heinrich; r duel_rapier_base W=rapier; r duel_rapier_spd1 W=rapier SPD=1; r duel_rapier_nocap W=rapier CAP=1e9 ) &
( r duel_lightsaber_base W=lightsaber; r duel_lightsaber_spd1 W=lightsaber SPD=1; r duel_lightsaber_spd05 W=lightsaber SPD=0.5; r duel_longsword_spd1 W=longsword SPD=1; r duel_sabre_base W=sabre ) &
wait; echo done
