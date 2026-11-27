#!/bin/bash
# r22p 줄 잇기: SCRATCH=$S nohup bash chain.sh <기다릴 끝 표시 파일> "<칸들>|<묶음들>" ... & — 앞 끝 표시를 기다린 뒤 q2.sh 를 차례로(한 번에 시뮬 둘까지). 끝 표시 $SCRATCH/r22p/DONE_chain_<첫 칸>
HERE=$(cd "$(dirname "$0")" && pwd); W=$1; shift
until [ -f "$W" ]; do sleep 30; done
for job in "$@"; do cells=${job%%|*}; offs=${job##*|}; OFFS="$offs" bash $HERE/q2.sh $cells; done
first=${1%%|*}; date -u +%T > $SCRATCH/r22p/DONE_chain_${first%% *}
