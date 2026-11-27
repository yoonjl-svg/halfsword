#!/bin/bash
# r27 C1 재기 (떼어 돌림 · 한 번에 하나 · nice 15): S=<scratch> TREE=<이 나무> bash run_c1.sh → $S/r27/c1/<칸>.bin · 끝 표시 $S/r27/DONE_c1
#  견줌: o100 대 n100 (C1a) · r24_om 대 nroom (C1b) — cmp 로 비트까지
set -u
O=$S/r27/c1; mkdir -p $O; H=$TREE/docs/strike/physics2_proto/r27/trace.mjs
one() { local cell=$1 root=$2
  [ -s $O/$cell.bin ] && [ -s $O/$cell.txt ] && return
  while [ "$(cut -d' ' -f1 /proc/loadavg | awk '{print ($1>4.5)}')" = 1 ]; do sleep 20; done
  (cd $root && R27_ROOT=$root R27_TRACE=$O/$cell.bin nice -n 15 node --import file://$H tools/sim/fights12.mjs > $O/$cell.txt 2> $O/$cell.err); }
one o100 $S/r27/cells/o100
one n100 $S/r27/cells/n100
one om $S/p2/r6/mx/cells/r24_om
one nroom $S/r27/cells/nroom
one o1e4 $S/r27/cells/o1e4
one n1e4 $S/r27/cells/n1e4
{ echo "C1a o100 대 n100: $(cmp $O/o100.bin $O/n100.bin && echo 같음) · 크기 $(stat -c %s $O/o100.bin) $(stat -c %s $O/n100.bin) · 싸움 나옴 $(cmp $O/o100.txt $O/n100.txt && echo 같음)"
  echo "C1a' (× 10000) o1e4 대 n1e4: $(cmp $O/o1e4.bin $O/n1e4.bin && echo 같음) · 크기 $(stat -c %s $O/o1e4.bin) $(stat -c %s $O/n1e4.bin) · 싸움 나옴 $(cmp $O/o1e4.txt $O/n1e4.txt && echo 같음)"
  echo "C1b r24_om 대 nroom: $(cmp $O/om.bin $O/nroom.bin && echo 같음) · 크기 $(stat -c %s $O/om.bin) $(stat -c %s $O/nroom.bin) · 싸움 나옴 $(cmp $O/om.txt $O/nroom.txt && echo 같음)"; } > $O/c1_table.txt 2>&1
date -u +%T > $S/r27/DONE_c1
