// 중국 막기 연환 미리 받기 확인 (10/12 — docs/strike/cn_combo_play_2026-10-12.md §6). 읽기만 (판정·실행은 게임 함수 그대로).
//  cn_combo_lines.mjs 대본(청강검 플레이어 · 맞닿기 + 0.2 m 까지 걸어 듦 · 막기 버튼 누른 채)에 '사람 입력'을 얹는다:
//   정한 자세 기다림(pend)이 새로 시작된 때부터 REACT 초 뒤에 공격 입력 하나 (사람이 '막혔다'를 느끼고 긋기까지). 입력 처리는 main.js 와 같은 차례 —
//   ① 창이 열려 있으면 fire → skill.secret ② 아니면 미리 받기(canBuffer → buffer) ③ 미리 받기가 꺼졌고 아직 맞닿아 기다리는 중이면 그 공격이 기다림을 취소(전 동작 —
//   여기선 휘두르기 대신 기다림만 지운다) ④ 그 밖(창이 닫힘)은 놓침. 그다음 물리 스텝마다 playerSecret.update → queued 면 곧장 fire (main.js 와 같음).
//  실행: node tools/sim/cn_combo_buffer.mjs [REACT 0.25] [상대 무기들] [씨앗 3] [초 30]   ·   끔: with_config.mjs SECRET.cnBuffer=0 cn_combo_buffer.mjs …
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerSecretWatch } from '../../src/secret.js';

const REACT = +(process.argv[2] || 0.25);
const foes = (process.argv[3] || 'longsword,qinggang,uchigatana,sabre').split(',');
const N = +(process.argv[4] || 3);
const SIM = +(process.argv[5] || 30);
const C = { pend: 0, input: 0, fireOpen: 0, buffered: 0, fireBuf: 0, drop: 0, cancel: 0, miss: 0, windows: 0, hits: 0, pendT: [] };
for (const fw of foes) {
  for (let seed = 1; seed <= N; seed++) {
    const G = newRound({ walls: true, weapon: 'qinggang', weapon2: fw, seed });
    const p = G.player;
    const pg = new PlayerParryGuard(p, G.enemy);
    const ps = new PlayerSecretWatch(p, G.enemy);
    pg.held = true;
    let pendObj = null;
    let pendT0 = 0;
    let due = null;
    let res = null;
    const fire = () => {
      const o = ps.fire();
      return !!(o && p.skill.secret(o));
    };
    G.before = (t) => {
      // ① 입력 (프레임 머리 — main.js 와 같은 차례)
      if (due != null && t >= due && p.alive) {
        due = null;
        C.input++;
        if (ps.open && !p.skill.sec) C.fireOpen += fire() ? 1 : 0;
        else if (ps.canBuffer()) ps.buffer([0, 0]), C.buffered++;
        else if (ps.pc?.pend && !CONFIG.SECRET.cnBuffer) (ps.pc.pend = null), C.cancel++;
        else C.miss++;
      }
      ps.update(DT, !!p.skill.sec);
      if (ps.queued && !p.skill.sec && p.alive) C.fireBuf += fire() ? 1 : 0;
      pg.step(DT);
      p.inputActive = pg.active;
      p.handHeld = pg.active;
      p.move.set(0, p.foeDistance() > p.swordArt.measure.contact + 0.2 ? 1 : 0);
      const P = ps.pc;
      if (P?.pend && P.pend !== pendObj) {
        pendObj = P.pend;
        pendT0 = t;
        C.pend++;
        due = t + REACT;
      }
      if (pendObj && !P?.pend) {
        C.pendT.push(t - pendT0);
        pendObj = null;
      }
      if (p.instantResult && p.instantResult !== res) {
        res = p.instantResult;
        if (res.combo) C.hits += res.hits ?? 0;
      }
    };
    for (let i = 0; i < SIM / DT; i++) {
      G.step();
      if (!p.alive || !G.enemy.alive) break;
    }
    C.windows += ps.opened;
    C.drop += ps.pc?.bufDrop ?? 0;
  }
}
const q = (f) => {
  const a = [...C.pendT].sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.floor(f * a.length))].toFixed(2) : '-';
};
console.log(`미리 받기 ${CONFIG.SECRET.cnBuffer ? '켬' : '끔'} · REACT ${REACT} s · 상대 ${foes.join(',')} × 씨앗 ${N} × ${SIM} s`);
console.log(`  정한 자세 기다림 ${C.pend} (맞닿음 길이 p50 ${q(0.5)} · p75 ${q(0.75)} · p90 ${q(0.9)} s) · 창 ${C.windows} · 입력 ${C.input}`);
console.log(`  → 창에서 냄 ${C.fireOpen} · 미리 받음 ${C.buffered} (떨어질 때 냄 ${C.fireBuf} · 버림 ${C.drop}) · 맞닿은 채 그어 취소 ${C.cancel} · 놓침 ${C.miss} · 낸 합 ${C.fireOpen + C.fireBuf} · 연환 맞힌 수 ${C.hits}`);
