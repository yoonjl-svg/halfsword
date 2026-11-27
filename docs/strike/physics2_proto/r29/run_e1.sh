#!/bin/bash
# r29 E1 — 비트까지 같음: 바탕 칸 r24_om(본판 src) 대 ll_10_100(이 나무 src · ecc 1.0 · 오늘 한도).
#  1) fights12 (12 판) 세계 스텝마다 골반 · 두 발 자리(f64) → <칸>.bin 을 cmp · 싸움 나옴 글도 cmp
#  2) 다리 묶음(legs_battery · 롱소드 · n 8) 나옴 글 · json 을 cmp
#  쓰는 법 (떼어서): S=<scratch> setsid nohup bash run_e1.sh > /dev/null 2>&1 &   → $S/r29/e1/e1_table.txt · 끝 표시 $S/r29/DONE_e1
#  한 번에 시뮬레이션 하나 · nice 15 · 1 분 부하 4.5 넘으면 기다림 · 이미 나온 것은 건너뜀
set -u
H=$(cd "$(dirname "$0")" && pwd); O=$S/r29/e1; mkdir -p $O; C=$S/p2/r6/mx/cells
wait_load() { while awk '{exit !($1>4.5)}' /proc/loadavg; do sleep 20; done; }
tr() { local cell=$1; [ -s $O/$cell.bin ] && return; wait_load
  (cd $C/$cell && R29_ROOT=$C/$cell R29_TRACE=$O/$cell.bin nice -n 15 node --import file://$H/trace.mjs tools/sim/fights12.mjs > $O/$cell.txt 2> $O/$cell.err); }
lb() { local cell=$1; [ -s $O/legs_$cell.json ] && return; wait_load
  (cd $C/$cell && nice -n 15 node tools/sim/legs_battery.mjs --root=. --n=8 --fights=0 --weapons=longsword --json=$O/legs_$cell.json > $O/legs_$cell.txt 2>&1); }
tr r24_om; tr ll_10_100; lb r24_om; lb ll_10_100
same() { cmp -s $1 $2 && echo 같음 || echo "다름($(cmp $1 $2 2>&1 | head -1))"; }
{ echo "골반 · 두 발 자리 (fights12 · 12 판): $(same $O/r24_om.bin $O/ll_10_100.bin) · 크기 $(stat -c %s $O/r24_om.bin) / $(stat -c %s $O/ll_10_100.bin) 바이트 · 줄 $(tail -1 $O/r24_om.err) / $(tail -1 $O/ll_10_100.err)"
  echo "fights12 나옴 글: $(same $O/r24_om.txt $O/ll_10_100.txt)"
  for x in r24_om ll_10_100; do for e in json txt; do sed "s#$C/$x#<칸>#g" $O/legs_$x.$e > $O/legs_$x.noroot.$e; done; done # 칸 자리 글만 지움
  echo "다리 묶음 (칸 자리 글을 지우고): json $(same $O/legs_r24_om.noroot.json $O/legs_ll_10_100.noroot.json) · 나옴 글 $(same $O/legs_r24_om.noroot.txt $O/legs_ll_10_100.noroot.txt) · 글 줄 수 $(wc -l < $O/legs_r24_om.txt) / $(wc -l < $O/legs_ll_10_100.txt) · 지우기 전 다른 줄 수 $(diff $O/legs_r24_om.txt $O/legs_ll_10_100.txt | grep -c '^<')"; } > $O/e1_table.txt 2>&1
date -u +%T > $S/r29/DONE_e1
