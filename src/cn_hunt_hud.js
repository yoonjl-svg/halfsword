import { Vector3 } from 'three';
import { UNIQUE_ASSIST as UA, STAMINA } from './config.js';

/** 동방 맹호은림 사냥 겹 표시 (11/14 — cn_hunt.js · config UNIQUE_ASSIST.cnHunt): 겹이 쌓인 몸의 기력 막대(stamina_hud.js — 머리 위 0.28 m) 바로 위에 작은 발톱 자국 max 개.
 *  찬 자국 = 겹 수 · 가득이면 짙게. 글은 없다(숫자 · 이름 없음 — 읽기 이름만 aria). 겹이 없거나 기력 막대가 안 보이는 몸은 숨김. 판마다 DOM 을 만들지 않는다(넷까지). */
export function createHuntHud(root) {
  const point = new Vector3();
  const viewPoint = new Vector3();
  const marks = [];
  const make = () => {
    const el = document.createElement('div');
    el.className = 'hunt-marks';
    el.hidden = true;
    el.setAttribute('role', 'meter');
    el.setAttribute('aria-label', '사냥');
    el.setAttribute('aria-valuemin', '0');
    el.setAttribute('aria-valuemax', String(UA.cnHunt?.max ?? 5));
    for (let i = 0; i < (UA.cnHunt?.max ?? 5); i++) el.append(document.createElement('i'));
    root.append(el);
    const m = { el, n: -1 };
    marks.push(m);
    return m;
  };
  return {
    update(fighters, camera, visible, width = window.innerWidth, height = window.innerHeight) {
      while (marks.length < Math.min(4, fighters.length)) make();
      marks.forEach((m, i) => {
        const f = fighters[i];
        const n = f?.cnHunt?.n ?? 0;
        m.el.hidden = true;
        if (!visible || !n || !STAMINA.on || !f?.alive || f.revival || f.decapitated) return;
        const head = f.bodies.head.translation();
        point.set(head.x, head.y + 0.28, head.z);
        if (viewPoint.copy(point).applyMatrix4(camera.matrixWorldInverse).z >= 0) return;
        point.project(camera);
        if (point.z < -1 || point.z > 1) return;
        const x = ((point.x + 1) * width) / 2;
        const y = ((1 - point.y) * height) / 2;
        if (x < 30 || x > width - 30 || y < 8 || y > height - 8) return;
        m.el.hidden = false;
        const dpr = window.devicePixelRatio || 1;
        m.el.style.left = `${Math.round(x * dpr) / dpr}px`;
        m.el.style.top = `${Math.round(y * dpr) / dpr}px`;
        if (m.n !== n) {
          m.n = n;
          [...m.el.children].forEach((c, k) => (c.dataset.on = String(k < n)));
          m.el.dataset.full = String(n >= (UA.cnHunt?.max ?? 5));
          m.el.setAttribute('aria-valuenow', String(n));
        }
      });
    },
  };
}
