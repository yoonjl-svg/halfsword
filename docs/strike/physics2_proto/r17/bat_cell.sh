#!/bin/bash
# 칸 하나 묶음 (cell.sh → extra.sh → parry_x.sh · 하나씩): bat_cell.sh <칸> <출력 폴더>
S=${S:?}; MX=$S/p2/r6/mx; c=$1; O=$2
[ -f $MX/$c/DONE ] || bash $MX/cell.sh $c
[ -f $MX/$c/EXTRA_DONE ] || bash $MX/extra.sh $c
[ -f $MX/$c/PARRYX_DONE ] || bash $MX/parry_x.sh $c
date > $O/B_${c}_DONE
