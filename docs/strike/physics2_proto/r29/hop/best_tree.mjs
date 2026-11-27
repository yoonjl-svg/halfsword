// r29 찾기 결과(jsonl)의 가장 좋은 줄 값을 얹은 나무를 만든다 (search_ll.mjs 의 evalSet 과 같은 꼴: config.js 끝에 RUN.<열쇠> = <값>; 줄을 붙임).
//  쓰는 법: node best_tree.mjs <es.jsonl> <바탕 나무> <새 나무>
import { readFileSync, appendFileSync, rmSync, mkdirSync, cpSync, symlinkSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
const [J, W, R] = process.argv.slice(2);
const rows = readFileSync(J, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).sort((a, b) => a.score - b.score);
const b = rows[0], first = rows.find((r) => r.i === 0);
rmSync(R, { recursive: true, force: true }); mkdirSync(R, { recursive: true });
cpSync(join(W, 'src'), join(R, 'src'), { recursive: true }); cpSync(join(W, 'tools'), join(R, 'tools'), { recursive: true });
symlinkSync(readlinkSync(join(W, 'node_modules')), join(R, 'node_modules'));
appendFileSync(join(R, 'src/config.js'), '\n' + Object.keys(b.p).map((k) => `RUN.${k} = ${+b.p[k].toPrecision(4)};`).join('\n') + '\n');
const show = (r) => `점수 ${r.score.toFixed(3)} · 안 넘어짐 ${r.m.stand}/${r.m.n} · 두 발 뜬 몫 ${r.m.fly} · 0.05 s 넘게 뜬 몫 ${r.m.f05} · 힘 최고 ${r.m.pk} (가장 큼 ${r.m.pkMax}) · 모터 ${r.m.mot} · 벌림 ${r.m.abd} · 무릎발목 ${r.m.kn} · 못 넘은 줄 ${r.m.fails}`;
console.log(`찾은 줄 ${rows.length} 개\n뛰기 값 그대로(첫 줄): ${first ? show(first) : '-'}\n가장 좋은 줄(i ${b.i}): ${show(b)}\n값: ${Object.keys(b.p).map((k) => k + ' ' + +b.p[k].toPrecision(4)).join(' · ')}`);
