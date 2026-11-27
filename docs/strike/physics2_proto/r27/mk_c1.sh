#!/bin/bash
# r27 C1 칸 만들기 (+ 진단 짝 o1e4 · n1e4 = 같은 둘을 × 10000 — × 100 에서 죽은 몸(근력 몫 0.02)은 실제 한도가 × 2 뿐이라 감쇠가 그 안에 걸린다): S=<scratch> TREE=<이 나무> bash mk_c1.sh  → $S/r27/cells/{o100,n100,nroom}
#  o100 = r24_om 사본 (본판 src) · 모든 LEGS.limit × 100 / n100 = r24_om 사본 + 이 나무 src · × 100 / nroom = r24_om 사본 + 이 나무 src · 모터 몫 여유 줄 하나만 1e30 (한도는 오늘 값)
set -eu
B=$S/p2/r6/mx/cells/r24_om; C=$S/r27/cells; mkdir -p $C
mk() { rm -rf $C/$1; cp -a $B $C/$1; }
x100() { sed -i -E "/^  limit: \{ hipFlex/ { s/: ([0-9]+)/: \1 * ${2:-100}/g }" $1/src/config.js; grep -n '^  limit:' $1/src/config.js; }
mk o100; x100 $C/o100
mk n100; rm -rf $C/n100/src; cp -a $TREE/src $C/n100/src; x100 $C/n100
mk nroom; rm -rf $C/nroom/src; cp -a $TREE/src $C/nroom/src
sed -i 's/_mRp\[j\] = Math.max(0, lp - t); _mRm\[j\] = Math.max(0, lm + t);/_mRp[j] = 1e30; _mRm[j] = 1e30;/' $C/nroom/src/legs_vmc.js
grep -c '_mRp\[j\] = 1e30; _mRm\[j\] = 1e30;' $C/nroom/src/legs_vmc.js
mk o1e4; x100 $C/o1e4 10000
mk n1e4; rm -rf $C/n1e4/src; cp -a $TREE/src $C/n1e4/src; x100 $C/n1e4 10000
