// 플레이어 막기 버튼 버팀 — 막음 성공률 · 실패 까닭 (10/12 — docs/strike/parry_assist_2026-10-12.md). 읽기만(게임 값을 바꾸지 않는다, 막기 거듦 단계만 고른다).
//  판: 플레이어(막는 쪽) = 이 무기를 들고 서서 막기 버튼을 누른 채 버팀(src/parry_button.js PlayerParryGuard — main.js 와 같은 자리, ai.update 뒤 player.step 앞).
//      발·손가락 입력 없음. 상대(치는 쪽) = 롱소드 AI normal (같은 공격자). 간격은 기본 시작 간격, 벽 있음.
//  한 공격 = AI 공격 시작(mode 'attack') → afterStrike 한 번.
//  막음(받아냄) = 그 공격에서 내 칼날 상처(벰·찌름) 없음 + 칼끼리 닿음 (kron_shape_2026-10-12 §4 '칼날 상처 없음'에 '내 칼로 받았다'를 더함).
//   베임 = 그 공격에서 내 칼날 상처가 났다. 성공률 = 받아냄 / (받아냄 + 베임).
//   칼날 상처도 칼 맞닿음도 없는 공격(헛침·멍·스침 — 버튼을 안 눌러도 ~75 % 가 이 꼴로 '안 다침')은 막기와 상관없어 뺀다. 버튼이 손을 못 쥔 공격(일어나는 중)도 뺀다.
//  실패 까닭 (첫 칼날 상처 때):
//   못읽음  — 이 공격에서 버튼이 줄을 한 번도 정하지 못했다(threatNow 가 잡기 전 — 기다림 자리에서 맞음)
//   늦음    — 줄은 정했으나 상처 전에 칼끼리 닿지 않았고, 상처 때 손·칼이 막기 자리에 못 갔다
//             (손 목표가 자리에서 0.06 넘게 떨어짐 · 또는 칼날이 서보 목표 방향에서 20° 넘게. 손 몸–손 목표 거리는 한손 칼에서 늘 0.13~0.15 m 벌어져(팔 뻗음 끝) 잣대에서 뺐다 — CSV 에만)
//   밀림    — 상처 전에 칼끼리 닿았다(맞고 밀려 뚫림)
//   꼴      — 줄을 정했고 손·칼이 자리에 가 있는데 칼끼리 닿지 않고 맞았다(자리 꼴이 줄을 못 가림)
//  판은 SIM 초가 되거나 플레이어가 죽거나 칼을 놓치면(칼 든 팔 상처) 끝난다.
//  node tools/sim/parry_assist_probe.mjs <무기,…> [유파 덮어쓰기 german|italian|iberian|japanese|chinese|-] [초 30] [씨앗 1,2]
//    PA=<단계 0|1|2|3> (막기 거듦 — SKILL.parryAssist) · MODE=none(버튼 안 누름) · CSV=1 줄마다 공격 기록
//    REACT=<초> — 보고 누르기(미리 누르고 버티지 않음): AI 공격 시작(준비 포함) + REACT 초에 누르고 공격 끝 + 0.3 s 에 뗀다. 손은 쉴 자세에서 출발
//    SWING=<초> — 치고 막기: 내 베기 뒤 곧장 버튼(사람이 공격하고 막기로 돌아오는 장면). 따로 '베기 뒤 1 s 안에 시작된 AI 공격'만 센 줄을 낸다
//    FOE=<인물 id> — 상대를 그 인물로 (예: heinrich — 첫 무대 포세이돈의 짝, 사장님이 여정에서 처음 만나는 상대)
//    APPROACH=1 — 플레이어가 맞닿기 + 0.2 m 까지 걸어 든다(브라우저 parry_button_probe.mjs 대본과 같은 거리, 사람처럼 붙음). 없으면 서서 기다림
//  옆 줄 '맞음/막힘' = 브라우저 기록(player_parry_button §5)의 셈: ai.hitLanded(상대가 본 아픔 +0.05 — 멍 포함) · ai.bound(칼끼리 맞물리고 안 맞음)
import { newRound, DT } from './harness_m.mjs';
import * as THREE from '../../node_modules/three/build/three.module.js';
import { SKILL } from '../../src/config.js';
import { WEAPONS } from '../../src/weapons.js';
import { resolveSwordArt } from '../../src/sword_art.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { TECH } from '../../src/ai_techniques.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
const FOE = process.env.FOE ? CHARACTERS_BY_ID[process.env.FOE] : null; // 상대를 인물로 (main.js 여정 기본 foe=stage 와 같은 꾸림: 인물 무기·난이도·성격·겉모습). 없으면 롱소드 AI normal
const SW = ['zornhau', 'zornhauL'].map((n) => TECH.find((t) => t.name === n));

const ids = (process.argv[2] ?? 'longsword').split(',');
const trad = process.argv[3] && !['-', '_'].includes(process.argv[3]) ? process.argv[3] : null;
const SIM = +(process.argv[4] ?? 30);
const SEEDS = (process.argv[5] ?? '1,2').split(',').map(Number);
const MODE = process.env.MODE ?? 'button';
const REACT = process.env.REACT != null ? +process.env.REACT : null; // 보고 누르기: 버튼을 미리 누르지 않고 AI 공격이 시작되고 REACT 초 뒤에 누름, 그 공격이 끝나고 0.3 s 뒤 뗌
const SWING = process.env.SWING != null ? +process.env.SWING : null; // 치고 막기: 맞닿기 + 0.4 m 안이면 SWING 초마다 한 번 내 베기(손가락 길 — 성난 베기 오른·왼 번갈아, 들기 4 m/s · 베기 9 m/s, 버튼 뗌) 뒤 곧장 버튼을 누르고 버팀
const RFROM = process.env.RFROM ?? 'attack'; // REACT 를 어디서 세나: 'attack' = AI 공격 시작(준비 자세 포함) · 'swing' = 칼이 실제로 날아오기 시작(threatNow 가 처음 잡은 때 — 버튼 안 눌러도 센다)
const APPROACH = !!+(process.env.APPROACH ?? 0);
if (process.env.PA != null) SKILL.parryAssist = +process.env.PA;

const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
function swordErr(P) {
  const r = P.sword.rotation();
  _q.set(r.x, r.y, r.z, r.w);
  _b.set(0, 1, 0).applyQuaternion(_q);
  const ang = Math.acos(Math.max(-1, Math.min(1, _b.dot(P.debug.aim)))) * (180 / Math.PI);
  const h = P.bodies.farmS.translation();
  const t = P.handTarget;
  return { ang, hand: Math.hypot(h.x - t.x, h.y - t.y, h.z - t.z) };
}

for (const id of ids) {
  const W = WEAPONS[id];
  const tot = { aft: { ok: 0, n: 0, late: 0, pushed: 0, noRead: 0, shape: 0 }, swings: 0, clear: 0, drop: 0, landed: 0, bound: 0, offWhy: {}, n: 0, contact: 0, ok: 0, noRead: 0, late: 0, pushed: 0, shape: 0, whiff: 0, off: 0, wounds: 0, rounds: 0, dead: 0, simT: 0, lines: {} };
  let massInfo = null;
  for (const seed of SEEDS) {
    const Gm = newRound(FOE ? { weapon: id, weapon2: FOE.weapon, seed, difficulty: FOE.ai.level, persona: FOE.ai.persona, look2: FOE.look } : { weapon: id, weapon2: 'longsword', seed });
    const P = Gm.player;
    if (trad) P.swordArt = resolveSwordArt({ ...W, school: trad }); // 같은 무기, 다른 유파의 막기 자리·몸꼴 (자세표·손 모양은 그 무기 것 그대로)
    massInfo ||= { m: P.swordProps?.m, I: P.swordIhand, tr: P.swordArt.tradition };
    // main.js newRound 의 플레이어 몫 (harness 는 넣지 않는다): 보정 v2 · 끝점 겨눔 끔 · 사람 손가락 칼(autoGuard — 날 세우기 앞당김·팔 뻗음·자세로 돌아가기가 플레이어 길) · 근접 밀치기
    P.skill.corr = SKILL.corr;
    P.skill.corrTip = SKILL.corrTip;
    P.skill.autoGuard = true;
    P.canShove = true;
    const guard = new PlayerParryGuard(P, Gm.enemy);
    guard.held = MODE === 'button' && REACT == null;
    let releaseAt = -1;
    let sw = null; // 지금 내 베기 { pts, ph }
    let swNext = 1.5;
    let swEnd = -9;
    let swK = 0;
    const ai = Gm.ai;
    let cur = null;
    const open = () => ({ aft: Gm.t - swEnd < 1.0 || !!sw, t0: Gm.t, w0: Gm.wounds.length, c0: Gm.clashes, thr0: guard.stats.threats, firstClash: null, cut: null, offAll: true, line: null });
    const contactD = P.swordArt.measure?.contact ?? 1.2;
    Gm.before = () => {
      if (APPROACH) P.move.set(0, P.alive && P.foeDistance() > contactD + 0.2 ? 1 : 0);
      if (SWING != null && P.alive && P.armed) {
        if (!sw && Gm.t >= swNext && P.foeDistance() < contactD + 0.4 && (P.state === 'stand' || P.state === 'kneel') && !P.skill.sec) {
          const T = SW[swK++ % 2];
          sw = { pts: [T.from.slice(), ...T.path.map((q) => q.slice())], ph: 0 };
          tot.swings++;
        }
        guard.held = !sw;
        if (sw) {
          const [tx, ty] = sw.pts[0];
          const o = P.handOffset;
          const dx = tx - o.x, dy = ty - o.y, dd = Math.hypot(dx, dy), st = (sw.ph ? 9 : 4) * DT;
          if (dd > st) (o.x += (dx / dd) * st), (o.y += (dy / dd) * st);
          else (o.x = tx), (o.y = ty), sw.pts.shift(), (sw.ph = 1);
          P.inputActive = true;
          if (!sw.pts.length) (sw = null), (swEnd = Gm.t), (swNext = Gm.t + SWING);
        }
      }
      if (cur && cur.tSw == null && guard.noThreat === 0) cur.tSw = Gm.t; // 지난 스텝에 위협을 처음 잡음
      if (REACT != null) guard.held = (!!cur && Gm.t - (RFROM === 'swing' ? cur.tSw ?? Infinity : cur.t0) >= REACT) || Gm.t < releaseAt;
      guard.step(DT);
      if (!sw) P.inputActive = guard.active; // main.js 는 프레임마다 손가락 움직임으로 다시 정한다 — 손가락이 없으니 버튼이 쥔 동안만
      if (ai.mode === 'attack' && !cur) cur = open();
      if (cur) {
        if (REACT != null ? P.armed && (P.state === 'stand' || P.state === 'kneel') : guard.active) cur.offAll = false;
        else cur.offWhy ||= `${P.state}${P.armed ? '' : '·칼없음'}${P.skill.sec ? '·비기' : ''}${P.skill.tap ? '·찌름' : ''}`;
        if (guard.mode === 'defend') cur.line ||= guard.line;
        if (cur.firstClash == null && Gm.clashes > cur.c0) cur.firstClash = Gm.t;
        if (!cur.cut) {
          const w = Gm.wounds.slice(cur.w0).find((x) => x.vic === P && x.type !== 'blunt');
          if (w) {
            const pad = guard.padOf(guard.line ?? 'point');
            const dOff = pad ? Math.hypot(P.handOffset.x - pad[0], P.handOffset.y - pad[1]) : 0;
            const se = swordErr(P);
            cur.cut = { t: Gm.t, read: guard.stats.threats > cur.thr0, clashed: cur.firstClash != null, dOff, ang: se.ang, hand: se.hand, mode: guard.mode, line: guard.line };
          }
        }
      }
    };
    const as0 = ai.afterStrike.bind(ai);
    ai.afterStrike = (d) => {
      if (cur) {
        const c = cur;
        cur = null;
        releaseAt = Gm.t + 0.3;
        tot.n++;
        const sword = Gm.clashes > c.c0 || ai.bound; // 칼끼리 닿음 (combat.js 칼–칼 맞닿음 · ai.checkBind 맞물림)
        let why = '';
        if (c.offAll && MODE === 'button') (tot.off++, (why = 'off'), (tot.offWhy[c.offWhy] = (tot.offWhy[c.offWhy] ?? 0) + 1));
        else if (!c.cut && !sword) (tot.clear++, (why = 'clear')); // 칼날 상처도 칼 맞닿음도 없음 — 헛침·멍·스침 (막기와 상관없이 안 다침)
        else {
          tot.contact++;
          const L = c.line ?? 'wait';
          const ln = (tot.lines[L] ||= { n: 0, ok: 0 });
          ln.n++;
          if (ai.hitLanded) tot.landed++;
          else if (ai.bound) tot.bound++;
          if (c.aft) tot.aft.n++;
          if (!c.cut) (tot.ok++, ln.ok++, (why = 'ok'), c.aft && tot.aft.ok++);
          else {
            const k = c.cut;
            if (!k.read) why = 'noRead';
            else if (k.clashed) why = 'pushed';
            else if (k.dOff > 0.06 || k.ang > 20) why = 'late';
            else why = 'shape';
            tot[why]++;
            if (c.aft) tot.aft[why]++;
          }
        }
        if (process.env.CSV) console.log(['row', id, seed, c.t0.toFixed(2), why, c.line ?? '-', c.cut ? [c.cut.dOff.toFixed(2), c.cut.ang.toFixed(0), c.cut.hand.toFixed(2), c.cut.line].join(' ') : ''].join(','));
      }
      return as0(d);
    };
    while (Gm.t < SIM && P.alive && P.armed) Gm.step(); // 칼을 놓치면(칼 든 팔 상처 — fighter.dropSword) 막기 버튼이 할 일이 없다 → 판 끝
    if (P.alive && !P.armed) tot.drop++;
    tot.rounds++;
    tot.simT += Gm.t;
    if (!P.alive) tot.dead++;
    tot.wounds += Gm.wounds.filter((x) => x.vic === P && x.type !== 'blunt').length;
  }
  const p = tot.contact ? tot.ok / tot.contact : 0;
  const z = 1.96, n = tot.contact;
  const lo = n ? (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n) : 0;
  const hi = n ? (p + (z * z) / (2 * n) + z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n) : 0;
  const lines = Object.entries(tot.lines).map(([k, v]) => `${k} ${v.ok}/${v.n}`).join(' · ');
  console.log(
    `${id.padEnd(10)} ${massInfo.tr.padEnd(8)} m ${(+massInfo.m || 0).toFixed(2)} kg I ${(+massInfo.I || 0).toFixed(3)} | PA ${SKILL.parryAssist ?? 0} ${MODE}${REACT != null ? ` 보고누름 ${RFROM === 'swing' ? '칼 날아옴' : '공격 시작'}+${REACT}s` : " 버팀"}${APPROACH ? " 붙음" : ""}${FOE ? ` 상대 ${process.env.FOE}` : ''} | 공격 ${tot.n} 받아냄+베임 ${tot.contact} 받아냄 ${tot.ok} = ${(100 * p).toFixed(0)}% [${(100 * lo).toFixed(0)}–${(100 * hi).toFixed(0)}] | ` +
      `못읽음 ${tot.noRead} 늦음 ${tot.late} 밀림 ${tot.pushed} 꼴 ${tot.shape} | 안다침(칼 안 닿음) ${tot.clear} 버튼못쥠 ${tot.off} | 칼날상처 ${tot.wounds} / ${tot.simT.toFixed(0)} s · 죽음 ${tot.dead} 칼놓침 ${tot.drop} / ${tot.rounds} 판 | 맞음 ${tot.landed} 막힘 ${tot.bound} → 막힘/(맞음+막힘) ${((100 * tot.bound) / Math.max(1, tot.landed + tot.bound)).toFixed(0)}% | 못쥔 까닭 ${JSON.stringify(tot.offWhy)} | ${lines}${SWING != null ? ` | 내 베기 ${tot.swings} · 베기 뒤 1 s 안 AI 공격: 받아냄 ${tot.aft.ok}/${tot.aft.n} (못읽음 ${tot.aft.noRead} 늦음 ${tot.aft.late} 밀림 ${tot.aft.pushed} 꼴 ${tot.aft.shape})` : ''}`,
  );
}
