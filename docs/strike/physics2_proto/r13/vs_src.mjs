// ─────────────────────────────────────────────────────────────
//  vs_src.mjs — 오늘 게임을 잰 자료(r12_sources.md §3 · §8)의 수 옆에 놓는 재기 (물리 2.0 열셋째 판 · 재기만 한다 — 몸에 아무것도 걸지 않는다)
//   r11 chain_line.mjs 의 장면 꼴(서 있는 과녁 · 손가락 길 autoGuard · handHeld · inputActive / AI 대 AI)을 따르고, 자료와 견줄 칸을 더 뽑는다.
//  장면:
//   cut     : 서 있는 과녁 · 사람 손가락 길 · 롱소드 — --cut=desc(내려베기: 세로 지붕→바보 · 사선 어깨 지붕→왼 바꿈 반반) | horiz(옆 자세 오른→왼)
//   cutai   : AI 대 AI 롱소드 — --cut=desc(zornhau · zornhauL · oberhau) | horiz(zwerch · zwerchL · zwerchAbtritt — AI 가 실제로 고르는 가로 베기)
//   thrust  : 서 있는 과녁 · 사람 탭 찌르기(main.js 의 탭 = skill.thrust()) — --weapon=rapier|longsword · 겨눔 쟁기 · 황소 · 늘어뜨림 가운데 하나
//   thrustai: AI 대 AI — rapier: 탭 찌르기 길(skill.thrusts 가 는 순간 · 쓰러진 상대 찍기 빼고) · longsword: stich* 기술(자세 지도 길 · 휘두르기 시작)
//  node vs_src.mjs --root=<나무> --scene=cut|cutai|thrust|thrustai [--cut=desc|horiz] [--weapon=rapier|longsword] [--seeds=3001-3060] [--secs=30] [--json=파일]
//  시작(첫 움직임) o: 사람 길 = 손가락이 움직이기 시작한 스텝(베기) · 탭 스텝(찌르기). AI 길 = 휘두르기(skill.swinging)가 켜진 스텝 (rapier AI = 탭 스텝).
//   AI 는 기술이 정해진 스텝 oT(들기 · 감기 · 기다림 포함)도 적는다 — 칸 이름 끝 2 (tHit2 · tTip2 · tLift2) 가 oT 기준.
//  발 닿음 = 발 토막이 땅과 엔진 접촉 충격량 > 0. 뜸 = 3 스텝 내리 떨어짐 · 디딤 = 3 스텝 내리 닿음. 앞발 = 시작 때 앞 자리가 더 앞인 발.
//  뒷다리 앞 밀기 ÷ 체중: pushCmd = 다리 제어기가 뒷발에 바란 수평 땅 반력(관절 토크로 냄) · pushAct = 앞발이 뜨고 뒷발만 닿은 스텝의 몸 전체 앞 운동량 변화율(엔진이 실제 준 밖 힘 · 9 스텝 평균).
//  재는 부분(표본 · 획 셈 · 장면)은 r20 에 tools/sim/wb_measure.mjs 로 옮겼다 — 관문(tools/sim/wb_gate.mjs)과 한 벌을 쓴다. 이 대본의 정의와 표는 그대로다.
// ─────────────────────────────────────────────────────────────
import { makeMeasure, seedList, q, cnt, summ } from '../../../../tools/sim/wb_measure.mjs';
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { runCut, runCutAI, runThrust, runThrustAI } = makeMeasure(H);

const scene = String(args.scene ?? 'cut'); const seeds = seedList(args.seeds ?? '3001-3040'); const cut = String(args.cut ?? 'desc'); const weapon = String(args.weapon ?? 'rapier'); const secs = +(args.secs ?? 30);
if (/estoc|sabre/.test(weapon)) throw new Error('이 무기는 쓰지 않는다');
let rows = [];
for (const s of seeds) {
  if (scene === 'cut') rows.push(...runCut(s, cut)); else if (scene === 'cutai') rows.push(...runCutAI(s, cut, secs));
  else if (scene === 'thrust') rows.push(...runThrust(s, weapon)); else if (scene === 'thrustai') rows.push(...runThrustAI(s, weapon, secs));
}
const KC = ['tHit', 'tHit2', 'tipPk', 'tTip', 'tTip2', 'tLift', 'tLift2', 'tLand', 'footGap', 'pelHit', 'pelPk', 'tPel', 'pelMinusLand'];
const KT = ['tHit', 'tHit2', 'handPk', 'tHand', 'pelPkT', 'ratio', 'comAtHand', 'pushCmd', 'pushAct', 'wHip', 'wKnee', 'wAnk', 'wHipv', 'wKneev', 'wAnkv', 'tHandStart', 'tFrontLift', 'handFoot', 'tipPk', 'tLand', 'footGap'];
const S = summ(rows, /thrust/.test(scene) ? KT : KC);
const gaps = rows.map((r) => r.footGap).filter((x) => x != null); S.gap50 = gaps.length ? gaps.filter((x) => Math.abs(x) <= 50).length / gaps.length : NaN;
S.hitN = rows.filter((r) => r.tHit != null).length; S.liftN = rows.filter((r) => r.tLift != null).length;
if (/thrust/.test(scene)) { const hr = rows.filter((r) => r.wHip != null); S.order = hr.filter((r) => r.wHip <= r.wKnee && r.wKnee <= r.wAnk).length + '/' + hr.length; const hf = rows.filter((r) => r.handFoot != null); S.armFirst = hf.filter((r) => r.handFoot > 0).length + '/' + hf.length; }
const tech = {}; for (const r of rows) if (r.tech) tech[r.tech] = (tech[r.tech] ?? 0) + 1; for (const r of rows) if (r.form) tech[r.form] = (tech[r.form] ?? 0) + 1; S.forms = tech;
const p = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
console.log(`${scene} ${cut} ${scene.startsWith('thrust') ? weapon : 'longsword'} · 씨앗 ${seeds[0]}~${seeds[seeds.length - 1]} · 획 ${S.n} · 맞음 ${S.hitN} · 발 뜸 ${S.liftN} · 꼴 ${JSON.stringify(tech)}`);
for (const k of Object.keys(S)) if (S[k]?.med !== undefined) console.log(`  ${k.padEnd(13)} n ${String(S[k].n).padStart(3)} · 가운데 ${p(S[k].med)} · 10-90 % ${p(S[k].p10)} ~ ${p(S[k].p90)}`);
console.log(`  발 디딤 − 닿음 ±50 ms 안 ${p(100 * S.gap50, 0)} %` + (S.order ? ` · 엉덩→무릎→발목 차례 ${S.order} · 손이 앞발보다 먼저 ${S.armFirst}` : ''));
if (args.json) writeFileSync(String(args.json), JSON.stringify({ args, S, rows }));
