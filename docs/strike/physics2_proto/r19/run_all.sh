#!/bin/bash
# r19 측정 묶음 (한 번에 하나씩). 쓰는 법: S=<scratch> bash run_all.sh   → 결과 $S/r19/out/
set -u
P=file:///home/user/halfsword/docs/strike/physics2_proto/r19/probe.mjs
O=$S/r19/out; mkdir -p $O
MAIN=$S/p2/r6/mx/cells/bw_250
RUN=$S/wt_run
one() { # 이름 나무 환경… -- 도구 인자…
  local name=$1 root=$2; shift 2
  local envs=(); while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift
  rm -f $O/$name.ab.jsonl $O/$name.step.jsonl
  echo "== $name $(date +%T)" >> $O/progress.txt
  (cd $root && env R19_ROOT=$root R19_OUT=$O/$name.ab.jsonl "${envs[@]}" node --import $P "$@" > $O/$name.log 2>&1)
  echo "   done $(date +%T) $(tail -1 $O/$name.log | cut -c1-120)" >> $O/progress.txt
}
# Q3: 뛰는 나무 제자리 뜀 (뛰는 동안 모든 스텝 A/B)
one hop_ls $RUN R19_EVERY=1 R19_ABCOND=run R19_VALIDATE=1 R19_STEPLOG=$O/hop_ls.step.jsonl -- tools/sim/run_scenes.mjs --scene=hop --variants=0-7 --weapon=longsword --quiet --json=$O/hop_ls.json
one hop_rp $RUN R19_EVERY=2 R19_ABCOND=run R19_VALIDATE=1 R19_STEPLOG=$O/hop_rp.step.jsonl -- tools/sim/run_scenes.mjs --scene=hop --variants=0-7 --weapon=rapier --quiet --json=$O/hop_rp.json
# Q2: 본 게임
for sc in stand walk back strafe; do
  one m_$sc $MAIN R19_EVERY=2 R19_VALIDATE=1 R19_STEPLOG=$O/m_$sc.step.jsonl -- tools/sim/honesty.mjs --scene=$sc --weapon=longsword
done
one m_lunge $MAIN R19_EVERY=2 R19_VALIDATE=1 R19_STEPLOG=$O/m_lunge.step.jsonl -- tools/sim/legs_battery.mjs --only=reqlunge --n=4 --weapons=longsword --nohonesty --fights=0 --quiet
one m_fight $MAIN R19_EVERY=40 R19_TDWIN=0 R19_WHO=all R19_VALIDATE=1 -- tools/sim/fights12.mjs
echo ALLDONE >> $O/progress.txt
touch $O/DONE
