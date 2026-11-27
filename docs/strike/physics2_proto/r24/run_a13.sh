#!/bin/bash
# r24 A1 · A3 재기 묶음: S=<scratch> TREE=<나무> TAG=<이름> [LEGS="muscleLag=…"] [FIGHTS=1] [STAND30=1 = 30 s 서기 더 · ONLY30=1 = 그것만] bash run_a13.sh  → $S/r24/a13/<TAG>_<장면>.jsonl · 끝 표시 $S/r24/a13/DONE_<TAG>
#  장면: honesty stand · walk (R19_EVERY=1) · legs_battery reqlunge 2 판 (R19_EVERY=1) · (FIGHTS=1 이면) fights12 (R19_EVERY=40 · 두 몸) — 하나씩 차례로 · nice 15
set -u
H=$(cd "$(dirname "$0")" && pwd)
P=file://$H/probe24.mjs; L=file://$H/setlegs.mjs
O=$S/r24/a13; mkdir -p $O
one() { local name=$1; shift; local envs=(); while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift
  rm -f $O/${TAG}_$name.jsonl
  (cd $TREE && env R19_ROOT=$TREE R24_ROOT=$TREE R24_LEGS="${LEGS:-}" R19_OUT=$O/${TAG}_$name.jsonl "${envs[@]}" nice -n 15 node --import $L --import $P "$@" > $O/${TAG}_$name.log 2>&1) ; }
[ "${STAND30:-0}" = 1 ] && one stand30 R19_EVERY=1 R19_TDWIN=0 -- tools/sim/honesty.mjs --scene=stand30 --weapon=longsword
[ "${ONLY30:-0}" = 1 ] && { date -u +%T > $O/DONE_$TAG; exit 0; }
one stand R19_EVERY=1 R19_TDWIN=0 -- tools/sim/honesty.mjs --scene=stand --weapon=longsword
one walk R19_EVERY=1 R19_TDWIN=0 -- tools/sim/honesty.mjs --scene=walk --weapon=longsword
one lunge R19_EVERY=1 R19_TDWIN=0 -- tools/sim/legs_battery.mjs --only=reqlunge --n=2 --weapons=longsword --nohonesty --fights=0 --quiet
[ "${FIGHTS:-0}" = 1 ] && one fight R19_EVERY=40 R19_TDWIN=0 R19_WHO=all -- tools/sim/fights12.mjs
date -u +%T > $O/DONE_$TAG
