#!/bin/bash
# 실험판 src(exp_src.patch) 가 필요하다(CAP/CCD/SWEPT 훅) — 이 저장소 src 에는 적용하지 않았다
cd "$(dirname "$0")/../.." || exit 1
S=16,20,24,28,32,36,40,45,50
O=tools/redesign_probes/out/speed; mkdir -p $O
run(){ env "$@" node tools/redesign_probes/speedsweep.mjs $S 16 2>/dev/null | grep '^{' ; }
job(){ tg=$1; for T in 0.75 0.95; do
  run TGT=$tg T=$T CCD=0.2 CAP=30 > $O/${tg}_t${T}_base.jsonl
  run TGT=$tg T=$T CCD=0.2 CAP=1e9 > $O/${tg}_t${T}_nocap.jsonl
  run TGT=$tg T=$T CCD=auto CAP=1e9 > $O/${tg}_t${T}_auto.jsonl
  run TGT=$tg T=$T CCD=0.0 CAP=1e9 > $O/${tg}_t${T}_ccd0.jsonl
  run TGT=$tg T=$T CCD=0.2 CAP=1e9 DTX=2 > $O/${tg}_t${T}_240.jsonl
done; }
job farm & job neck & wait
( run TGT=farm T=0.95 CCD=0.2 CAP=30 W=rapier > $O/rapier_farm_base.jsonl
  run TGT=farm T=0.95 CCD=0.2 CAP=1e9 W=rapier > $O/rapier_farm_nocap.jsonl ) &
( run TGT=neck T=0.95 CCD=0.2 CAP=30 W=sabre > $O/sabre_neck_base.jsonl
  run TGT=neck T=0.95 CCD=0.2 CAP=1e9 W=sabre > $O/sabre_neck_nocap.jsonl ) &
wait; echo done
