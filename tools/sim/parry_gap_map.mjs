// 막기 빈틈 지도 (10/16 20:2x 사장님 '빈틈부터 재 봐' — 유파 몸꼴 막기가 맡을 빈틈 찾기). 읽기만.
//  parry_assist_bench.mjs 와 같은 판: 막는 쪽 = 플레이어(이 무기 · 막기 버튼 버팀 — 처음부터 누름), 치는 쪽 = AI normal 몸이 대본으로
//  쉴 자세 0.6 s → 준비 자세(3 m/s) → 0.15 s 멈춤 → 길을 11 m/s 로 긋기 → 0.6 s 지켜봄. 간격 4 (1.35~1.80 m).
//  공격 = 기술 12 (TECH 모두) + 속임수 4 (FEINTS — ai.js 와 같이 가짜 길을 at 만큼 가다가 then 길로).
//  막는 쪽 꼴: 무기[:꼴] — 꼴 school(기본 · 2급 막기 책) · basic(책 없음 = 무유파 자리 · 덧씌우기 없음) · nocover(유파 자리 그대로, 몸꼴 덧씌우기만 뺌)
//  막음 = 칼날 상처 없음 + 칼끼리 닿음 · 베임 = 칼날 상처 · 둘 다 아님(간격 밖·스침)은 뺀다 (parry_assist_bench 와 같은 뜻)
//  FOLLOW=0|1 = 막기 따라가기 끄고 켜기(판 값 1) · ATK=<치는 무기>(기본 longsword) · GAPS=… · ATTACKS=이름,… · OUT=<json 경로>
//  node tools/sim/parry_gap_map.mjs longsword,rapier,zweihander,uchigatana,qinggang,qinggang:basic,qinggang:nocover
import { newRound, DT } from './harness_m.mjs';
import { writeFileSync } from 'node:fs';
import { SKILL } from '../../src/config.js';
import { TECH, FEINTS } from '../../src/ai_techniques.js';
import { TRADITIONS } from '../../src/schools.js';
import { NEW_TECH } from '../../src/frames.js';
import { PlayerParryGuard } from '../../src/parry_button.js';

const CONFIGS = (process.argv[2] ?? 'longsword').split(',').map((s) => {
  const [weapon, mode = 'school'] = s.split(':');
  return { weapon, mode, key: s };
});
if (process.env.FOLLOW != null) SKILL.parryFollow = +process.env.FOLLOW; // 막기 따라가기 (판 값 — 10/16 22:5x 부터 1, 0 = 그 전)
const ATK = process.env.ATK ?? 'longsword';
const GAPS = (process.env.GAPS ?? '1.35,1.5,1.65,1.8').split(',').map(Number);
const byName = Object.fromEntries(TECH.map((t) => [t.name, t]));
const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
const ALL = [
  ...TECH.map((t) => ({ name: t.name, kind: t.kind, from: t.from, path: t.path })),
  ...FEINTS.map((f) => {
    const t = byName[f.fake];
    return { name: f.name, kind: 'feint', from: t.from, path: [lerp(t.from, t.path[0], f.at), ...f.then] };
  }),
];
// UNIQUE=1 | 이름,… (10/16 23:0x 사장님 '고유 동작 넣어서 빈틈 다시 재 봐'): 유파 고유 동작(TRADITIONS.*.unique — 길 · 속임수) + 몸 틀 새 기술(frames.js NEW_TECH)을 더한다.
//  발 디딤(step — 옆 비킴 · 뛰어듦)은 대본이 움직이지 않으므로 칼 길만 같다(그 기술 숫자는 대략값). ONLY=1 이면 고유 동작만
const UNIQ = [];
if (process.env.UNIQUE) {
  const want = process.env.UNIQUE === '1' ? null : new Set(process.env.UNIQUE.split(','));
  const seen = new Set();
  const add = (t) => {
    if (!t?.name || seen.has(t.name) || (want && !want.has(t.name))) return;
    seen.add(t.name);
    UNIQ.push(t);
  };
  for (const tr of Object.values(TRADITIONS)) for (const u of tr.unique ?? []) {
    if (u.from && u.path) add({ name: u.name, kind: u.kind, from: u.from, path: u.path, step: !!u.step });
    else if (u.feint && byName[u.feint.fake]) {
      const t = byName[u.feint.fake];
      add({ name: u.name, kind: 'feint', from: t.from, path: [lerp(t.from, t.path[0], u.feint.at), ...u.feint.then] });
    }
  }
  for (const list of Object.values(NEW_TECH)) for (const t of list) if (t.from && t.path) add({ name: t.name, kind: t.kind, from: t.from, path: t.path });
}
const POOL = process.env.ONLY ? UNIQ : [...ALL, ...UNIQ];
const ATTACKS = process.env.ATTACKS ? process.env.ATTACKS.split(',').map((n) => POOL.find((a) => a.name === n)).filter(Boolean) : POOL;

function trial(cfg, atk, gap) {
  SKILL.parryAssist = 0; // 지금 판 값
  const Gm = newRound({ weapon: cfg.weapon, weapon2: ATK, seed: 1, gap });
  const D = Gm.player, A = Gm.enemy;
  D.skill.corr = SKILL.corr;
  D.skill.corrTip = SKILL.corrTip;
  D.skill.autoGuard = true;
  if (cfg.mode === 'basic') D.schoolParry = false;
  // nocover: 이 판의 유파 덧씌우기만 잠깐 뺀다 (지킴이를 만들 때 installCover 가 읽는다)
  const tr = D.swordArt?.tradition;
  const saved = cfg.mode === 'nocover' ? Object.getOwnPropertyDescriptor(TRADITIONS[tr], 'parryCover') : null;
  if (saved) Object.defineProperty(TRADITIONS[tr], 'parryCover', { value: null, configurable: true, writable: true });
  const guard = new PlayerParryGuard(D, A);
  if (saved) Object.defineProperty(TRADITIONS[tr], 'parryCover', saved);
  Gm.ai.update = () => {};
  A.move.set(0, 0);
  guard.held = true;
  const setPad = (x, y) => (A.handOffset.set(x, y), A.skill.aimRaw?.set?.(x, y));
  const r = { cut: null, clash: null, lines: new Set() };
  let ph = 0, t0 = 0, pts = null;
  const c0 = Gm.clashes;
  Gm.before = () => {
    guard.step(DT);
    D.inputActive = guard.active;
    if (guard.mode === 'defend' && guard.line) r.lines.add(guard.line);
    const o = A.handOffset;
    const go = (tx, ty, sp) => {
      const dx = tx - o.x, dy = ty - o.y, dd = Math.hypot(dx, dy), st = sp * DT;
      if (dd > st) setPad(o.x + (dx / dd) * st, o.y + (dy / dd) * st);
      else return setPad(tx, ty), true;
      return false;
    };
    if (ph === 0 && Gm.t > 0.6) ph = 1;
    else if (ph === 1 && go(atk.from[0], atk.from[1], 3)) (ph = 2), (t0 = Gm.t);
    else if (ph === 2 && Gm.t - t0 > 0.15) (ph = 3), (pts = atk.path.map((p) => p.slice()));
    else if (ph === 3 && go(pts[0][0], pts[0][1], 11) && (pts.shift(), !pts.length)) (ph = 4), (t0 = Gm.t);
    if (r.clash == null && Gm.clashes > c0) r.clash = Gm.t;
    if (!r.cut) {
      const w = Gm.wounds.find((x) => x.vic === D && x.type !== 'blunt');
      if (w) r.cut = { t: Gm.t, part: w.part ?? w.region ?? null };
    }
  };
  while (!(ph === 4 && Gm.t - t0 > 0.6) && Gm.t < 6) Gm.step();
  const lines = [...r.lines].join('>') || '-';
  if (!r.cut && r.clash == null) return { why: 'clear', lines };
  if (!r.cut) return { why: 'ok', lines };
  return { why: r.clash != null && r.clash < r.cut.t ? 'pushed' : 'cut', lines, part: r.cut.part };
}

const out = { atk: ATK, gaps: GAPS, configs: {} };
for (const cfg of CONFIGS) {
  const rows = {};
  for (const atk of ATTACKS) rows[atk.name] = GAPS.map((g) => trial(cfg, atk, g));
  out.configs[cfg.key] = rows;
  let ok = 0, n = 0;
  const cells = [];
  for (const [name, res] of Object.entries(rows)) {
    const v = res.filter((x) => x.why !== 'clear');
    const k = v.filter((x) => x.why === 'ok').length;
    ok += k;
    n += v.length;
    cells.push(`${name} ${k}/${v.length}`);
  }
  console.log(`${cfg.key.padEnd(18)} 치는 칼 ${ATK.padEnd(10)} 막음 ${ok}/${n} = ${n ? Math.round((100 * ok) / n) : 0}% | ${cells.join(' · ')}`);
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
