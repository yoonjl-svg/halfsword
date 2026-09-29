#!/bin/bash
cd /tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/exp
S=16,20,24,28,32,36,40,45,50
O=../out/speed
run(){ env "$@" node tools/sim/speedsweep.mjs $S 16 2>/dev/null | grep '^{' ; }
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
