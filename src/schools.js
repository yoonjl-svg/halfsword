// ─────────────────────────────────────────────────────────────
//  유파: 전통 하나 = "검술 교본" 한 벌 (검술 보정 v2 확장 ① 구조, 10/8 — docs/strike/sword_art_layers_design_2026-10-08.md §13)
//
//  세 층 — 틀(몸 틀 × 싸움 방식, weapon_class.js·frames.js) · 유파(전통, 이 파일) · 무기(제원 weapons.js, 간격 실측 weapon_measured.js).
//  이 파일에는 둘이 있다.
//   ① TRADITIONS — 유파 전통 여섯의 내용(간 보는 자세·기술·속임수·막기 자리·맞받아치기·물러남·고정 손 위치). 간격(measure)은 갖지 않는다.
//      독일(german: 두손 두루 + 한손 베기 세이버·팔쉬온 = 두삭 가지) · 이탈리아(italian: 한손 찌르기) · 이베리아(iberian: 앞무게 베기·때리기 —
//      츠바이핸더·참치) · 일본(japanese: 모노호시자오) · 중국(chinese: 청강검·지안) · 무유파(none: 둔기·총).
//      무기 → 유파 기본값은 틀·방식에서 자동(traditionOf), 스펙에 school 이 있으면 그것(모노호시자오 japanese, 청강검 chinese).
//      지금(① 구조)은 독일 말고는 자리만이다: 이탈리아·이베리아·일본·무유파는 독일 내용 그대로, 중국은 전 지안 꾸러미 그대로
//      (전엔 모든 무기 꾸러미가 롱소드 꾸러미 위에 간격만 바꾼 것이었다 — 판이 바이트까지 같게 그 내용을 그대로 옮겼다).
//   ② SCHOOLS — AI 가 쥐는 꾸러미 (옛 계약 그대로: 유파 내용 + 그 꾸러미를 잰 무기 weapon + 간격 measure). 열쇠도 옛 그대로:
//      인물 꾸러미(longsword 기본·tree_branch 브란·qinggang/jian 랴오·excalibur_replica 하인리히 — 캐릭터 PM, 지금처럼 유지)와
//      무기 id 꾸러미(weaponSchool: 무기의 유파 + 그 무기 간격 + 무기 예외). 도구가 SCHOOLS[id]·schoolOf(id) 로 읽고 새 열쇠를 끼운다.
//  AI 는 이 파일을 직접 고르지 않는다: sword_art.js resolveSwordArt 가 인물(persona.school, 없으면 롱소드)로 꾸러미를 고르고
//   동작 라이브러리 몫을 더하고 간격을 무기에 맞춘다.
//
//  꾸러미 모양 (계약):
//   weapon   그 꾸러미 간격을 잰 무기 id (참고용. 실제 무기 물리는 여기서 정하지 않는다)
//   measure  간격 상수 (m·s) — weapon_measured.js schoolMeasure(weapon). 다른 무기를 쥐면 sword_art.js 가 실측 비율로 늘이고 줄인다
//     contact  베기가 머리·목에 제대로 닿는 거리 (칼날 70% 지점)
//     reach    서 있다가 휘두르며 한 걸음 내디디면 닿는 거리 = 이 안은 위험하다 (상대도 같다)
//     clinch   너무 붙음: 칼을 제대로 못 쓴다 → 떨어진다
//     cutTime  베기를 시작해서 닿기까지 걸리는 시간 (롱소드 0.30 기준)
//   guards   간 볼 때 쓰는 자세 목록 (ai_techniques.js WATCH_GUARDS 모양)
//   tech     기술 목록 (TECH 모양), techByName 은 그 이름 색인
//   feints   속임수 목록 (FEINTS 모양)
//   parry    상대 칼이 들어오는 줄(highL·highR·highC·lowL·lowR·thrust) → 그 칼을 가로막는 손 위치
//   counter  맞받아 베기(Indes)에 쓸 기술 이름들 — 들어오는 줄별로, 지금 손에서 가까운 것을 고른다
//   withdraw 물러날 때 겨누는 자세 이름: pressed(몰아치는 상대에게), calm(그 밖에, 둘 중 하나를 무작위로)
//   pose     그 밖의 고정 손 위치: cover(쓰러졌을 때 머리 위로 가리기), point(칼끝으로 겨누기)
//   tradition 이 꾸러미의 유파 전통 열쇠 (TRADITIONS) — 10/8 더함, 읽기만(AI 동작은 읽지 않는다)
// ─────────────────────────────────────────────────────────────
import { G, WATCH_GUARDS, TECH, TECH_BY_NAME, FEINTS, HIGH_GUARDS } from './ai_techniques.js';
import { WEAPONS } from './weapons.js';
import { schoolMeasure } from './weapon_measured.js'; // 무기별 간격은 한 곳(weapon_measured.js)에서 읽는다

/** 기술 목록을 복사하면서 기술별 reach(닿는 거리 보정, m)를 무기에 맞게 바꾼다 (표에 없는 기술은 롱소드 값 그대로) */
const withReach = (tech, reach) => tech.map((t) => (t.name in reach ? { ...t, reach: reach[t.name] } : t));
const byName = (tech) => Object.fromEntries(tech.map((t) => [t.name, t]));
const noThrust = TECH.filter((t) => t.kind !== 'thrust');
const noThrustFeints = FEINTS.filter((f) => TECH_BY_NAME[f.fake].kind !== 'thrust');
const weakThrust = (tech, k) => tech.map((t) => (t.kind === 'thrust' ? { ...t, base: t.base * k } : t));

// ── ① 유파 전통 ─────────────────────────────────────────────
// 독일식 롱소드 (리히테나워·마이어 전통) — 지금 AI 의 바탕. 값은 모두 예전 ai.js 의 PARRY·counterTech()·startWithdraw() 그대로 (전 SCHOOLS.longsword 의 내용)
const GERMAN = {
  guards: WATCH_GUARDS,
  tech: TECH,
  techByName: TECH_BY_NAME,
  feints: FEINTS,
  // (공격 5가지 × 자세 13가지를 물리로 부딪쳐 보고 가장 잘 막은 자세)
  parry: {
    highL: [-0.3, 0.1], // 내 왼쪽 위 (상대 오른쪽 어깨에서 내려오는 분노의 베기): 칼을 왼쪽에 세워 받는다
    highR: G.ochsR, // 내 오른쪽 위: 오른쪽 황소
    highC: G.langort, // 머리 위에서 곧게: 뻗은 칼 위로 떨어지게
    lowL: G.pflugL,
    lowR: G.pflugR,
    thrust: G.pflugL, // 찌르기: 왼쪽으로 비껴 누른다 (Absetzen)
  },
  // 들어오는 줄에 맞서 가운데를 차지하며 베는 기술 (앞에 있는 것부터 우선)
  counter: { highR: ['zornhauL', 'oberhau', 'zornhau'], default: ['zornhau', 'oberhau', 'zornhauL'] },
  withdraw: { pressed: 'ochsR', calm: ['pflugR', 'langort'] },
  pose: { cover: G.kron, point: G.langort },
};

// 검(劍, 한손 양날검 — 청강검·지안): 가볍고 짧아 간격이 좁고, 찌르기가 강하다(무기 스펙 mThrust 1.15) → 찌르기 기술을 더 믿는다.
//  아래에서 올려 베는 unterhauL이 롱소드보다 0.2m 더 멀리 닿는다 (한손·가벼운 칼이 낮은 궤적에서 더 뻗는다). 전 지안 꾸러미의 기술 목록 그대로
const jianTech = withReach(TECH, { zornhau: 0, unterhau: 0.01, zornhauL: -0.04, unterhauL: 0.19, stichPflug: 0.04, stichPflugL: 0.02, stichOchs: 0.04, stichOchsL: 0, stichAlber: -0.01 })
  .map((t) => (t.kind === 'thrust' ? { ...t, base: t.base * 1.5 } : t));

// 유파 전통 여섯 (사장님 10/8 20:xx: 유파 5 + 무유파). rest = 쉴 자세(보정 v2 ③ 되돌아옴 겨눔의 목표) — 사장님 10/8 21:5x '유파가 정한다'
//  (독일 쟁기/긴 자세 · 이탈리아 테르차 · 이베리아 중단형 · 일본 中段 · 중국 中平 · 무유파 앞으로 겨눔). 지금은 자리만: null = 모든 유파가 SKILL.homeGuard(쟁기 자리) 그대로
export const TRADITIONS = {
  // 독일: 두손 두루(롱소드·엑스칼리버·라이트세이버·에스톡)와 한손 베기(세이버·팔쉬온 — 두삭 가지).
  //  가지(branches, 열쇠 = 몸 틀:싸움 방식): 두삭(한손 베기)은 찌르기를 덜 믿는다 — 찌르기 기술 가중치 × thrustK (전 schools.js 세이버·팔쉬온 weakThrust 0.5 그대로)
  german: { id: 'german', nameKo: '독일', ...GERMAN, branches: { 'one:cut': { nameKo: '두삭 (한손 베기)', thrustK: 0.5 } }, rest: null },
  // 이탈리아: 한손 찌르기(레이피어). 지금은 독일 내용 그대로(전 레이피어 꾸러미 = 롱소드 꾸러미 + 간격) — 카포 페로 자료는 다음 단계
  italian: { id: 'italian', nameKo: '이탈리아', ...GERMAN, rest: null },
  // 이베리아: 앞무게 베기·때리기(츠바이핸더·냉동 참치) — 몬탄테. 지금은 독일 내용 그대로(전 두 꾸러미 = 롱소드 꾸러미 + 간격)
  iberian: { id: 'iberian', nameKo: '이베리아', ...GERMAN, rest: null },
  // 일본: 모노호시자오(스펙 school). 당분간 이베리아와 같은 내용의 자리만 — 五行 자세·燕返し·中段은 ② 단계
  japanese: { id: 'japanese', nameKo: '일본', ...GERMAN, rest: null },
  // 중국: 청강검·지안(스펙 school). 당분간 지금 지안 꾸러미 그대로 (기술별 reach 보정은 청강검 실측 — ③ 단계에서 무기 쪽으로 가를 후보)
  chinese: { id: 'chinese', nameKo: '중국', ...GERMAN, tech: jianTech, techByName: byName(jianTech), rest: null },
  // 무유파: 둔기(나뭇가지·고무 닭·모르겐슈테른)·총. 지금은 독일 내용 그대로 — 날 없는 무기의 찌르기 빼기는 싸움 방식 규칙(weaponSchool)
  none: { id: 'none', nameKo: '무유파', ...GERMAN, rest: null },
};

/**
 * 무기 → 유파 기본값 (틀·방식에서 자동). 스펙에 school 이 있으면 그것 (모노호시자오 japanese · 청강검 chinese).
 *  앞무게 → 이베리아(몬탄테) · 한손 둔기·총 → 무유파 · 한손 찌르기 → 이탈리아 · 그 밖(두손 두루·두손 찌르기·한손 베기·자루) → 독일
 */
export function traditionOf(spec) {
  if (spec?.school && TRADITIONS[spec.school]) return spec.school;
  const frame = spec?.frame ?? 'two';
  const style = spec?.style ?? 'versatile';
  if (frame === 'gun' || style === 'shoot') return 'none';
  if (frame === 'heavy') return 'iberian';
  if (style === 'blunt') return 'none';
  if (frame === 'one' && style === 'thrust') return 'italian';
  return 'german';
}

/** 꾸러미 한 벌 (열쇠 차례는 옛 꾸러미 그대로) */
function pack(id, weapon, measure, c, tradition) {
  return { id, weapon, measure, guards: c.guards, tech: c.tech, techByName: c.techByName, feints: c.feints, parry: c.parry, counter: c.counter, withdraw: c.withdraw, pose: c.pose, tradition };
}

// 무기 예외 — 유파 위에 덮는 그 무기 하나만의 몫.
//  10라운드 6-7 (무기 PM, 디렉터 승인 — 덧붙이기만): 모노호시자오 한 칼 자세 — 높은 자세(HIGH_GUARDS: 지붕·어깨 지붕·황소)에서
//  칼을 미리 들고 기다렸다가 들어오는 순간 벤다. 물러날 때도 높은 자세로. (일본 유파를 채우는 ② 단계에서 上段 으로 유파 쪽에 옮길 후보)
const WEAPON_OVER = {
  monohoshizao: { guards: HIGH_GUARDS, withdraw: { pressed: 'tagR', calm: ['tagR', 'tag'] } },
};

/**
 * 무기 id 꾸러미 조립: 무기의 유파 내용 → 싸움 방식 규칙 → 유파 가지 → 무기 예외, 간격은 그 무기 실측.
 *  ① 날 없는 무기(때리기: 고무 닭·참치·모르겐슈테른)는 찌르기 기술·찌르기 속임수를 뺀다 — 가시 찌르기는 플레이어 탭만
 *     (AI 찌르기는 thrustStyle 없는 무기에서 힘이 안 실려 30 J 도 못 낸다, 줄 143 제안대로 7기술)
 *  ② 유파 가지(독일 두삭: 세이버·팔쉬온)는 찌르기를 덜 믿는다
 *  전 schools.js 의 무기 꾸러미(롱소드 꾸러미 + 간격, 둔기 noThrust, 세이버·팔쉬온 weakThrust, 모노호시자오 높은 자세)와 같은 값을 만든다
 */
export function weaponSchool(spec, tradition = traditionOf(spec)) {
  const T = TRADITIONS[tradition];
  let { tech, techByName, feints } = T;
  if (spec.style === 'blunt') {
    tech = noThrust;
    techByName = byName(noThrust);
    feints = noThrustFeints;
  }
  const br = T.branches?.[`${spec.frame}:${spec.style}`];
  if (br?.thrustK != null) {
    tech = weakThrust(tech, br.thrustK);
    techByName = byName(tech);
  }
  return pack(spec.id, spec.id, schoolMeasure(spec.id), { ...T, tech, techByName, feints, ...WEAPON_OVER[spec.id] }, tradition);
}

// ── ② 꾸러미 (AI 가 쥐는 것) ─────────────────────────────────
//  인물 꾸러미 (캐릭터 시트 persona.school 이 고른다 — 캐릭터 PM, 지금처럼 유지)
export const SCHOOLS = {
  // 기본 AI·이졸데·마르그레테: 독일식 롱소드 (간격 1.57/1.8/1.25/0.30 — 10/8 16:35 두 손 서보 상한 26 뒤 AI 박자 재조정, 확인표 192)
  longsword: pack('longsword', 'longsword', schoolMeasure('longsword'), TRADITIONS.german, 'german'),
};
// 나뭇가지 (브란 — 유파 없음, 자기 흐름. 쓰레기 등급): 날이 없어 찌르기가 안 된다 → 찌르기 기술·찌르기 속임수 제거. 가볍고 짧아 간격이 좁다.
//  기술별 reach 보정은 나뭇가지 실측 (간격 1.46/1.61/1.13/0.21 — 10라운드 hybrid 재실측, 전 1.44/1.64/1.11/0.33)
const branchTech = withReach(noThrust, { zornhau: 0, unterhau: -0.06, zornhauL: 0.01, unterhauL: 0.09 });
SCHOOLS.tree_branch = pack('tree_branch', 'tree_branch', schoolMeasure('tree_branch'), { ...TRADITIONS.none, tech: branchTech, techByName: byName(branchTech), feints: noThrustFeints }, 'none');
// 검(劍) — 랴오 꾸러미의 옛 id (지안 → 청강검). 간격은 청강검과 같은 칼 (1.35/1.52/1.04/0.24, 전 1.32/1.55/1.02/0.38)
SCHOOLS.jian = pack('jian', 'jian', schoolMeasure('qinggang'), TRADITIONS.chinese, 'chinese');
// 청강검(에픽, 랴오): 물리는 지안이지만 양손 가정(토크 22) 뒤 무기 담당이 다시 잰 measure — 무기 꾸러미 조립 그대로(스펙 school 'chinese')
SCHOOLS.qinggang = weaponSchool(WEAPONS.qinggang);
// 엑스칼리버 복제품 (하인리히 — 마이어식 롱소드): 황동 장식에 칼날이 두껍고 무거워(1.50kg·1.00m) 롱소드보다 간격이 아주 조금 좁다.
//  자세·기술은 독일 그대로, 기술별 reach 보정은 복제품 실측 (간격 1.55/1.83/1.2/0.29, 전 1.59/1.86/1.23/0.42)
const replicaTech = withReach(TECH, { zornhau: 0, unterhau: -0.04, zornhauL: -0.03, unterhauL: -0.07, stichPflug: 0.08, stichPflugL: 0.08, stichOchs: 0.08, stichOchsL: 0.08, stichAlber: 0.03 });
SCHOOLS.excalibur_replica = pack('excalibur_replica', 'excalibur_replica', schoolMeasure('excalibur_replica'), { ...TRADITIONS.german, tech: replicaTech, techByName: byName(replicaTech) }, 'german');

// 무기 꾸러미: 간격 실측(weapon_measured.js)이 있는 나머지 무기 — 그 무기의 유파 + 그 무기 간격.
//  브란이 주워 온 커먼 단검(10%, 지금은 팔쉬온), ?foeWeapon= 으로 들려 준 무기가 롱소드 간격으로 헛베지 않게 한다 (main.js: 인물이 평소와 다른 무기를 들면
//  persona.school = 그 무기 id). 기술별 reach 보정은 자료가 없어 롱소드 값. 총은 간격 실측이 없어 꾸러미가 없다(롱소드 꾸러미로)
for (const [id, spec] of Object.entries(WEAPONS)) if (!SCHOOLS[id] && schoolMeasure(id)) SCHOOLS[id] = weaponSchool(spec);

export const DEFAULT_SCHOOL = 'longsword';

/** id가 없거나 모르는 유파면 기본(롱소드) 꾸러미 */
export const schoolOf = (id) => SCHOOLS[id] || SCHOOLS[DEFAULT_SCHOOL];
