#!/bin/bash
# r22p 표 모으기: SCRATCH=$S bash tab.sh — 48 판 표 · 144 판 표 · 자세 증명 표 · 짝 지은 견줌 을 $SCRATCH/r22p/*.md 로 (있는 칸만).
#  바탕 넘어짐 표는 fb_base_r21 (r21 바탕 결과) · 자세 · 판마다 죽음은 같은 도구로 다시 돌린 fb_base_r22p (넘어짐 수가 fb_base_r21 과 같은지도 적음).
O=${SCRATCH:?}/p2/r10f2/out; R=$SCRATCH/r22p; HERE=$(cd "$(dirname "$0")" && pwd); TREE=$SCRATCH/p2/r6/mx/cells/fb_base
cd $TREE
C48=$(for c in sp_h2 sp_h4 sp_td sp_h_td sp_combo; do [ -s $O/$c/fall_300.json ] && echo -n "$c "; done)
C144=$(for c in sp_h2 sp_h4 sp_td sp_h_td sp_combo se_ecc13; do ok=1; for o in 0 300 600 624 648 672; do [ -s $O/$c/fall_$o.json ] || ok=0; done; [ $ok = 1 ] && echo -n "$c "; done)
TREE=$TREE node $HERE/sum.mjs $O fb_base_r21 fb_base_r22p $C48 sb_legs --offs=0,300 > $R/t48.md
TREE=$TREE node $HERE/sum.mjs $O fb_base_r21 fb_base_r22p $C144 sb_legs --offs=0,300,600,624,648,672 > $R/t144.md
node $HERE/pos.mjs $O fb_base_r22p $C48 --offs=0,300 > $R/pos48.md
TREE=$TREE node $HERE/pair.mjs $O fb_base_r22p $C144 --offs=0,300,600,624,648,672 > $R/pair144.md
echo "48: $C48 / 144: $C144"
