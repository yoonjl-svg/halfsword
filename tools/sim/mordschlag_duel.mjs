// 독일 죽음의 일격 (모르트슐라크) 사람 손맛 측정 — docs/strike/german_mordschlag_2026-10-22.md §5
//  노리는 사람 플레이어를 흉내 낸 운전: 상대에게 걸어 붙어(가슴 거리 CLOSE.reach 안) 스틱을 잠깐 놓았다가 앞으로 밀고 버팀(밀치기 누르기) —
//  누르기가 끊기면 다시 놓았다 밂 · 떨어지면 다시 걸어 붙음. 비기 창(PlayerSecretWatch — main.js 와 같은 조건 함수)이 열리면 사람 반응 지연(0.12~0.30 s) 뒤
//  공격 입력 하나 → 죽음의 일격(main.js 와 같은 fire → skill.secret). 칼은 그 밖엔 쟁기 자세에 둔다(다른 공격 없음 · 막기 단추 없음).
//  상대 = 인물 AI(인물표 숙련도 · 성격 · 차림 그대로). 판 30 s (먼저 죽으면 끝).
//  센다(판당): 누르기가 PRESS 초 이어진 수(창) · 창 · 낸 수 · 맞힘(상대 아픔 +0.05 — 비기 눈) · 칼자루가 머리 · 목에 · 막혔는데 넘어 들어감(내리치는 동안 내 칼이 상대 칼에 닿은 뒤 머리 · 목 맞음) ·
//   막힘(상대 칼에 닿고 머리 · 목 맞음 없음) · 넘어짐(일격 뒤 1.5 s 안 상대 무릎 꿇음 · 일어나기 · 쓰러짐) · 비틀거림(같은 창 안 넘어지진 않았으나 발 디딤을 잃기 시작함 — offBalanceTime > 0) ·
//   일격이 준 피해(심각도 합 · 둔타 에너지 합) · 가장 긴 누르기 · 판 결과.
//  실행: node tools/sim/mordschlag_duel.mjs [플레이어 무기=longsword] [누르기 초 — 없으면 SECRET.mordPress] [판 수=3]
//   10/25 23:3x: DRIVE=hold — 걸어 들어와 스틱을 앞으로 쥔 채 계속 밂(놓았다 밀지 않음 — 밀치기 걸쇠 CLOSE.latch 0 판 · 옛 판에선 밀치기가 안 남) · 끝에 합 줄(창 / 30 s · 낸 · 맞힘 · 막힘 · 헛침 · 낼 때 가슴 사이)
//    DRIVE=wobble — hold 와 같고 닿는 거리 안에서 1 s 마다 0.1 s 스틱이 가운데로 빠짐(엄지가 미끄러지는 사람 — 끊김 너그러움 SECRET.mordGrace 견줌)
//    DRIVE=reshove — hold 와 같고 닿는 거리 안에서 1 s 마다 0.1 s 스틱을 뒤로(떨어졌다 다시 밀치기 — 새 밀치기는 걸음 단계를 먼저 거침) · 합 줄에 누르기 끊김 틈(0.2 · 0.4 s 안 수 · p50)
//   환경 변수: FOES=german,italian,iberian,japanese,chinese(유파별 첫 인물 — 인물표 차례) · MORD_JSON='{"tech":"zornhau"}' · OVER=1 · GRIP=hilt · DUR=30 · JSON=1(판마다 한 줄)
//   10/22 밤 고칠 안 (문서 §11): MORD_JSON='{"kin":0.6,"aim":"pull","at":0.5,"power":"finish"}' · HELM=kettle|horned(상대 머리에 그 투구를 씌움 — ARMOR.helmets) ·
//    SUM=1(끝에 일격 하나하나의 셈 한 줄 JSON — 입력 → 굳음 끝 s · 머리 맞음 J(투구 배율 곱한 값) · 45 J 넘는 몫 · 넘어짐 · 비틀거림 · 기절 · 막힘)
import { newRound, DT } from './harness_m.mjs';
import { SECRET, CLOSE, SKILL, ARMOR } from '../../src/config.js';
import { CHARACTERS } from '../../src/characters.js';
import { WEAPONS } from '../../src/weapons.js';
import { traditionOf } from '../../src/schools.js';
import { PlayerSecretWatch } from '../../src/secret.js';

const W = process.argv[2] || 'longsword';
const PRESS = process.argv[3] ? +process.argv[3] : SECRET.mordPress;
const DRIVE = process.env.DRIVE || 'release';
const N = +(process.argv[4] || 3);
const DUR = +(process.env.DUR || 30);
const FOES = (process.env.FOES || 'german,italian,iberian,japanese,chinese').split(',');
SECRET.mordPress = PRESS;
if (!SECRET.openSchools.includes('german')) SECRET.openSchools = [...SECRET.openSchools, 'german'];
if (process.env.MORD_JSON) Object.assign(SECRET.mord, JSON.parse(process.env.MORD_JSON));
if (process.env.OVER) SECRET.mordOver = 1;
if (process.env.GRIP) SECRET.mord.grip = process.env.GRIP;
const HELM = process.env.HELM || null;
const REL = 0.1; // 스틱을 놓는 시간 (엄지 한 번 — shove_check 와 같은 시험 값)
const foeOf = (school) => CHARACTERS.find((c) => traditionOf(WEAPONS[c.weapon] ?? {}) === school);
const sum = {};
const out = [];
const hitsAll = [];
const fires = []; // 일격 하나하나 (SUM)
const fireD = []; // 낼 때 가슴 사이 (m)
const pressGaps = []; // 누르기 끊김 틈 (s — 다시 누른 것만)
let simT = 0;
for (const school of FOES) {
  const ch = foeOf(school);
  if (!ch) continue;
  for (let s = 0; s < N; s++) {
    const seed = 4100 + s * 17;
    const G = newRound({ seed, weapon: W, weapon2: ch.weapon, difficulty: ch.ai.level, persona: ch.ai.persona, look2: ch.look, revive: ch.revive, walls: true });
    const P = G.player, E = G.enemy;
    if (HELM) { E.hasHelmet = true; E.helmetType = HELM; E.helmetSpec = ARMOR.helmets[HELM]; E.helmetIntegrity = 1; } // 투구 상대 (판정만 — 겉모습은 그대로)
    P.skill.corr = SKILL.corr; P.skill.corrTip = SKILL.corrTip; P.skill.autoGuard = true; P.canShove = true;
    const watch = new PlayerSecretWatch(P, E);
    let rs = (seed * 2654435761) >>> 0;
    const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
    const r = { foe: ch.name, school, seed, windows: 0, fired: 0, landed: 0, hiltHead: 0, bladeHead: 0, over: 0, blocked: 0, falls: 0, stagger: 0, sev: 0, bluntJ: 0, maxPress: 0, presses: 0, end: '' };
    let phase = 'approach', tRel = 0, fireAt = null, run = null, lastBarge = null, wasPress = false, pressEnd = null;
    G.combat.hooks.onWound = (att, vic, w, pt, pr) => {
      if (att !== P || !run) return;
      run.sev += w.severity ?? 0;
      if (w.type === 'blunt') run.bluntJ += w.energy;
      run.hits.push({ zone: w.zone, type: w.type, E: Math.round(w.energy), k: w.helmet ? +w.helmetBlunt.toFixed(2) : 1, part: pr?.w?.part ?? null });
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
      // 누르기 끊김 틈 (10/27 — 끊긴 뒤 다시 누르기까지 · 비기 실행 · 굳음 동안 끊긴 것은 안 셈): 너그러움 SECRET.mordGrace 견줌
      const pr = P.barge?.phase === 'press';
      if (pr && !wasPress && pressEnd != null) pressGaps.push(t - pressEnd);
      if (!pr && wasPress) pressEnd = P.skill.sec ? null : t;
      wasPress = pr;
      // 창 → 반응 지연 뒤 공격 입력 (main.js: 창이 열려 있고 비기 실행 중이 아니면 fire → skill.secret)
      if (watch.open && fireAt == null) fireAt = t + 0.12 + 0.18 * rnd();
      if (!watch.open) fireAt = null;
      if (fireAt != null && t >= fireAt && watch.open && !P.skill.sec && P.alive) {
        const o = watch.fire();
        fireAt = null;
        if (o && P.skill.secret(o)) {
          r.fired++;
          fireD.push(P.foeDistance());
          run = { t0: t, sev: 0, bluntJ: 0, headHit: false, foeSword: false, landed: false, foeState0: E.state, ys: [], hits: [], ko: false };
        }
      }
      // 스틱: 붙을 때까지 걷고, 안에서 놓았다 밀고 버틴다
      const d = P.foeDistance();
      const reach = CLOSE.reach(P.weapon);
      let y = 0;
      if (!P.alive || P.skill.sec?.stage === 'stiff') y = 0;
      else if (DRIVE === 'hold') y = 1; // 쥔 채 계속 밂
      else if (DRIVE === 'reshove') y = d <= reach && t % 1.0 < 0.1 ? -1 : 1; // 닿는 거리 안에서 1 s 마다 0.1 s 스틱을 뒤로 — 떨어졌다 다시 밀치기 (운전 값 · 게임 값 아님)
      else if (DRIVE === 'wobble') y = d <= reach && t % 1.0 < 0.1 ? 0 : 1; // 쥔 채 밀다 닿는 거리 안에서 1 s 마다 0.1 s 엄지가 빠짐 (너그러움 mordGrace 견줌 — 운전 값 · 게임 값 아님)
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
        if (!E.alive || E.consciousness <= 0) run.ko = true; // 기절 · 죽음 (부활 몸은 다시 일어설 수 있다)
        if (!live && run.tEnd == null) {
          run.tEnd = G.t;
          const R = P.instantResult;
          if (R?.mord && R.blocked) run.foeSword = true; // 운동학 길: 상대 칼이 칼자루 길에 먼저 (secret_instant.js stepCombo 막힘)
        }
        if (run.tEnd != null && G.t > run.tEnd + 1.5) {
          if (run.landed) r.landed++;
          if (run.foeSword && run.headHit) r.over++;
          else if (run.foeSword) r.blocked++;
          if (run.fell) r.falls++;
          else if (run.stag) r.stagger++;
          r.sev += run.sev; r.bluntJ += run.bluntJ;
          fires.push({ foe: ch.name, dur: +(run.tEnd - run.t0).toFixed(3), hits: run.hits, fell: !!run.fell, stag: !run.fell && !!run.stag, blocked: run.foeSword && !run.headHit, ko: run.ko, landed: run.landed });
          run = null;
        }
      }
      prevE = E.state;
      if ((!P.alive || !E.alive) && end === DUR) end = G.t + 0.5;
      if (G.t >= end) break;
    }
    if (run) {
      if (run.landed) r.landed++; if (run.foeSword && run.headHit) r.over++; else if (run.foeSword) r.blocked++; if (run.fell) r.falls++; r.sev += run.sev; r.bluntJ += run.bluntJ;
      fires.push({ foe: ch.name, dur: run.tEnd != null ? +(run.tEnd - run.t0).toFixed(3) : null, hits: run.hits, fell: !!run.fell, stag: !run.fell && !!run.stag, blocked: run.foeSword && !run.headHit, ko: run.ko, landed: run.landed });
    }
    r.windows = watch.opened;
    r.t = Math.min(G.t, DUR);
    simT += r.t;
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
console.log(`무기 ${W} · 누르기 ${PRESS} s · 판 ${N} × ${DUR} s · 판 ${SECRET.mord.grip} · 기술 ${SECRET.mord.tech} · 넘어 들어감 ${SECRET.mordOver ? '켬' : '끔'} · 운동학 ${SECRET.mord.kin || '끔'} · 쥔 자리 ${SECRET.mord.at} · 겨눔 ${SECRET.mord.aim} · 배율 ${SECRET.mord.power} · 투구 ${HELM ?? '없음'}`);
if (process.env.SUM) {
  // 일격 하나하나의 셈: 입력 → 굳음 끝(가운데) · 머리 맞음 J(투구 배율을 곱한 판정 J — 가운데 · 위 10 %) · 그중 45 J 넘는 몫(주저앉음 문턱 — fighter.applyWound) · 칼자루 / 칼날 · 목 · 넘어짐 · 비틀거림 · 기절 · 막힘
  const q = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))] : null);
  const head = fires.flatMap((f) => f.hits.filter((h) => h.zone === 'head').map((h) => Math.round(h.E * h.k)));
  const neck = fires.flatMap((f) => f.hits.filter((h) => h.zone === 'neck'));
  const n = fires.length;
  console.log(JSON.stringify({ fired: n, landed: fires.filter((f) => f.landed).length, durMed: q(fires.map((f) => f.dur).filter((x) => x != null), 0.5), headHits: head.length, headHilt: fires.flatMap((f) => f.hits.filter((h) => h.zone === 'head' && h.part === 'hilt')).length, headJmed: q(head, 0.5), headJp90: q(head, 0.9), over45: head.length ? +(head.filter((e) => e > 45).length / head.length).toFixed(2) : null, neckHits: neck.length, neckCut: neck.filter((h) => h.type !== 'blunt').length, falls: fires.filter((f) => f.fell).length, stagger: fires.filter((f) => f.stag).length, ko: fires.filter((f) => f.ko).length, blocked: fires.filter((f) => f.blocked).length }));
}
if (process.env.HITS) console.log(JSON.stringify(hitsAll));
console.log('상대 | 판 | 누르기 시작/판 | 창/판 | 낸 수/판 | 맞힘 | 칼자루·코등이 곁→머리·목 | 칼날→머리·목 | 막혔는데 넘어감 | 막힘 | 넘어짐 | 비틀거림 | 심각도 합/판 | 둔타 J/판 | 가장 긴 누르기 s | 죽음 나/상대');
{
  const T = out.reduce((a, r) => { for (const k of ['windows', 'fired', 'landed', 'blocked', 'presses']) a[k] = (a[k] ?? 0) + r[k]; return a; }, {});
  const q = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(2) : '-');
  console.log(`합 (운전 ${DRIVE} · 걸쇠 ${CLOSE.latch ?? 1} · 누르기 ${PRESS} s · 너그러움 ${SECRET.mordGrace ?? 0} s): 판 ${out.length} · ${simT.toFixed(0)} s · 누르기 시작 ${T.presses} · 창 ${T.windows} (30 s 당 ${((30 * T.windows) / simT).toFixed(2)}) · 낸 ${T.fired} · 맞힘 ${T.landed} · 막힘 ${T.blocked} · 헛침(안 맞고 안 막힘) ${T.fired - T.landed - T.blocked} · 낼 때 가슴 사이 p10 ${q(fireD, 0.1)} · p50 ${q(fireD, 0.5)} · p90 ${q(fireD, 0.9)} m (닿는 거리 ${CLOSE.reach(WEAPONS[W]).toFixed(2)}) · 누르기 끊김 틈 ${pressGaps.length} 번 (0.2 s 안 ${pressGaps.filter((g) => g <= 0.2 + 1e-9).length} · 0.4 s 안 ${pressGaps.filter((g) => g <= 0.4 + 1e-9).length} · p10 ${q(pressGaps, 0.1)} · p25 ${q(pressGaps, 0.25)} · p50 ${q(pressGaps, 0.5)} · p75 ${q(pressGaps, 0.75)} s)`);
}
for (const S of Object.values(sum)) {
  const f = (k) => (S[k] / S.n).toFixed(2);
  console.log(`${S.foe} | ${S.n} | ${f('presses')} | ${f('windows')} | ${f('fired')} | ${S.landed} | ${S.hiltHead} | ${S.bladeHead} | ${S.over} | ${S.blocked} | ${S.falls} | ${S.stagger} | ${f('sev')} | ${f('bluntJ')} | ${S.maxPress} | ${S.pDead}/${S.eDead}`);
}
