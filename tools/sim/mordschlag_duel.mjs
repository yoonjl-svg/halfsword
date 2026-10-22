// 독일 죽음의 일격 (모르트슐라크) 사람 손맛 측정 — docs/strike/german_mordschlag_2026-10-22.md §5
//  노리는 사람 플레이어를 흉내 낸 운전: 상대에게 걸어 붙어(가슴 거리 CLOSE.reach 안) 스틱을 잠깐 놓았다가 앞으로 밀고 버팀(밀치기 누르기) —
//  누르기가 끊기면 다시 놓았다 밂 · 떨어지면 다시 걸어 붙음. 비기 창(PlayerSecretWatch — main.js 와 같은 조건 함수)이 열리면 사람 반응 지연(0.12~0.30 s) 뒤
//  공격 입력 하나 → 죽음의 일격(main.js 와 같은 fire → skill.secret). 칼은 그 밖엔 쟁기 자세에 둔다(다른 공격 없음 · 막기 단추 없음).
//  상대 = 인물 AI(인물표 숙련도 · 성격 · 차림 그대로). 판 30 s (먼저 죽으면 끝).
//  센다(판당): 누르기가 PRESS 초 이어진 수(창) · 창 · 낸 수 · 맞힘(상대 아픔 +0.05 — 비기 눈) · 칼자루가 머리 · 목에 · 막혔는데 넘어 들어감(내리치는 동안 내 칼이 상대 칼에 닿은 뒤 머리 · 목 맞음) ·
//   막힘(상대 칼에 닿고 머리 · 목 맞음 없음) · 넘어짐(일격 뒤 1.5 s 안 상대 무릎 꿇음 · 일어나기 · 쓰러짐) · 비틀거림(같은 창 안 넘어지진 않았으나 발 디딤을 잃기 시작함 — offBalanceTime > 0) ·
//   일격이 준 피해(심각도 합 · 둔타 에너지 합) · 가장 긴 누르기 · 판 결과.
//  실행: node tools/sim/mordschlag_duel.mjs [플레이어 무기=longsword] [누르기 초=1.5] [판 수=3]
//   환경 변수: FOES=german,italian,iberian,japanese,chinese(유파별 첫 인물 — 인물표 차례) · MORD_JSON='{"tech":"zornhau"}' · OVER=1 · GRIP=hilt · DUR=30 · JSON=1(판마다 한 줄)
import { newRound, DT } from './harness_m.mjs';
import { SECRET, CLOSE, SKILL } from '../../src/config.js';
import { CHARACTERS } from '../../src/characters.js';
import { WEAPONS } from '../../src/weapons.js';
import { traditionOf } from '../../src/schools.js';
import { PlayerSecretWatch } from '../../src/secret.js';

const W = process.argv[2] || 'longsword';
const PRESS = +(process.argv[3] || 1.5);
const N = +(process.argv[4] || 3);
const DUR = +(process.env.DUR || 30);
const FOES = (process.env.FOES || 'german,italian,iberian,japanese,chinese').split(',');
SECRET.mordPress = PRESS;
if (!SECRET.openSchools.includes('german')) SECRET.openSchools = [...SECRET.openSchools, 'german'];
if (process.env.MORD_JSON) Object.assign(SECRET.mord, JSON.parse(process.env.MORD_JSON));
if (process.env.OVER) SECRET.mordOver = 1;
if (process.env.GRIP) SECRET.mord.grip = process.env.GRIP;
const REL = 0.1; // 스틱을 놓는 시간 (엄지 한 번 — shove_check 와 같은 시험 값)
const foeOf = (school) => CHARACTERS.find((c) => traditionOf(WEAPONS[c.weapon] ?? {}) === school);
const sum = {};
const out = [];
const hitsAll = [];
for (const school of FOES) {
  const ch = foeOf(school);
  if (!ch) continue;
  for (let s = 0; s < N; s++) {
    const seed = 4100 + s * 17;
    const G = newRound({ seed, weapon: W, weapon2: ch.weapon, difficulty: ch.ai.level, persona: ch.ai.persona, look2: ch.look, revive: ch.revive, walls: true });
    const P = G.player, E = G.enemy;
    P.skill.corr = SKILL.corr; P.skill.corrTip = SKILL.corrTip; P.skill.autoGuard = true; P.canShove = true;
    const watch = new PlayerSecretWatch(P, E);
    let rs = (seed * 2654435761) >>> 0;
    const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
    const r = { foe: ch.name, school, seed, windows: 0, fired: 0, landed: 0, hiltHead: 0, bladeHead: 0, over: 0, blocked: 0, falls: 0, stagger: 0, sev: 0, bluntJ: 0, maxPress: 0, presses: 0, end: '' };
    let phase = 'approach', tRel = 0, fireAt = null, run = null, lastBarge = null;
    G.combat.hooks.onWound = (att, vic, w, pt, pr) => {
      if (att !== P || !run) return;
      run.sev += w.severity ?? 0;
      if (w.type === 'blunt') run.bluntJ += w.energy;
      // 맞은 자리의 칼 축 높이 (칼 원점 = 원래 쥔 손 · 코등이 ≈ hiltLength · 거꾸로 쥔 손 = mordGrip.g)
      const sw = P.sword, q = sw.rotation(), t0 = sw.translation();
      const ax = { x: 2 * (q.x * q.y - q.w * q.z), y: 1 - 2 * (q.x * q.x + q.z * q.z), z: 2 * (q.y * q.z + q.w * q.x) };
      const ly = (pt.x - t0.x) * ax.x + (pt.y - t0.y) * ax.y + (pt.z - t0.z) * ax.z;
      run.ys.push(+ly.toFixed(2));
      hitsAll.push({ zone: w.zone, type: w.type, E: Math.round(w.energy), y: +ly.toFixed(2), part: pr?.w?.part, st: P.skill.sec?.stage ?? 'after' });
      if (w.zone === 'head' || w.zone === 'neck') {
        run.headHit = true;
        if (pr?.w?.part === 'hilt' || ly < P.weaponCfg.hiltLength + 0.12) r.hiltHead++; // 칼자루 · 코등이 바로 위 칼날(코등이 + 12 cm 안)
        else r.bladeHead++;
      }
    };
    G.before = () => {
      const t = G.t;
      watch.update(DT, !!P.skill.sec);
      if (P.barge?.phase === 'press' && lastBarge !== P.barge) { r.presses++; lastBarge = P.barge; }
      // 창 → 반응 지연 뒤 공격 입력 (main.js: 창이 열려 있고 비기 실행 중이 아니면 fire → skill.secret)
      if (watch.open && fireAt == null) fireAt = t + 0.12 + 0.18 * rnd();
      if (!watch.open) fireAt = null;
      if (fireAt != null && t >= fireAt && watch.open && !P.skill.sec && P.alive) {
        const o = watch.fire();
        fireAt = null;
        if (o && P.skill.secret(o)) {
          r.fired++;
          run = { t0: t, sev: 0, bluntJ: 0, headHit: false, foeSword: false, landed: false, foeState0: E.state, ys: [] };
        }
      }
      // 스틱: 붙을 때까지 걷고, 안에서 놓았다 밀고 버틴다
      const d = P.foeDistance();
      const reach = CLOSE.reach(P.weapon);
      let y = 0;
      if (!P.alive || P.skill.sec?.stage === 'stiff') y = 0;
      else if (d > reach) { phase = 'approach'; y = 1; }
      else if (phase === 'approach' || (phase === 'push' && !P.barge && t > tRel + REL + 0.05)) { phase = 'release'; tRel = t; y = 0; }
      else if (phase === 'release') { y = 0; if (t >= tRel + REL) phase = 'push'; }
      else y = 1;
      P.move.set(0, y); P.stickX = 0; P.stickY = y;
      if (!P.skill.sec) { P.handOffset.x += (SKILL.homeGuard[0] - P.handOffset.x) * 0.1; P.handOffset.y += (SKILL.homeGuard[1] - P.handOffset.y) * 0.1; }
    };
    let end = DUR, prevE = E.state;
    for (let i = 0; i < DUR / DT; i++) {
      G.step();
      // 일격 하나의 셈 (실행 중 · 끝난 뒤 1.5 s 넘어짐 창)
      if (run) {
        const live = !!P.skill.sec;
        if (live && (P.skill.sec.stage === 'strike' || P.skill.sec.stage === 'follow')) {
          for (const ec of E.swordColliders) for (const sc of P.swordColliders) G.world.contactPair(ec, sc, (m) => { if (m.numContacts() > 0 && !run.headHit) run.foeSword = true; });
        }
        if (live && P.skill.sec.landed) run.landed = true;
        if (['getup', 'down', 'kneel'].includes(E.state) && prevE === 'stand' && !run.fell) run.fell = true;
        if ((E.offBalanceTime ?? 0) > 0) run.stag = true; // 발 디딤을 잃기 시작함 (offBalance > BALANCE.fallRange — 넘어짐 셈이 도는 중)
        if (!live && run.tEnd == null) run.tEnd = G.t;
        if (run.tEnd != null && G.t > run.tEnd + 1.5) {
          if (run.landed) r.landed++;
          if (run.foeSword && run.headHit) r.over++;
          else if (run.foeSword) r.blocked++;
          if (run.fell) r.falls++;
          else if (run.stag) r.stagger++;
          r.sev += run.sev; r.bluntJ += run.bluntJ;
          run = null;
        }
      }
      prevE = E.state;
      if ((!P.alive || !E.alive) && end === DUR) end = G.t + 0.5;
      if (G.t >= end) break;
    }
    if (run) { if (run.landed) r.landed++; if (run.foeSword && run.headHit) r.over++; else if (run.foeSword) r.blocked++; if (run.fell) r.falls++; r.sev += run.sev; r.bluntJ += run.bluntJ; }
    r.windows = watch.opened;
    r.maxPress = +(watch.pressMax ?? 0).toFixed(2);
    r.end = `${P.alive ? 'P' : 'p'}${E.alive ? 'E' : 'e'}@${G.t.toFixed(0)}`;
    r.sev = +r.sev.toFixed(2); r.bluntJ = Math.round(r.bluntJ);
    out.push(r);
    if (process.env.JSON) console.log(JSON.stringify(r));
    const S = (sum[school] ??= { foe: ch.name, n: 0, presses: 0, windows: 0, fired: 0, landed: 0, hiltHead: 0, bladeHead: 0, over: 0, blocked: 0, falls: 0, stagger: 0, sev: 0, bluntJ: 0, maxPress: 0, pDead: 0, eDead: 0 });
    S.n++;
    for (const k of ['presses', 'windows', 'fired', 'landed', 'hiltHead', 'bladeHead', 'over', 'blocked', 'falls', 'stagger', 'sev', 'bluntJ']) S[k] += r[k];
    S.maxPress = Math.max(S.maxPress, r.maxPress);
    S.pDead += P.alive ? 0 : 1; S.eDead += E.alive ? 0 : 1;
    G.world.free?.();
  }
}
console.log(`무기 ${W} · 누르기 ${PRESS} s · 판 ${N} × ${DUR} s · 판 ${SECRET.mord.grip} · 기술 ${SECRET.mord.tech} · 넘어 들어감 ${SECRET.mordOver ? '켬' : '끔'}`);
if (process.env.HITS) console.log(JSON.stringify(hitsAll));
console.log('상대 | 판 | 누르기 시작/판 | 창/판 | 낸 수/판 | 맞힘 | 칼자루·코등이 곁→머리·목 | 칼날→머리·목 | 막혔는데 넘어감 | 막힘 | 넘어짐 | 비틀거림 | 심각도 합/판 | 둔타 J/판 | 가장 긴 누르기 s | 죽음 나/상대');
for (const S of Object.values(sum)) {
  const f = (k) => (S[k] / S.n).toFixed(2);
  console.log(`${S.foe} | ${S.n} | ${f('presses')} | ${f('windows')} | ${f('fired')} | ${S.landed} | ${S.hiltHead} | ${S.bladeHead} | ${S.over} | ${S.blocked} | ${S.falls} | ${S.stagger} | ${f('sev')} | ${f('bluntJ')} | ${S.maxPress} | ${S.pDead}/${S.eDead}`);
}
