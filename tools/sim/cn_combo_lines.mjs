// 중국 막기 연환 — 오는 줄 재기 (10/12 사장님 '타격 대부분이 가로로 들어오더라' — docs/strike/cn_combo_play_2026-10-12.md §2). 읽기만.
//  플레이어 몸 = 청강검(중국), 맞닿기 + 0.2 m 까지 걸어 들고 막기 버튼을 누른 채 버팀(PlayerParryGuard held — main.js 와 같은 함수, 물리 스텝마다 player.step 앞) ·
//  플레이어 비기 창(PlayerSecretWatch — main.js 와 같은 함수)도 스텝마다 부른다. 상대 = AI(무기 인자), 걸음은 AI 것.
//  센 것: ① 막기 버튼이 정한 줄 (threatNow — 공격 한 번에 한 번, pg.stats.lines) · ② 칼이 새로 맞닿은 막기 성공(pc.ok)마다 그때 손이 간 줄(pg.line) ·
//         ③ 정한 자세(pc.slot)·창(opened) 수. 창에서 내지는 않는다(재기만).
//  실행: node tools/sim/cn_combo_lines.mjs [상대 무기들 longsword,qinggang,uchigatana,sabre] [씨앗 수 6] [초 30]
import { newRound, DT } from './harness_m.mjs';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerSecretWatch } from '../../src/secret.js';

const foes = (process.argv[2] || 'longsword,qinggang,uchigatana,sabre').split(',');
const N = +(process.argv[3] || 6);
const SIM = +(process.argv[4] || 30);
const LINES = ['highL', 'highC', 'highR', 'lowL', 'lowR', 'thrust', 'point'];
const all = { th: {}, ok: {}, slot: 0, win: 0, okN: 0 };
const row = (o) => {
  const n = LINES.reduce((s, k) => s + (o[k] ?? 0), 0);
  return LINES.map((k) => `${k} ${o[k] ?? 0}${n ? ` (${Math.round((100 * (o[k] ?? 0)) / n)}%)` : ''}`).join(' · ') + ` · 합 ${n}`;
};
for (const fw of foes) {
  const A = { th: {}, ok: {}, slot: 0, win: 0, okN: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const G = newRound({ walls: true, weapon: 'qinggang', weapon2: fw, seed });
    const p = G.player;
    const pg = new PlayerParryGuard(p, G.enemy);
    const ps = new PlayerSecretWatch(p, G.enemy);
    pg.held = true;
    let okSeen = 0;
    G.before = () => {
      ps.update(DT, !!p.skill.sec);
      pg.step(DT);
      p.inputActive = pg.active;
      p.handHeld = pg.active;
      p.move.set(0, p.foeDistance() > p.swordArt.measure.contact + 0.2 ? 1 : 0); // 브라우저 대본과 같게: 맞닿기 + 0.2 m 까지만 걸어 든다 (tools/browser/parry_button_probe.mjs)
      const P = ps.pc;
      if (P && P.ok > okSeen) {
        okSeen = P.ok;
        const k = pg.active ? pg.line : 'point';
        A.ok[k] = (A.ok[k] ?? 0) + 1;
      }
    };
    for (let i = 0; i < SIM / DT; i++) {
      G.step();
      if (!p.alive || !G.enemy.alive) break;
    }
    for (const [k, v] of Object.entries(pg.stats.lines)) A.th[k] = (A.th[k] ?? 0) + v;
    A.slot += ps.pc?.slot ?? 0;
    A.win += ps.opened;
    A.okN += ps.pc?.ok ?? 0;
  }
  console.log(`상대 ${fw} (씨앗 ${N} × ${SIM} s)`);
  console.log(`  ① 막기 버튼이 정한 줄: ${row(A.th)}`);
  console.log(`  ② 막기 성공 때 손이 간 줄: ${row(A.ok)}`);
  console.log(`  ③ 막기 성공 ${A.okN} · 정한 자세 ${A.slot} · 창 ${A.win}`);
  for (const k of ['th', 'ok']) for (const [l, v] of Object.entries(A[k])) all[k][l] = (all[k][l] ?? 0) + v;
  all.slot += A.slot;
  all.win += A.win;
  all.okN += A.okN;
}
console.log(`모두`);
console.log(`  ① ${row(all.th)}`);
console.log(`  ② ${row(all.ok)}`);
console.log(`  ③ 막기 성공 ${all.okN} · 정한 자세 ${all.slot} · 창 ${all.win}`);
