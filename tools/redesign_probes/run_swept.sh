#!/bin/bash
# 실험판 src(exp_src.patch) 가 필요하다(CAP/CCD/SWEPT 훅) — 이 저장소 src 에는 적용하지 않았다
cd "$(dirname "$0")/../.." || exit 1
S=16,20,24,28,32,36,40,45,50
O=tools/redesign_probes/out/speed; mkdir -p $O
run(){ env "$@" node tools/redesign_probes/speedsweep.mjs $S 16 2>/dev/null | grep '^{' ; }
( for T in 0.75 0.95; do run SWEPT=1 TGT=farm T=$T CAP=1e9 > $O/farm_t${T}_swept.jsonl; run TGT=farm T=$T CAP=1e9 > $O/farm_t${T}_nocapB.jsonl; done
  run SWEPT=1 TGT=farm T=0.95 CAP=1e9 W=rapier > $O/rapier_farm_swept.jsonl ) &
( for T in 0.75 0.95; do run SWEPT=1 TGT=neck T=$T CAP=1e9 > $O/neck_t${T}_swept.jsonl; done
  run SWEPT=1 TGT=neck T=0.95 CAP=1e9 W=sabre > $O/sabre_neck_swept.jsonl
  run SWEPT=1 TGT=farm T=0.95 CAP=1e9 LIVE=1 > $O/farm_t0.95_swept_live.jsonl
  run TGT=farm T=0.95 CAP=30 LIVE=1 > $O/farm_t0.95_base_live.jsonl ) &
wait; echo done
