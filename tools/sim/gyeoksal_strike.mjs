// 동방 막아 죽이기 (격살 · 10/22) 한 칼 세기 — 받은 자세마다 겨눈 곳 · 맞은 곳 · 절단 · 깊은 출혈 · 참수 · 갑옷에 막힘 (docs/strike/chinese_gyeoksal_2026-10-22.md §4). 읽기만.
//  판: 플레이어(동방 칼) · 상대(AI 를 멈춰 기본 자세로 섬 — 칼을 든 채 가만히) · 가슴 간격 = 맞닿기 + D(m) · 1.0 s 서서 자리를 잡은 뒤 격살 한 칼을 곧장 낸다
//   (창 · 조건 없이 skill.secret({ S: 격살, ctx: { slot: 자세 } }) — 판정 · 실행은 게임 함수 그대로). 상대 겉모습 셋: 맨몸 · 판금(하인리히 겉모습) · 투구(케틀햇).
//  깊은 출혈 = 상처 하나의 심각도 ≥ 1.0 (절단 문턱 COMBAT.limbSeverSeverity 와 같은 '살 문턱 위 90 J' — 재는 이름일 뿐 게임 값 아님) — 그 상처 출혈(혈액 몫 / s)도 적는다.
//  배율 'hit' = 다른 비기와 같은 hitMul 1.3 · SHARE=0.5 | 0.6 | 1 (격살 칼끝 빠르기 몫 — SECRET.gyeoksal.share) · ARM=down (어거 길) · STANCE= · LOOK=
//  node tools/sim/gyeoksal_strike.mjs [무기 qinggang] [배율들 1,2.5] [상대 무기들 longsword,uchigatana,qinggang,sabre] [간격 몫 -0.1,0,0.2]   ·   CSV=1 줄마다
//   (상대 AI 를 멈춰 난수가 끼지 않으니 씨앗 대신 상대 무기 — 칼 든 자세가 무기마다 달라 팔 · 칼이 다른 자리에 선다)
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { LOOKS } from '../../src/looks.js';
import { TRADITIONS } from '../../src/schools.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const weapon = process.argv[2] || 'qinggang';
const pows = (process.argv[3] || '1,2.5').split(',').map((x) => (x === 'hit' || x === 'finish' ? x : Number(x))); // 'hit' = 다른 비기와 같은 결정타 hitMul 1.3 (판정 에너지) · 'finish' = FINISH.power
const foes = (process.argv[4] || 'longsword,uchigatana,qinggang,sabre').split(',');
const gaps = (process.argv[5] || '-0.1,0,0.2').split(',').map(Number);
const looks = { 맨몸: LOOKS.enemy, 판금: CHARACTERS_BY_ID.heinrich.look, 투구: LOOKS.player }; // 판금 = 하인리히 인물 겉모습(판 13 부위 · 투구 없음) · 투구 = 케틀햇
const stances = (process.env.STANCE || 'geojeong,eogeo,yoryak,bongdu').split(','); // STANCE= 로 고름 · LOOK=맨몸,판금 처럼 겉모습도
const KO = { geojeong: '거정 → 머리', eogeo: '어거 → 팔', yoryak: '요략 → 다리', bongdu: '봉두 → 허파' };
if (+process.env.SHARE > 0) CONFIG.SECRET.gyeoksal.share = +process.env.SHARE; // 시험: 격살 칼끝 빠르기 몫 (기본 cnFastShare)
if (process.env.ARM) CONFIG.SECRET.gyeoksal.armPath = process.env.ARM; // 시험: 어거 길 'down'
const GK = TRADITIONS.chinese.playerSecret;
if (GK?.name !== 'gyeoksal') throw new Error('격살이 꺼져 있음 (SECRET.gyeoksal.on)');

const out = [];
for (const pw of pows) {
  CONFIG.SECRET.gyeoksal.power = pw;
  for (const [lk, look] of Object.entries(looks).filter(([k]) => !process.env.LOOK || process.env.LOOK.split(',').includes(k))) {
    for (const st of stances) {
      const R = { n: 0, fired: 0, hit: 0, blocked: 0, aimHit: 0, sever: 0, deep: 0, decap: 0, dead: 0, armor: 0, parts: {}, sev: [], bleed: [] };
      for (const fw of foes) {
        const seed = 1;
        for (const gp of gaps) {
          const G0 = newRound({ weapon, weapon2: fw, seed });
          const contact = G0.player.swordArt.measure.contact;
          const G = newRound({ weapon, weapon2: fw, seed, look2: look, gap: contact + gp });
          const P = G.player;
          const E = G.enemy;
          G.ai.update = () => {}; // 상대는 기본 자세로 가만히 (칼을 든 채)
          P.skill.corr = CONFIG.SKILL.corr;
          P.skill.corrTip = CONFIG.SKILL.corrTip;
          P.skill.autoGuard = true;
          while (G.t < 1.0) G.step();
          const w0 = E.wounds.length;
          const det0 = new Set(E.detachedParts ?? []);
          R.n++;
          const ok = P.skill.secret({ S: GK, ctx: { slot: st, stance: st } });
          if (!ok) continue;
          R.fired++;
          const t0 = G.t;
          while (G.t < t0 + 1.2 && P.skill.sec) G.step();
          const res = P.instantResult;
          const nw = E.wounds.slice(w0);
          const sever = [...(E.detachedParts ?? [])].filter((p) => !det0.has(p));
          const deep = nw.filter((w) => w.severity >= 1.0);
          if (res?.hit) R.hit++;
          if (res?.blocked) R.blocked++;
          if (!res?.hit && !res?.blocked) R.miss = (R.miss ?? 0) + 1;
          const part = res?.part ?? (res?.blocked ? '칼에 막힘' : '헛침');
          R.parts[part] = (R.parts[part] ?? 0) + 1;
          const want = { geojeong: ['head', 'chest'], eogeo: ['uarmS', 'farmS', 'uarmO', 'farmO'], yoryak: ['thighF', 'shinF', 'thighB', 'shinB', 'footF', 'footB'], bongdu: ['chest', 'abdomen'] }[st];
          if (res?.hit && want.includes(res.part)) R.aimHit++;
          if (sever.length) R.sever++;
          if (deep.length) R.deep++;
          if (E.decapitated) R.decap++;
          if (!E.alive || E.state === 'dead') R.dead++;
          if (res?.hit && !nw.length) R.armor++; // 몸에 닿았는데 칼날 상처 없음 (판금 · 투구 · 옷 · 살 문턱에 막혀 멍)
          for (const w of nw) (R.sev.push(w.severity), R.bleed.push(w.bleed));
          for (const w of nw) { const tg = E.limbSeverTarget?.(w); if (tg) (R.jd ??= []).push(tg.dist); } // 팔다리 상처: 가장 가까운 관절까지 (절단은 COMBAT.limbSeverRadius 안)
          if (process.env.CSV) console.log(['row', pw, lk, st, fw, gp, res?.hit ? 1 : 0, res?.blocked ? 1 : 0, res?.part ?? '-', res?.zone ?? '-', res?.type ?? '-', (res?.Emax ?? 0).toFixed(0), (res?.sev ?? 0).toFixed(2), sever.join('+') || '-', E.decapitated ? 'decap' : '-', E.causeOfDeath ?? '-'].join(','));
        }
      }
      const pct = (x) => `${x}/${R.fired}`;
      const avg = (a) => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : '-');
      out.push(`× ${pw} | ${lk.padEnd(3)} | ${KO[st].padEnd(9)} | 맞힘 ${pct(R.hit)} (겨눈 곳 ${R.aimHit}) · 칼에 막힘 ${R.blocked} · 헛침 ${R.miss ?? 0} · 갑옷·문턱에 막혀 멍 ${R.armor} | 절단 ${R.sever} · 깊은 출혈 ${R.deep} · 참수 ${R.decap} · 죽음 ${R.dead} | 심각도 평균 ${avg(R.sev)} · 출혈 평균 ${avg(R.bleed)} · 관절까지 ${avg(R.jd ?? [])} m | 맞은 곳 ${JSON.stringify(R.parts)}`);
    }
  }
}
console.log(`격살 한 칼 (빠르기 몫 ${CONFIG.SECRET.gyeoksal.share ?? CONFIG.SECRET.cnFastShare} · 어거 길 ${CONFIG.SECRET.gyeoksal.armPath}) — ${weapon} · 상대(멈춤) ${foes.join(',')} · 간격 맞닿기 + ${gaps.join(',')} m`);
for (const l of out) console.log(l);
