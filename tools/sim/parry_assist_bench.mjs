// 플레이어 막기 버튼 — 정해진 베기 받기 (10/12 — docs/strike/parry_assist_2026-10-12.md). 읽기만(막기 거듦 단계만 고른다).
//  parry_assist_probe.mjs(실제 싸움 — 판마다 흐름이 갈라져 띠가 넓다)를 돕는 짝: 같은 베기를 같은 자리에서 받아 전/후를 짝지어 본다.
//  막는 쪽 = 플레이어(main.js 의 플레이어 몫: 보정 v2 · autoGuard) — 이 무기를 들고 서서 막기 버튼(src/parry_button.js)을 누른다.
//  치는 쪽 = 롱소드(AI normal 몸) — AI 는 멈추고 손만 대본으로: 쉴 자세 0.6 s → 기술 준비 자세로 AI normal 준비 빠르기(chamberSpeed 3 m/s) → 0.15 s 멈춤 →
//            기술 길을 AI normal 베기 빠르기(strikeSpeed 11 m/s)로 긋기 → 0.6 s 지켜봄. 기술 8 (성난 베기 오·왼 · 정수리 · 가로 오·왼 · 올려 베기 오·왼 · 황소 찌르기) × 간격 4 (1.35~1.80 m).
//  누름: HOLD(기본) = 처음부터 누르고 버팀 · REACT=<초> = 긋기 시작 + 초에 누름(보고 누르기 — 0 이면 긋기와 같이).
//  막음 = 칼날 상처(벰·찌름) 없음 + 칼끼리 닿음 (parry_assist_probe 와 같은 뜻) · 베임 = 칼날 상처. 둘 다 아님(간격 밖·스침)은 뺀다.
//  실패 까닭: 못읽음(줄을 못 정함) · 늦음(손 목표가 자리에서 0.06 넘게 또는 칼이 서보 목표에서 20° 넘게) · 밀림(칼끼리 닿은 뒤 베임) · 꼴(자리에 가 있는데 칼이 안 닿고 베임)
//  PAV='{"powK":1.5,…}' = 거듦 값 덮어쓰기 · DEBUG=1 = 베인 판마다 한 줄
//  node tools/sim/parry_assist_bench.mjs <무기,…> [유파 덮어쓰기|-] [PA 단계들 0,1,2,3]
import { newRound, DT } from './harness_m.mjs';
import * as THREE from '../../node_modules/three/build/three.module.js';
import { SKILL } from '../../src/config.js';
import { WEAPONS } from '../../src/weapons.js';
import { resolveSwordArt } from '../../src/sword_art.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { TECH } from '../../src/ai_techniques.js';

if (process.env.PAV) Object.assign(SKILL.parryAssistVals, JSON.parse(process.env.PAV)); // 거듦 값 덮어쓰기 (재기 전용, 예: PAV='{"powK":1.5}')
const ids = (process.argv[2] ?? 'longsword').split(',');
const trad = process.argv[3] && !['-', '_'].includes(process.argv[3]) ? process.argv[3] : null;
const LEVELS = (process.argv[4] ?? '0').split(',').map(Number);
const REACT = process.env.REACT != null ? +process.env.REACT : null;
const GAPS = (process.env.GAPS ?? '1.35,1.5,1.65,1.8').split(',').map(Number);
const TECHS = (process.env.TECHS ?? 'zornhau,zornhauL,oberhau,zwerch,zwerchL,unterhau,unterhauL,stichOchs').split(',').map((n) => TECH.find((t) => t.name === n));
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();

function trial(id, tech, gap, level) {
  SKILL.parryAssist = level;
  const Gm = newRound({ weapon: id, weapon2: 'longsword', seed: 1, gap });
  const D = Gm.player, A = Gm.enemy;
  if (trad) D.swordArt = resolveSwordArt({ ...WEAPONS[id], school: trad });
  D.skill.corr = SKILL.corr;
  D.skill.corrTip = SKILL.corrTip;
  D.skill.autoGuard = true;
  Gm.ai.update = () => {};
  A.move.set(0, 0);
  const guard = new PlayerParryGuard(D, A);
  guard.held = REACT == null;
  const setPad = (x, y) => (A.handOffset.set(x, y), A.skill.aimRaw?.set?.(x, y));
  const r = { cut: null, clash: null, read: false };
  let ph = 0, t0 = 0, pts = null, strikeT = null;
  const c0 = Gm.clashes;
  Gm.before = () => {
    if (REACT != null && strikeT != null && Gm.t - strikeT >= REACT) guard.held = true;
    guard.step(DT);
    D.inputActive = guard.active;
    if (guard.mode === 'defend') r.read = true;
    const o = A.handOffset;
    const go = (tx, ty, sp) => {
      const dx = tx - o.x, dy = ty - o.y, dd = Math.hypot(dx, dy), st = sp * DT;
      if (dd > st) setPad(o.x + (dx / dd) * st, o.y + (dy / dd) * st);
      else return setPad(tx, ty), true;
      return false;
    };
    if (ph === 0 && Gm.t > 0.6) ph = 1;
    else if (ph === 1 && go(tech.from[0], tech.from[1], 3)) (ph = 2), (t0 = Gm.t);
    else if (ph === 2 && Gm.t - t0 > 0.15) (ph = 3), (pts = tech.path.map((p) => p.slice())), (strikeT = Gm.t);
    else if (ph === 3 && go(pts[0][0], pts[0][1], 11) && (pts.shift(), !pts.length)) (ph = 4), (t0 = Gm.t);
    if (r.clash == null && Gm.clashes > c0) r.clash = Gm.t;
    if (!r.cut) {
      const w = Gm.wounds.find((x) => x.vic === D && x.type !== 'blunt');
      if (w) {
        const pad = guard.padOf(guard.line ?? 'point');
        const rr = D.sword.rotation();
        _q.set(rr.x, rr.y, rr.z, rr.w);
        _b.set(0, 1, 0).applyQuaternion(_q);
        r.cut = { t: Gm.t, dOff: pad ? Math.hypot(D.handOffset.x - pad[0], D.handOffset.y - pad[1]) : 0, ang: Math.acos(Math.max(-1, Math.min(1, _b.dot(D.debug.aim)))) * (180 / Math.PI) };
      }
    }
  };
  while (!(ph === 4 && Gm.t - t0 > 0.6) && Gm.t < 5) Gm.step();
  if (process.env.DEBUG && r.cut) console.log('  ', tech.name, gap, 'L' + level, guard.line, 'dOff', r.cut.dOff.toFixed(2), 'ang', r.cut.ang.toFixed(0), 'clash', r.clash?.toFixed(2), 'cut', r.cut.t.toFixed(2), 'strike', strikeT?.toFixed(2));
  const sword = r.clash != null;
  if (!r.cut && !sword) return 'clear';
  if (!r.cut) return 'ok';
  if (!r.read) return 'noRead';
  if (r.clash != null && r.clash < r.cut.t) return 'pushed';
  if (r.cut.dOff > 0.06 || r.cut.ang > 20) return 'late';
  return 'shape';
}

for (const id of ids) {
  const per = {};
  for (const L of LEVELS) {
    const s = (per[L] = { ok: 0, noRead: 0, late: 0, pushed: 0, shape: 0, clear: 0, list: [] });
    for (const tech of TECHS) for (const gap of GAPS) {
      const why = trial(id, tech, gap, L);
      s[why]++;
      s.list.push(why);
    }
  }
  const tr = trad ?? resolveSwordArt(WEAPONS[id]).tradition;
  for (const L of LEVELS) {
    const s = per[L];
    const n = s.ok + s.noRead + s.late + s.pushed + s.shape;
    const p = n ? s.ok / n : 0;
    const z = 1.96;
    const lo = n ? (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n) : 0;
    const hi = n ? (p + (z * z) / (2 * n) + z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n) : 0;
    let gain = '';
    if (L !== LEVELS[0]) {
      const b = per[LEVELS[0]].list;
      let up = 0, down = 0;
      s.list.forEach((w, i) => { if (w === 'ok' && b[i] !== 'ok' && b[i] !== 'clear') up++; if (b[i] === 'ok' && w !== 'ok' && w !== 'clear') down++; });
      gain = ` | 짝 비교(단계 ${LEVELS[0]} 대비): 새로 막음 ${up} · 새로 베임 ${down}`;
    }
    console.log(`${id.padEnd(10)} ${tr.padEnd(8)} PA ${L} ${REACT == null ? '버팀' : `보고누름 +${REACT}s`} | 막음 ${s.ok}/${n} = ${(100 * p).toFixed(0)}% [${(100 * lo).toFixed(0)}–${(100 * hi).toFixed(0)}] | 못읽음 ${s.noRead} 늦음 ${s.late} 밀림 ${s.pushed} 꼴 ${s.shape} | 뺌(안 닿음) ${s.clear}${gain}`);
  }
}
