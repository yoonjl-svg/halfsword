#!/bin/bash
# r22p 관문 줄: SCRATCH=$S nohup bash gates.sh & — 넘어짐 줄(chain_sp_combo) 끝을 기다린 뒤 144 판 칸들의 균형 관문(side.sh) 을 차례로. 끝 표시 $SCRATCH/r22p/DONE_gate_…
HERE=$(cd "$(dirname "$0")" && pwd)
until [ -f $SCRATCH/r22p/DONE_chain_sp_combo ]; do sleep 30; done
bash $HERE/side.sh sp_h2 sp_h4 sp_td sp_h_td sp_combo
