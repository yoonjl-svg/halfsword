#!/bin/sh
# usage: sh blocked/run_all.sh <baseUrl> <outDir> <down|drop>
for i in 0 1 2; do for m in input control; do node blocked/run.mjs $1 $2 $3 $m $i; done; done
