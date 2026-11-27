#!/bin/bash
# r33 재는 칸 만들기: 짓는 나무($S/wt_lunge)의 지금 src · tools · data 로 칸을 만듦(있으면 src · tools · data 만 새로 덮음). S=<scratch> bash mk_cell.sh <칸 이름> [나무]
#  칸 = $S/p2/r6/mx/cells/<이름> (바탕 칸 r32_a 의 사본 — node_modules 따위는 링크). node 는 칸 안에서 --root=. 로.
set -eu
C=$S/p2/r6/mx/cells; N=$1; T=${2:-$S/wt_lunge}
[ -d $C/$N ] || cp -a $C/r32_a $C/$N
( cd $C/$N && rm -rf src tools data && cp -a $T/src src && cp -a $T/tools tools && cp -a $T/data data )
echo "칸 $N ← $(cd $T && git rev-parse --short HEAD) + 고친 파일 $(cd $T && git status --short -- src tools data | wc -l)"
