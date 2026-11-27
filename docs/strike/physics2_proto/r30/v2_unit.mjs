// r30 V2 (i): 잣대의 늘어나며 버티는 몫(legAllow)을 만든 벡터로 확인. node v2_unit.mjs <나무> <결과 파일>
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
const [root, outFile] = process.argv.slice(2);
const H = await import(pathToFileURL(join(root, 'tools/sim/honesty.mjs')).href);
const { legAllow, LEG_JUDGE, legJudgeCheck } = H;
const out = []; let all = true;
const ok = (name, c, s) => { all &&= c; out.push(`${c ? 'OK  ' : 'FAIL'} ${name} — ${s}`); };
const near = (a, b) => Math.abs(a - b) < 1e-12;
// tau = 먼 쪽이 받는 토크 · wRel = 자식 − 부모. 거슬러 돎 = wRel 이 tau 와 반대쪽
const tau = { x: 0, y: 0, z: 200 };
const W = (z) => ({ x: 0, y: 0, z });
ok('거슬러 1 rad/s', near(legAllow(tau, W(-1)).k, 1.3), `k ${legAllow(tau, W(-1)).k}`);
ok('거슬러 3 rad/s (넘쳐도 1.3)', near(legAllow(tau, W(-3)).k, 1.3), `k ${legAllow(tau, W(-3)).k}`);
ok('따라 1 rad/s', near(legAllow(tau, W(1)).k, 1), `k ${legAllow(tau, W(1)).k}`);
ok('따라 5 rad/s', near(legAllow(tau, W(5)).k, 1), `k ${legAllow(tau, W(5)).k}`);
const ramp = [0, 0.25, 0.5, 0.75].map((s) => legAllow(tau, W(-s)).k);
ok('사이는 곧게 (0 · 0.25 · 0.5 · 0.75)', ramp.every((k, i) => near(k, 1 + 0.3 * i * 0.25)), ramp.join(' · '));
const e = 1e-9;
ok('0 에서 이어짐', Math.abs(legAllow(tau, W(-e)).k - 1) < 1e-8 && near(legAllow(tau, W(e)).k, 1) && near(legAllow(tau, W(0)).k, 1), `${legAllow(tau, W(-e)).k} · ${legAllow(tau, W(0)).k} · ${legAllow(tau, W(e)).k}`);
ok('1 에서 이어짐', Math.abs(legAllow(tau, W(-1 + e)).k - 1.3) < 1e-8 && near(legAllow(tau, W(-1 - e)).k, 1.3), `${legAllow(tau, W(-1 + e)).k} · ${legAllow(tau, W(-1 - e)).k}`);
// 비스듬한 축: 토크 방향 몫만 본다 (수직 몫은 안 셈)
ok('토크와 수직인 빠르기는 0', near(legAllow(tau, { x: 4, y: -3, z: 0 }).k, 1), `k ${legAllow(tau, { x: 4, y: -3, z: 0 }).k}`);
const t2 = { x: 3, y: 0, z: 4 }; // 단위 (0.6, 0, 0.8)
ok('비스듬: 거슬러 0.5 rad/s 몫', near(legAllow(t2, { x: -0.3, y: 7, z: -0.4 }).k, 1.15), `wEcc ${legAllow(t2, { x: -0.3, y: 7, z: -0.4 }).wEcc.toFixed(6)} · k ${legAllow(t2, { x: -0.3, y: 7, z: -0.4 }).k}`);
ok('토크 크기와 무관', near(legAllow({ x: 0, y: 0, z: 1 }, W(-0.5)).k, legAllow({ x: 0, y: 0, z: 900 }, W(-0.5)).k), '1 N·m · 900 N·m 같음');
ok('토크 0 이면 1', near(legAllow({ x: 0, y: 0, z: 0 }, W(-2)).k, 1), 'k 1');
// 게임 규칙과 같은 꼴인가: legLimit(base, 1, wEcc) ÷ base 와 견줌 (몸이 쓰는 셈 · 같은 값일 때)
const LV = await import(pathToFileURL(join(root, 'src/legs_vmc.js')).href);
const ws = [-2, -1, -0.6, -0.1, 0, 0.1, 0.6, 1, 2];
const gameK = ws.map((w) => LV.legLimit(312.5, 1, w) / 312.5); // 게임: wEcc 를 바로 넘김 (+ = 늘어남)
const judgeK = ws.map((w) => legAllow(tau, W(-w)).k); // 잣대: 같은 늘어나는 빠르기를 tau 반대쪽 wRel 로
ok('게임 legLimit 과 같은 배율 (근력 1)', gameK.every((k, i) => Math.abs(k - judgeK[i]) < 1e-12), `게임 ${gameK.map((x) => x.toFixed(3)).join(' ')} · 잣대 ${judgeK.map((x) => x.toFixed(3)).join(' ')}`);
const chk = legJudgeCheck();
ok('config 견줌 (지금 나무)', chk.ok, chk.diffs.join(' · ') || '같음');
const fake = legJudgeCheck({ LEGS: { limit: { hipFlex: 250, kneeExt: 312.5, anklePlantar: 312.5 }, ecc: 1, eccW: 1 } });
ok('config 견줌 (다른 값이면 경고)', !fake.ok && fake.diffs.length === 2, fake.diffs.join(' · '));
out.push(`잣대 ${JSON.stringify(LEG_JUDGE)} · ${all ? '모두 통과' : '실패 있음'}`);
writeFileSync(outFile, out.join('\n') + '\n');
console.log(out.join('\n'));
