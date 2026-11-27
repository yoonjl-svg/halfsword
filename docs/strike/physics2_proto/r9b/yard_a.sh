#!/bin/bash
# 앞뒤 재기 (가): yard_a.sh <이름> <나무> <고리 넣은 나무> <출력 폴더> <본판 r9 도구 폴더> — 겨눔 뜀 · 빈 위팔 명령 뜀 · 12 판 팔 명령 · 떨림 · 뒷일 1 뜀 (하나씩)
P=$(cd $(dirname $0) && pwd); L=$1; T=$2; I=$3; O=$4; M=$5; mkdir -p $O
node $P/aim_jump.mjs --root=$I --weapons=longsword,zweihander --seeds=1,2 --json=$O/${L}_aim.json > $O/${L}_aim.txt 2>&1
for w in longsword zweihander; do node $M/off_cmd.mjs --root=$T --weapon=$w > $O/${L}_off_$w.txt 2>&1; done
(cd $T && ROOT=$T LABEL=$L node --import file://$T/tools/sim/arm_cmd_probe.mjs tools/sim/fights12.mjs > $O/${L}_f12.txt 2>&1)
node $M/buzz_fight.mjs --root=$T --weapons=longsword > $O/${L}_buzz.txt 2>&1
(cd $I && ROOT=$I SCENE=disarm OUT=$O/${L}_swj_disarm.json node --import file://$P/swj_probe.mjs $P/disarm.mjs > $O/${L}_swj_disarm.txt 2>&1
 ROOT=$I SCENE=pickup OUT=$O/${L}_swj_pickup.json node --import file://$P/swj_probe.mjs tools/sim/auto_pickup.test.mjs > $O/${L}_swj_pickup.txt 2>&1
 ROOT=$I SCENE=kpick OUT=$O/${L}_swj_kpick.json node --import file://$P/swj_probe.mjs tools/sim/kote_pickup.test.mjs > $O/${L}_swj_kpick.txt 2>&1)
date > $O/${L}_A_DONE
