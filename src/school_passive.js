// 유파 패시브 넷 (스킬북 4급 — 사장님 10/21 결정 · 값 config SCHOOL_PASSIVE · docs/strike/school_kit_map.md §2 패시브 · 확인표 2133~2136).
//  이베리아 손목 힘(wristK — fighter.js · ai.js)과 같은 틀: 사람 = 4급 책 '사용'(fighter.js o.schoolPassive · 테스트 경로 모두) · AI = 숙련도 SCHOOL_PASSIVE.at 이상(ai.js 가 다시 둔다).
//  몸마다 하나(fighter.schoolPassive) — 받은 유파가 없으면(school null) 아무 일도 하지 않는다(난수 · 몸 · 물리 그대로).
//   · 이탈리아 곧은 선 (리네아 레타) — tipAim: 찌르는 동안 칼끝 목표(fighter.js driveSword 의 aim)를 상대 쪽으로 돌린다. 처음 찌르는 줄에서 tipMax ° 까지 · 초당 tipRate ° 까지.
//     찌르기 = 탭 찌르기(skill.js thrust — 겨눈 뒤 뻗는 동안 · 찍기 빼고) · 그어 찌르기(사람 긋기가 찌르기로 읽힘 — stamina.js stroke.kind) · AI 길 찌르기(찌르기 기술 · 긋기 단계 · 속임수 빼고).
//     막아찌르기(italian_opposition.js — 탭 찌르기 칸을 안 씀) · 비기 · 칼이 맞댄 채 그 선을 따라 미는 탭(칼 길 잡기 R6)은 빼고. 찌르기가 끝나면 같은 빠르기로 돌림을 걷는다(튀지 않음)
//   · 일본 기다림과 침 (켄타이) — 휘두르지 않는 동안 full 초에 걸쳐 0 → gain 쌓임(곧은 오름) · 칼을 낸 순간(strokeStart — 기력 장부의 공격 청구) 그 칼에 묶이고 0 부터 다시.
//     묶인 칼이 상처를 내면(combat.js strike → onHit) 그 맞음에 × (1 + 몫) 뒤 씀 · 못 맞히고(빗나감 · 막힘) 끝난 뒤 이어짐 창(UNIQUE_ASSIST.afterWindow) 안에 시작한 칼이
//     츠바메가에시면 그 몫이 넘어감(unique_assist.js strokeTechOf — 맞는 순간 읽음) · 비기 칼엔 안 묶임
//   · 독일 인데스 — 상대 공격이 내게 실패(foeFailed: 헛침 = 칼에도 몸에도 안 닿음 · 막힘 = 내 칼에 닿고 나를 못 벰 — ai.js afterStrike · 사람 공격은 skill.js whiffTrack)하면
//     이어짐 창(afterWindow)이 열리고, 그 안에 시작한 내 칼(비기 아님)은 주는 피해 × (1 + gain × aiK). 칼을 내면 창은 닫힘(그 칼이 되받아 친 칼).
//     창 안에서 간격 잡기 빠른 디딤(gait.js fastK · chaseStep)이 시작되면 빠른 디딤 · 잡기(gait.hold) 동안 창 시계가 멈추고, 잡기가 끝나면 닫힘(잡기 없이 빠른 디딤만 끝나면 남은 시계)
//   · 동방 숨 바꾸기 (토납 — 『장자』 각의편 吐故納新, 10/21 사장님 이름) — clotK: 휘두르지 않는 동안 피 굳는 빠르기(VITALS.clotting — fighter.js updateVitals) × clot
//  '휘두르는 중'(swingingNow) = 사람: 기력 장부의 공격 중(긋기 · 탭 · 손잡이 찍기 · 긋기 끝 0.35 s 꼬리) · 비기 · 막아찌르기 / AI: 공격의 긋기 · 지나감 단계 · 비기 · 탭 · 찍기
import * as THREE from 'three';
import { SCHOOL_PASSIVE as SP, UNIQUE_ASSIST as UA, THRUST } from './config.js';
import { strokeTechOf } from './unique_assist.js';

/** 이 파일이 맡는 유파 (이베리아 손목 힘은 fighter.js wristK) */
export const PASSIVE_SCHOOLS = Object.freeze(['italian', 'japanese', 'german', 'chinese']);
const D2R = Math.PI / 180;
const _inv = new THREE.Quaternion();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _h = new THREE.Vector3();
const _w = new THREE.Vector3();
const _ax = new THREE.Vector3();

/** 유파 패시브 스위치 — 모두(SCHOOL_PASSIVE.on) · 그 유파(.on) */
export function schoolPassiveOn(tradition) {
  return !!SP.on && !!SP[tradition] && SP[tradition].on !== false;
}

/** 휘두르는 중인가 (켄타이 쌓임 멈춤 · 묶인 칼이 살아 있음 · 동방 숨 바꾸기) */
export function swingingNow(f) {
  const sk = f.skill, st = f.stamina;
  if (sk?.tap || sk?.pom || sk?.sec || st?.inSecret) return true;
  if (f.aiControlled) {
    const c = f.aiCtl;
    return !!c && c.mode === 'attack' && (c.phase === 'strike' || c.phase === 'follow');
  }
  return !!(st?.attacking || f.parryGuard?.opposition?.run);
}

export class SchoolPassive {
  constructor(f) {
    this.f = f;
    this.school = null; // 받은 유파 (PASSIVE_SCHOOLS 가운데 — 사람 = 4급 책 · AI = 숙련도). null = 없음
    this.ai = false; // AI 몫(aiK)인가
    this.t = 0; // 이 몸의 시계 (update — 받은 유파가 있을 때만 셈)
    this.n = 0; // 칼을 낸 수 (strokeStart)
    this.swing = false; // 지난 update 때 휘두르는 중이었나
    this.lock = null; // 지금 칼에 묶인 몫 { n, t0, ken, carry, indes, spent, hit, endT }
    this.lastLock = null; // 마지막으로 피해 배율을 낸 묶음 (dealtK → combat.js 결과 schoolLock)
    this.idle = 0; // 켄타이: 공격 없이 기다린 시간
    this.win = null; // 인데스 창 { t 지난 시간, chase 간격 잡기로 멈춤, hold 잡기를 봤나 }
    this.tipRv = new THREE.Vector3(); // 리네아 레타: 지금 돌림 (몸 틀 · 축 방향 × 각 rad — 처음 줄 → 고친 줄)
    this.tipRun = null; // 지금 찌르기 { max 가장 크게 돌린 각 rad }
    this.stats = {
      strokes: 0,
      ken: { charged: 0, hits: 0, bonus: 0, carried: 0, lost: 0 },
      indes: { opened: 0, whiff: 0, blocked: 0, paused: 0, strokes: 0, hits: 0 },
      tip: { thrusts: 0, corrected: 0, sum: 0, max: 0 },
      clotT: 0,
    };
  }

  /** 받은 유파 정하기 (fighter.js 생성자 = 사람 규칙 · ai.js 생성자 = 숙련도 규칙으로 다시) */
  set(tradition, { ai = false } = {}) {
    this.school = PASSIVE_SCHOOLS.includes(tradition) ? tradition : null;
    this.ai = ai;
    this.lock = this.win = this.tipRun = null;
    this.idle = 0;
    this.tipRv.set(0, 0, 0);
  }

  on(key) {
    return this.school === key && schoolPassiveOn(key);
  }

  aiK(key) {
    return this.ai ? SP[key]?.aiK ?? 1 : 1;
  }

  /** 켄타이: 지금 쌓인 몫 (0 ~ gain) */
  get charge() {
    if (!this.on('japanese')) return 0;
    const J = SP.japanese;
    return J.gain * Math.min(1, this.idle / J.full);
  }

  /** 인데스 창이 열렸나 (간격 잡기로 시계가 멈춘 동안 포함 — fighter.indesOpen) */
  get indesOpen() {
    return !!this.win && this.on('german');
  }

  /** 인데스 창 남은 초 (멈춘 동안 · 닫힘 = null — fighter.indesLeft) */
  get indesLeft() {
    const W = this.win;
    return W && !W.chase && this.on('german') ? Math.max(0, UA.afterWindow - W.t) : null;
  }

  /** 매 스텝 (fighter.js step — 기력 장부 뒤) */
  update(dt) {
    if (!this.school || !(dt > 0)) return;
    this.t += dt;
    const sw = (this.swing = swingingNow(this.f));
    const L = this.lock;
    if (L && L.endT == null && !sw) L.endT = this.t; // 묶인 칼이 끝남 (츠바메가에시로 넘길 창은 여기부터)
    if (this.on('japanese') && !sw) this.idle += dt;
    if (this.win) this.tickIndes(dt);
    if (this.on('chinese') && !sw) this.stats.clotT += dt;
  }

  /**
   * 칼을 낸 순간 (stamina.js chargeAttack · secret — 기력 장부의 공격 청구와 같은 때: 사람 긋기 · 탭 · 손잡이 찍기 · 막아찌르기 · AI 긋기 시작 · 비기).
   *  같은 스텝에 또 오면(앞 긋기를 끝에 셈 + 새 탭 — stamina.attack 의 finishStroke) 묶인 몫을 새 칼로 옮긴다
   */
  strokeStart(secret = false) {
    if (!this.school) return;
    const L = this.lock;
    if (L && L.t0 === this.t && L.n === this.n) {
      this.n++;
      L.n = this.n;
      if (secret) L.ken = L.carry = L.indes = 0;
      return;
    }
    this.n++;
    this.stats.strokes++;
    // 켄타이: 지금 몫을 이 칼에 묶고 다시 0 부터 · 앞 칼이 못 맞히고 이어짐 창 안이면 그 몫을 들고 감(츠바메가에시일 때만 씀 — dealtK)
    let ken = 0, carry = 0;
    if (this.on('japanese')) {
      ken = secret ? 0 : this.charge;
      this.idle = 0;
      if (L && L.ken > 0 && !L.spent) {
        if (!secret && (L.endT == null || this.t - L.endT <= UA.afterWindow)) carry = L.ken;
        else this.stats.ken.lost++;
      }
      if (ken > 0.005) this.stats.ken.charged++;
    }
    // 인데스: 창 안에 낸 칼 (비기는 몫 없이 창만 닫힘)
    let indes = 0;
    if (this.win && this.on('german')) {
      if (!secret) {
        indes = SP.german.gain * this.aiK('german');
        this.stats.indes.strokes++;
      }
      this.win = null;
    }
    this.lock = { n: this.n, t0: this.t, ken, carry, indes, spent: false, hit: false, endT: null };
  }

  /** 주는 피해 배율 (combat.js analyze — 칼날 상처 심각도 · 둔타 에너지에 곱함). 묶인 칼이 살아 있고 비기가 아닐 때만 */
  dealtK() {
    const L = this.lock;
    if (!L || L.n !== this.n || !this.school || this.f.stamina?.inSecret || !swingingNow(this.f)) return 1;
    let k = 1;
    if (this.on('japanese') && !L.spent) k += Math.max(L.ken, L.carry > 0 && strokeTechOf(this.f) === 'tsubameGaeshi' ? L.carry : 0);
    if (this.on('german')) k += L.indes;
    if (k !== 1) this.lastLock = L; // combat.js 가 결과에 붙여 onHit 에 돌려준다 (그 사이 새 칼이 묶여도 실린 칼의 몫을 씀)
    return k;
  }

  /** 묶인 몫이 실린 맞음이 상처로 들어감 (combat.js strike — applyWound 뒤). 켄타이는 여기서 씀 */
  onHit(r) {
    const L = r?.schoolLock ?? this.lock;
    if (!L || !(r?.schoolK > 1)) return;
    if (this.on('japanese') && !L.spent) {
      L.spent = true;
      this.stats.ken.hits++;
      this.stats.ken.bonus += r.schoolK - 1;
      if (L.carry > 0 && r.schoolK - 1 > L.ken + 1e-9) this.stats.ken.carried++;
    }
    if (this.on('german') && L.indes > 0 && !L.hit) {
      L.hit = true;
      this.stats.indes.hits++;
    }
  }

  /** 상대 공격이 내게 실패 — 'whiff' 헛침 · 'blocked' 내 칼에 막힘 (ai.js afterStrike · skill.js whiffEnd). 독일만 창을 연다 */
  foeFailed(kind) {
    if (!this.on('german') || !this.f.alive) return;
    this.win = { t: 0, chase: false, hold: false };
    this.stats.indes.opened++;
    if (kind in this.stats.indes) this.stats.indes[kind]++;
  }

  tickIndes(dt) {
    const W = this.win;
    if (!this.on('german')) {
      this.win = null;
      return;
    }
    const g = this.f.gait;
    const fast = !!g && g.fastK > 1 && !!g.chaseStep; // 간격 잡기 빠른 디딤 중
    const hold = !!g?.hold; // 잡기 중 (플레이어만)
    if (!W.chase && fast) {
      W.chase = true; // 창 안에서 빠른 디딤이 시작됨 → 빠른 디딤 · 잡기 동안 시계 멈춤
      this.stats.indes.paused++;
    }
    if (W.chase) {
      if (fast || hold) {
        if (hold) W.hold = true;
        return;
      }
      W.chase = false;
      if (W.hold) {
        this.win = null; // 잡기가 끝나면 닫힘
        return;
      }
    }
    if ((W.t += dt) > UA.afterWindow) this.win = null;
  }

  /** 피 굳기 배율 (fighter.js updateVitals): 동방 숨 바꾸기 · 휘두르지 않는 동안 clot */
  clotK() {
    return this.on('chinese') && !this.swing ? SP.chinese.clot : 1;
  }

  /** 리네아 레타: 지금 겨눌 점(세계 — _p 에 적음)과 뻗는 줄의 기준(탭 찌르기 손 시작 h0 · 몸 틀). 찌르는 중이 아니면 null */
  thrustTarget() {
    const f = this.f, sk = f.skill, foe = f.foe;
    if (!foe?.alive || !f.armed || f.stamina?.inSecret || sk?.sec || sk?.pom || f.parryGuard?.opposition?.run) return null;
    const tp = sk?.tap;
    if (tp) {
      if (tp.down || tp.abort || tp.bound || !sk.thrustPush) return null; // 겨누는 동안은 탭 찌르기가 이미 겨눔 · 찍기 · 거둠 · 칼 길 잡기(R6 — 맞댄 칼 선을 따라 밂) 빼고
      if (tp.vital) _p.fromArray(tp.vital.target);
      else _p.copy(foe.bodies[tp.head && !foe.decapitated ? 'head' : 'chest'].translation());
      return { h0: tp.h0 };
    }
    if (f.aiControlled) {
      const c = f.aiCtl;
      if (!c || c.mode !== 'attack' || c.phase !== 'strike' || c.tech?.kind !== 'thrust' || c.feint) return null;
    } else {
      const s = f.stamina?.stroke;
      if (!s || s.kind !== 'thrust' || !(sk.inputMotion ? sk.inputSwinging : sk.swinging)) return null;
    }
    _p.copy(foe.bodies.chest.translation());
    return { h0: null };
  }

  /**
   * 리네아 레타 (fighter.js driveSword — 칼끝 목표 aim: 몸 틀 단위 벡터, 그 자리에서 고친다): 찌르는 동안 칼자루 → 겨눌 점 쪽으로 돌림(처음 줄에서 tipMax 까지)을
   *  초당 tipRate 까지 따라간다. 찌르지 않으면 같은 빠르기로 0 으로. AI 는 × aiK
   */
  tipAim(aim, dt) {
    if (!this.on('italian')) {
      if (this.tipRun) this.endTip();
      return;
    }
    const f = this.f, C = SP.italian, k = this.aiK('italian');
    const T = this.thrustTarget();
    _w.set(0, 0, 0);
    if (T) {
      const c = f.bodies.chest.translation();
      _inv.copy(f.yaw).invert();
      _p.set(_p.x - c.x, _p.y - c.y, _p.z - c.z).applyQuaternion(_inv); // 겨눌 점 (몸 틀)
      if (T.h0) {
        // 탭 찌르기: 겨누는 동안과 같은 점 — 손 시작 → 목표 줄 너머 past (skill.js updateThrust)
        _d.set(_p.x - T.h0[0], _p.y - T.h0[1], _p.z - T.h0[2]).normalize();
        _p.addScaledVector(_d, THRUST.past);
      }
      const s = f.sword.translation();
      _h.set(s.x - c.x, s.y - c.y, s.z - c.z).applyQuaternion(_inv); // 칼자루 (몸 틀)
      _d.subVectors(_p, _h).normalize();
      const ang = aim.angleTo(_d);
      if (ang > 1e-4) {
        _w.crossVectors(aim, _d);
        if (_w.lengthSq() > 1e-12) _w.setLength(Math.min(ang, C.tipMax * k * D2R));
        else _w.set(0, 0, 0);
      }
      if (!this.tipRun) {
        this.tipRun = { max: 0 };
        this.stats.tip.thrusts++;
      }
    } else if (this.tipRun) this.endTip();
    const rv = this.tipRv;
    rv.addScaledVector(aim, -rv.dot(aim)); // 지금 줄에 곧게 (그은 찌르기는 처음 줄이 손가락을 따라 움직인다)
    _ax.subVectors(_w, rv);
    const step = C.tipRate * k * D2R * Math.max(0, dt);
    if (_ax.length() > step) _ax.setLength(step);
    rv.add(_ax);
    const a = rv.length();
    if (a > 1e-7) aim.applyAxisAngle(_ax.copy(rv).divideScalar(a), a).normalize();
    else rv.set(0, 0, 0);
    if (this.tipRun) this.tipRun.max = Math.max(this.tipRun.max, a);
  }

  endTip() {
    const m = this.tipRun.max;
    this.tipRun = null;
    if (m > 0.5 * D2R) {
      this.stats.tip.corrected++;
      this.stats.tip.sum += m / D2R;
      this.stats.tip.max = Math.max(this.stats.tip.max, m / D2R);
    }
  }
}
