cd $1
for g in "fights12.mjs" "live_battery.mjs" "finish_thrust.mjs 1 --stand"; do
 n=$(echo $g | cut -d' ' -f1 | sed 's/.mjs//')
 s=$(date +%s); nice -n 10 node tools/sim/$g 2>/dev/null > $2/out_$3_$n.txt; echo "$3 $n $(sha256sum $2/out_$3_$n.txt | cut -c1-8) $(( $(date +%s)-s ))s" >> $2/gates.log
done
