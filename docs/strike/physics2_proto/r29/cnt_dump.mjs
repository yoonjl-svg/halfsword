// r29 재는 사본의 셈 적기: R29_CNT=<나옴.json> node --import file://<이 파일> tools/sim/fights12.mjs  (칸 ll_13_125_cnt 에서)
import { writeFileSync } from 'node:fs';
process.on('exit', () => { const c = globalThis.__llCnt; writeFileSync(process.env.R29_CNT, JSON.stringify(c ? Array.from(c.a) : null)); });
