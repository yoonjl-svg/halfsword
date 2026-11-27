#!/bin/bash
# 빈팔 Dn 기록 (TAP=dn_rec(기본) · side_rec — 그 탭 파일 · 시뮬 하나씩 · nice): S=$S rec_chain.sh <칸> <출력 폴더> [줄...]
#  줄 기본: 싸움 12 판씩 (longsword · rapier(이탈리아 빈팔 유파) · zweihander · uchigatana(일본 · 한손 발도 빈손 자리)) · 막기 지도 (치는 셋 × 막는 셋) · 마무리 찌르기 씨앗 1 · 2
R=$(cd $(dirname $0) && pwd); S=${S:?}; MX=$S/p2/r6/mx; BT=$S/wt_b5m; c=$1; O=$2; D=$MX/cells/$c; mkdir -p $O; cd $D
J=${3:-"f_longsword f_rapier f_zweihander f_uchigatana p_longsword p_rapier p_zweihander t_1 t_2"}
for j in $J; do f=$O/rec_${c}_$j.f32; [ -s $f ] && continue
  case $j in
    f_*) ROOT=$D OUT=$f nice -n 15 node --import file://$R/${TAP:-dn_rec}.mjs $BT/tools/sim/legs_battery.mjs --root=$D --only=fight --fights=12 --fightWeapons=${j#f_} > $f.log 2>&1;;
    p_*) ROOT=$D OUT=$f ATK=${j#p_} nice -n 15 node --import file://$R/${TAP:-dn_rec}.mjs tools/sim/parry_gap_map.mjs longsword,rapier,zweihander > $f.log 2>&1;;
    t_*) ROOT=$D OUT=$f nice -n 15 node --import file://$R/${TAP:-dn_rec}.mjs tools/sim/finish_thrust.mjs ${j#t_} --rows > $f.log 2>&1;;
  esac
done
date > $O/REC_${c}_DONE
