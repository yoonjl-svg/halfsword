#!/bin/bash
# r22p 관문 표: SCRATCH=$S bash gsum.sh <칸...> — $SCRATCH/r22p/gate_<칸>.txt 에서 A · C 버팀 · 합계 · 디딜 때 무릎 · 가장 깊은 무릎 · 지킴 줄 견줌 줄을 뽑는다.
for c in "$@"; do f=$SCRATCH/r22p/gate_$c.txt; [ -s $f ] || { echo "| $c | 없음 |"; continue; }
  A=$(grep -o "A 옆으로.*" $f | grep -oE "버팀 [0-9]+/40 \([0-9]+ %\)|디딜 때 무릎 [0-9]+°|가장 깊은 무릎 [0-9]+°" | tr '\n' ' ')
  Cc=$(grep -o "C 한 발.*" $f | grep -oE "버팀 [0-9]+/40 \([0-9]+ %\)|디딜 때 무릎 [0-9]+°|가장 깊은 무릎 [0-9]+°" | tr '\n' ' ')
  T=$(grep -oE "합계 버팀 [0-9]+/80 \([0-9]+ %\)" $f); G=$(grep -o "지킴 줄.*" $f | sed 's/.*견줌)://')
  echo "| $c | $A | $Cc | $T | $G |"; done
