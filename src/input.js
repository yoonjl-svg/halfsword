// ─────────────────────────────────────────────────────────────
//  입력 처리
//   - 스마트폰: 화면을 손가락으로 끌면 손(칼자루)이 그만큼 움직인다(상대 이동). 짧게 톡 치면 찌른다(탭 = 찌르기).
//              폰을 앞뒤로 기울이면 전진/후퇴, 좌우로 기울이면 옆걸음.
//   - PC: 화면 클릭 → 마우스 잠금. 마우스를 움직이면 칼, 끌지 않고 클릭하면 찌르기, WASD(방향키)로 이동.
// ─────────────────────────────────────────────────────────────
import { INPUT } from './config.js';
import { flushHaptic } from './effects.js';

// 손가락 궤적 조각의 표시 (FingerTrace.flag)
export const TRACE_REPLAY = 1; // 멈칫 동안 모았다가 흘려 넣은 조각 (결심 판정은 건너뛴다. 연출 층 L6a가 단다)
export const TRACE_LIFT = 2; // 손가락을 뗀 순간 (dx = dy = 0)

/**
 * 손가락 원래 궤적 (온몸 베기 docs/whole_body_strike.md 4-5): 칼 쪽 손가락(PC는 잠긴 마우스)의 움직임을
 * (시각 ms, dx, dy, 표시) 조각으로 고리 버퍼에 쌓는다. 시각은 이벤트가 생긴 벽시계 시각(e.timeStamp),
 * dx·dy는 handOffset에 더하는 것과 같은 배율의 패드 m (+x 오른쪽, +y 위)이고 자르지 않는다.
 * 결심 판정(L1)이 걸러진 skill.vel이나 잘린 handOffset 대신 이것을 읽는다: 폰 새로고침 빠르기(60/90/120 Hz)와
 * 상관없이 긋기 시작과 빠르기를 같게 본다. 미리 만든 배열만 쓴다 (조각마다 새로 만들지 않는다)
 */
export class FingerTrace {
  constructor(n = 64) {
    this.n = n;
    this.t = new Float64Array(n);
    this.dx = new Float64Array(n);
    this.dy = new Float64Array(n);
    this.flag = new Uint8Array(n);
    this.head = 0; // 다음에 쓸 자리
    this.count = 0; // 들어 있는 조각 수 (최대 n)
    this.total = 0; // 지금까지 넣은 조각 수 (읽는 쪽이 새 조각이 몇 개인지 알 수 있게)
    // 화면 프레임 시계 (벽시계 ms, main.js 가 프레임마다 tick). 손가락이 멈추면 조각이 안 오므로 "얼마나 오래 안 왔나"를 이 시계로 잰다
    //  (물리 스텝 시계로 재면 한 프레임에 스텝이 여럿 도는 느린 화면에서 움직이는 손가락도 멈춘 것으로 읽혔다). 0 = 아직 없음
    this.now = 0;
    this.frameDt = 0; // 바로 앞 프레임과의 사이 (ms)
    // R0 입력 (INPUT.coalesce): 조각까지의 누적 자리 (패드 m). at(t) 가 스텝 시각의 손가락 자리를 보간해 읽는다. clear 해도 sx·sy 는 잇는다
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    this.sx = 0;
    this.sy = 0;
    // 브라우저가 내다본 자리 (getPredictedEvents): (시각, 누적 자리). 실제 조각이 오면 비운다
    this.pn = 0;
    this.pt = new Float64Array(8);
    this.px = new Float64Array(8);
    this.py = new Float64Array(8);
  }

  /** 화면 프레임마다 한 번: 그 프레임의 벽시계 시각 (조각의 시각과 같은 시계) */
  tick(now) {
    if (this.now > 0 && now > this.now) this.frameDt = now - this.now;
    this.now = now;
  }

  push(t, dx, dy, flag = 0) {
    const i = this.head;
    this.t[i] = t;
    this.dx[i] = dx;
    this.dy[i] = dy;
    this.flag[i] = flag;
    this.sx += dx;
    this.sy += dy;
    this.x[i] = this.sx;
    this.y[i] = this.sy;
    if (!(flag & TRACE_LIFT)) this.pn = 0; // 새 실제 조각이 예측을 대신한다 (뗀 조각은 남긴다: ahead 가 뗀 시각에 멈춘다)
    this.head = (i + 1) % this.n;
    if (this.count < this.n) this.count++;
    this.total++;
  }

  /** k번째로 최근 조각의 배열 자리 (0 = 가장 최근). 없으면 -1 */
  idx(k) {
    return k >= 0 && k < this.count ? (this.head - 1 - k + this.n) % this.n : -1;
  }

  /** 브라우저가 내다본 자리 하나 (시각 t ms, 누적 자리 x·y). 마지막 실제 조각보다 앞이거나 시각이 거꾸로면 버린다 */
  predict(t, x, y) {
    if (this.pn >= this.pt.length) return;
    const iL = this.idx(0);
    if (iL >= 0 && !(t > this.t[iL])) return;
    if (this.pn > 0 && !(t > this.pt[this.pn - 1])) return;
    const k = this.pn++;
    this.pt[k] = t;
    this.px[k] = x;
    this.py[k] = y;
  }

  /**
   * 벽시계 시각 t(ms)의 손가락 자리 (누적, 패드 m): 조각 사이는 직선 보간, 마지막 실제 조각 뒤는 ahead(). 버퍼보다 오래된 시각은 가장 오랜 조각 자리.
   *  out 에 써서 돌려준다 (스텝마다 새로 만들지 않는다). 머리부터 거슬러 찾는다 (보통 1~4 조각: t 는 지난 프레임 안이다)
   */
  at(t, out) {
    if (this.count === 0) {
      out.x = this.sx;
      out.y = this.sy;
      return out;
    }
    let i1 = this.idx(0);
    if (t >= this.t[i1]) return this.ahead(t, out);
    if (this.count > 1 && (this.flag[i1] & TRACE_LIFT) !== 0 && t >= this.t[this.idx(1)]) return this.ahead(t, out); // 마지막 움직임 ~ 뗀 사이도 내다본 자리 (뗀 시각에 튀지 않게)
    for (let k = 1; k < this.count; k++) {
      const i0 = this.idx(k);
      if (this.t[i0] <= t) {
        const span = this.t[i1] - this.t[i0];
        const u = span > 0 ? (t - this.t[i0]) / span : 1;
        out.x = this.x[i0] + (this.x[i1] - this.x[i0]) * u;
        out.y = this.y[i0] + (this.y[i1] - this.y[i0]) * u;
        return out;
      }
      i1 = i0;
    }
    out.x = this.x[i1];
    out.y = this.y[i1];
    return out;
  }

  /**
   * 마지막 실제 조각 뒤 (t ≥ 마지막 조각 시각): predictMs 까지만 내다본다 — 브라우저가 내다본 자리가 있으면 그 사이를 직선으로,
   *  없으면 최근 predictMs 이상의 조각으로 잰 빠르기로 곧게. 손가락을 뗐으면 뗀 시각에서 멈춘다 (되튀지 않는다).
   *  내다본 몫은 다음 실제 조각이 바로잡는다 (Input.handDeltaAt) — 실제 움직임을 줄이거나 자르는 일은 없다
   */
  ahead(t, out) {
    const h = INPUT.predictMs;
    const iL = this.idx(0);
    const lifted = (this.flag[iL] & TRACE_LIFT) !== 0;
    const iR = lifted && this.count > 1 ? this.idx(1) : iL; // 마지막으로 움직인 조각
    const tR = this.t[iR];
    let tq = Math.min(t, tR + h);
    if (lifted) tq = Math.min(tq, this.t[iL]);
    out.x = this.x[iR];
    out.y = this.y[iR];
    if (!(h > 0) || tq <= tR || (lifted && this.count === 1)) return out;
    if (this.pn > 0) {
      // 브라우저 예측: (tR, 마지막 조각) → 예측 자리들을 잇는 꺾은선. 마지막 예측 뒤는 그 자리
      let t0 = tR, x0 = out.x, y0 = out.y;
      for (let k = 0; k < this.pn; k++) {
        const t1 = this.pt[k];
        if (tq <= t1) {
          const u = t1 > t0 ? (tq - t0) / (t1 - t0) : 1;
          out.x = x0 + (this.px[k] - x0) * u;
          out.y = y0 + (this.py[k] - y0) * u;
          return out;
        }
        t0 = t1;
        x0 = this.px[k];
        y0 = this.py[k];
      }
      out.x = x0;
      out.y = y0;
      return out;
    }
    // 곧게: 최근 조각들로 잰 빠르기 (뗀 조각 앞에서 멈춘다 — 앞 획의 빠르기는 섞지 않는다)
    let iB = iR;
    let span = 0;
    for (let k = (iR === iL ? 0 : 1) + 1; k < this.count; k++) {
      const i = this.idx(k);
      if (this.flag[i] & TRACE_LIFT) break;
      iB = i;
      span = tR - this.t[i];
      if (span >= h) break;
    }
    if (span > 0) {
      const dtq = tq - tR;
      out.x += ((this.x[iR] - this.x[iB]) / span) * dtq;
      out.y += ((this.y[iR] - this.y[iB]) / span) * dtq;
    }
    return out;
  }

  clear() {
    this.head = 0;
    this.count = 0;
    this.now = 0;
    this.frameDt = 0;
    this.pn = 0;
  }
}

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.handDX = 0; // 누적된 손 이동량(m). +x = 화면 오른쪽
    this.handDY = 0; // +y = 위
    this.keys = new Set();
    this.stickMove = { x: 0, y: 0 }; // 화면 조이스틱(센서가 없을 때 대체용)
    this.tiltMove = { x: 0, y: 0 };
    this.tiltActive = false;
    this.useTilt = false; // 설정에서 '기울기' 이동을 골랐을 때만 true
    this.tiltBaseline = null; // { roll, pitch }
    this.tiltRaw = { roll: 0, pitch: 0 };
    this.invertTilt = false;
    this.enabled = false;
    this.activeTouch = null;
    this.lastX = 0;
    this.lastY = 0;
    this.isTouchDevice = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.trail = null; // 조작 흔적 (main.js가 넣어 준다)
    // 탭 = 찌르기: 칼 쪽 화면을 짧게 톡 친 횟수 (main.js 가 consumeTaps 로 가져간다)
    //  press = 지금 누르고 있는 손가락(마우스) { id, t(누른 시각 ms), x, y, moved(움직인 거리 px), mouse, ok }
    this.taps = 0;
    this.press = null;
    // 칼 쪽 손가락 원래 궤적 (온몸 베기 결심 판정이 읽는다). R0 입력이 켜지면 조각이 화면 프레임보다 잦다(120 Hz 터치, 1000 Hz 마우스) → 고리를 넉넉히
    this.fingerTrace = new FingerTrace(INPUT.coalesce ? 256 : 64);
    this._cur = { on: false, x: 0, y: 0 }; // R0 입력: 스텝 읽기 커서 (지난 handDeltaAt 이 읽은 손가락 자리)
    this._at = { x: 0, y: 0 };
    this._d = { x: 0, y: 0 };
    this.tapOnDown = false; // 권총(main.js 가 켠다): 손가락이 닿는(클릭하는) 순간 한 번 친 것으로 센다 — 떼는 때·누른 시간과 상관없이

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
    // 마우스 잠금을 거는 첫 클릭은 찌르기로 치지 않는다 (잠금을 못 거는 브라우저는 클릭 그대로)
    const lockedBefore = document.pointerLockElement === this.canvas || !this.canvas.requestPointerLock;
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
    if (this.tapOnDown && (e.pointerType !== 'mouse' || (lockedBefore && e.button === 0))) this.taps++; // 권총: 두 번째 손가락으로 쳐도 쏜다
    if (this.activeTouch !== null) return; // 칼은 손가락 하나로만
    this.activeTouch = e.pointerId;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    const mouse = e.pointerType === 'mouse';
    // 시간은 이벤트가 생긴 시각(e.timeStamp)으로 잰다: 한 프레임이 길면 핸들러가 늦게 돌아 누른 시간이 부풀려진다
    // 마우스는 왼쪽(주) 버튼 클릭만 찌르기 (오른쪽·가운데 버튼은 아니다)
    this.press = { id: e.pointerId, t: e.timeStamp || performance.now(), x: e.clientX, y: e.clientY, moved: 0, mouse, ok: !this.tapOnDown && (!mouse || (lockedBefore && e.button === 0)) }; // 권총은 이미 셌다
    if (!mouse) this.trail?.addTouch(e.clientX, e.clientY, performance.now() / 1000);
  }

  onMove(e) {
    if (!this.enabled) return;
    // R0 입력 (INPUT.coalesce): 프레임 사이에 합쳐진 조각들(getCoalescedEvents, 마지막 = 이 이벤트)을 제 시각으로 하나씩 쌓는다.
    //  없거나 마지막이 이 이벤트와 어긋나면 예전처럼 이 이벤트 하나만
    let list = null;
    if (INPUT.coalesce && e.getCoalescedEvents) {
      const l = e.getCoalescedEvents();
      const z = l && l.length ? l[l.length - 1] : null;
      if (z && z.clientX === e.clientX && z.clientY === e.clientY) list = l;
    }
    if (e.pointerType === 'mouse' && document.pointerLockElement === this.canvas) {
      // 일부 브라우저는 잠금 직후 엉뚱하게 큰 값을 한 번 보낸다 → 무시
      if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
      if (list) {
        // 합쳐진 조각의 movement 합이 이 이벤트와 다르면(조각에 movement 를 안 주는 브라우저) 예전 길 — 잃는 것 없음
        let sx = 0, sy = 0;
        for (const ev of list) { sx += ev.movementX; sy += ev.movementY; }
        if (sx !== e.movementX || sy !== e.movementY) list = null;
      }
      const n = list ? list.length : 1;
      for (let k = 0; k < n; k++) {
        const ev = list ? list[k] : e;
        const mdx = ev.movementX * INPUT.mouseSensitivity;
        const mdy = ev.movementY * INPUT.mouseSensitivity;
        this.handDX += mdx;
        this.handDY -= mdy;
        this.fingerTrace.push(this.stamp(ev, e), mdx, -mdy);
      }
      if (this.press?.mouse) this.press.moved += Math.hypot(e.movementX, e.movementY);
      return;
    }
    if (e.pointerId !== this.activeTouch) return;
    if (this.press?.id === e.pointerId) this.press.moved = Math.max(this.press.moved, Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y));
    const scale = INPUT.touchSensitivity / Math.max(320, window.innerHeight);
    const n = list ? list.length : 1;
    for (let k = 0; k < n; k++) {
      const ev = list ? list[k] : e;
      const tdx = (ev.clientX - this.lastX) * scale;
      const tdy = (ev.clientY - this.lastY) * scale;
      this.handDX += tdx;
      this.handDY -= tdy;
      this.fingerTrace.push(this.stamp(ev, e), tdx, -tdy);
      this.lastX = ev.clientX;
      this.lastY = ev.clientY;
    }
    if (INPUT.coalesce && INPUT.predictMs > 0 && e.getPredictedEvents) {
      // 브라우저가 내다본 자리 (마지막 실제 조각에서의 상대 이동 → 누적 자리). 시각이 거꾸로인 것은 predict 가 버린다
      const pr = e.getPredictedEvents();
      const tr = this.fingerTrace;
      for (let k = 0; pr && k < pr.length; k++) {
        const p = pr[k];
        tr.predict(p.timeStamp, tr.sx + (p.clientX - this.lastX) * scale, tr.sy - (p.clientY - this.lastY) * scale);
      }
    }
    this.trail?.addTouch(e.clientX, e.clientY, performance.now() / 1000);
  }

  /** 조각의 시각: 합쳐진 조각 제 것, 없으면 이 이벤트 것, 그것도 없으면 지금 (ev === e 면 예전 `e.timeStamp || performance.now()` 와 같다) */
  stamp(ev, e) {
    const t = ev.timeStamp;
    return t > 0 ? t : e.timeStamp || performance.now();
  }

  onUp(e) {
    const p = this.press;
    if (p && e.pointerId === p.id) {
      // 짧게 톡 쳤다(끌지도, 누르고 있지도 않았다) → 찌르기
      const dur = (e.timeStamp || performance.now()) - p.t;
      const tap = p.mouse ? dur < INPUT.clickMs && p.moved < INPUT.clickPx : dur < INPUT.tapMs && p.moved < INPUT.tapPx;
      if (tap && p.ok && e.type === 'pointerup' && this.enabled) this.taps++;
      this.press = null;
    }
    if (e.pointerId === this.activeTouch) {
      this.activeTouch = null;
      this.trail?.lift();
      this.fingerTrace.push(e.timeStamp || performance.now(), 0, 0, TRACE_LIFT); // 끊어 긋기 판정에 쓴다
    }
    flushHaptic(); // 아이폰: 손가락을 떼는 순간에만 진동이 허락된다
  }

  /** 지난번 이후 톡 친 횟수 (찌르기) */
  consumeTaps() {
    const n = this.taps;
    this.taps = 0;
    return n;
  }

  consumeHandDelta() {
    const d = { x: this.handDX, y: this.handDY };
    this.handDX = 0;
    this.handDY = 0;
    return d;
  }

  /**
   * (INPUT.coalesce) 물리 스텝마다: 스텝 시각 t(벽시계 ms)에서 predictMs 앞의 손가락 자리까지, 지난 호출 뒤 옮긴 몫.
   *  예측으로 앞선 몫은 다음 호출에서 실제 조각으로 바로잡힌다 — 합은 늘 실제 이동과 같다 (조각을 놓치거나 두 번 더하지 않는다).
   *  첫 호출(판 시작 syncHand 뒤)은 0: 지난 판·뽑기 화면의 이동을 넘기지 않는다
   */
  handDeltaAt(t) {
    const s = this.fingerTrace.at(t + INPUT.predictMs, this._at);
    const c = this._cur;
    const d = this._d;
    if (c.on) {
      d.x = s.x - c.x;
      d.y = s.y - c.y;
    } else {
      d.x = d.y = 0;
      c.on = true;
    }
    c.x = s.x;
    c.y = s.y;
    return d;
  }

  /** 판 시작: 스텝 읽기 커서를 새로 (다음 handDeltaAt 이 0 부터) */
  syncHand() {
    this._cur.on = false;
  }

  /** { x: 옆걸음 -1(왼)~1(오른), y: -1(뒤)~1(앞) } */
  get move() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    x += this.stickMove.x;
    y += this.stickMove.y;
    if (this.useTilt && this.tiltActive) {
      x += this.tiltMove.x;
      y += this.tiltMove.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
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
        const sz = g.z;
        // roll: 운전대처럼 좌우로 돌린 각도 / pitch: 화면 윗부분을 앞으로 넘긴 각도
        const roll = (Math.atan2(sign * sx, sign * sy) * 180) / Math.PI;
        const pitch = (Math.atan2(sign * sz, sign * sy) * 180) / Math.PI;
        this.tiltRaw = { roll, pitch };
        if (this.tiltBaseline === null) this.tiltBaseline = { roll, pitch };
        this.tiltActive = true;
        const axis = (v) => {
          let d = v;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          const mag = Math.max(0, Math.abs(d) - INPUT.tiltDeadDeg) / (INPUT.tiltFullDeg - INPUT.tiltDeadDeg);
          return Math.sign(d) * Math.min(1, mag);
        };
        const inv = this.invertTilt ? -1 : 1;
        this.tiltMove = {
          x: inv * axis(roll - this.tiltBaseline.roll),
          y: inv * axis(pitch - this.tiltBaseline.pitch),
        };
      };
      window.addEventListener('devicemotion', this._motionHandler);
    }
    return true;
  }

  /** 지금 폰 각도를 "똑바로"로 삼는다 */
  calibrateTilt() {
    this.tiltBaseline = this.tiltActive ? { ...this.tiltRaw } : null;
    this.tiltMove = { x: 0, y: 0 };
  }
}

/**
 * 화면 왼쪽 아래 가상 조이스틱 (기울기 센서가 없을 때만 보인다)
 * @param {HTMLElement} pad  바깥 원
 * @param {HTMLElement} knob 안쪽 손잡이
 */
export function attachStick(input, pad, knob) {
  let id = null;
  const R = 40;
  const DEAD = 0.15; // 가운데 근처 살짝 건드린 건 무시
  const update = (e) => {
    const r = pad.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let x = dx / R;
    let y = -dy / R;
    const m = Math.hypot(x, y);
    const k = m < DEAD ? 0 : (m - DEAD) / (1 - DEAD) / m;
    input.stickMove = { x: x * k, y: y * k };
  };
  pad.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    id = e.pointerId;
    pad.setPointerCapture(id);
    update(e);
  });
  pad.addEventListener('pointermove', (e) => e.pointerId === id && update(e));
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    knob.style.transform = '';
    input.stickMove = { x: 0, y: 0 };
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
}
