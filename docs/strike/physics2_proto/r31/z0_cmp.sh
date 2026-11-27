#!/bin/bash
# 띠 0 / 0 칸이 본판과 바이트 같은지 (fights12 · fights_blk 출력 전부 + 싸움꾼별 셈): S=$S z0_cmp.sh <바탕 칸> <0 칸> → $S/r31/z0_cmp.txt
S=${S:?}; O=$S/r31; A=$1; B=$2; T=$(mktemp -d)
{ for f in j12 j12b; do sed "s/$A/LBL/g" $O/${f}_$A.txt > $T/a; sed "s/$B/LBL/g" $O/${f}_$B.txt > $T/b
    cmp -s $T/a $T/b && echo "$f: 바이트 같음 ($(wc -l < $T/a) 줄 · 이름표만 바꿈)" || echo "$f: 다름"; done
  for f in seed seedb; do cmp -s $O/${f}_$A.json $O/${f}_$B.json && echo "${f}: 바이트 같음" || echo "${f}: 다름"; done; } > $O/z0_cmp.txt
cat $O/z0_cmp.txt
