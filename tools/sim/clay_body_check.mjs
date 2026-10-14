// 병마용 몸 규칙 검사 (docs/import/chanda_terra_port_2026-10-14.md §3-3 — 사장님 결정 10/14 '샛별 그대로' · '머리나 팔 잘릴 때 부서지는 소리만'). 결정적. 실패하면 exit 1.
//  ① 출혈 0 · 혈액 1: 합성 상처(몸통·팔다리 베기·찌르기)와 실전(병마용 AI 대 기본 AI — 30 s × 3 판) 내내 출혈 0 · 혈액 1 · 상처마다 bleed 0
//  ② 머리가 떨어져야만 죽음: die('출혈'·'기절'·'내려찍기'·'목') 거부 · 의식 0 거부 · 내려찍기 즉사 찌르기·몸통 깊은 찌르기 거부 ·
//     머리 베기 0.9 · 머리 찌르기 0.6 · 지나가지 못한 목 찌르기 0.6 · 머리 둔타(사람 기절 문턱) → 목 관절이 떨어지고 그래서 죽음 (같은 상처의 사람과 견줌)
//     부활 시트를 줘도: 머리 없는 죽음 요청은 남은 횟수를 쓰지 않음 · 머리가 떨어지면 부활 없이 끝 · 실전에서 병마용이 죽은 판은 모두 목 관절 없음
//  ③ 부서지는 소리 · ④ 목소리 0: BodySounds(소리 대역 — 부른 함수만 센다)로 팔·다리 절단과 참수 → 흙 부서지는 소리(clayBreak 팔다리·머리)만,
//     사람 절단·참수 소리 0 · 신음·죽음·숨 0. 같은 장면의 사람은 sever·decapitate 그대로. 부서지는 소리 조각(절차 합성)이 0.7 s · 유한 값으로 만들어지는지
//  ⑤ 단면 색: decap_fx · limb_fx 에 사람과 병마용을 같은 판에 두고 피 켬/끔 — 사람 단면 = 검붉은 살(켬)·회색(끔) + 뼈, 흙 단면 = 흙빛 그대로 · 뼈 없음 · 흙 단면 분출 0
// 실행: node tools/sim/clay_body_check.mjs [--fights=3]
import { newRound, THREE, DT, AI, CONFIG } from './harness_m.mjs';
import { HUMAN_BODY } from '../../src/fighter.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { BodySounds, VOICES, makeBankSound } from '../../src/sound.js';
import { createDecapFx } from '../../src/decap_fx.js';
import { createLimbFx } from '../../src/limb_fx.js';
import { ANATOMY } from '../../src/config.js';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const FIGHTS = +(args.fights ?? 3);
let fails = 0;
const say = (ok, name, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };
const TERRA = CHARACTERS_BY_ID.terracotta;
const CLAY = Object.freeze({ ...HUMAN_BODY, ...TERRA.physiology });
class Passive { update() {} }
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
/** 가만히 선 두 사람 (AI 없음). clay = 'player' | 'enemy' | null 쪽이 흙 몸 */
function quiet(clay = 'enemy', extra = {}) {
  seedRand(7);
  const G = newRound({ walls: false, seed: 7, AIClass: Passive, ...extra });
  if (clay) G[clay].physiology = CLAY;
  for (let i = 0; i < 120; i++) G.step();
  return G;
}
const v3 = (v) => new THREE.Vector3(v.x, v.y, v.z);
function wound(part, zone, type, severity, local, patch = {}) {
  return { part, zone, type, severity, energy: 150, pass: type === 'cut', passing: type === 'cut', stuck: false, helmet: false, plate: false, local: local.clone(), dir: new THREE.Vector3(0, -1, 0), bleedPerSev: ANATOMY[zone === 'neck' ? 'neck' : zone === 'head' ? 'head' : zone === 'arm' ? 'arm' : zone === 'leg' ? 'leg' : 'chest'].bleed, helmetBlunt: 1, plateBlunt: 1, ...patch };
}
const headless = (f) => f.decapitated && !f.jointByName.head?.joint;

// ── ① 출혈 0 (합성) ──
{
  const G = quiet('enemy');
  const E = G.enemy;
  const hits = [
    ['chest', 'chest', 'cut', 1.2, [0.1, 0.05, 0]], ['chest', 'chest', 'stab', 1.8, [0.12, 0, 0.02]], ['abdomen', 'abdomen', 'stab', 2.0, [0.1, 0, 0]],
    ['pelvis', 'pelvis', 'cut', 1.0, [0.1, 0, 0.05]], ['uarmS', 'arm', 'cut', 0.7, [0, -0.02, 0]], ['farmO', 'arm', 'stab', 0.8, [0, 0, 0]],
    ['thighF', 'leg', 'cut', 0.9, [0, 0, 0]], ['shinB', 'leg', 'stab', 0.6, [0, 0, 0]],
  ];
  for (let k = 0; k < 5; k++) for (const [part, zone, type, sev, loc] of hits) E.applyWound({ ...wound(part, zone, type, sev, new THREE.Vector3(...loc)), pass: false, passing: false });
  let maxBleed = 0, minBlood = 1;
  for (let i = 0; i < 240; i++) { G.step(); maxBleed = Math.max(maxBleed, E.bleed); minBlood = Math.min(minBlood, E.blood); }
  say(E.wounds.length >= 40 && E.wounds.every((w) => w.bleed === 0), '① 합성 상처 40: 상처마다 출혈 0', `상처 ${E.wounds.length}`);
  say(maxBleed === 0 && minBlood === 1, '① 2 s 동안 출혈 0 · 혈액 1', `최대 출혈 ${maxBleed} · 최소 혈액 ${minBlood}`);
  say(E.state !== 'dead', '① 몸통·팔다리 상처로는 죽지 않음', `상태 ${E.state} · 의식 ${E.consciousness.toFixed(2)}`);
}

// ── ② 머리가 떨어져야만 죽음 ──
{
  const G = quiet('enemy');
  const E = G.enemy;
  for (const c of ['출혈', '기절', '내려찍기', '목', '머리']) E.die(c);
  say(E.state !== 'dead' && !E.decapitated, "② die('출혈'·'기절'·'내려찍기'·'목'·'머리') 거부", `상태 ${E.state}`);
  E.consciousness = 0;
  for (let i = 0; i < 60; i++) G.step();
  say(E.state !== 'dead', '② 의식 0 이어도 기절로 죽지 않음 (updateVitals)', `상태 ${E.state}`);
  E.consciousness = 1;
  E.applyWound(wound('chest', 'chest', 'stab', 0, new THREE.Vector3(0.12, 0, 0), { finish: true, pass: false, passing: false }));
  say(E.state !== 'dead', '② 내려찍기 즉사 찌르기(몸통) 거부', `상태 ${E.state}`);
  E.applyWound(wound('chest', 'chest', 'stab', 3, new THREE.Vector3(0.12, 0, 0), { pass: true, passing: false }));
  say(E.state !== 'dead' && E.setState('dead') === undefined && E.state !== 'dead', '② 몸통 깊은 찌르기(심각도 3) · setState(dead) 거부', `상태 ${E.state}`);
}
for (const [name, h, cause] of [
  ['머리 베기 0.9', wound('head', 'head', 'cut', 0.9, new THREE.Vector3(0.08, 0.05, 0), { pass: false, passing: false }), '머리'],
  ['머리 찌르기 0.6', wound('head', 'head', 'stab', 0.6, new THREE.Vector3(0.1, 0, 0)), '머리'],
  ['지나가지 못한 목 찌르기 0.6', wound('chest', 'neck', 'stab', 0.6, new THREE.Vector3(0.05, 0.19, 0), { pass: false, passing: false }), '목'],
  ['목을 지나간 베기 1.2', wound('chest', 'neck', 'cut', 1.2, new THREE.Vector3(0.05, 0.19, 0)), '목'],
]) {
  const G = quiet('enemy', {}); const E = G.enemy; const P = G.player;
  E.applyWound(h);
  P.physiology = HUMAN_BODY; P.applyWound({ ...h, local: h.local.clone() });
  say(E.state === 'dead' && headless(E) && E.causeOfDeath === cause && E.wounds.at(-1).stump && E.wounds.at(-1).bleed === 0 && E.bleed === 0,
    `② ${name}: 흙 몸 → 목 관절이 떨어지고 죽음(${cause})`, `흙 ${E.state}/${E.causeOfDeath} 참수 ${!!E.decapitated} · 사람 ${P.state}/${P.causeOfDeath} 참수 ${!!P.decapitated} 출혈 ${P.bleed.toFixed(3)}`);
}
{
  const G = quiet('enemy'); const E = G.enemy;
  E.applyWound(wound('head', 'head', 'blunt', 0, new THREE.Vector3(0.1, 0.03, 0), { energy: 400, pass: false, passing: false }));
  say(E.state === 'dead' && headless(E), '② 머리 둔타 400 J(의식 ≤ 0 — 사람 기절 문턱) → 목이 부러져 머리가 떨어짐', `${E.state}/${E.causeOfDeath} 의식 ${E.consciousness.toFixed(2)}`);
  const G2 = quiet('enemy'); const E2 = G2.enemy;
  E2.applyWound(wound('head', 'head', 'blunt', 0, new THREE.Vector3(0.1, 0.03, 0), { energy: 60, pass: false, passing: false }));
  say(E2.state !== 'dead' && !E2.decapitated, '② 약한 머리 둔타 60 J 는 머리를 떼지 않음', `${E2.state} 의식 ${E2.consciousness.toFixed(2)}`);
}
{ // 부활 시트를 준 흙 몸 (지금 병마용 시트엔 없다 — 순서만 본다)
  const G = quiet('enemy', { revive: { count: 1 } }); const E = G.enemy;
  E.die('출혈'); E.die('기절');
  say(E.revive?.left === 1 && !E.revival && E.state !== 'dead', '② 부활 시트가 있어도 머리 없는 죽음 요청은 부활 횟수를 쓰지 않음', `남은 ${E.revive?.left} · revival ${!!E.revival}`);
  E.applyWound(wound('chest', 'neck', 'cut', 1.2, new THREE.Vector3(0.05, 0.19, 0)));
  say(E.state === 'dead' && headless(E) && !E.revival && E.revive.left === 1, '② 머리가 떨어지면 부활 없이 끝 (머리 잘림 = 끝)', `${E.state} revival ${!!E.revival} 남은 ${E.revive.left}`);
}

// ── ① · ② 실전: 병마용 AI(시트 그대로 — 숙련도 2 · 간장) 대 기본 AI(롱소드 · normal), 30 s ──
{
  const sum = { hits: 0, opened: 0, bled: 0, deaths: 0, headDeaths: 0, playerDeaths: 0, bloodMin: 1 };
  for (let seed = 1; seed <= FIGHTS; seed++) {
    seedRand(seed);
    const G = newRound({ seed, difficulty: TERRA.ai.level, persona: TERRA.ai.persona, weapon2: TERRA.weapon, AI2Class: AI, difficulty2: 'normal', persona2: null, weapon: 'longsword', onFighter: (f) => { if (f.index === 1) f.physiology = CLAY; } });
    const E = G.enemy, P = G.player;
    const prev = G.combat.hooks.onWound;
    G.combat.hooks.onWound = (att, vic, r, ...rest) => { if (vic === E) { sum.hits++; if (r.type !== 'blunt' && r.severity > 0) sum.opened++; } prev?.(att, vic, r, ...rest); };
    for (let i = 0; i < 30 / DT; i++) {
      G.step();
      if (E.bleed !== 0 || E.wounds.some((w) => w.bleed !== 0)) sum.bled++;
      sum.bloodMin = Math.min(sum.bloodMin, E.blood);
      if (E.state === 'dead' || P.state === 'dead') break;
    }
    if (E.state === 'dead') { sum.deaths++; if (headless(E)) sum.headDeaths++; }
    if (P.state === 'dead') sum.playerDeaths++;
    console.log(`  실전 시드 ${seed}: 흙 ${E.state}${E.causeOfDeath ? '(' + E.causeOfDeath + ')' : ''} 참수 ${!!E.decapitated} 상처 ${E.wounds.length} 잘림 ${E.severed?.length ?? 0} · 사람 ${P.state}${P.causeOfDeath ? '(' + P.causeOfDeath + ')' : ''} · ${G.t.toFixed(1)} s`);
  }
  say(sum.bled === 0 && sum.bloodMin === 1, `① 실전 ${FIGHTS} 판: 흙 몸 출혈 0 · 혈액 1`, `흙 몸을 친 타격 ${sum.hits} (살을 가른 것 ${sum.opened}) · 출혈 스텝 ${sum.bled}`);
  say(sum.deaths === sum.headDeaths, `② 실전: 흙 몸이 죽은 판은 모두 목 관절 없음`, `죽음 ${sum.deaths} · 참수 ${sum.headDeaths} · 사람 죽음 ${sum.playerDeaths}`);
}

// ── ③ 부서지는 소리 · ④ 목소리 0 (BodySounds — 소리 대역) ──
function spySound() {
  const calls = [];
  const s = new Proxy({}, { get: (_, k) => (...a) => { calls.push([String(k), a[0]]); } });
  return { s, calls };
}
CONFIG.COMBAT.limbSever = 'on';
{
  const G = quiet(null); const E = G.enemy, P = G.player;
  E.physiology = CLAY;
  const se = spySound(), sp = spySound();
  const bsE = new BodySounds(se.s, E, 'silent'), bsP = new BodySounds(sp.s, P, 'player', true);
  const tick = (n = 6) => { for (let i = 0; i < n; i++) { G.step(); bsE.update(DT); bsP.update(DT); } };
  const own = (f, name) => v3(f.jointByName[name].joint.anchor2());
  for (const f of [E, P]) {
    f.applyWound(wound('farmO', 'arm', 'cut', 1.5, own(f, 'farmO'))); tick();
    f.applyWound(wound('uarmS', 'arm', 'cut', 1.5, own(f, 'uarmS'))); tick();
    f.applyWound(wound('shinF', 'leg', 'cut', 1.5, own(f, 'shinF'))); tick();
    f.applyWound(wound('chest', 'chest', 'cut', 1.0, new THREE.Vector3(0.1, 0, 0), { pass: false, passing: false })); tick(); // 깊은 상처 (사람이면 신음)
  }
  tick(300); // 2.5 s — 신음 간격(2 s) 지나게
  const pre = { E: [...se.calls], P: [...sp.calls] };
  for (const f of [E, P]) { f.applyWound(wound('chest', 'neck', 'cut', 1.2, new THREE.Vector3(0.05, 0.19, 0))); }
  tick(240);
  const count = (calls, k) => calls.filter((c) => c[0] === k).length;
  const breaks = se.calls.filter((c) => c[0] === 'clayBreak');
  say(E.severed?.length === 3 && P.severed?.length === 3, '③ 장면: 흙 몸·사람 모두 팔 둘·다리 하나가 잘림', `흙 ${E.severed?.length} · 사람 ${P.severed?.length}`);
  say(count(pre.E, 'clayBreak') === 3 && count(pre.E, 'sever') === 0, '③ 흙 몸 팔·다리 절단 → 부서지는 소리(clayBreak) 셋 · 사람 절단 소리 0', JSON.stringify(pre.E.map((c) => c[0])));
  say(breaks.length === 4 && breaks.at(-1)[1]?.head === true && count(se.calls, 'decapitate') === 0, '③ 흙 몸 참수 → 부서지는 소리(머리) · 사람 참수 소리 0', `clayBreak ${breaks.length} (마지막 head ${breaks.at(-1)?.[1]?.head})`);
  const voiceE = se.calls.filter((c) => ['hurt', 'death', 'breath', 'revive'].includes(c[0]));
  say(voiceE.length === 0 && VOICES.silent?.mute === true, '④ 흙 몸 목소리 호출 0 (신음·죽음·숨·부활)', `${JSON.stringify(voiceE)} · 전체 ${JSON.stringify([...new Set(se.calls.map((c) => c[0]))])}`);
  say(count(sp.calls, 'sever') === 3 && count(sp.calls, 'decapitate') === 1 && count(sp.calls, 'clayBreak') === 0 && count(sp.calls, 'hurt') >= 1, '③ 같은 장면의 사람: 절단 소리 셋 · 참수 소리 하나 · 신음 그대로 · 부서지는 소리 0', JSON.stringify([...new Set(sp.calls.map((c) => c[0]))]));
  say(E.state === 'dead' && headless(E) && P.state === 'dead', '③ 장면 끝: 둘 다 참수로 죽음', `${E.state}/${P.state}`);
  const buf = makeBankSound('clayBreak', 48000, 12345);
  let peak = 0, finite = true;
  for (const x of buf) { if (!Number.isFinite(x)) finite = false; peak = Math.max(peak, Math.abs(x)); }
  say(Math.abs(buf.length / 48000 - 0.7) < 1e-3 && finite && peak > 0.85 && peak <= 0.9 + 1e-6, '③ 부서지는 소리 조각(절차 합성 clayBreak): 0.7 s · 유한 · 최대 0.9', `${(buf.length / 48000).toFixed(3)} s · 최대 ${peak.toFixed(3)}`);
}

// ── ⑤ 단면 색 (decap_fx · limb_fx — 사람과 흙 몸을 같은 판에, 피 켬/끔) ──
{
  const G = quiet(null); const E = G.enemy, P = G.player;
  E.physiology = CLAY;
  const own = (f, name) => v3(f.jointByName[name].joint.anchor2());
  for (const f of [E, P]) { f.applyWound(wound('farmO', 'arm', 'cut', 1.5, own(f, 'farmO'))); f.applyWound(wound('chest', 'neck', 'cut', 1.2, new THREE.Vector3(0.05, 0.19, 0))); }
  const adds = [];
  const particles = { bloodOn: true, add: (p, v, color) => adds.push(color) };
  const decap = createDecapFx(particles), limb = createLimbFx(particles);
  const discs = (f) => { const out = []; for (const g of Object.values(f.groups)) g.traverse((o) => { if (o.name === 'decapStump' || o.name === 'limbStump') out.push({ kind: o.name, colors: o.children.map((c) => c.material.color.getHex()) }); }); return out; };
  const hex = (x) => x.toString(16).padStart(6, '0');
  const show = (list) => list.map((d) => `${d.kind}:${d.colors.map(hex).join('/')}`).join(' ');
  for (const [blood, flesh, ring] of [[true, 0x4a0a0c, 0x6a1a18], [false, 0x3a3634, 0x4a4644], [true, 0x4a0a0c, 0x6a1a18]]) {
    particles.bloodOn = blood;
    // 흙 몸만 먼저 한 번 (사람 단면이 아직 안 붙은 프레임에서 흙 단면 분출이 0 인지)
    adds.length = 0;
    decap.update([E], 0.016); limb.update([E], 0.016);
    const clayAdds = adds.length;
    decap.update([P, E], 0.016); limb.update([P, E], 0.016);
    const dp = discs(P), de = discs(E);
    const humanOk = dp.length === 4 && dp.every((d) => d.colors.length === 3 && d.colors[0] === flesh && d.colors[1] === ring && d.colors[2] === 0xcfc4b2);
    const clayOk = de.length === 4 && de.every((d) => d.colors.length === 2 && d.colors[0] === 0x8b887a && d.colors[1] === 0xaaa697);
    say(humanOk && clayOk && clayAdds === 0, `⑤ 피 ${blood ? '켬' : '끔'}: 사람 단면 ${hex(flesh)}/${hex(ring)}+뼈 · 흙 단면 8b887a/aaa697 뼈 없음 · 흙 단면 분출 0`, `사람 ${show(dp)} · 흙 ${show(de)} · 흙만 돌린 프레임 입자 ${clayAdds}`);
  }
  // 사람 단면은 피를 켜면 분출이 나온다 (그대로) — 흙 몸 단면만 따로 없는지 위에서 봤다
  adds.length = 0; particles.bloodOn = true;
  const G2 = quiet(null); const P2 = G2.player;
  P2.applyWound(wound('chest', 'neck', 'cut', 1.2, new THREE.Vector3(0.05, 0.19, 0)));
  const decap2 = createDecapFx(particles);
  for (let i = 0; i < 10; i++) decap2.update([P2], 0.05);
  say(adds.length > 0 && adds.every((c) => c === 0x8a0000), '⑤ 사람 참수 단면은 피를 켜면 그대로 붉은 분출', `입자 ${adds.length}`);
}

console.log(fails ? `\n실패 ${fails}` : '\n모두 통과');
process.exit(fails ? 1 : 0);
