// ─────────────────────────────────────────────────────────────
//  italian_measure.mjs — 이탈리아 무기 간격을 왜 생성기가 못 재나 · 게임 안 거리는 어떤가 · 찌르기 잣대 맞춰 봄 (10/25 — docs/strike/italian_measure_2026-10-25.md)
//   재기만 한다 (물리 · 판정 · AI 그대로). 팔 두 판 견줌은 `node tools/sim/with_config.mjs JOINTS.swivelHuman=0 JOINTS.wristPronate=0 italian_measure.mjs …`.
//
//   trace [무기 — 기본 rapier] : 생성기 대본(분노의 베기 0.35 s — weapon_measure.mjs measureSwing 과 같은 길 · 시작 정지 0)을 스텝마다 —
//        패드 · 손 목표 · 칼자루 앞 · 겨눔(교정 전 → 명령) · 손목 교정 각 · 팔꿈치 돌림 · 칼 방향 · 칼날 70 % 지점 높이 · 앞 거리 (* = 생성기가 세는 스텝)
//   aicut [무기…] : 그 무기 AI 가 제 기술(기본 zornhau — --tech=)을 그 자리에서 친다(헛스윙 연습 자리 · 상대 4.5 m 서 있음 · 걸음 없음 · 6 번) —
//        칼날 70 % 지점이 머리 높이를 내려 지날 때 가장 먼 앞 거리 · 칼끝이 몸 높이에서 간 가장 먼 앞 거리 · 70 % 지점이 가장 높이 간 곳(가운데 값) — 게임 안 AI 베기
//   sweep [무기…] : 생성기 대본 분노의 베기를 휘두르는 시간만 바꿔(--st=0.15,0.2,0.25,0.35) — 롱소드 1.62 보정 contact (−∞ = 70 % 지점이 머리 높이를 내려 지나지 않음).
//        이탈리아 무기만 띠에 걸리느냐가 시간 · 팔 판에 따라 갈림을 보임
//   check [무기…] : 찌르기 잣대(weapon_measure.mjs measureThrust)를 무기마다 — 70 % 지점 · 칼끝 비율을 롱소드 손 값 1.57 에 붙인 값과 손 표 contact 를 견줌
//        (기본: 분노의 베기 잣대가 그대로 재는 한손 무기 · 에스톡 + 이탈리아 무기)
// ─────────────────────────────────────────────────────────────
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { MEASURED } from '../../src/weapon_measured.js';
import { WEAPONS } from '../../src/weapons.js';
import { traditionOf } from '../../src/schools.js';
import { measureThrust, measureSwing } from './weapon_measure.mjs';

CONFIG.ARENA.startHold = 0; // 생성기 실행과 같은 조건
const args = process.argv.slice(2);
const mode = args[0] ?? 'check';
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const ids = args.slice(1).filter((a) => !a.startsWith('--'));
const f2 = (v) => (Number.isFinite(v) ? (v >= 0 ? ' ' : '') + v.toFixed(2) : '   -');
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const ARM = `swivelHuman ${CONFIG.JOINTS.swivelHuman} · wristPronate ${CONFIG.JOINTS.wristPronate}`;

if (mode === 'trace') {
  const wid = ids[0] ?? 'rapier';
  const T = TECH_BY_NAME.zornhau;
  const path = [T.from, ...T.path];
  const G = newRound({ weapon: wid, weapon2: wid, seed: 1 });
  G.park();
  const P = G.player;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  let phase = 'chamber', pt = 0, sc = null, sf = null, prevY = null;
  console.log(`대본 분노의 베기 · ${wid} · ${ARM} — 3 스텝마다`);
  console.log('t s | 패드 | 손 목표 [앞, 위, 옆] | 칼자루 앞 · 높이 | 겨눔 위 몫 교정 전 → 명령 | 손목 교정 ° | 팔꿈치 돌림 ° | 칼 위 몫 · 앞 몫 | 70 % 높이 · 앞');
  for (let i = 0; i < 1.0 / DT; i++) {
    pt += DT;
    if (phase === 'chamber') {
      P.handOffset.set(T.from[0], T.from[1]);
      if (pt > 0.5) { phase = 'swing'; pt = 0; const c = P.bodies.chest.translation(); sc = { x: c.x, z: c.z }; const f = P.forward(); sf = { x: f.x, z: f.z }; prevY = null; }
    } else {
      const u = Math.min(1, pt / 0.35);
      const seg = u < 0.5 ? [path[0], path[1], u * 2] : [path[1], path[2], (u - 0.5) * 2];
      P.handOffset.set(...lerp(...seg));
    }
    G.step();
    if (phase !== 'swing') continue;
    const p = P.bladePoint(0.7), tip = P.bladePoint(1), hilt = P.bladePoint(0);
    const falling = prevY == null || p.y < prevY;
    prevY = p.y;
    if (Math.round(pt / DT) % 3) continue;
    const fw = (v) => (v.x - sc.x) * sf.x + (v.z - sc.z) * sf.z;
    const bl = Math.hypot(tip.x - hilt.x, tip.y - hilt.y, tip.z - hilt.z);
    const sk = P.skill.aim;
    const star = p.y > 1.45 && p.y < 1.75 && falling ? ' *' : '';
    console.log(`${pt.toFixed(3)} | ${f2(sk.x)},${f2(sk.y)} | ${P.handBase.map(f2).join(',')} | ${f2(fw(hilt))} · ${f2(hilt.y)} | ${f2(P.aimRawW.y)} → ${f2(P.aimDirW.y)} | ${f2(P.wristFixDeg || 0)} | ${f2((P.swivelTh || 0) * 57.2958)} | ${f2((tip.y - hilt.y) / bl)} · ${f2(((tip.x - hilt.x) * sf.x + (tip.z - hilt.z) * sf.z) / bl)} | ${f2(p.y)} · ${f2(fw(p))}${star}`);
  }
} else if (mode === 'aicut') {
  const techs = opt('tech', 'zornhau').split(',');
  const N = +opt('n', 6);
  console.log(`AI 기술 그 자리에서 (상대 4.5 m 서 있음 · ${N} 번) · ${ARM}`);
  console.log('| 무기 | 기술 | 70 % 머리 높이 내려 지남 가장 먼 앞 (가운데 · 번마다) m | 칼끝 몸 높이 가장 먼 앞 m | 70 % 가장 높이 m |');
  console.log('|---|---|---|---|---|');
  for (const wid of ids.length ? ids : ['longsword', 'rapier', 'dartagnan', 'balisarda', 'sabre']) for (const tn of techs) {
    const G = newRound({ weapon: 'longsword', weapon2: wid, seed: 7, gap: 4.5 });
    const ai = G.ai, E = G.enemy;
    ai.drill = { out: () => true, dist: () => 4.5, due: () => false, fired() {}, feet: () => 0, atkFeet: () => 0 }; // 헛스윙 연습 자리 — 드릴이 공격을 안 냄(아래에서 냄) · 걸음 없음
    const res = [];
    let cur = null, t = 0, fired = 0, wait = 1.0, prevY = null;
    while ((fired < N || cur) && t < 60) {
      if (!cur && ai.mode !== 'attack' && (wait -= DT) <= 0 && ai.startAttack(ai.school.techByName[tn], 'drill', { noFeint: true, noPending: true, drill: true })) { fired++; cur = { on: false, p70: -Infinity, tip: -Infinity, top: -Infinity }; }
      G.step();
      t += DT;
      if (!cur) continue;
      if (!cur.on && ai.phase === 'strike') { const c = E.bodies.chest.translation(), f = E.forward(); cur.c = { x: c.x, z: c.z }; cur.f = { x: f.x, z: f.z }; cur.on = true; cur.t0 = t; prevY = null; }
      if (!cur.on) continue;
      const fw = (v) => (v.x - cur.c.x) * cur.f.x + (v.z - cur.c.z) * cur.f.z;
      const p = E.bladePoint(0.7), b = E.bladePoint(1);
      const falling = prevY == null || p.y < prevY;
      prevY = p.y;
      cur.top = Math.max(cur.top, p.y);
      if (p.y > 1.45 && p.y < 1.75 && falling) cur.p70 = Math.max(cur.p70, fw(p));
      if (b.y > 0 && b.y < 1.75) cur.tip = Math.max(cur.tip, fw(b));
      if (ai.mode !== 'attack' || t - cur.t0 > 1.2) { res.push(cur); cur = null; wait = 0.8; }
    }
    G.world.free();
    console.log(`| ${wid} | ${tn} | ${f2(med(res.map((r) => r.p70)))} (${res.map((r) => (Number.isFinite(r.p70) ? r.p70.toFixed(2) : '-')).join(' ')}) | ${f2(med(res.map((r) => r.tip)))} | ${f2(med(res.map((r) => r.top)))} |`);
  }
} else if (mode === 'sweep') {
  const sts = opt('st', '0.15,0.2,0.25,0.35').split(',').map(Number);
  const list = ids.length ? ids : ['sabre', 'falchion', 'qinggang', 'hwando', 'rapier', 'dartagnan', 'balisarda'];
  console.log(`대본 분노의 베기 휘두르는 시간 (생성기 --down · 롱소드 raw → 1.62) · ${ARM}`);
  console.log(`| 시간 s | 롱소드 raw | ${list.join(' | ')} |`);
  console.log(`|---|---|${list.map(() => '---').join('|')}|`);
  for (const st of sts) {
    const L = measureSwing('longsword', { down: true, swingTime: st }).raw;
    console.log(`| ${st} | ${L.toFixed(3)} | ${list.map((id) => { const r = measureSwing(id, { down: true, swingTime: st }).raw; return Number.isFinite(r) ? (r * 1.62 / L).toFixed(2) : '−∞'; }).join(' | ')} |`);
  }
} else if (mode === 'check') {
  const list = ids.length ? ids : ['sabre', 'falchion', 'qinggang', 'hwando', 'ganjiang', 'moye', 'sain', 'goujian', 'estoc', ...Object.keys(WEAPONS).filter((id) => traditionOf(WEAPONS[id]) === 'italian')];
  const L = measureThrust('longsword');
  const LS = MEASURED.longsword;
  console.log(`찌르기 잣대 (3번 자세 탭 찌르기 · 상대 3.4 m) · ${ARM} — 롱소드 70 % ${L.raw.toFixed(3)} · 칼끝 ${L.tip.toFixed(3)} m · ${L.cutTime.toFixed(3)} s`);
  console.log('| 무기 | 유파 | 손 표 contact | 70 % 지점 m → × 1.57 비 (손 표와 차) | 칼끝 m → × 1.57 비 (차) | 시간 s → 0.30 기준 |');
  console.log('|---|---|---|---|---|---|');
  for (const id of list) {
    const m = measureThrust(id);
    const h = MEASURED[id]?.[0];
    const a = LS[0] * (m.raw / L.raw), b = LS[0] * (m.tip / L.tip);
    const d = (x) => (h == null ? '' : ` (${x - h >= 0 ? '+' : ''}${(x - h).toFixed(2)})`);
    console.log(`| ${id} | ${traditionOf(WEAPONS[id])} | ${h ?? '-'} | ${m.raw.toFixed(3)} → ${a.toFixed(2)}${d(a)} | ${m.tip.toFixed(3)} → ${b.toFixed(2)}${d(b)} | ${m.cutTime.toFixed(3)} → ${(0.3 * (m.cutTime / L.cutTime)).toFixed(2)} |`);
  }
} else {
  console.error('mode: trace | aicut | sweep | check');
  process.exit(1);
}
