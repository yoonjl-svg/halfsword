import { Vector3 } from 'three';
import { TEAM_FIGHT } from './config.js';
import { hpStrip } from './hp_strip.js';

/** 두 검객의 머리 위에 붙이는 화면 크기 고정 기력 바. 판마다 DOM을 만들지 않는다.
 *  동시 대전(10/29 — 넷까지): 셋째 · 넷째 바는 셋 이상 판이 처음 올 때만 만든다 (1:1 DOM 은 예전 그대로 둘).
 *   setTeam(true) 인 판(동시 대전 — main.js newTeamRound · 생사전 판 모두)은 이름표를 싸움꾼 이름으로 · 기력 막대 바로 위에 체력 칸(.hp-cells — 같은 너비 · 10 칸 점선 꼴)을 함께.
 *   (사장님 11/18 '생사전에서 좌측 상단에 캐릭터 체력바가 뜨는데 그거 없애고 기력바랑 같이 뜨게 해. 기력바 위나 아래에. … 점선 모양의 바 … 10칸' — 규칙 hp_strip.js ·
 *    전 10/29 22:3x 왼쪽 위 이름 · 체력 목록(team_hud.js #teamList)은 걷음.) 1:1(setTeam false)은 체력 칸이 없다 — 예전 그대로.
 *   기력 무한(용사의 눈물)이라 기력 막대가 없는 몸도 체력 칸은 같은 자리에 그린다.
 *  11/18 머리 위 스택 표시(일본 기세 칸 — 막대 밑)는 걷음 — 왼쪽 가운데 스택 칸(stack_hud.js) */
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
    const hp = document.createElement('div'); // 체력 칸 (11/18 — 동시 대전 판만)
    hp.className = 'hp-cells';
    hp.hidden = true;
    hp.setAttribute('role', 'meter');
    hp.setAttribute('aria-label', `${name} 체력`);
    hp.setAttribute('aria-valuemin', '0');
    hp.setAttribute('aria-valuemax', '100');
    for (let i = 0; i < TEAM_FIGHT.hpStrip.cells; i++) hp.append(document.createElement('i'));
    root.append(hp, bar);
    return { bar, fill, name, who: null, hp, hpKey: '' };
  };
  const bars = ['나', '상대'].map(make);
  const more = ['동료', '상대 2'];
  let team = false;
  return {
    /** 동시 대전 판이면 true (이름표 = 싸움꾼 이름 · 체력 칸) · 1:1 판이면 false (이름표 예전 그대로 · 체력 칸 없음) */
    setTeam(on) {
      team = !!on;
      for (const b of bars) (b.who = null), b.bar.setAttribute('aria-label', `${b.name} 기력`), b.hp.setAttribute('aria-label', `${b.name} 체력`);
    },
    update(fighters, camera, visible, width = window.innerWidth, height = window.innerHeight) {
      camera.updateMatrixWorld();
      while (bars.length < Math.min(4, fighters.length)) bars.push(make(more[bars.length - 2]));
      bars.forEach((b, i) => {
        const { bar, fill, hp } = b;
        const f = fighters[i];
        bar.hidden = true;
        hp.hidden = true;
        if (!visible || !f?.alive || f.revival || f.decapitated) return;
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
        const top = `${Math.round(y * dpr) / dpr}px`;
        if (team && b.who !== f) (b.who = f), bar.setAttribute('aria-label', `${f.name} 기력`), hp.setAttribute('aria-label', `${f.name} 체력`);
        if (team) {
          // 체력 칸: 켜진 칸 · 색 · 점멸은 hp_strip.js (바뀐 때만 DOM 을 고친다)
          hp.hidden = false;
          hp.style.left = left;
          hp.style.top = top;
          const s = hpStrip(f);
          const key = `${s.lit}|${s.tone}|${s.blink}|${s.pct}`;
          if (key !== b.hpKey) {
            b.hpKey = key;
            [...hp.children].forEach((c, k) => (c.dataset.on = String(k < s.lit)));
            hp.dataset.tone = s.tone;
            hp.dataset.blink = String(s.blink);
            hp.setAttribute('aria-valuenow', String(s.pct));
          }
        }
        if (f.stamina.infinite) return; // 기력 무한(용사의 눈물 — 플레이어만): 그 사람 막대는 아예 없다 (사장님 10/17 '어차피 기력 무한이기 때문에 기력바 표시하지 않음' · 상대 막대는 그대로)
        bar.hidden = false;
        bar.style.left = left;
        bar.style.top = top;
        const st = f.stamina;
        bar.dataset.exhausted = String(st.exhausted);
        bar.dataset.level = String(st.level);
        bar.dataset.full = String(st.value >= st.max - 0.01 && st.level === 0); // 가득 = 최대(케틀 햇 덧 포함 — stamina.js max)
        const percent = Math.round(f.stamina.ratio * 100);
        bar.setAttribute('aria-valuenow', String(percent));
        bar.setAttribute('aria-valuetext', st.exhausted ? `탈진 회복 ${Math.round(st.progress * 100)}% · 이동 불가` : `${percent}%${st.level === 2 ? ' · 심한 지침' : st.level === 1 ? ' · 지침' : ''}`);
        fill.style.transform = `scaleX(${st.exhausted ? st.progress : st.ratio})`;
      });
    },
  };
}
