// 요략세 새 몸꼴 찾기 (10/16 21:3x 사장님 '일단 요략세 먼저 효과적인 새로운 몸꼴로 디자인해'). 읽기만 — 판 값은 바꾸지 않는다.
//  원전: 무도 권2 p038/30 「撩掠勢者卽撩掠格也. 法能遮駕下殺 蔽左護右. 左脚左手長蛟分水勢」 · 그림 '칼을 낮게 앞으로 뻗음, 칼 수평'
//  → 찾는 범위 = 손 낮게(가슴 중심 아래) · 앞으로 · 칼은 수평 가까이(위아래 ±35°) · 칼끝은 가리는 쪽으로. 몸 돌림도 함께.
//  판: parry_gap_map 과 같음 — 플레이어(청강검 · 동방 막기 책)가 막기 단추를 버티고, AI normal 몸이 대본으로 올려 베기.
//  줄: SIDE=L → lowL 몸꼴(내 왼쪽 아래로 오는 올려 베기 unterhau) · SIDE=R → lowR 몸꼴(내 오른쪽 아래로 오는 unterhauL)
//  PA=<막기 거듦 단계 0~3> N=<후보 수> SEED=<씨앗> ATKS=longsword,zweihander GAPS=… SPEEDS=11 TOP=<보일 수> OUT=<json> CANDS=<json — 이 후보만 잼>
//  node tools/sim/yoryak_search.mjs
import { newRound, DT } from './harness_m.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { SKILL } from '../../src/config.js';
import { TECH } from '../../src/ai_techniques.js';
import { TRADITIONS } from '../../src/schools.js';
import { PlayerParryGuard } from '../../src/parry_button.js';

const SIDE = process.env.SIDE ?? 'L';
const LINE = SIDE === 'L' ? 'lowL' : 'lowR';
const ATTACK = TECH.find((t) => t.name === (process.env.ATTACK ?? (SIDE === 'L' ? 'unterhau' : 'unterhauL')));
const WEAPON = process.env.WEAPON ?? 'qinggang';
const ATKS = (process.env.ATKS ?? 'longsword,zweihander').split(',');
const GAPS = (process.env.GAPS ?? '1.35,1.5,1.65,1.8').split(',').map(Number);
const SPEEDS = (process.env.SPEEDS ?? '11').split(',').map(Number);
const N = +(process.env.N ?? 40);
const TOP = +(process.env.TOP ?? 12);
let seed = +(process.env.SEED ?? 1);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 4294967296);
const pick = (a, b) => a + (b - a) * rnd();
const r2 = (v) => Math.round(v * 100) / 100;

const BASE_COVER = { ...TRADITIONS.chinese.parryCover };
const BASE_PAD = TRADITIONS.chinese.parry[LINE];
const sgn = SIDE === 'L' ? -1 : 1; // 가리는 쪽 (z: + = 칼 든 오른쪽)

function candidate() {
  const el = pick(-35, 20);
  const az = sgn * pick(15, 115); // 칼끝이 가리는 쪽으로 15~115°
  return {
    hand: [r2(pick(0.15, 0.5)), r2(pick(-0.42, -0.05)), r2(pick(-0.3, 0.3))],
    blade: [Math.round(el), Math.round(az)],
    pelvisYaw: Math.round(pick(-30, 15)),
    chestYaw: Math.round(pick(-45, 15)),
    pitch: Math.round(pick(0, 10)),
    drop: r2(pick(0.03, 0.12)),
  };
}

function trial(cover, atk, gap, speed) {
  SKILL.parryAssist = +(process.env.PA ?? 0); // 막기 거듦 단계 (지금 판 0 — 2 = 일찍·다시 읽기)
  const Gm = newRound({ weapon: WEAPON, weapon2: atk, seed: 1, gap });
  const D = Gm.player, A = Gm.enemy;
  D.skill.corr = SKILL.corr;
  D.skill.corrTip = SKILL.corrTip;
  D.skill.autoGuard = true;
  const keepC = TRADITIONS.chinese.parryCover, keepP = TRADITIONS.chinese.parry;
  if (cover) {
    TRADITIONS.chinese.parryCover = { ...BASE_COVER, [LINE]: { name: '요략세 (시험)', pad: cover.pad ?? BASE_PAD, ...cover } };
    TRADITIONS.chinese.parry = { ...keepP, [LINE]: cover.pad ?? BASE_PAD };
  }
  const guard = new PlayerParryGuard(D, A);
  TRADITIONS.chinese.parryCover = keepC;
  TRADITIONS.chinese.parry = keepP;
  // padOf 는 판마다 꾸러미(S.parry)를 읽는다 — 시험 자리를 이 판 지킴이에만 둔다
  if (cover?.pad) {
    const po = guard.padOf.bind(guard);
    guard.padOf = (line) => (line === LINE ? cover.pad : po(line));
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
    else if (ph === 1 && go(ATTACK.from[0], ATTACK.from[1], 3)) (ph = 2), (t0 = Gm.t);
    else if (ph === 2 && Gm.t - t0 > 0.15) (ph = 3), (pts = ATTACK.path.map((p) => p.slice()));
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
  for (const atk of ATKS) for (const gap of GAPS) for (const sp of SPEEDS) {
    const w = trial(cover, atk, gap, sp);
    trials.push([atk, gap, sp, w]);
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
