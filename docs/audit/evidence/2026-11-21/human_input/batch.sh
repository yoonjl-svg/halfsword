#!/bin/bash
# usage: batch.sh <instrumented-root> ; runs each scripted-player tool with counters, one at a time
cd "$1" || exit 1
export J_COUNTS=1
run() { local name=$1; shift; local t0=$(date +%s); env "${ENVV[@]}" timeout 240 nice -n 10 node jrun.mjs "$@" > out/$name.txt 2> out/$name.err; echo "$name rc=$? $(( $(date +%s)-t0 ))s" >> out/_log.txt; ENVV=(); }
ENVV=(); run finger_cut tools/sim/finger_cut.mjs drill --cells=german:longsword,japanese:uchigatana --seeds=1-3 --dur=14
run finish_thrust tools/sim/finish_thrust.mjs 1 longsword
run greatsword_finish tools/sim/greatsword_finish.mjs zweihander,flamberge --n=1
run finish_probe tools/sim/finish_probe.mjs 6 longsword 40
run gyeoksal_probe tools/sim/gyeoksal_probe.mjs qinggang,hwando - 1,2 45
run cn_gk_human tools/sim/cn_gk_measure.mjs human --seeds=1-2
run risoluto_tap tools/sim/risoluto_tap.mjs rapier,dartagnan isolde,tome 1 30
run mordschlag_duel tools/sim/mordschlag_duel.mjs longsword "" 2
ENVV=(SEEDS=901,902 OPPS=longsword,rapier DUR=30); run kote_drop_duel tools/sim/kote_drop_duel.mjs
run whip_duel tools/sim/whip_duel.mjs --weapons=druid_whip --opps=longsword,isolde --seeds=1-2 --dur=40
run special_fight tools/sim/special_balance.mjs fight --rows=japanese,kote,german,italian --opps=longsword,uchigatana --fseeds=901 --delays=0.22 --variants=on
ENVV=(VARIANTS=p50 SEEDS=1-2 DUR=20); run italian_press tools/sim/italian_press_fight.mjs
run live_battery tools/sim/live_battery.mjs cuts,hits,kata
run secret_free tools/sim/secret_free_measure.mjs --pairs=japanese:german,italian:iberian,german:chinese --vars=new --seeds=1
ENVV=(SCHOOL=german SEEDS=1,2); run unique_player tools/sim/unique_study_player.mjs
echo DONE >> out/_log.txt
