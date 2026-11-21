#!/bin/bash
# usage: run_tests.sh <checkout> <outdir>
M=$1; O=$2; cd "$M"
NODE_V8_COVERAGE=$O/raw/T nice -n 15 node --test --test-concurrency=1 tools/sim/*.test.mjs > $O/logs/tests.out 2>&1
echo "exit $?" >> $O/logs/tests.out; echo DONE >> $O/logs/tests.out
