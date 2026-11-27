#!/bin/bash
# S = 작업 자리(scratchpad) 뿌리 — 밖에서 export S=... 로 줌
# 합친 판 bw_250: 단위 시험 (다른 칸과 같은 명령) → TESTS_DONE
MX=$S/p2/r6/mx; c=bw_250; D=$MX/cells/$c; O=$MX/$c
if [ ! -f $O/TESTS_DONE ]; then ( cd $D && node --test --test-concurrency=2 tools/sim/*.test.mjs > $O/tests.txt 2>&1 ); grep "^not ok" $O/tests.txt | sed 's/^not ok [0-9]* - //' | sort > $O/tests_fail.txt; date -u +%T > $O/TESTS_DONE; fi
