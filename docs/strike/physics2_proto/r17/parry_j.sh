#!/bin/bash
# 막기 흔들림 재기 (치는 칼 롱소드 · 막는 롱 · 츠 · 간격 네 개를 0.05 m 씩 옮긴 두 벌 · 하나씩): parry_j.sh <출력 폴더> <칸>...
S=${S:?}; MX=$S/p2/r6/mx; O=$1; shift
for c in "$@"; do for g in a:1.4,1.55,1.7,1.85 b:1.3,1.45,1.6,1.75; do k=${g%%:*}
  [ -s $O/parryj_${c}_$k.txt ] || (cd $MX/cells/$c && GAPS=${g#*:} node tools/sim/parry_gap_map.mjs longsword,zweihander > $O/parryj_${c}_$k.txt 2>&1); done; done
date > $O/PARRYJ_DONE
