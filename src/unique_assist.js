// ─────────────────────────────────────────────────────────────
//  플레이어 고유 동작 이어 주기 (10/13 — docs/strike/unique_player_2026-10-13.md)
//
//  사장님 승인: "플레이어가 긋는 동작이 고유 동작의 시작 자리·방향과 맞으면 그 고유 동작의 궤적으로 이어 준다."
//  지향점: "고유 동작으로 기본 동작이 대체될 때 이질감이 느껴지기보다는 자연스러운 '향상'이라고 느끼면 좋겠네."
//
//  유파 고유 동작(schools.js *_UNIQUE)은 지금껏 AI 만 썼다(sword_art.js mergeUnique · ai.js uniqueByName). 플레이어 칼은 손가락을 따라가서 꺼낼 길이 없었다.
//  여기서는 플레이어 긋기가 시작되는 순간(손 목표가 휘두르기 문턱 SKILL.swingSpeed 를 넘는 스텝 — 검술 층 skill.js 가 쓰는 같은 사건)에
//   ① 시작 자리(가장 가까운 자세 패드 G.*)와 처음 방향(손 속도 방향)으로 기본 12 동작(ai_techniques.js TECH) 가운데 어느 긋기인지 고르고,
//   ② 해금된 고유 동작 가운데 그 긋기(또는 아래 표의 조건)를 '향상'하는 것이 있으면,
//   ③ 손 목표(handOffset — 서보 목표)를 그 고유 동작 길(path · 속임수면 feint.then)로 옮긴다. 비기 길 따라가기(skill.js secretMove)·AI 칼질(ai.js moveHand)과 같은
//      '제한 빠르기로 길 점 쫓기'다 — 칼을 순간이동시키지 않는다. 실제 움직임은 근육·물리가 만든다.
//  자연스러운 '향상'이 되도록:
//   · 길에 들어가는 자리 = 지금 손. 손과 길의 어긋남은 남은 길의 앞 몫(UNIQUE_ASSIST.blend)에 걸쳐 0 으로 — 앞부분은 플레이어가 그은 방향 그대로이고
//     (이어 들어갈 길 토막은 지금 손에서 본 첫 방향이 손가락 방향과 허용 각 안인 것만 고른다) 걸음·두 번째 칼·끝 자세 같은 나아짐은 뒷부분에서 나온다.
//   · 빠르기 = 이 긋기에서 잰 손가락 빠르기(느리게 끌지 않는다 — 더 빨리 그으면 따라 빨라진다).
//   · 손을 떼거나(터치) 멈추면(마우스) · 처음과 반대로 크게 그으면 곧장 놓아 준다(자유 조작). 두 번 잇는 동작의 뒷부분은 손가락이 계속 긋고 있을 때만.
//   · 비기·막기 버튼·탭 찌르기·손잡이 찍기·마무리 찍기·약한 자세 간격 맞추기가 돌고 있으면 발동하지 않고, 이어 주는 중에 그것들이 시작되면 곧장 물러난다.
//  걸음 칸(step)이 있는 동작은 AI 기술 걸음(ai.js techStepRequest)과 같은 꼴로 다리에 걸음을 부탁한다. 발동하면 기술 이름 알림(main.js showTechCue 'unique' — AI 고유 동작 알림과 같은 칸).
//  AI 쪽은 아래 표의 단계만 읽는다(aiUniqueStages — 숙련도 거르기 10/13, sword_art.js applySchoolArt · ai.js). 이어 주기는 플레이어 몫. 검술 층은 skill.uniq 가 있을 때만(플레이어 — main.js 가 붙임) 부른다.
//  수는 config.js UNIQUE_ASSIST (확인표 1040~1047, 사장님 확인 전). 끄기 `?uniqueAssist=0`.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { UNIQUE_ASSIST as UA, SKILL } from './config.js';
import { G, TECH, TECH_BY_NAME } from './ai_techniques.js';
import { TRADITIONS } from './schools.js';
import { segDist } from './skill.js';

// ── 고유 동작 표 (디렉터 안 → 사장님 확정 10/13 22:3x. 바뀌면 여기 한 곳만 고친다) ──
//  유파마다 넷 = 발 기술 1 · 공유 2 · 대표 1. stage = 그 동작이 열리는 성장 단계(1~4). name = schools.js 그 유파 unique 의 이름(path 가 있으면 그 이름의 길을 빌림).
//  on = 여는 조건 목록(하나라도 맞으면):
//   { tech }        이 긋기가 그 기본 동작(시작 패드 + 첫 방향)
//   { pad, dir }    시작 패드 + 방향('up' | 'down' | 'horiz')
//   { prev, when, dir? } 앞 긋기 뒤: prev = 'cut' | 'thrust' | 기본 동작 이름 · when = 'bound'(앞 긋기가 칼에 맞물림·막힘) | 'miss'(못 맞힘 — 막힘 포함) |
//                   'any'(맞든 빗나가든) — 셋 다 앞 긋기가 끝나고 afterWindow 안 · 'turn'(앞 찌르기가 시작되고 turnWindow 안에 방향을 허용 각 넘게 꺾음)
//  far = 조건으로 여는 동작이지만 길과의 거리(joinMax)를 보지 않는다(겹치기: 맞물린 자리가 길에서 멀어도 다음 긋기 방향만 맞으면 — 어긋남은 blend 로 줄어든다)
//  anchor 'start' = 고유 동작 길이 기본 긋기보다 짧아 손이 곧 지나쳐 버리는 것(코테·좌익격 — 끝 자리가 긴 자세 바로 밑): 길 토막을 긋기 시작 자리에 옮겨 놓고 그 위에서 잇는다
//  chain = 두 번 잇는 동작: at = 뒷부분이 시작되는 길 점 번호(점 목록 = [from, ...path] 또는 [가짜 자리, ...then]) · dir = 그 자리에서 손가락이 그쪽으로 그어야 이음
//  탭 찌르기도 '내 찌르기'로 센다(prev 'thrust' — 맞물림·any). 이베리아 rodaCounter(길 없는 맞받아치기 목록)는 플레이어 표에서 뺀다(AI 데이터는 그대로)
export const PLAYER_UNIQUE = {
  german: [
    { stage: 1, name: 'zwerchAbtritt', on: [{ tech: 'zwerch' }] }, // 비껴 딛는 가로베기 ← 가로베기
    { stage: 2, name: 'krumphau', on: [{ tech: 'zornhau' }] }, // 굽은 베기 ← 분노의 베기
    { stage: 3, name: 'duplieren', far: true, on: [{ prev: 'cut', when: 'bound' }], chain: { at: 1 } }, // 겹치기 ← 내 베기가 맞물린 뒤 다음 긋기 (맞물린 자리가 어디든 — 칼자루를 들어 다시 머리로)
    { stage: 4, name: 'schielhau', on: [{ tech: 'stichOchs' }] }, // 곁눈 베기 ← 황소 찌르기
  ],
  italian: [
    { stage: 1, name: 'inquartata', on: [{ tech: 'stichPflugL' }] }, // 비껴서며 찌르기 ← 왼 쟁기 찌르기
    { stage: 2, name: 'imbroccata', on: [{ tech: 'stichOchs' }] }, // 위에서 내려 찌르기 ← 황소 찌르기
    { stage: 3, name: 'cavazione', nameKo: '칼끝 돌려 빼기 (cavazione)', on: [{ prev: 'thrust', when: 'bound' }, { prev: 'thrust', when: 'turn' }] }, // 칼끝 돌려 빼기(속임 then 길) ← 내 찌르기가 맞물림 · 찌르다 꺾음
    { stage: 4, name: 'passataSotto', on: [{ tech: 'stichPflug' }] }, // 밑으로 들어가 찌르기 ← 쟁기 찌르기 (런지 자세는 이탈리아 비기 몫 — 붙이지 않음)
  ],
  iberian: [
    { stage: 1, name: 'talhoRodeado', on: [{ tech: 'zornhau' }] }, // 둥근 걸음 탈류 ← 분노의 베기
    { stage: 2, name: 'altibaixo', on: [{ tech: 'oberhau' }], chain: { at: 2, dir: 'up' } }, // 위아래 사슬 ← 정수리 베기 (내려벤 뒤 위로 이어 그으면 되올림)
    { stage: 3, name: 'redondo', on: [{ tech: 'zwerch' }], chain: { at: 3 } }, // 머리 위 돌려 베기 ← 가로베기
    { stage: 4, name: 'talhoRevezBaixo', on: [{ tech: 'unterhau' }], chain: { at: 2 } }, // 번갈아 올려베기 ← 올려베기
  ],
  japanese: [
    { stage: 1, name: 'hirakiGiri', on: [{ tech: 'zornhauL' }] }, // 히라키기리 ← 왼 분노의 베기
    { stage: 2, name: 'kote', anchor: 'start', on: [{ pad: 'langort', dir: 'down' }] }, // 코테 ← 가운데(긴 자세)에서 짧게 내려베기 (머리 위 시작 정수리 베기와는 시작 패드로 가름)
    { stage: 3, name: 'tsubameGaeshi', on: [{ prev: 'oberhau', when: 'miss', dir: 'up' }], chain: { at: 2 } }, // 츠바메가에시 ← 정수리 베기가 빗나가거나 막힌 뒤 위로 이어 그음
    { stage: 4, name: 'kokoRenda', on: [{ tech: 'zornhau' }], chain: { at: 2 } }, // 코코 연타 ← 분노의 베기
  ],
  chinese: [
    { stage: 1, name: 'chebuYaoji', on: [{ tech: 'zwerch' }] }, // 체보요격 ← 가로베기
    { stage: 2, name: 'zuoyi', anchor: 'start', on: [{ pad: 'langort', dir: 'down' }] }, // 좌익격 ← 코테와 같음
    { stage: 3, name: 'lianchi', on: [{ prev: 'stichPflug', when: 'turn' }] }, // 염시(속임 then 길) ← 쟁기 찌르기를 시작했다가 짧은 창 안에 거둠
    // 자→격 (刺→擊): 새 표 항목이지만 새 길은 없다 — yaoji 길(긴 자세 자리에서 시작하는 허리 베기). 출처는 schools.js ciji 패시브와 같은 「向前進步腰擊」
    { stage: 4, name: 'ciji', path: 'yaoji', nameKo: '자→격 (刺→擊)', on: [{ prev: 'thrust', when: 'any', dir: 'horiz' }] }, // ← 내 찌르기(맞든 빗나가든) 뒤 짧은 창 안의 가로 긋기
  ],
};

/**
 * AI 숙련도 거르기 (사장님 결정 10/13 22:4x '숙련도 수치에 따라 쓸지 말지' — docs/strike/ai_proficiency_2026-10-13.md): 위 표를 AI 쪽에서 읽는 자리.
 *  유파 tradition 의 { unique: 고유 동작 이름 → 단계, passive: 패시브 이름 → 단계 }. AI 는 단계 ≤ 숙련도인 것만 쓴다(sword_art.js applySchoolArt · ai.js).
 *  표 이름이 그 유파 unique 의 이름이면 그 동작. path 로 길을 빌린 항목(동방 자→격 ciji → yaoji)은 AI 쪽에서 빌린 길(단독 동작 yaoji)과
 *  같은 이름의 패시브(schools.js ciji 고리 — yaoji 이음) 둘 다. 표에 없는 것(이베리아 rodaCounter 맞받아치기 목록, 그 밖의 패시브)은 거르지 않는다
 */
export function aiUniqueStages(tradition) {
  const unique = new Map();
  const passive = new Map();
  for (const e of PLAYER_UNIQUE[tradition] ?? []) {
    unique.set(e.path ?? e.name, e.stage);
    if (e.path) passive.set(e.name, e.stage);
  }
  return { unique, passive };
}

const D2R = Math.PI / 180;
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const hyp = (x, y) => Math.hypot(x, y);
/** 두 2D 방향 사이 각(°) */
function angDeg(a, b) {
  const na = hyp(a[0], a[1]);
  const nb = hyp(b[0], b[1]);
  if (na < 1e-9 || nb < 1e-9) return 180;
  return Math.acos(THREE.MathUtils.clamp((a[0] * b[0] + a[1] * b[1]) / (na * nb), -1, 1)) / D2R;
}
/** 방향 조건 'up' | 'down' | 'horiz' */
function dirOk(d, want) {
  if (want === 'up') return angDeg(d, [0, 1]) <= UA.angle;
  if (want === 'down') return angDeg(d, [0, -1]) <= UA.angle;
  if (want === 'horiz') return Math.min(angDeg(d, [1, 0]), angDeg(d, [-1, 0])) <= UA.angle;
  return true;
}
/** 토막 AB 에서 p 에 가장 가까운 점 */
function closest(A, B, p) {
  const ex = B[0] - A[0];
  const ey = B[1] - A[1];
  const L2 = ex * ex + ey * ey;
  const t = L2 > 1e-12 ? THREE.MathUtils.clamp(((p[0] - A[0]) * ex + (p[1] - A[1]) * ey) / L2, 0, 1) : 0;
  return [A[0] + ex * t, A[1] + ey * t];
}

/** 표 항목의 고유 동작 (schools.js 그 유파 unique 에서): 이름 · 알림 이름 · 칼 종류 · 길 점 · 걸음. 없으면 null */
export function uniqueDef(tradition, e) {
  const list = TRADITIONS[tradition]?.unique ?? [];
  const key = e.path ?? e.name;
  const u = list.find((x) => x.name === key);
  if (!u) return null;
  if (u.feint) {
    const fk = TECH_BY_NAME[u.feint.fake];
    if (!fk) return null;
    const a = u.feint.at;
    const p0 = [fk.from[0] + (fk.path[0][0] - fk.from[0]) * a, fk.from[1] + (fk.path[0][1] - fk.from[1]) * a]; // 가짜 기술을 at 만큼 간 자리 (ai.js startStrike 와 같은 점)
    return { name: e.name, nameKo: e.nameKo ?? u.nameKo ?? u.feint.name, kind: u.feint.open === 'C' ? 'thrust' : 'cut', pts: [p0, ...u.feint.then.map((p) => p.slice())], step: null };
  }
  if (!u.path?.length) return null; // 길 없는 것(맞받아치기 목록 등)은 플레이어 몫이 아니다
  return { name: e.name, nameKo: e.nameKo ?? u.nameKo ?? u.name, kind: u.kind, pts: [u.from.slice(), ...u.path.map((p) => p.slice())], step: u.step ?? null };
}

// ── 해금 (사장님 결정 10/13 22:3x — 주인공 하나 기준) ──
//  여정(foe=stage)에서 무대를 깰 때마다 깬 수 +1 (localStorage — 읽기·쓰기 실패해도 0 으로 그냥 동작). UNIQUE_ASSIST.sealEvery 번마다 인장 하나를
//  sealOrder 유파 차례로 돌아가며 준다(sealMax 개에서 끝). 유파 숙련도 = 그 유파 인장 수(0~5) = 그 유파 무기를 들었을 때 열리는 고유 동작 단계.
//  5 단계(UNIQUE_ASSIST.secretStage) = 그 유파 비기 (사장님 결정 10/13 23:1x — 21~25 번째 인장. 그 전엔 플레이어 비기 창이 안 열린다: main.js PlayerSecretWatch locked).
//  인장 이름(단계별 — 사장님 결정 10/13 23:1x 1 견습생 · 2 숙련자 · 3 전문가 · 4 마스터 · 5 신: 여기 한 곳). 유파 이름은 TRADITIONS[유파].nameKo 를 그때 읽는다(글자를 박지 않는다)
export const SEAL_NAMES = ['견습생', '숙련자', '전문가', '마스터', '신'];
const CLEAR_KEY = 'stillness.journeyClears.v1';
let clearsOverride = null; // 시험용 `?clears=N` (main.js setClearsOverride): 있으면 저장소 대신 이 값을 쓰고 깬 수도 여기에만 더한다
export function setClearsOverride(n) {
  const v = n == null || n === '' ? NaN : Number(n);
  clearsOverride = Number.isInteger(v) && v >= 0 ? v : null;
  return clearsOverride;
}
/** 지금까지 깬 무대 수 */
export function journeyClears() {
  if (clearsOverride != null) return clearsOverride;
  try {
    const n = Number(localStorage.getItem(CLEAR_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}
/** 무대를 하나 깸 (main.js — 여정에서 이겨 다음 무대로 넘어가는 판): 깬 수 +1. { clears, seal } — seal = 이번에 얻은 인장 { k, school, stage } (없으면 null) */
export function addJourneyClear() {
  const before = journeyClears();
  const clears = before + 1;
  if (clearsOverride != null) clearsOverride = clears;
  else {
    try {
      localStorage.setItem(CLEAR_KEY, String(clears));
    } catch {
      /* 저장 못 해도 이번 판은 그대로 */
    }
  }
  const k = sealCount(clears);
  return { clears, seal: k > sealCount(before) ? sealAt(k) : null };
}
/** 깬 수 → 받은 인장 수 (sealMax 에서 멈춤) */
export function sealCount(clears) {
  return Math.min(UA.sealMax, Math.floor(Math.max(0, clears) / UA.sealEvery));
}
/** 인장 k(1부터): { k, school: sealOrder[(k−1) mod 5], stage: ⌊(k−1)/5⌋+1 } */
export function sealAt(k) {
  const O = UA.sealOrder;
  return { k, school: O[(k - 1) % O.length], stage: Math.floor((k - 1) / O.length) + 1 };
}
/** 유파별 숙련도 (그 유파 인장 수 0~5) */
export function masteryOf(clears) {
  const m = Object.fromEntries(UA.sealOrder.map((s) => [s, 0]));
  for (let k = 1; k <= sealCount(clears); k++) m[sealAt(k).school]++;
  return m;
}
/** 이번 판의 해금 단계 (손에 든 무기 유파): 주소 ?uniqueStage=0..5(모든 유파) > 테스트 경로(testStage) > 그 유파 숙련도. 5 = 비기까지 (secretStage) */
export function uniqueStageFor(tradition, { test = false, param = null, clears = journeyClears() } = {}) {
  const p = param == null || param === '' ? NaN : Number(param);
  if (Number.isInteger(p) && p >= 0 && p <= UA.secretStage) return { stage: p, source: 'url' };
  if (test) return { stage: UA.testStage, source: 'test' };
  return { stage: masteryOf(clears)[tradition] ?? 0, source: 'seals' };
}
/** 인장 알림 한 줄 (사장님 결정 10/13 23:1x '독일 유파 신 이렇게'): 「독일 유파 견습생」 인장 — 비껴 딛는 가로베기 열림 · 「동방 유파 신」 인장 — 비기 연환삼격 열림
 *  (유파 이름은 TRADITIONS 에서 · 동작·비기 이름은 괄호 앞) */
export function sealNotice(seal) {
  if (!seal) return '';
  const school = TRADITIONS[seal.school]?.nameKo ?? seal.school;
  const e = (PLAYER_UNIQUE[seal.school] ?? []).find((x) => x.stage === seal.stage);
  const U = e ? uniqueDef(seal.school, e) : null;
  const short = (t) => String(t).replace(/\s*[(·].*$/, '');
  const secret = seal.stage >= UA.secretStage ? TRADITIONS[seal.school]?.secret : null;
  const move = U ? short(U.nameKo) : secret?.nameKo ? `비기 ${short(secret.nameKo)}` : '';
  return `「${school} 유파 ${SEAL_NAMES[seal.stage - 1] ?? ''}」 인장${move ? ` — ${move} 열림` : ''}`;
}

/**
 * 플레이어 한 명의 고유 동작 이어 주기. 붙이면(f.skill.uniq = this) 검술 층이 매 스텝 drive(머리 — 이어 주는 중이면 손 목표를 길로) ·
 *  detect(휘두르기 판단 뒤 — 긋기 읽기·발동)를 부른다. main.js 는 프레임마다 feed(손가락 움직임)를 부르고, 이어 주는 동안(running)은 손가락을 손 목표에 더하지 않는다.
 *  열린 동작이 없으면(단계 0 · 표에 없는 유파 · 스위치 끔) 붙지 않는다 → 검술 층은 전과 같다
 */
export class PlayerUniqueAssist {
  constructor(f, { stage = 0, tradition = f.swordArt?.tradition } = {}) {
    this.f = f;
    this.stage = stage;
    this.tradition = tradition;
    this.list = UA.on && !f.weapon?.gun ? (PLAYER_UNIQUE[tradition] ?? []).filter((e) => e.stage <= stage).map((e) => ({ ...e, U: uniqueDef(tradition, e) })).filter((e) => e.U) : [];
    this.r = null; // 이어 주는 중인 것
    this.t = 0;
    this.cur = null; // 지금 긋기 { tech, kind, pad, t0, dir, landed, bound, tEnd, unique }
    this.last = null; // 바로 앞 긋기 (끝난 것 — 결과는 다음 긋기가 시작될 때까지 계속 적는다)
    this.tapRec = null; // 진행 중인 탭 찌르기 (끝나면 last 로)
    this.wasSwing = false;
    this.quietT = 1;
    this.restPos = [f.handOffset.x, f.handOffset.y];
    this.needRest = false; // 이어 주기가 끝난 뒤엔 한 번 쉬어야(휘두르기가 끊겨야) 다음 긋기를 읽는다 — 끝 자리에서 곧장 다른 동작으로 번지지 않게
    this.blocked = false; // main.js: 막기 버튼·미리 받기가 손을 쥐는 중
    this.painFoe = null;
    this.fv = new THREE.Vector2(); // 손가락 속도 (고른 값, 패드 m/s)
    this.fSpeed = 0;
    this.fIdle = 0;
    this.fPeak = 0;
    this.stats = { strokes: 0, techs: {}, fired: {}, ends: {} };
    this.turnable = this.list.some((e) => e.on.some((c) => c.when === 'turn'));
    f.uniqueCue = null;
    f.skill.uniq = this.list.length ? this : null;
  }

  get running() {
    return !!this.r;
  }

  /** 프레임마다 (main.js): 이번 프레임 손가락 움직임(패드 m)·프레임 시간·손을 쥔 다른 동작이 있나 */
  feed(dx, dy, dt, blocked = false) {
    this.blocked = blocked;
    if (!(dt > 0)) return;
    const k = 1 - Math.exp(-dt / UA.fingerTau);
    this.fv.x += (dx / dt - this.fv.x) * k;
    this.fv.y += (dy / dt - this.fv.y) * k;
    this.fSpeed = this.fv.length();
    this.fIdle = Math.abs(dx) + Math.abs(dy) > 1e-5 ? 0 : this.fIdle + dt;
    this.fPeak = Math.max(this.fPeak, this.fSpeed);
  }

  /** 발동하지 않는 때: 다른 플레이어 동작이 돌거나 칼을 못 쓰는 때 */
  busy() {
    const f = this.f;
    const sk = f.skill;
    return this.blocked || !UA.on || !!sk.sec || !!sk.tap || !!sk.pom || !!sk.vitalRange || !f.alive || !f.armed || f.weaponBroken || f.state !== 'stand' || !f.foe || f.finish?.amt > 0.5;
  }

  /** 긋기 결과 적기: 맞힘(상대 아픔 +0.05 — 비기와 같은 눈) · 칼 맞물림(ai.js checkBind 와 같은 기하 0.07 m). 탭 찌르기도 한 긋기로 센다 */
  track() {
    const f = this.f;
    const sk = f.skill;
    if (sk.tap && !this.tapRec) this.tapRec = { tech: 'tap', kind: 'thrust', tap: true, t0: this.t, dir: [0, 0], landed: false, bound: false, tEnd: null };
    if (!sk.tap && this.tapRec) {
      this.tapRec.tEnd = this.t;
      this.last = this.tapRec;
      this.tapRec = null;
    }
    const foe = f.foe;
    if (!foe) return;
    const rec = this.tapRec ?? this.cur ?? this.last;
    if (this.painFoe != null && rec && foe.pain > this.painFoe + 0.05) rec.landed = true;
    this.painFoe = foe.pain;
    if (rec && !rec.bound && foe.armed && f.tipPrev && foe.tipPrev && segDist(f.bladePoint(0.1, _a), f.tipPrev, foe.bladePoint(0.1, _b), foe.tipPrev) < 0.07) rec.bound = true;
  }

  closeStroke(tEnd) {
    this.cur.tEnd = tEnd;
    this.last = this.cur;
    this.cur = null;
  }

  /** 시작 자리·처음 방향 → 기본 동작 (시작 패드가 그 동작의 from 이고 첫 방향이 허용 각 안). { pad, tech, kind } */
  classify(start, dir) {
    let pad = null;
    let pd = UA.padRadius;
    for (const [name, p] of Object.entries(G)) {
      if (name === 'kron') continue; // 왕관은 막기 자리 (긋기 시작 자세 아님)
      const d = hyp(start[0] - p[0], start[1] - p[1]);
      if (d <= pd) {
        pd = d;
        pad = name;
      }
    }
    if (!pad) return { pad: null, tech: null, kind: 'cut' };
    const t = TECH.find((x) => x.from === G[pad]);
    if (t && angDeg(dir, [t.path[0][0] - t.from[0], t.path[0][1] - t.from[1]]) <= UA.angle) return { pad, tech: t.name, kind: t.kind };
    return { pad, tech: null, kind: 'cut' };
  }

  condOk(c, cur, dir, now) {
    if (c.tech && cur.tech !== c.tech) return false;
    if (c.pad && cur.pad !== c.pad) return false;
    if (c.dir && !dirOk(dir, c.dir)) return false;
    if (!c.prev) return true;
    const L = this.last;
    if (!L) return false;
    if (c.prev === 'cut' || c.prev === 'thrust' ? L.kind !== c.prev : L.tech !== c.prev) return false;
    if (c.when === 'turn') return !L.tap && now - L.t0 <= UA.turnWindow && angDeg(dir, L.dir) > UA.angle;
    if (L.tEnd == null || now - L.tEnd > UA.afterWindow) return false;
    if (c.when === 'bound') return L.bound;
    if (c.when === 'miss') return !L.landed;
    return true;
  }

  /**
   * 길에 들어갈 자리: 길 토막마다 지금 손에서 가장 가까운 점 J, 어긋남 o = 손 − J 를 남은 길의 blend 몫에 걸쳐 0 으로 줄인 목표 점들.
   *  지금 손에서 첫 목표 점으로 가는 방향이 손가락 방향과 허용 각 안인 토막만 — 그 가운데 어긋남이 가장 작은 것(같으면 앞 토막).
   *  maxO = 어긋남 상한(조건으로 여는 동작만). 없으면 null
   */
  join(pts0, hand, dir, maxO, start = null) {
    let best = null;
    for (let k = 0; k < pts0.length - 1; k++) {
      const pts = start ? pts0.map((p) => [p[0] + start[0] - pts0[k][0], p[1] + start[1] - pts0[k][1]]) : pts0; // anchor 'start': 이 토막의 시작을 긋기 시작 자리에
      const J = closest(pts[k], pts[k + 1], hand);
      const ox = hand[0] - J[0];
      const oy = hand[1] - J[1];
      const on = hyp(ox, oy);
      if (on > maxO) continue;
      const rest = [J, ...pts.slice(k + 1)];
      const cum = [0];
      for (let i = 1; i < rest.length; i++) cum.push(cum[i - 1] + hyp(rest[i][0] - rest[i - 1][0], rest[i][1] - rest[i - 1][1]));
      const total = cum[cum.length - 1];
      if (total < 1e-3) continue;
      const tg = [];
      for (let i = 1; i < rest.length; i++) {
        const s = cum[i] / (UA.blend * total);
        const w = s >= 1 ? 0 : 1 - s * s * (3 - 2 * s);
        tg.push([rest[i][0] + ox * w, rest[i][1] + oy * w]);
      }
      let first = 0;
      while (first < tg.length - 1 && hyp(tg[first][0] - hand[0], tg[first][1] - hand[1]) < 1e-3) first++;
      if (angDeg(dir, [tg[first][0] - hand[0], tg[first][1] - hand[1]]) > UA.angle) continue;
      if (!best || on < best.o - 1e-6) best = { k, o: on, tg };
    }
    return best;
  }

  /** 열린 동작 가운데 이 긋기에 맞는 것: 앞 긋기 조건(더 좁은 것)이 먼저, 그 안에선 길과의 어긋남이 작은 것 */
  choose(cur, hand, dir, now) {
    let best = null;
    for (const e of this.list) {
      if (!e.on.some((c) => this.condOk(c, cur, dir, now))) continue;
      const after = e.on.some((c) => c.prev);
      const j = this.join(e.U.pts, hand, dir, after && !e.far ? UA.joinMax : Infinity, e.anchor === 'start' ? cur.start : null);
      if (!j) continue;
      const rank = after ? 0 : 1;
      if (!best || rank < best.rank || (rank === best.rank && j.o < best.j.o - 1e-6)) best = { e, j, rank };
    }
    return best;
  }

  /** 기술 걸음 (ai.js techStepRequest 와 같은 꼴): 비껴 가는 쪽 발이 앞발이면 내딛고(lunge), 뒷발이면 앞발을 지나(pass). 받으면 true */
  askStep(st) {
    const f = this.f;
    const g = f.gait;
    if (!g?.requestStep || !g.active || f.state !== 'stand') return false;
    const front = g.frontLeg(f.forward(_v));
    const lead = Math.sign(g.legs[front].side) === Math.sign(st.lat);
    return g.requestStep({ kind: st.kind ?? (lead ? 'lunge' : 'pass'), fwd: st.fwd, side: st.lat, duration: st.dur ?? 0.35 });
  }

  /** 새 긋기로 보는 꺾임 각: 시작한 지 turnWindow 안의 찌르기는 허용 각(꺾음 — 카바치오네·염시), 그 밖엔 turnDeg */
  turnAt(now) {
    const c = this.cur;
    return c && c.kind === 'thrust' && now - c.t0 <= UA.turnWindow ? UA.angle : UA.turnDeg;
  }

  /** 매 스텝, 검술 층이 휘두르기를 판단한 뒤: 긋기 시작을 읽고 맞으면 이어 주기를 연다 */
  detect(dt, swinging) {
    this.t += dt;
    const now = this.t;
    this.track();
    const was = this.wasSwing;
    this.wasSwing = swinging;
    const f = this.f;
    const hand = [f.handOffset.x, f.handOffset.y];
    if (!swinging) {
      this.quietT += dt;
      if (this.cur && this.quietT >= UA.onsetQuiet) this.closeStroke(now - this.quietT);
      if (!this.r && this.fSpeed < SKILL.swingSpeed) this.restPos = hand; // 시작 자리 = 손가락이 빨라지기 직전 자리 (검술 층 휘두르기 판단은 손 목표 속도를 고르느라 한두 프레임 늦다)
      this.needRest = false;
      return;
    }
    this.quietT = 0;
    if (this.r || this.needRest) return;
    const v = f.skill.vel;
    const sp = hyp(v.x, v.y);
    const dir = [v.x / sp, v.y / sp];
    let start = null;
    const turnAt = this.turnAt(now);
    if (!was) start = this.cur && angDeg(dir, this.cur.dir) <= turnAt ? null : this.restPos; // 짧은 끊김에 같은 쪽이면 같은 긋기
    else if (!this.cur) start = hand;
    else if (angDeg(dir, this.cur.dir) > turnAt) start = hand; // 휘두르는 채로 꺾음 = 새 긋기 (꺾인 자리에서)
    if (!start) return;
    if (this.cur) this.closeStroke(now);
    const c = this.classify(start, dir);
    const cur = (this.cur = { tech: c.tech, kind: c.kind, pad: c.pad, t0: now, dir, start, landed: false, bound: false, tEnd: null, unique: null });
    this.stats.strokes++;
    this.stats.techs[c.tech ?? '-'] = (this.stats.techs[c.tech ?? '-'] ?? 0) + 1;
    this.fPeak = Math.max(this.fSpeed, sp);
    if (this.busy()) return;
    const pick = this.choose(cur, hand, dir, now);
    if (pick) this.start(pick, cur);
  }

  start(pick, cur) {
    const f = this.f;
    const { e, j } = pick;
    const ch = e.chain && j.k < e.chain.at ? e.chain.at - j.k - 1 : -1; // 목표 점 번호: 이 점에 닿으면 뒷부분을 이을지 본다
    this.r = { e, U: e.U, tg: j.tg, i: 0, gateAt: ch, v: Math.max(UA.vMin, this.fPeak * UA.speedK), t: 0, held: !!f.handHeld, dir0: cur.dir, stepAsked: false };
    cur.kind = e.U.kind;
    cur.unique = e.U.name;
    this.stats.fired[e.U.name] = (this.stats.fired[e.U.name] ?? 0) + 1;
    f.uniqueCue = { text: e.U.nameKo, kind: 'unique', who: 'me', schoolKo: TRADITIONS[this.tradition]?.nameKo ?? '', name: e.U.name, t: this.t };
    if (e.U.step) this.r.stepAsked = this.askStep(e.U.step);
    f.skill.cutPending = true;
    f.skill.recovering = false;
  }

  /** 매 스텝, 검술 층 머리 (비기 updateSecret 자리 옆): 이어 주는 중이면 손 목표를 다음 길 점으로 */
  drive(dt) {
    const R = this.r;
    if (!R) return;
    const f = this.f;
    R.t += dt;
    if (this.busy()) return this.end('yield');
    if (R.held ? !f.handHeld : this.fIdle > UA.idleRelease) return this.end('lift'); // 손을 뗌 (마우스는 멈춤)
    const off = f.handOffset;
    const T0 = R.tg[R.i];
    const fd = [this.fv.x, this.fv.y];
    // 반대로 크게 그음: 손가락이 처음 방향과 oppositeDeg 넘게 반대로, 휘두르기 빠르기 넘게 — 길도 그쪽으로 가는 중이 아닐 때 (되올림 같은 길의 꺾임을 따라 그은 것은 놓지 않는다)
    const toChain = R.gateAt >= R.i && R.e.chain?.dir && dirOk(fd, R.e.chain.dir); // 뒷부분 쪽으로 미리 꺾는 손가락은 반대로 그은 것이 아니다
    if (!toChain && this.fSpeed > SKILL.swingSpeed && angDeg(fd, R.dir0) > UA.oppositeDeg && angDeg(fd, [T0[0] - off.x, T0[1] - off.y]) > 90) return this.end('opposite');
    // 찌르다 꺾음 (카바치오네·염시 같은 'turn' 조건): 이어 주던 찌르기가 시작되고 turnWindow 안에 손가락이 허용 각 넘게 꺾였고 그 조건의 동작이 맞으면 그리로 옮긴다
    if (this.turnable && this.cur?.kind === 'thrust' && this.t - this.cur.t0 <= UA.turnWindow && this.fSpeed > SKILL.swingSpeed && angDeg(fd, R.dir0) > UA.angle) {
      const now = this.t;
      const hand = [off.x, off.y];
      const d = [fd[0] / this.fSpeed, fd[1] / this.fSpeed];
      const prevCur = this.cur;
      const prevLast = this.last;
      this.closeStroke(now);
      const nc = { tech: null, kind: 'cut', pad: null, t0: now, dir: d, start: hand, landed: false, bound: false, tEnd: null, unique: null };
      const pick = this.choose(nc, hand, d, now);
      if (pick && pick.e !== R.e) {
        this.end('turn');
        this.cur = nc;
        this.stats.strokes++;
        this.start(pick, nc);
        return this.drive(0);
      }
      this.cur = prevCur; // 맞는 것이 없으면 그대로 잇는다
      this.cur.tEnd = null;
      this.last = prevLast;
    }
    if (R.U.step && !R.stepAsked && R.t < 0.3) R.stepAsked = this.askStep(R.U.step); // 못 받았으면(뒤로 당긴 스틱 등) 잠깐 다시 부탁 (AI 와 같음)
    R.v = Math.max(R.v, this.fSpeed * UA.speedK);
    let left = R.v * dt;
    while (left > 0 && R.i < R.tg.length) {
      const T = R.tg[R.i];
      const dx = T[0] - off.x;
      const dy = T[1] - off.y;
      const d = hyp(dx, dy);
      if (d > left) {
        off.x += (dx / d) * left;
        off.y += (dy / d) * left;
        left = 0;
      } else {
        off.set(T[0], T[1]);
        left -= d;
        if (R.i === R.gateAt && !R.chained) {
          // 두 번 잇는 동작의 뒷부분: 손가락이 아직 긋고 있을 때만 (방향 조건이 있으면 그쪽으로) — 손가락이 꺾이는 동안 chainWait 초까지 그 자리에서 기다린다
          const go = this.fSpeed >= SKILL.swingSpeed && (!R.e.chain.dir || dirOk(fd, R.e.chain.dir));
          if (!go) {
            R.waitT = (R.waitT ?? 0) + dt;
            if (R.waitT > UA.chainWait) return this.end('chain');
            return;
          }
          R.chained = true;
        }
        R.i++;
      }
    }
    if (R.i >= R.tg.length) this.end('done');
  }

  /** 놓아 준다 (자유 조작으로): 손 목표 속도가 튀지 않게 (skill.js secretEnd 와 같음) */
  end(why) {
    const f = this.f;
    const R = this.r;
    this.r = null;
    // 반대로 그어 놓아 준 것은 그 꺾음이 곧 새 긋기다(찌르다 꺾음 → 카바치오네·염시) — 쉼을 기다리지 않는다. 다 이었거나·멈췄거나·다른 동작에 내준 것은 한 번 쉰 뒤
    this.needRest = why !== 'opposite';
    this.stats.ends[why] = (this.stats.ends[why] ?? 0) + 1;
    if (R?.chained) this.stats.ends.chained = (this.stats.ends.chained ?? 0) + 1;
    f.skill.prev.copy(f.handOffset);
    f.skill.anchor.copy(f.handOffset);
  }
}
