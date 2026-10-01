// R2′ 운동 사슬 탐색판 전용 (docs/strike/r2p_spec_2026-10-02.md §2.5): 주소 인자 ?chain=legs|anchor 를 읽어 BODY.chain 에 넣고, 한 줄 HUD 를 띄운다.
//  이 파일은 탐색판 빌드(R2P_PROBE=1, vite.config.js 의 r2pProbe 플러그인이 index.html 에 끼워 넣는다)에서만 실리고 본판 빌드에는 없다.
//  main.js 보다 먼저 실행된다(문서 순서) → 판이 만들어지기 전에 스위치가 들어간다. 물리는 바꾸지 않고 fighter.chainDbg 측정만 켠다 (fighter.chainProbe).
//  HUD 한 줄: 골반 ω · 가슴 ω (°/s, 지금/1 s 최고) · 엉덩이 σ 포화율(최근 0.5 s 스텝 몫) · 잔차 r(dL_y/dt − 선언 힘의 yaw 토크, 0.5 s rms, N·m — W1a 장부 식의 줄임:
//  엔진 접촉 마찰·닻 yaw 토크가 남는다) · 닻 τ_y 재계산 · Δψ · 척추 비틀기 · 발 핀 미끄러짐 수. 등급 표기 외 모델 이름 없음.
import { BODY } from './config.js';

const params = new URLSearchParams(location.search);
const chain = params.get('chain');
if (chain === 'legs' || chain === 'anchor') {
  BODY.chain = chain;
  const el = document.createElement('div');
  el.id = 'r2pHud';
  el.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:50;pointer-events:none;font:11px/1.5 ui-monospace,Menlo,monospace;color:#e8e2d6;background:rgba(0,0,0,.45);padding:2px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  el.textContent = `사슬 ${chain} …`;
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el));
  if (document.body) document.body.appendChild(el);
  const fmt = (x, d = 0) => (x == null || Number.isNaN(x) ? '–' : x.toFixed(d));
  let last = 0;
  const tick = (now) => {
    requestAnimationFrame(tick);
    const g = window.game;
    const p = g?.player;
    if (!p) return;
    if (!p.chainDbg) p.chainDbg = {};
    if (g.enemy && !g.enemy.chainDbg) g.enemy.chainDbg = {};
    if (now - last < 100) return; // 10 Hz 로 글만 바꾼다
    last = now;
    const D = p.chainDbg;
    const deg = ((D.dpsi || 0) * 57.2958).toFixed(0);
    el.textContent =
      `사슬 ${chain} · 골반 ω ${fmt(D.pelvisW)}/${fmt(D.pelvisWmax)} 가슴 ω ${fmt(D.chestW)}/${fmt(D.chestWmax)} °/s · 엉덩이 σ 포화 ${fmt((D.satRate || 0) * 100)}% (σ ${fmt(D.sigma ?? 1, 2)}, τ̂ ${fmt(D.hipTau)} N·m)` +
      ` · 잔차 r ${fmt(D.rRms, 1)} N·m · 닻 τ ${fmt(D.anchorTau)} · Δψ ${deg}° · 척추 비틀기 ${fmt((D.spineTwist || 0) * 57.2958)}° · 미끄러짐 ${D.slips || 0}`;
  };
  requestAnimationFrame(tick);
}
