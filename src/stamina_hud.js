import { Vector3 } from 'three';
import { TEAM_FIGHT } from './config.js';
import { hpStrip } from './hp_strip.js';

const HP_ON = 1, BAR_ON = 2; // place() 가 돌려주는 보일 것

/** 두 검객의 머리 위에 붙이는 화면 크기 고정 기력 바. 판마다 DOM을 만들지 않는다.
 *  동시 대전(10/29 · 11/20 넷 제한 걷음): 셋째부터의 바는 그 수의 판이 처음 올 때만 만든다 (1:1 DOM 은 예전 그대로 둘 · 줄이지 않음 — 빈 자리는 숨김).
 *   setTeam(true) 인 판(동시 대전 — main.js newTeamRound · 생사전 판 모두)은 이름표를 싸움꾼 이름으로 · 기력 막대 바로 위에 체력 칸(.hp-cells — 같은 너비 · 10 칸 점선 꼴)을 함께.
 *   (사장님 11/18 '생사전에서 좌측 상단에 캐릭터 체력바가 뜨는데 그거 없애고 기력바랑 같이 뜨게 해. 기력바 위나 아래에. … 점선 모양의 바 … 10칸' — 규칙 hp_strip.js ·
 *    전 10/29 22:3x 왼쪽 위 이름 · 체력 목록(team_hud.js #teamList)은 걷음.) 1:1(setTeam false)은 체력 칸이 없다 — 예전 그대로.
 *   기력 무한(용사의 눈물)이라 기력 막대가 없는 몸도 체력 칸은 같은 자리에 그린다.
 *  11/18 머리 위 스택 표시(일본 기세 칸 — 막대 밑)는 걷음 — 스택은 화면에 띄우지 않는다(사장님 11/18 '스택 표시는 어떻게 해도 별로다 그냥 빼') */
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
    // 마지막으로 DOM 에 쓴 값 (11/21 감사 N-027 — 바뀐 때만 쓴다): 보임 · 자리(left · top) · 막대 상태 열쇠 · 채움 몫
    return { bar, fill, name, who: null, hp, hpKey: '', barOn: false, hpOn: false, barLeft: '', barTop: '', hpLeft: '', hpTop: '', barKey: '', fillX: NaN };
  };
  const bars = ['나', '상대'].map(make);
  // 셋째부터의 기본 이름표 (동시 대전은 setTeam 뒤 싸움꾼 이름으로 바뀜): 자리 2 = 동료 · 3 = 상대 2 · 4 = 동료 2 · 5 = 상대 3 … (자리 홀짝 = 편)
  const nameAt = (i) => (i % 2 ? `상대 ${(i + 1) / 2}` : i === 2 ? '동료' : `동료 ${i / 2}`);
  let team = false;
  /** 막대 하나를 자리에 (바뀐 값만 쓴다). 돌려줌: 보일 것 — HP_ON(체력 칸 · 동시 대전 판만) | BAR_ON(기력 막대) · 0 = 둘 다 숨김 */
  function place(b, f, camera, visible, width, height) {
    const { bar, fill, hp } = b;
    if (!visible || !f?.alive || f.revival || f.decapitated) return 0;
    const head = f.bodies.head.translation();
    point.set(head.x, head.y + 0.28, head.z);
    if (viewPoint.copy(point).applyMatrix4(camera.matrixWorldInverse).z >= 0) return 0;
    point.project(camera);
    if (point.z < -1 || point.z > 1) return 0;
    const x = (point.x + 1) * width / 2;
    const y = (1 - point.y) * height / 2;
    if (x < 30 || x > width - 30 || y < 8 || y > height - 8) return 0;
    const dpr = window.devicePixelRatio || 1;
    const left = `${Math.round(x * dpr) / dpr}px`;
    const top = `${Math.round(y * dpr) / dpr}px`;
    if (team && b.who !== f) (b.who = f), bar.setAttribute('aria-label', `${f.name} 기력`), hp.setAttribute('aria-label', `${f.name} 체력`);
    if (team) {
      // 체력 칸: 켜진 칸 · 색 · 점멸은 hp_strip.js (바뀐 때만 DOM 을 고친다)
      if (b.hpLeft !== left) hp.style.left = b.hpLeft = left;
      if (b.hpTop !== top) hp.style.top = b.hpTop = top;
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
    if (f.stamina.infinite) return team ? HP_ON : 0; // 기력 무한(용사의 눈물 — 플레이어만): 그 사람 막대는 아예 없다 (사장님 10/17 '어차피 기력 무한이기 때문에 기력바 표시하지 않음' · 상대 막대는 그대로)
    if (b.barLeft !== left) bar.style.left = b.barLeft = left;
    if (b.barTop !== top) bar.style.top = b.barTop = top;
    const st = f.stamina;
    const full = st.value >= st.max - 0.01 && st.level === 0; // 가득 = 최대(케틀 햇 덧 포함 — stamina.js max)
    const percent = Math.round(st.ratio * 100);
    const prog = st.exhausted ? Math.round(st.progress * 100) : -1;
    // data · aria 는 이 다섯 값에서만 나온다 — 열쇠가 같으면 쓸 글도 같다
    const key = `${st.exhausted}|${st.level}|${full}|${percent}|${prog}`;
    if (key !== b.barKey) {
      b.barKey = key;
      bar.dataset.exhausted = String(st.exhausted);
      bar.dataset.level = String(st.level);
      bar.dataset.full = String(full);
      bar.setAttribute('aria-valuenow', String(percent));
      bar.setAttribute('aria-valuetext', st.exhausted ? `탈진 회복 ${prog}% · 이동 불가` : `${percent}%${st.level === 2 ? ' · 심한 지침' : st.level === 1 ? ' · 지침' : ''}`);
    }
    const fx = st.exhausted ? st.progress : st.ratio;
    if (b.fillX !== fx) fill.style.transform = `scaleX(${(b.fillX = fx)})`;
    return (team ? HP_ON : 0) | BAR_ON;
  }
  return {
    /** 동시 대전 판이면 true (이름표 = 싸움꾼 이름 · 체력 칸) · 1:1 판이면 false (이름표 예전 그대로 · 체력 칸 없음) */
    setTeam(on) {
      team = !!on;
      for (const b of bars) (b.who = null), b.bar.setAttribute('aria-label', `${b.name} 기력`), b.hp.setAttribute('aria-label', `${b.name} 체력`);
    },
    update(fighters, camera, visible, width = window.innerWidth, height = window.innerHeight) {
      camera.updateMatrixWorld();
      while (bars.length < fighters.length) bars.push(make(nameAt(bars.length)));
      // 바뀐 때만 DOM 을 고친다 (11/21 감사 N-027 — 체력 칸 hpKey 와 같은 길): 예전엔 프레임마다 숨김 → 보임 · 자리 · data · aria · 채움을 모두 다시 썼다.
      //  쓰는 값은 예전과 같고 같은 값을 건너뛸 뿐이라 프레임 끝 DOM 은 같다 (이 막대 DOM 을 고치는 곳은 여기와 setTeam 의 이름표뿐)
      bars.forEach((b, i) => {
        const shown = place(b, fighters[i], camera, visible, width, height);
        const hpOn = (shown & HP_ON) !== 0, barOn = (shown & BAR_ON) !== 0;
        if (b.hpOn !== hpOn) b.hp.hidden = !(b.hpOn = hpOn);
        if (b.barOn !== barOn) b.bar.hidden = !(b.barOn = barOn);
      });
    },
  };
}
