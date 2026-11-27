#!/bin/bash
# 막기 맞대기 (롱소드 치고 롱소드 막음 · 공격마다 json): parry_pair.sh <출력 폴더> <칸>... — SETS 기본 0 a b (+0.05 · −0.05) · 더: c d e (±0.025 · +0.075) f g h (+0.0125 · −0.0125 · +0.0375)
# 칸 = $S/p2/r6/mx/cells/<칸> · 출력 <폴더>/pp_<칸>_<벌>.json · .txt (있으면 건너뜀 — 다시 돌려도 됨)
# 아홉 줄: ATK=<치는 무기> DEF=longsword,rapier,zweihander → <폴더>/pp9_<칸>_<치는 무기>_<벌>.json
S=${S:?}; MX=$S/p2/r6/mx; O=$1; shift; mkdir -p $O
declare -A G=([0]=1.35,1.5,1.65,1.8 [a]=1.4,1.55,1.7,1.85 [b]=1.3,1.45,1.6,1.75 [c]=1.375,1.525,1.675,1.825 [d]=1.325,1.475,1.625,1.775 [e]=1.425,1.575,1.725,1.875 [f]=1.3625,1.5125,1.6625,1.8125 [g]=1.3375,1.4875,1.6375,1.7875 [h]=1.3875,1.5375,1.6875,1.8375)
for k in ${SETS:-0 a b}; do
  for c in "$@"; do f=$O/pp_${c}_$k
    [ -n "$ATK" ] && f=$O/pp9_${c}_${ATK}_$k
    [ -s $f.json ] || (cd $MX/cells/$c && ATK=${ATK:-longsword} GAPS=${G[$k]} OUT=$f.json node tools/sim/parry_gap_map.mjs ${DEF:-longsword} > $f.txt 2>&1) &
  done; wait
done
date > $O/PP_DONE_${ATK}${SETS// /}
