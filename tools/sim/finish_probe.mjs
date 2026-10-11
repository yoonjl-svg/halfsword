// 자연 판의 내려찍기 측정 (10/12 샛별 가져오기 2차 — docs/import/saetbyeol_round2_2026-10-12.md §3·§4)
//  두 AI 의 보통 결투(벽 있음, 상대 = 롱소드 AI). 플레이어 자리는 AI 가 움직이되, 상대가 쓰러지거나(down) 일어나는(getup) 동안에는
//  '탭 봇' 이 사람처럼 화면을 톡 친다: 상대 상태가 바뀌고 react 초 뒤 첫 탭, 그 뒤 탭이 끝날 때마다 다시 (skill.thrust — 실제 탭과 같은 길).
//  탭마다: 그때 상대 자세(넘어지는 중 = down 인데 가장 높은 가슴·골반이 0.665 m 위 / 누움 / 일어나는 중) · 결과를 센다.
//   결과: 보통찌르기(찍기가 안 열림 = '안 나감') · 거둠(찍기 시작 뒤 내려찍기 전에 거둠) · 헛찍음(내려찍었는데 몸통·머리에 찌르기로 안 닿음 = '안 박힘')
//         · 막힘(판·투구에 막혀 멍) · 상처(들어갔는데 안 죽음) · 끝(이 탭의 찍기 뒤 상대가 죽음)
//  AI 쪽(상대 자리 AI 가 쓰러진 플레이어를 마무리하나): 플레이어가 down 인 구간마다 상처를 냈나 · 그 구간에 죽였나.
//  판 끝: 승패 · 판 길이 · 죽은 까닭 (내려찍기 = 즉사, 목·머리 = 치명상, 기절·출혈) · 참수.
//  스위치는 환경 변수 (harness_m.mjs): FINISH_ENTRY=low · FINISH_MODE=power25
//  사용법: node tools/sim/finish_probe.mjs [판 수=12] [플레이어 무기=longsword] [초=40] [--armour=none|plate] [--seed=첫 번호] [--react=0.3] [--knock=초] [--rows]
//   --knock=S : 상대가 서 있으면 S 초마다 크게 넘어뜨린다 (자연 판에선 큰 쓰러짐(down)이 드물다 — 가벼운 넘어짐은 바로 무릎(getup)부터)
//   --armour=plate : 상대(롱소드 AI)에게 판금·투구(하인리히 겉모습)를 입힌다. 결정적(같은 입력 → 같은 출력)
import { newRound, DT, AI } from './harness_m.mjs';
import { CHARACTERS } from '../../src/characters.js';
import { FINISH } from '../../src/finish.js';
import { LOW_FINISH } from '../../src/finish_entry.js';
import { isMain } from './is_main.mjs';

const FIN_PARTS = new Set(['chest', 'abdomen', 'pelvis', 'head']);
const PLATE = CHARACTERS.find((c) => c.id === 'heinrich').look;

function topY(f) {
  return Math.max(f.bodies.chest.translation().y, f.bodies.pelvis.translation().y);
}

export function probeRound({ seed, weapon = 'longsword', secs = 40, plate = false, react = 0.3, knock = 0, notap = false }) {
  const G = newRound({ seed, weapon, weapon2: 'longsword', AI2Class: AI, ...(plate ? { look2: PLATE } : {}) });
  const P = G.player;
  const E = G.enemy;
  const taps = [];
  const aiDown = []; // 플레이어가 down 인 구간 { t0, wound, kill }
  let cur = null; // 지금 지켜보는 탭 기록
  let since = 0; // 상대가 down/getup 이 된 뒤 지난 시간
  let prevE = E.state;
  let pDown = null;
  let lowHits = 0;
  let decapLow = false; // 상대가 누운·일어나는 중에 참수됐나
  const C = G.combat;
  const orig = C.strike.bind(C);
  C.strike = (pr, point, passing) => {
    const r = orig(pr, point, passing);
    // 약한 자세 겨눔 (10/12): 급소 탭 찌르기가 뻗는 동안 상대 몸에 처음 닿은 곳 · AI 의 급소 공격(베기·찌르기)이 닿은 곳
    if (cur && r && !cur.tap.down && pr.w.fighter === P && pr.v?.fighter === E && P.skill.tap === cur.tap) cur.contacts.push({ part: pr.v.part, zone: r.zone, type: r.type, sev: r.severity, eff: r.eff });
    for (const vs of openV) if (r && pr.w.fighter === vs.att && pr.v?.fighter === vs.vic) vs.contacts.push({ part: pr.v.part, zone: r.zone, type: r.type, sev: r.severity });
    if (cur && r && pr.w.fighter === P && pr.v?.fighter === E && FIN_PARTS.has(pr.v.part)) {
      const tp = cur.tap;
      if (tp.down && tp.go && P.skill.tap === tp && P.skill.thrustPush) {
        cur.contacts.push({ part: pr.v.part, type: r.type, finish: !!r.finish, power: !!r.finishPower, plate: !!r.plate, helmet: !!r.helmet, sev: r.severity, eff: r.eff, thr: r.thr });
      }
    }
    if (pDown && r && pr.w.fighter === E && pr.v?.fighter === P && (r.type === 'cut' || r.type === 'stab') && r.severity > 0) pDown.wound = true;
    // 누운(down)·일어나는(getup) 상대에게 들어간 칼 (플레이어 → 상대, 베기·찌르기 상처)
    if (r && pr.w.fighter === P && pr.v?.fighter === E && (E.state === 'down' || E.state === 'getup') && (r.type === 'cut' || r.type === 'stab') && r.severity > 0) lowHits++;
    return r;
  };
  const openV = []; // 지금 지켜보는 AI 급소 공격 { att, vic, kind, zone, t0, contacts, decap, dead }
  const vStrikes = []; // 닫힌 AI 급소 공격
  const lastVS = new Map();
  const close = () => {
    if (!cur) return;
    const tp = cur.tap;
    let res;
    if (!tp.down && tp.vital) {
      // 급소 찌르기: 첫 몸 접촉이 목·머리(얼굴 포함)면 '급소맞음', 다른 몸이면 '딴곳', 없으면 '헛침'. 이 탭 동안 죽으면 '끝'
      const c0 = cur.contacts[0];
      res = cur.killed ? '끝' : !c0 ? '헛침' : c0.zone === 'neck' || c0.zone === 'head' ? '급소맞음' : '딴곳';
      taps.push({ pose: cur.pose, finOn: cur.finOn, res, top: cur.top, vital: tp.vital.zone, hit: c0 ? `${c0.zone}/${c0.type}` : '-' });
      cur = null;
      return;
    }
    if (!tp.down) {
      // 보통 찌르기도 첫 몸 접촉을 적는다 (급소 찌르기와 견주려고)
      const c0 = cur.contacts[0];
      cur.plainHit = cur.killed ? '끝' : !c0 ? '헛침' : c0.zone === 'neck' || c0.zone === 'head' ? '급소맞음' : '딴곳';
      res = '보통찌르기';
    }
    else if (cur.killed) res = '끝';
    else if (!tp.go) res = '거둠';
    else if (!cur.contacts.some((c) => c.type === 'stab')) res = cur.contacts.length ? (cur.contacts.some((c) => c.plate || c.helmet) ? '막힘' : '헛찍음') : '헛찍음';
    else if (cur.contacts.some((c) => c.type === 'stab' && c.sev > 0)) res = '상처';
    else res = '막힘';
    // 막힘: 몸통·머리에 찌르기 판정은 났지만 판·투구에 막혀 멍으로 바뀜 (contacts 의 type 이 blunt 이고 plate/helmet)
    if (res === '헛찍음' && cur.contacts.some((c) => c.type === 'blunt' && (c.plate || c.helmet))) res = '막힘';
    taps.push({ pose: cur.pose, finOn: cur.finOn, res, top: cur.top, plainHit: cur.plainHit });
    cur = null;
  };
  let knockT = 0;
  let lastTap = null;
  let rangeN = 0; // 간격 맞추기로 시작한 탭 (찌르기는 맞춘 뒤 나간다)
  for (let i = 0; i < secs / DT; i++) {
    // --knock=S: 상대가 서 있으면 S 초마다 크게 넘어뜨린다(knockDown(true) — 실제 쓰러짐 시간·일어나기 그대로). 자연 판에선 큰 쓰러짐이 드물어 '넘어지는 중·누움' 탭을 보려고
    knockT += DT;
    if (knock > 0 && knockT >= knock && E.state === 'stand' && E.alive) (E.knockDown(true), (knockT = 0));
    // 탭 봇: 상대가 down/getup 이고 살아 있으면 react 초 뒤부터, 탭이 없을 때마다 친다
    const es = E.state;
    if (es !== prevE) since = 0;
    prevE = es;
    since += DT;
    if (cur && P.skill.tap !== cur.tap) close();
    const tapPose = () => {
      const top = topY(E);
      return { pose: es === 'getup' ? '일어나는중' : es === 'kneel' ? '무릎' : top > LOW_FINISH.enterHeight ? '넘어지는중' : '누움', top };
    };
    // 약한 자세 간격 맞추기(FINISH.vital) 뒤에 나간 찌르기도 탭으로 센다
    if (!cur && P.skill.tap && P.skill.tap !== lastTap) cur = { tap: P.skill.tap, ...tapPose(), finOn: !!P.finish.on, contacts: [], killed: false };
    if (!notap && !cur && E.alive && (es === 'down' || es === 'getup' || es === 'kneel') && since >= react && P.alive && P.armed && !P.skill.tap && !P.skill.vitalRange) {
      const tp0 = tapPose();
      const finOn = !!P.finish.on;
      if (P.skill.thrust()) {
        if (P.skill.tap) cur = { tap: P.skill.tap, ...tp0, finOn, contacts: [], killed: false };
        else rangeN++;
      }
    }
    if (P.skill.tap) lastTap = P.skill.tap;
    // AI 급소 공격 (ai.vitalStrike — startStrike 가 적는다): 0.8 s 동안 닿은 곳·참수, 3 s · 10 s 안에 상대가 죽었나
    for (const [ai, att, vic] of [[G.ai2, P, E], [G.ai, E, P]]) {
      const vsk = ai?.vitalStrike;
      if (vsk && vsk !== lastVS.get(ai)) (lastVS.set(ai, vsk), openV.push({ att, vic, kind: vsk.kind, zone: vsk.zone, tech: vsk.tech, t0: G.t, contacts: [], decap: false, dead: null, vicPose: vic.state }));
    }
    // AI 쪽: 플레이어 down 구간
    if (P.state === 'down' && P.alive && !pDown) (pDown = { t0: G.t, wound: false, kill: false }), aiDown.push(pDown);
    // 탭 봇의 탭이 도는 동안엔 사람처럼 조이스틱을 놓는다: 플레이어 자리 AI 를 멈추고 이동 입력 0 (찍기의 걸어 들어가기는 skill 이 스스로 민다)
    const bot = (cur && P.skill.tap === cur.tap) || !!P.skill.vitalRange;
    const ai2 = G.ai2;
    if (bot) (G.ai2 = null), P.move.set(0, 0), (P.stickX = P.stickY = 0); // 스틱 원값도 놓는다 (간격 맞추기는 스틱을 밀면 거둔다)
    const esBefore = E.state;
    const decBefore = !!E.decapitated;
    G.step();
    if (!decBefore && E.decapitated && (esBefore === 'down' || esBefore === 'getup')) decapLow = true;
    G.ai2 = ai2;
    if (cur && ((cur.tap.down && cur.tap.go) || cur.tap.vital) && !E.alive) cur.killed = true;
    for (let k = openV.length - 1; k >= 0; k--) {
      const vs = openV[k];
      const age = G.t - vs.t0;
      if (age < 0.8 && vs.vic.decapitated) vs.decap = true;
      if (vs.dead == null && (vs.vic.state === 'dead' || vs.vic.revival)) vs.dead = age;
      if (age >= 10 || ((!P.alive || !E.alive) && vs.dead != null)) (vStrikes.push(vs), openV.splice(k, 1));
    }
    if (pDown && !P.alive) pDown.kill = true;
    if (pDown && P.state !== 'down') pDown = null;
    if (!P.alive || !E.alive) {
      // 마지막 탭은 이 스텝에서 닫는다
      if (cur) close();
      break;
    }
  }
  if (cur) close();
  for (const vs of openV) vStrikes.push(vs); // 판이 끝나 10 s 를 다 못 본 것 (죽음 null 이면 안 죽음으로 센다)
  const win = !E.alive && P.alive ? 'P' : !P.alive && E.alive ? 'E' : 'D';
  return { seed, win, t: G.t, causeE: E.causeOfDeath ?? null, causeP: P.causeOfDeath ?? null, decapE: !!E.decapitated, decapP: !!P.decapitated, taps, aiDown, lowHits, decapLow, vStrikes, rangeN, rangeEnds: P.skill.vitalRangeEnds ?? {} };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const pos = args.filter((a) => !a.startsWith('--'));
  const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
  const n = +(pos[0] ?? 12);
  const weapon = pos[1] ?? 'longsword';
  const secs = +(pos[2] ?? 40);
  const plate = opt.armour === 'plate';
  const seed0 = +(opt.seed ?? 7100);
  const react = +(opt.react ?? 0.3);
  const knock = +(opt.knock ?? 0);
  const notap = 'notap' in opt; // 탭 봇 없이 두 AI 만 (AI 급소 공격만 센다)
  const t0 = Date.now();
  const R = [];
  for (let s = 0; s < n; s++) R.push(probeRound({ seed: seed0 + 37 * s, weapon, secs, plate, react, knock, notap }));
  const all = R.flatMap((r) => r.taps);
  const pc = (a, b) => (b ? `${((100 * a) / b).toFixed(0)}%` : '-');
  console.log(`finish_probe ${weapon} 대 롱소드 AI · 상대 ${plate ? '판금' : '맨몸'} · ${n}판 × ${secs}s · entry=${FINISH.entry} mode=${FINISH.mode}${FINISH.mode === 'power25' ? ` ×${FINISH.power}` : ''} vital=${FINISH.vital ? 1 : 0} plateNeck=${FINISH.plateNeck ? 1 : 0} · react ${react}s${knock ? ` · ${knock}s 마다 크게 넘어뜨림` : ''}${notap ? ' · 탭 봇 없음' : ''}`);
  const RES = ['보통찌르기', '거둠', '헛찍음', '막힘', '상처', '끝'];
  // 약한 자세 급소 찌르기 탭 (FINISH.vital)
  const VT = all.filter((x) => x.vital);
  if (VT.length || R.some((r) => r.rangeN)) {
    const VR = ['급소맞음', '딴곳', '헛침', '끝'];
    const RE = R.reduce((m, r) => { for (const k in r.rangeEnds) m[k] = (m[k] || 0) + r.rangeEnds[k]; return m; }, {});
    console.log(`  급소 찌르기 탭 ${VT.length} (간격 맞추기로 시작 ${R.reduce((m, r) => m + r.rangeN, 0)}, 거둠 ${JSON.stringify(RE)}) · ${VR.map((k) => `${k} ${VT.filter((x) => x.res === k).length}`).join(' · ')} · 겨눈 곳 ${JSON.stringify(VT.reduce((m, x) => ((m[x.vital] = (m[x.vital] || 0) + 1), m), {}))} · 첫 접촉 ${JSON.stringify(VT.reduce((m, x) => ((m[x.hit] = (m[x.hit] || 0) + 1), m), {}))}`);
  }
  const PT = all.filter((x) => x.plainHit && x.pose !== '누움');
  if (PT.length) console.log(`  보통 찌르기 탭 (누움 밖) ${PT.length} · ${['급소맞음', '딴곳', '헛침', '끝'].map((k) => `${k} ${PT.filter((x) => x.plainHit === k).length}`).join(' · ')}`);
  const VS = R.flatMap((r) => r.vStrikes);
  if (VS.length) {
    for (const kind of ['cut', 'thrust']) {
      const K = VS.filter((v) => v.kind === kind);
      if (!K.length) continue;
      const first = (v) => v.contacts.find((c) => c.part !== 'sword') ?? null;
      const cls = (v) => { const c = first(v); return !c ? '헛침' : c.zone === 'neck' || c.zone === 'head' ? '목머리' : c.zone === 'arm' ? '팔' : '딴몸'; };
      const C = K.reduce((m, v) => ((m[cls(v)] = (m[cls(v)] || 0) + 1), m), {});
      const wound = K.filter((v) => v.contacts.some((c) => (c.zone === 'neck' || c.zone === 'head') && c.sev > 0)).length;
      console.log(`  AI 급소 ${kind === 'cut' ? '베기(목 가로)' : '찌르기'} ${K.length} · 첫 몸 접촉 ${JSON.stringify(C)} · 목·머리 상처 ${wound} · 참수 ${K.filter((v) => v.decap).length} · 3 s 안 죽음 ${K.filter((v) => v.dead != null && v.dead <= 3).length} · 10 s 안 ${K.filter((v) => v.dead != null && v.dead <= 10).length} · 그때 상대 ${JSON.stringify(K.reduce((m, v) => ((m[v.vicPose] = (m[v.vicPose] || 0) + 1), m), {}))}`);
    }
  }
  for (const pose of ['넘어지는중', '누움', '일어나는중', '무릎', '모두']) {
    const T = (pose === '모두' ? all : all.filter((x) => x.pose === pose)).filter((x) => !x.vital);
    const c = Object.fromEntries(RES.map((k) => [k, T.filter((x) => x.res === k).length]));
    const fail = c['보통찌르기'] + c['거둠'] + c['헛찍음'];
    console.log(`  탭 ${pose.padEnd(5)} ${String(T.length).padStart(3)} · ${RES.map((k) => `${k} ${c[k]}`).join(' · ')} · 안나감+안박힘 ${fail} (${pc(fail, T.length)}) · 찍기자세(fin.on) ${T.filter((x) => x.finOn).length} · 몸 높이 가운데값 ${T.length ? [...T].sort((a, b) => a.top - b.top)[T.length >> 1].top.toFixed(2) : '-'} m (0.665 아래 ${T.filter((x) => x.top <= LOW_FINISH.enterHeight).length})`);
  }
  const W = { P: 0, E: 0, D: 0 };
  for (const r of R) W[r.win]++;
  const causes = {};
  for (const r of R) if (r.causeE) causes[r.causeE] = (causes[r.causeE] || 0) + 1;
  const ends = R.filter((r) => r.win !== 'D');
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
  console.log(`  판: 플레이어 승 ${W.P} · 패 ${W.E} · 무 ${W.D} / ${n} · 평균 길이 ${mean(R.map((r) => r.t)).toFixed(1)}s (끝난 판 ${mean(ends.map((r) => r.t)).toFixed(1)}s)`);
  console.log(`  상대 죽은 까닭: ${Object.entries(causes).map(([k, v]) => `${k} ${v}`).join(' · ') || '-'} · 참수 ${R.filter((r) => r.decapE).length} · 탭 찍기로 끝난 판 ${R.filter((r) => r.taps.some((x) => x.res === '끝')).length}`);
  const lh = R.reduce((s, r) => s + r.lowHits, 0);
  const dl = R.filter((r) => r.decapLow).length;
  console.log(`  누운·일어나는 상대에게 들어간 칼(상처) ${lh} · 그때 참수 ${dl} (${pc(dl, lh)} / 칼, 판 ${dl}/${n}) · 찍기 상처 뒤 살아남은 탭 ${all.filter((x) => x.res === '상처').length}`);
  const ad = R.flatMap((r) => r.aiDown);
  console.log(`  AI 마무리: 플레이어가 쓰러진 구간 ${ad.length} · 그 안에 상처 ${ad.filter((x) => x.wound).length} (${pc(ad.filter((x) => x.wound).length, ad.length)}) · 죽임 ${ad.filter((x) => x.kill).length} · 플레이어 죽은 까닭: ${Object.entries(R.reduce((m, r) => (r.causeP && (m[r.causeP] = (m[r.causeP] || 0) + 1), m), {})).map(([k, v]) => `${k} ${v}`).join(' · ') || '-'}`);
  if (opt.rows) for (const r of R) console.log(`   #${r.seed} ${r.win} ${r.t.toFixed(1)}s E:${r.causeE ?? '-'} P:${r.causeP ?? '-'} 탭 ${r.taps.map((x) => `${x.pose[0]}${x.res[0]}`).join(' ')}`);
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
