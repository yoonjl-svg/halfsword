#!/bin/bash
# r30: 심판을 붙인 fights12(v3_fights12.mjs) 의 끝 두 줄이 맨 fights12.mjs(고친 나무 · 안 고친 나무) 와 같은지. S=<작업 폴더> bash v3_samefight.sh
: "${S:?}"; R="$S/r30"
grep -v deprecated "$R/v1/base_fights12.txt" | sed '/^$/d' > "$R/v3/f_base.txt"
grep -v deprecated "$R/v1/judge_fights12.txt" | sed '/^$/d' > "$R/v3/f_judge.txt"
grep -v deprecated "$R/v3/log_fights12.txt" | sed '/^$/d' | tail -2 > "$R/v3/f_attached.txt"
{ cmp -s "$R/v3/f_base.txt" "$R/v3/f_attached.txt" && echo "맨 fights12(안 고친 나무) = 심판 붙인 fights12: 같음" || echo "다름"; cmp -s "$R/v3/f_judge.txt" "$R/v3/f_attached.txt" && echo "맨 fights12(고친 나무) = 심판 붙인 fights12: 같음" || echo "다름"; } > "$R/v3/samefight.txt"
cat "$R/v3/samefight.txt"
