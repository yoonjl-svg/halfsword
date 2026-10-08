// 중국 腰擊 쓰임 재기 (10/9) 곁 도구 — motion_lab duel 앞에 끼워 중국 유파 자료를 이 프로세스 안에서만 바꾼다 (src 는 그대로).
//  YW_GUARDS=sideR,sideL     중국 간 보는 자세에 더할 자리 (WATCH_GUARDS 9 곳 뒤에 붙임. 'only:이름,…' = 그 목록만). 'none' = src 그대로
//  YW_K=3                    腰擊(zwerch·zwerchL) 가중치 (src 값 대신)
//  YW_NEAR=pflugR|ochsR|langort  그 자리에서 시작하는 腰擊 길(yaojiNear)을 고유 동작으로 더함 · YW_NEAR_BASE=0.3
//  YW_CIJI_P=1.0             刺→擊 고리 패시브 확률
//  예: YW_GUARDS=sideR USED_ALL=1 node tools/sim/yaoji_wrap.mjs motion_lab.mjs duel qinggang 24 main
import { G, WATCH_GUARDS } from '../../src/ai_techniques.js';
import { SCHOOLS, TRADITIONS } from '../../src/schools.js';
const T = TRADITIONS.chinese;
const SIDE = { // 옆 자세 둘·옆 지킴 [추정]
  sideR: { name: 'sideR', pad: G.sideR, threat: 0.2, high: 0.4, low: 0.2 },
  sideL: { name: 'sideL', pad: G.sideL, threat: 0.2, high: 0.4, low: 0.2 },
  nebenR: { name: 'nebenR', pad: G.nebenR, threat: 0.1, high: 0.1, low: 0.6 },
};
if (process.env.YW_GUARDS && process.env.YW_GUARDS !== 'none') {
  let spec = process.env.YW_GUARDS;
  let list = WATCH_GUARDS;
  if (spec.startsWith('only:')) {
    list = [];
    spec = spec.slice(5);
  }
  const add = spec.split(',').map((n) => SIDE[n] ?? WATCH_GUARDS.find((g) => g.name === n));
  const guards = [...list, ...add];
  T.guards = guards;
  for (const s of Object.values(SCHOOLS)) if (s.tradition === 'chinese') s.guards = guards;
}
// YW_CALM=sideR,langort · YW_PRESSED=sideR: 물러날 때 겨누는 자세 (중국 지금 = 독일 calm pflugR·langort, pressed ochsR). 그 이름이 간 보는 자세 목록에 있어야 한다
if (process.env.YW_CALM || process.env.YW_PRESSED) {
  const w = { ...T.withdraw, ...(process.env.YW_CALM ? { calm: process.env.YW_CALM.split(',') } : {}), ...(process.env.YW_PRESSED ? { pressed: process.env.YW_PRESSED } : {}) };
  T.withdraw = w;
  for (const s of Object.values(SCHOOLS)) if (s.tradition === 'chinese') s.withdraw = w;
}
if (process.env.YW_K)T.techK = { '*': { ...T.techK['*'], zwerch: +process.env.YW_K, zwerchL: +process.env.YW_K } };
if (process.env.YW_NEAR) {
  const from = G[process.env.YW_NEAR];
  const base = +(process.env.YW_NEAR_BASE ?? 0.3);
  T.unique = [...T.unique, { name: 'yaojiNear', from, path: [[0.45, 0.06], [0.0, 0.1], G.sideL], open: 'UL', kind: 'cut', reach: 0, base }];
}
if (process.env.YW_CIJI_P) for (const p of T.passives) if (p.name === 'ciji') p.p = +process.env.YW_CIJI_P;
// YW_DIAG=1: 중국 쪽 pickTech 부름마다 (그때 자세 · why · 고른 기술 · 손에서 zwerch 시작까지 거리)를 세어 끝에 찍는다 — 난수를 건드리지 않는다
if (process.env.YW_DIAG === '1') {
  const { AI } = await import('../../src/ai.js');
  const { padDist } = await import('../../src/ai_techniques.js');
  const D = { guard: {}, why: {}, pick: {}, near: 0, n: 0 };
  const inc = (o, k) => (o[k] = (o[k] ?? 0) + 1);
  const orig = AI.prototype.pickTech;
  AI.prototype.pickTech = function (s, why, prefer) {
    const t = orig.call(this, s, why, prefer);
    if (this.school.tradition === 'chinese') {
      D.n++;
      inc(D.guard, this.guard?.name ?? '-');
      inc(D.why, why);
      inc(D.pick, `${why}:${t?.name}`);
      if (padDist([this.me.handOffset.x, this.me.handOffset.y], G.sideR) < 0.2) D.near++;
    }
    return t;
  };
  const fmt = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
  process.on('exit', () => console.log(`  [diag] pickTech ${D.n} · 손이 옆 자세 0.2 m 안 ${D.near}\n  자세: ${fmt(D.guard)}\n  why: ${fmt(D.why)}\n  고름: ${fmt(D.pick)}`));
}
const [script, ...rest] = process.argv.slice(2);
const { simPath } = await import('./is_main.mjs');
process.argv = [process.argv[0], simPath(script), ...rest];
await import(new URL('./' + script, import.meta.url));
