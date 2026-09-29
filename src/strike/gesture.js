// ─────────────────────────────────────────────────────────────
//  R2 손짓 층 (docs/strike/r2_impl_spec.md §3): 손가락 → 싣기 S·무리·방향·위상 φ. 물리 스텝마다 Skill.update 안에서 돈다.
//   IDLE → WIND (손가락 자리로 감기, (A)) → CUT (빠르기 뒤집힘 / (B) 쉬다가 vStrike) → FOLLOW (φ ≥ 1) → RECOVER (φ 멈춤, S 풀림)
//   CUT·FOLLOW 는 손가락이 멈추거나 떼거나 거꾸로 갈 때만 끝난다 (길이 한도 없음: φF·strokeLen·Sstroke 는 긋는 만큼 자란다)
//  쓰는 것은 제 필드(fighter.ges = 이 객체)와 fighter.strike(읽기 전용 보기)뿐. 엔진은 건드리지 않는다 (W3·W4 가 읽는다)
//  상한·바닥·쿨다운 없음: S 는 1 위로 자르지 않고(over), φ̇ 에 바닥이 없다(clock 'finger'). 명세 §10 참고
// ─────────────────────────────────────────────────────────────
import { GESTURE, STROKE, COMMIT } from '../config.js';

export const GES_IDLE = 0, GES_WIND = 1, GES_CUT = 2, GES_FOLLOW = 3, GES_RECOVER = 4;
export const GES_NAMES = ['idle', 'wind', 'cut', 'follow', 'recover'];

// 손가락 궤적 조각 표시 (input.js TRACE_REPLAY·TRACE_LIFT 와 같은 값. 손짓 층도 입력 모듈을 들이지 않는다)
const T_REPLAY = 1;
const T_LIFT = 2;
const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

// 패드 무리 기하 (STROKE.path): 준비 자세 ch, 끝 자세 end, 획 방향 (end − ch)/|…|, Lref = |ch − end|
const FAMS = Object.keys(STROKE.path);
const NF = FAMS.length;
const CHX = new Float64Array(NF), CHY = new Float64Array(NF), ENX = new Float64Array(NF), ENY = new Float64Array(NF);
const DX = new Float64Array(NF), DY = new Float64Array(NF), LREF = new Float64Array(NF);
const BASE = [], SIDE = [];
for (let i = 0; i < NF; i++) {
  const k = FAMS[i];
  const P = STROKE.path[k];
  CHX[i] = P.ch[0];
  CHY[i] = P.ch[1];
  ENX[i] = P.end[0];
  ENY[i] = P.end[1];
  const lx = ENX[i] - CHX[i], ly = ENY[i] - CHY[i];
  LREF[i] = Math.hypot(lx, ly);
  DX[i] = lx / LREF[i];
  DY[i] = ly / LREF[i];
  BASE.push(k.replace(/[RL]$/, ''));
  SIDE.push(k === 'vert' ? null : P.left ? 'left' : 'right'); // vert 는 손가락 좌우로
}
const VERT = FAMS.indexOf('vert');
const VERT_X = VERT >= 0 ? Math.abs(CHX[VERT]) : 0; // vert 좌우를 가르는 폭 = vert 준비 자세 자신의 x (패드 기하)

/** 무리 key → { base: 'diag'|'vert'|'horiz'|'rise', side: 'right'|'left'|null } */
export function padFam(key) {
  const i = FAMS.indexOf(key);
  return i < 0 ? null : { base: BASE[i], side: SIDE[i] };
}

const smoothstep = (a, b, x) => {
  const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  return t * t * (3 - 2 * t);
};
const wrapPi = (a) => {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a <= -Math.PI) a += TAU;
  return a;
};

const RING = 24; // 0.15 s 고리 (t, x, y)

export class Gesture {
  constructor(fighter) {
    this.f = fighter;
    this.out = this; // fighter.ges = 이 객체 (출력 필드가 곧 이 객체의 필드)
    this.src = null;
    this.srcKind = 0; // 0 없음, 1 손가락 궤적(FingerTrace, 상대 이동), 2 절대 패드 자리(SyntheticFinger 등)
    // ── 출력 (§3.1) ──
    this.state = GES_IDLE;
    this.S = 0;
    this.Swind = 0;
    this.Sstroke = 0;
    this.Scut = 0;
    this.over = 0;
    this.c = 0;
    this.input = GESTURE.input;
    this.mode = null;
    this.arc0 = 0;
    this.phiF = -1;
    this.phiDotF = 0;
    this.phi = -1;
    this.phiDot = 0;
    this.phiDDot = 0;
    this.famA = null;
    this.famB = null;
    this.famMix = 0;
    this.fam = null; // famA 의 클립 무리 (diag vert horiz rise)
    this.side = 'right';
    this.dirC = new Float64Array(2);
    this.w = new Float64Array(2);
    this.o = new Float64Array(2);
    this.p = new Float64Array(2);
    this.v = new Float64Array(2);
    this.phiRev = 0;
    this.tCut = 0;
    this.tRecover = 0;
    this.busy = false;
    this.held = false;
    this.strokeLen = 0;
    // ── 속 ──
    this._F = { x: 0, y: 0, vx: 0, vy: 0, held: false };
    this._pos = { x: 0, y: 0 };
    this._posPrev = new Float64Array(2);
    this._dp = new Float64Array(2); // 이번 스텝 p 이동
    this._vPrev = new Float64Array(2);
    this._pPrevStep = new Float64Array(2);
    this._pCut = new Float64Array(2);
    this._dwell = new Float64Array(2);
    this._ring = new Float64Array(RING * 3);
    this.reset();
    // 읽기 전용 보기 (R3/R4 물리 층·보기 도구·검증용. ai.js 는 읽지 않는다 — 명세 §5-2)
    this.view = { S: 0, phi: -1, phiDot: 0, phiDDot: 0, state: GES_IDLE, fam: null, famA: null, famB: null, famMix: 0, side: 'right', over: 0, c: 0, dirC: this.dirC, mode: null, input: this.input, busy: false, homePad: null, openness: 0, guardGap: 0, nearGuards: null, stats: { cuts: 0, commits: 0, atlasMissing: 0 } };
    fighter.strike = this.view;
  }

  /** 플레이어: input.fingerTrace (main.js 판 시작) */
  attachTrace(tr) {
    this.src = tr;
    this.srcKind = tr ? 1 : 0;
    this._sync = true;
  }

  /** at(tMs, out) → { x, y, vx, vy, held } 를 주는 것 (절대 패드 자리: SyntheticFinger, 도구, AI 자리) */
  attachSource(src) {
    this.src = src;
    this.srcKind = src ? 2 : 0;
    this._sync = true;
  }

  /** 판 시작·부활·칼 놓침: 곧바로 IDLE, S = 0 */
  reset() {
    this.state = GES_IDLE;
    this.S = this.Swind = this.Sstroke = this.Scut = this.over = this.c = 0;
    this.mode = null;
    this.arc0 = 0;
    this.phiF = this.phi = -1;
    this.phiDotF = this.phiDot = this.phiDDot = 0;
    this.famA = this.famB = this.fam = null;
    this.famMix = 0;
    this.busy = false;
    this.held = false;
    this.strokeLen = 0;
    this.w.fill(0);
    this.v.fill(0);
    this.dirC.fill(0);
    this._overWind = 0;
    this._overCut = 0;
    this._Shold = 0;
    this._rest = 0; // 쉰 시간 (ms)
    this._dwellT = -Infinity; // 마지막 머묾 시각 (ms)
    this._restedRec = false; // RECOVER 들어온 뒤 머묾이 있었나 ((B) "쉬다가")
    this._tS = 0;
    this._fam = -1; // famA 번호
    this._famB = -1;
    this._locked = false;
    this._blend = 0; // 무리 넘김 중 (famMix 가 famBlendT 동안 0 으로)
    this._fired = false;
    this._cutStep = false;
    this._phiW = -1;
    this._phiDotW = 0;
    this._cf = this._cfB = -1;
    this._cmix = 0;
    this._ringN = 0;
    this._ringH = 0;
    this._sync = true;
    this._have = false;
    this._tPrev = 0;
    this._heldPrev = false;
    this._vPrev.fill(0);
    this.write();
  }

  /** 몸이 온몸 베기를 할 수 있나 (skill.js canCommit 의 몸 조건 − 무릎: 닻은 설 때만 골반 명령을 따르고 무릎 꿇으면 내딛지 못한다) */
  static bodyOk(f) {
    return f.alive && f.armed && !f.weapon?.gun && f.state === 'stand' && !f.skill.tap && !(f.finish?.amt > 0.5);
  }

  /** 물리 스텝마다 (Skill.update 에서, 옛 detectCommit 자리). dt = 물리 dt (s), tStepMs = 이 스텝이 끝나는 벽시계 ms */
  update(dt, tStepMs) {
    if (!this.src) {
      if (this.state === GES_IDLE && this.S === 0) return; // 손가락 없는 AI: 비용 없음
      this.fold(dt);
      return;
    }
    if (!Gesture.bodyOk(this.f)) {
      this.fold(dt);
      this._sync = true; // 돌아오면 p 를 handOffset 에 다시 맞춘다
      return;
    }
    const G = GESTURE;
    this.input = G.input;
    const A = this.input !== 'stroke';
    const F = this.readFinger(tStepMs);
    const dtw = this._dtw; // 이번 스텝 벽시계 ms
    const vx = F.vx, vy = F.vy;
    const sp = Math.hypot(vx, vy);
    // 쉼 (머묾): |v| < restV 가 restDwell 넘게
    this._rest = sp < G.restV ? this._rest + dtw : 0;
    const dwell = this._rest >= G.restDwell * 1000;
    const st0 = this.state;
    if (dwell) {
      this._dwell[0] = this.p[0];
      this._dwell[1] = this.p[1];
      this._dwellT = tStepMs;
      if (st0 === GES_RECOVER) this._restedRec = true;
      // 감아 둔 채 버티는 동안(WIND, Swind > 0)은 원점이 움직이지 않는다 (Q2). 긋는 중에도 안 쓴다
      if (st0 === GES_IDLE || st0 === GES_RECOVER || (st0 === GES_WIND && this.Swind === 0)) this.setOrigin();
    }
    if (F.down && !(st0 === GES_WIND && this.Swind > 0)) this.setOrigin(); // 손가락이 닿은 자리 = 원점
    const E = Math.exp(-dt / G.tauRelease);

    switch (this.state) {
      case GES_IDLE: {
        if (A && F.held) {
          this.decayWind(this.measureWind(), E);
          if (this.Swind > 0) {
            this.commitWindFam();
            this.state = GES_WIND;
          }
        }
        if (this.state === GES_WIND) this.phiF = this._phiW;
        else if (A ? this.reversal(vx, vy, sp) : F.held && sp > G.vStrike) this.startCut(tStepMs, A ? 'rev' : 'auto', vx, vy, sp);
        else this.phiF = A ? this._phiW : -1;
        break;
      }
      case GES_WIND: {
        const target = F.held ? this.measureWind() : 0;
        if (this.reversal(vx, vy, sp)) {
          this.startCut(tStepMs, 'rev', vx, vy, sp); // 이번 스텝의 풀림 전 Swind 가 Scut
          break;
        }
        this.decayWind(target, E); // 뗐으면 풀린다 (다시 대면 그 감기에서 그을 수 있다)
        if (target > 0) this.commitWindFam();
        if (!F.held) this._phiDotW = 0;
        if (this.Swind === 0) this._overWind = 0;
        this.phiF = this._phiW;
        if (this.Swind === 0 && dwell) this.toIdle();
        break;
      }
      case GES_RECOVER: {
        if (A && F.held) {
          // 획 방향으로 계속 가는 손가락(멈칫 뒤 같은 쪽으로 잇기)은 되감기가 아니다: 원점이 획 방향으로 가장 멀리 간 자리를 따른다
          if ((this.p[0] - this.o[0]) * this.dirC[0] + (this.p[1] - this.o[1]) * this.dirC[1] > 0) this.setOrigin();
          this.decayWind(this.measureWind(), E);
          if (this.Swind > 0) {
            // 되감기는 곧바로 (Q18, 쿨다운 없음)
            this.commitWindFam();
            this.state = GES_WIND;
            this.phiF = this._phiW;
            this._overCut = 0;
            break;
          }
        }
        if (!A && this.autoRestart(tStepMs, F, vx, vy, sp)) break;
        this.S *= E;
        this.over *= E;
        if (this.S < G.sSnap) {
          this.S = 0;
          this.over = 0;
        }
        if (this.S === 0 && dwell) this.toIdle();
        break;
      }
    }
    if (this.state === GES_CUT || this.state === GES_FOLLOW) {
      this.cutStep(dt, tStepMs, F, vx, vy, sp);
      // (B) 되돌아 긋기로 멈춘 그 스텝에 다음 긋기가 바로 선다 (한 스텝 늦지 않게)
      if (!A && this.state === GES_RECOVER && this.autoRestart(tStepMs, F, vx, vy, sp)) this.cutStep(dt, tStepMs, F, vx, vy, sp);
    }
    if (this.state === GES_IDLE) {
      this.S = 0;
      this.over = 0;
    } else if (this.state === GES_WIND) {
      this.S = this.Swind;
      this.over = this._overWind;
      this.phiDotF = this._phiDotW;
    } else if (this.state === GES_RECOVER) this.phiDotF = 0;
    this.phiFilter(dt);
    this.c = smoothstep(0, G.mixX, this.S);
    // 확정 신호 (§3.8-8): 한 획에 한 번, 몸이 클립에 다 올라탄 첫 스텝 (c = 1). R5 가 φr→φf 창으로 옮긴다
    if (!this._fired && this.c === 1 && (this.state === GES_CUT || this.state === GES_FOLLOW)) {
      this._fired = true;
      this.view.stats.commits++;
      this.f.onCommit?.('B', this.S, FAMS[this._fam]);
    }
    this.write();
  }

  // ───────── 입력 ─────────

  /**
   * 손가락 읽기 (§3.2): p(자르지 않은 패드 자리), v(실제 조각으로, 예측 없이), held, down(닿은 스텝).
   *  궤적(상대 이동): 닿을 때·뗀 동안 p := handOffset, 누르는 동안 조각 이동 × inputScale 을 쌓는다 (0.62 m 자르기 없음)
   */
  readFinger(t) {
    const F = this._F;
    const f = this.f;
    let held = false;
    let vx = 0, vy = 0;
    if (this.srcKind === 1) {
      const tr = this.src;
      const n = tr.count;
      let kAt = -1; // t 이전(포함) 가장 최근 조각
      for (let k = 0; k < n; k++) {
        if (tr.t[tr.idx(k)] <= t) {
          kAt = k;
          break;
        }
      }
      held = kAt >= 0 && !(tr.flag[tr.idx(kAt)] & T_LIFT);
      // 자리: 마지막 실제(움직인) 조각까지만 보간 (내다보기 없음)
      let tM = -Infinity;
      for (let k = 0; k < n; k++) {
        const i = tr.idx(k);
        if (!(tr.flag[i] & T_LIFT)) {
          tM = tr.t[i];
          break;
        }
      }
      tr.at(n > 0 ? Math.min(t, tM) : t, this._pos);
      // 빠르기: t 를 감싸는 실제 조각 사이의 기울기. 마지막 조각 뒤는 옛 결심 경로의 멈춤 창(max(stillGap, stillFrames·프레임))
      //  동안 그 기울기를 잇고, 그 뒤는 멈춤 — 이벤트 시각은 늘 rAF 보다 앞서니 한 칸만 이으면 긋는 중에 v = 0 으로 읽힌다
      if (held) {
        const j = tr.idx(kAt);
        const jn = kAt > 0 ? tr.idx(kAt - 1) : -1;
        if (jn >= 0 && !(tr.flag[jn] & T_LIFT)) {
          const span = tr.t[jn] - tr.t[j];
          if (span > 0 && !(tr.flag[jn] & T_REPLAY)) {
            vx = ((tr.x[jn] - tr.x[j]) / span) * 1000;
            vy = ((tr.y[jn] - tr.y[j]) / span) * 1000;
          }
        } else if (kAt + 1 < n) {
          const jp = tr.idx(kAt + 1);
          const span = tr.t[j] - tr.t[jp];
          const hold = Math.max(span, COMMIT.stillGap, COMMIT.stillFrames * (tr.frameDt || 0)); // 틈 견딤 창 (한도 아님)
          if (span > 0 && t - tr.t[j] <= hold && !(tr.flag[j] & T_REPLAY)) {
            vx = ((tr.x[j] - tr.x[jp]) / span) * 1000;
            vy = ((tr.y[j] - tr.y[jp]) / span) * 1000;
          }
        }
      }
    } else {
      const s = this.src.at(t, F);
      held = !!s.held;
      vx = s.vx;
      vy = s.vy;
      this._pos.x = s.x;
      this._pos.y = s.y;
    }
    // 뗀 스텝은 빠르기를 한 스텝 더 둔다 (떼며 튕기기 = 뒤집힘)
    if (!held && this._heldPrev && vx === 0 && vy === 0) {
      vx = this._vPrev[0];
      vy = this._vPrev[1];
    }
    const down = held && !this._heldPrev;
    this._dtw = this._have ? Math.max(0, t - this._tPrev) : 0;
    const px0 = this.p[0], py0 = this.p[1];
    if (this.srcKind === 2) {
      this.p[0] = this._pos.x;
      this.p[1] = this._pos.y;
    } else if (this._sync || !held || down) {
      this.p[0] = f.handOffset.x;
      this.p[1] = f.handOffset.y;
    } else {
      const k = f.inputScale ?? 1; // 멈칫(0.25): handOffset 과 같은 배율
      this.p[0] += (this._pos.x - this._posPrev[0]) * k;
      this.p[1] += (this._pos.y - this._posPrev[1]) * k;
    }
    this._dp[0] = this._have && !this._sync ? this.p[0] - px0 : 0;
    this._dp[1] = this._have && !this._sync ? this.p[1] - py0 : 0;
    this._posPrev[0] = this._pos.x;
    this._posPrev[1] = this._pos.y;
    this._tPrev = t;
    this._have = true;
    this._sync = false;
    this._heldPrev = held;
    this._vPrev[0] = vx;
    this._vPrev[1] = vy;
    this.v[0] = vx;
    this.v[1] = vy;
    this.held = held;
    F.held = held;
    F.down = down;
    F.vx = vx;
    F.vy = vy;
    return F;
  }

  setOrigin() {
    this.o[0] = this.p[0];
    this.o[1] = this.p[1];
  }

  // ───────── 감기 (A) ─────────

  /** w = p − o 를 재고 감기 목표 smoothstep(sL0, sL1, |w|), 두 이웃 무리 후보, 감기 위상을 낸다 (Swind 는 decayWind 가) */
  measureWind() {
    const G = GESTURE;
    const wx = this.p[0] - this.o[0];
    const wy = this.p[1] - this.o[1];
    this.w[0] = wx;
    this.w[1] = wy;
    const L = Math.hypot(wx, wy);
    this._phiW = -1 + Math.min(1, L / G.sL1);
    this._phiDotW = L > 0 && L < G.sL1 ? (this.v[0] * wx + this.v[1] * wy) / L / G.sL1 : 0;
    this._cf = -1;
    if (!(L > 0)) {
      this._overWind = 0;
      return 0;
    }
    // 원점에서 본 준비 자세들의 방위 → 손가락 방위를 감싸는 두 이웃 (반시계 쪽 a, 시계 쪽 b)
    const th = Math.atan2(wy, wx);
    let ia = -1, da = Infinity, ib = -1, db = -Infinity;
    let iMin = -1, dMin = Infinity, iMax = -1, dMax = -Infinity;
    for (let i = 0; i < NF; i++) {
      const d = wrapPi(Math.atan2(CHY[i] - this.o[1], CHX[i] - this.o[0]) - th);
      if (d >= 0 && d < da) (da = d), (ia = i);
      if (d < 0 && d > db) (db = d), (ib = i);
      if (d < dMin) (dMin = d), (iMin = i);
      if (d > dMax) (dMax = d), (iMax = i);
    }
    if (ia < 0) (ia = iMin), (da = dMin + TAU); // 한쪽이 비었다: 반대편 끝을 돌아서
    if (ib < 0) (ib = iMax), (db = dMax - TAU);
    const gap = da - db;
    if (gap > G.sectorMax * D2R) {
      // 이웃 사이가 sectorMax 보다 넓다 (곧게 아래 = 바보 자세로 바꾸기): 감기가 아니다
      this._overWind = 0;
      return 0;
    }
    const target = smoothstep(G.sL0, G.sL1, L);
    this._overWind = L > G.sL1 ? (L - G.sL1) / (0.5 * (G.sL1 - G.sL0)) : 0;
    if (target > 0) {
      const nearA = da <= -db;
      this._cf = nearA ? ia : ib;
      this._cfB = nearA ? ib : ia;
      this._cmix = gap > 0 ? (nearA ? da : -db) / gap : 0;
    }
    return target;
  }

  /** 감기 무리 후보를 쓴다 (감기일 때만: 풀리는 베기의 클립 무리를 덮지 않게) */
  commitWindFam() {
    if (this._cf < 0) return;
    this._fam = this._cf;
    this._famB = this._cfB;
    this.famMix = this._cmix;
    this._blend = 0;
    this.setSide(this.w[0]);
  }

  decayWind(target, E) {
    if (target >= this.Swind) this.Swind = target;
    else {
      this.Swind = target + (this.Swind - target) * E;
      if (this.Swind < GESTURE.sSnap) this.Swind = target;
    }
  }

  /** famA 의 좌우 (vert 는 손가락 가로 성분으로, vert 준비 자세의 x 폭 안에서는 앞 값) */
  setSide(x) {
    const s = SIDE[this._fam];
    if (s) this.side = s;
    else if (x > VERT_X) this.side = 'right';
    else if (x < -VERT_X) this.side = 'left';
  }

  reversal(vx, vy, sp) {
    const G = GESTURE;
    const L = Math.hypot(this.w[0], this.w[1]);
    return sp > G.vStrike && L > 0 && (vx * this.w[0] + vy * this.w[1]) / L < G.revDot * sp;
  }

  // ───────── 긋기 ─────────

  /** 베기 시작 (§3.5 뒤집힘, §3.10 (B) 쉬다가 vStrike) */
  startCut(t, how, vx, vy, sp) {
    const G = GESTURE;
    this.phiRev = how === 'auto' ? this.phiF : this._phiW; // 되돌아선 순간의 감기 위상 (이어받기용)
    this.state = GES_CUT;
    this.tCut = t;
    this._pCut[0] = this.p[0];
    this._pCut[1] = this.p[1];
    this.Scut = how === 'auto' ? 0 : this.Swind;
    this._overCut = how === 'auto' ? 0 : this._overWind;
    this.Swind = 0;
    this.Sstroke = 0;
    this._Shold = 0;
    this.strokeLen = 0;
    this._tS = t;
    this.mode = this.Scut > 0 ? 'wind' : 'stroke';
    if (how === 'auto') {
      this.dirC[0] = vx / sp;
      this.dirC[1] = vy / sp;
    } else {
      const L = Math.hypot(this.w[0], this.w[1]);
      this.dirC[0] = -this.w[0] / L;
      this.dirC[1] = -this.w[1] / L;
    }
    if (this.Scut === 0 || this._fam < 0) {
      // 감기가 없다: 긋는 방향으로 무리 (늦은 고르기 규칙을 0 스텝부터)
      this._fam = this.pickFam(this.dirC[0], this.dirC[1]);
      this._famB = this._fam;
      this.famMix = 0;
      this._blend = 0;
      this.setSide(this.dirC[0]);
    }
    this._locked = false;
    this.arc0 = this.arcOf(this._fam);
    this.phiF = 0;
    this._fired = false;
    this._cutStep = true;
    this._ringN = 0;
    this._restedRec = false;
    if (this.mode === 'stroke') {
      // 감기 없는 긋기: 몸 위상은 새로 (클립은 φ_align / −autoWindPhi 에서 시작 — drive 몫). 이때 S = 0 이라 보이는 것은 없다
      this.phi = 0;
      this.phiDot = 0;
    }
    this.view.stats.cuts++;
  }

  /** CUT·FOLLOW 한 스텝: 멈춤 규칙, 손가락 시계, S (Q3), 늦은 무리 고르기, 고리 */
  cutStep(dt, t, F, vx, vy, sp) {
    const G = GESTURE;
    const first = this._cutStep;
    this._cutStep = false;
    const floor = G.clock === 'floor';
    const along = vx * this.dirC[0] + vy * this.dirC[1];
    // 손가락이 멈추거나 떼거나 거꾸로 가면 명령이 거기서 멈춘다 (Q1: 그만두기의 대가는 몸의 관성뿐). 'floor'(시뮬 A/B)는 옛 법칙대로 끝까지
    if (!first && !floor && (!F.held || sp < G.restV || along < 0)) {
      this.startRecover(t, !F.held || sp < G.restV);
      return;
    }
    if (!first) this.strokeLen += Math.hypot(this._dp[0], this._dp[1]);
    // 늦은 무리 고르기: lateSelect 초 또는 lateSelectLen m 중 먼저 오는 때까지 긋는 방향으로 다시 고르고, 그 뒤 잠근다
    if (!this._locked) {
      const ex = this.p[0] - this._pCut[0];
      const ey = this.p[1] - this._pCut[1];
      const el = Math.hypot(ex, ey);
      if (el > 0) {
        this.dirC[0] = ex / el;
        this.dirC[1] = ey / el;
        const pick = this.pickFam(this.dirC[0], this.dirC[1]);
        if (pick !== this._fam) {
          this._famB = this._fam;
          this._fam = pick;
          this.famMix = 1;
          this._blend = 1;
          this.setSide(ex);
          this.arc0 = this.arcOf(pick);
          this._Shold = 0;
        }
      }
      if (t - this.tCut >= G.lateSelect * 1000 || this.strokeLen >= G.lateSelectLen) {
        this._locked = true;
        if (this.famMix > 0) this._blend = 1;
      }
    }
    if (this._blend > 0) {
      this.famMix -= dt / G.famBlendT;
      if (this.famMix <= 0) {
        this.famMix = 0;
        this._blend = 0;
        this._famB = this._fam;
      }
    }
    // S (Q3, 상한 없음): Sstroke = arc0 · (긋기 길이 / Lref) · (평균 빠르기 / vRef). 1 을 넘는 몫은 over
    const el = (t - this._tS) / 1000;
    const vbar = el > 0 ? this.strokeLen / el : sp;
    this.Sstroke = this.arc0 * (this.strokeLen / LREF[this._fam]) * (vbar / G.vRef);
    if (this.Sstroke > this._Shold) this._Shold = this.Sstroke; // 손가락이 긋는 동안 줄지 않는다
    this.S = Math.max(this.Scut, Math.min(1, this._Shold));
    this.over = Math.max(this._overCut, this._Shold - 1, 0);
    // 손가락 시계 (Q1): φ̇ = 긋는 쪽 빠르기 / sL1, 바닥·천장 없음 (클립 끝 너머 φ 는 읽는 쪽(W3/R4)이 자른다). 'floor' = 1/T0 + kv·v (시뮬 전용)
    const va = along > 0 ? along : 0;
    this.phiDotF = floor ? 1 / (this.f.weaponCfg?.gestureT0 ?? G.T0) + G.kv * va : va / G.sL1;
    this.phiF += this.phiDotF * dt;
    this.ringPush(t);
    if (this.state === GES_CUT && this.phiF >= 1) this.state = GES_FOLLOW;
  }

  /** (B) RECOVER 에서 다음 긋기: vStrike 넘게, 앞 획과 거꾸로 긋거나 멈춘 뒤 쉬었다가 (쿨다운 없음) */
  autoRestart(t, F, vx, vy, sp) {
    if (!(F.held && sp > GESTURE.vStrike && (vx * this.dirC[0] + vy * this.dirC[1] < 0 || this._restedRec))) return false;
    this.startCut(t, 'auto', vx, vy, sp);
    return true;
  }

  /** 획 방향과 가장 잘 맞는 무리 (끝 − 준비 방향과의 내적) */
  pickFam(dx, dy) {
    let best = 0, bd = -Infinity;
    for (let i = 0; i < NF; i++) {
      const d = dx * DX[i] + dy * DY[i];
      if (d > bd) (bd = d), (best = i);
    }
    return best;
  }

  /** 시작 자세가 이미 가진 호: |시작 − 끝| / |준비 − 끝| (자르지 않음) */
  arcOf(i) {
    return Math.hypot(this._pCut[0] - ENX[i], this._pCut[1] - ENY[i]) / LREF[i];
  }

  ringPush(t) {
    const r = this._ring;
    const h = this._ringH * 3;
    r[h] = t;
    r[h + 1] = this.p[0];
    r[h + 2] = this.p[1];
    this._ringH = (this._ringH + 1) % RING;
    if (this._ringN < RING) this._ringN++;
  }

  /**
   * φ 를 멈추고 S 를 풀기 시작한다. 원점: 고리 안(베기 뒤)의 마지막 머묾, 없으면 멈춘·뗀 자리(멈춤) 또는 되돌아선 자리(고리에서
   *  긋는 쪽으로 가장 멀리 간 점) — 따라 베기 중에 시작한 되감기를 첫 RECOVER 스텝에 알아본다 (Q18)
   */
  startRecover(t, stopped) {
    this.state = GES_RECOVER;
    this.tRecover = t;
    this._restedRec = false;
    if (this._dwellT >= this.tCut && t - this._dwellT <= GESTURE.buffer * 1000) {
      this.o[0] = this._dwell[0];
      this.o[1] = this._dwell[1];
    } else if (stopped) this.setOrigin();
    else {
      let bx = this.p[0], by = this.p[1];
      let bd = bx * this.dirC[0] + by * this.dirC[1];
      const r = this._ring;
      for (let k = 0; k < this._ringN; k++) {
        const h = k * 3;
        if (t - r[h] > GESTURE.buffer * 1000) continue;
        const d = r[h + 1] * this.dirC[0] + r[h + 2] * this.dirC[1];
        if (d > bd) (bd = d), (bx = r[h + 1]), (by = r[h + 2]);
      }
      this.o[0] = bx;
      this.o[1] = by;
    }
    this.w.fill(0);
    this.phiDotF = 0;
  }

  toIdle() {
    this.state = GES_IDLE;
    this.S = this.Swind = this.over = 0;
    this._overWind = this._overCut = 0;
    this.mode = null;
    this.phiF = -1;
    this.phi = -1; // S = 0: 몸 위상은 아무도 안 읽는다 — 다음 감기가 −1 에서 곧게 시작하게
    this.phiDot = this.phiDDot = 0;
    this.setOrigin();
  }

  /** 몸이 못 하는 동안(넘어짐·칼 없음·찌르기·무릎·마무리) 또는 손가락이 없을 때: S 를 0.08 s 로 접는다 */
  fold(dt) {
    const E = Math.exp(-dt / 0.08);
    this.S *= E;
    this.over *= E;
    this.Swind *= E;
    if (this.S < GESTURE.sSnap) this.S = 0;
    if (this.Swind < GESTURE.sSnap) this.Swind = 0;
    if (this.S === 0) {
      this.toIdle();
      this.Swind = 0;
    } else if (this.state !== GES_RECOVER) this.state = GES_RECOVER;
    this.phiDotF = 0;
    this.c = smoothstep(0, GESTURE.mixX, this.S);
    this.write();
  }

  // ───────── 몸 위상 (§3.6) ─────────

  /** 임계 감쇠 2차 (ω = phiW), 경사 지연 보정 2/ω, 싣기만큼 앞섬 leadMs·S, 정확한 이산화. 운동 방향으로 φ ≤ φF + φ̇F·leadMs·S, 앞 스텝보다 뒤로는 안 당김 */
  phiFilter(dt) {
    const G = GESTURE;
    const phiPrev = this.phi;
    const w = G.phiW;
    const lead = (G.leadMs * this.S) / 1000;
    const u = this.phiF + this.phiDotF * (2 / w + lead);
    const E = Math.exp(-w * dt);
    const e = this.phi - u;
    const a = this.phiDot + w * e;
    this.phi = u + (e + a * dt) * E;
    this.phiDot = (this.phiDot - w * a * dt) * E;
    this.phiDDot = w * w * (u - this.phi) - 2 * w * this.phiDot;
    const bound = this.phiF + this.phiDotF * lead;
    if (this.phiDotF >= 0 ? this.phi > bound : this.phi < bound) {
      // 앞섬 한도 (Q22): 운동 방향으로만, 이미 앞선 만큼은 되돌리지 않음 (손가락이 멈춘 스텝에 몸 위상이 뒤로 튀지 않게)
      this.phi = this.phiDotF >= 0 ? Math.max(bound, Math.min(this.phi, phiPrev)) : Math.min(bound, Math.max(this.phi, phiPrev));
      this.phiDot = (this.phi - phiPrev) / dt;
    }
  }

  /** 출력 정리 + 읽기 전용 보기 */
  write() {
    this.busy = this.state === GES_CUT || this.state === GES_FOLLOW;
    this.famA = this._fam >= 0 ? FAMS[this._fam] : null;
    this.famB = this._famB >= 0 ? FAMS[this._famB] : null;
    this.fam = this._fam >= 0 ? BASE[this._fam] : null;
    const V = this.view;
    if (!V) return;
    V.S = this.S;
    V.phi = this.phi;
    V.phiDot = this.phiDot;
    V.phiDDot = this.phiDDot;
    V.state = this.state;
    V.fam = this.fam;
    V.famA = this.famA;
    V.famB = this.famB;
    V.famMix = this.famMix;
    V.side = this.side;
    V.over = this.over;
    V.c = this.c;
    V.mode = this.mode;
    V.input = this.input;
    V.busy = this.busy;
  }
}

/**
 * 짜 놓은 손가락 길 (시험·AI 자리): 절대 패드 자리 (m), 사이는 직선 보간, 마지막 표본 뒤는 그 자리에 머문다.
 *  at(tMs, out) → { x, y, vx, vy, held } — 빠르기는 t 를 감싸는 두 표본의 기울기 (실제 표본만). 고리 버퍼 (오래된 표본부터 밀려난다)
 */
export class SyntheticFinger {
  constructor(n = 256) {
    this.abs = true;
    this.n = n;
    this.t = new Float64Array(n);
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    this.h = new Uint8Array(n);
    this.head = 0;
    this.count = 0;
  }

  push(tMs, x, y, held = true) {
    const i = this.head;
    this.t[i] = tMs;
    this.x[i] = x;
    this.y[i] = y;
    this.h[i] = held ? 1 : 0;
    this.head = (i + 1) % this.n;
    if (this.count < this.n) this.count++;
  }

  idx(k) {
    return (this.head - 1 - k + this.n) % this.n;
  }

  at(tMs, out) {
    out.vx = out.vy = 0;
    if (this.count === 0) {
      out.x = out.y = 0;
      out.held = false;
      return out;
    }
    // t 를 감싸는 (t0, t1] 구간. 가장 새 표본 뒤는 그 자리에 머문다 (빠르기 0)
    let i1 = this.idx(0);
    if (tMs > this.t[i1]) {
      out.x = this.x[i1];
      out.y = this.y[i1];
      out.held = this.h[i1] === 1;
      return out;
    }
    for (let k = 1; k < this.count; k++) {
      const i0 = this.idx(k);
      if (this.t[i0] < tMs) {
        const span = this.t[i1] - this.t[i0];
        const u = (tMs - this.t[i0]) / span;
        out.x = this.x[i0] + (this.x[i1] - this.x[i0]) * u;
        out.y = this.y[i0] + (this.y[i1] - this.y[i0]) * u;
        out.vx = ((this.x[i1] - this.x[i0]) / span) * 1000;
        out.vy = ((this.y[i1] - this.y[i0]) / span) * 1000;
        out.held = (tMs >= this.t[i1] ? this.h[i1] : this.h[i0]) === 1;
        return out;
      }
      i1 = i0;
    }
    out.x = this.x[i1];
    out.y = this.y[i1];
    out.held = tMs >= this.t[i1] && this.h[i1] === 1; // 첫 표본 전: 아직 닿지 않았다
    return out;
  }

  clear() {
    this.head = 0;
    this.count = 0;
  }
}
