// 성능 측정 표시 (?fps=1). 사장님 폰에서 실제 부하를 재기 위한 것 — 평소에는 아무 일도 하지 않는다.
//  보여 주는 것:
//   초당 프레임(평균 · 느린 5%) · 한 프레임 시간 · 초당 그린 프레임(화면 갱신 상한 CONFIG.RENDER.fpsCap — 120 Hz 폰이면 FPS 120, 그림 60)
//   물리(한 프레임 동안 물리 계산에 쓴 시간, 스텝 수) · 그리기(그린 프레임 하나의 렌더 호출 시간)
//   게임 속도: 실제로 흐른 게임 시간 ÷ 흘러야 할 게임 시간. 100% 아래면 폰이 못 따라가서 슬로 모션이 된 것
//   그리기 호출 수 · 삼각형 수 · 화면 해상도 · 자바스크립트 메모리(크롬만)
//   extra() 가 주는 한 줄 (main.js: 지금 배경과 그 배경을 짓는 데 걸린 시간 — 배경이 판마다 바뀌어 어느 배경의 수치인지 적는다)
//   다음 판 멈칫 (11/21 감사 N-025): 다음 판을 청한 때(결과 창 '다음 판' · '재대결' · 메뉴 '여정 시작' · 대기실 출발)부터 카드 고르기를 지나
//    싸움이 시작된 뒤 3 초까지의 가장 긴 프레임 간격(ms) · 그 사이 배경이 바뀌었나 (싸움 전이면 '싸움 전').
//    '짓기 + GPU 준비' 는 이 멈칫의 한 몫(감사 가운데값 전체 1,217 ms 가운데 0.32 s)뿐 — 나머지는 준비 뒤 그래픽 칩 기다림이라 프레임 간격으로 통째로 잰다.
//    카드 길은 단추를 누른 뒤 카드가 뜨기 전(게임 시간은 멈춤), 장착 길(카드 없음)은 싸움 첫 프레임에 멈칫이 온다 — 둘 다 이 창 안.
//    보는 시계(view_clock.js)가 아니라 실제 시각 — rAF 콜백에 든 때(performance.now). rAF 가 주는 시각은 긴 일 차례(배경 짓기) 동안 미리 잡힌
//    프레임 시작 시각이 그대로 와서(헤드리스 크롬: 일 끝 29,170 ms 인데 다음 rAF 시각 28,248) 멈칫 하나가 두 간격으로 쪼개져 작게 읽힌다.
//    사람이 연 일시정지 창(싸움 · 카드 중 멈춤)에 닿은 간격과 화면 떠남 바로 뒤 간격은 세지 않는다 (카드 화면 · 첫 화면 · 대기실 시간은 센다)

const WINDOW = 120; // 느린 5%를 셀 최근 프레임 수
const ROUND_MS = 3000; // 싸움이 시작된 뒤 다음 판 멈칫을 더 보는 시간 (ms)

export class PerfMeter {
  constructor(renderer, extra = null) {
    this.renderer = renderer;
    this.extra = extra;
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed',
      left: 'max(6px, env(safe-area-inset-left))',
      top: 'max(6px, env(safe-area-inset-top))',
      zIndex: 5,
      pointerEvents: 'none',
      font: '11px/1.35 ui-monospace, Menlo, Consolas, monospace',
      color: '#e8f0e0',
      background: 'rgba(0,0,0,.55)',
      padding: '4px 6px',
      borderRadius: '4px',
      whiteSpace: 'pre',
    });
    document.body.appendChild(this.el);
    this.frames = new Float32Array(WINDOW);
    this.fi = 0;
    this.fn = 0;
    this.rafAt = null; // 앞 rAF 콜백에 든 때 (ms)
    this.rafOut = true; // 앞 rAF 를 셈에서 뺐나 (사람이 연 멈춤)
    this.hid = false; // 앞 rAF 뒤에 화면을 떠났다 왔나
    this.round = null; // 마지막 판 { t: 청한 때, key: 그때 배경 id, fightAt: 싸움 시작(null = 아직), max: 가장 긴 간격 ms, changed: 배경 바뀜 }
    this.opening = false; // 이번 일 차례에 이미 열었나 (대기실 출발 → startFight 처럼 거듭 불러도 처음 것만)
    document.addEventListener('visibilitychange', () => (this.hid = true)); // 화면을 떠났다 온 간격은 멈칫이 아니다
    this.reset(performance.now());
  }

  /** 다음 판을 청한 때 (main.js startFight · launchJourney · launchSaengsa 머리 — 배경을 짓기 전). key = 지금 배경 id.
   *  같은 일 차례에 거듭 부르면(launchJourney 가 배경을 지은 뒤 startFight) 처음 것만 — 마이크로태스크에서 풀린다 */
  roundOpen(key) {
    if (this.opening) return;
    this.opening = true;
    queueMicrotask(() => (this.opening = false));
    this.round = { t: performance.now(), key, fightAt: null, max: 0, changed: false };
    this.rafOut = false; // 멈춤 창의 '재대결': 멈춘 앞 프레임(rAF 마다 돎)에서 다음 프레임까지가 이 단추의 일이다
  }

  /** 싸움이 시작된 때 (main.js beginFight — 카드 고르기 · 방랑 알림 창 뒤). 여기서 3 초 뒤까지 잰다. 연 창이 없으면(다른 길) 여기서 연다 */
  roundFight(key) {
    const now = performance.now();
    if (!this.round || this.round.fightAt != null) this.round = { t: now, key, fightAt: null, max: 0, changed: false };
    this.round.fightAt = now;
    this.round.changed = key !== this.round.key;
  }

  /** rAF 마다 맨 앞에서 부른다. out = 이 프레임을 셈에서 뺀다 — 앞이나 뒤가 뺀 프레임인 간격은 세지 않는다 */
  raf(out) {
    const now = performance.now(); // rAF 가 준 시각이 아니라 지금 (위 머리 글)
    const r = this.round;
    // 청한 일(같은 일 차례의 배경 짓기 포함)은 청한 때를 품은 간격에 든다 — 끝이 청한 때 뒤 · 시작이 싸움 시작 3 초 안(싸움 전이면 늘)인 간격
    if (r && !out && !this.rafOut && !this.hid && this.rafAt != null && now > r.t && (r.fightAt == null || this.rafAt < r.fightAt + ROUND_MS)) r.max = Math.max(r.max, now - this.rafAt);
    this.rafAt = now;
    this.rafOut = out;
    this.hid = false;
  }

  reset(now) {
    this.t0 = now;
    this.n = 0;
    this.sumFrame = 0;
    this.physMs = 0;
    this.renderMs = 0;
    this.painted = 0; // 실제로 그린 프레임 수 (화면 갱신 상한으로 거른 프레임 빼고)
    this.steps = 0;
    this.capped = 0;
    this.want = 0; // 흘러야 할 게임 시간(초)
    this.got = 0; // 실제로 흐른 게임 시간(초)
  }

  /** 한 프레임 끝에 부른다. frameMs = 앞 프레임과의 간격, want/got = 이번 프레임의 게임 시간, painted = 이번 프레임을 그렸나 */
  frame(now, frameMs, physMs, renderMs, steps, capped, want, got, painted = true) {
    this.frames[this.fi] = frameMs;
    this.fi = (this.fi + 1) % WINDOW;
    this.fn = Math.min(WINDOW, this.fn + 1);
    this.n++;
    this.sumFrame += frameMs;
    this.physMs += physMs;
    this.renderMs += renderMs;
    if (painted) this.painted++;
    this.steps += steps;
    if (capped) this.capped++;
    this.want += want;
    this.got += got;
    if (now - this.t0 >= 500) this.show(now);
  }

  show(now) {
    const n = Math.max(1, this.n);
    const avg = this.sumFrame / n;
    const sorted = Array.from(this.frames.subarray(0, this.fn)).sort((a, b) => b - a);
    const slow = sorted[Math.floor(this.fn * 0.05)] || avg; // 느린 쪽 5% 경계
    const info = this.renderer.info.render;
    const speed = this.want > 1e-6 ? (100 * this.got) / this.want : 100;
    const mem = performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)}MB` : '-';
    const c = this.renderer.domElement;
    const paintFps = (1000 * this.painted) / Math.max(1, this.sumFrame); // FPS 와 같은 기준(프레임 간격의 합)
    this.el.textContent =
      `FPS ${(1000 / avg).toFixed(0)} (느린5% ${(1000 / slow).toFixed(0)})  ${avg.toFixed(1)}ms  그림 ${paintFps.toFixed(0)}fps\n` +
      `물리 ${(this.physMs / n).toFixed(1)}ms ×${(this.steps / n).toFixed(1)}스텝  그리기 ${(this.renderMs / Math.max(1, this.painted)).toFixed(1)}ms\n` +
      `게임 속도 ${speed.toFixed(0)}%${this.capped ? `  밀림 ${this.capped}` : ''}\n` +
      `호출 ${info.calls}  삼각형 ${(info.triangles / 1000).toFixed(0)}k  ${c.width}×${c.height}  메모리 ${mem}` +
      (this.extra ? `\n${this.extra()}` : '') +
      (this.round ? `\n다음 판 멈칫 ${this.round.max.toFixed(0)}ms  ${this.round.fightAt == null ? '싸움 전' : this.round.changed ? '배경 바뀜' : '같은 배경'}` : '');
    this.reset(now);
  }
}
