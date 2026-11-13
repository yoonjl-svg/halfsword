// 유파 패시브 넷 (스킬북 4급 — 사장님 10/21 결정 · 값 config SCHOOL_PASSIVE · docs/strike/school_kit_map.md §2 패시브 · 확인표 2133~2136).
//  이베리아 손목 힘(wristK — fighter.js · ai.js)과 같은 틀: 사람 = 4급 책 '사용'(fighter.js o.schoolPassive · 테스트 경로 모두) · AI = 숙련도 SCHOOL_PASSIVE.at 이상(ai.js 가 다시 둔다).
//  몸마다 하나(fighter.schoolPassive) — 받은 유파가 없으면(school null) 아무 일도 하지 않는다(난수 · 몸 · 물리 그대로).
//   · 이탈리아 곧은 선 (리네아 레타) — tipAim: 찌르는 동안 칼끝 목표(fighter.js driveSword 의 aim)를 상대 쪽으로 돌린다. 처음 찌르는 줄에서 tipMax ° 까지 · 초당 tipRate ° 까지.
//     찌르기 = 탭 찌르기(skill.js thrust — 겨눈 뒤 뻗는 동안 · 찍기 빼고) · 그어 찌르기(사람 긋기가 찌르기로 읽힘 — stamina.js stroke.kind) · AI 길 찌르기(찌르기 기술 · 긋기 단계 · 속임수 빼고).
//     막아찌르기(italian_opposition.js — 탭 찌르기 칸을 안 씀) · 비기 · 칼이 맞댄 채 그 선을 따라 미는 탭(칼 길 잡기 R6)은 빼고. 찌르기가 끝나면 같은 빠르기로 돌림을 걷는다(튀지 않음)
//   · 일본 기다림과 침 (켄타이) — 휘두르지 않는 동안 full 초에 걸쳐 0 → gain 쌓임(곧은 오름) · 칼을 낸 순간(strokeStart — 기력 장부의 공격 청구) 그 칼에 묶이고 0 부터 다시.
//     묶인 칼이 상처를 내면(combat.js strike → onHit) 그 맞음에 × (1 + 몫) 뒤 씀 · 못 맞히고(빗나감 · 막힘) 끝난 뒤 이어짐 창(UNIQUE_ASSIST.afterWindow) 안에 시작한 칼이
//     츠바메가에시면 그 몫이 넘어감(unique_assist.js strokeTechOf — 맞는 순간 읽음) · 비기 칼엔 안 묶임 — 10/28 01:5x 사장님 '일본 기다림과 침도 고노센도 적용받게 해':
//     일본 비기 고노센(goNoSen — 사람 skill.sec · AI secretRun)은 보통 칼처럼 묶고 첫 상처에 씀(SCHOOL_PASSIVE.japanese.secret 1 · `?kenSecret=0` = 전 · 다른 비기는 그대로 없음)
//   · 독일 인데스 — 상대 공격이 내게 실패(foeFailed: 헛침 = 칼에도 몸에도 안 닿음 · 막힘 = 내 칼에 닿고 나를 못 벰 — ai.js afterStrike · 사람 공격은 skill.js whiffTrack)하면
//     이어짐 창(afterWindow)이 열리고, 그 안에 시작한 내 칼(비기 아님)은 주는 피해 × (1 + gain × aiK). 칼을 내면 창은 닫힘(그 칼이 되받아 친 칼).
//     10/28 01:4x 사장님 '무기가 맞부딪혔을 때로 하면?' · '겹치기는 맞물리면 인데스 늘 붙게 해' (SCHOOL_PASSIVE.german.touch 1 · `?indesTouch=0` = 전):
//     내 칼이 상대 칼에 닿아 있는 동안(combat.js bladeClash — feel.touching 과 같은 때 · 까닭은 묻지 않음: 내 칼이 막힘 · 상대 칼을 받음 · 맞물림) 창이 열리고
//     스텝마다 창 시계를 0 으로(bladeContact) — 닿음이 끝나고 afterWindow 뒤에 닫힘 · 칼을 내면 닫힘(그대로) · 겹치기(duplieren)는 창이 닫혀 있어도 실림(dealtK).
//     원전: 링에크 — 맞물린 그 순간 부드러움 · 단단함을 느끼고 인데스로 [원전 · 해석]
//     창 안에서 간격 잡기 빠른 디딤(gait.js fastK · chaseStep)이 시작되면 빠른 디딤 · 잡기(gait.hold) 동안 창 시계가 멈추고, 잡기가 끝나면 닫힘(잡기 없이 빠른 디딤만 끝나면 남은 시계)
//   · 동방 숨 바꾸기 (토납 — 『장자』 각의편 吐故納新, 10/21 사장님 이름) — clotK: 휘두르지 않는 동안 피 굳는 빠르기(VITALS.clotting — fighter.js updateVitals) × clot
//  '휘두르는 중'(swingingNow) = 사람: 기력 장부의 공격 중(긋기 · 탭 · 손잡이 찍기 · 긋기 끝 0.35 s 꼬리) · 비기 · 막아찌르기 / AI: 공격의 긋기 · 지나감 단계 · 비기 · 탭 · 찍기
//  11/14 일본 기다림과 침 → 스택 (사장님 11/14 '1초당 1스택, 피격에 1스택, 막기나 흘려받기에 2스택 … 최대 10스택 중첩 +80%' — config JP_TANK · 기록 docs/strike/jp_tank_2026-11-14.md):
//   사람(humanInput) 일본은 쌓인 몫이 시간 곧은 오름 대신 스택 stk(0 ~ max) — 휘두르지 않은 per 초마다 +1(update · 판 시작 정지 동안 안 셈) · 맞음 +hit(tookHit — combat.js strike) ·
//   막기 +block(guardEvent 'block' — stamina.js block) · 흘려 받기 +flow(guardEvent 'flow' — combat.js nagashi) · 한 상대 공격에 막기 · 흘려 받기가 함께 들면 큰 쪽 하나만.
//   칼에 실리는 몫(charge) = stk × each · 묶음 · 씀 · 제비 베기 넘김 · 고노센은 위 켄타이 그대로. AI 는 JP_TANK.ai(견줌)일 때만 · 시뮬 대본 몸은 전 판.
//   바위 몸(11/14 사장님 '스택당 피해 -4%' — JP_TANK.rock · 몫 열쇠 jpRock): takenK(받는 피해 — combat.js analyze) · 스위치: E keep(손목 치기 · 비껴 베기는 스택을 안 씀 — keepCheck) · C 는 secret.js(흘려 받기 수 flowN 을 읽음)
import * as THREE from 'three';
import { SCHOOL_PASSIVE as SP, UNIQUE_ASSIST as UA, THRUST, JP_TANK as JT } from './config.js';
import { strokeTechOf } from './unique_assist.js';
import { kitOff } from './skill_kit.js'; // 11/14 바위 몸 몫 열쇠 jpRock (새 칸 J12 · 임시로 J10 과 함께)

/** 이 파일이 맡는 유파 (이베리아 손목 힘은 fighter.js wristK) */
export const PASSIVE_SCHOOLS = Object.freeze(['italian', 'japanese', 'german', 'chinese']);
const D2R = Math.PI / 180;
const _inv = new THREE.Quaternion();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _h = new THREE.Vector3();
const _w = new THREE.Vector3();
const _ax = new THREE.Vector3();
const KEEP_TECH = new Set(['kote', 'hirakiGiri']); // E (11/14 설계안 — JP_TANK.keep): 손목 치기(J7) · 비껴 베기(J6) — 스택을 쓰지도 지우지도 않는 견제

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
    this.stk = 0; // 일본 스택 (11/14 — JP_TANK · 사람 · stackOn 일 때만 셈)
    this.stkT = 0; // 휘두르지 않은 시간 (다음 +1 까지 — JP_TANK.per)
    this.guardBy = new Map(); // 상대 → { id 공격 번호, n 그 공격에 받은 막기 · 흘려 받기 스택, block · flow 그 일이 들었나(재기 셈), fN 흘려 받기 수에 셌나 }
    this.hitBy = new Map(); // 상대 → '피격' 스택을 받은 공격 번호
    this.flowN = 0; // 흘려 받기가 든 수 (상대 공격 하나에 한 번 — C 받아 치기 고노센 · secret.js counterTick 이 읽음)
    this.win = null; // 인데스 창 { t 지난 시간, chase 간격 잡기로 멈춤, hold 잡기를 봤나 }
    this.tipRv = new THREE.Vector3(); // 리네아 레타: 지금 돌림 (몸 틀 · 축 방향 × 각 rad — 처음 줄 → 고친 줄)
    this.tipRun = null; // 지금 찌르기 { max 가장 크게 돌린 각 rad }
    this.stats = {
      strokes: 0,
      ken: { charged: 0, hits: 0, bonus: 0, carried: 0, lost: 0, secret: 0, secretHits: 0, secretBonus: 0 }, // secret* = 고노센에 묶인 몫 · 실려 맞음 · 몫 합 (10/28)
      indes: { opened: 0, whiff: 0, blocked: 0, touch: 0, paused: 0, strokes: 0, hits: 0, dup: 0 }, // touch = 칼끼리 닿아 새로 연 창 · dup = 창 밖 겹치기에 실림 (10/28)
      tip: { thrusts: 0, corrected: 0, sum: 0, max: 0 },
      clotT: 0,
      // 일본 스택 (11/14): 얻은 수 갈래(idle · hit · block · flow — 상한에 막혀 버린 몫 over) · 일 수(ev) · 스택 실은 칼(strokes · 실은 스택 합 sum · 가장 큰 것 max) · E 로 돌려받은 수(kept) · 제비 베기로 넘긴 스택 합(carried)
      stk: { idle: 0, hit: 0, block: 0, flow: 0, over: 0, ev: { hit: 0, block: 0, flow: 0 }, strokes: 0, sum: 0, max: 0, kept: 0, carried: 0, hitStk: 0 },
    };
  }

  /** 받은 유파 정하기 (fighter.js 생성자 = 사람 규칙 · ai.js 생성자 = 숙련도 규칙으로 다시) */
  set(tradition, { ai = false } = {}) {
    this.school = PASSIVE_SCHOOLS.includes(tradition) ? tradition : null;
    this.ai = ai;
    this.lock = this.win = this.tipRun = null;
    this.idle = 0;
    this.stk = this.stkT = 0;
    this.guardBy.clear();
    this.hitBy.clear();
    this.tipRv.set(0, 0, 0);
  }

  on(key) {
    return this.school === key && schoolPassiveOn(key);
  }

  aiK(key) {
    return this.ai ? SP[key]?.aiK ?? 1 : 1;
  }

  /** 일본 스택 판인가 (11/14 — JP_TANK.stack · 사람 = 사람 입력이 모는 몸 humanInput · AI 는 JP_TANK.ai 견줌일 때만 · 시뮬 대본 몸은 전 판) */
  get stackOn() {
    return !!JT.stack && this.on('japanese') && (this.ai ? !!JT.ai : !!this.f.humanInput);
  }

  /** 화면 표시 (stamina_hud.js — 스택 판일 때 지금 스택 수 · 아니면 null) */
  get stackShow() {
    return this.stackOn ? this.stk : null;
  }

  /** 켄타이: 지금 쌓인 몫 (0 ~ gain · 11/14 스택 판이면 stk × each — 0 ~ max × each) */
  get charge() {
    if (!this.on('japanese')) return 0;
    if (this.stackOn) return JT.each * this.stk;
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
    if (this.stackOn) {
      // 11/14 '1초당 1스택': 휘두르지 않은 per 초마다 +1 (판 시작 정지 fighter.openHold 동안은 안 셈 — 고노센 준비와 같은 규칙 · 휘두르면 strokeStart 가 0 으로)
      if (!sw && !this.f.openHold) {
        this.stkT += dt;
        while (this.stkT >= JT.per - 1e-9) {
          this.stkT -= JT.per;
          this.addStk(1, 'idle');
        }
      }
      if (JT.keep) this.keepCheck();
    }
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
    const kenSec = secret && this.kenSecret(); // 10/28 고노센: 켄타이는 보통 칼처럼 (인데스 · 츠바메가에시 넘김은 비기라 없음)
    if (L && L.t0 === this.t && L.n === this.n) {
      this.n++;
      L.n = this.n;
      if (secret) {
        if (!kenSec) L.ken = L.stk = 0;
        L.carry = L.indes = 0;
        L.kenSec = kenSec;
        if (kenSec && L.ken > 0.005) this.stats.ken.secret++;
      }
      return;
    }
    this.n++;
    this.stats.strokes++;
    // 켄타이: 지금 몫을 이 칼에 묶고 다시 0 부터 · 앞 칼이 못 맞히고 이어짐 창 안이면 그 몫을 들고 감(츠바메가에시일 때만 씀 — dealtK)
    let ken = 0, carry = 0, stk = 0, carryStk = 0;
    if (this.on('japanese')) {
      ken = secret && !kenSec ? 0 : this.charge;
      this.idle = 0;
      if (this.stackOn) {
        // 11/14 스택: 지금 스택을 이 칼에 묶고 0 부터 (다음 +1 까지 시계도 0)
        stk = secret && !kenSec ? 0 : this.stk;
        this.stk = this.stkT = 0;
        const S = this.stats.stk;
        if (stk > 0) (S.strokes++), (S.sum += stk), (S.max = Math.max(S.max, stk));
      }
      if (L && L.ken > 0 && !L.spent) {
        if (!secret && (L.endT == null || this.t - L.endT <= UA.afterWindow)) (carry = L.ken), (carryStk = L.stk ?? 0);
        else this.stats.ken.lost++;
      }
      if (ken > 0.005) this.stats.ken.charged++;
      if (kenSec && ken > 0.005) this.stats.ken.secret++;
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
    this.lock = { n: this.n, t0: this.t, ken, carry, indes, spent: false, hit: false, endT: null, kenSec, stk, carryStk };
  }

  /**
   * 이 비기 칼에 켄타이를 묶나 (10/28 01:5x 사장님 '일본 기다림과 침도 고노센도 적용받게 해' — SCHOOL_PASSIVE.japanese.secret · `?kenSecret=0` = 전):
   *  일본 패시브가 켜져 있고 지금 내는 비기가 고노센(schools.js JAPANESE_SECRET name 'goNoSen' — 사람 skill.sec.S · AI secretRun.S)일 때만. 그 밖 비기는 그대로 없음
   */
  kenSecret() {
    if (!SP.japanese?.secret || !this.on('japanese')) return false;
    const f = this.f;
    const S = f.skill?.sec?.S ?? (f.aiControlled ? f.aiCtl?.secretRun?.S : f.stamina?.controller?.secretRun?.S);
    return S?.name === 'goNoSen';
  }

  /** 주는 피해 배율 (combat.js analyze — 칼날 상처 심각도 · 둔타 에너지에 곱함). 묶인 칼이 살아 있을 때만 · 비기 칼은 1(10/28 고노센 켄타이만 — kenSec) */
  dealtK() {
    const L = this.lock;
    if (!L || L.n !== this.n || !this.school || !swingingNow(this.f)) return 1;
    const sec = !!this.f.stamina?.inSecret;
    if (sec && !L.kenSec) return 1; // 비기 칼 — 패시브 몫 없음 (인데스는 늘 · 켄타이는 고노센 빼고)
    if (JT.keep && this.stackOn) this.keepCheck(); // E: 손목 치기 · 비껴 베기면 묶은 스택을 돌려받고 이 칼엔 안 실림 (맞는 순간에 이름이 먼저 섰을 때)
    let k = 1;
    if (this.on('japanese') && !L.spent) k += Math.max(L.ken, !sec && L.carry > 0 && strokeTechOf(this.f) === 'tsubameGaeshi' ? L.carry : 0);
    if (this.on('german') && !sec) {
      // 10/28 '겹치기는 맞물리면 인데스 늘 붙게 해': 겹치기(duplieren — 앞 칼이 맞물린 뒤 낸 칼 · unique_assist.js strokeTechOf)는 창이 닫혀 있어도 몫 (touch 판만 —
      //  겹치기는 앞 긋기가 끝나고 afterWindow 안에 나가 닿음이 그보다 먼저 끝났을 수 있음: AI 겹치기 13 가운데 창 안 2 — 문서 decisions 10/28)
      let ind = L.indes;
      if (!ind && SP.german.touch && strokeTechOf(this.f) === 'duplieren') {
        ind = SP.german.gain * this.aiK('german');
        if (!L.dup) (L.dup = true), this.stats.indes.dup++;
      }
      k += ind;
    }
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
      if (L.carry > 0 && r.schoolK - 1 > L.ken + 1e-9) (this.stats.ken.carried++), (this.stats.stk.carried += L.carryStk ?? 0);
      if (L.stk > 0 || L.carryStk > 0) this.stats.stk.hitStk += r.schoolK - 1 > L.ken + 1e-9 ? L.carryStk ?? 0 : L.stk ?? 0;
      if (L.kenSec) {
        this.stats.ken.secretHits++;
        this.stats.ken.secretBonus += r.schoolK - 1;
      }
    }
    if (this.on('german') && (L.indes > 0 || L.dup) && !L.hit) {
      L.hit = true;
      this.stats.indes.hits++;
    }
  }

  /** 스택 더하기 (상한 max — 넘친 몫은 stats over) */
  addStk(n, why) {
    if (!(n > 0)) return;
    const add = Math.min(n, Math.max(0, JT.max - this.stk));
    this.stk += add;
    this.stats.stk[why] += add;
    if (n > add) this.stats.stk.over += n - add;
  }

  /**
   * 막기 · 흘려 받기가 듦 (11/14 사장님 '막기나 흘려받기에 2스택' · '흘려받기는 3스택으로 할까?' — JP_TANK.block · flow):
   *  'block' = 내 칼이 상대 공격을 받아 막음(stamina.js block — 막아 받기 기력을 청구하는 때와 같음 · 상대 공격 번호 하나에 한 번) ·
   *  'flow' = 흘려 받기(combat.js nagashi — J3 우케나가시가 든 때). 같은 상대 공격에서 둘 다 들면 큰 쪽 하나만(먼저 든 몫을 빼고 더함).
   *  흘려 받기 수(flowN — C 받아 치기 고노센)는 스택 판과 상관없이 일본 몸이면 셈. att = 상대 몸 · id = 그 공격 번호(stamina.attackId)
   */
  guardEvent(kind, att, id) {
    if (!this.on('japanese') || !this.f.alive) return;
    let r = this.guardBy.get(att);
    if (!r || r.id !== id) this.guardBy.set(att, (r = { id, n: 0, flow: false, block: false, fN: false }));
    if (kind === 'flow' && !r.fN) (r.fN = true), this.flowN++;
    if (!this.stackOn) return;
    if (!r[kind]) (r[kind] = true), this.stats.stk.ev[kind]++;
    const gain = kind === 'flow' ? JT.flow : JT.block;
    if (gain > r.n) {
      this.addStk(gain - r.n, kind);
      r.n = gain;
    }
  }

  /** 맞음 (combat.js strike — applyWound 뒤 · real = 상처나 의식이 실제로 깎임): 11/14 '피격에 1스택' — 상대 공격 번호 하나에 한 번 (한 칼이 두 곳을 베어도 +1) */
  tookHit(att, real) {
    if (!real || !this.stackOn || !this.f.alive) return;
    const id = att?.stamina?.attackId ?? 0;
    if (this.hitBy.get(att) === id) return;
    this.hitBy.set(att, id);
    this.stats.stk.ev.hit++;
    this.addStk(JT.hit, 'hit');
  }

  /**
   * 바위 몸 — 스택당 받는 피해 −4 % (사장님 11/14 '바위 몸은 … 스택당 피해 -4%로 해.(스택은 공격하면 사라지는 거야 알지?)' — JP_TANK.rock · rockEach · 몫 열쇠 jpRock):
   *  받는 칼날 상처 심각도 · 둔타 에너지 배율 1 − rockEach × 스택 (10 스택 0.6 — combat.js analyze). 칼을 내면 스택과 함께 0 → 1
   */
  takenK() {
    if (!JT.rock || !(this.stk > 0) || !this.stackOn || kitOff(this.f, 'jpRock')) return 1;
    return Math.max(0, 1 - JT.rockEach * this.stk);
  }

  /**
   * E 잔기술은 견제로 (11/14 설계안 — JP_TANK.keep · 기본 끔): 지금 묶인 칼이 손목 치기(kote) · 비껴 베기(hirakiGiri)로 읽히면(unique_assist.js strokeTechOf — 긋기 시작 뒤 몇 스텝에 섬)
   *  묶었던 스택을 돌려받고(상한 max) 그 칼의 몫은 0 — 스택을 쓰지도 지우지도 않음. 칼 하나에 한 번 (update · dealtK 가 부름)
   */
  keepCheck() {
    const L = this.lock;
    if (!L || L.kept || L.spent || !(L.stk > 0) || L.n !== this.n || !swingingNow(this.f)) return;
    if (!KEEP_TECH.has(strokeTechOf(this.f))) return;
    L.kept = true;
    const S = this.stats.stk;
    S.kept++;
    S.strokes--;
    S.sum -= L.stk;
    if (L.ken > 0.005) this.stats.ken.charged--;
    this.stk = Math.min(JT.max, this.stk + L.stk);
    L.ken = 0;
    L.stk = 0;
  }

  /** 상대 공격이 내게 실패 — 'whiff' 헛침 · 'blocked' 내 칼에 막힘 (ai.js afterStrike · skill.js whiffEnd). 독일만 창을 연다 */
  foeFailed(kind) {
    if (!this.on('german') || !this.f.alive) return;
    this.win = { t: 0, chase: false, hold: false };
    this.stats.indes.opened++;
    if (kind in this.stats.indes) this.stats.indes[kind]++;
  }

  /**
   * 칼끼리 닿음 (combat.js bladeClash — 이번 스텝 내 칼이 상대 칼에 닿아 있음 · feel.touching 과 같은 때 · 10/28 01:4x 사장님 '무기가 맞부딪혔을 때'):
   *  독일만 — 창이 없으면 열고(stats.indes.touch) · 있으면 창 시계를 0 으로(닿아 있는 동안 늘 열림 · 닿음이 끝나고 afterWindow 뒤 닫힘). 두 몸 모두 부름(제 몸 창만)
   */
  bladeContact() {
    if (!SP.german.touch || !this.on('german') || !this.f.alive) return;
    if (this.win) {
      this.win.t = 0;
      return;
    }
    this.win = { t: 0, chase: false, hold: false };
    this.stats.indes.opened++;
    this.stats.indes.touch++;
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
