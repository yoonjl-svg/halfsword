// ─────────────────────────────────────────────────────────────
//  fall_mech.mjs — 넘어짐을 기계 원인별로 가른다 (물리 2.0 · 10 번째 판). 재기만 한 결과 파일을 읽는다 — 시뮬레이션을 돌리지 않는다.
//
//   node tools/sim/fall_mech.mjs <fall_context --json 파일> <--ringOut 파일> [<json> <ring> …] [--rows] [--out=<요약 json>]
//
//  들어오는 것: tools/sim/fall_context.mjs --mech --ringOut 이 남긴 넘어짐마다의 앞 3 s 고리(스텝 2 개마다 하나).
//  과녁 셈 (따로 일어난 넘어짐만 · 겹침 뺌):
//   T1 닿음 없는 넘어짐 = 앞 1.5 s 상처 없음 · 본 창에 몸 닿음 · 칼 부딪힘 · 칼 맞댐이 하나도 없음
//   T2 가벼운 닿음 뒤 넘어짐 = 상처 없음 · 닿음이나 칼 부딪힘이 있었고 몸 밀림 합이 40 N·s 밑 (legs_battery 의 가슴 치기 40 N·s 와 같은 문턱)
//   T3 일어선 뒤 2 s 안에 다시 넘어짐 (상처 있든 없든)
//   상처 뒤 넘어짐은 상처 자리 · 세기 표로만.
//  기계 원인 (차례대로 처음 맞는 것 하나):
//   getup     = 일어선 지 2 s 안
//   sink:*    = 몸이 기울기 앞서 내려앉음 (골반이 0.62 m 밑으로 먼저 · 또는 까닭이 sit · low)
//               knee = 그 앞 0.3 s 에 딛은 무릎 펴는 토크가 한도의 95 % 넘음 · target = 걸음 장치의 골반 목표가 이미 낮음(0.7 m 밑) · other
//   cap:*     = 캡처 점이 받침 밖으로 나간 뒤 기욺 · nostep = 그동안 발을 안 뗌 · late = 뗀 발이 닿기 앞에 넘어짐 · short = 디딘 뒤에도 캡처 점이 받침 밖
//   tilt:*    = 캡처 점은 받침 안인데 몸통이 기욺 · aid = 선언된 기울기 도움이 상한에 닿은 스텝이 30 % 넘음 · other
//   rule      = 몸은 서 있는데 규칙(균형 게이지 0 · 발 밖 0.25 s)만 넘어뜨림 (기울기 35° 밑 · 골반 0.62 m 위)
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const args = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
const files = argv.filter((a) => !a.startsWith('--'));
const LOW = 0.62, TILT = 35, CAP = 0.03, PUSH = 40, REFALL = 2.0;

export function classify(rec, ring) {
  const R = ring.filter((x) => x.st === 'stand');
  const N = R.length;
  const dt = 1 / 60;
  if (!N) return { cause: 'none' };
  const on = Math.max(0, N - Math.round((rec.onsetBefore + 0.5) / dt));
  const W = R.slice(on);
  // 마지막 기욺 줄 · 낮음 · 캡처 밖 줄의 시작
  const runStart = (pred) => { let k = N; while (k > 0 && pred(R[k - 1])) k--; return k < N ? k : -1; };
  const iTilt = runStart((x) => x.tilt > TILT);
  const iCap = runStart((x) => (x.cap ?? 0) > CAP);
  let iLow = -1; for (let k = on; k < N; k++) if (R[k].y < LOW) { iLow = k; break; }
  const at = (k) => (k < 0 ? Infinity : k);
  const stance = (x) => ['kF', 'kB'].map((k) => x[k]).filter((l) => l && l.on);
  const krMax = (a, b) => Math.max(0, ...R.slice(Math.max(0, a), Math.max(0, b) + 1).flatMap((x) => stance(x).map((l) => l.kr)));
  const out = { iTilt, iCap, iLow, n: N };
  if (rec.afterGetup && rec.sinceStand < REFALL) out.cause = 'getup';
  else if (rec.why === 'sit' || rec.why === 'low' || (iLow >= 0 && at(iLow) <= at(iTilt) && at(iLow) <= at(iCap))) {
    const k0 = iLow >= 0 ? iLow : N - 1;
    const kr = krMax(k0 - 18, k0);
    out.kr = +kr.toFixed(2);
    out.hT = +Math.min(...R.slice(Math.max(0, k0 - 18), k0 + 1).map((x) => x.h || 9)).toFixed(2);
    out.cause = kr > 0.95 ? 'sink:knee' : out.hT < 0.7 ? 'sink:target' : 'sink:other';
  } else if (iCap >= 0 && at(iCap) <= at(iTilt) + 6) {
    // 그 줄 안의 걸음
    const C = R.slice(iCap);
    let lifted = false, landed = false, after = 0;
    for (let k = 1; k < C.length; k++) {
      const a = C[k - 1], b = C[k];
      if ((!a.F && b.F) || (!a.B && b.B)) lifted = true;
      if ((a.F && !b.F) || (a.B && !b.B)) { landed = true; after = Math.max(after, ...C.slice(k, k + 4).map((x) => x.cap ?? 0)); }
    }
    const swingAtStart = !!(C[0].F || C[0].B);
    out.cause = landed && after > CAP ? 'cap:short' : lifted || swingAtStart ? 'cap:late' : 'cap:nostep';
    out.capMax = +Math.max(...C.map((x) => x.cap ?? 0)).toFixed(2);
  } else if (iTilt >= 0) {
    const T = R.slice(Math.max(0, iTilt - 30));
    const sat = T.filter((x) => (x.aidT ?? 0) >= 0.99).length / Math.max(1, T.length);
    out.aidSat = +sat.toFixed(2);
    out.cause = sat > 0.3 ? 'tilt:aid' : 'tilt:other';
  } else out.cause = 'rule';
  // 앞의 꼴
  const O = R[Math.min(N - 1, Math.max(0, N - Math.round(rec.onsetBefore / dt)))];
  out.stroke = O.stroke; out.reqK = O.reqK ?? null; out.y0 = +O.y.toFixed(2);
  out.yMinWin = +Math.min(...W.map((x) => x.y)).toFixed(2);
  out.krWin = +krMax(on, N - 1).toFixed(2);
  out.aidWin = +(W.filter((x) => (x.aidT ?? 0) >= 0.99).length / Math.max(1, W.length)).toFixed(2);
  out.ankSat = +(W.filter((x) => stance(x).some((l) => l.as)).length / Math.max(1, W.length)).toFixed(2);
  out.hipSat = +(W.filter((x) => stance(x).some((l) => l.hs)).length / Math.max(1, W.length)).toFixed(2);
  return out;
}

export function contactOf(r) {
  const any = r.touchSteps > 0 || r.joltMax > 0 || r.bindSteps > 0;
  return !any ? 'none' : r.pushSum >= PUSH ? 'big' : r.touchSteps > 0 ? 'light' : 'clash';
}

export function load(pairs) {
  const rows = [];
  let fights = 0;
  for (const [fj, rj] of pairs) {
    const F = JSON.parse(readFileSync(fj, 'utf8'));
    const RG = JSON.parse(readFileSync(rj, 'utf8'));
    fights += F.fights;
    const byKey = new Map(RG.falls.map((x) => [x.key, x]));
    for (const r of F.falls) {
      if (r.dup) continue;
      const g = byKey.get(`${r.seed}:${r.who}:${r.t}`);
      const m = g ? classify(r, g.ring) : { cause: 'noring' };
      rows.push({ ...r, mech: m, contact: contactOf(r) });
    }
  }
  return { rows, fights };
}

export function targets(rows) {
  const self = rows.filter((r) => r.self);
  const T1 = self.filter((r) => r.contact === 'none');
  const T2 = self.filter((r) => r.contact === 'light' || r.contact === 'clash');
  const T3 = rows.filter((r) => r.afterGetup && r.sinceStand < REFALL);
  return { all: rows.length, self: self.length, T1: T1.length, T2: T2.length, T3: T3.length, T123: new Set([...T1, ...T2, ...T3]).size, big: self.filter((r) => r.contact === 'big').length, wound: rows.length - self.length };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const pairs = []; for (let i = 0; i + 1 < files.length; i += 2) pairs.push([files[i], files[i + 1]]);
  const { rows, fights } = load(pairs);
  const cnt = (L, f) => { const m = new Map(); for (const r of L) { const k = f(r); m.set(k, (m.get(k) ?? 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '); };
  const t = targets(rows);
  console.log(`■ 싸움 ${fights} 판 · 따로 일어난 넘어짐 ${t.all} (상처 없음 ${t.self} · 상처 뒤 ${t.wound})`);
  console.log(`  T1 닿음 없음 ${t.T1} · T2 가벼운 닿음 · 칼 부딪힘 뒤 ${t.T2} · T3 일어선 뒤 2 s 안 ${t.T3} · (T1∪T2∪T3 ${t.T123}) · 큰 밀림(40 N·s 넘음) 뒤 ${t.big}`);
  const self = rows.filter((r) => r.self);
  console.log(`  기계 원인 (상처 없음 ${self.length}): ${cnt(self, (r) => r.mech.cause)}`);
  console.log(`  기계 원인 × 닿음 (상처 없음): ${cnt(self, (r) => `${r.mech.cause}|${r.contact}`)}`);
  console.log(`  기계 원인 × 제 칼 (상처 없음): ${cnt(self, (r) => `${r.mech.cause}|${r.mech.stroke}`)}`);
  console.log(`  기계 원인 × 무기 (상처 없음): ${cnt(self, (r) => `${r.mech.cause}|${r.weapon}`)}`);
  console.log(`  기계 원인 (전체 ${rows.length}): ${cnt(rows, (r) => r.mech.cause)}`);
  const W = rows.filter((r) => !r.self);
  console.log(`  상처 뒤 ${W.length}: 자리 ${cnt(W, (r) => r.wound?.zone ?? '-')} | 세기 ${cnt(W, (r) => { const e = r.wound?.energy ?? 0; return e < 50 ? '<50J' : e < 100 ? '50~100J' : e < 200 ? '100~200J' : '200J+'; })} | 판정 ${cnt(W, (r) => r.why)} | 자리 × 판정 ${cnt(W, (r) => `${r.wound?.zone ?? '-'}|${r.why}`)}`);
  if (args.rows) for (const r of rows) console.log(`   ${String(r.seed).padStart(3)} ${r.who} ${r.weapon.padEnd(10)} t ${String(r.t).padStart(5)} ${r.self ? '스스로' : '상처  '} ${r.why.padEnd(8)} ${r.mech.cause.padEnd(11)} 닿음 ${r.contact.padEnd(5)} 밀림 ${r.pushSum} 부딪힘 ${r.joltMax} · 선 지 ${r.sinceStand} · 칼 ${r.mech.stroke} 부탁 ${r.mech.reqK ?? '-'} · 골반 시작 ${r.mech.y0} 최저 ${r.mech.yMinWin} · 무릎 ÷ 한도 ${r.mech.krWin}${r.mech.kr != null ? ' (내려앉기 앞 ' + r.mech.kr + ' · 골반 목표 ' + r.mech.hT + ')' : ''} · 도움 상한 몫 ${r.mech.aidWin} · 발목 한도 ${r.mech.ankSat} 엉덩이 한도 ${r.mech.hipSat}${r.mech.capMax != null ? ' · 캡처 밖 최고 ' + r.mech.capMax : ''}${r.wound ? ` · 상처 ${r.wound.zone} ${r.wound.energy} J` : ''}`);
  if (args.out) writeFileSync(String(args.out), JSON.stringify({ fights, targets: t, rows: rows.map((r) => ({ seed: r.seed, who: r.who, weapon: r.weapon, t: r.t, self: r.self, why: r.why, contact: r.contact, pushSum: r.pushSum, afterGetup: r.afterGetup, sinceStand: r.sinceStand, wound: r.wound, mech: r.mech })) }, null, 1));
}
