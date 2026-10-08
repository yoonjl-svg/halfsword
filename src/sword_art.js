// ─────────────────────────────────────────────────────────────
//  검술 풀이 — resolveSwordArt(spec, persona) 한 함수 (검술 보정 v2 확장 ① 구조, 10/8 — docs/strike/sword_art_layers_design_2026-10-08.md §3·§13)
//
//  무기 하나(스펙 + 몸 틀·싸움 방식·쥠 분류)와 인물 하나(AI persona)를 받아 "이 검객이 칼을 어떻게 쓰나"를 한 번에 정한다.
//  전엔 다섯 자리가 따로 정했다: fighter.js 생성자(무기 종류별 자세표 고르기) · motion_library applyMotionLibrary(몸 틀 표·덧씌우기) ·
//   ai.js 생성자(유파 꾸러미 schoolOf + libSchool 병합 + 간격 늘이고 줄이기) · hands.js(쥠 모양 GRIPS 고르기) · main.js(HUD 자세 이름).
//  이제 그 자리들은 이 결과만 읽는다. 결과 값은 전과 같다(같은 표 객체·같은 기술 목록·같은 간격 — 전 무기 결정 덤프·48 판 표로 확인).
//
//  층: 틀(frames.js — 몸 틀 × 싸움 방식) · 유파(schools.js — 전통·인물 꾸러미) · 무기(weapons.js 제원, weapon_measured.js 간격 실측).
//
//  결과 (art)
//   frame·style  몸 틀·싸움 방식 (weapon_class.js 분류 — 스펙에 적으면 그 값)
//   grip         쥠: kind(쥠 종류 one-hand·hand-and-half·two-hand) + 벙어리장갑 손 모양 a·b·t·off(+ 자세별 돌림 turn) — hands.js
//   baseTable    무기 종류별 자세표 (동작 PM 10/1: 한손 → 찌르기/세이버 표, 두손 찌르기 → 두손 찌르기 표, 그 밖 → 없음 = 교본 표)
//   libTable     동작 라이브러리 몸 틀 표 (바탕 표 위에 덮음, 고칠 것이 없으면 null) — lib 일 때만
//   table        실제로 쓰는 표 = libTable ?? 바탕 표 (fighter.guardPose.table·bodyGuard.table)
//   names        자세 번호(0~15, 마무리 자세 둘 포함) → 자세 칸(name·desc) — main.js HUD. 유파 이름(TRADITIONS[tradition].names)이 있으면
//                바탕 자리 이름(GUARDS[i].name)으로 맞춰 이름·설명만 덮는다(10/9 ②③ — 늘 켬, 표는 건드리지 않는다: 판에 닿지 않음)
//   overlays     덧씌우기: lunge(찌르기 방식 런지) · flow(앞무게 이어 베기) · noTwist(날 없는 무기 — 기본 안 씀) · cover(막기 덧씌우기 — 기본 안 씀)
//   caps         손목 서보 상한 (쥠 종류 기본값 또는 무기 명시값 — weapons.js 가 정한 그대로, 읽기만)
//   school       AI 가 쥐는 꾸러미: 인물이 고른 것(persona.school, 없으면 롱소드 = 독일) + lib 이면 몸 틀·방식 가중치·새 기술·속임수·간 보는 자세
//   tech·feints·parry·watch  그 꾸러미의 기술·속임수·막기 자리·간 보는 자세
//   measure      그 꾸러미로 이 무기를 쥘 때의 간격 (꾸러미 간격을 무기 실측 비율로 늘이고 줄임) · measureFor(다른 무기) = 상대 칼 어림용
//   restGuard    쉴 자세 (보정 v2 ③ 되돌아옴 겨눔의 목표 — skill.js 가 pad 를 읽는다, 플레이어만) — 유파 rest 가 있으면 그 패드(일본·중국 'langort' = 中段·中平, 사장님 10/9 01:2x 안 A),
//                아니면 SKILL.homeGuard(쟁기 자리). 스위치와 상관없이 늘. 비교 손잡이 SKILL.schoolRest(`?schoolRest=pflugR` = 안 B)
//   tradition    유파 전통 열쇠 (인물이 꾸러미를 고르면 그 꾸러미의 것, 아니면 무기의 것 — schools.js traditionOf)
//   lib          동작 라이브러리를 입히나 (본판 스위치 MOTION.lib — 도구는 opts.lib 로 직접)
//   motion       옛 motionFor 모양 (도구·fighter.motion 호환)
//  school·measure·motion 은 처음 읽을 때 만든다: 검객 생성자는 몸 쪽만 읽어 유파 병합(기억해 두는 꾸러미)을 건드리지 않는다 — 전과 같은 차례.
//  기본 AI(인물 없음)는 그 무기의 유파 꾸러미(schools.js weaponSchool: 무기 유파 내용 + 그 무기 간격)를 쥔다 — 사장님 10/9 01:2x '바꿔'(전엔 롱소드 꾸러미 + 무기 간격 비율; 롱소드는 같은 꾸러미라 관문 동일,
//   다른 무기는 docs/strike/motion_lib_main_2026-10-08.md §3 '본판(켬)' 열(motion_lab duel main = 무기 꾸러미)이 곧 기본 AI 의 수치). 꾸러미가 없는 무기(총)는 롱소드 꾸러미
//  유파 자료 (10/9 ②③, SKILL.schoolArt 1 일 때만 — schools.js '유파 자료' 머리말): 꾸러미에 유파 기술 가중치(techK)·맞받아치기(counterArt)를 덮는다 (쉴 자세·이름은 늘).
//   어느 유파의 것을 덮나 = art.tradition — 인물이 꾸러미를 골랐으면 그 꾸러미의 유파, 아니면 무기의 유파(traditionOf).
//   그래서 인물 없는 기본 AI 가 모노호시자오를 쥐면 독일 꾸러미 위에 일본 가중치가 얹힌다(꾸러미는 오늘 그대로 독일 — 그것은 바꾸지 않았다, 사장님 확인 전).
//   이름 덮기는 스위치와 상관없이 늘 한다(HUD 만)
// ─────────────────────────────────────────────────────────────
import { SKILL } from './config.js';
import { GUARDS, guardBaseOne, guardBaseTwo } from './guards.js';
import { classifyStyle } from './weapon_class.js';
import { G, TECH, WATCH_GUARDS } from './ai_techniques.js';
import { MOTION, buildFrameTable, styleTech, styleFeints, frameWatchGuards, weightTech, NEW_TECH, OVERLAY, COVERS, LIB_PARRY, HAND_GRIPS, installLunge, installFlow, installCover } from './frames.js';
import { TRADITIONS, SCHOOL_ART, traditionOf, schoolOf } from './schools.js';
import { getWeapon } from './weapons.js';
import { MEASURED, WEAPON_BASELINE } from './weapon_measured.js';

const LS_MEASURED = MEASURED.longsword;

/** 무기 종류별 자세표 (동작 PM 10/1 docs/motion/one_hand_guards_2026-10-01.md·two_hand_thrust_guards_2026-10-01.md, 사장님 10/1 21:45 승인):
 *  한손 → 찌르기 표(레이피어·청강검: 칼끝 늘 상대 쪽, 손목 베기) / 세이버 표(세이버·팔쉬온·나뭇가지·고무 닭: 감는 자세는 팔꿈치 굽힘),
 *  두손 찌르기 칼(에스톡) → 두손 찌르기 표(감기 자세 9개가 칼끝 상대 쪽). 그 밖의 두손 무기는 표를 두지 않아 예전 교본 표 그대로 (전 fighter.js 생성자 분기) */
function baseTableOf(spec) {
  const st = classifyStyle(spec);
  return spec.oneHandStance ? guardBaseOne(st) : st === 'thrust' ? guardBaseTwo(st) : undefined;
}

/** HUD 자세 이름: 무기별·라이브러리 자세표가 있으면 그 칸(상단·팔상·3번 자세…), 마무리 자세(14·15)는 늘 GUARDS (전 main.js updateGuardName) */
function guardNames(T) {
  return GUARDS.map((g, i) => (T && i < T.length ? T[i] : g));
}

/** 유파 이름 덮기 (10/9 ②③): 바탕 자리 이름 GUARDS[i].name 으로 맞춘다(틀 표의 보이는 이름이 아니라). 새 칸을 만들어 이름·설명·출처만 바꾸고 표는 그대로 둔다 */
function schoolNames(names, tradition) {
  const over = TRADITIONS[tradition]?.names;
  if (!over) return names;
  return names.map((row, i) => {
    const o = GUARDS[i] && over[GUARDS[i].name];
    return o ? { ...row, name: o.name, desc: o.desc ?? row.desc, src: o.src } : row;
  });
}

/** 쥠 모양 (전 hands.js gripFor): 무기 예외가 있으면 그것, 없으면 쥠 종류 기본값(두 손·한 손) */
function gripOf(spec) {
  const shape = HAND_GRIPS[spec.id] ?? (spec.twoHand ? HAND_GRIPS._two : HAND_GRIPS._one);
  return { kind: spec.grip ?? null, ...shape };
}

/** 쉴 자세 (사장님 10/8 21:5x '유파가 정한다'): SKILL.schoolArt 1 이고 SCHOOL_ART.rest 이고 유파 rest(G 패드 열쇠)가 있으면 그 패드, 아니면 SKILL.homeGuard(쟁기 자리) */
function restGuardOf(names, tradition) {
  const own = TRADITIONS[tradition]?.rest; // 유파 쉴 자세 (일본·중국 'langort' — 사장님 10/9 01:2x 안 A). 없는 유파(독일 등)는 homeGuard
  const key = SCHOOL_ART.rest && own ? SKILL.schoolRest || own : null; // `?schoolRest=pflugR` = 안 B 비교(유파 rest 가 있는 무기만 바뀐다)
  const pad = key && G[key] ? G[key] : SKILL.homeGuard;
  let index = -1;
  let best = Infinity;
  for (let i = 0; i < GUARDS.length; i++) {
    if (GUARDS[i].finish) continue;
    const d = Math.hypot(GUARDS[i].pad[0] - pad[0], GUARDS[i].pad[1] - pad[1]);
    if (d < best) {
      best = d;
      index = i;
    }
  }
  return { pad, index, guard: names[index] ?? null, tradition, fromTradition: TRADITIONS[tradition]?.rest ?? null, applied: !!(key && G[key]) };
}

/**
 * 유파 자료를 꾸러미에 덮는다 (10/9 ②③ — SKILL.schoolArt 1 일 때만 부른다). 받은 꾸러미는 고치지 않고 새 꾸러미를 돌려준다(라이브러리 병합 기억을 지킨다).
 *  가중치(SCHOOL_ART.weights): 유파 techK 에서 '몸 틀:싸움 방식' → '몸 틀:*' → '*' 차례로 처음 맞는 칸 하나 — 기술 이름 곱 × (찌르기면 thrust 곱), base 에 곱한다.
 *  맞받아치기(SCHOOL_ART.counter): 유파 counterArt — 그 이름이 모두 이 꾸러미 기술에 있을 때만(없는 기술을 고르면 AI 가 멈춘다)
 */
function applySchoolArt(school, tradition, frame, style) {
  const T = TRADITIONS[tradition];
  if (!school || !T) return school;
  let out = school;
  const K = SCHOOL_ART.weights && T.techK ? T.techK[`${frame}:${style}`] ?? T.techK[`${frame}:*`] ?? T.techK['*'] ?? null : null;
  if (K) {
    const tech = school.tech.map((t) => {
      const k = (K[t.name] ?? 1) * (t.kind === 'thrust' ? K.thrust ?? 1 : 1);
      return k === 1 ? t : { ...t, base: t.base * k };
    });
    out = { ...out, tech, techByName: Object.fromEntries(tech.map((t) => [t.name, t])) };
  }
  if (SCHOOL_ART.newTech && T.newTech) { // 유파 새 기술(길이 측정된 것만 ai:true — 기본은 모두 ai:false 자료)
    const have = new Set(out.tech.map((t) => t.name));
    const add = T.newTech.filter((t) => t.ai !== false && !have.has(t.name));
    if (add.length) {
      const tech = [...out.tech, ...add];
      out = { ...out, tech, techByName: Object.fromEntries(tech.map((t) => [t.name, t])) };
    }
  }
  const C = SCHOOL_ART.counter ? T.counterArt : null;
  if (C && Object.values(C).every((names) => names.every((n) => out.techByName[n]))) out = { ...out, counter: C };
  return out;
}

const _libSchools = new Map();
/**
 * 유파 꾸러미에 동작 라이브러리 몫을 더한다 (전 motion_library libSchool 의 몸 그대로 — 켜고 끄기는 부르는 쪽이 정한다).
 *  캐릭터 PM·무기 담당이 고른 기술 간격·가중치·간격표(measure)는 그대로 두고, 몸 틀·방식의 가중치(앞무게: 내리치는 베기 ×1.4 ·
 *  찌르기 방식: 찌르기 ×1.8·베기 ×0.7 · 베기 방식: 찌르기 ×0.5 — 유파가 이미 손본 목록(독일 두삭 가지 세이버·팔쉬온)이면 건너뜀)와
 *  새 기술(탈류→레베스·손목 베기, styleTech 와 같은 규칙), 속임수(styleFeints), 간 보는 자세(frameWatchGuards — 유파가 따로 고른 것은 그대로)를 덧붙인다.
 *  A 두손 두루(롱소드류)·총·자루는 그대로. 꾸러미는 (꾸러미 id, 무기 id) 마다 한 번 만들어 둔다(결정적)
 */
function mergeLibSchool(school, weapon) {
  if (!school || school.lib) return school;
  const frame = weapon?.frame ?? 'two';
  const style = weapon?.style ?? 'versatile';
  if ((frame === 'two' && style === 'versatile') || frame === 'gun' || frame === 'pole') return school;
  const key = `${school.id}|${weapon?.id}`;
  const hit = _libSchools.get(key);
  if (hit) return hit;
  let t = school.tech;
  const plain = t === TECH; // 손보지 않은 롱소드 기술 목록
  if (style === 'cut' && plain) t = weightTech(t, (x) => x.kind === 'thrust', 0.5);
  if (style === 'thrust') t = weightTech(weightTech(t, (x) => x.kind === 'thrust', 1.8), (x) => x.kind === 'cut', 0.7);
  if (style === 'blunt') t = t.filter((x) => x.kind !== 'thrust');
  if (frame === 'heavy') t = weightTech(t, (x) => x.presses, 1.4);
  const have = new Set(t.map((x) => x.name));
  const add = (NEW_TECH[frame] ?? []).filter((x) => x.ai !== false && !have.has(x.name) && !(style === 'blunt' && x.name === 'wristCut') && (style !== 'thrust' || x.kind === 'thrust'));
  t = [...t, ...add];
  const out = { ...school, lib: true, tech: t, techByName: Object.fromEntries(t.map((x) => [x.name, x])), feints: styleFeints(style, frame), guards: school.guards === WATCH_GUARDS ? frameWatchGuards(frame) : school.guards };
  _libSchools.set(key, out);
  return out;
}

/**
 * 간격 늘이고 줄이기 (전 ai.js 생성자 scaledM 그대로). 꾸러미 measure 는 그 꾸러미를 잰 무기(school.weapon, 대부분 롱소드)의 값이라,
 *  칼이 그보다 짧거나 길면 실측 비율만큼 줄이거나 늘린다 — 안 그러면 짧은 칼을 쥔 쪽이 롱소드 간격에서 공격을 걸었다가 닿지도 못한다.
 *  실측 표에 있으면 축마다 실측 비율, 없으면(미래 무기) 칼 길이 비율로 대충. 같은 무기면 꾸러미 measure 그대로(두 번 줄지 않게)
 */
function measureScaler(school) {
  const baseM = school.measure;
  const schoolWid = getWeapon(school.weapon ?? 'longsword').id; // 옛 id(jian 등)는 별칭으로 정식 id 로
  const schoolM = MEASURED[schoolWid] ?? LS_MEASURED;
  return (w) => {
    if (!w || w.id === schoolWid) return baseM;
    const m = MEASURED[w.id];
    if (m) {
      return { ...baseM, contact: baseM.contact * (m[0] / schoolM[0]), reach: baseM.reach * (m[1] / schoolM[1]), clinch: baseM.clinch * (m[2] / schoolM[2]), cutTime: baseM.cutTime * (m[3] / schoolM[3]) }; // 베는 시간도 같은 비율로
    }
    const s = (w.bladeLength + w.hiltLength) / WEAPON_BASELINE;
    return { ...baseM, contact: baseM.contact * s, reach: baseM.reach * s, clinch: baseM.clinch * s };
  };
}

/** 처음 읽을 때 한 번 만드는 칸 */
function lazy(obj, key, make) {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: true,
    get() {
      const v = make();
      Object.defineProperty(obj, key, { value: v, writable: true, configurable: true, enumerable: true });
      return v;
    },
  });
}

/**
 * 검술 풀이 한 번.
 *  spec    무기 스펙 (getWeapon 결과 — finalizeSpec 이 frame·style 을 붙여 둔다). 없으면 롱소드류 기본으로 읽는다
 *  persona AI 인물 (persona.school = 꾸러미 id: 인물 꾸러미 또는 무기 id). 없거나 school 이 없으면 롱소드(독일) 꾸러미
 *  opts.lib    동작 라이브러리를 입히나 (기본 = 본판 스위치 MOTION.lib). 옛 이름 applyMotionLibrary·motionFor 는 true 로 부른다
 *  opts.base   라이브러리 표의 바탕 표 (기본 = 이 무기의 무기별 표). applyMotionLibrary 는 검객이 지금 쥔 표를 넘긴다 (null = 옛 바탕)
 *  opts.school 꾸러미 객체를 직접 (옛 이름 libSchool 호환 — 인물 대신)
 */
export function resolveSwordArt(spec, persona = null, opts = {}) {
  const w = spec ?? {};
  const frame = w.frame ?? 'two';
  const style = w.style ?? 'versatile';
  const lib = opts.lib ?? MOTION.lib;
  const baseTable = baseTableOf(w);
  const hasBase = 'base' in opts;
  const libBase = hasBase ? opts.base : baseTable ?? null;
  const skip = w.motionSkip ?? [];
  const libTable = lib ? buildFrameTable(frame, style, skip, libBase) : null;
  const table = libTable ?? (hasBase ? opts.base ?? undefined : baseTable);
  const pkgId = 'school' in opts ? null : persona?.school;
  const tradition = (pkgId != null ? schoolOf(pkgId).tradition : null) ?? traditionOf(w);
  const names = schoolNames(guardNames(table), tradition);
  const art = {
    id: w.id ?? null,
    frame,
    style,
    grip: gripOf(w),
    baseTable,
    libTable,
    table,
    names,
    overlays: { lunge: OVERLAY[style]?.lunge ?? null, flow: frame === 'heavy', noTwist: style === 'blunt', cover: COVERS[frame] ?? null },
    caps: { grip: w.grip ?? null, maxAimTorque: w.controlOverrides?.maxAimTorque ?? null, fromGrip: !!w.capFromGrip },
    restGuard: restGuardOf(names, tradition),
    tradition,
    lib,
  };
  // AI 꾸러미: 인물이 고른 꾸러미(없으면 롱소드) → lib 이면 몸 틀·방식 몫을 더한다 (전 ai.js schoolOf + libSchool) → 스위치를 켜면 유파 자료(art.tradition 의 것)
  lazy(art, 'school', () => {
    const pkg = 'school' in opts ? opts.school : schoolOf(persona?.school ?? w.id); // 인물이 없으면 무기 유파 꾸러미(weaponSchool) — 사장님 10/9 01:2x '바꿔'(전엔 롱소드 꾸러미 + 무기 간격 비율)
    const s = lib ? mergeLibSchool(pkg, spec) : pkg;
    return SKILL.schoolArt ? applySchoolArt(s, tradition, frame, style) : s;
  });
  lazy(art, 'tech', () => art.school.tech);
  lazy(art, 'feints', () => art.school.feints);
  lazy(art, 'parry', () => art.school.parry);
  lazy(art, 'watch', () => art.school.guards);
  lazy(art, 'measureFor', () => measureScaler(art.school));
  lazy(art, 'measure', () => art.measureFor(spec));
  // 옛 motionFor 모양: 몸 틀·방식 쪽 라이브러리 몫 (유파와 상관없는 기술 목록 styleTech — 도구가 제 꾸러미를 만들 때 쓴다)
  lazy(art, 'motion', () => ({
    frame,
    style,
    table: lib ? libTable : buildFrameTable(frame, style, skip, libBase),
    tech: styleTech(style, frame),
    feints: styleFeints(style, frame),
    watch: frameWatchGuards(frame),
    overlay: OVERLAY[style] ?? null,
    parry: MOTION.useParry ? LIB_PARRY[w.id] ?? null : null,
    noTwist: style === 'blunt',
    flow: frame === 'heavy',
    counter: frame === 'pole' ? { default: styleTech(style, frame).map((t) => t.name) } : null, // 유파 맞받아치기 목록을 바꿔야 하는 틀(자루)만
  }));
  return art;
}

/**
 * 검객 하나에 풀이의 라이브러리 몫을 입힌다 (전 applyMotionLibrary 의 몸 그대로): 몸 틀 표, 덧씌우기(런지·흐름·막기), fighter.motion.
 *  Fighter 생성자가 lib 일 때 부르고(cover 끔), 옛 이름 applyMotionLibrary(도구)가 부른다.
 */
export function applySwordArt(fighter, art, { overlay = true, flow = true, noTwist = false, ai = null, cover = true } = {}) {
  const m = art.motion;
  if (m.table) fighter.guardPose.table = fighter.bodyGuard.table = m.table; // 고칠 것이 없으면(롱소드류·총) 무기별 표를 그대로 둔다
  fighter.motion = m;
  fighter.swordArt = art;
  const o = art.overlays;
  if (overlay && o.lunge) installLunge(fighter, o.lunge);
  // 날 세우기(손목 비틀기)를 끈다: 날 없는 무기(④ 때리기)는 어느 면으로 맞아도 같다.
  //  비트는 힘도 손목 힘 한도(cap) 안에서 나눠 쓰므로, 끄면 그만큼 휘두르는 데 쓴다 (무기-검술 연구 ② 제안).
  //  잰 값(motion_lab swings): 나뭇가지 +15~30%, 참치는 베기마다 들쭉날쭉. 라이트세이버(연구 ⑥ 제안)는 우리 판정이 날 있는 칼로 보므로
  //  끄면 날이 안 서 베기 지표가 0 이 된다 — 넣지 않는다.
  //  기본은 끔(noTwist=false): 실제 싸움에서 참치 23% → 8%, 나뭇가지도 떨어졌다 (비트는 힘이 칼을 붙잡아 주는 몫이 컸다). 기록용으로만 남긴다
  if (overlay && noTwist && o.noTwist) fighter.twistScale = 0;
  // 흐름(SKILL.flow — 멈추지 않고 이어 베기)을 이 검객에게만 켠다: 앞무게(B)는 되돌리지 않고 이어 도는 것이 빠른 길 (몬탄테)
  if (overlay && flow && o.flow) installFlow(fighter);
  // 막기 덧씌우기(COVERS): AI 가 그 줄을 칼로 막는 동안만 손·칼끝을 막기 자세로 덮는다 (자세표에 넣으면 베기 길이 휜다 — COVERS 주석)
  if (overlay && cover && ai && o.cover) installCover(fighter, ai, o.cover);
  return m;
}
