#!/bin/bash
# r29 바탕 칸 확인: 바탕 칸 r24_om 의 src 가 origin/main 의 src 와 같은가 (파일마다 git hash-object 로 견줌).
#  쓰는 법: S=<scratch> bash base_check.sh  → 같으면 '같음 <파일 수>' · 다르면 다른 파일 이름
set -u
T=$(cd "$(dirname "$0")/../../../.." && pwd); B=$S/p2/r6/mx/cells/r24_om
a=$(git -C $T ls-tree -r origin/main -- src | awk '{print $3"  "$4}' | sort -k2)
b=$(cd $B && find src -type f | sort | while read f; do echo "$(git hash-object $f)  $f"; done | sort -k2)
if [ "$a" = "$b" ]; then echo "r24_om src = origin/main src: 같음 $(echo "$a" | wc -l) 파일"; else echo "다름:"; diff <(echo "$a") <(echo "$b"); fi
