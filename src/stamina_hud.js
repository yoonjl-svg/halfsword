import { Vector3 } from 'three';
import { STAMINA } from './config.js';

/** 두 검객의 머리 위에 붙이는 화면 크기 고정 기력 바. 판마다 DOM을 만들지 않는다. */
export function createStaminaHud(root) {
  const point = new Vector3();
  const viewPoint = new Vector3();
  const bars = ['나', '상대'].map((name) => {
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
    return { bar, fill };
  });
  return {
    update(fighters, camera, visible, width = window.innerWidth, height = window.innerHeight) {
      camera.updateMatrixWorld();
      bars.forEach(({ bar, fill }, i) => {
        const f = fighters[i];
        bar.hidden = true;
        if (!visible || !STAMINA.on || !f?.alive || f.revival || f.decapitated) return;
        if (f.stamina.infinite) return; // 기력 무한(용사의 눈물 — 플레이어만): 그 사람 막대는 아예 없다 (사장님 10/17 '어차피 기력 무한이기 때문에 기력바 표시하지 않음' · 상대 막대는 그대로)
        const head = f.bodies.head.translation();
        point.set(head.x, head.y + 0.28, head.z);
        if (viewPoint.copy(point).applyMatrix4(camera.matrixWorldInverse).z >= 0) return;
        point.project(camera);
        if (point.z < -1 || point.z > 1) return;
        const x = (point.x + 1) * width / 2;
        const y = (1 - point.y) * height / 2;
        if (x < 30 || x > width - 30 || y < 8 || y > height - 8) return;
        bar.hidden = false;
        const dpr = window.devicePixelRatio || 1;
        bar.style.left = `${Math.round(x * dpr) / dpr}px`;
        bar.style.top = `${Math.round(y * dpr) / dpr}px`;
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
