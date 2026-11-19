// ─────────────────────────────────────────────────────────────
//  플레이어 막기 버튼 (10/11 — 사장님 20:3x '막기 버튼을 따로 뺄까? 그거 누르고 있으면 자동으로 막기 자세를 취한다거나' · 22:0x 승인,
//   기록 docs/strike/player_parry_button_2026-10-11.md)
//
//  누르고 있는 동안(main.js — 폰 오른쪽 아래 '막기' 단추 · PC 키 F) AI 막기(ai.js respond → defend)와 같은 판단으로 손(칼)을 유파 막기 자리로 옮긴다:
//   · 들어오는 칼 읽기 = AI 와 같은 함수 secret.js threatNow (ai.js threat 와 같은 셈). 반응 지연은 넣지 않는다(lag 0 — 지금 모습, 플레이어 비기 창과 같은 눈):
//     사람의 반응은 버튼을 누르는 때다(늦게 누르면 손이 막기 빠르기로 제때 못 닿음). AI 처럼 AI_LEVELS.normal.reaction 만큼 늦게 보는 판은 lag 로 잰다(기록 §4).
//     한 공격(위협 번호 — 0.25 s 조용했다가 다시 오면 새 공격, ai.js threat 와 같은 규칙)에 한 번 줄을 정한다(ai.js respond).
//   · 막기 자리 = 내 꾸러미 school.parry[줄] (없으면 pose.point — ai.js defend 그대로). 중국·독일(왕관 — 10/12)은 그 줄의 몸꼴 덧씌우기(parryCover — frames.js installCover, AI 와 같은 함수).
//   · 손 빠르기 = AI 막기 빠르기 L.parrySpeed (L = 숙련도의 실력 숫자 — 11/19 prof_body.js scriptLevel · 몸 값과 같은 숙련도 · 비기 손 빠르기와 같은 표 · 전 늘 AI_LEVELS.normal). 손 목표를 그 빠르기로 옮긴다
//     (ai.js moveHand 와 같은 꼴 — 순간이동 없음). 막혔는지는 물리.
//     동방 막기 책(무기 유파 chinese · 책 사용)만 그 빠르기에 SKILL.cnParrySpeedK 를 곱한다 (10/17 사장님 승인 — 판 값 1 = 그대로, docs/strike/chinese_parry_speed_2026-10-17.md)
//     동방 막기 마지막 안 둘 (10/17 20:1x 사장님 — 판 값 0 = 끔, docs/strike/chinese_parry_brace_2026-10-17.md): 막는 중(mode 'defend')만 ⓐ 버티는 힘 SKILL.cnBraceK — 서보 힘 × (1 + K)
//      ⓑ 피해 감소 SKILL.cnParryDmgCut — 그때 입는 칼날 상처 심각도 × (1 − cut) (woundKeep — combat.js analyze 가 읽는다)
//   · 막기가 끝나는 때 = ai.js defend 의 '공격이 지나갔다'(위협 없음 0.12 s · 상대 손 2.5 m/s 밑 · 막기 0.3 s 지남) 또는 막기 시간 0.65 s (ai.js respond) — 끝나면 기다림.
//   · 기다림(들어오는 칼이 없음) = ai.js coverFor (AI 가 물러나며 쓰는 '상대가 칼을 든 쪽에서 올 베기를 미리 가리는 자리' — 상대 손이 가운데면 칼끝으로 겨눔 pose.point).
//  AI 와 다른 것: 굴림이 없다(guardChance·피하기 defVoid·맞받아치기·되받아 치기 없음 — 버튼을 누른 것이 '막는다'는 결정). 발(스틱)은 플레이어 것.
//  풀림: 누른 채 휘두르면(끌기 빠르기 ≥ SKILL.swingSpeed — main.js 의 비기 공격 입력과 같은 문턱) 또는 톡(찌르기)이면 그 공격이 끝날 때까지 막기를 놓는다(main.js).
//   막기 연환 창이 열려 있으면 그 휘두르기가 비기 (main.js 의 지금 장치 그대로 — 이 파일은 손대지 않는다).
//  손가락 빠르기와 섞이지 않게: 이 파일이 옮긴 손 목표만큼 검술 층의 지난 목표(skill.prev)도 옮겨, 휘두르기 판정(skill.swinging — 내딛기·베기 덩이·막기 연환의 '공격 중')은
//   손가락 끌기만 본다. 대신 손이 휘두르기 문턱보다 빠르게 옮겨지는 동안은 AI 막기처럼 휘두르기 꼴의 거르기·몸 따라가기를 쓴다(skill.guardDrive).
//  새 수 없음 — 모두 AI·검술 층에 있던 값.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { AI_LEVELS, SKILL, realS } from './config.js';
import { scriptLevel } from './prof_body.js';
import { thrustTell } from './thrust_tell.js'; // 찌르기 낌새 (11/15 — 사장님 11/16 묶음 P)
import { Senses, addFoeSense, setFoeSense, recordFoeSenses } from './ai_sense.js';
import { threatNow } from './secret.js';
import { bwStiff } from './burst_whiff.js'; // 뒤 박차기 헛침 경직 (11/19): 굳은 동안 막기 없음
import { TRADITIONS } from './schools.js';
import { GUARD_BASE } from './guards.js';
import { installCover } from './frames.js';
import { AI } from './ai.js';
import { ItalianOpposition } from './italian_opposition.js';
// 표준 시간 (10/25 22:3x — config.js TIME): ai.js defend 와 같은 막기 시간 · 위협 틈은 실제 초로 적고 한 번 게임 초로
const DEF_T = realS(0.65); // 막기 한 번의 길이
const DEF_MIN = realS(0.35); // 공격이 지나갔으면 남은 시간이 이 밑일 때 놓는다
const QUIET_T = realS(0.12); // 위협이 이만큼 없고 손이 멎으면 '공격이 지나갔다'
const NEW_THREAT_T = realS(0.25); // 잠깐 조용했다가 다시 오면 새 공격
import { kitOff } from './skill_kit.js'; // 플레이어 스킬트리 몫 (10/21 — 몸꼴 덧씌우기 parryCover · 막는 동안 피해 감소 parryCut)

const _r = new THREE.Vector3();
const LINES = ['highL', 'highR', 'highC', 'lowL', 'lowR', 'thrust'];
// coverFor 가 고른 자리 → 줄 이름 (10/16 23:5x): 두 줄이 같은 자리를 쓰면(이베리아 lowL·lowR = 왼 비낀 자세 · 동방 highR·highC = 거정세 자리 · 이탈리아 highL·lowL)
//  LINES 차례의 앞 줄만 잡혀 그 줄의 몸꼴 덧씌우기가 엇갈렸다(동방 정수리 준비에 거정세 대신 맨 자리) — coverFor 와 같은 규칙으로 상대 칼이 있는 쪽 줄을 먼저 본다.
//  손 목표(자리)는 그대로 — 고르는 줄 이름만. 가운데(pose.point)는 전과 같이 LINES 차례
function coverLineOf(school, s, p) {
  const want = s.hy > 0.15 ? (s.hx > 0.15 ? 'highL' : s.hx < -0.15 ? 'highR' : 'highC') : s.hy < -0.2 ? (s.hx >= 0 ? 'lowL' : 'lowR') : null;
  if (want && school.parry[want] === p) return want;
  return LINES.find((k) => school.parry[k] === p);
}

export class PlayerParryGuard {
  /** 손 빠르기의 실력 숫자 (11/19 사장님 '사람 막기 단추 손 빠르기는 숙련도를 따름' — prof_body.js scriptLevel: 몸 값과 같은 숙련도의 이름 · 숙련도가 없는 몸(재는 도구)은 보통 = 전 판) */
  get L() {
    return scriptLevel(this.me);
  }

  constructor(me, foe) {
    this.me = me;
    this.foe = foe;
    me.parryGuard = this; // 흘려 받기(combat.js — config NAGASHI)가 '막기 단추를 누름'을 읽는다
    this.sense = new Senses(me, foe);
    this.lag = 0; // 위협을 몇 초 전 모습으로 읽나 (0 = 지금. 재기: AI_LEVELS.normal.reaction 0.26 이면 AI 보통과 같은 눈)
    this.held = false; // 버튼·키를 누르고 있나 (main.js)
    this.broken = false; // 누른 채 공격 → 그 공격이 끝날 때까지 놓음 (main.js 가 켠다)
    this.active = false; // 이번 스텝 손을 쥐었나
    // installCover 가 읽는 AI 꼴 (mode 'defend' · defVoid · defLine)
    this.mode = 'idle';
    this.defVoid = false;
    this.defLine = null;
    this.coverLine = null; // 기다림에 가리는 줄 (installCover watch 칸 — 독일 왕관이 기다림에도 같은 꼴, 10/12)
    this.timer = 0;
    this.noThreat = Infinity;
    this.threatId = 0;
    this.threatSeen = -1;
    this.line = null; // 지금 손이 가는 자리의 줄 (defLine 또는 기다림의 coverFor 줄 · 'point')
    this.stats = { heldT: 0, threats: 0, lines: {}, waitT: 0 };
    this.boost = false; // 동방 버티는 힘이 me.powerMul 을 쥐고 있나
    this.clock = 0;
    this.opposition = new ItalianOpposition(me, foe, this);
    // 대기실 스킬트리 막기 I 을 안 익힌 플레이어(me.schoolParry === false — main.js newRound, 모든 판): 무유파 막기 자리(TRADITIONS.none.parry)·덧씌우기 없음
    //  몸꼴 덧씌우기는 칸 몫 parryCover(10/21 — 독일은 막기 II 왕관 G4 · 이베리아 B8 · 일본 J2 · 동방 C7 · 이탈리아 I5 는 막기 I 과 같이)
    const pc = me.schoolParry === false || kitOff(me, 'parryCover') ? null : TRADITIONS[me.swordArt?.tradition]?.parryCover;
    if (pc) {
      const { down, ...covers } = pc; // 쓰러져 머리 가리기(down)는 AI 몫 — 플레이어 몸엔 막기 줄만
      if (Object.keys(covers).length) installCover(me, this, covers);
    }
  }

  /** 2:2 (동시 대전 3단계 10/29): 상대를 하나 더 · 겨눈 상대 바꾸기 — 눈(Senses)만 상대마다 (ai_sense.js) */
  addFoe(f) {
    addFoeSense(this, f);
  }
  setFoe(f) {
    setFoeSense(this, f);
    if (this.opposition && f) this.opposition.foe = f; // 이탈리아 맞서기도 지금 상대를 본다
  }

  get school() {
    return this.me.swordArt?.school ?? null;
  }


  padOf(line) {
    const S = this.school;
    if (!S) return null;
    if (line === 'point') return S.pose.point;
    const P = this.me.schoolParry === false ? TRADITIONS.none.parry : S.parry; // 스킬북 '막기' 없음·해제 = 무유파 자리
    return P[line] || S.pose.point;
  }

  /** 지금 잡은 막기 자세 이름 { name, desc } — 중국 덧씌우기 자리는 그 이름(거정세·어거세·요략세), 아니면 그 패드에서 가장 가까운 내 자세표 자리의 이름 (표두세·황소…) */
  nameOf(line) {
    const me = this.me;
    const tr = me.swordArt?.tradition;
    const slot = line && line !== 'point' && me.schoolParry !== false && !kitOff(me, 'parryCover') ? TRADITIONS[tr]?.parryCover?.[line] : null;
    if (slot?.name) return { name: slot.name, desc: slot.desc };
    const p = this.padOf(line);
    if (!p) return null;
    let best = 0;
    let bd = Infinity;
    GUARD_BASE.forEach((g, i) => {
      const d = Math.hypot(g.pad[0] - p[0], g.pad[1] - p[1]);
      if (d < bd) (bd = d), (best = i);
    });
    return me.swordArt?.names?.[best] ?? GUARD_BASE[best];
  }

  /** 매 물리 스텝 (player.step 앞). 손 목표를 옮겼으면 true */
  step(dt) {
    const me = this.me;
    const sk = me.skill;
    this.clock += dt;
    this.opposition.beginGuardStep();
    recordFoeSenses(this, dt); // 1:1 = this.sense.record(dt) 그대로 (2:2 는 상대마다 — setFoe)
    sk.guardDrive = 0;
    const can = !me.stamina.exhausted && this.held && !this.broken && me.alive && me.armed && !me.weapon?.gun && !sk.sec && !sk.tap && !sk.pom && (me.state === 'stand' || me.state === 'kneel') && !!this.school && !me.ibLink && !bwStiff(me); // 11/14 이어 돌리기(머리 위 원) 동안 막기 안 됨 — 슬러거의 대가 (iberian_link.js · IB_LINK) · 11/19 뒤 박차기 헛침 경직 동안 막기 없음
    // 위협 읽기 (누르지 않아도 센다 — 누르는 순간 이미 오는 칼을 읽게. 번호는 ai.js threat 와 같은 규칙)
    const L = this.L;
    const s = this.sense.seen(this.lag);
    const c = me.bodies.chest.translation();
    const d = Math.max(0.01, Math.hypot(s.cx - c.x, s.cz - c.z));
    const foeReach = (me.swordArt?.measureFor?.(this.foe.weapon)?.reach ?? 1) + 0.05; // ai.js 생성자 foeReach 와 같은 셈 (PlayerSecretWatch.view 와 같음)
    let th = this.foe.alive ? threatNow(this.sense, this.foe, s, c, me.right(_r), d, foeReach, this.lag) : null;
    // 찌르기 낌새 (11/15 — 사장님 11/16 묶음 P): 곧은 줄 눈이 못 잡은 칼이 칼날 줄로 나오기 시작하면 찌르기 줄로 (AI 눈과 같은 셈 · 같은 모습)
    if (!th && this.foe.alive && d < foeReach + 0.3) {
      const h = thrustTell(s, c);
      if (h) (th = { line: 'thrust', thrust: true, sp: h.sp, E: 0.5 * (this.foe.swordProps?.m ?? 1.5) * h.sp * h.sp, high: s.hy > 0.15, tell: true }), (this.stats.tell = (this.stats.tell ?? 0) + 1);
    }
    if (th) {
      if (this.noThreat > NEW_THREAT_T) this.threatId++;
      this.noThreat = 0;
    } else this.noThreat += dt;
    if (!can) {
      if (this.active && !this.broken) sk.cutPending = true; // 놓으면 검술 층의 '자세로 돌아가기'(쉴 자세)로 — 휘두르고 난 뒤와 같은 길
      this.active = false;
      this.mode = 'idle';
      this.defLine = null;
      this.coverLine = null;
      this.line = null;
      if (this.boost) (me.powerMul = 1), (this.boost = false);
      return false;
    }
    this.active = true;
    this.stats.heldT += dt;
    // 한 공격에 한 번 줄을 정한다 (ai.js respond — 굴림 없음)
    if (th && this.threatId !== this.threatSeen) {
      this.threatSeen = this.threatId;
      this.defLine = th.line;
      this.timer = DEF_T;
      this.stats.threats++;
      this.stats.lines[th.line] = (this.stats.lines[th.line] ?? 0) + 1;
    } else if (!th && this.defLine) {
      // 따라가기 (10/16 — docs/strike/yoryak_shape_2026-10-16.md): 막는 중 위협이 잠깐 끊기면(상대가 준비 자세에서 멈춤) 기다릴 때와 같은 규칙(coverFor)으로
      //  상대 칼이 있는 쪽 줄로 옮긴다 — 준비 동작을 공격으로 읽어 굳힌 줄(위)을 칼을 내린 준비 자세(아래)로 바로잡는다.
      //  가까운 올려 베기는 다리를 먼저 베어, 긋기 전에 아래 자리(동방 요략세)에 가 있어야 막는다
      const p = AI.prototype.coverFor.call({ school: this.school }, s);
      const ln = coverLineOf(this.school, s, p);
      if (ln && ln !== this.defLine) {
        this.defLine = ln;
        this.stats.follow = (this.stats.follow ?? 0) + 1;
      }
    }
    if (this.defLine) {
      // ai.js defend 의 끝: 공격이 지나갔다 (칼끝이 더는 오지 않고 손이 멈췄다) · 막기 시간이 다 됐다
      this.timer -= dt;
      const swingOver = this.noThreat > QUIET_T && Math.hypot(s.hvx, s.hvy) < 2.5;
      if ((swingOver && this.timer < DEF_MIN) || this.timer <= 0) this.defLine = null;
    }
    let p;
    if (this.defLine) {
      this.mode = 'defend';
      this.line = this.defLine;
      p = this.padOf(this.defLine);
    } else {
      this.mode = 'idle';
      this.stats.waitT += dt;
      p = AI.prototype.coverFor.call({ school: this.school }, s); // 기다림: AI 가 물러나며 가리는 자리 (같은 함수)
      this.line = p === this.school.pose.point ? 'point' : (coverLineOf(this.school, s, p) ?? 'point');
    }
    this.coverLine = this.mode === 'idle' && this.line !== 'point' ? this.line : null;
    // 손 목표를 막기 빠르기로 (ai.js moveHand 와 같은 꼴)
    const off = me.handOffset;
    const dx = p[0] - off.x;
    const dy = p[1] - off.y;
    const dd = Math.hypot(dx, dy);
    const cnK = this.chineseBook() ? SKILL.cnParrySpeedK : 1; // 동방 막기 책 손 빠르기 배율 (10/17 — SKILL.cnParrySpeedK, 판 값 1 = 그대로)
    const step = L.parrySpeed * cnK * dt;
    const k = dd > step ? step / dd : 1;
    const mx = dx * k;
    const my = dy * k;
    off.x += mx;
    off.y += my;
    sk.prev.x += mx; // 손가락 빠르기(휘두르기 판정)에는 넣지 않는다
    sk.prev.y += my;
    sk.guardDrive = Math.hypot(mx, my) / dt; // 검술 층: 휘두르기 문턱보다 빠르면 AI 막기처럼 휘두르기 꼴의 거르기·몸 따라가기 (skill.js)
    sk.recovering = false;
    sk.cutPending = false;
    // 동방 버티는 힘 (10/17 연구 — SKILL.cnBraceK, 판 값 0): 동방 막기 책을 쥔 몸이 막는 중(mode 'defend')이면 서보 힘 × (1 + cnBraceK).
    //  기다림(idle)엔 안 줌 · 막기가 끝나거나 단추를 놓으면 아래 boost 되돌림 길로 1
    const brace = this.mode === 'defend' && SKILL.cnBraceK > 0 && this.chineseBook() ? SKILL.cnBraceK : 0;
    if (brace > 0) {
      me.powerMul = 1 + brace;
      this.boost = true;
    } else if (this.boost) (me.powerMul = 1), (this.boost = false);
    me.inputActive = true; // 손을 쥐고 있다 — 쉼 무게·되돌아옴·끝점 붙잡음은 손가락이 움직일 때처럼 비킨다 (main.js 가 프레임마다 다시 정함)
    this.opposition.endGuardStep();
    return true;
  }

  /** 동방 막기 책을 쥔 몸인가 (무기 유파 chinese · 책 해제면 아님) — 막기 단추 손 빠르기 배율 SKILL.cnParrySpeedK · 버티는 힘 cnBraceK · 피해 감소 cnParryDmgCut 를 받는다 */
  chineseBook() {
    const me = this.me;
    return me.swordArt?.tradition === 'chinese' && me.schoolParry !== false;
  }

  /**
   * 동방 막는 동안 피해 감소 (10/17 연구 — SKILL.cnParryDmgCut, 판 값 0 = 끔 · docs/strike/chinese_parry_brace_2026-10-17.md): 지금 받는 칼날 상처 심각도에 곱할 몫.
   *  막는 중 = 이번 물리 스텝의 step() 이 손을 쥐고(can) 막는 줄(defLine)을 세운 때(mode 'defend' — 새 공격을 읽은 때부터 '공격이 지나갔다' 또는 막기 시간 0.65 s 까지, 이미 있는 값).
   *  상처는 그 스텝 물리 뒤(combat.afterStep → analyze)에 판정되므로 그 스텝의 mode 를 읽는다. 기다림(idle) · 단추 놓음 · 다른 유파 · 책 없음 = 1. combat.js analyze 가 부른다
   */
  woundKeep() {
    const press = this.opposition?.keep?.() ?? 1; // 이탈리아 막아찌르기: 누른 때부터 0.6 s 칼날 상처 × 0.5 (10/21 — 막는 중이 아니어도)
    if (this.mode !== 'defend') return press;
    const me = this.me;
    if (me.schoolParry === false) return 1;
    if (kitOff(me, 'parryCut')) return press; // 스킬트리(10/21): 막는 동안 피해 감소는 일본 J2 · 이베리아 B9 · 동방 C8
    // 유파별 몫: 동방 cnParryDmgCut 0.5(10/17) · 일본 jpParryDmgCut · 이베리아 ibParryDmgCut 0.2(사장님 10/18 22:1x) — 다른 유파 · 책 해제 = 1
    const cut = { chinese: SKILL.cnParryDmgCut, japanese: SKILL.jpParryDmgCut, iberian: SKILL.ibParryDmgCut }[me.swordArt?.tradition] ?? 0;
    return (cut > 0 ? 1 - cut : 1) * press;
  }
}
