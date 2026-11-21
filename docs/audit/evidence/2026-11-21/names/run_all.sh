#!/bin/sh
# usage: sh run_all.sh <checkout-dir>   (run from this scripts dir; outputs go to cwd)
M="$1"
node cfgkeys.mjs "$M"            # -> cfg_leaves.json  (leaf keys of exported config objects via dynamic import)
python3 cfg_vocab.py "$M"        # item 1a-1e (annotates cfg_leaves_ann.json)
python3 units.py "$M"            # item 7
python3 dups.py "$M"             # item 2 (-> dups.json)
python3 density.py "$M"          # item 3
ls "$M/src" | grep -E '\.js$' | sed 's/\.js$//' > names.txt
python3 fam.py "$M"              # item 4 (import-graph family outliers)
python3 docs_scan.py "$M"; python3 docs_dates.py "$M"   # item 5
git -C "$M" log -600 --format=%s > subjects.txt; python3 commits.py subjects.txt   # item 6
