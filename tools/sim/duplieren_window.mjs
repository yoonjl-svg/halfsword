// 겹치기(G7 두플리렌) 창 재기 (사장님 10/31 14:xx '겹치기가 거의 쓸모가 없더라. 지금 커맨드가 부딪혔을 때 탭이었나? 나름 특수공격인데 가장 안 보이는 공격인 듯해.') — 재기만
//  special_balance.mjs fightRun('dupTap') 싸움(사람 손가락 봇 대 치고 막는 AI) 그대로 돌리며 사람 강화(PlayerUniqueAssist.drive — 물리 스텝마다)에서 셈:
//   · 칼끼리 닿음 덩이(bladeTouch — 몸이 느끼는 맞댐 · 칼날 선분 0.07 m 안): 덩이 수 · 길이 · 그때 가슴 사이 · 무엇이 닿았나(지금 칸 조건 = 내 베기가 맞물림 · 그 밖 = 상대 공격을 막음 · 칼이 걸쳐 있음 등)
//   · 지금 조건의 창(dup 조건이 참인 스텝 덩이): 수 · 길이 — 사람이 0.25 s 반응으로 탭하면 들어가나
//   · 낸 겹치기: 수 · 그때 가슴 사이 · 맞음 · 부위 · 끌고 간 칼 시간 · 칼끝 최고 빠르기 · 칼끝이 지난 길이(보이는 정도)
//  node tools/sim/duplieren_window.mjs [--opps=longsword,uchigatana,zweihander] [--seeds=901,902,903,904] [--json=파일]
import { writeFileSync } from 'node:fs';
import { THREE, CONFIG } from './harness_m.mjs';
import { fightRun } from './special_balance.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const OPPS = arg('opps', 'longsword,uchigatana,zweihander').split(',');
if (process.env.UA_SET) Object.assign(CONFIG.UNIQUE_ASSIST, JSON.parse(process.env.UA_SET)); // 시제품 견줌 (예 '{"dupGrace":0.4,"dupAny":1}') · 봇 반응은 SP_DUP_DELAY · SP_DUP_ANY (special_balance.mjs)
const SEEDS = arg('seeds', '901,902,903,904').split(',').map(Number);
const r3 = (x) => (Number.isFinite(x) ? +x.toFixed(3) : x);
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? r3(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : null; };

let S = null; // 지금 판의 셈
const drive0 = PlayerUniqueAssist.prototype.drive;
const tip = new THREE.Vector3();
PlayerUniqueAssist.prototype.drive = function (dt) {
  const r = drive0.call(this, dt);
  if (!S || !this.list.some((e) => e.tapKey === 'dup')) return r;
  const f = this.f;
  S.t += dt;
  const touch = this.bladeTouch();
  const rec = this.cur && !this.repos(this.cur) ? this.cur : this.prevAtk();
  const dupOk = !!(touch && rec && !rec.tap && rec.kind === 'cut' && rec.bound && !rec.dupSpent);
  // 닿음 덩이
  if (touch && !S.tc) S.tc = { t0: S.t, d0: f.foeDistance(), mineCut: !!(rec && !rec.tap && rec.kind === 'cut' && f.skill.swinging), foeAtk: f.foe?.aiControlled ? !!(f.foe.ai?.mode === 'attack') : false, guard: !!f.parryGuard?.held };
  if (!touch && S.tc) { S.touches.push({ ...S.tc, len: S.t - S.tc.t0 }); S.tc = null; }
  // 지금 조건 창 덩이
  if (dupOk && !S.wc) S.wc = { t0: S.t, d0: f.foeDistance(), busy: this.busy(true) };
  if (!dupOk && S.wc) { S.wins.push({ ...S.wc, len: S.t - S.wc.t0 }); S.wc = null; }
  // 낸 겹치기 (끌고 가는 칼)
  const art = f.iai && f.iai.tech === 'duplieren';
  if (art && !S.ac) S.ac = { t0: S.t, d0: f.foeDistance(), tipMax: 0, path: 0, prev: f.bladePoint(1, new THREE.Vector3()) };
  if (S.ac) {
    const p = f.bladePoint(1, tip);
    S.ac.path += p.distanceTo(S.ac.prev);
    S.ac.prev.copy(p);
    S.ac.tipMax = Math.max(S.ac.tipMax, f.tipVel?.length?.() ?? 0);
    if (!art && !(f.iaiHoldT > 0) && !(f.iaiFade > 0)) { S.arts.push({ d0: S.ac.d0, len: S.t - S.ac.t0, tipMax: S.ac.tipMax, path: S.ac.path }); S.ac = null; }
  }
  return r;
};

const runs = [];
for (const opp of OPPS) for (const seed of SEEDS) {
  S = { t: 0, touches: [], wins: [], arts: [], tc: null, wc: null, ac: null };
  const R = fightRun('dupTap', seed, opp, { variant: 'on', delay: 0.22, prof: 3, dur: 30 });
  const F = R.fires ?? [];
  runs.push({ opp, seed, t: S.t, touches: S.touches, wins: S.wins, arts: S.arts, fired: R.fired?.duplieren ?? 0, spHits: R.spHits ?? 0, spSev: R.spSev ?? 0, fires: F.map((x) => ({ dist0: x.dist0, hit: (x.hits ?? []).some((h) => h.sev > 0), zone: (x.hits ?? []).find((h) => h.sev > 0)?.zone ?? null, blocked: !!x.res?.blocked, gap: x.gap })) });
  console.log(opp, seed, JSON.stringify({ min: r3(S.t / 1.1 / 60), touches: S.touches.length, wins: S.wins.length, arts: S.arts.length }));
}
const T = runs.reduce((a, r) => a + r.t, 0) / 1.1 / 60; // 실제 분
const all = (k) => runs.flatMap((r) => r[k]);
const touches = all('touches'), wins = all('wins'), arts = all('arts');
const sum = {
  minutes: r3(T),
  touchPerMin: r3(touches.length / T), touchLenP50: q(touches.map((x) => x.len / 1.1), 0.5), touchLenP90: q(touches.map((x) => x.len / 1.1), 0.9),
  touchMineCut: touches.filter((x) => x.mineCut).length, touchFoeAtk: touches.filter((x) => x.foeAtk).length, touchD0p50: q(touches.map((x) => x.d0), 0.5),
  winPerMin: r3(wins.length / T), winLenP50: q(wins.map((x) => x.len / 1.1), 0.5), winLenP90: q(wins.map((x) => x.len / 1.1), 0.9), winOver025: wins.filter((x) => x.len / 1.1 >= 0.25).length, winD0p50: q(wins.map((x) => x.d0), 0.5), winBusy: wins.filter((x) => x.busy).length,
  artPerMin: r3(arts.length / T), artLenP50: q(arts.map((x) => x.len / 1.1), 0.5), artTipMaxP50: q(arts.map((x) => x.tipMax), 0.5), artPathP50: q(arts.map((x) => x.path), 0.5), artD0p50: q(arts.map((x) => x.d0), 0.5),
  touchesLongerThan025: touches.filter((x) => x.len / 1.1 >= 0.25).length,
  firedPerMin: r3(runs.reduce((a, r) => a + r.fired, 0) / T), fired: runs.reduce((a, r) => a + r.fired, 0),
  hitFires: runs.flatMap((r) => r.fires).filter((x) => x.hit).length, blockedFires: runs.flatMap((r) => r.fires).filter((x) => x.blocked).length,
  zones: runs.flatMap((r) => r.fires).filter((x) => x.zone).reduce((o, x) => ((o[x.zone] = (o[x.zone] ?? 0) + 1), o), {}),
  missGapP50: q(runs.flatMap((r) => r.fires).filter((x) => !x.hit).map((x) => x.gap), 0.5), fireD0p50: q(runs.flatMap((r) => r.fires).map((x) => x.dist0), 0.5),
  spSevPerMin: r3(runs.reduce((a, r) => a + r.spSev, 0) / T),
};
console.log(JSON.stringify(sum));
if (arg('json')) writeFileSync(arg('json'), JSON.stringify({ sum, runs }, null, 1));
