#!/bin/sh
# usage: sh run_main.sh <baseUrl> <outDir>   (first pass: 3 canonical runs + 1 variant per cell)
B=$1; O=$2
node cells.mjs $B $O G1,G2,G5,G8,G7,G10
node cells.mjs $B $O B2,B3,B4,B5,B7
