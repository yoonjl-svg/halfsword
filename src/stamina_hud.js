import { Vector3 } from 'three';
import { STAMINA } from './config.js';
import { TEAM_COLORS, hpShare } from './team_hud.js';

/** 두 검객의 머리 위에 붙이는 화면 크기 고정 기력 바. 판마다 DOM을 만들지 않는다.
 *  동시 대전(10/29 — 넷까지): 셋째 · 넷째 바는 셋 이상 판이 처음 올 때만 만든다 (1:1 DOM 은 예전 그대로 둘).
 *   setTeam(true) 인 판(동시 대전 — main.js newTeamRound)은 기력 막대 바로 밑에 같은 크기 · 모양의 체력 막대(편 색 — 피의 몫, team_hud.js hpShare)를 단다
 *   (사장님 10/29 20:3x '피 막대는 기력 막대 아래로 기력 막대와 똑같은 크기로 보이게 개편해'). 1:1 은 체력 막대를 만들지도 않는다 */
export function createStaminaHud(root) {
  const point = new Vector3();
  const viewPoint = new Vector3();
  const make = (name) => {
    const bar = document.createElement('div');
    bar.className = 'stamina-bar';
    bar.hidden = true;
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-label', `${name} 기력`);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    const fill = document.createElement('span');
    bar.append(fill);
    root.append(bar);
    return { bar, fill, name };
  };
  const makeHp = () => {
    const bar = document.createElement('div');
    bar.className = 'hp-bar';
    bar.hidden = true;
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    const fill = document.createElement('span');
    bar.append(fill);
    root.append(bar);
    return { bar, fill, who: null, team: -1 };
  };
  const bars = ['나', '상대'].map(make);
  const more = ['동료', '상대 2'];
  const hps = [];
  let team = false;
  return {
    /** 동시 대전 판이면 true (판을 열 때 — main.js) · 1:1 판이면 false: 체력 막대를 숨기고 기력 막대 이름표를 예전 것으로 */
    setTeam(on) {
      team = !!on;
      if (team) return;
      for (const h of hps) (h.bar.hidden = true), (h.who = null);
      for (const b of bars) b.bar.setAttribute('aria-label', `${b.name} 기력`);
    },
    update(fighters, camera, visible, width = window.innerWidth, height = window.innerHeight) {
      camera.updateMatrixWorld();
      while (bars.length < Math.min(4, fighters.length)) bars.push(make(more[bars.length - 2]));
      if (team) while (hps.length < Math.min(4, fighters.length)) hps.push(makeHp());
      bars.forEach(({ bar, fill }, i) => {
        const f = fighters[i];
        const hp = team ? hps[i] : null;
        bar.hidden = true;
        if (hp) hp.bar.hidden = true;
        // 1:1 (hp 없음): 예전 차례 그대로 — 기력 끔 · 죽음 · 부활 · 참수 · 기력 무한이면 막대 없음
        if (!visible || (!hp && !STAMINA.on) || !f?.alive || f.revival || f.decapitated) return;
        const showSt = STAMINA.on && !f.stamina.infinite; // 기력 무한(용사의 눈물 — 플레이어만): 그 사람 기력 막대는 아예 없다 (사장님 10/17 '어차피 기력 무한이기 때문에 기력바 표시하지 않음' · 상대 막대는 그대로) — 체력 막대는 그 자리에 그대로
        if (!showSt && !hp) return;
        const head = f.bodies.head.translation();
        point.set(head.x, head.y + 0.28, head.z);
        if (viewPoint.copy(point).applyMatrix4(camera.matrixWorldInverse).z >= 0) return;
        point.project(camera);
        if (point.z < -1 || point.z > 1) return;
        const x = (point.x + 1) * width / 2;
        const y = (1 - point.y) * height / 2;
        if (x < 30 || x > width - 30 || y < 8 || y > height - 8) return;
        const dpr = window.devicePixelRatio || 1;
        const left = `${Math.round(x * dpr) / dpr}px`;
        if (showSt) {
          bar.hidden = false;
          bar.style.left = left;
          bar.style.top = `${Math.round(y * dpr) / dpr}px`;
          const st = f.stamina;
          bar.dataset.exhausted = String(st.exhausted);
          bar.dataset.level = String(st.level);
          bar.dataset.full = String(st.value >= st.max - 0.01 && st.level === 0); // 가득 = 최대(케틀 햇 덧 포함 — stamina.js max)
          const percent = Math.round(f.stamina.ratio * 100);
          bar.setAttribute('aria-valuenow', String(percent));
          bar.setAttribute('aria-valuetext', st.exhausted ? `탈진 회복 ${Math.round(st.progress * 100)}% · 이동 불가` : `${percent}%${st.level === 2 ? ' · 심한 지침' : st.level === 1 ? ' · 지침' : ''}`);
          fill.style.transform = `scaleX(${st.exhausted ? st.progress : st.ratio})`;
        }
        if (!hp) return;
        // 체력 막대 (동시 대전만): 기력 막대(높이 2 px · 아래 끝 = y) 바로 밑에 2 px 사이를 두고 같은 크기 · 모양 · 편 색
        if (hp.who !== f) {
          hp.who = f;
          bar.setAttribute('aria-label', `${f.name} 기력`);
          hp.bar.setAttribute('aria-label', `${f.name} 체력`);
        }
        if (hp.team !== f.team) (hp.team = f.team), (hp.fill.style.background = TEAM_COLORS[f.team] ?? '#888');
        const v = hpShare(f);
        hp.bar.hidden = false;
        hp.bar.style.left = left;
        hp.bar.style.top = `${Math.round((y + 4) * dpr) / dpr}px`;
        hp.bar.setAttribute('aria-valuenow', String(Math.round(v * 100)));
        hp.fill.style.transform = `scaleX(${v.toFixed(3)})`;
      });
    },
  };
}
