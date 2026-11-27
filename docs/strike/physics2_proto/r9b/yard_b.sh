#!/bin/bash
# 앞뒤 재기 (나): yard_b.sh <이름> <나무> <출력 폴더> — 막기 묶음(세 무기) · 마무리 찌르기 씨앗 1 (80) (하나씩)
L=$1; T=$2; O=$3; mkdir -p $O; cd $T
node tools/sim/parry_gap_map.mjs longsword,rapier,zweihander > $O/${L}_parry.txt 2>&1
node tools/sim/finish_thrust.mjs 1 --rows > $O/${L}_fin.txt 2>&1; node tools/sim/finish_sum.mjs s1=$O/${L}_fin.txt > $O/${L}_finsum.txt 2>&1
date > $O/${L}_B_DONE
