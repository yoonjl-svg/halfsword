// 유파 막기 몸꼴 찾기 — 아무 유파 · 아무 줄 (10/16 23:3x 사장님 '우케나가시 탈류 쳐내기 개발해'). 읽기만 — 판 값은 바꾸지 않는다.
//  yoryak_search.mjs(요략세)를 넓힌 것: 플레이어(그 유파 무기 · 유파 막기 책)가 막기 단추를 버티고, AI normal 몸이 대본으로 공격들을 긋는다.
//  후보 몸꼴을 TRADITIONS[TR].parryCover[LINE] 에 잠깐 얹어 막음을 센다(판 값 SKILL.parryFollow 그대로 — 막기 따라가기 켬).
//  TR=<유파> WEAPON=<무기> LINE=<줄> ATTACKS=<기술·속임수 이름,…> RANGE=ukenagashi|talho (찾는 범위 — 아래)
//  ATKS=<치는 칼,…> GAPS=… SPEEDS=… N=<후보 수> SEED=<씨앗> TOP=<보일 수> OUT=<json> CANDS=<json — 이 후보만>
//  node tools/sim/cover_search.mjs
import { newRound, DT } from './harness_m.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { SKILL } from '../../src/config.js';
import { TECH, FEINTS } from '../../src/ai_techniques.js';
import { TRADITIONS } from '../../src/schools.js';
import { PlayerParryGuard } from '../../src/parry_button.js';

if (process.env.FOLLOW != null) SKILL.parryFollow = +process.env.FOLLOW;
const TR = process.env.TR ?? 'japanese';
const WEAPON = process.env.WEAPON ?? 'uchigatana';
const LINE = process.env.LINE ?? 'highL';
const ATKS = (process.env.ATKS ?? 'longsword,zweihander').split(',');
const GAPS = (process.env.GAPS ?? '1.3,1.5,1.7').split(',').map(Number);
const SPEEDS = (process.env.SPEEDS ?? '11').split(',').map(Number);
const N = +(process.env.N ?? 40);
const TOP = +(process.env.TOP ?? 12);
let seed = +(process.env.SEED ?? 1);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 4294967296);
const pick = (a, b) => a + (b - a) * rnd();
const r2 = (v) => Math.round(v * 100) / 100;
const byName = Object.fromEntries(TECH.map((t) => [t.name, t]));
const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
const ALL = [
  ...TECH.map((t) => ({ name: t.name, from: t.from, path: t.path })),
  ...FEINTS.map((f) => ({ name: f.name, from: byName[f.fake].from, path: [lerp(byName[f.fake].from, byName[f.fake].path[0], f.at), ...f.then] })),
];
const ATTACKS = (process.env.ATTACKS ?? 'zornhau').split(',').map((n) => ALL.find((a) => a.name === n)).filter(Boolean);
const sgn = LINE.endsWith('R') ? 1 : -1; // 가리는 쪽 (z: + = 칼 든 오른쪽)

// 찾는 범위 (원전 꼴을 해치지 않는 데서 — 수는 물리로 고른다)
//  ukenagashi: 검도형 소도 1·2본 「体を右に開き 右手 頭上·刃先 後ろ, 左鎬で受け流し」 — 손은 머리 위, 칼끝은 뒤(아래)로 비스듬히 지붕처럼, 몸을 연다
//  talho: 몬탄테 규칙 — 왼쪽으로 오는 칼을 탈류(오른 어깨에서 비스듬히 내려 베기)로 쳐내면 그 칼이 「머리 앞 왼쪽 둔각」에 멈춘다(복ⅩⅤ) — 손은 머리 앞 왼쪽, 칼은 비스듬히
const RANGES = {
  ukenagashi: () => ({
    hand: [r2(pick(0.0, 0.35)), r2(pick(0.25, 0.65)), r2(-sgn * pick(-0.35, 0.2))],
    blade: [Math.round(pick(-50, 25)), Math.round(sgn * pick(60, 180))],
  }),
  talho: () => ({
    hand: [r2(pick(0.1, 0.45)), r2(pick(-0.05, 0.5)), r2(sgn * pick(-0.15, 0.45))],
    blade: [Math.round(pick(-40, 60)), Math.round(sgn * pick(-30, 150))],
  }),
};
const RANGE = RANGES[process.env.RANGE ?? 'ukenagashi'];
function candidate() {
  return { ...RANGE(), pelvisYaw: Math.round(pick(-40, 40)), chestYaw: Math.round(pick(-50, 50)), pitch: Math.round(pick(0, 10)), drop: r2(pick(0, 0.1)) };
}

function trial(cover, atk, gap, speed, attack) {
  SKILL.parryAssist = 0;
  const Gm = newRound({ weapon: WEAPON, weapon2: atk, seed: 1, gap });
  const D = Gm.player, A = Gm.enemy;
  D.skill.corr = SKILL.corr;
  D.skill.corrTip = SKILL.corrTip;
  D.skill.autoGuard = true;
  const T = TRADITIONS[TR];
  const keep = Object.getOwnPropertyDescriptor(T, 'parryCover');
  if (cover) {
    const base = keep ? (keep.get ? keep.get.call(T) : keep.value) ?? {} : {};
    Object.defineProperty(T, 'parryCover', { value: { ...base, [LINE]: { name: '시험', pad: T.parry[LINE], ...cover } }, configurable: true, writable: true });
  }
  const guard = new PlayerParryGuard(D, A);
  if (cover) {
    if (keep) Object.defineProperty(T, 'parryCover', keep);
    else delete T.parryCover;
  }
  Gm.ai.update = () => {};
  A.move.set(0, 0);
  guard.held = true;
  const setPad = (x, y) => (A.handOffset.set(x, y), A.skill.aimRaw?.set?.(x, y));
  let cut = null, clash = null, ph = 0, t0 = 0, pts = null;
  const c0 = Gm.clashes;
  Gm.before = () => {
    guard.step(DT);
    D.inputActive = guard.active;
    const o = A.handOffset;
    const go = (tx, ty, sp) => {
      const dx = tx - o.x, dy = ty - o.y, dd = Math.hypot(dx, dy), st = sp * DT;
      if (dd > st) setPad(o.x + (dx / dd) * st, o.y + (dy / dd) * st);
      else return setPad(tx, ty), true;
      return false;
    };
    if (ph === 0 && Gm.t > 0.6) ph = 1;
    else if (ph === 1 && go(attack.from[0], attack.from[1], 3)) (ph = 2), (t0 = Gm.t);
    else if (ph === 2 && Gm.t - t0 > 0.15) (ph = 3), (pts = attack.path.map((p) => p.slice()));
    else if (ph === 3 && go(pts[0][0], pts[0][1], speed) && (pts.shift(), !pts.length)) (ph = 4), (t0 = Gm.t);
    if (clash == null && Gm.clashes > c0) clash = Gm.t;
    if (!cut && Gm.wounds.some((x) => x.vic === D && x.type !== 'blunt')) cut = Gm.t;
  };
  while (!(ph === 4 && Gm.t - t0 > 0.6) && Gm.t < 6) Gm.step();
  if (!cut && clash == null) return 'clear';
  return cut ? 'cut' : 'ok';
}

function score(cover) {
  let ok = 0, n = 0;
  const trials = [];
  for (const attack of ATTACKS) for (const atk of ATKS) for (const gap of GAPS) for (const sp of SPEEDS) {
    const w = trial(cover, atk, gap, sp, attack);
    trials.push([attack.name, atk, gap, sp, w]);
    if (w === 'clear') continue;
    n++;
    if (w === 'ok') ok++;
  }
  return { ok, n, trials };
}

const cands = process.env.CANDS ? JSON.parse(readFileSync(process.env.CANDS, 'utf8')) : [{ tag: '지금', cover: null }, ...Array.from({ length: N }, (_, i) => ({ tag: `c${i}`, cover: candidate() }))];
const res = cands.map((c) => ({ ...c, ...score(c.cover) }));
res.sort((a, b) => b.ok / Math.max(1, b.n) - a.ok / Math.max(1, a.n) || b.n - a.n);
for (const r of res.slice(0, TOP)) console.log(`${r.tag.padEnd(6)} ${r.ok}/${r.n} ${JSON.stringify(r.cover)}`);
const now = res.find((r) => r.tag === '지금');
if (now) console.log(`지금 ${now.ok}/${now.n}`);
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(res, null, 1));
