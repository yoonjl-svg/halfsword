// ─────────────────────────────────────────────────────────────
//  게임 본체: 화면 준비 → 물리 세계 → 매 프레임 반복(게임 루프)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import * as CONFIG from './config.js';
import { PHYSICS, ARENA, CAMERA } from './config.js';
import { Fighter, GROUND_GROUPS } from './fighter.js';
import { InputTrail } from './trail.js';
import { Input, attachStick } from './input.js';
import { LOOKS, getLook } from './looks.js';
import { AI } from './ai.js';
import { CHARACTERS_BY_ID, randomCharacter, pickCharacterWeapon, randomLine } from './characters.js';
import { Emotions, EMO_ABILITY } from './emotions.js';
import { WEAPON_LIST, getWeapon, drawWeaponCards, TIER_LABEL, setGripTorque } from './weapons.js';
import { attachAura } from './aura.js';
import { Particles, haptic, stickDecal, rebuildDecal, disposeDecals, decalWarmMesh } from './effects.js';
import { Sound, BodySounds } from './sound.js';
import { Combat } from './combat.js';
import { Stages, nextStage, STAGE_IDS, STAGE_FOE } from './stages.js';
import { installGunFx, clearGunFx, warmGunFx } from './gun_fx.js';
import { GUN_STANCE } from './gun.js';
import { attachMadEyes } from './mad_eyes.js';
import { createSwordTrails } from './sword_trail.js';
import { createDecapFx } from './decap_fx.js';
import { createLimbFx } from './limb_fx.js';
import { attachHands } from './hands.js';
import { PerfMeter } from './perfmeter.js';
import { createRenderCap } from './render_cap.js';
import { createFighterLight } from './fighter_light.js';
import { tickDebris, clearDebris, debrisCount } from './debris.js';
import { ReviveFx } from './revive_fx.js';
import { PlayerSecretWatch } from './secret.js'; // 플레이어 비기 창 (10/9 23:5x — AI 와 같은 조건 함수)
import { TRADITIONS } from './schools.js';
import { createTestRoute } from './test_route.js'; // 테스트 전용 경로 (test.html → ?test=1&weapon=&hero=&foe=random&stage=random, docs/test_route_2026-10-10.md)

await RAPIER.init();

// 테스트용 URL 파라미터: ?weapon=monohoshizao&foeWeapon=chicken (무기 id는 weapons.js의 WEAPONS 키,
//  Fighter 생성자가 알아서 getWeapon()으로 찾는다. 없으면 기본 롱소드)
const params = new URLSearchParams(location.search.slice(1).replace(/\?/g, '&')); // 주소에 ? 를 두 번 써도(…?r2p=1?weapon=…) 뒤쪽 인자까지 읽는다 (사장님 10/8 08:30 링크 입력 실수 대비)
// 주인공은 판마다 무기 카드 세 장 중 하나를 골라 받는다 (아래 "무기 뽑기"). 주소에 ?weapon=을 적으면 뽑기 없이 그 무기로 고정.
//  진짜 엑스칼리버는 주인공만 받을 수 있고, 복제품은 하인리히 몫이라 뽑기에서 뺀다
const PLAYER_WEAPON_POOL = WEAPON_LIST.map((w) => w.id).filter((id) => id !== 'excalibur_replica');
const FIXED_WEAPON = params.get('weapon');
const testRoute = createTestRoute(params); // 인자가 없으면 아무것도 바꾸지 않는다
// 테스트용 ?morgTorque=33 : 모르겐슈테른 손목 겨눔 토크 상한(기본 22 = 한손 무기 공통, 확인표 169)을 이번 실행에만 바꾼다 — 사장님 비교용, 저장하지 않는다
const morgTorque = +params.get('morgTorque');
if (morgTorque > 0) getWeapon('morgenstern').controlOverrides.maxAimTorque = morgTorque;
// 테스트용 ?cutReact=same|full|legacy : 절삭 끌림 반작용 방식(config STRIKE.cutReact, 기본 legacy)을 이번 실행에만 바꾼다 — 사장님 비교용(10/8 타격 B 질문)
const cutReact = params.get('cutReact');
if (cutReact === 'same' || cutReact === 'full' || cutReact === 'legacy') CONFIG.STRIKE.cutReact = cutReact;
// R2′ 팔 단계 인자(10/8): ?trunkArc= ?trunkArcSpeed= ?trunkFollow= ?servoLead= ?vertLead= ?r2pScope=player|all ?anchorYawMax= ?twoHandCap= ?chain=legs ?pushAtFoot= ?cutStep= — 기각된 ?swing=arc ?handFollow= ?servoLagRelease= ?dropArc= ?pitchArc= 는 17:20 코드에서 지움
// ?r2p=1 : R2′ 팔 단계 묶음(trunkArc 2 · trunkFollow 0.5 · 한손 servoLead 0.5) — 10/8 17:15 부터 플레이어·AI 모두 본판 기본이라 1 은 확인용. `?r2p=off` 가 묶음 전 물리(세로 follow 는 `?vertLead=0`, 닻 상한은 `?anchorYawMax=0`, 두 손 상한은 `?twoHandCap=22` 로 따로)
//  ?r2p=legs 는 chain legs(발 힘쌍 A)+걸음 채널까지, ?r2p=all 은 범위 all(이제 기본과 같음; 옛 범위는 ?r2pScope=player). 개별 인자가 뒤에 오면 그것이 덮는다
const r2pAll = params.getAll('r2p'); // ?r2p=1&r2p=legs 처럼 여러 번 와도 전부 적용 (legs·all 은 1 을 포함한다)
if (r2pAll.includes('off') || r2pAll.includes('0')) { CONFIG.BODY.trunkArc = 0; CONFIG.BODY.trunkFollow = 0; CONFIG.ARM.servoLead = 0; } // 10/8 14:40 본판 기본이 묶음(플레이어만)이 된 뒤 비교용: 전 물리
if (r2pAll.some((v) => v === '1' || v === 'legs' || v === 'all')) { CONFIG.BODY.trunkArc = 2; CONFIG.BODY.trunkFollow = 0.5; /* 10/8 WA5: 1 이면 두 손 무기 AI 첫 베기 25 → 17/30 (몸이 더 돌아 칼이 짧아짐), 0.5 면 24/30 */ CONFIG.ARM.servoLead = 0.5; /* 10/8 T2 (c): 한손 서보 겨눔 앞세움 — 모르겐슈테른 8.8 → 9.7 m/s, 두 손 무기엔 안 걸림 */ if (r2pAll.includes('legs')) { CONFIG.BODY.chain = 'legs'; CONFIG.GAIT.pushAtFoot = 1; CONFIG.GAIT.cutStep = 1; } /* 10/8 T3: legs 는 걸음 조율 채널 A·B 와 함께 */ if (r2pAll.includes('all')) CONFIG.BODY.r2pScope = 'all'; }
const r2pScope = params.get('r2pScope');
if (r2pScope === 'player' || r2pScope === 'all') CONFIG.BODY.r2pScope = r2pScope;
const twoHandCap = +params.get('twoHandCap');
if (twoHandCap > 0 && params.has('twoHandCap')) setGripTorque('two-hand', twoHandCap); // 10/8 16:20 두 손 서보 상한 26 본판 뒤 비교용(22 = 전 값)
const vertLead = +params.get('vertLead');
if (vertLead >= 0 && params.has('vertLead')) CONFIG.ARM.vertLead = vertLead;
const anchorYawMax = +params.get('anchorYawMax');
if (anchorYawMax >= 0 && params.has('anchorYawMax')) CONFIG.BODY.anchorYawMax = anchorYawMax; // 실험(10/8 15:10): 닻 yaw 모터 토크 상한 N·m, 0 = 오늘
const getupLead = +params.get('getupLead');
if (getupLead >= 0 && params.has('getupLead')) CONFIG.BODY.getupLead = getupLead; // 일어서기 다리 차례(10/8 18:26 본판 기본 1·lag 0.5, 확인표 194): `?getupLead=0` = 전 물리(두 다리 함께)
const motionLib = +params.get('motionLib');
if (motionLib >= 0 && params.has('motionLib')) CONFIG.SKILL.motionLib = motionLib; // 동작 라이브러리(무기 PM) 본판 스위치 — 10/8 18:50 기본 1(사장님 '적용', 확인표 34). `?motionLib=0` = 전 물리
const schoolArt = +params.get('schoolArt');
if (schoolArt >= 0 && params.has('schoolArt')) CONFIG.SKILL.schoolArt = schoolArt; // 유파 자료(10/9 ②③): 기본 1(사장님 10/9 01:5x '스위치 켜') = 유파 가중치·맞받아치기·새 기술(燕返し) 켬. `?schoolArt=0` = 그 전 판(이름·쉴 자세는 늘)
if (params.has('secret')) CONFIG.SKILL.schoolSecret = +params.get('secret') ? 1 : 0; // 유파 비기(10/9 유파 설계 v3): 기본 1, `?secret=0` = 비기 없는 판 (docs/strike/school_secret_2026-10-09.md)
if (params.has('playerSecret')) CONFIG.SKILL.playerSecret = +params.get('playerSecret') ? 1 : 0; // 플레이어 비기(10/9 23:5x): 기본 1, `?playerSecret=0` = 끔 (docs/strike/player_secret_2026-10-09.md)
if (params.has('instant')) CONFIG.SECRET.instant = +params.get('instant') ? 1 : 0; // 일본 비기 순간 베기(10/10, secret_instant.js): 기본 1, `?instant=0` = 10/9 길(담았다 터뜨림) 대조
const SECRET_SLOWMO = params.get('slowMo') !== '0';
if (params.has('iai')) CONFIG.SECRET.iai = +params.get('iai') ? 1 : 0; // 고노센 = 발도(10/10 02:3x): 기본 1, `?iai=0` = 순간이동 고노센
if (params.has('schoolGait')) CONFIG.GAIT.school = +params.get('schoolGait') ? 1 : 0; // 유파 걸음(10/10 비싼 층, gait.js gaitParams): 기본 1, `?schoolGait=0` = 모든 유파 같은 걸음(전 판)
// 전체 빠르기 손잡이 (10/10 사장님 '모티브 게임은 모든 움직임이 다 빠르다'): `?tempo=1.35|1.5|1.7` — 게임 시간 배율(실제 1 초에 물리 스텝을 더 돌림, 비기 느린 화면의 반대 꼴).
//  기본 1 = 오늘 그대로. 시뮬 도구에는 닿지 않는다(이 파일만). 프레임마다 스텝 상한(PHYSICS.maxStepsPerFrame)은 그대로 — 느린 폰에선 상한에 걸리면 그만큼 덜 빨라진다
const TEMPO = Math.min(2, Math.max(0.5, +(params.get('tempo') ?? 1.1) || 1.1)); // 기본 1.1 (사장님 10/10 05:1x '기본 템포 1.1로'), 전 값 `?tempo=1` // 결정타 연출(비기 터뜨림 순간 화면 시간 늦춤, CONFIG.SECRET.slowMo): `?slowMo=0` = 끔
const schoolRest = params.get('schoolRest');
if (schoolRest != null) CONFIG.SKILL.schoolRest = schoolRest; // 유파 쉴 자세 비교(10/9 안 A 결정 뒤): `?schoolRest=pflugR` = 안 B(쟁기 자리), 빈 값 = 유파 값(中段·中平)
const oneVersatile = params.get('oneVersatile');
if (oneVersatile === 'mixed' || oneVersatile === 'thrust' || oneVersatile === 'cut') CONFIG.SKILL.oneVersatileTable = oneVersatile; // 한손 두루(청강검) 자세표(10/9 바닥 고침): 기본 'mixed'(섞은 표, 사장님 확인 전). `?oneVersatile=thrust` = 그 전 판(찌르기 표) · `cut` = 세이버 표(안 B)
const getupLag = +params.get('getupLag');
if (getupLag >= 0 && params.has('getupLag')) CONFIG.BODY.getupLag = getupLag; // 뒷다리가 기다리는 몫(riseTime 비율, 기본 0.5)
const pushAtFoot = +params.get('pushAtFoot');
if (pushAtFoot >= 0 && params.has('pushAtFoot')) CONFIG.GAIT.pushAtFoot = pushAtFoot;
const cutStep = +params.get('cutStep');
if (cutStep >= 0 && params.has('cutStep')) CONFIG.GAIT.cutStep = cutStep;
const servoLead = +params.get('servoLead');
if (servoLead >= 0 && params.has('servoLead')) CONFIG.ARM.servoLead = servoLead;
// 손잡이 찍기 시제품(10/9, docs/strike/pommel_strike_2026-10-09.md): `?pommel=1` = persona.close 가 있는 AI 는 밀치기 뒤 베기 대신 폼멜로 찍는다(CLOSE.pommelAll).
//  `?pommel=tap` = 그에 더해 플레이어가 붙은 거리(CLOSE.pommelDist)에서 탭하면 찌르기 대신 찍는다. 없으면 오늘 그대로
const pommelKnob = params.get('pommel');
if (pommelKnob === '1' || pommelKnob === 'tap') CONFIG.CLOSE.pommelAll = true;
const pommelTap = pommelKnob === 'tap';
const trunkArc = +params.get('trunkArc');
if (trunkArc >= 0 && params.has('trunkArc')) CONFIG.BODY.trunkArc = trunkArc;
const trunkFollow = +params.get('trunkFollow');
if (trunkFollow >= 0 && params.has('trunkFollow')) CONFIG.BODY.trunkFollow = trunkFollow;
const trunkArcSpeed = +params.get('trunkArcSpeed');
if (trunkArcSpeed > 0) CONFIG.BODY.trunkArcSpeed = trunkArcSpeed;
if (CONFIG.JOINTS.presets[params.get('joints')]) CONFIG.JOINTS.mode = params.get('joints'); // 칼 팔 관절 가동 범위 교정 시제품(10/9, docs/motion/joint_range_2026-10-09.md): `?joints=off|anat|hard|soft|reach`, 없으면 기본 anat(켬)
const chainParam = params.get('chain');
if (chainParam === 'legs' || chainParam === 'anchor') CONFIG.BODY.chain = chainParam;
let lastPlayerWeapon = null; // 지난 판에 고른 무기 (다음 판 카드에서 되도록 뺀다)
/** 이번 판 내 카드 두 장 (맨 오른쪽 세 번째 칸은 상대 무기라 여기서 뽑지 않는다): 뽑기 목록에서 겹치지 않게 고르게 뽑는다
 *  (지난 판 무기는 되도록 빼서 같은 무기가 두 판 연속 나오지 않게).
 *  테스트용 ?cards=excalibur,rubber_chicken 으로 두 장을 정할 수 있다 (세 번째 id 를 적어도 버린다: 상대 카드는 상대 무기다) */
function drawCardIds() {
  // 모르는 id 는 버리고(getWeapon 이 롱소드로 바꿔 버린다) 서로 다른 두 장일 때만 쓴다
  const forced = (params.get('cards') || '').split(',').filter((id) => id && getWeapon(id).id === id).slice(0, 2);
  if (forced.length === 2 && forced[0] !== forced[1]) return forced;
  // 등급을 먼저 뽑고 그 등급 안에서 고른다 (사장님 결정: 커먼 40 · 레어 27 · 에픽 16 · 레전드 5 · 쓰레기 7 · ??? 5, weapons.js TIER_DRAW)
  return drawWeaponCards(PLAYER_WEAPON_POOL, 2, { exclude: lastPlayerWeapon });
}

// ── 설정 (브라우저에 저장) ──
const DEFAULTS = { difficulty: 'normal', pixel: false, blood: true, sound: true, invertTilt: false, moveMode: 'stick', skill: '0.7', guardNames: true, techCue: true, techCueAll: false, trail: true, fpsCap: true, secretFlash: true, secretCam: true };
const settings = { ...DEFAULTS };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem('gladiator-settings') || '{}'));
  delete settings.legWeight; // 없앤 설정 ('다리로 체중 받치기'는 이제 늘 켜짐)
  delete settings.corr; // 없앤 설정 ('보정 방식' 옛/새: 사장님 10/1 22:05 위임 → 디렉터 결정, 새 보정이 유일한 보정 — CONFIG.SKILL.corr)
  delete settings.corrTip; // 없앤 설정 ('끝점 겨눔': 같은 결정으로 끔 — CONFIG.SKILL.corrTip. 플레이어 보정 옵션은 '검술 보정 세기'(skill) 하나)
  settings.skill = DEFAULTS.skill; // 검술 보정은 한 단계(0.7)만 — 사장님 10/8 21:5x "플레이어에겐 끔 약 보통 강 같은 구분이 필요 없어. 한 단계로 기본 적용": 메뉴를 뺐고 저장된 옛 값(0·0.4·1)도 무시한다. AI 는 인물 숫자(persona.level.skill)
} catch {
  /* 저장소를 못 쓰면 기본값으로 */
}
const saveSettings = () => {
  try {
    localStorage.setItem('gladiator-settings', JSON.stringify(settings));
  } catch {
    /* 무시 */
  }
};

// 보이지 않는 받침(GAIT.assist 0.2)·붙잡기 반사(GAIT.catchMode)·다리 근육 상한(BODY.legTorque)은 config.js 에서만 온다
//  (탐색판 주소 스위치 ?assist ?catch ?legs 는 값이 정해져(사장님 10/1 21:10 받침 0.2·반사 켬·다리 그대로) 본판에서 뺐다, 10/1 22:05)

// ── 겉모습 미리보기 (모델링 PM 라운드): 마음에 안 들어도 지우지 않고 archive에 쌓아 둔 옛 버전들을
//  주소창에서 바로 볼 수 있게 한다. 플레이어 외형에는 적용하지 않는다(감독 지시: 주인공은 그대로).
//  ?look=margarethe:v0  : 그 캐릭터를 상대로 고정하고 그 버전을 입힌다 (버전 생략 시 지금 버전)
//  ?lookv=0              : 이번에 고른 상대가 누구든 그 버전을 입힌다 (?foe=와 함께 써도 됨)
let lookPreviewId = null;
let lookPreviewVersion = null;
const lookParam = params.get('look');
if (lookParam) {
  const [id, ver] = lookParam.split(':');
  lookPreviewId = id;
  lookPreviewVersion = ver ? (ver.startsWith('v') ? ver : `v${ver}`) : null;
}
const lookvParam = params.get('lookv');
const lookvVersion = lookvParam != null ? (lookvParam.startsWith('v') ? lookvParam : `v${lookvParam}`) : null;

// ── 상대 캐릭터 고르기 (테스트/데모용 최소 기능. 정식 선택 UI는 나중에) ──
//  (없음)        : 무대마다 그곳이 고향인 검객 (stages.js STAGE_FOE, 오너 결정). 짝이 없는 무대는 무작위
//  ?foe=<id>     : characters.js의 특정 캐릭터로 고정
//  ?foe=random   : 판마다 무작위로 다른 캐릭터
//  ?foe=default  : 예전처럼 LOOKS.enemy + 무작위 성격의 "기본 상대" (메뉴의 난이도 설정을 따른다)
const foeParam = params.get('foe') || lookPreviewId || 'stage';
const foeRandomEachRound = foeParam === 'random';
let currentFoe = null; // 이번 판에 고른 캐릭터 (없으면 기본 상대)
let auras = []; // 진짜 엑스칼리버의 일렁임·빛 (aura.js)
/** 캐릭터의 목소리 id: 변형(광기의 하인리히 등, characters.js CHARACTER_VARIANTS)은 원래 캐릭터의 목소리를 쓴다 */
function voiceOf(ch) {
  return ch?.voice || ch?.variantOf || ch?.id || 'generic'; // voice: 다른 인물의 녹음을 빌려 쓰는 인물 (샛별 저장소에서 가져온 셋)
}
function pickFoe() {
  const testFoe = testRoute.pickFoe(currentFoe?.id, foeRandomEachRound); // test=1 · foe=random: 고른 인물은 상대에서 뺀다
  if (testFoe) return testFoe;
  if (foeParam === 'stage') return CHARACTERS_BY_ID[STAGE_FOE[stages.id]] || randomCharacter(currentFoe?.id); // 이번 판 무대의 검객
  if (foeRandomEachRound) return randomCharacter(currentFoe?.id); // 같은 상대가 두 번 연속 나오지 않게
  if (foeParam && CHARACTERS_BY_ID[foeParam]) return CHARACTERS_BY_ID[foeParam];
  return currentFoe; // 고정 지정이 없으면 같은 상대를 계속 쓴다
}

// ── 화면(Three.js) ──
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // three 0.186 은 PCFSoft 를 없애고 이것으로 바꿔 그렸다 (같은 그림, 경고만 없앰)
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
// 흐린 늦은 오후의 바닷가: 옅은 잿빛 안개 (싸우는 곳엔 거의 안 끼고 먼 바다만 흐려진다)
scene.background = new THREE.Color(0xc4c8c6);
scene.fog = new THREE.Fog(0xc4c8c6, 20, 480);

const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 700); // 먼 바다·하늘까지 보이게
camera.position.set(-3.5, CAMERA.height, 0.5);

const hemi = new THREE.HemisphereLight(0xe3e6e8, 0x716c63, 1.2); // 구름 낀 하늘빛 + 모래에 되비친 빛
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe7cb, 1.7); // 구름 사이로 드는 누그러진 해
sun.position.set(4, 9, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 25 });
scene.add(sun, sun.target);

// 캐릭터 전용 조명: 스테이지 빛이 모자라면(밤) 카메라 쪽 보조광·바탕빛·테두리광·윤곽 빛을 캐릭터 재질에만 채운다.
//  스테이지는 fighterLight 로 색만 물들이고 더 밝게 할 수 있을 뿐 끌 수 없다 (fighter_light.js, docs/stages.md 조명 약속)
//  배경이 바뀔 때마다 useStage 가 그 배경의 fighterLight 설정으로 바꿔 끼운다
const fighterLight = createFighterLight({ hemi, sun });
// 부활 연출 (이졸데, src/revive_fx.js): 하늘에서 내린 빛기둥·빛 알갱이·땅의 빛·진짜 빛 하나·몸의 빛. 부활하는 동안만 장면에 붙는다
const reviveFx = new ReviveFx(scene, { renderer, camera, fighterLight });

// ── 배경(스테이지): 판마다 정해진 순서 ─────────────────────────────────────
//  오너 결정: 고르는 화면 없이 늘 포세이돈 신전 → 성 안뜰 → 산사 → 대성당 순서. 대성당 다음 판은 다시 포세이돈 (stages.js STAGE_ORDER)
//  어두운 홀은 쓰지 않는다 (오너 결정. 순서에 없고 ?stage=darkhall 로만 볼 수 있다)
//  짓고 치우는 법은 stages.js, 배경마다 설명은 docs/stages.md
//  ?stage=<id> : 그 배경으로 고정 (시험용, poseidon 도 된다)
//  메뉴 뒤에 보이는 배경(포세이돈)이 첫 판의 배경이다. 그 다음 판부터는 판을 열 때(startFight → nextRoundStage) 다음 배경을 짓는다.
//  짓는 동안의 멈칫(산사·대성당이 가장 길다, 개발 기계에서 0.3초 안팎)은 버튼을 누른 뒤 메뉴가 아직 떠 있는 동안 지나간다
const stages = new Stages(scene, { hemi, sun }); // 지금의 빛·안개·하늘색(포세이돈)을 처음 값으로 적어 둔다
const STAGE_PIN = STAGE_IDS.includes(params.get('stage')) ? params.get('stage') : null;
let arena = null; // 지금 배경 { update(dt), excite(amount) }
let SUN_OFF = null; // 해가 싸우는 자리를 따라다닐 때의 방향 (배경마다 다르다)
let stageFought = false; // 지금 배경에서 이미 한 판을 열었나 (그러면 다음 판을 열 때 다음 배경으로 넘어간다)
let lastRoundWon = false; // 지난 판을 이겼나 (사장님 결정: 이겨야 다음 무대·다음 상대로, 지면 같은 무대에서 같은 상대와 다시)
function useStage(id) {
  if (id === stages.id) return false;
  reviveFx.reset(); // 부활 연출이 남아 있으면 떼고 짓는다 (새 배경의 물체로 잘못 세지 않게)
  arena = stages.build(id); // 먼저 지은 배경은 치우고(GPU 자원까지), 빛·안개를 처음 값으로 되돌린 뒤 짓는다
  SUN_OFF = stages.sunOffset;
  fighterLight.setStage(arena);
  arena.onEvent = (name, data) => sound.stageEvent?.(name, data); // 배경이 알리는 일(성 안뜰: 종이 흔들려 칠 때 'bell') → 소리
  return true;
}
/**
 * 판을 열 때(startFight) 부른다: 지난 판을 이겼으면 순서대로 다음 배경을 짓는다 (첫 판은 메뉴 뒤 배경 그대로).
 *  지거나 도중에 "처음부터 다시"를 누르면 같은 배경 — 상대도 배경을 따르니 같은 상대와 다시 싸운다 (사장님 결정)
 */
function nextRoundStage() {
  const advance = stageFought && testRoute.advance(lastRoundWon); // test=1: 이기든 지든 다음 판으로
  lastRoundWon = false;
  if (advance && useStage(STAGE_PIN || testRoute.nextStage(stages.id) || nextStage(stages.id))) {
    clearFlying(); // 지난 판에 흩어지던 칼·방어구 조각과 벗겨진 투구가 새 배경에 남지 않게
    stages.warm(renderer, camera); // 셰이더·모양·질감도 지금 GPU 에 올려 둔다 (싸움 첫 프레임에서 멈칫하지 않게)
    sound.setStage(stages.id); // 배경 소리가 3초에 걸쳐 바뀐다 (발소리·쓰러짐의 바닥 소리도 배경을 따른다)
  }
  stageFought = true;
}
useStage(STAGE_PIN || testRoute.nextStage(null) || nextStage());
// ── (배경 끝) ─────────────────────────────────────────────────────────────

// ── 화면 크기 / 픽셀 모드 ──
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (settings.pixel) {
    // 작은 해상도로 그린 뒤 크게 늘리면 도트 그래픽처럼 보인다
    const px = Math.max(3, Math.round(h / 180));
    renderer.setPixelRatio(1);
    renderer.setSize(Math.ceil(w / px), Math.ceil(h / px), false);
    canvas.classList.add('pixel');
  } else {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    canvas.classList.remove('pixel');
  }
  camera.aspect = w / h;
  camera.fov = w / h < 1.2 ? CAMERA.fov + 15 : CAMERA.fov;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ── 물리 세계와 등장인물 ──
const particles = new Particles(scene);
const decapFx = createDecapFx(particles); // 참수 목 단면·피 분출 (외형 PM, decap_fx.js — 겉모습만)
const limbFx = createLimbFx(particles); // 팔·다리 절단 단면·피 (limb_fx.js — 겉모습만, 판정은 fighter.sever)
const sound = new Sound();
// 권총(??? 등급) 총구 섬광·연기·총알 궤적·희미한 조준 레이저 (외형 PM, gun_fx.js — 소리는 그대로 두고 GUN_HOOKS.onShot 을 감싼다).
//  world·combat 은 판마다 새로 만들어지니, 늘 지금 판 것을 가리키는 얇은 겉감을 넘긴다 (읽기만 한다 — 판정과 무관)
const swordTrails = createSwordTrails(scene); // 칼 잔상 띠 (외형 PM, sword_trail.js — R0 화면 신호. 판마다 attach, 스텝마다 sample, 프레임마다 update)
installGunFx({
  scene,
  sound,
  world: { castRay: (...a) => world?.castRay(...a) ?? null },
  combat: { get info() { return combat?.info; }, get fighters() { return combat?.fighters ?? []; } },
  shake: (dir, strength) => kickCamera(dir, strength), // 발사 순간 짧은 화면 흔들림 (외형 PM v2, 사장님 '발사 이펙트 약하다')
});
sound.setStage(stages.id); // 배경 소리·바닥 소리가 배경을 따른다
sound.listener = camera; // 배경 소리(성 종 등)의 좌우 자리를 카메라 기준으로 정한다
const input = new Input(canvas);
const trail = new InputTrail(canvas); // 방금 조작한 흔적 (반투명 선)
input.trail = trail;

let world, eventQueue, colliderInfo, player, enemy, ai, combat;
let bodySounds = [];
/**
 * 흩어지던 조각(부러진 칼날 끝·투구·판금 — debris.js 한 곳)과 벗겨진 케틀햇(캐릭터 그룹 밖, 장면에 있다)을 치운다:
 *  새 판(newRound)·배경이 바뀔 때. 여러 번 불러도 괜찮다 (무기 뽑기 때문에 newRound 가 한 판에 두 번 불린다)
 */
function clearFlying() {
  clearDebris();
  clearGunFx(); // 총구 섬광·연기도 새 판에 남지 않게
  // 벗겨진 투구의 긁힌 자국 재질도 푼다 (clearLoose 가 장면에서 떼고 모양을 푼다)
  for (const f of [player, enemy]) for (const m of f?.meshes ?? []) if (m.kind === 'loose' && m.group.parent) disposeDecals(m.group);
  player?.clearLoose();
  enemy?.clearLoose();
}
const fighterMeshes = [];
let foeWeaponId = 'longsword'; // 이번 판 상대 무기 (prepareRound 가 정한다)

/**
 * 판 준비: 이번 상대와 상대 무기를 정한다 (싸움판은 아직 만들지 않는다).
 *  판을 여는 쪽(startFight)이 이것을 한 번 부르고, 무기 뽑기 동안 newRound 를 두 번 불러도 상대는 그대로다.
 */
function prepareRound() {
  currentFoe = pickFoe();
  // 상대 무기: 주소에 foeWeapon/weapon을 직접 적었으면 그것, 아니면 캐릭터가 쓰는 무기 (브란은 10% 확률로 주워 온 커먼 칼)
  foeWeaponId = params.get('foeWeapon') || testRoute.foeWeapon(currentFoe) || FIXED_WEAPON || (currentFoe ? pickCharacterWeapon(currentFoe) : 'longsword');
  // 이번 판에 나오는 목소리만 미리 만든다 (시작 단추를 누르기 전에는 소리 장치가 없어 그냥 넘어간다)
  sound.prepareVoices(['player', voiceOf(currentFoe)]);
}

/**
 * 판 시작 예열: 싸움 도중 처음 나오는 효과의 셰이더를 지금(메뉴·카드가 가리는 동안) 만든다 — 처음 나오는 순간 멈칫하지 않게.
 *  상처 자국(캐릭터 겉면에 붙어 캐릭터 조명이 고친 재질) · 칼 잔상 · 피·불꽃 입자 · 칼이 부러질 때의 조각과 부러진 면.
 *  compile 만 하고 그리지 않는다 (화면 그대로). 캐릭터 조명이 재질을 먼저 고쳐 놓아야(셰이더가 달라진다) 그 셰이더가 준비된다.
 *  셰이더는 쓰는 재질이 하나라도 살아 있어야 남으므로 예열 재질은 다음 예열까지 들고 있다.
 *  예열 물체는 따로 된 난수로 만든다 (three 가 UUID 에 Math.random 을 쓴다 — 판의 난수 흐름을 그대로 두게)
 */
let fxWarmMats = [];
let fxWarmSeed = 0x6a09e667;
let fxWarmGeo = null;
function quietly(fn) {
  const real = Math.random;
  Math.random = () => (fxWarmSeed = (Math.imul(fxWarmSeed, 1664525) + 1013904223) >>> 0) / 4294967296;
  try {
    return fn();
  } finally {
    Math.random = real;
  }
}
const fragileOf = () => [player, enemy].filter((f) => f.weapon?.fragile && f.swordGroup);
const breakFace = () => new THREE.MeshStandardMaterial({ flatShading: true, side: THREE.DoubleSide }); // weapon_looks.js breakWeaponLook 톱니 면과 같은 설정
/** 캐릭터에 잠깐 붙일 예열 물체: 상처 자국(겉면) · 부러진 칼의 톱니 면(칼 그룹) */
function fxWarmers() {
  return quietly(() => {
    fxWarmGeo ??= new THREE.PlaneGeometry(0.001, 0.001);
    const on = [];
    const host = Object.values(player.partMesh).find(Boolean);
    if (host) on.push([host, decalWarmMesh()]);
    for (const f of fragileOf()) on.push([f.swordGroup, new THREE.Mesh(fxWarmGeo, breakFace())]);
    return on;
  });
}
function withWarmers(on, fn) {
  for (const [parent, mesh] of on) parent.add(mesh);
  try {
    fn();
  } finally {
    for (const [, mesh] of on) mesh.removeFromParent();
  }
}
/** newRound 끝에서: 붙여 둔 예열 물체와 칼 조각(장면에 뜬다)·잔상·입자의 셰이더를 지금 무대 빛으로 만든다 */
function warmRoundFx(on) {
  const mats = on.map(([, mesh]) => mesh.material);
  withWarmers(on, () => {
    fighterLight.update(fighterMeshes);
    // 칼 조각 (breakWeaponLook · debris.js spawnDebris 와 같은 재질 설정): 떨어지는 쪽은 칼 재질 복제본(캐릭터 조명이 고친 뒤 복제 —
    //  조명 셰이더는 안 따라간다)과 톱니 면 복제본을 흐리게 해 장면에 띄운다
    const loose = quietly(() => {
      const g = new THREE.Group();
      const put = (m, geo) => {
        m.transparent = true;
        mats.push(m);
        g.add(new THREE.Mesh(geo, m));
      };
      for (const f of fragileOf()) {
        f.swordGroup.traverse((o) => {
          if (!o.isMesh || on.some(([, mesh]) => mesh === o)) return;
          for (let p = o; p && p !== f.swordGroup; p = p.parent) if (!p.visible) return;
          for (const m of [].concat(o.material)) put(m.clone(), o.geometry);
        });
        put(breakFace(), fxWarmGeo);
      }
      return g;
    });
    scene.add(loose);
    for (const o of [...on.map(([, mesh]) => mesh), loose, swordTrails.mesh, particles.mesh]) renderer.compile(o, camera, scene);
    scene.remove(loose);
  });
  for (const m of fxWarmMats) m.dispose(); // 지난 예열 재질: 새 것이 같은 셰이더를 잡은 뒤에 푼다
  fxWarmMats = mats;
}

/**
 * 싸움판 만들기: prepareRound 가 정한 상대와 주인공 무기(weaponId)로 물리 세계와 두 사람을 새로 세운다.
 *  만들기만 하고 시간은 흐르지 않는다 (게임 루프가 state 'fight' 일 때만 물리를 돌린다).
 */
function newRound(weaponId) {
  input.resetTransient(); // 지난 판의 손가락 상태를 물려받지 않는다 (10/8 입력 수명주기)
  // 다리로 체중 받치기: 게임은 늘 gait.js 걸음(다리가 체중 대부분을 받친다). 오너 결정으로 설정 토글을 없애고 기본 적용했다.
  //  CONFIG 기본값도 'hybrid'라 시뮬 도구가 게임과 같은 걸음을 잰다(9/29). 이 줄은 콘솔·도구가 바꿔 둔 값을 판마다 되돌린다
  CONFIG.BODY.weightMode = 'hybrid';
  // 이전 판 정리 (무기 뽑기 때문에 한 판에 두 번 만들 수 있어 모양 데이터는 바로 풀어 준다. 재질·텍스처는 다음 판이 다시 쓴다.
  //  상처 자국 재질만은 자국마다 새로 만들어 다시 안 쓰니 푼다 — 자국 그림은 종류별로 같이 써서 둔다)
  //  흩어지던 칼·투구·판금 조각과 벗겨진 케틀햇은 캐릭터 그룹 밖(장면)에 있어서 따로 치운다 (두 번 불러도 괜찮다)
  clearFlying();
  for (const g of fighterMeshes) {
    scene.remove(g);
    g.traverse((o) => o.geometry?.dispose());
    disposeDecals(g);
  }
  fighterMeshes.length = 0;
  if (world) world.free();
  if (eventQueue) eventQueue.free();
  particles.clear();
  reviveFx.reset();

  world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = 6;
  eventQueue = new RAPIER.EventQueue(true);
  colliderInfo = new Map();

  // 바닥 + 원형 경계 벽 (보이지 않는 벽: 눈에 보이는 건 대리석 테두리)
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  const n = 32;
  const R = ARENA.radius + 0.25;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const half = R * Math.tan(Math.PI / n) + 0.05;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.2, 0.6, half)
        .setTranslation(Math.cos(a) * R, 0.6, Math.sin(a) * R)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setCollisionGroups(GROUND_GROUPS),
      ground,
    );
  }

  const before = new Set(scene.children);
  const foeWeapon = foeWeaponId;
  player = new Fighter(RAPIER, world, scene, colliderInfo, {
    index: 0,
    name: '나',
    x: -ARENA.startGap / 2,
    heading: 0,
    look: LOOKS.player,
    weapon: weaponId,
    ...testRoute.player, // ?hero=<인물 id>: 겉모습·이름만 그 인물 (유파·비기는 무기를 따른다)
  });
  let enemyLook = currentFoe ? currentFoe.look : LOOKS.enemy;
  if (currentFoe) {
    const overrideVersion = (lookPreviewId === currentFoe.id && lookPreviewVersion) || lookvVersion;
    if (overrideVersion) enemyLook = getLook(currentFoe.id, overrideVersion) || enemyLook;
  }
  enemy = new Fighter(RAPIER, world, scene, colliderInfo, {
    index: 1,
    name: currentFoe ? currentFoe.name : '상대',
    x: ARENA.startGap / 2,
    heading: Math.PI,
    look: enemyLook,
    weapon: foeWeapon, // prepareRound 가 정한 상대 무기
    revive: currentFoe?.revive, // 부활 (이졸데: 처음 죽으면 한 번 다시 일어선다, src/revive.js)
  });
  // 진짜 엑스칼리버의 기운 (보여 주기만)
  for (const a of auras) a.dispose();
  auras = [player, enemy].map(attachAura).filter(Boolean);
  for (const c of scene.children) if (!before.has(c)) fighterMeshes.push(c);
  const fxWarm = fxWarmers(); // 싸움 도중 처음 나오는 효과의 셰이더 예열용 (부활 빛 예열에 같이 넣고, 판 끝에 warmRoundFx)
  if (enemy.revive) {
    // 부활하는 상대: 빛 하나가 더해진 셰이더를 지금(메뉴·카드가 가리는 동안) 만들어 둔다 — 빛이 내려오는 순간 멈칫하지 않게.
    //  캐릭터 조명이 새 재질을 먼저 고쳐 놓아야(셰이더가 달라진다) 그 셰이더가 준비된다. 예열용 자국·톱니 면도 잠깐 붙여 같이 만든다
    withWarmers(fxWarm, () => {
      fighterLight.update(fighterMeshes);
      reviveFx.warm();
    });
  }
  const madEyes = attachMadEyes(enemy, currentFoe?.eyes === 'madGlow' || params.has('madEyes')); // 광기의 붉은 안광 (외형 PM, mad_eyes.js — 캐릭터 항목 eyes: 'madGlow' / 시험 ?madEyes=1). 잔상은 장면에 두므로 fighterMeshes 뒤에
  if (madEyes) auras.push(madEyes);
  for (const f of [player, enemy]) { const h = attachHands(f); if (h) auras.push(h); } // 벙어리장갑 손 (외형 PM, hands.js — 겉모습만)
  swordTrails.attach([player, enemy]); // 칼 잔상 띠: 이번 판 두 검객 (지난 띠는 지운다)
  if (player.weapon?.gun || enemy.weapon?.gun) warmGunFx(renderer, camera); // 권총 효과 재질을 지금 무대 빛으로 미리 컴파일 (첫 발 멈칫 방지)
  // 캐릭터를 골랐으면 그 캐릭터가 설계된 난이도(level)와 성격(persona)을 그대로 쓴다.
  //  캐릭터가 없으면(기본 상대) 예전처럼 메뉴의 난이도 설정 + 무작위 성격을 쓴다
  //  캐릭터가 평소와 다른 무기를 들었으면(브란의 주워 온 칼) 유파 꾸러미도 그 무기 것으로 (없으면 롱소드 기본)
  const persona = currentFoe && foeWeapon !== currentFoe.weapon ? { ...currentFoe.ai.persona, school: foeWeapon } : currentFoe?.ai.persona;
  ai = currentFoe ? new AI(enemy, player, currentFoe.ai.level, persona) : new AI(enemy, player, settings.difficulty);
  playerSecret = new PlayerSecretWatch(player, enemy); // 내 무기 유파의 비기 (스위치 끔·무유파·권총이면 S = null — 아무 일도 없다)
  secretSlow = 0;
  secretBurstsSeen = 0;
  secretOpenSeen = 0;
  secretArcSeen[0] = player?.instantArc?.id ?? 0;
  secretArcSeen[1] = enemy?.instantArc?.id ?? 0;
  camSwing.t = -1;
  // 플레이어 감정 (emotions.js): 상대 AI와 같은 규칙으로 겁먹고 화내고 물고 늘어진다. ?emo=0 이면 끔, ?emo=0.5 면 문턱값 셋 다 0.5
  const emoParam = params.get('emo');
  const emoTh = emoParam === '0' ? 0 : emoParam ? +emoParam || 0.3 : 0.3;
  playerEmo = new Emotions({ fearful: emoTh, angry: emoTh, dogged: emoTh });
  playerEv = { hurt: false, parried: false, landed: false };
  player.emoMods = playerEmo.mods;
  player.skill.level = +settings.skill;
  player.skill.corr = CONFIG.SKILL.corr; // 플레이어 보정 = 새 보정 하나 (Skill 생성자도 같은 값을 읽는다. 설정·주소 스위치 없음, 디렉터 결정 10/1 22:05)
  player.skill.corrTip = CONFIG.SKILL.corrTip; // 끝점 겨눔 ② 끔 (같은 결정)
  player.skill.autoGuard = true; // 베고 나면 기본 자세로 돌아간다 (AI는 스스로 자세를 고른다)
  player.canShove = true; // 근접 밀치기: 플레이어는 스틱으로 (CLOSE.on 이 통째로 끄고 켠다)
  combat = new Combat(colliderInfo, { onWound, onClash });
  // 몸 소리(발소리·쓰러짐·무기 부러짐·죽음 목소리): 캐릭터마다 목소리가 다르다
  const foeVoice = voiceOf(currentFoe);
  bodySounds = [new BodySounds(sound, player, 'player', true), new BodySounds(sound, enemy, foeVoice)];
  sound.resetRound();
  sound.roundStart(); // 대성당: 판이 시작될 때 파이프 오르간이 한 번 울린다
  roundOver = false;
  roundOverTime = 0;
  camFollow.copy(player.pelvisPos);
  hitStop = 0;
  // 시간이 흐르기 전에도(무기 뽑기 동안) 선 자세 그대로 보이게 겉모습을 몸에 맞춰 둔다
  player.syncMeshes();
  enemy.syncMeshes();
  warmRoundFx(fxWarm); // 판 도중 처음 나오는 효과(자국·잔상·입자·칼 조각)의 셰이더 (판의 난수를 다 쓴 뒤 — 그리기 전과 같은 순서)
}

// ── 타격감 ──
let hitStop = 0; // 큰 타격 때 아주 잠깐 멈칫하는 연출
let playerEmo = null; // 플레이어 감정 판정 (emotions.js)
let playerEv = { hurt: false, parried: false, landed: false }; // 이번 프레임에 플레이어에게 일어난 사건
const playerTremor = { x: 0, y: 0, ax: 0, ay: 0, t: 0 }; // 공포 손 떨림 (지금 얹혀 있는 값·시계)
let clashCooldown = 0;
let clashStopCooldown = 0; // 칼끼리 부딪혀 멈칫한 뒤 다시 멈칫하기까지 (초)
let slowMo = 0; // 결정타 슬로모션 남은 시간
// 플레이어 비기 (10/9 23:5x — docs/strike/player_secret_2026-10-09.md): 창(PlayerSecretWatch — 판마다 새로) · 결정타 연출 시계 · 본 터뜨림 수 · 본 창 수
let playerSecret = null;
let secretSlow = 0;
let secretBurstsSeen = 0;
let secretOpenSeen = 0;
// 비기 화면 연출 (10/10 발도 섬광 · 이베리아 카메라): 본 잔상 수 · 카메라 돌림 { t, sign }
const secretArcSeen = [0, 0];
const camSwing = { t: -1, sign: 1 };
const flashEl = document.createElement('div');
flashEl.id = 'secretFlash';
flashEl.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:5;transition:opacity .12s ease-out';
document.body.appendChild(flashEl);
/** 비기 화면 연출: 새 발도 잔상이면 아주 짧게 화면 번쩍(설정 '비기 화면 번쩍임'), 새 이베리아 휩쓸기면 카메라를 사이드스텝 쪽으로 (설정 '비기 카메라 연출') */
function watchSecretFx() {
  [player, enemy].forEach((f, i) => {
    const A = f?.instantArc;
    if (!A || A.id === secretArcSeen[i]) return;
    secretArcSeen[i] = A.id;
    if (A.kind === 'iai' && settings.secretFlash) {
      flashEl.style.transition = 'none';
      flashEl.style.opacity = '0.32';
      requestAnimationFrame(() => {
        flashEl.style.transition = 'opacity .12s ease-out';
        flashEl.style.opacity = '0';
      });
    }
    if (A.kind === 'sweep' && settings.secretCam && A.side) {
      // 사이드스텝 쪽 = 카메라 오른쪽(+) 또는 왼쪽(−)
      const right = { x: -camDir.z, z: camDir.x };
      camSwing.sign = A.side[0] * right.x + A.side[2] * right.z >= 0 ? 1 : -1;
      camSwing.t = 0;
    }
  });
}

// 디버그용 통계 (브라우저 콘솔에서 game.stats 로 확인)
const stats = { hits: [], clashes: 0, simTime: 0, passes: 0 };

/** combat.js가 상처를 만들 때마다 부른다: 피, 자국, 소리, 진동, 멈칫 */
function onWound(att, vic, r, point, pr) {
  if (vic === player) playerEv.hurt = true; // 감정 사건: 베였다
  if (att === player) playerEv.landed = true; // 감정 사건: 맞혔다
  const tag = `${att.name}->${r.zone}:${r.type}${r.pass ? '(관통)' : ''} ${r.energy.toFixed(0)}J 심각도${r.severity.toFixed(2)}`;
  stats.hits.push(tag);
  if (r.pass) stats.passes++;
  const e = r.energy;
  const opened = r.type !== 'blunt' && r.severity > 0;
  // 피: 벤 방향으로 흩뿌림
  if (opened) particles.blood(point, r.dir, 6 + r.severity * 40, r.speed);
  // 흔적 (몸 표면에 붙어서 같이 움직인다)
  const mesh = vic.partMesh[pr.v.part];
  const group = vic.groups[pr.v.part];
  if (mesh && group) {
    // 몸 기준 좌표 → 겉면 메쉬 기준 좌표 (팔처럼 겉모습이 따로 돌려진 부위가 있다)
    group.updateMatrixWorld(true);
    const toMesh = new THREE.Matrix4().copy(mesh.matrixWorld).invert().multiply(group.matrixWorld);
    const local = r.local.clone().applyMatrix4(toMesh);
    const q = new THREE.Quaternion();
    const rr = pr.v.body.rotation();
    q.set(rr.x, rr.y, rr.z, rr.w).invert();
    const bladeLocal = r.bladeAxis.clone().applyQuaternion(q).transformDirection(toMesh);
    const clothed = r.zone !== 'head' && r.zone !== 'neck';
    const sev = r.severity;
    // 투구·판금: 긁힘, 세면 찌그러짐 (벗겨지거나 부서지면 조각과 함께 날아간다).
    //  조각 투구(마르그레테)는 사발 조각 메쉬에, 판금은 그 부위에서 맞은 곳에 가장 가까운 판금 메쉬에 붙인다
    const steel = r.helmet && vic.helmetGroup ? (vic.helmetGroup.userData.pieces?.bowl ?? vic.helmetGroup).children[0] : r.plate ? vic.plateMeshNear(pr.v.part, r.local) : null;
    if (steel?.geometry) {
      const p = r.local.clone().applyMatrix4(new THREE.Matrix4().copy(steel.matrixWorld).invert().multiply(group.matrixWorld));
      stickDecal(steel, p, bladeLocal, 'scratch', 0.03, Math.min(0.16, 0.04 + e / 1200));
      if (e > 60) stickDecal(steel, p, null, 'dent', 0.03 + Math.min(0.05, e / 4000), 0.03 + Math.min(0.05, e / 4000));
    } else if (!opened) {
      if (e > 15) stickDecal(mesh, local, null, 'bruise', 0.05 + Math.min(0.08, e / 1500), 0.05 + Math.min(0.08, e / 1500));
    } else if (settings.blood) {
      const len = Math.min(0.24, 0.06 + sev * 0.14);
      if (r.type === 'stab') stickDecal(mesh, local, null, 'stab', 0.05 + sev * 0.02, 0.05 + sev * 0.02);
      else stickDecal(mesh, local, bladeLocal, clothed ? 'tear' : 'cut', 0.035 + Math.min(0.03, sev * 0.02), len);
      // 피가 옷에 번진다 (상처에서 계속 흐르는 만큼)
      const wound = vic.wounds.findLast((w) => !w.stump); // 참수: 목 단면(stump)은 건너뛰고 목 상처에 번진다
      if (wound && wound.part === pr.v.part && !wound.soak) wound.soak = stickDecal(mesh, local, null, 'soak', 0.04, 0.04);
    } else {
      stickDecal(mesh, local, bladeLocal, 'bruise', 0.03, 0.08);
    }
  }
  if (opened) att.bloodyBlade(0.08 + r.severity * 0.15);
  // 소리: 투구는 투구 소리. 판금은 전투 판정(r.plate — 아직 붙어 있는 판이 덮은 곳을 맞았다)을 따른다:
  //  날이 들지 못했으면 판금이 막는 소리(때린 무기 재질대로), 판을 뚫고 들어갔으면 강철 소리 한 번 (살 소리는 아래에서 따로)
  //  불꽃: 막혔으면 더 많고, 판을 뚫고 들어가도 강철을 긁은 불꽃이 조금 튄다 (ARMOR 를 켰을 때만 — 끄면 예전 그대로)
  const mat = att.weapon?.material || 'steel';
  if (r.helmet) sound.helmet(e);
  else if (r.plate) {
    if (opened) sound.impact({ a: mat, b: 'armor', energy: e * 0.8 });
    else sound.plateBlock(e, { material: mat });
  }
  if ((r.helmet || r.plate) && CONFIG.ARMOR.on && e > 30) particles.sparks(point, Math.min(10, e / 20) * (opened ? 0.5 : 1));
  // 이번 타격에 판금 부위나 투구가 완전히 부서졌으면(fighter.applyWound 가 표시한다) 깨지는 소리를 한 번
  if (vic.armorBroke) {
    vic.armorBroke = false;
    sound.plateBreak(e);
  }
  if (r.type === 'cut') sound.cut(e, r.pass);
  else if (r.type === 'stab' && opened) sound.stab(e); // 날이 들지 못한 내려찍기 즉사 찌르기(r.finish, 심각도 0)는 막힌 타격 소리
  else sound.blunt(e);
  if (e > 70 && (r.zone === 'head' || r.zone === 'arm' || r.zone === 'leg') && !r.helmet && !r.plate) sound.bone(e);
  // 멈칫: 재질에 따라. 살을 깨끗이 가르면 짧게, 박히거나 뼈·투구에 걸리면 길게 (최대 0.1초 — 조작이 늦게 느껴지지 않게)
  const bone = e > 70 && (r.zone === 'head' || r.zone === 'arm' || r.zone === 'leg');
  const stopT = r.pass ? Math.min(0.06, e / 2000) : r.stuck || bone || r.helmet || r.plate ? Math.min(0.1, e / 900) : Math.min(0.08, e / 1200);
  hitStop = Math.max(hitStop, stopT);
  // 손맛: 칼의 타격 중심(스위트 스팟, 코등이에서 약 58cm)에 맞으면 손이 울리지 않고, 칼끝·칼 밑동에 맞으면 손이 찌릿하다
  //  (손을 축으로 도는 강체에서 한 점을 치면 축(손)이 받는 충격 = 1 − a·b/k²)
  const sting = att.swordSting(r.t);
  // 카메라가 칼이 지나간 방향으로 밀린다 (내가 맞으면 더 크게, 내가 칠 땐 손이 받은 충격만큼)
  kickCamera(r.dir, Math.min(1.6, e / 120) * (vic === player ? 1.4 : 0.4 + 0.4 * sting));
  if (vic === player) haptic(e / 120);
  else if (att === player) haptic((e / 120) * (0.4 + 0.6 * sting));
  if (!vic.alive) slowMo = 1.6;
  arena.excite(vic.alive ? Math.min(0.6, e / 250) : 1); // 떠다니던 먼지가 흩날린다
  sound.gust(vic.alive ? Math.min(0.6, e / 250) : 1); // 산사: 단풍잎 바스락 + 솔바람 + 풍경
}

function onClash(point, speed, touch) {
  if (touch?.fresh && touch.vn > 3 && player?.alive && player.tipVel.length() > 6) playerEv.parried = true; // 감정 사건: 내 베기가 막혔다
  // 소리: 새로 부딪힌 순간(또는 맞댄 채 다시 세게 친 순간)에만 "쨍". 맞댄 채 미끄러지는 동안은 긁히는 소리(updateBindSound)
  //  touch.vn = 부딪히기 직전 맞닿는 방향 속도(부딪히는 세기), touch.vt = 칼날을 따라 스치는 속도 (combat.js bladeClash)
  if (touch && (touch.fresh || touch.vn > 3)) {
    // 두 무기의 재질이 둘 다 강철이면 칼끼리 "쨍", 아니면 재질에 맞는 소리 (나뭇가지 "딱", 광검 "파직", 고무 닭 "삑", 언 참치 "텅")
    const ma = player?.weapon?.material || 'steel';
    const mb = enemy?.weapon?.material || 'steel';
    if (ma === 'steel' && mb === 'steel') sound.clash(touch.vn, touch.vt);
    else sound.impact({ a: ma, b: mb, energy: 12 * touch.vn });
  }
  // 연출의 세기는 "부딪히기 직전" 속도로 정한다 (부딪힌 뒤 속도엔 튕겨 나온 몫이 섞여 있다)
  const impact = touch ? (touch.fresh || touch.vn > 3 ? touch.vn : 0) : speed;
  if (clashCooldown > 0) return;
  if (impact < 2.5) {
    // 세게 부딪히진 않았지만 칼날을 따라 빠르게 긁으면 불꽃만 조금
    if (touch && touch.vt > 5) {
      clashCooldown = 0.12;
      particles.sparks(point, touch.vt * 0.4);
    }
    return;
  }
  clashCooldown = 0.09;
  stats.clashes++;
  particles.sparks(point, impact);
  // 세게 부딪힐 때만 잠깐 멈칫 (칼끼리 맞대고 밀 때마다 멈추면 끊겨 보인다)
  if (impact > 6 && clashStopCooldown <= 0) {
    hitStop = Math.max(hitStop, Math.min(0.08, impact / 200));
    clashStopCooldown = 0.5;
  }
  kickCamera(new THREE.Vector3((Math.random() - 0.5), 0.3, (Math.random() - 0.5)).normalize(), Math.min(0.6, impact / 25));
  haptic(Math.min(1, impact / 15));
}

// 칼을 휘두르면 바람 소리 (칼마다 하나씩 계속 돌면서 칼끝 속도를 따라간다)
const whooshState = new Map();
function updateWhoosh(f, dt) {
  // 판이 바뀌어도 같은 소리 고리를 다시 쓴다 (나/상대 한 개씩)
  let st = whooshState.get(f.index);
  if (!st) whooshState.set(f.index, (st = { loop: null }));
  // 판마다 무기가 바뀐다: 재질이 달라지면 고리를 새로 만든다 (광검은 늘 "웅" 소리가 함께 돈다)
  const mat = f.weapon?.material || 'steel';
  if (st.loop && st.mat !== mat) {
    st.loop.stop?.();
    st.loop = null;
  }
  if (!st.loop) {
    st.loop = sound.whooshLoop(mat);
    st.mat = mat;
  }
  st.loop?.set(f.armed ? f.tipVel.length() : 0);
}
/** 싸움 화면이 아닐 때(메뉴·일시정지)는 바람 소리·긁는 소리를 끈다 */
function muteWhoosh() {
  for (const st of whooshState.values()) st.loop?.set(0);
  sound.scrape(0, 0);
}
// 칼끼리 맞대고 밀며 미끄러지는 동안 계속 나는 "지이익" (바인드)
function updateBindSound() {
  const b = combat.bladeContact;
  const steel = (player?.weapon?.material || 'steel') === 'steel' && (enemy?.weapon?.material || 'steel') === 'steel';
  if (combat.binding && steel) sound.scrape(b.slide, b.press); // 쇠끼리 긁히는 "지이익"은 강철끼리만
  else sound.scrape(0, 0);
}

// 상처에서 떨어지는 핏방울
const _wp = new THREE.Vector3();
function updateDrips(f, dt) {
  for (const w of f.wounds) {
    // 옷에 번지는 핏자국: 흘린 피만큼 커진다 (가끔씩 다시 투사)
    if (w.soak) {
      w.soaked = (w.soaked || 0) + w.bleed * dt;
      const size = Math.min(0.26, 0.04 + Math.sqrt(w.soaked) * 0.9);
      if (size > w.soak.userData.w * 1.12) rebuildDecal(w.soak, size, size * 1.3);
    }
    if (w.bleed < 0.001) continue;
    if (Math.random() < w.bleed * dt * 900) {
      const g = f.groups[w.part];
      if (g) particles.drip(g.localToWorld(_wp.copy(w.local)));
    }
  }
}

// ── UI ──
const $ = (id) => document.getElementById(id);
const menu = $('menu');
const hud = $('hud');
const topButtons = $('topButtons');
const toast = $('toast');
const hint = $('hint');
attachStick(input, $('moveStick'), $('moveKnob'));
let state = 'menu'; // menu | fight | paused
let roundOver = false;
let roundOverTime = 0;
let resultShown = false; // 판 끝 결과 글자("승리"/"패배")를 띄웠나 — 결정타 슬로모션(slowMo)이 끝난 뒤에 띄운다

$('howto').innerHTML = input.isTouchDevice
  ? '<li>화면을 손가락으로 끌면 칼이 따라 움직여요. 좌우로 끌면 가로베기, 위아래로 끌면 내려치기.</li><li>폰을 앞뒤로 기울이면 전진·후퇴, 좌우로 기울이면 옆걸음.</li><li>◎ 버튼: 지금 각도를 ‘똑바로’로 다시 맞춰요.</li><li>칼을 빠르게 휘둘러야 세게 들어가요. 머리가 약점이에요.</li>'
  : '<li>화면을 클릭하면 마우스가 잠기고, 마우스로 칼을 휘둘러요.</li><li>WASD 또는 방향키로 걸어요.</li><li>Esc로 마우스 잠금을 풀고, P로 일시정지해요.</li><li>칼을 빠르게 휘둘러야 세게 들어가요. 머리가 약점이에요.</li>';

// 기울기 센서를 못 쓸 때의 임시 대체(이번 실행에만): 저장된 선호(settings.moveMode)는 덮어쓰지 않는다 — 다음에 센서가 되면 기울기로 돌아온다 (10/8 입력 수명주기)
let sensorMoveFallback = null;
const moveModeValue = () => sensorMoveFallback ?? settings.moveMode;
function refreshSettingsUI() {
  document.querySelectorAll('[data-setting]').forEach((el) => {
    const key = el.dataset.setting;
    if (el.classList.contains('seg')) {
      const cur = key === 'moveMode' ? moveModeValue() : settings[key];
      el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === cur));
    } else {
      el.classList.toggle('on', !!settings[key]);
    }
  });
  particles.bloodOn = settings.blood;
  sound.on = settings.sound;
  input.invertTilt = settings.invertTilt;
  input.useTilt = moveModeValue() === 'tilt';
  document.body.classList.toggle('touch', input.isTouchDevice);
  document.body.classList.toggle('moveStick', moveModeValue() !== 'tilt');
  applyMoveMode();
}
document.querySelectorAll('[data-setting]').forEach((el) => {
  const key = el.dataset.setting;
  if (el.classList.contains('seg')) {
    el.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        settings[key] = b.dataset.v;
        if (key === 'moveMode') { sensorMoveFallback = null; input.resetTransient(); } // 사용자가 직접 고르면 임시 대체를 푼다
        if (key === 'difficulty' && ai && !currentFoe) ai.setLevel(settings.difficulty); // 캐릭터를 골랐으면 그 캐릭터의 난이도를 따로 지킨다
        if (key === 'skill' && player) player.skill.level = +settings.skill;
        saveSettings();
        refreshSettingsUI();
      }),
    );
  } else {
    el.addEventListener('click', () => {
      settings[key] = !settings[key];
      saveSettings();
      refreshSettingsUI();
      if (key === 'pixel') resize();
    });
  }
});
refreshSettingsUI();

// ── 화면 글자 시계 (10/10 글자 체계 — docs/ui/hud_type_system_2026-10-10.md §7): 판 알림·안내·소개·감정 줄을 게임 시간으로 센다 ──
//  예전엔 벽시계(setTimeout)라 일시정지해도 혼자 사라졌다. 게임 루프가 싸움·무기 뽑기 동안만 tickHudTimers(dt) 를 부른다 (일시정지·메뉴면 같이 멈춘다)
const hudTimers = new Map(); // 열쇠 → { t 남은 초, fn }
/** sec 초(게임 시간) 뒤에 fn. 같은 열쇠는 새것이 덮는다. fn 없이 부르면 지운다 */
function hudLater(key, sec, fn) {
  if (fn && sec > 0) hudTimers.set(key, { t: sec, fn });
  else hudTimers.delete(key);
}
function tickHudTimers(dt) {
  for (const [k, v] of hudTimers) {
    v.t -= dt;
    if (v.t <= 0) {
      hudTimers.delete(k);
      v.fn();
    }
  }
  tickEmoMsg(dt);
}

let lastFoeLine = ''; // 이번 판 끝에 상대가 한 말 (결과 화면에도 적는다)
/** 상대의 한마디 (승리 대사): 소개 칸을 다시 써서 이름 + 대사만 잠깐 보여 준다 */
function showFoeLine(ch, line) {
  lastFoeLine = line;
  if (!line) return;
  const el = $('foeIntro');
  el.querySelector('b').textContent = ch.name;
  el.querySelector('i').textContent = '';
  el.querySelector('span').textContent = `“${line}”`;
  el.querySelector('em').textContent = '';
  el.classList.add('show');
  hudLater('foeIntro', 3.4, () => el.classList.remove('show'));
}

// 이번 상대 소개 (이름 · 별명 · 한마디). 큰 글씨 알림(toast)과 따로, 작게 보여 준다.
//  아랫줄(em)은 무기 뽑기에서 카드를 고르는 동안만 "무기 카드를 한 장 고르세요". 무기 이름은 글로 적지 않는다
//  (대사와 겹쳐 읽기 어렵다는 오너 의견: 내 무기와 상대 무기는 카드 두 장이 보여 준다)
function showFoeIntro(ch) {
  const el = $('foeIntro');
  hudLater('foeIntro');
  if (!ch) return el.classList.remove('show');
  el.querySelector('b').textContent = ch.name;
  el.querySelector('i').textContent = ch.epithet;
  { const line = randomLine(ch, 'intro'); el.querySelector('span').textContent = line ? `“${line}”` : ''; } // 시작 대사 3종 중 하나 (대사가 없는 인물은 빈칸)
  el.querySelector('em').textContent = '';
  el.classList.add('show');
}

// ── 무기 뽑기: 판이 열리면 엎어 둔 카드 세 장. 왼쪽 두 장이 내 카드, 맨 오른쪽은 상대 무기 칸(회색, 고를 수 없다) ──
//  내 카드 하나를 누르면(PC는 1·2 키도) 뒤집혀 이번 판 내 무기가 나오고(0.45초), 0.35초 뒤 남은 내 카드가 어둡게 뒤집혀
//  무엇을 놓쳤는지 보여 준다. 0.8초에 상대 카드가 뒤집혀 제 색으로 상대 무기를 보여 준다 (prepareRound 가 정한 무기).
//  두 무기를 읽을 만큼 잠깐 더 보여 주고(상대 카드가 뒤집힌 뒤에 누르면 바로) 카드가 사라지면 무기가 손에 나타나고 "Battle".
//  고른 때부터 싸움까지 약 2.4초.
//  고르는 동안 싸움은 멈춰 있다: 판은 임시 무기(롱소드)로 세워 두기만 하고(물리·AI 없음, 무기는 감춤),
//  카드를 고르면 그 무기로 판을 새로 세운다. 순서는 게임 루프의 시간으로 재서 일시정지하면 함께 멈춘다.
//  카드 뒤집기·사라지기는 CSS 변환(transform)으로만 움직인다 (매 프레임 JS 로 그리지 않는다).
// 등급과 별개로 따로 대접하는 무기 카드 (금빛 일렁임·센 떨림). 오너 결정: "엑스칼리버를 등급과 별개로 우대할 필요는 없어" → 비워 둔다
const GRAND_WEAPONS = new Set();
const TIER_KO = TIER_LABEL; // 카드의 등급 글자 (??? 등급 포함, weapons.js)
const FOE_CARD = 2; // 맨 오른쪽 카드 = 상대 무기 칸
// 초 (고른 때부터). others: 남은 내 카드가 뒤집힘, foe: 상대 카드가 뒤집힘 (+0.45초면 다 뒤집힌다),
//  build: 고른 무기로 판을 새로 세움 (상대 카드가 다 뒤집힌 뒤, 아무것도 움직이지 않을 때), look: 사라지기 시작, fly: 사라지는 시간.
//  tapGuard 전의 누름은 버린다 (카드를 두 번·세 번 톡 친 손가락이 상대 카드가 뒤집히기도 전에 결과를 건너뛰지 않게).
//  그 뒤에 누르면(스페이스·엔터도) 남은 보여 주기를 건너뛰지만, 상대 무기가 잠깐은 보이도록 skip 전에는 사라지지 않는다
const DRAW_T = { ready: 0.45, others: 0.35, foe: 0.8, tapGuard: 0.95, build: 1.3, skip: 1.6, look: 2.3, fly: 0.45 }; // look 2.3: 상대 무기를 약 1초 읽게
const drawEl = $('draw');
const cardEls = [...drawEl.querySelectorAll('.wcard')];
// ── 카드 뒷면 ──
//  오너 결정: 픽셀 아트 뒷면(외형 PM v3, docs/design_language.md). 판마다 그 판 배경의 문양이다 — 포세이돈 신전·성 안뜰·산사·대성당.
//  조각(tile·frame·center·plaque, public/ui/cardbacks/px_<테마>_*.png)을 한 칸 = --px(게임 픽셀)로 정수 배 확대해 붙인다(index.html).
//  상대 칸은 회색 조각(_foe, tools/cardbacks/grey_foe.py)이다. 테마가 없는 배경(어두운 홀)은 classic(가죽 빛 바탕 + 마름모 칼 문장).
//  주소 ?back=<테마|classic> 으로 고정해 볼 수 있다
const PX_BACKS = { poseidon: '#1d3037', clearing: '#1a1816', castle: '#1e2433', temple: '#1a352b', poseidon_night: '#0c1220', cathedral: '#2b171a', loggia: '#302326', corsair: '#19383e', sacred_grove: '#1c3025' }; // 테마 → 바탕색 (뒤 셋은 샛별 저장소의 무대)
const BACK_PARTS = ['tile', 'frame', 'center', 'plaque'];
const BACK_PIN = params.get('back') in PX_BACKS || params.get('back') === 'classic' ? params.get('back') : null;
let cardBack = 'classic';
// 조각을 미리 받아 둔다(모두 합쳐 몇 KB): 카드가 뜰 때 뒷면이 비었다가 그려지지 않게
for (const t in PX_BACKS) for (const p of BACK_PARTS) for (const f of ['', '_foe']) new Image().src = `ui/cardbacks/px_${t}_${p}${f}.png`;
// 상대 칸 바탕색: CSS grayscale(1) brightness(.55) 와 같은 회색
const greyOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const v = Math.round((0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) * 0.55);
  return `rgb(${v},${v},${v})`;
};
const CARD_BACK_SVG =
  '<svg viewBox="0 0 60 100" aria-hidden="true"><path d="M30 3 L57 50 L30 97 L3 50 Z" fill="none" stroke="#d9a441" stroke-opacity=".75" stroke-width="2"/>' +
  '<path d="M30 11 L52 50 L30 89 L8 50 Z" fill="none" stroke="#d9a441" stroke-opacity=".35" stroke-width="1"/>' +
  '<path d="M30 18 L32.6 24 L32.6 60 L27.4 60 L27.4 24 Z" fill="#e8d3a0"/><rect x="19" y="60" width="22" height="3.6" rx="1.8" fill="#d9a441"/>' +
  '<rect x="28.3" y="63.6" width="3.4" height="12" fill="#8a5a2b"/><circle cx="30" cy="79" r="3.6" fill="#d9a441"/></svg>';
// 상대 칸의 칼 문장은 회색으로 (filter 를 쓰지 않는다: 뒤집히는 카드의 뒷면 숨기기가 사파리에서 풀릴 수 있다)
const CARD_BACK_SVG_FOE = CARD_BACK_SVG.replaceAll('#d9a441', '#86817a').replaceAll('#e8d3a0', '#a9a49c').replaceAll('#8a5a2b', '#55514c');
/** 판을 열 때: 그 판 배경의 뒷면으로 바꾼다 (카드마다 조각 그림을 --b-* 변수로 넣는다) */
function setCardBack(stageId) {
  cardBack = BACK_PIN || (stageId in PX_BACKS ? stageId : 'classic');
  drawEl.dataset.back = cardBack === 'classic' ? 'classic' : 'px';
  cardEls.forEach((el, i) => {
    const foe = i === FOE_CARD;
    const wb = el.querySelector('.wback');
    if (cardBack !== 'classic') {
      for (const p of BACK_PARTS) wb.style.setProperty(`--b-${p}`, `url("ui/cardbacks/px_${cardBack}_${p}${foe ? '_foe' : ''}.png")`);
      wb.style.setProperty('--b-bg', foe ? greyOf(PX_BACKS[cardBack]) : PX_BACKS[cardBack]);
    }
    // 뒷면 배지: 내 카드는 (PC) 누를 키 번호, 상대 칸은 "상대" (폰에서도 보인다)
    const emblem = cardBack === 'classic' ? (foe ? CARD_BACK_SVG_FOE : CARD_BACK_SVG) : '';
    wb.innerHTML = emblem + (foe ? '<span class="wkey wfoe">상대</span>' : `<span class="wkey">${i + 1}</span>`);
  });
}
const draw = { stage: null, t: 0, ids: [], pick: -1, others: false, foe: false, built: false, skip: false, hold: false }; // stage: choose → reveal → fly
setCardBack(stages.id);
cardEls.forEach((el, i) => el.addEventListener('click', () => pickCard(i)));
// 결과를 보는 동안 아무 데나 누르면 바로 싸움으로 (상대 카드가 뒤집히기 전의 누름은 치지 않고, 상대 무기가 잠깐 보인 뒤에 사라진다)
function skipReveal() {
  if (draw.stage === 'reveal' && draw.t >= DRAW_T.tapGuard) draw.skip = true;
}
/** 상대 칸을 눌렀다: 고를 수 없다는 뜻으로 살짝 흔들기만 한다 (고르는 동안만) */
function nudgeFoeCard() {
  if (state !== 'draw' || draw.stage !== 'choose') return;
  const el = cardEls[FOE_CARD];
  el.classList.remove('nope');
  void el.offsetWidth; // 흔들기 애니메이션을 처음부터 다시
  el.classList.add('nope');
}
cardEls[FOE_CARD].addEventListener('animationend', (e) => e.animationName === 'nope' && cardEls[FOE_CARD].classList.remove('nope'));
drawEl.addEventListener('pointerdown', skipReveal);
window.addEventListener('resize', () => layoutDraw()); // 폰을 돌리거나 전체화면이 되면 카드 크기를 다시 맞춘다

/**
 * 두 사람의 무기를 감추거나 보인다 (카드를 고르기 전에는 손에 칼이 보이면 안 된다).
 *  메쉬만 끄고 켠다: 원래 숨겨 둔 물리 전용 부품은 그대로 두고, 무기에 달린 빛(진짜 엑스칼리버의 aura.js)은 켜 둔다 —
 *  빛 개수가 바뀌면 모든 재질의 셰이더를 다시 만들어, 카드가 사라지는 순간 화면이 멈칫한다.
 */
function setWeaponsVisible(v) {
  for (const f of [player, enemy])
    for (const m of f?.meshes || [])
      if (m.kind === 'weapon')
        m.group.traverse((o) => {
          if (!o.isMesh) return;
          if (!v && o.visible) {
            o.visible = false;
            o.userData.drawHidden = true;
          } else if (v && o.userData.drawHidden) {
            o.visible = true;
            o.userData.drawHidden = false;
          }
        });
}

/** 카드 세 장을 새로 채워 엎어 놓는다: 내 카드 두 장 + 상대 무기 (prepareRound 가 정한 무기) */
function openDraw() {
  const foeId = getWeapon(foeWeaponId).id; // 짧은 별칭(chicken 등)도 상대가 실제로 드는 무기 id 로
  Object.assign(draw, { stage: 'choose', t: 0, ids: [...drawCardIds(), foeId], pick: -1, others: false, foe: false, built: false, skip: false });
  setCardBack(stages.id); // 이번 판 배경의 뒷면
  cardEls.forEach((el, i) => {
    const w = getWeapon(draw.ids[i]);
    el.className = i === FOE_CARD ? 'wcard foe' : 'wcard';
    el.dataset.tier = w.tier || 'common';
    el.classList.toggle('grand', GRAND_WEAPONS.has(w.id));
    el.setAttribute('aria-label', i === FOE_CARD ? '상대 무기 카드 (고를 수 없어요)' : `${i + 1}번 카드`); // 뒤집히면 무기 이름·등급·설명으로 바뀐다 (revealLabel)
    const [, main, sub] = w.nameKo.match(/^(.*?)\s*\((.*)\)\s*$/) || [null, w.nameKo, ''];
    el.querySelector('.wthumb').style.backgroundImage = `url("ui/weapons/${w.id}.webp"), radial-gradient(closest-side, var(--tg), transparent)`;
    el.querySelector('.wname').textContent = main;
    el.querySelector('.wsub').textContent = sub;
    el.querySelector('.wtier').textContent = TIER_KO[w.tier] || TIER_KO.common;
    // 에픽 특수 능력은 설명 끝의 "(별칭: 효과)" 를 따로 한 줄로, 등급 색으로 (weapons.js 가 desc 끝에 붙여 준다)
    const abil = w.ability ? ` (${w.ability})` : '';
    const desc = w.desc || '';
    el.querySelector('.wdesc').textContent = abil && desc.endsWith(abil) ? desc.slice(0, -abil.length) : desc;
    el.querySelector('.wabil').textContent = w.ability ? `(${w.ability})` : '';
  });
  drawEl.className = 'show choose';
  layoutDraw();
}

/** 카드 크기와 자리: 상대 소개 바로 아래부터 화면 아래까지, 세 장이 나란히 들어가게 (판이 열릴 때·화면이 바뀔 때 한 번) */
function layoutDraw() {
  if (!draw.stage) return;
  const intro = $('foeIntro');
  const introBottom = intro.classList.contains('show') ? intro.getBoundingClientRect().bottom : topButtons.getBoundingClientRect().bottom;
  drawEl.style.setProperty('--top', `${Math.round(introBottom + 10)}px`);
  const row = drawEl.querySelector('.drawRow').getBoundingClientRect();
  // 세로로 든 폰(좁고 높은 자리): 카드가 좁고 길어진다. 좁아도 낮은 자리(작은 가로 폰 568×320 등)는 가로 배치가 글이 더 잘 들어간다
  const narrow = row.width < 560 && row.height > row.width * 0.8;
  // 아주 낮은 자리(568×320 같은 작은 가로 폰, 소개가 두 줄일 때): 카드를 옆으로 넓혀(높이보다 넓게) 설명 줄 수를 줄이고,
  //  여백·그림·글자를 최소로 줄인다 (#draw.low)
  const low = !narrow && row.height < 180;
  const gap = narrow || low ? 10 : 14;
  let cw = Math.floor(Math.min(230, (row.width - 2 * gap) / 3, low ? row.height * 1.3 : row.height / (narrow ? 1.6 : 1.15)));
  let ch = Math.floor(Math.min(cw * (narrow ? 2.1 : 1.5), row.height));
  // 픽셀 뒷면의 한 칸 = 게임 픽셀(픽셀 모드와 같은 크기, 큰 화면은 4까지). 카드 크기를 두 칸의 배수로 맞춰 가운데 정렬이 반 칸 어긋나지 않게
  const px = cw < 130 ? 2 : Math.min(4, Math.max(3, Math.round(window.innerHeight / 180)));
  if (cardBack !== 'classic') {
    cw = Math.floor(cw / (2 * px)) * 2 * px;
    ch = Math.floor(ch / (2 * px)) * 2 * px;
  }
  drawEl.style.setProperty('--px', `${px}px`);
  drawEl.style.setProperty('--gap', `${gap}px`);
  drawEl.style.setProperty('--cw', `${cw}px`);
  drawEl.style.setProperty('--ch', `${ch}px`);
  // 번호 배지(높이 22px)의 가운데: 픽셀 뒷면은 아래 원판(아래에서 3칸 띄운 10칸 원판)의 가운데, classic 은 아래에서 10px
  drawEl.style.setProperty('--kb', cardBack === 'classic' ? '10px' : `${Math.max(4, 8 * px - 11)}px`);
  // 글자 크기 (10/10 글자 체계 두 단계): 큰 카드 = 이름 title 20 · 설명 body 15, 그 밖 = 이름 body 15 · 설명 caption 12
  //  큰 카드 = 폭 205 · 높이 260 이상 (가로 폰 844×390 에서 카드가 230×277 — 소개가 왼쪽 위로 비켜서 커진 카드)
  const big = cw >= 205 && ch >= 260;
  drawEl.style.setProperty('--name', big ? '20px' : '15px');
  drawEl.style.setProperty('--desc', big ? '15px' : '12px');
  drawEl.classList.toggle('wide', big);
  drawEl.classList.toggle('low', low);
  fitCardText(big ? 15 : 12);
}

/** 설명이 긴 카드(건슬링어의 리볼버처럼 인용문이 붙은 것)가 있으면 세 장의 설명 글자를 함께, 그 카드가 들어올 때까지 조금씩 줄인다 (6 % 씩, 바닥 11px — 세 장 크기는 같게) */
function fitCardText(base) {
  const faces = cardEls.map((el) => {
    const face = el.querySelector('.wface');
    const abil = el.querySelector('.wabil');
    const desc = el.querySelector('.wdesc');
    return { face, last: () => (abil.textContent ? abil : desc) };
  });
  // 넘침 = 마지막 글줄의 아래가 카드 안쪽 여백(아래 padding)에서 4px 위(금테에 글자가 물리지 않게)를 넘는다. 앞면은 뒤집혀 있어 화면 좌표 대신 배치 좌표로 잰다
  const over = ({ face, last }) => last().offsetTop + last().offsetHeight > face.clientHeight - parseFloat(getComputedStyle(face).paddingBottom) - 4;
  drawEl.style.setProperty('--desc', `${base}px`);
  for (let k = 1, px = base; k <= 5 && px > 11 && faces.some(over); k++) {
    px = Math.max(11, base * (1 - 0.06 * k));
    drawEl.style.setProperty('--desc', `${px.toFixed(2)}px`);
  }
}

/** i번째 카드를 고른다 (누르기 · 1/2 키). 상대 칸(맨 오른쪽)은 고를 수 없다: 누르면 살짝 흔들릴 뿐 */
function pickCard(i) {
  if (i === FOE_CARD) return nudgeFoeCard();
  if (state !== 'draw' || draw.stage !== 'choose' || draw.t < DRAW_T.ready) return; // 막 뜬 카드는 시작 단추를 두 번 누른 손가락에 안 뽑히게
  Object.assign(draw, { stage: 'reveal', t: 0, pick: i });
  const grand = GRAND_WEAPONS.has(draw.ids[i]);
  cardEls[i].classList.add('picked', 'flipped');
  revealLabel(i);
  drawEl.classList.replace('choose', 'reveal');
  sound.cardFlip({ pick: true, tier: getWeapon(draw.ids[i]).tier, grand }); // 두꺼운 카드 "촥" → 앞면이 드러나며 낮은 "둥" (레전드·에픽은 작은 반짝임)
  haptic(grand ? 1 : 0.35);
  $('foeIntro').querySelector('em').textContent = ''; // "무기 카드를 한 장 고르세요"는 고르는 동안만
}

/** 뒤집힌 카드를 화면 읽기 프로그램이 무기 이름으로 읽게 한다 */
function revealLabel(i) {
  const w = getWeapon(draw.ids[i]);
  const who = i === FOE_CARD ? '상대 무기: ' : i === draw.pick ? '내 무기: ' : '';
  cardEls[i].setAttribute('aria-label', `${who}${w.nameKo} · ${TIER_KO[w.tier] || TIER_KO.common} · ${(w.desc || '').replace(/\n/g, ' ')}`);
}

/** 고른 무기로 판을 새로 세운다 (카드가 가리고 있을 때, 아무것도 움직이지 않는 순간에) */
function buildPicked() {
  draw.built = true;
  lastPlayerWeapon = draw.ids[draw.pick];
  newRound(lastPlayerWeapon);
  setWeaponsVisible(false);
}

/** 게임 루프가 state 'draw' 일 때 부른다: 내 카드 뒤집기 → 남은 내 카드 → 상대 카드 → 결과 보여 주기 → 사라지기 → 싸움 시작 */
function updateDraw(dt) {
  if (!draw.stage || draw.hold) return; // hold: 스크린샷용으로 순서를 잠깐 세운다 (game.draw.hold)
  draw.t += dt;
  if (draw.stage === 'reveal') {
    if (!draw.others && draw.t >= DRAW_T.others) {
      draw.others = true;
      const other = 1 - draw.pick; // 남은 내 카드
      cardEls[other].classList.add('flipped', 'missed');
      revealLabel(other);
      sound.cardFlip({ pick: false }); // 남은 카드가 "촥"
    }
    if (!draw.foe && draw.t >= DRAW_T.foe) {
      // 상대 카드가 뒤집혀 제 색으로 상대 무기를 보여 준다 (소리는 고른 카드처럼: 등급 반짝임, 진짜 엑스칼리버면 맑은 울림)
      draw.foe = true;
      const w = getWeapon(draw.ids[FOE_CARD]);
      const grand = GRAND_WEAPONS.has(w.id);
      cardEls[FOE_CARD].classList.add('flipped');
      revealLabel(FOE_CARD);
      sound.cardFlip({ pick: true, tier: w.tier || 'common', grand });
      haptic(grand ? 1 : 0.25);
    }
    if (!draw.built && draw.t >= DRAW_T.build) buildPicked();
    if (draw.t >= DRAW_T.look || (draw.skip && draw.t >= DRAW_T.skip)) {
      if (!draw.built) buildPicked();
      Object.assign(draw, { stage: 'fly', t: 0 });
      drawEl.classList.add('fly');
      setWeaponsVisible(true); // 카드가 사라지는 동안 칼이 손에 나타난다
    }
  } else if (draw.stage === 'fly' && draw.t >= DRAW_T.fly) {
    closeDraw();
    beginFight();
  }
}

/** 카드를 치운다 (다 끝났을 때, 또는 뽑기 도중에 "처음부터 다시") */
function closeDraw() {
  draw.stage = null;
  drawEl.className = '';
}

function showToast(text, ms = 1200) {
  toast.textContent = text;
  toast.classList.add('show');
  hudLater('toast', ms / 1000, ms ? () => toast.classList.remove('show') : null);
}

// 이동 방식에 맞게 조이스틱 / 영점 버튼을 보이거나 숨긴다
function applyMoveMode() {
  const touch = input.isTouchDevice;
  const tilt = moveModeValue() === 'tilt';
  // 무기 뽑기 동안에는 걸을 수 없으니 조이스틱을 감춘다 (카드 자리도 넓어진다). 싸움이 시작되면 나타난다
  $('moveStick').classList.toggle('show', touch && !tilt && state !== 'menu' && state !== 'draw');
  $('btnCalib').style.display = touch && tilt ? '' : 'none';
  if (touch && tilt && state !== 'menu' && !input.tiltActive) input.enableTilt();
}

function showHint(text, ms = 3500) {
  hint.textContent = text;
  hint.classList.add('show');
  hudLater('hint', ms / 1000, () => hint.classList.remove('show'));
}

async function startFight() {
  sound.unlock();
  sound.ambience(); // 배경의 고요 (포세이돈: 파도·바람, 산사: 산바람·풍경·산새). 아주 작게, 처음 한 번만 켜진다
  // 폰이면 전체화면 + 가로 고정 시도 (지원 안 하면 조용히 넘어감)
  if (input.isTouchDevice) {
    try {
      await document.documentElement.requestFullscreen?.();
      await screen.orientation?.lock?.('landscape');
    } catch {
      /* 무시 */
    }
    if (moveModeValue() === 'tilt') {
      const ok = await input.enableTilt();
      setTimeout(() => {
        if (!ok || !input.tiltActive) {
          sensorMoveFallback = 'stick'; // 저장 선호는 그대로 두고 이번 실행만 조이스틱으로
          input.resetTransient();
          refreshSettingsUI();
          showHint('기울기 센서를 쓸 수 없어 조이스틱으로 바꿨어요');
        } else {
          input.calibrateTilt();
        }
      }, 800);
    }
  }
  $('rotate').classList.add('enabled');
  menu.classList.remove('show');
  hud.classList.add('show');
  topButtons.classList.add('show');
  closeDraw(); // 뽑기 도중에 "처음부터 다시"를 눌렀으면 그 카드는 치운다
  toast.classList.remove('show');
  nextRoundStage(); // 배경: 첫 판은 메뉴 뒤 그대로, 그 다음 판부터는 정해진 순서로 다음 배경 (짓는 멈칫은 메뉴가 아직 떠 있는 동안)
  prepareRound(); // 이번 상대 · 상대 무기
  showFoeIntro(currentFoe);
  if (FIXED_WEAPON) {
    // 테스트용 ?weapon= : 뽑기 없이 그 무기로 바로 "Battle"
    newRound(FIXED_WEAPON);
    beginFight();
    return;
  }
  // 무기 뽑기: 판은 임시 무기로 세워 두기만 하고(시간은 멈춤, 무기는 감춤) 카드 세 장(내 카드 둘 + 상대 칸)을 띄운다
  newRound('longsword');
  setWeaponsVisible(false);
  state = 'draw';
  input.enabled = false;
  applyMoveMode();
  if (currentFoe) $('foeIntro').querySelector('em').textContent = input.isTouchDevice ? '무기 카드를 한 장 고르세요' : '무기 카드를 한 장 고르세요 (1 · 2)';
  openDraw();
}

/** 무기를 받았다: 싸움 시작 ("Battle", 조이스틱, 조작 안내) */
function beginFight() {
  input.resetTransient();
  state = 'fight';
  input.enabled = true;
  emoSeen.player = emoSeen.enemy = null; // 감정 알림은 판마다 새로 (시작 감정도 알린다 — 브란은 분노로 시작한다)
  clearEmoMsg();
  applyMoveMode();
  if (currentFoe) {
    // 소개(이름 · 대사)는 조금 더 두었다가 걷는다 (무기 이름은 적지 않는다: 카드가 이미 보여 줬다)
    hudLater('foeIntro', 2.6, () => $('foeIntro').classList.remove('show'));
  }
  showToast('Battle', 900);
  showHint(
    !input.isTouchDevice
      ? '클릭해서 마우스 잠그기 · WASD로 걷기 · 클릭으로 찌르기'
      : moveModeValue() === 'tilt'
        ? '끌어서 휘두르기 · 톡 쳐서 찌르기 · 기울여서 걷기'
        : '조이스틱으로 걷기 · 끌어서 휘두르기 · 톡 쳐서 찌르기',
  );
}

let pausedFrom = 'fight'; // 싸움 중에 멈췄나, 무기 뽑기 중에 멈췄나 (계속하기가 돌아갈 곳)
let pauseOpen = false; // pause() 로 연 메뉴인가 (판 끝 결과 메뉴와 구별)
function pause() {
  if (state !== 'fight' && state !== 'draw') return;
  pausedFrom = state;
  state = 'paused';
  pauseOpen = true;
  input.enabled = false;
  input.resetTransient();
  document.exitPointerLock?.();
  $('menuTitle').textContent = '일시정지';
  $('menuSub').textContent = '설정을 바꾸거나 계속할 수 있어요.';
  $('btnStart').textContent = '처음부터 다시';
  $('btnResume').style.display = '';
  showMenu();
}

function showMenu() {
  document.activeElement?.blur?.();
  menu.classList.add('show');
  menu.querySelector('.card').scrollTop = 0;
}

function resume() {
  pauseOpen = false;
  input.resetTransient();
  sound.unlock(); // 폰이 전화·잠금 등으로 소리를 멈췄으면 다시 켠다
  menu.classList.remove('show');
  state = pausedFrom;
  input.enabled = state === 'fight';
  applyMoveMode();
  last = performance.now();
}

$('btnStart').addEventListener('click', startFight);
testRoute.mount(document, getWeapon(FIXED_WEAPON || 'longsword').nameKo); // test=1: 메뉴에 '테스트 고르기로'
$('btnResume').addEventListener('click', resume);
$('btnPause').addEventListener('click', pause);
// 두 번째 손가락은 click 을 믿을 수 없다(첫 손가락이 칼·조이스틱을 쥔 채) → 터치의 pointerdown 으로도 멈춘다 (10/8 입력 수명주기)
$('btnPause').addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') return;
  event.preventDefault();
  pause();
});
$('btnCalib').addEventListener('click', () => {
  input.calibrateTilt();
  showHint('지금 각도를 기준으로 맞췄어요', 1500);
});
window.addEventListener('keydown', (e) => {
  if (state === 'draw') {
    // 무기 뽑기: 1·2 로 카드 고르기 (3 번째는 상대 칸이라 키가 없다), 결과를 보는 동안 스페이스·엔터로 바로 싸움
    const k = { Digit1: 0, Digit2: 1, Numpad1: 0, Numpad2: 1 }[e.code];
    if (k != null) pickCard(k);
    else if (e.code === 'Space' || e.code === 'Enter') skipReveal();
  }
  if (e.code !== 'KeyP') return;
  if (state === 'fight' || state === 'draw') pause();
  else if (state === 'paused' && (!roundOver || pauseOpen)) resume(); // 자동 일시정지(화면 이탈)가 판 끝 느린 화면과 겹쳐도 P 로 돌아온다 (10/8 검토 11)
});
// 싸우는 도중 전화·잠금·다른 앱 때문에 소리가 멈췄으면(아이폰은 'interrupted'), 다음에 화면을 만질 때 다시 켠다.
// (일시정지 → 계속하기를 누르지 않아도 되게. 시작 버튼을 누르기 전에는 소리 장치를 만들지 않는다: sound.ctx 가 있을 때만)
for (const ev of ['touchend', 'pointerup', 'keydown']) {
  window.addEventListener(ev, () => sound.ctx && sound.unlock(), { passive: true });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause(); // 화면을 떠나면(전화·앱 전환) 멈춘다 — 돌아와서 첫 손가락이 지난 획을 잇지 않게 (10/8)
  if (!document.hidden && sound.ctx) sound.unlock(); // (손을 대지 않아도 되는 브라우저는 여기서 바로 다시 켜진다)
});
window.addEventListener('blur', pause);
// ── 감정이 켜지는 순간 한 줄 알림 ──
//  상대: "오소리 브란이 공포에 잠식된다" / 주인공: 주어 없이 "공포에 잠식된다" (10/10 문구 정리: 다른 감정 줄과 같은 현재형) (집념은 주어 없이: 상대 "집념을 보인다", 주인공 "집념이 생긴다")
const EMO_TEXT = {
  fear: (who) => (who ? `${who}${josa(who, '이', '가')} ` : '') + '공포에 잠식된다',
  obsession: (who) => (who ? '집념을 보인다' : '집념이 생긴다'), // 사장님 결정: 주어 없이 — 상대는 "집념을 보인다", 주인공은 "집념이 생긴다"
  anger: (who) => (who ? `${who}의 ` : '') + '분노가 폭발한다',
};
/** 받침이 있으면 a(이), 없으면 b(가) */
function josa(word, a, b) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return a;
  return (c - 0xac00) % 28 ? a : b;
}
const emoSeen = { player: null, enemy: null };
function watchEmotions() {
  const pairs = [
    ['player', playerEmo?.emotion ?? null, null],
    ['enemy', ai?.emotion ?? null, currentFoe?.name || '상대'],
  ];
  for (const [k, emo, who] of pairs) {
    if (emo !== emoSeen[k]) {
      emoSeen[k] = emo;
      if (emo && EMO_TEXT[emo] && state === 'fight' && !roundOver) showEmoMsg(EMO_TEXT[emo](who), emo);
    }
  }
}
//  감정 줄 (E): 줄 세우기 — 앞 것이 EMO_MIN 초는 보인 뒤에 다음 것으로 (최대 2 개 기다림, 넘치면 오래된 것을 버린다). 시계는 게임 시간
const EMO_MIN = 1.2;
const emoQueue = [];
let emoCur = null; // { text, emo, sec, age }
function showEmoMsg(text, emo, ms = 2000) {
  const m = { text, emo, sec: ms / 1000, age: 0 };
  if (emoCur && emoCur.age < EMO_MIN) {
    emoQueue.push(m);
    if (emoQueue.length > 2) emoQueue.shift();
    return;
  }
  playEmoMsg(m);
}
function playEmoMsg(m) {
  const el = $('emoMsg');
  if (!el) return;
  emoCur = m;
  el.textContent = m.text;
  el.dataset.emotion = m.emo;
  el.classList.add('show');
}
function tickEmoMsg(dt) {
  if (!emoCur) return;
  emoCur.age += dt;
  if (emoQueue.length && emoCur.age >= EMO_MIN) return playEmoMsg(emoQueue.shift());
  if (emoCur.age >= emoCur.sec) {
    emoCur = null;
    $('emoMsg')?.classList.remove('show');
  }
}
/** 감정 줄을 비운다 (새 판) */
function clearEmoMsg() {
  emoQueue.length = 0;
  emoCur = null;
  $('emoMsg')?.classList.remove('show');
}

// ── 부활 (이졸데, src/revive.js · revive_fx.js): 연출이 알리는 때에 소리·알림 ──
//  fall: 처음 쓰러짐 — 죽음 목소리 대신 신음 (쓰러뜨린 한 방에 몸 소리가 방금 신음을 냈으면 겹치지 않게)
//  light: 하늘에서 빛이 내려오기 시작 — 성스러운 울림 (소리 담당이 sound.revive 를 만든다. 없으면 조용히 넘어간다)
//  notice: 빛이 다 내려왔다 — "○○가 투지로 다시 일어선다" (감정 알림 자리), 캐릭터 시트에 lines.revive 가 있으면 대사 한 줄도
reviveFx.onCue = (cue, f) => {
  const ch = f === enemy ? currentFoe : null;
  const voice = f === enemy ? voiceOf(currentFoe) : 'player';
  if (cue === 'fall') {
    const bs = bodySounds[f === enemy ? 1 : 0];
    if (!bs || bs.t - bs.lastHurt > 0.5) {
      sound.hurt(voice, 1.2, { me: f === player });
      if (bs) bs.lastHurt = bs.t;
    }
  } else if (cue === 'light') sound.revive?.(voice);
  else if (cue === 'notice' && state === 'fight' && !roundOver) {
    const who = ch?.name || '상대';
    showEmoMsg(`${who}${josa(who, '이', '가')} 투지로 다시 일어선다`, 'revive', 2600);
    if (ch?.lines?.revive?.length) showFoeLine(ch, randomLine(ch, 'revive'));
  }
};

/** 플레이어 감정: 이번 프레임의 사건을 모아 판정하고, 배율표를 파이터에 얹고, 공포면 손을 떨고, 화면 가장자리에 색을 입힌다 */
function updatePlayerEmotion(dt) {
  if (!playerEmo || !player || !enemy) return;
  const ev = playerEv;
  ev.bleeding = player.bleed > 0.01;
  ev.foeBleeding = enemy.bleed > 0.01;
  ev.winning = enemy.blood < player.blood;
  ev.weaponBroken = player.weaponBroken;
  ev.disarmed = !player.armed;
  ev.foeBroke = enemy.weaponBroken;
  // 상대 칼이 코앞: 상대가 베는 중이고 붙어 있다 / 상대가 진품 엑스칼리버를 들고 사정거리 근처
  const d = ai?.d ?? 3;
  ev.nearMiss = ai?.mode === 'attack' && ai.phase === 'strike' && d < 1.65;
  ev.foeLegendNear = enemy.armed && enemy.weapon?.tier === 'legend' && d < 2.5;
  if (player.alive) playerEmo.update(dt, ev);
  ev.hurt = ev.parried = ev.landed = false;
  player.emoMods = playerEmo.mods;
  // 공포 손 떨림: AI 와 같은 방식 — 0.06~0.1초마다 새 방향, 크기는 배율표의 tremor. 지금 얹혀 있는 값과의 차이만 더한다
  const T = playerTremor;
  const amp = player.emoMods.tremor;
  if (amp > 0 && player.alive) {
    T.t -= dt;
    if (T.t <= 0) {
      T.t = 0.06 + Math.random() * 0.04;
      const a = Math.random() * Math.PI * 2;
      const r = amp * (0.5 + Math.random() * 0.5);
      T.x = Math.cos(a) * r;
      T.y = Math.sin(a) * r;
    }
  } else T.x = T.y = 0;
  player.handOffset.x += T.x - T.ax;
  player.handOffset.y += T.y - T.ay;
  T.ax = T.x;
  T.ay = T.y;
  // 화면: 감정별 색이 세기만큼 (공포 푸른 회색·분노 붉음·집념 금빛)
  const el = $('emotion');
  if (el) {
    el.dataset.emotion = playerEmo.emotion || '';
    el.style.opacity = (playerEmo.emotion && EMO_ABILITY.enabled ? 0.25 + 0.5 * playerEmo.intensity : playerEmo.emotion ? 0.15 : 0).toFixed(3);
  }
}

// 체력 게이지 대신: 피를 흘리거나 아프면 화면 가장자리가 붉게 물든다 (하프 소드처럼 숫자 없음)
//  값이 바뀔 때만 스타일을 쓴다 (같은 값을 매 프레임 쓰지 않게 — 보이는 것은 같다)
const hudLast = { opacity: null, filter: null };
function updateHud() {
  const lost = THREE.MathUtils.clamp((1 - player.blood) / 0.5, 0, 1);
  const pulse = player.bleed > 0.002 ? 0.15 * (0.5 + 0.5 * Math.sin(performance.now() / 180)) : 0;
  const v = Math.min(1, lost * 0.85 + Math.min(1, player.pain) * 0.35 + pulse);
  const opacity = v.toFixed(3);
  const filter = player.consciousness < 0.6 ? `blur(${(0.6 - player.consciousness) * 6}px)` : '';
  if (opacity !== hudLast.opacity) $('vignette').style.opacity = hudLast.opacity = opacity;
  if (filter !== hudLast.filter) $('vignette').style.filter = hudLast.filter = filter;
}

/** 판 끝 결과 글자: 결정타 슬로모션(slowMo)이 끝난 뒤에 한 번. 슬로모션 동안 참수·쓰러지는 장면을 글자가 가리지 않게 */
function showRoundResult() {
  if (resultShown || slowMo > 0) return;
  resultShown = true;
  showToast(lastRoundWon ? '승리' : '패배', 0);
}

function checkRoundEnd(dt) {
  if (!roundOver) {
    if (!enemy.alive || !player.alive) {
      roundOver = true;
      resultShown = false;
      const win = !enemy.alive;
      lastRoundWon = win; // 다음 판을 열 때 다음 무대로 넘어갈지 (nextRoundStage)
      showRoundResult();
      if (!win && currentFoe) showFoeLine(currentFoe, randomLine(currentFoe, 'win')); // 상대의 승리 대사 (죽은 쪽은 말이 없다)
      else lastFoeLine = '';
    }
    return;
  }
  showRoundResult();
  roundOverTime += dt;
  if (roundOverTime > 3.5 && state === 'fight') {
    state = 'paused';
    input.enabled = false;
    input.resetTransient();
    document.exitPointerLock?.();
    toast.classList.remove('show');
    const win = !enemy.alive;
    const loser = win ? enemy : player;
    // 한 줄로 짧게: 이겼으면 내가 한 일(베었다), 졌으면 내가 당한 일(베였다)
    const cause = win
      ? { 목: '목을 베었다', 머리: '머리를 쳤다', 출혈: '출혈로 쓰러뜨렸다', 기절: '기절시켰다', 내려찍기: '내려찍었다' }[loser.causeOfDeath] || '쓰러뜨렸다'
      : { 목: '목을 베였다', 머리: '머리를 맞았다', 출혈: '피를 너무 흘렸다', 기절: '기절했다', 내려찍기: '내려찍혔다' }[loser.causeOfDeath] || '쓰러졌다';
    $('menuTitle').textContent = win ? '승리' : '패배';
    // 졌으면 상대의 승리 대사를 한 줄 덧붙인다 (사장님 확정)
    $('menuSub').textContent = !win && lastFoeLine ? `${cause} · ${currentFoe.name}: “${lastFoeLine}”` : cause;
    // 여정(무대마다 그곳 검객): 이기면 다음 상대, 지면 같은 상대와 다시 (주소로 상대·배경을 고정했으면 그냥 다시 싸우기)
    $('btnStart').textContent = win && foeParam === 'stage' && !STAGE_PIN ? '다음 상대' : '다시 싸우기';
    $('btnResume').style.display = 'none';
    testRoute.resultLabel($('btnStart'));
    reviveFx.reset(); // 결과 화면: 부활 연출이 남아 있으면 치운다 (상대가 일어서는 동안 내가 죽었을 때)
    hudLater('foeIntro');
    $('foeIntro').classList.remove('show'); // 화면 글자 시계는 게임 시간이라 결과 창 뒤에 남지 않게 여기서 걷는다 (대사는 결과 창 부제에 있다)
    clearEmoMsg();
    showMenu();
  }
}

// ── 카메라: 내 캐릭터 오른쪽 어깨 너머에서 상대를 바라본다 ──
//  흔들림은 "스프링에 매단 카메라"로 계산한다: 충격이 오면 그 방향으로 밀렸다가 부드럽게 제자리로.
//  (예전처럼 매 프레임 무작위로 떨지 않는다)
const camShake = { o: new THREE.Vector3(), v: new THREE.Vector3() };
function kickCamera(dir, strength) {
  camShake.v.addScaledVector(dir, strength);
}
const camTarget = new THREE.Vector3();
const camFollow = new THREE.Vector3();
const camLook = new THREE.Vector3();
const camDir = new THREE.Vector3(1, 0, 0);
const _cd = new THREE.Vector3();
function updateCamera(dt) {
  if (!player || window.game?.freeCam) return; // freeCam: 디버그용으로 카메라를 직접 조종
  // 흔들리는 골반 대신 몸 전체 무게중심을 부드럽게 따라간다
  //  (참수된 몸은 무게중심에 날아가는 머리가 섞이니 골반을 따른다)
  const a = camFollow.lerp((!player.decapitated && player.com) || player.pelvisPos, 1 - Math.exp(-dt * CAMERA.follow));
  const b = (!enemy.decapitated && enemy.com) || enemy.pelvisPos;
  // 나 → 상대 방향 (너무 붙어 있으면 이전 방향 유지)
  _cd.set(b.x - a.x, 0, b.z - a.z);
  if (_cd.length() > 0.3) camDir.lerp(_cd.normalize(), 1 - Math.exp(-dt * 3)).normalize();
  const right = _cd.set(-camDir.z, 0, camDir.x);
  // 판 시작: 조금 높고 먼 자리에서 무대를 보여 주다가 발이 풀릴 때(ARENA.startHold)까지 평소 자리로 부드럽게 내려온다 (사장님 9/30).
  //  시계는 판마다 새로 0부터 세는 player.fightT (싸움 전 메뉴·무기 뽑기 동안엔 0이라 시작 자리에서 기다린다)
  const open = ARENA.startHold > 0 ? 1 - THREE.MathUtils.smoothstep(player.fightT, 0, ARENA.startHold) : 0;
  const camH = CAMERA.height + CAMERA.openUp * open;
  camTarget
    .copy(a)
    .addScaledVector(camDir, -(CAMERA.back + CAMERA.openBack * open))
    .addScaledVector(right, CAMERA.shoulder)
    .setY(camH);
  // 비기 카메라 연출 (10/10 이베리아 사이드스텝 사선 베기): 내 쪽 무게중심을 축으로 SECRET.camSwing ° 를 camSwingIn 초에 돌렸다가 camSwingOut 초에 되돌림 (부드럽게)
  if (camSwing.t >= 0) {
    camSwing.t += dt;
    const S = CONFIG.SECRET;
    const ti = S.camSwingIn;
    const to = S.camSwingOut;
    const w = camSwing.t < ti ? THREE.MathUtils.smoothstep(camSwing.t, 0, ti) : 1 - THREE.MathUtils.smoothstep(camSwing.t, ti, ti + to);
    if (camSwing.t > ti + to) camSwing.t = -1;
    else {
      const ang = camSwing.sign * S.camSwing * (Math.PI / 180) * w;
      const ox = camTarget.x - a.x;
      const oz = camTarget.z - a.z;
      camTarget.x = a.x + ox * Math.cos(ang) - oz * Math.sin(ang);
      camTarget.z = a.z + ox * Math.sin(ang) + oz * Math.cos(ang);
    }
  }
  // 경기장 바깥 돌벽을 뚫고 나가지 않게
  const r = Math.hypot(camTarget.x, camTarget.z);
  if (r > 10.5) camTarget.multiplyScalar(10.5 / r).setY(camH);
  const k = 1 - Math.exp(-dt * 6);
  camera.position.lerp(camTarget, k);
  const look = _cd.copy(a).addScaledVector(camDir, CAMERA.lookAhead).setY(1.1);
  camLook.lerp(look, k);
  // 발걸음: 디딜 때 살짝 내려앉음
  if (player.footstep > 0) {
    camShake.v.y -= CAMERA.stepBob * 12 * player.footstep;
    player.footstep = 0;
  }
  // 스프링 흔들림 적분 (단단함 170, 감쇠 13)
  const h = Math.min(dt, 1 / 30);
  camShake.v.addScaledVector(camShake.o, -170 * h).multiplyScalar(Math.max(0, 1 - 13 * h));
  camShake.o.addScaledVector(camShake.v, h);
  camera.position.add(camShake.o);
  camera.lookAt(camLook);
  camera.position.sub(camShake.o); // 다음 프레임 따라가기는 흔들림 없는 위치 기준
  sun.position.set(a.x + SUN_OFF.x, SUN_OFF.y, a.z + SUN_OFF.z);
  sun.target.position.set(a.x, 0, a.z);
}

// ── 지금 검술 자세 이름 (자세가 바뀌면 잠깐 보여 준다) ──
const guardName = $('guardName');
let guardShown = -1;
let guardTimer = 0;
function updateGuardName(dt) {
  const gun = player.weapon?.gun; // 권총: 칼 자세 대신 '사격 자세' 하나만 (gun.js GUN_STANCE)
  // 보정 v2 (s > 0): 날것 자세라 휘두르지도(quiet > 0) 되돌아오지도 않을 때만 이름을 보인다 (여쭘 20, 기존 깃발만)
  const sk = player.skill;
  const rest = !(sk.corr === 'v2' && sk.level > 0) || (sk.quiet > 0 && !sk.recovering);
  const g = settings.guardNames && (gun || (player.guardWeight() > 0.5 && rest)) && player.alive ? (gun ? 'gun' : player.guardPose.nearest) : -1;
  if (g !== guardShown && (g === 'gun' || g >= 0)) {
    guardShown = g;
    guardName.innerHTML = '';
    // 자세 이름: 검술 풀이(sword_art.js resolveSwordArt)의 names — 무기별·라이브러리 자세표가 있으면 그 이름(상단·팔상·3번 자세…), 마무리 자세(g ≥ 14)는 늘 GUARDS
    const info = gun ? GUN_STANCE : player.swordArt.names[g];
    // 두 줄 (10/10 글자 체계 · 문구 규칙 §4-5): 첫 줄 = 한국어 이름(괄호 앞), 둘째 줄 = 원어(괄호 안) · 설명 — 넘치면 … (CSS)
    const [main, sub] = splitName(info.name);
    const b = document.createElement('b');
    b.textContent = main;
    const d = document.createElement('small');
    d.textContent = [sub, info.desc].filter(Boolean).join(' · ');
    guardName.append(b, d);
    guardName.classList.add('show');
    guardTimer = 1.6;
  }
  if (g < 0) guardShown = -1;
  guardTimer -= dt;
  if (guardTimer <= 0) guardName.classList.remove('show');
}

// ── 유파 기술 알림 (10/9 — 사장님 '패시브가 발동될 때 알아차릴 수 있게 상태 메시지처럼 화면 중앙에 기술명 출력해') ──
//  상대 AI 가 유파 패시브를 내거나 유파 고유 동작을 시작하면 ai.js 가 enemy.techCue 에 적는다 → 이름 + 꼬리표를 잠깐. docs/strike/tech_cue_2026-10-09.md
//  10/10 글자 체계 (사장님 16:3x '우측 상단 자세 이름 아래에 영역을 지정해서 패시브와 비기는 따로' — docs/ui/hud_type_system_2026-10-10.md §3):
//   칸 셋으로 나눈다 — R2 패시브·고유 동작(·디버그 기술) = 자세 칸 바로 아래, R3 비기(상대 비기 · 내 비기 실행·창 열림 · 고노센 준비) = 그 아래,
//   C 상태 = 화면 가운데 위 (경직 — 나·상대, 그리고 내 비기 창이 열린 동안 비기 이름 — 사장님 10/9 '테스트 중엔 크게').
//   칸이 나뉘어 예전의 '덮지 않기' 예외가 둘만 남는다: R3 은 내 것 우선(상대 비기는 1 개 기다림), C 는 상대 경직 우선.
//   칸 서식: 첫 줄 = 한국어 이름(괄호 앞), 둘째 줄 = 원어(괄호 안) · 꼬리표 `[내|상대] 유파 · 종류` (문구 규칙 docs/ui/hud_copy_rules_2026-10-10.md §4-4·4-5).
//  설정 '유파 기술 알림'(techCue)을 끄면 상대 것만 숨긴다 — 내 비기 알림은 조작이라 그대로. '모든 기술 이름 보기'(techCueAll, 디버그)는 R2 에 흐리게.
//  시간은 게임 루프 dt (passive 1.2 · unique 1.5 · secret 2.0 s, 비기는 실행이 끝날 때까지)
const techCueEl = $('techCue'); // R2 · R3 · C 를 담는 겉 칸 (예전 도구가 숨기거나 dataset.kind 를 읽는다 — 마지막에 띄운 알림의 kind·who 를 적어 둔다)
const TECH_CUE_KIND = { passive: '패시브', unique: '고유 동작', all: '기술', secret: '비기', secretReady: '비기', stiff: '비기', secretArm: '비기' };
const TECH_CUE_TIME = { passive: 1.2, unique: 1.5, all: 1.0, secret: 2.0, secretReady: 0.5, stiff: 0.3, secretArm: 0.3 };
const TECH_SLOT_OF = { passive: 'r2', unique: 'r2', all: 'r2', secret: 'r3', secretReady: 'r3', secretArm: 'r3', stiff: 'c' };
const techSlots = { r2: { el: $('techSlot'), t: 0, cue: null }, r3: { el: $('secretSlot'), t: 0, cue: null }, c: { el: $('stateCue'), t: 0, cue: null } };
let r3Wait = null; // 내 비기가 R3 을 쓰는 동안 온 상대 비기 하나 { cue, t }
let techCueSeen = null;
let techAllSeen = null;
/** '한국어 (원어)' → [한국어, 원어]. 괄호 뒤 말은 '· …' 이면 둘째 줄로, 아니면 첫 줄 뒤에 (예: '자→격 (刺→擊) 고리' → ['자→격 고리', '刺→擊']) */
function splitName(s) {
  const m = /^(.*?)\s*\(([^()]*)\)\s*(.*)$/.exec(s ?? '');
  if (!m || !m[1]) return [s ?? '', ''];
  const rest = m[3].replace(/^·\s*/, '');
  if (!rest || m[3].startsWith('·')) return [m[1], [m[2], rest].filter(Boolean).join(' · ')];
  return [`${m[1]} ${rest}`, m[2]];
}
/** 꼬리표 `[내|상대] 유파 · 종류` (문구 규칙 §4-4) */
const cueTag = (c) => `${c.who === 'me' ? '내' : '상대'}${c.schoolKo ? ` ${c.schoolKo}` : ''} · ${TECH_CUE_KIND[c.kind] ?? ''}`;
const mineBusy = (S) => S.t > 0 && S.cue?.who === 'me' && S.cue.kind !== 'secretArm'; // 내 비기 창·실행 (고노센 준비는 덮을 수 있다)
function paintSlot(S, c, time) {
  const [main, sub] = splitName(c.text);
  const b = document.createElement('b');
  b.textContent = c.kind === 'stiff' ? c.text : main;
  // 둘째 줄 = 원어 · 꼬리표. 좁으면 원어 쪽만 … 으로 줄고 꼬리표('내/상대 …')는 늘 다 보인다 (CSS .o · .t)
  const tag = document.createElement('small');
  const t = document.createElement('span');
  t.className = 't';
  t.textContent = cueTag(c);
  if (sub && c.kind !== 'stiff') {
    const o = document.createElement('span');
    o.className = 'o';
    o.textContent = sub;
    t.textContent = `\u00a0· ${t.textContent}`;
    tag.append(o);
  }
  tag.append(t);
  S.el.replaceChildren(b, tag);
  S.el.dataset.kind = c.kind;
  S.el.dataset.who = c.who ?? 'foe';
  S.el.classList.add('show');
  S.t = time;
  S.cue = c;
  techCueEl.dataset.kind = c.kind;
  techCueEl.dataset.who = c.who ?? 'foe';
}
function showTechCue(c) {
  const k = TECH_SLOT_OF[c.kind] ?? 'r2';
  const S = techSlots[k];
  const time = TECH_CUE_TIME[c.kind] ?? 1.2;
  const me = c.who === 'me';
  if (k === 'r3') {
    if (!me && mineBusy(S)) return void (r3Wait = { cue: c, t: time }); // 내 비기가 먼저 — 상대 비기는 기다린다
    if (me && c.kind !== 'secretArm' && S.t > 0 && S.cue?.who !== 'me' && S.cue?.kind === 'secret') r3Wait = { cue: S.cue, t: S.t }; // 보이던 상대 비기는 남은 시간만큼 기다린다
  }
  if (k === 'c' && me && S.t > 0 && S.cue?.who !== 'me') return; // 상대 경직이 먼저 (칠 기회)
  paintSlot(S, c, time);
  if (c.kind === 'secretReady' && !(techSlots.c.t > 0 && techSlots.c.cue?.who !== 'me')) paintSlot(techSlots.c, c, time); // 내 비기 창: 가운데에도 (테스트 동안 크게)
}
/** 플레이어 비기 알림: kind 'secretReady' | 'secret' | 'stiff' (싸움 중이면 설정과 상관없이 — 비기 창은 조작이다) */
function showPlayerCue(S, kind) {
  if (state !== 'fight' || !S) return;
  const T = TRADITIONS[player?.swordArt?.tradition];
  showTechCue({ text: kind === 'stiff' ? '경직' : S.nameKo ?? S.name, kind, who: 'me', schoolKo: T?.nameKo ?? '' });
}
function updateTechCue(dt) {
  const { r2, r3, c: cs } = techSlots;
  // 플레이어 비기 창이 새로 열림 · 경직 시작
  if (playerSecret && playerSecret.opened !== secretOpenSeen) {
    secretOpenSeen = playerSecret.opened;
    if (playerSecret.open) {
      showPlayerCue(playerSecret.S, 'secretReady');
      try {
        navigator.vibrate?.(CONFIG.SECRET.playerVibrate); // 짧은 진동 (지원 안 하면 생략)
      } catch {
        /* 생략 */
      }
    }
  }
  const pPhase = player?.skill?.secretPhase ?? null;
  // 고노센 준비 (10/10 02:4x): 상대 간격 밖 iaiArmTime 초가 차면 R3 에 흐린 '고노센 준비' (R3 이 비었거나 이미 그것일 때만)
  const pArmed = !!(CONFIG.SECRET.iai && playerSecret?.S?.do?.instant && playerSecret.iaiArm?.armed);
  if (pArmed && !pPhase && !playerSecret.open && (r3.t <= 0 || r3.cue?.kind === 'secretArm')) {
    if (r3.cue?.kind !== 'secretArm' || r3.t <= 0) showTechCue({ text: '고노센 준비', kind: 'secretArm', who: 'me', schoolKo: TRADITIONS[player?.swordArt?.tradition]?.nameKo ?? '' });
    r3.t = Math.max(r3.t, 0.2);
  }
  if (pPhase === 'stiff' && !(cs.t > 0 && cs.cue?.who === 'me' && cs.cue.kind === 'stiff')) showPlayerCue(playerSecret?.S, 'stiff');
  // 상대 비기 경직도 또렷이 (10/10 사장님 '경직은 … 있는 것도 몰랐다'): AI 비기가 경직이면 가운데 '경직' (상대 꼬리표)
  const aiStiff = state === 'fight' && ai?.secretRun?.stage === 'stiff' && !!enemy?.alive;
  if (aiStiff && !(cs.t > 0 && cs.cue?.kind === 'stiff' && cs.cue.who !== 'me')) showTechCue({ text: '경직', kind: 'stiff', who: 'foe', schoolKo: TRADITIONS[ai.art?.tradition]?.nameKo ?? '' });
  // 떠 있는 동안 늘이기 (게임 시간 — 화면이 느려도 맞게)
  if (cs.cue?.kind === 'stiff' && cs.cue.who !== 'me' && aiStiff) cs.t = Math.max(cs.t, 0.15);
  for (const S of [r3, cs]) if (S.cue?.kind === 'secretReady') S.t = playerSecret?.open ? Math.max(S.t, 0.1) : Math.min(S.t, 0); // 창이 열린 동안만
  if (r3.cue?.who === 'me' && r3.cue.kind === 'secret' && pPhase === 'run') r3.t = Math.max(r3.t, 0.3); // 내 비기는 실행이 끝날 때까지
  if (cs.cue?.who === 'me' && cs.cue.kind === 'stiff' && pPhase === 'stiff') cs.t = Math.max(cs.t, 0.15);
  if (r3.cue?.who !== 'me' && r3.cue?.kind === 'secret' && ai?.secretRun && ai.secretRun.stage !== 'stiff') r3.t = Math.max(r3.t, 0.3); // AI 비기 알림은 그 비기가 끝날 때까지 (連環三擊 세 수)
  const live = state === 'fight' && !!settings.techCue && !!enemy?.alive && !roundOver;
  const liveMine = state === 'fight' && !roundOver; // 내 비기 알림은 설정 '유파 기술 알림'과 상관없이
  const c = enemy?.techCue ?? null;
  if (c && c !== techCueSeen) {
    techCueSeen = c;
    if (live) showTechCue(c);
  }
  const a = enemy?.techAll ?? null;
  if (a && a !== techAllSeen) {
    techAllSeen = a;
    // 디버그: 모든 기술 이름 (패시브·고유 동작 알림이 떠 있는 동안은 덮지 않는다)
    if (live && settings.techCueAll && !(r2.t > 0 && r2.cue?.kind !== 'all')) showTechCue(a);
  }
  let any = false;
  for (const S of [r2, r3, cs]) {
    S.t -= dt;
    const vis = S.t > 0 && (S.cue?.who === 'me' ? liveMine : live);
    if (!vis) S.el.classList.remove('show');
    any ||= vis;
  }
  // 기다리던 상대 비기: 내 비기가 R3 을 비우면 남은 시간만큼
  if (r3Wait) {
    r3Wait.t -= dt;
    if (r3Wait.t <= 0 || !live) r3Wait = null;
    else if (!mineBusy(r3)) {
      paintSlot(r3, r3Wait.cue, r3Wait.t);
      r3Wait = null;
    }
  }
  techCueEl.classList.toggle('show', any);
}

// ── 게임 루프 ──
// 성능 측정 표시: 주소에 ?fps=1 을 붙이면 왼쪽 위에 초당 프레임·물리·그리기 시간·게임 속도가 나온다
const perf = params.get('fps') ? new PerfMeter(renderer, () => `배경 ${stages.id}  짓기 ${stages.buildMs.toFixed(0)}ms${stages.warmMs ? ` + GPU 준비 ${stages.warmMs.toFixed(0)}ms` : ''}`) : null;
let last = performance.now();
let acc = 0;
// 화면 갱신 상한 (CONFIG.RENDER.fpsCap, 사장님 9/30): 90/120 Hz 화면에서 그리기만 60 fps 로 거른다.
//  물리 스텝·입력·소리·카메라 따라가기는 rAF 마다 예전 그대로. 거르는 건 renderer.render 와 그 직전의 겉모습 갱신뿐
const renderCap = createRenderCap();

function frame(now) {
  requestAnimationFrame(frame);
  sound.setPaused(state !== 'fight' && state !== 'draw'); // 샛별 저장소 무대 셋의 배경음·세부음만 메뉴·일시정지 동안 줄인다 (stage_detail_sound.js)
  const frameMs = now - last;
  let dt = Math.min(0.1, frameMs / 1000);
  last = now;
  let physMs = 0, physSteps = 0, capped = false, simWant = 0, simGot = 0; // 성능 측정 표시(?fps=1)용
  const paint = renderCap.tick(dt, settings.fpsCap ? CONFIG.RENDER.fpsCap : 0); // 이번 프레임을 그리나

  if (state === 'fight' && player) {
    // 손 목표 갱신 (입력 → 플레이어)
    const d = input.consumeHandDelta();
    // 멈칫하는 동안엔 손가락 움직임도 느리게 반영한다 (멈칫이 끝나는 순간 손이 휙 튀지 않게)
    const inScale = hitStop > 0 ? 0.25 : 1;
    // 칼 쪽 화면을 톡 치면(마우스는 끌지 않고 클릭) 찌른다 (skill.js thrust). 권총은 손가락이 닿는 순간 쏜다 (쏘는 타이밍이 실력이라 뗄 때까지 늦추지 않는다)
    input.tapOnDown = !!player.weapon?.gun;
    let taps = input.consumeTaps();
    // 플레이어 비기 (10/9 23:5x): 창이 열려 있을 때 공격 입력(톡 = 찌르기, 휘두르기만큼 빠른 끌기 = 베기)이 오면 그 입력 대신 비기 완벽 실행.
    //  실행·경직 동안은 칼 입력(끌기·톡)을 무시한다 — 발(스틱)은 그대로 내 것
    const swipe = Math.hypot(d.x, d.y) / Math.max(dt, 1e-3) >= CONFIG.SKILL.swingSpeed;
    let secBusy = !!player.skill.secretPhase;
    if (playerSecret?.open && !secBusy && player.alive && (taps > 0 || swipe)) {
      const o = playerSecret.fire();
      if (player.skill.secret(o)) {
        secBusy = true;
        showPlayerCue(o.S, 'secret');
      }
    }
    if (secBusy) taps = 0;
    // 권총: 자동 조준이라 끌기는 손을 움직이지 않는다 (빠른 끌기가 내딛기·자세 복귀를 부르지 않게)
    if (player.alive && !player.weapon?.gun && !secBusy) {
      player.handOffset.x += d.x * inScale;
      player.handOffset.y += d.y * inScale;
    }
    // 검술 층의 "자세로 돌아가기"가 알아야 할 것: 손가락이 화면에 닿아 있는지, 지금 움직였는지
    player.handHeld = input.activeTouch !== null;
    player.inputActive = !secBusy && Math.abs(d.x) + Math.abs(d.y) > 1e-5;
    if (taps > 0 && player.alive && !(pommelTap && player.foeDistance() <= CONFIG.CLOSE.pommelDist && player.skill.pommel())) player.skill.thrust();
    updatePlayerEmotion(dt);
    watchEmotions();
    const m = input.move;
    const emv = player.emoMods?.move ?? 1; // 감정 고유 능력: 집념이면 발이 묶이고 공포면 빨라진다
    player.move.set(player.alive ? m.x * emv : 0, player.alive ? m.y * emv : 0);
    player.stickX = player.alive ? m.x : 0; // 스틱 원값 (감정 배수 전): 근접 밀치기 걸쇠가 읽는다 (fighter.closeStep)
    player.stickY = player.alive ? m.y : 0;
    updateGuardName(dt);
    // 마우스로 조작할 땐 손가락 흔적 대신 오른쪽 아래 원판에 손 위치의 흔적을 그린다
    const mouseMode = !input.isTouchDevice;
    if (mouseMode && player.alive) trail.addPad(player.skill.aim.x, player.skill.aim.y, now / 1000);

    // 타격 순간 살짝 멈칫 + 판이 끝나면 슬로모션
    let scale = 1;
    if (hitStop > 0) {
      hitStop -= dt;
      scale = 0.12;
    }
    // 결정타 연출 (10/9 23:5x — CONFIG.SECRET.slowMo): AI·플레이어 비기가 터뜨려진 순간(터뜨림 수가 바뀜) 화면 시간을 잠깐 늦춘다 — 물리 스텝 dt 는 그대로, 스텝 수만 준다
    const bursts = (ai?.secretBursts ?? 0) + player.skill.secretBursts;
    if (bursts !== secretBurstsSeen) {
      secretBurstsSeen = bursts;
      if (SECRET_SLOWMO) secretSlow = CONFIG.SECRET.slowMo.dur;
    }
    if (secretSlow > 0) {
      secretSlow -= dt;
      scale = Math.min(scale, CONFIG.SECRET.slowMo.scale);
    }
    if (slowMo > 0) {
      slowMo -= dt;
      scale = Math.min(scale, 0.25); // 결정타 슬로모션
    } else if (roundOver) scale = Math.min(scale, 0.5);
    acc += dt * scale * TEMPO; // 전체 빠르기 (?tempo, 기본 1.1)
    simWant = (frameMs / 1000) * scale;
    const physT0 = perf ? performance.now() : 0;
    let steps = 0;
    while (acc >= PHYSICS.timestep && steps < PHYSICS.maxStepsPerFrame) {
      player.foe = enemy;
      enemy.foe = player;
      player.faceTarget = enemy.bodies.pelvis.translation();
      enemy.faceTarget = player.bodies.pelvis.translation();
      ai.update(PHYSICS.timestep);
      playerSecret?.update(PHYSICS.timestep, !!player.skill.sec); // 플레이어 비기 창: 조건(AI 와 같은 함수)이 차면 창을 연다
      player.step(PHYSICS.timestep);
      enemy.step(PHYSICS.timestep);
      tickDebris(PHYSICS.timestep); // 흩어지는 칼·방어구 조각 (겉모습만, 게임 시간 — 멈칫·슬로모션을 따른다)
      player.cacheState();
      enemy.cacheState();
      world.step(eventQueue, combat.physicsHooks);
      combat.afterStep(world, eventQueue);
      swordTrails.sample(PHYSICS.timestep); // 칼 잔상 띠: 이 스텝의 칼 자세를 기록 (읽기만)
      clashCooldown -= PHYSICS.timestep;
      clashStopCooldown -= PHYSICS.timestep;
      stats.simTime += PHYSICS.timestep;
      acc -= PHYSICS.timestep;
      steps++;
    }
    if (steps === PHYSICS.maxStepsPerFrame) acc = 0;
    if (perf) {
      physMs = performance.now() - physT0;
      physSteps = steps;
      capped = steps === PHYSICS.maxStepsPerFrame;
      simGot = steps * PHYSICS.timestep;
    }
    player.syncMeshes();
    enemy.syncMeshes();
    for (const f of [player, enemy]) {
      updateWhoosh(f, dt * scale);
      updateDrips(f, dt * scale);
    }
    decapFx.update([player, enemy], dt * scale); // 참수: 목 단면·피 분출
    limbFx.update([player, enemy], dt * scale); // 팔·다리 절단: 단면·피
    updateBindSound();
    for (const b of bodySounds) b.update(dt * scale);
    reviveFx.update(enemy, dt * scale);
    particles.update(dt * scale);
    if (paint) {
      // 겉모습만 (시계로 도는 빛·안광, 칼 잔상 꼭짓점): 그리는 프레임에만
      for (const a of auras) a.update(now / 1000);
      swordTrails.update(); // 칼 잔상 띠
    }
    arena.update(dt);
    updateHud();
    checkRoundEnd(dt);
  } else {
    muteWhoosh();
    // 무기 뽑기: 싸움(물리·AI)은 멈춘 채 카드 순서만 흐른다. 바다·먼지는 그대로 움직인다
    if (state === 'draw') {
      updateDraw(dt);
      arena.update(dt);
    }
    // 판이 끝나 메뉴가 뜬 뒤에도 흩어지던 칼·투구·판금 조각은 마저 날아 사라진다 (판 끝 슬로모션 0.5배 그대로. 싸움 중 일시정지면 멈춘 채)
    if (roundOver) tickDebris(dt * 0.5);
  }
  updateCamera(dt); // 거르는 프레임에도: 흔들림 스프링·발걸음(player.footstep 소비)·소리 자리(sound.listener)가 여기 달려 있다
  let renderMs = 0;
  if (paint) {
    fighterLight.update(fighterMeshes);
    const renderT0 = perf ? performance.now() : 0;
    renderer.render(scene, camera);
    renderMs = perf ? performance.now() - renderT0 : 0;
  } else camera.updateMatrixWorld(); // 그리기가 해 주던 카메라 행렬 갱신 — 소리 좌우(sound._where)가 읽는다
  if (perf) perf.frame(now, frameMs, physMs, renderMs, physSteps, capped, simWant, simGot, paint);
  trail.enabled = settings.trail && state === 'fight';
  if (paint) trail.draw(now / 1000, !input.isTouchDevice);
  watchSecretFx(); // 비기 화면 연출 (발도 번쩍임 · 이베리아 카메라)
  updateTechCue(dt); // 유파 기술 알림 — 싸움이 아닐 때(메뉴·일시정지)도 불러 숨긴다
  if (state === 'fight' || state === 'draw') tickHudTimers(dt); // 화면 글자 시계 (일시정지·메뉴면 멈춘다)
}

// 메뉴 뒤 배경으로 보일 첫 판을 미리 만들어 둔다
prepareRound();
newRound(FIXED_WEAPON || 'longsword');
requestAnimationFrame(frame);

// 디버그/튜닝용: 브라우저 콘솔에서 game.player.blood, game.config.GAIT.kneeBase = 0.2 처럼 만져볼 수 있다
//  (WEAPON 값은 판을 만들 때 싸움꾼마다 weaponCfg 로 복사된다: 바꾸면 다음 판부터)
window.game = {
  get player() {
    return player;
  },
  get enemy() {
    return enemy;
  },
  get world() {
    return world;
  },
  get ai() {
    return ai;
  },
  tempo: TEMPO, // 전체 빠르기 손잡이 (?tempo)
  get playerSecret() {
    return playerSecret; // 플레이어 비기 창 (open · opened · S) — 브라우저 스모크(tools/browser/player_secret_shots.mjs)가 읽는다
  },
  get combat() {
    return combat;
  },
  // 흩어지는 조각 수 (칼·방어구, debris.js): game.debris.count() 전부, game.debris.count('armor') 방어구만
  debris: { count: debrisCount },
  draw, // 무기 뽑기 상태 (stage, ids = [내 카드, 내 카드, 상대 무기], pick). 스크린샷용으로 game.draw.hold = true 면 순서가 멈춘다
  get state() {
    return state;
  },
  trail,
  stats,
  config: CONFIG,
  THREE,
  camera,
  freeCam: false,
  renderInfo: () => ({ frame: renderer.info.render.frame, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, ...renderer.info.memory, programs: renderer.info.programs?.length }),
  renderCap, // 화면 갱신 상한: game.renderCap.interval = 잰 화면 간격(초). 끄기는 설정 '화면 갱신 60 fps 묶기' (game.settings.fpsCap)
  // 배경: game.stage 로 지금 배경·짓는 시간 확인, game.setStage('castle') 로 바로 바꿔 보기 (싸우는 중이면 잠깐 멈칫한다)
  get stage() {
    return { id: stages.id, pinned: STAGE_PIN, buildMs: stages.buildMs, clearMs: stages.clearMs, warmMs: stages.warmMs };
  },
  setStage(id) {
    if (useStage(id)) {
      clearFlying();
      stages.warm(renderer, camera);
    }
    sound.setStage(stages.id);
  },
  AI,
  settings,
  sound, // 예: game.sound.clash(8) 로 소리 확인, game.sound.stats
  fighterLight, // 예: game.fighterLight.enabled = false 로 캐릭터 조명을 끄고 비교
  reviveFx, // 부활 연출 (예: game.reviveFx.active, game.reviveFx.group)
};
