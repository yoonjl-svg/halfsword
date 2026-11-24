// t_contact.mjs — 접촉 표: 칼날이 가장 빠른 순간에 토막을 치면 무엇이 전해지나. 결정적. 약 1 분.
//   node t_contact.mjs
//   과녁: 자유 5 kg · 자유 20 kg · 스프링 토막(2 kg · 20 kN/m · 감쇠비 0.5) · 무른 스프링(2 kg · 5 kN/m). 정의 · 식은 contact.mjs 머리말.
//   (ii) 는 칸마다 켜지는 때를 다시 찾는다(tune.mjs searchII). (i) 은 gains_i.json. (iii) 은 게임 값(닻 yaw 100 · 손목 상한 26 / 22).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRapier, HERE, fmt, WEAPONS } from './lib.mjs';
import { runCut, FAMS } from './cuts.mjs';
import { runGame } from './game.mjs';
import { searchII, gainsI } from './tune.mjs';
import { contactCase } from './contact.mjs';
const R = await loadRapier();
const GI = gainsI();
const KO = { longsword: '롱소드', zweihander: '츠바이핸더', uchigatana: '우치가타나', rapier: '레이피어' };
const sN = { i: '(i) 끝점 힘', ii: '(ii) 차례', iii: '(iii) 게임 꼴' };
const TG = [{ name: 'f5', mass: 5 }, { name: 'f20', mass: 20 }, { name: 's20', mass: 2, k: 20000 }, { name: 's5', mass: 2, k: 5000 }];
const L = []; const P = (x) => { L.push(x); };
const delayCache = new Map();
function runner(style, base) {
  if (style === 'iii') return (o) => runGame(R, { ...base, yawCap: 100, ...o });
  if (style === 'i') return (o) => runCut(R, { ...base, yawCap: 135, style: 'i', ...GI, ...o });
  const key = JSON.stringify(base); let d = delayCache.get(key);
  if (!d) { d = searchII(R, { ...base, yawCap: 135 }); delayCache.set(key, d); }
  return (o) => runCut(R, { ...base, yawCap: 135, style: 'ii', tSh: d.tSh, tEl: d.tEl, tWr: d.tWr, ...o });
}
const formula = (c) => 0.5 * (c.dry.mFree + 0.3) * c.dry.v0 * c.dry.v0 * 2.0;
const t0 = Date.now(); const tick = (s) => process.stderr.write(`\r${s} · ${fmt((Date.now() - t0) / 1000, 0)} s        `);
const json = [];
const keep = (tag, base, style, relax, c) => json.push({ tag, ...base, style, relax, v0: c.dry.v0, mFree: c.dry.mFree, formula: formula(c), res: Object.fromEntries(Object.entries(c.res).map(([k, r]) => [k, { ...r, recs: undefined }])) });

// ── 표 C1: 방식 × 획 × 감기 (롱소드 · 두 손 · 손목 기본 · 계속 밂) ──
P('# 표 C1 — 닿을 때 전해지는 것: 롱소드 · 두 손 · 칼날 70 % 점 · 칼날 70 % 가 가장 빠른 스텝에 닿음 · 근육은 같은 법칙으로 계속 밂');
P('#  유효 질량 = 첫 스텝(8 ms) 충격량 ÷ (안 닿은 판과의 칼날 점 빠르기 차) · 50 ms 값 = 누적 충격량 ÷ 처음 빠르기에서 잃은 빠르기 · 상처 일 E_w = 닿은 자리에서 흩어진 에너지(되튐 0) · 미는 힘 = 첫 스텝 뒤 8 ~ 50 ms 평균');
P('#  판정식 = ½·(칼 자유 유효 질량 + 0.3)·v₀²·2.0 (게임 combat.js) · 물리 몫 = E_w(20 kg) ÷ 판정식');
P('감기 | 획 | 방식 | 닿는 빠르기 v₀ m/s | 칼 자유 유효 질량 kg | 유효 질량 8 ms (5 kg / 20 kg 토막) kg | 50 ms (20 kg) | 충격량 J₁ (5 / 20) N·s | 상처 일 E_w (5 / 20) J | 토막이 받은 운동 에너지 (5 / 20) J | 미는 힘 (20 kg) N | 스프링 20 kN/m: 힘 최고 N · 눌림 cm · 토막이 받은 일 J | 무른 스프링 5 kN/m: 힘 N · cm · J | 판정식 J | 물리 몫');
P('---|---|---|---|---|---|---|---|---|---|---|---|---|---|---');
const c1 = {};
for (const size of ['small', 'large']) for (const fam of ['diag', 'vert', 'horiz']) for (const style of ['i', 'ii', 'iii']) {
  const base = { weapon: 'longsword', fam, size };
  const c = contactCase(runner(style, base), TG); const r = c.res; c1[`${size}|${fam}|${style}`] = c; keep('C1', base, style, null, c);
  P(`${size === 'small' ? '작게' : '크게'} | ${FAMS[fam].ko} | ${sN[style]} | ${fmt(c.dry.v0)} | ${fmt(c.dry.mFree, 2)} | ${fmt(r.f5.meff1, 2)} / ${fmt(r.f20.meff1, 2)} | ${fmt(r.f20.meff6, 2)} | ${fmt(r.f5.J1, 1)} / ${fmt(r.f20.J1, 1)} | ${fmt(r.f5.Ew, 0)} / ${fmt(r.f20.Ew, 0)} | ${fmt(r.f5.Wb, 1)} / ${fmt(r.f20.Wb, 1)} | ${fmt(r.f20.push, 0)} | ${fmt(r.s20.Fspring, 0)} · ${fmt(r.s20.xMax * 100, 1)} · ${fmt(r.s20.Wb, 1)} | ${fmt(r.s5.Fspring, 0)} · ${fmt(r.s5.xMax * 100, 1)} · ${fmt(r.s5.Wb, 1)} | ${fmt(formula(c), 0)} | ${fmt(r.f20.Ew / formula(c), 2)}`);
  tick('C1 ' + L.length);
}
// 요약 줄
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
P(''); P('# 표 C1-요약 — 방식마다 (세 획 가운데값): 닿는 빠르기 · 유효 질량(20 kg · 8 ms) ÷ 칼 자유 유효 질량 · 상처 일 E_w(20 kg) · 같은 빠르기의 판정식 · 물리 몫 · 미는 힘');
P('감기 | 방식 | v₀ m/s | 유효 질량 ÷ 칼 자유 | 유효 질량 ÷ (칼 자유 + 0.3) | E_w J | 판정식 J | 물리 몫 | 미는 힘 N');
P('---|---|---|---|---|---|---|---|---');
for (const size of ['small', 'large']) for (const style of ['i', 'ii', 'iii']) {
  const cs = ['diag', 'vert', 'horiz'].map((f) => c1[`${size}|${f}|${style}`]);
  P(`${size === 'small' ? '작게' : '크게'} | ${sN[style]} | ${fmt(med(cs.map((c) => c.dry.v0)))} | ${fmt(med(cs.map((c) => c.res.f20.meff1 / c.dry.mFree)), 2)} | ${fmt(med(cs.map((c) => c.res.f20.meff1 / (c.dry.mFree + 0.3))), 2)} | ${fmt(med(cs.map((c) => c.res.f20.Ew)), 0)} | ${fmt(med(cs.map((c) => formula(c))), 0)} | ${fmt(med(cs.map((c) => c.res.f20.Ew / formula(c))), 2)} | ${fmt(med(cs.map((c) => c.res.f20.push)), 0)}`);
}

// ── 표 C2: 손목 한도 · 손 수 · 닿을 때 몸통 ──
P(''); P('# 표 C2 — 무엇이 유효 질량 · 미는 힘을 바꾸나: 롱소드 · 빗겨. 손목 한도(획 내내 그 값 · N·m) × 손 수 × 닿는 순간부터의 근육(계속 밂 / 몸통 + 땅만 풂 / 온몸 풂 = 무게 버팀 토크만)');
P('#  칸 = 닿는 빠르기 v₀ m/s · 유효 질량 8 ms / 50 ms kg (20 kg 토막) · 충격량 J₁ N·s · 미는 힘 N · 스프링 20 kN/m 힘 최고 N');
P('감기 | 방식 | 손 | 손목 한도 | 계속 밂 | 몸통 + 땅 풂 | 온몸 풂');
P('---|---|---|---|---|---|---');
const cell = (c) => { const r = c.res; return `${fmt(c.dry.v0)} · ${fmt(r.f20.meff1, 2)} / ${fmt(r.f20.meff6, 2)} · ${fmt(r.f20.J1, 1)} · ${fmt(r.f20.push, 0)} · ${fmt(r.s20.Fspring, 0)}`; };
for (const size of ['small', 'large']) for (const style of ['ii', 'i', 'iii']) for (const twoHand of [true, false]) for (const wristCap of [12, 25]) {
  const base = { weapon: 'longsword', fam: 'diag', size, twoHand, wristCap };
  const run = runner(style, base); const cells = [];
  for (const relax of style === 'iii' ? [null] : [null, 'trunk', 'limp']) { const c = contactCase(run, TG, { relax }); keep('C2', base, style, relax, c); cells.push(cell(c)); }
  P(`${size === 'small' ? '작게' : '크게'} | ${sN[style]} | ${twoHand ? '두 손' : '한 손'} | ${wristCap} | ${cells[0]} | ${cells[1] ?? '– (엔진 모터라 못 풂)'} | ${cells[2] ?? '–'}`);
  tick('C2 ' + L.length);
}

// ── 표 C3: 무기 ──
P(''); P('# 표 C3 — 무기마다 (빗겨 · 작게 감기 = 지금 게임 꼴의 감기 / 크게): 닿는 빠르기 · 칼 자유 유효 질량 · 유효 질량 8 ms(20 kg) · 충격량 · 상처 일 · 판정식 · 물리 몫 · 미는 힘');
P('무기 | 손 | 감기 | 방식 | v₀ m/s | 칼 자유 kg | 유효 질량 8 ms kg | J₁ N·s | E_w J | 판정식 J | 물리 몫 | 미는 힘 N | 스프링 20 kN/m 힘 N');
P('---|---|---|---|---|---|---|---|---|---|---|---|---');
for (const weapon of ['longsword', 'zweihander', 'uchigatana', 'rapier']) for (const size of ['small', 'large']) for (const style of ['ii', 'iii']) {
  const base = { weapon, fam: 'diag', size };
  const c = contactCase(runner(style, base), TG); const r = c.res; keep('C3', base, style, null, c);
  P(`${KO[weapon]} | ${WEAPONS[weapon].twoHand ? '두 손' : '한 손'} | ${size === 'small' ? '작게' : '크게'} | ${sN[style]} | ${fmt(c.dry.v0)} | ${fmt(c.dry.mFree, 2)} | ${fmt(r.f20.meff1, 2)} | ${fmt(r.f20.J1, 1)} | ${fmt(r.f20.Ew, 0)} | ${fmt(formula(c), 0)} | ${fmt(r.f20.Ew / formula(c), 2)} | ${fmt(r.f20.push, 0)} | ${fmt(r.s20.Fspring, 0)}`);
  tick('C3 ' + L.length);
}

// ── 표 C4: 칼날의 어디로 치나 · 풀이 반복 수 ──
P(''); P('# 표 C4 — 칼날의 어디로 치나 (롱소드 · 빗겨 · 20 kg 토막 · 같은 순간): 칼 자유 유효 질량 대 잰 유효 질량(8 ms / 50 ms) — 손에 가까울수록 팔 · 몸이 실린다. 괄호 = 엔진 풀이 반복 12 × 내부 PGS 8 로 다시 잰 8 ms 값(풀이가 덜 풀려 작게 읽히는 것이 아닌지 확인)');
P('방식 · 감기 | 칼날 자리 % | 그 점 빠르기 m/s | 칼 자유 kg | 유효 질량 8 ms kg | 50 ms kg | ÷ 칼 자유 | J₁ N·s | E_w J | 미는 힘 N');
P('---|---|---|---|---|---|---|---|---|---');
for (const [style, size] of [['ii', 'large'], ['ii', 'small'], ['iii', 'small']]) for (const frac of [0.1, 0.3, 0.5, 0.7, 0.9]) {
  const base = { weapon: 'longsword', fam: 'diag', size };
  const run = runner(style, base);
  const c = contactCase(run, [TG[1]], { frac }); const r = c.res.f20; keep('C4', { ...base, frac }, style, null, c);
  const c2 = style === 'iii' ? null : contactCase((o) => run({ iters: 12, pgs: 8, ...o }), [TG[1]], { frac });
  P(`${sN[style]} · ${size === 'small' ? '작게' : '크게'} | ${fmt(frac * 100, 0)} | ${fmt(c.dry.v0)} | ${fmt(c.dry.mFree, 2)} | ${fmt(r.meff1, 2)}${c2 ? ` (${fmt(c2.res.f20.meff1, 2)} · 그 판의 v₀ ${fmt(c2.dry.v0)})` : ''} | ${fmt(r.meff6, 2)} | ${fmt(r.meff1 / c.dry.mFree, 2)} | ${fmt(r.J1, 1)} | ${fmt(r.Ew, 0)} | ${fmt(r.push, 0)}`);
  tick('C4 ' + L.length);
}
// 검산
const chk = Math.max(...json.flatMap((j) => ['f5', 'f20'].map((k) => j.res[k]?.chk ?? 0)));
const jlat = Math.max(...json.flatMap((j) => Object.values(j.res).map((r) => r.Jlat)));
P(''); P(`# 검산: 자유 토막에서 엔진 접촉 힘 사건 × dt 와 토막 운동량 변화의 차 최고 ${fmt(chk, 3)} N·s (스프링 토막의 충격량은 사건 값이라 이만큼 크게 읽힐 수 있다) · 법선 밖 충격량 최고 ${fmt(jlat, 4)} N·s (마찰 0) · 닿기 전 상태는 안 닿은 판과 같음(다르면 멈춤)`);
process.stderr.write('\n');
writeFileSync(join(HERE, 'out/contact.json'), JSON.stringify(json));
writeFileSync(join(HERE, 'out/contact.txt'), L.join('\n') + '\n'); console.log(L.join('\n'));
