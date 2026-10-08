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
//      ②③ 단계(10/9, docs/strike/school_impl_2026-10-09.md): 일본·중국에 유파 자료(names·techK·rest·counterArt·newTech)를 더했다 — 아래 '유파 자료' 머리말.
//      자세 이름은 늘 켬(HUD 만), 가중치·쉴 자세·맞받아치기는 SKILL.schoolArt 1 일 때만(기본 0 = 오늘 판 그대로). 값은 모두 사장님 확인 전
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
//  유파 자료 칸(names·techK·rest·counterArt·newTech)은 꾸러미에 들어가지 않는다(pack 이 고르는 열쇠 밖) — sword_art.js 가 TRADITIONS 에서 직접 읽는다
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

// ── 유파 자료 (②③ 단계 10/9 — 일본·중국. 출처: docs/motion/schools/school_japanese_draft.md·school_chinese_draft.md, 값은 모두 사장님 확인 전) ──
//  사장님 결정: 유파는 패드 자리·칼끝 각·몸 돌림을 옮기지 않는다 — 바꾸는 것은 이름·가중치·이어 치기·쉴 자세·맞받아치기·취향뿐.
//  비슷한 시대 전통끼리 섞는 것은 된다(출처를 적는다). 새 상한·문턱은 없다.
//   names      바탕 자리 이름(guards.js GUARDS[i].name 글자 그대로) → { name, desc, src }. HUD 자세 이름만 바꾼다(판에 닿지 않음 — 늘 켬).
//              자세표(table)는 건드리지 않는다: frames.js 가 표를 덮을 때 바탕 이름(g.name)을 열쇠로 쓰기 때문
//   techK      기술 base 곱. 열쇠 = '몸 틀:싸움 방식' → '몸 틀:*' → '*' 차례로 처음 맞는 한 칸만. 칸 안의 'thrust' = 찌르기 기술(kind 'thrust') 모두
//   rest       쉴 자세 = G 패드 열쇠 (보정 v2 ③ 되돌아옴 겨눔의 목표 — 플레이어만 쓴다. AI 는 autoGuard 가 꺼져 있어 읽지 않는다)
//   counterArt 맞받아 베기 목록 (꾸러미 counter 꼴). 열쇠를 counter 로 두지 않은 까닭: 꾸러미 조립(pack)이 유파의 counter 를 그대로 가져가 끔에서도 판이 바뀐다
//   newTech    새 기술 후보 (TECH 꼴 + ai:false + src) — AI 는 쓰지 않는다. 자료·갤러리용, 재지 않았다
//  techK·rest·counterArt 는 SKILL.schoolArt 1 일 때만 sword_art.js 가 입힌다 (0 = 이름만, 오늘 판 그대로)

// 일본 (카타나 가족: 지금 모노호시자오 = 앞무게 틀, 뒤에 올 카타나 = 두손 보통 틀). 이름 14 자리 — 원전 이름 + 자리 근거 7, 원전 이름 + 자리 [해석] 3, 원전 없음 4(쉬운 말)
const JAPANESE_NAMES = {
  '지붕 (Vom Tag)': { name: '상단 (上段)', desc: '두 손을 머리 위로, 왼발 앞 · 위에서 한 칼로 내려벤다', src: '검도형 p06/5·p22 十一 · 오륜서 R15/23 表2' },
  '어깨 지붕 (Vom Tag)': { name: '팔상 (八相)', desc: '上段에서 오른 주먹을 오른 어깨까지 내린 꼴 · 날은 상대 쪽, 왼발 앞', src: '검도형 p10/9' },
  '황소 (Ochs)': { name: '머리 옆 겨눔', desc: '칼자루를 머리 오른쪽에, 칼끝은 상대 얼굴', src: '원전 없음 (霞 [전승] 은 후보로만)' },
  '긴 자세 (Langort)': { name: '중단 (中段)', desc: '칼끝을 상대 얼굴 한가운데에, 손은 몸 가운데 · 쉴 자세 안 A', src: '검도형 p02/1·p06/5·p32 · 오륜서 R14/21·R15/22' },
  '옆 자세': { name: '우협 (右脇)', desc: '칼을 오른쪽에 가로로 눕힌다 · 받아서 上段으로 올려 곧장 내려벤다(表5)', src: '오륜서 R14/21·R16/24 表5' },
  '쟁기 (Pflug)': { name: '청안 (晴眼)', desc: '칼자루를 오른 허리에, 칼끝은 상대 얼굴 · 손이 낮은 中段 · 쉴 자세 안 B', src: '검도형 p15/14 [이름] · 자리 [해석]' },
  '바꿈 (Wechsel)': { name: '우하장 (右下藏)', desc: '칼끝을 오른쪽 아래로 감춘다 · 여기서 올려벤다(切り上げ)', src: '무도 권2 p144/136' },
  '옆 지킴 (Nebenhut)': { name: '협구 (脇構え)', desc: '왼 반신, 칼을 오른 옆에 두고 칼끝은 뒤로 · 칼 길이를 감춘다', src: '검도형 p11/10' },
  '바보 (Alber)': { name: '하단 (下段)', desc: '칼끝을 상대 무릎 높이로 내린다 · 아래에서 상대 손을 친다', src: '검도형 p04/3·p15/14 · 오륜서 R15/23 表3' },
  '왼쪽 어깨 지붕': { name: '왼 어깨 (八相 거울)', desc: '칼을 왼 어깨에 세움 · 왼쪽 사선 베기 준비', src: '원전 없음 (左八相 [전승] 은 후보로만)' },
  '왼쪽 황소': { name: '왼 머리 옆 겨눔', desc: '칼자루를 머리 왼쪽에, 칼끝은 상대 얼굴', src: '원전 없음' },
  '왼쪽 옆 자세': { name: '좌협 (左脇)', desc: '칼을 왼쪽에 가로로 · 아래에서 상대 손을 치고 어깨 위로 비스듬히 벤다(表4)', src: '오륜서 R14/21·R16/24 表4' },
  '왼쪽 쟁기': { name: '왼 허리 겨눔', desc: '칼자루를 왼 허리에, 칼끝은 상대 얼굴', src: '원전 없음' },
  '왼쪽 바꿈': { name: '좌장 (左藏)', desc: '칼끝을 왼쪽 아래로 · 袈裟가 끝나는 자리, 여기서 逆袈裟로 되올린다', src: '무도 권2 p068/60 (읽기 담당 표)' },
};
// 일본 기술 가중치 (초안 §5-2): 두손 보통(카타나) 真向 ×1.3 · 袈裟 ×1.2 · 胴 ×0.8 · 突き ×0.8.
//  앞무게(모노호시자오)는 胴 ×0.8 만 — 내리치기는 틀의 presses ×1.4, 찌르기는 라이브러리의 ×0.5 를 그대로 둔다(그래서 thrust 칸이 없다)
const JAPANESE_TECHK = {
  'two:*': { oberhau: 1.3, zornhau: 1.2, zornhauL: 1.2, zwerch: 0.8, zwerchL: 0.8, thrust: 0.8 },
  'heavy:cut': { zwerch: 0.8, zwerchL: 0.8 },
};
// 일본 새 기술 후보 (모두 ai:false — 초안 §6. 수는 [추정])
//  燕返し 길은 초안 안 3-가 그대로(지붕 → 곧장 바보까지 내려벤 뒤 오른 황소로 퍼올림). 다른 꼴(왼쪽 바꿈을 지나 왼 황소로)은 안 쓴 후보로 문서에만
const JAPANESE_NEW_TECH = [
  { name: 'tsubameGaeshi', ai: false, from: G.tag, path: [[0.0, 0.14], G.alber, [0.06, -0.15], G.ochsR], open: 'H', kind: 'cut', reach: -0.05, base: 0.8, presses: true, chain: 2, src: '이름 [전승] · 동작 오륜서 表2 R0000015/23 「打ちはづしたる太刀其儘置きて…下よりすくひ上げて打つ」 [원문] · 길의 수 [추정]' },
  { name: 'omote5', ai: false, from: G.sideR, path: [[0.3, 0.3], G.tag, [0.0, 0.14], G.alber], open: 'H', kind: 'cut', reach: -0.05, base: 0.6, presses: true, chain: 1, src: '오륜서 水の巻 表5 「我右の肩に横に構へて…上段に振り上げ、上より直ちにきる」 R0000016/24 [원문] · 길의 수 [추정]' },
  // 小手 — 길은 중국 zuoyi 와 같은 것 하나로 둔다(두 초안이 같은 꼴이라 적음). 유파마다 이름만 다르다
  { name: 'kote', ai: false, from: G.langort, path: [[0.05, 0.2], [0.03, -0.05]], open: 'UL', kind: 'cut', reach: 0.2, base: 0.5, fast: true, src: '검도형 2본·6본 小手 (읽기 담당 표) · 오륜서 「手をはる」 [원문] · 길은 중국 zuoyi 와 같음 [추정]' },
];

// 중국 (劍 — 지금 청강검 = 한손 두루 틀, 한손 찌르기 자세표 위). 이름 14 자리 — 조선세법 24 세 12 + 창 中平 1 + 원전 없음 1
const CHINESE_NAMES = {
  '지붕 (Vom Tag)': { name: '표두세 (豹頭勢)', desc: '높이 든 손에서 벼락같이 위로부터 친다', src: '무비지 쪽157/0571 · 무도 권2 p036/28' },
  '어깨 지붕 (Vom Tag)': { name: '우익세 (右翼勢)', desc: '오른 날개 — 오른 어깨 높이에서 친다', src: '무비지 쪽168/0582 · 자리 [해석]' },
  '황소 (Ochs)': { name: '역린세 (逆鱗勢)', desc: '비늘을 거슬러 목구멍·목을 곧게 찌른다', src: '무비지 쪽173/0587' },
  '긴 자세 (Langort)': { name: '중평 (中平)', desc: '팔을 뻗어 칼끝을 가운데 높이로 곧게 둔다 · 쉴 자세 안 A', src: '무비지 권87 창 쪽201/0616 — 劍 원전에는 없는 창의 이름 · 사장님 §9-2 (사장님 확인 전: 劍 원전 이름 直符送書·看守 가 대안)' },
  '옆 자세': { name: '요격세 (腰擊勢)', desc: '허리를 가로질러 가운데를 친다 — 검 중 으뜸 치기', src: '무비지 쪽166/0580 「劍中之首擊」' },
  '쟁기 (Pflug)': { name: '탄복세 (坦腹勢)', desc: '산이 무너지듯 나아가 가운데(배)를 찌른다 · 쉴 자세 안 B', src: '무비지 쪽158/0572' },
  '바꿈 (Wechsel)': { name: '요략세 (撩掠勢)', desc: '아래에서 걷어 올려 막고 아래로 친다', src: '무도 권2 p038/30' },
  '옆 지킴 (Nebenhut)': { name: '간수세 (看守勢)', desc: '굳게 지키며 살피다 기미를 따라 굴려 친다', src: '무도 권2 p039/31' },
  '바보 (Alber)': { name: '점검세 (點劍勢)', desc: '점 찍듯 찌른다 — 칼끝을 낮게 겨눈다', src: '무비지 쪽155/0569' },
  '왼쪽 어깨 지붕': { name: '좌익세 (左翼勢)', desc: '치켜 올렸다 눌러 상대 손아귀(虎口)를 바로 친다', src: '무비지 쪽156/0570 · 자리 [해석]' },
  '왼쪽 황소': { name: '왼 머리 옆 겨눔', desc: '칼자루를 머리 왼쪽에, 칼끝은 상대 얼굴', src: '원전 없음' },
  '왼쪽 옆 자세': { name: '요격세 · 왼 (腰擊)', desc: '왼쪽에서 허리를 가로질러 친다 — 오른쪽 腰擊과 번갈아', src: '본국검 p036/28 左腰擊 · 무비지 쪽152/0566 抹腰' },
  '왼쪽 쟁기': { name: '좌협세 (左夾勢)', desc: '왼쪽에 끼고 가운데를 찌른다', src: '무도 권2 p043/35' },
  '왼쪽 바꿈': { name: '과좌세 (跨左勢)', desc: '왼편을 걸쳐 쓸어 아래로 친다', src: '무비지 쪽171/0585 · 자리 [해석]' },
};
// 중국 기술 가중치 (초안 §3-2, 지금 jianTech 의 찌르기 ×1.5 위에 곱한다). 안 A (24 세 쪽, 베기 : 찌르기 ≈ 3 : 1) — 腰擊 ×2.0 · 걷어 올리기 ×1.2 · 손 노리기 ×1.2
const CHINESE_TECHK = { '*': { zwerch: 2.0, zwerchL: 2.0, unterhau: 1.2, unterhauL: 1.2, wristCut: 1.2 } };
// 안 B (초습 쪽, ≈ 1.6 : 1) — 안 A + 찌르기 ×1.87 (= 2.8 ÷ 1.5). 재기용으로만 내보낸다(기본에 이어 두지 않음 — 도구가 TRADITIONS.chinese.techK 를 이것으로 바꿔 끼운다)
export const CHINESE_TECHK_B = { '*': { ...CHINESE_TECHK['*'], thrust: 1.87 } };
// 중국 새 기술 후보 (ai:false — 초안 §4 그대로: 刺·擊 고리. 수는 [추정])
const CHINESE_NEW_TECH = [
  // 찌른 뒤(긴 자세) 오른쪽으로 당겨 가로로 — 坦腹·左夾 → 腰擊
  { name: 'yaoji', ai: false, from: G.langort, path: [[0.35, 0.08], [0.0, 0.1], G.sideL], open: 'UL', kind: 'cut', reach: 0, base: 0.3, chain: 1, src: '조선세법 「向前進步腰擊」 무비지 쪽158/0572·쪽170/0584 [원문]' },
  // 찌른 뒤 치켜 올렸다 눌러 손을 침 — 逆鱗刺 → 左翼擊 「上挑下壓 直殺虎口」
  { name: 'zuoyi', ai: false, from: G.langort, path: [[0.05, 0.2], [0.03, -0.05]], open: 'UL', kind: 'cut', reach: 0.2, base: 0.5, fast: true, src: '조선세법 左翼勢 무비지 쪽156/0570·쪽173/0587 [원문]' },
];

// 유파 전통 여섯 (사장님 10/8 20:xx: 유파 5 + 무유파). rest = 쉴 자세(보정 v2 ③ 되돌아옴 겨눔의 목표) — 사장님 10/8 21:5x '유파가 정한다'
//  (독일 쟁기/긴 자세 · 이탈리아 테르차 · 이베리아 중단형 · 일본 中段 · 중국 中平 · 무유파 앞으로 겨눔). null = SKILL.homeGuard(쟁기 자리) 그대로.
//  일본·중국 rest 기본은 'pflugR' = 안 B (SKILL.homeGuard 와 같은 자리 [0.18, −0.28] — 스위치를 켜도 바이트 그대로). 안 A 는 'langort'(긴 자세 자리 = 中段·中平) — 사장님 확인 전
export const TRADITIONS = {
  // 독일: 두손 두루(롱소드·엑스칼리버·라이트세이버·에스톡)와 한손 베기(세이버·팔쉬온 — 두삭 가지).
  //  가지(branches, 열쇠 = 몸 틀:싸움 방식): 두삭(한손 베기)은 찌르기를 덜 믿는다 — 찌르기 기술 가중치 × thrustK (전 schools.js 세이버·팔쉬온 weakThrust 0.5 그대로)
  german: { id: 'german', nameKo: '독일', ...GERMAN, branches: { 'one:cut': { nameKo: '두삭 (한손 베기)', thrustK: 0.5 } }, rest: null },
  // 이탈리아: 한손 찌르기(레이피어). 지금은 독일 내용 그대로(전 레이피어 꾸러미 = 롱소드 꾸러미 + 간격) — 카포 페로 자료는 다음 단계
  italian: { id: 'italian', nameKo: '이탈리아', ...GERMAN, rest: null },
  // 이베리아: 앞무게 베기·때리기(츠바이핸더·냉동 참치) — 몬탄테. 지금은 독일 내용 그대로(전 두 꾸러미 = 롱소드 꾸러미 + 간격)
  iberian: { id: 'iberian', nameKo: '이베리아', ...GERMAN, rest: null },
  // 일본: 카타나 가족(지금 모노호시자오 — 스펙 school). 기술·속임수·막기 자리는 독일 내용 그대로, 그 위에 유파 자료.
  //  간 보는 자세·물러남 = 한 칼 자세(上段·八相에서 기다렸다 들어오는 순간 벤다 — 10라운드 6-7 무기 PM, 전 WEAPON_OVER.monohoshizao 그대로 옮김).
  //  맞받아치기 후보(초안 §12 counter: 真向 먼저)는 이번엔 넣지 않았다(지시 범위 밖 — 문서에 후보로)
  japanese: { id: 'japanese', nameKo: '일본', ...GERMAN, guards: HIGH_GUARDS, withdraw: { pressed: 'tagR', calm: ['tagR', 'tag'] }, rest: 'pflugR', names: JAPANESE_NAMES, techK: JAPANESE_TECHK, newTech: JAPANESE_NEW_TECH },
  // 중국: 청강검·지안(스펙 school). 기술 목록 = 지금 지안 꾸러미 그대로 (기술별 reach 보정은 청강검 실측 — ③ 단계에서 무기 쪽으로 가를 후보), 그 위에 유파 자료.
  //  맞받아치기(초안 §8): 막은 뒤 곧장 찌른다 — 찌르기 먼저 [추정]
  chinese: { id: 'chinese', nameKo: '중국', ...GERMAN, tech: jianTech, techByName: byName(jianTech), rest: 'pflugR', names: CHINESE_NAMES, techK: CHINESE_TECHK, counterArt: { default: ['stichPflug', 'zwerch', 'zornhau'] }, newTech: CHINESE_NEW_TECH },
  // 무유파: 둔기(나뭇가지·고무 닭·모르겐슈테른)·총. 지금은 독일 내용 그대로 — 날 없는 무기의 찌르기 빼기는 싸움 방식 규칙(weaponSchool)
  none: { id: 'none', nameKo: '무유파', ...GERMAN, rest: null },
};

// 유파 자료 켬 묶음 (재기 전용): SKILL.schoolArt 1 일 때 무엇을 입히나. 기본 모두 true — 도구(motion_lab)만 하나씩 끄고 켜 본다. 다른 곳은 읽지 않는다
export const SCHOOL_ART = { weights: true, rest: true, counter: true };

/**
 * 무기 → 유파 기본값 (틀·방식에서 자동). 스펙에 school 이 있으면 그것 (모노호시자오 japanese · 청강검 chinese).
 *  앞무게 → 이베리아(몬탄테) · 한손 둔기·총 → 무유파 · 한손 찌르기 → 이탈리아 · 그 밖(두손 두루·두손 찌르기·한손 베기·자루) → 독일
 */
export function traditionOf(spec) {
  if (spec?.school && TRADITIONS[spec.school]) return spec.school;
  const frame = spec?.frame ?? 'two';
  const style = spec?.style ?? 'versatile';
  if (frame === 'gun' || style === 'shoot') return 'none';
  if (style === 'blunt') return 'none'; // 둔기는 틀과 상관없이 무유파(사장님 10/8: 몽둥이·총 = 무유파 — 냉동 참치도 앞무게 틀의 몸놀림만 받고 전통은 없음)
  if (frame === 'heavy') return 'iberian';
  if (frame === 'one' && style === 'thrust') return 'italian';
  return 'german';
}

/** 꾸러미 한 벌 (열쇠 차례는 옛 꾸러미 그대로) */
function pack(id, weapon, measure, c, tradition) {
  return { id, weapon, measure, guards: c.guards, tech: c.tech, techByName: c.techByName, feints: c.feints, parry: c.parry, counter: c.counter, withdraw: c.withdraw, pose: c.pose, tradition };
}

// 무기 예외 — 유파 위에 덮는 그 무기 하나만의 몫. 지금은 비어 있다:
//  모노호시자오 한 칼 자세(높은 자세 간 보기·물러남, 10라운드 6-7)는 10/9 ② 단계에서 일본 유파(TRADITIONS.japanese guards·withdraw)로 옮겼다.
//  일본 무기가 모노호시자오 하나라 판은 바이트까지 같다. 뒤에 오는 카타나는 이것을 물려받는다 — 넣을 때 48 판으로 다시 잰다
const WEAPON_OVER = {};

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
