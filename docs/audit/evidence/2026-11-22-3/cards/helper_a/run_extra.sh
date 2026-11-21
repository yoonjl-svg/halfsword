#!/bin/sh
# usage: sh run_extra.sh <baseUrl> <outDir>   (second pass: burst hook, controls, variants, window sweeps)
B=$1; O=$2
VARIANT=half node cells.mjs $B $O G2
VARIANT=variant node cells.mjs $B $O G1,B2
RUNS=v VARIANT=iberianControl KEY=iberianControl node cells.mjs $B $O G2
RUNS=v VARIANT=swipe KEY=swipe node cells.mjs $B $O B4
for g in 0.35 0.45 0.55 0.65 0.75; do RUNS=v VARIANT=gap$g KEY=gap$g node cells.mjs $B $O B5,B7; done
RUNS=0,1,2,v VARIANT=variant UPCUT=1 KEY=upcut node cells.mjs $B $O B5
