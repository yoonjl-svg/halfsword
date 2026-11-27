#!/bin/bash
# r27 C2 · C3 · C4 재기 (떼어 돌림 · 한 번에 하나 · nice 15 · 1 분 부하 4.5 넘으면 기다림): S=<scratch> TREE=<이 나무> bash run_probe.sh <이름>=<칸>...
#  칸마다 r19 run_all.sh 의 본 게임 묶음 그대로(stand · walk · back · strafe = honesty 2 스텝마다 · lunge = legs_battery reqlunge 4 판 2 스텝마다 · fight = fights12 40 스텝마다 두 몸)
#  + 스텝마다 빠르기 기록(R27_SPEED). 나옴 $S/r27/probe/<이름>_<장면>.{ab.jsonl,sp.jsonl,log} · 끝 표시 $S/r27/probe/DONE_<이름>
set -u
P=file://$TREE/docs/strike/physics2_proto/r27/probe.mjs
O=$S/r27/probe; mkdir -p $O
wait_load() { while awk '{exit !($1>4.5)}' /proc/loadavg; do sleep 20; done; }
one() { local tag=$1 root=$2 name=$3; shift 3
  local envs=(); while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift
  [ -s $O/${tag}_$name.done ] && return
  rm -f $O/${tag}_$name.ab.jsonl $O/${tag}_$name.sp.jsonl
  wait_load
  echo "== $tag $name $(date -u +%T)" >> $O/progress.txt
  (cd $root && env R19_ROOT=$root R19_OUT=$O/${tag}_$name.ab.jsonl R27_SPEED=$O/${tag}_$name.sp.jsonl R19_NOIMP=1 "${envs[@]}" nice -n 15 node --import $P "$@" > $O/${tag}_$name.log 2>&1) && date -u +%T > $O/${tag}_$name.done
  echo "   done $(date -u +%T) $(tail -1 $O/${tag}_$name.log | cut -c1-120)" >> $O/progress.txt
}
for pair in "$@"; do
  tag=${pair%%=*}; root=${pair#*=}
  for sc in stand walk back strafe; do
    one $tag $root $sc R19_EVERY=2 R19_VALIDATE=1 -- tools/sim/honesty.mjs --scene=$sc --weapon=longsword
  done
  one $tag $root lunge R19_EVERY=2 R19_VALIDATE=1 -- tools/sim/legs_battery.mjs --only=reqlunge --n=4 --weapons=longsword --nohonesty --fights=0 --quiet
  one $tag $root fight R19_EVERY=40 R19_TDWIN=0 R19_WHO=all R19_VALIDATE=1 -- tools/sim/fights12.mjs
  date -u +%T > $O/DONE_$tag
done
