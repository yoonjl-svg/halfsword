// ─────────────────────────────────────────────────────────────
//  aid_ledger.mjs — 선언된 밖 도움 장부 (물리 2.0 · 다리 B3 · docs/strike/physics2_legs_notes.md §6). 재기만 한다 — 몸에 아무것도 걸지 않는다.
//
//   node tools/sim/aid_ledger.mjs [--scene=stand,walk,back,strafe,turn,stroke_diagR,stroke_horizR,stroke_vert,walkstroke_horizR,getup,fight] [--weapon=longsword] [--seed=3] [--secs=8] [--fights=3] [--offset=0] [--root=<트리>] [--json=<파일>]
//
//  왜: honesty.mjs 의 갈래 aid 는 스텝마다 건 토크의 합 크기 하나만 적는다. 서 있는 동안의 도움은 yaw(수직축)와 기울기(수평 두 축)에 상한이 따로 있으므로
//   둘을 갈라 평균 · 최고를 적고 상한을 지켰는지 본다. 이 숫자가 '줄여 갈 지표'다(칼 구동을 다시 짓는 동안).
//  재는 법: Fighter.driveAid 를 감싸 그 안에서 골반에 건 힘 · 토크를 받아 적는다(src 가 적어 둔 값이 아니라 실제로 건 값 — honesty.mjs 가 aid 로 세는 것과 같은 자리).
//   상태로 가른다: stand = 서 있는 동안(선 뒤 AID.after 가 지난 뒤) · after = 일어선 바로 뒤 AID.after s (일어서기 도움과 겹침) · rise = 일어서는 동안(getup · kneel) · 그 밖(down · dead) = 0 이어야 한다.
//   '못 낸 나머지(자르기 앞)' 는 src/legs_vmc.js 가 적은 rem — 상한이 얼마나 자주 닿는지 보려고 함께 적는다. '엉덩이 한도' 는 딛은 엉덩이 관절 한도에 잘린 토크(도움에 안 넣는 몫 · 재기만).
//   이 줄도 상태로 가른다 (11/24 검토 — 예전에는 선 바로 뒤 AID.after 창이 '서 있는 동안' 에 섞였다): 서 있는 동안(stand — 일어서기 도움이 꺼진 뒤)과 선 바로 뒤(after)를 따로 찍는다. JSON 의 raw 는 예전처럼 둘의 합 · rawStand · rawAfter 가 새 칸.
//  ÷ 체중: 맨몸 체중(honesty.mjs bareWeight — 싸움꾼 자기 토막들의 충돌 모양 질량 합 × g · 칼과 발 덧질량은 안 넣음 · 736.7 N = AID.liftMax 가 곱하는 체중). 드는 힘은 N 으로도 찍는다.
//   예전 분모는 칼을 넣은 강체 질량 합(롱소드 752 N)이라 상한 0.7 이 0.686 으로 읽혔다 — JSON 의 lift · liftPk 는 그 옛 분모 그대로 두고 liftN · liftPkN(N)과 mgBare 를 더했다.
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { bareWeight } from './honesty.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const CFG = await import(u('src/config.js'));
const HAS_AID = !!CFG.AID; // config AID 가 없는 나무(지금 게임)에서도 돈다 — 상한은 모두 0 으로 보고, 도움을 거는 자리(Fighter.driveAid)가 없으면 그렇게 적는다
const AID = CFG.AID ?? { liftMax: 0, torqueMax: 0, yawMax: 0, tiltMax: 0, after: 0 };
let FAM = null;
try { FAM = (await import(u('tools/sim/corr_lib.mjs'))).FAM; } catch { /* 옛 트리 */ }
FAM ||= { diagR: { ch: [0.42, 0.42], end: [-0.4, -0.42], v: 12 }, vert: { ch: [0.02, 0.52], end: [0, -0.5], v: 12 }, horizR: { ch: [0.52, 0.03], end: [-0.52, 0.03], v: 12 } };
const DT = H.DT;
const weapon = String(args.weapon ?? 'longsword'), seed = +(args.seed ?? 3), secs = +(args.secs ?? 8);
const scenes = String(args.scene ?? 'stand,walk,stroke_diagR,stroke_horizR,fight').split(',');
const FW = String(args.fightWeapons ?? 'longsword,rapier,zweihander').split(',');

const mkCat = () => ({ n: 0, on: 0, yaw: 0, yawPk: 0, tilt: 0, tiltPk: 0, all: 0, allPk: 0, lift: 0, liftPk: 0, horiz: 0, liftN: 0, liftPkN: 0 });
const mkRaw = () => ({ n: 0, yaw: 0, tilt: 0, yawOver: 0, tiltOver: 0, hipYaw: 0, hipTilt: 0, on: [0, 0, 0] });
const mk = () => ({ cat: { stand: mkCat(), after: mkCat(), rise: mkCat(), off: mkCat() }, rawStand: mkRaw(), rawAfter: mkRaw(), mg: 0, mgBare: 0 });
const addRaw = (a, b) => ({ n: a.n + b.n, yaw: a.yaw + b.yaw, tilt: a.tilt + b.tilt, yawOver: a.yawOver + b.yawOver, tiltOver: a.tiltOver + b.tiltOver, hipYaw: a.hipYaw + b.hipYaw, hipTilt: a.hipTilt + b.hipTilt, on: a.on.map((x, i) => x + b.on[i]) });
/** 한 몸의 driveAid 를 감싼다 (인자 · 돌려주는 값 그대로) */
function watch(f, S) {
  const pel = f.bodies.pelvis;
  const oT = pel.addTorque, oF = pel.addForce, oD = f.driveAid;
  if (typeof oD !== 'function') { S.noAid = true; return; }
  let inside = false, T = null, F = null;
  pel.addTorque = function (t, w) { if (inside) { T.x += t.x; T.y += t.y; T.z += t.z; } return oT.call(this, t, w); };
  pel.addForce = function (v, w) { if (inside) { F.x += v.x; F.y += v.y; F.z += v.z; } return oF.call(this, v, w); };
  let mg = 0; { const seen = new Set(); for (const b of [...Object.values(f.bodies), f.sword]) if (b && !seen.has(b.handle)) { seen.add(b.handle); mg += b.mass(); } mg *= 9.81; }
  S.mg = mg; S.mgBare = bareWeight(f, 9.81);
  f.driveAid = function (...a) {
    inside = true; T = { x: 0, y: 0, z: 0 }; F = { x: 0, y: 0, z: 0 };
    try { return oD.apply(this, a); } finally {
      inside = false;
      const st = this.state;
      const c = S.cat[st === 'stand' ? (this.aidAfter ? 'after' : 'stand') : st === 'getup' || st === 'kneel' ? 'rise' : 'off'];
      const y = Math.abs(T.y), t = Math.hypot(T.x, T.z), all = Math.hypot(T.x, T.y, T.z), fh = Math.hypot(F.x, F.z);
      c.n++;
      if (all > 0 || F.y !== 0 || fh > 0) c.on++;
      c.yaw += y; c.yawPk = Math.max(c.yawPk, y);
      c.tilt += t; c.tiltPk = Math.max(c.tiltPk, t);
      c.all += all; c.allPk = Math.max(c.allPk, all);
      c.lift += F.y / mg; c.liftPk = Math.max(c.liftPk, F.y / mg);
      c.liftN += F.y; c.liftPkN = Math.max(c.liftPkN, F.y);
      c.horiz += fh;
      if (st === 'stand') {
        const D = this.legDrive, r = D?.rem;
        if (r) {
          const R = this.aidAfter ? S.rawAfter : S.rawStand, ry = Math.abs(r.y), rt = Math.hypot(r.x, r.z); // 선 바로 뒤(일어서기 도움이 아직 켜진 창)와 그냥 서 있는 동안을 따로
          R.n++; R.yaw += ry; R.tilt += rt;
          if (ry > AID.yawMax) R.yawOver++;
          if (rt > AID.tiltMax) R.tiltOver++;
          if (D.lostHip) { R.hipYaw += Math.abs(D.lostHip.y); R.hipTilt += Math.hypot(D.lostHip.x, D.lostHip.z); }
          const k = D.dbg?.on; if (k != null) R.on[k]++;
        }
      }
    }
  };
}
const f1 = (x) => (+x).toFixed(1), pc = (x) => (100 * x).toFixed(1) + ' %';
const out = [];
function show(title, S) {
  const C = S.cat, lines = [`■ ${title}`];
  if (S.noAid) lines.push(`   이 나무의 몸에는 선언된 도움을 거는 자리(Fighter.driveAid)가 없다${HAS_AID ? '' : ' · config AID 도 없음'} — 선언된 밖 도움 0 (숨은 힘은 이 도구가 아니라 honesty.mjs 가 잰다)`);
  const row = (nm, c, capY, capT) => {
    if (!c.n) return;
    const n = c.n;
    lines.push(`   ${nm.padEnd(22)} 스텝 ${String(n).padStart(6)} · 걸린 몫 ${pc(c.on / n).padStart(7)} · yaw 평균 ${f1(c.yaw / n).padStart(5)} 최고 ${f1(c.yawPk).padStart(6)} N·m${capY != null ? ` (상한 ${capY})` : ''} · 기울기 평균 ${f1(c.tilt / n).padStart(5)} 최고 ${f1(c.tiltPk).padStart(6)} N·m${capT != null ? ` (상한 ${capT})` : ''} · 합 크기 평균 ${f1(c.all / n)} 최고 ${f1(c.allPk)} N·m · 드는 힘 평균 ${(c.liftN / n).toFixed(0)} N (맨몸 체중의 ${pc(c.liftN / n / S.mgBare)}) 최고 ${c.liftPkN.toFixed(0)} N (${pc(c.liftPkN / S.mgBare)})${c.horiz > 0 ? ` · 수평 힘 ${f1(c.horiz / n)} N (0 이어야 함)` : ''}`);
  };
  row('서 있는 동안 (stand)', C.stand, AID.yawMax, AID.tiltMax);
  row('선 바로 뒤 (after)', C.after, AID.yawMax, AID.torqueMax);
  row('일어서는 동안 (rise)', C.rise, 0, AID.torqueMax);
  row('누움 · 죽음 (0 이어야)', C.off, 0, 0);
  const rawLine = (nm, R) => { if (R.n) lines.push(`   못 낸 나머지(자르기 앞) — ${nm} · 스텝 ${R.n}: yaw 평균 ${f1(R.yaw / R.n)} N·m (상한 넘은 스텝 ${pc(R.yawOver / R.n)}) · 기울기 평균 ${f1(R.tilt / R.n)} N·m (상한 넘은 스텝 ${pc(R.tiltOver / R.n)}) · 딛은 발 0 / 1 / 2 개 ${R.on.map((x) => (100 * x / R.n).toFixed(0)).join(' / ')} % · 엉덩이 한도에 잘린 몫(도움에 안 넣음) yaw ${f1(R.hipYaw / R.n)} · 기울기 ${f1(R.hipTilt / R.n)} N·m`); };
  rawLine('서 있는 동안(stand)', S.rawStand); rawLine('선 바로 뒤(after 창)', S.rawAfter);
  const R = addRaw(S.rawStand, S.rawAfter);
  const eps = 1e-6, bad = [];
  if (C.stand.yawPk > (AID.yawMax ?? 0) + eps) bad.push('서 있는 동안 yaw 상한 넘음');
  if (C.stand.tiltPk > (AID.tiltMax ?? 0) + eps) bad.push('서 있는 동안 기울기 상한 넘음');
  const liftCap = AID.liftMax * S.mgBare * (1 + 1e-9) + eps; // 드는 힘 상한 (N) = AID.liftMax × 맨몸 체중
  if (C.stand.liftPkN > eps || C.stand.horiz > eps) bad.push('서 있는 동안 힘을 걸었음');
  if (C.after.yawPk > (AID.yawMax ?? 0) + eps || C.after.tiltPk > AID.torqueMax + eps || C.after.liftPkN > liftCap) bad.push('선 바로 뒤 상한 넘음');
  if (C.rise.yawPk > eps || C.rise.tiltPk > AID.torqueMax + eps || C.rise.liftPkN > liftCap) bad.push('일어서는 동안 상한 넘음');
  if (C.off.on > 0) bad.push('누운 · 죽은 몸에 걸었음');
  lines.push(`   상한: ${bad.length ? '어김 — ' + bad.join(' · ') : '지킴'}`);
  console.log(lines.join('\n'));
  out.push({ title, cat: C, raw: R, rawStand: S.rawStand, rawAfter: S.rawAfter, mgBare: S.mgBare, ok: !bad.length });
}
const run = (G, t, each) => { const n = Math.round(t / DT); for (let i = 0; i < n; i++) { each?.(i, i * DT); G.step(); } };

for (const sc of scenes) {
  if (sc === 'fight') {
    const S = mk(), nF = +(args.fights ?? 3), off = +(args.offset ?? 0);
    for (let s = 1; s <= nF; s++) {
      const G = H.newRound({ walls: true, seed: s + off, weapon: FW[(s - 1) % FW.length], weapon2: FW[s % FW.length], AI2Class: H.AI });
      watch(G.player, S); watch(G.enemy, S);
      const n = Math.round(+(args.fsecs ?? 30) / DT);
      for (let i = 0; i < n; i++) { G.step(); if (G.player.state === 'dead' || G.enemy.state === 'dead') break; }
      try { G.world.free(); } catch { /* */ }
    }
    show(`fight × ${nF} (${FW.join(' · ')} · AI 대 AI · 씨앗 ${1 + off} ~ · 두 몸)`, S);
    continue;
  }
  const G = H.newRound({ walls: false, weapon, seed });
  G.park();
  const P = G.player, S = mk();
  const [kind, fam] = sc.split('_');
  const F = FAM[fam ?? 'diagR'];
  if (kind === 'stroke' || kind === 'walkstroke') P.handOffset.set(F.ch[0], F.ch[1]);
  run(G, 3, () => P.move.set(0, 0));
  watch(P, S);
  const mv = { walk: [0, 1], back: [0, -1], strafe: [1, 0], walkstroke: [0, 1] }[kind] ?? [0, 0];
  let tgt = F.end, hold = 0;
  run(G, kind === 'getup' ? 14 : secs, (i, t) => {
    P.move.set(mv[0], mv[1]);
    if (kind === 'getup' && i === 0) P.knockDown(true);
    if (kind === 'turn') { const k = Math.floor(t / 2), ang = (k % 2 ? 1 : 0) * (Math.PI / 2) * (k % 4 < 2 ? 1 : -1), p = P.bodies.pelvis.translation(); G.faceP = { x: p.x + 60 * Math.cos(ang), y: 1, z: p.z + 60 * Math.sin(ang) }; }
    if (kind === 'stroke' || kind === 'walkstroke') {
      const off = P.handOffset, dx = tgt[0] - off.x, dy = tgt[1] - off.y, dd = Math.hypot(dx, dy), st = F.v * DT;
      if (dd > st) { off.x += (dx / dd) * st; off.y += (dy / dd) * st; } else { off.set(tgt[0], tgt[1]); hold += DT; if (hold > 0.6) { hold = 0; tgt = tgt === F.end ? F.ch : F.end; } }
    }
  });
  show(`${sc} · ${weapon} · 씨앗 ${seed} · ${kind === 'getup' ? 14 : secs} s${P.state !== 'stand' ? ' (끝 상태 ' + P.state + ')' : ''}`, S);
  try { G.world.free(); } catch { /* */ }
}
if (args.json) writeFileSync(String(args.json), JSON.stringify({ aid: AID, scenes: out }, null, 1));
