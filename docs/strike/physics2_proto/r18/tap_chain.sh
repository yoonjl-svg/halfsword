#!/bin/bash
# 빈 위팔 명령 돎을 m 칸별로 (elb_tap.mjs · fights12 씨앗 1 ~ 12 · 시뮬 하나씩): S=$S tap_chain.sh <칸>... — 있으면 건너뜀
R=$(cd $(dirname $0) && pwd); S=${S:?}; O=$S/r18; MX=$S/p2/r6/mx/cells
for c in "$@"; do f=$O/tap_$c.txt; [ -s $f ] || (cd $MX/$c && ROOT=$MX/$c LABEL=$c node --import file://$R/elb_tap.mjs tools/sim/fights12.mjs > $f 2>&1); done
date > $O/TAP_DONE
