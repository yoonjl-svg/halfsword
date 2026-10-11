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

export function probeRound({ seed, weapon = 'longsword', secs = 40, plate = false, react = 0.3, knock = 0 }) {
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
  const close = () => {
    if (!cur) return;
    const tp = cur.tap;
    let res;
    if (!tp.down) res = '보통찌르기';
    else if (cur.killed) res = '끝';
    else if (!tp.go) res = '거둠';
    else if (!cur.contacts.some((c) => c.type === 'stab')) res = cur.contacts.length ? (cur.contacts.some((c) => c.plate || c.helmet) ? '막힘' : '헛찍음') : '헛찍음';
    else if (cur.contacts.some((c) => c.type === 'stab' && c.sev > 0)) res = '상처';
    else res = '막힘';
    // 막힘: 몸통·머리에 찌르기 판정은 났지만 판·투구에 막혀 멍으로 바뀜 (contacts 의 type 이 blunt 이고 plate/helmet)
    if (res === '헛찍음' && cur.contacts.some((c) => c.type === 'blunt' && (c.plate || c.helmet))) res = '막힘';
    taps.push({ pose: cur.pose, finOn: cur.finOn, res, top: cur.top });
    cur = null;
  };
  let knockT = 0;
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
    if (!cur && E.alive && (es === 'down' || es === 'getup') && since >= react && P.alive && P.armed && !P.skill.tap) {
      const top = topY(E);
      const pose = es === 'getup' ? '일어나는중' : top > LOW_FINISH.enterHeight ? '넘어지는중' : '누움';
      const finOn = !!P.finish.on;
      if (P.skill.thrust()) cur = { tap: P.skill.tap, pose, finOn, top, contacts: [], killed: false };
    }
    // AI 쪽: 플레이어 down 구간
    if (P.state === 'down' && P.alive && !pDown) (pDown = { t0: G.t, wound: false, kill: false }), aiDown.push(pDown);
    // 탭 봇의 탭이 도는 동안엔 사람처럼 조이스틱을 놓는다: 플레이어 자리 AI 를 멈추고 이동 입력 0 (찍기의 걸어 들어가기는 skill 이 스스로 민다)
    const bot = cur && P.skill.tap === cur.tap;
    const ai2 = G.ai2;
    if (bot) (G.ai2 = null), P.move.set(0, 0);
    const esBefore = E.state;
    const decBefore = !!E.decapitated;
    G.step();
    if (!decBefore && E.decapitated && (esBefore === 'down' || esBefore === 'getup')) decapLow = true;
    G.ai2 = ai2;
    if (cur && cur.tap.down && cur.tap.go && !E.alive) cur.killed = true;
    if (pDown && !P.alive) pDown.kill = true;
    if (pDown && P.state !== 'down') pDown = null;
    if (!P.alive || !E.alive) {
      // 마지막 탭은 이 스텝에서 닫는다
      if (cur) close();
      break;
    }
  }
  if (cur) close();
  const win = !E.alive && P.alive ? 'P' : !P.alive && E.alive ? 'E' : 'D';
  return { seed, win, t: G.t, causeE: E.causeOfDeath ?? null, causeP: P.causeOfDeath ?? null, decapE: !!E.decapitated, decapP: !!P.decapitated, taps, aiDown, lowHits, decapLow };
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
  const t0 = Date.now();
  const R = [];
  for (let s = 0; s < n; s++) R.push(probeRound({ seed: seed0 + 37 * s, weapon, secs, plate, react, knock }));
  const all = R.flatMap((r) => r.taps);
  const pc = (a, b) => (b ? `${((100 * a) / b).toFixed(0)}%` : '-');
  console.log(`finish_probe ${weapon} 대 롱소드 AI · 상대 ${plate ? '판금' : '맨몸'} · ${n}판 × ${secs}s · entry=${FINISH.entry} mode=${FINISH.mode}${FINISH.mode === 'power25' ? ` ×${FINISH.power}` : ''} · react ${react}s${knock ? ` · ${knock}s 마다 크게 넘어뜨림` : ''}`);
  const RES = ['보통찌르기', '거둠', '헛찍음', '막힘', '상처', '끝'];
  for (const pose of ['넘어지는중', '누움', '일어나는중', '모두']) {
    const T = pose === '모두' ? all : all.filter((x) => x.pose === pose);
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
