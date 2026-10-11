// ─────────────────────────────────────────────────────────────
//  플레이어 막기 버튼 (10/11 — 사장님 20:3x '막기 버튼을 따로 뺄까? 그거 누르고 있으면 자동으로 막기 자세를 취한다거나' · 22:0x 승인,
//   기록 docs/strike/player_parry_button_2026-10-11.md)
//
//  누르고 있는 동안(main.js — 폰 오른쪽 아래 '막기' 단추 · PC 키 F) AI 막기(ai.js respond → defend)와 같은 판단으로 손(칼)을 유파 막기 자리로 옮긴다:
//   · 들어오는 칼 읽기 = AI 와 같은 함수 secret.js threatNow (ai.js threat 와 같은 셈) — AI 처럼 반응 지연(AI_LEVELS.normal.reaction)만큼 늦은 모습으로 본다.
//     한 공격(위협 번호 — 0.25 s 조용했다가 다시 오면 새 공격, ai.js threat 와 같은 규칙)에 한 번 줄을 정한다(ai.js respond).
//   · 막기 자리 = 내 꾸러미 school.parry[줄] (없으면 pose.point — ai.js defend 그대로). 중국은 그 줄의 몸꼴 덧씌우기(parryCover — frames.js installCover, AI 와 같은 함수).
//   · 손 빠르기 = AI 막기 빠르기 L.parrySpeed (L = AI_LEVELS.normal — 플레이어 비기 손 빠르기 바탕과 같은 난이도, skill.js updateSecret). 손 목표를 그 빠르기로 옮긴다
//     (ai.js moveHand 와 같은 꼴 — 순간이동 없음). 막혔는지는 물리.
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
import { AI_LEVELS } from './config.js';
import { Senses } from './ai_sense.js';
import { threatNow } from './secret.js';
import { TRADITIONS } from './schools.js';
import { GUARD_BASE } from './guards.js';
import { installCover } from './frames.js';
import { AI } from './ai.js';

const _r = new THREE.Vector3();
const LINES = ['highL', 'highR', 'highC', 'lowL', 'lowR', 'thrust'];

export class PlayerParryGuard {
  constructor(me, foe) {
    this.me = me;
    this.foe = foe;
    this.L = AI_LEVELS.normal;
    this.sense = new Senses(me, foe);
    this.held = false; // 버튼·키를 누르고 있나 (main.js)
    this.broken = false; // 누른 채 공격 → 그 공격이 끝날 때까지 놓음 (main.js 가 켠다)
    this.active = false; // 이번 스텝 손을 쥐었나
    // installCover 가 읽는 AI 꼴 (mode 'defend' · defVoid · defLine)
    this.mode = 'idle';
    this.defVoid = false;
    this.defLine = null;
    this.timer = 0;
    this.noThreat = Infinity;
    this.threatId = 0;
    this.threatSeen = -1;
    this.line = null; // 지금 손이 가는 자리의 줄 (defLine 또는 기다림의 coverFor 줄 · 'point')
    this.stats = { heldT: 0, threats: 0, lines: {}, waitT: 0 };
    const pc = TRADITIONS[me.swordArt?.tradition]?.parryCover;
    if (pc) {
      const { down, ...covers } = pc; // 쓰러져 머리 가리기(down)는 AI 몫 — 플레이어 몸엔 막기 줄만
      if (Object.keys(covers).length) installCover(me, this, covers);
    }
  }

  get school() {
    return this.me.swordArt?.school ?? null;
  }

  /** 줄 → 그 자리 패드 */
  padOf(line) {
    const S = this.school;
    if (!S) return null;
    if (line === 'point') return S.pose.point;
    return S.parry[line] || S.pose.point;
  }

  /** 지금 잡은 막기 자세 이름 { name, desc } — 중국 덧씌우기 자리는 그 이름(거정세·어거세·요략세), 아니면 그 패드에서 가장 가까운 내 자세표 자리의 이름 (표두세·황소…) */
  nameOf(line) {
    const me = this.me;
    const tr = me.swordArt?.tradition;
    const slot = line && line !== 'point' ? TRADITIONS[tr]?.parryCover?.[line] : null;
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
    this.sense.record(dt);
    sk.guardDrive = 0;
    const can = this.held && !this.broken && me.alive && me.armed && !me.weapon?.gun && !sk.sec && !sk.tap && !sk.pom && (me.state === 'stand' || me.state === 'kneel') && !!this.school;
    // 위협 읽기 (누르지 않아도 센다 — 누르는 순간 이미 오는 칼을 읽게. 번호는 ai.js threat 와 같은 규칙)
    const L = this.L;
    const s = this.sense.seen(L.reaction);
    const c = me.bodies.chest.translation();
    const d = Math.max(0.01, Math.hypot(s.cx - c.x, s.cz - c.z));
    const foeReach = (me.swordArt?.measureFor?.(this.foe.weapon)?.reach ?? 1) + 0.05; // ai.js 생성자 foeReach 와 같은 셈 (PlayerSecretWatch.view 와 같음)
    const th = this.foe.alive ? threatNow(this.sense, this.foe, s, c, me.right(_r), d, foeReach, L.reaction) : null;
    if (th) {
      if (this.noThreat > 0.25) this.threatId++;
      this.noThreat = 0;
    } else this.noThreat += dt;
    if (!can) {
      if (this.active && !this.broken) sk.cutPending = true; // 놓으면 검술 층의 '자세로 돌아가기'(쉴 자세)로 — 휘두르고 난 뒤와 같은 길
      this.active = false;
      this.mode = 'idle';
      this.defLine = null;
      this.line = null;
      return false;
    }
    this.active = true;
    this.stats.heldT += dt;
    // 한 공격에 한 번 줄을 정한다 (ai.js respond — 굴림 없음)
    if (th && this.threatId !== this.threatSeen) {
      this.threatSeen = this.threatId;
      this.defLine = th.line;
      this.timer = 0.65;
      this.stats.threats++;
      this.stats.lines[th.line] = (this.stats.lines[th.line] ?? 0) + 1;
    }
    if (this.defLine) {
      // ai.js defend 의 끝: 공격이 지나갔다 (칼끝이 더는 오지 않고 손이 멈췄다) · 막기 시간이 다 됐다
      this.timer -= dt;
      const swingOver = this.noThreat > 0.12 && Math.hypot(s.hvx, s.hvy) < 2.5;
      if ((swingOver && this.timer < 0.35) || this.timer <= 0) this.defLine = null;
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
      this.line = LINES.find((k) => this.school.parry[k] === p) ?? 'point';
    }
    // 손 목표를 막기 빠르기로 (ai.js moveHand 와 같은 꼴)
    const off = me.handOffset;
    const dx = p[0] - off.x;
    const dy = p[1] - off.y;
    const dd = Math.hypot(dx, dy);
    const step = L.parrySpeed * dt;
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
    me.inputActive = true; // 손을 쥐고 있다 — 쉼 무게·되돌아옴·끝점 붙잡음은 손가락이 움직일 때처럼 비킨다 (main.js 가 프레임마다 다시 정함)
    return true;
  }

}
