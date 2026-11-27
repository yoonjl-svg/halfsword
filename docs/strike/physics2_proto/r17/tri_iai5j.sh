#!/bin/bash
# iai_obi ⑤ 흔들기 (씨앗이 장면을 안 바꿈 → 처음 떨어진 거리 gap 을 0 ~ 7 cm 흔듦 · 하나씩): tri_iai5j.sh <기다릴 표지> <출력 폴더> <나무>...
#  나무 = 칸 복사본에 iai_obi.mjs sayaScript 의 gap: 7.0 → 7.0 + GAPJ 를 넣은 것 (재기만)
P=$(cd $(dirname $0) && pwd); W=$1; O=$2; shift 2
until [ -f $W ]; do sleep 30; done
for t in "$@"; do for j in 0 0.01 0.02 0.03 0.04 0.05 0.06 0.07; do GAPJ=$j node $P/tri_iai5.mjs $t 1 | sed "s/^/{\"gapj\":$j,/; s/^{\"gapj\":\([0-9.]*\),{/{\"gapj\":\1,/"; done > $O/trij_$(basename $t).jsonl 2>/dev/null; done
date > $O/TRIJ_DONE
