// ─────────────────────────────────────────────────────────────
//  입력 처리
//   - 스마트폰: 화면을 손가락으로 끌면 손(칼자루)이 그만큼 움직인다(상대 이동).
//              폰을 운전대처럼 좌우로 기울이면 걷는다.
//   - PC: 화면 클릭 → 마우스 잠금. 마우스를 움직이면 칼, A/D(←/→)로 이동.
// ─────────────────────────────────────────────────────────────
import { INPUT } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.handDX = 0; // 누적된 손 이동량(m). +x = 화면 오른쪽
    this.handDY = 0; // +y = 위
    this.keys = new Set();
    this.buttonMove = 0; // 화면 이동 버튼(센서가 없을 때 대체용)
    this.tiltMove = 0;
    this.tiltActive = false;
    this.tiltBaseline = null;
    this.tiltRaw = 0;
    this.invertTilt = false;
    this.enabled = false;
    this.activeTouch = null;
    this.lastX = 0;
    this.lastY = 0;
    this.isTouchDevice = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  onDown(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse') {
      // PC: 마우스를 화면에 잠가서 하프 소드처럼 마우스 움직임 = 칼 움직임
      if (document.pointerLockElement !== this.canvas && this.canvas.requestPointerLock) {
        try {
          const p = this.canvas.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch {
          /* 지원 안 하면 드래그 방식으로 동작 */
        }
      }
    }
    if (this.activeTouch !== null) return; // 칼은 손가락 하나로만
    this.activeTouch = e.pointerId;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  onMove(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse' && document.pointerLockElement === this.canvas) {
      // 일부 브라우저는 잠금 직후 엉뚱하게 큰 값을 한 번 보낸다 → 무시
      if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
      this.handDX += e.movementX * INPUT.mouseSensitivity;
      this.handDY -= e.movementY * INPUT.mouseSensitivity;
      return;
    }
    if (e.pointerId !== this.activeTouch) return;
    const scale = INPUT.touchSensitivity / Math.max(320, window.innerHeight);
    this.handDX += (e.clientX - this.lastX) * scale;
    this.handDY -= (e.clientY - this.lastY) * scale;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  onUp(e) {
    if (e.pointerId === this.activeTouch) this.activeTouch = null;
  }

  consumeHandDelta() {
    const d = { x: this.handDX, y: this.handDY };
    this.handDX = 0;
    this.handDY = 0;
    return d;
  }

  /** -1(왼쪽) ~ 1(오른쪽) */
  get move() {
    let m = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) m -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) m += 1;
    m += this.buttonMove;
    if (this.tiltActive) m += this.tiltMove;
    return Math.max(-1, Math.min(1, m));
  }

  // ── 기울기(틸트) ──
  // 반드시 사용자가 버튼을 누른 순간에 호출해야 한다(아이폰 권한 요청 규칙).
  async enableTilt() {
    if (typeof DeviceMotionEvent === 'undefined') return false;
    try {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const res = await DeviceMotionEvent.requestPermission();
        if (res !== 'granted') return false;
      }
    } catch {
      return false;
    }
    // 아이폰은 중력 값 부호가 안드로이드와 반대다.
    const iOS = typeof DeviceMotionEvent.requestPermission === 'function' || /iP(hone|ad|od)/.test(navigator.userAgent);
    const sign = iOS ? -1 : 1;
    if (!this._motionHandler) {
      this._motionHandler = (e) => {
        const g = e.accelerationIncludingGravity;
        if (!g || g.x === null) return;
        const a = (((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) * Math.PI) / 180;
        // 기기 좌표 → 화면 좌표로 회전
        const sx = g.x * Math.cos(a) - g.y * Math.sin(a);
        const sy = g.x * Math.sin(a) + g.y * Math.cos(a);
        // 운전대처럼 돌린 각도
        const roll = (Math.atan2(sign * sx, sign * sy) * 180) / Math.PI;
        this.tiltRaw = roll;
        if (this.tiltBaseline === null) this.tiltBaseline = roll;
        this.tiltActive = true;
        let d = roll - this.tiltBaseline;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        if (this.invertTilt) d = -d;
        const mag = Math.max(0, Math.abs(d) - INPUT.tiltDeadDeg) / (INPUT.tiltFullDeg - INPUT.tiltDeadDeg);
        this.tiltMove = Math.sign(d) * Math.min(1, mag);
      };
      window.addEventListener('devicemotion', this._motionHandler);
    }
    return true;
  }

  /** 지금 폰 각도를 "똑바로"로 삼는다 */
  calibrateTilt() {
    this.tiltBaseline = this.tiltActive ? this.tiltRaw : null;
    this.tiltMove = 0;
  }
}
