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
//      ②③ 단계(10/9, docs/strike/school_impl_2026-10-09.md): 일본·중국에 유파 자료(names·techK·rest·counterArt·unique)를 더했다 — 아래 '유파 자료' 머리말.
//      고유 동작 단계(10/9, docs/strike/school_unique_2026-10-09.md — 사장님 10/9 01:5x '새 베기 길을 열어야 유파의 의미가 있지'):
//       공용 동작(TECH 12 + 라이브러리 talhoReves·wristCut·molinello)은 모든 유파가 같이 쓰고 이름만 유파 말로(techNames),
//       유파마다 고유 동작 셋(unique — 독일·이탈리아·이베리아·일본·중국, 무유파는 없음)을 더한다. 아래 '공용 동작 이름'·'고유 동작' 머리말.
//      자세 이름·쉴 자세는 늘, 가중치·맞받아치기·새 기술(燕返し)은 SKILL.schoolArt(기본 1, 사장님 10/9 01:5x) 일 때. 값(가중치 수)은 사장님 확인 전 — 켜는 것만 결정됨
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
//  유파 자료 칸(names·techNames·techK·rest·counterArt·unique·spare·passives)은 꾸러미에 들어가지 않는다(pack 이 고르는 열쇠 밖) — sword_art.js 가 TRADITIONS 에서 직접 읽는다
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
//   unique     고유 동작 셋 (사장님 '고유 동작' — 옛 이름 newTech). 꼴 셋: TECH 꼴 길(kind cut·thrust) · { feint: FEINTS 꼴(fake·at·then·open) } ·
//              { counter: { 줄: [기술 이름…] } }. 모두 src(출처 표시 [원전]·[원전 2차]·[해석]·[추정]). ai:false = 자료만(AI 에 안 넣음)
//   spare      고유 셋에 들지 못한 후보 (ai:false 자료, 갤러리·문서용) — 일본 表5
//   techNames  공용 동작 이름 (기술 이름 → { name, src }) — 자료만(HUD 는 기술 이름을 보이지 않는다)
//  techK·counterArt·unique 는 SKILL.schoolArt(기본 1 — 사장님 10/9 01:5x '스위치 켜') 일 때 sword_art.js 가 입힌다 (0 = 10/9 01:49 까지의 판). names·rest 는 늘 (사장님 10/9 01:2x 안 A)

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
// 일본 고유 동작 셋 (초안 §6. 수는 [추정]). 燕返し 는 AI 에 열림 — 사장님 10/9 01:5x(48 판 52 → 56 % 소음 폭, 실제 사용 2/430: '있거나 없거나면 없을 이유도 없다').
//  燕返し 길은 초안 안 3-가 그대로(지붕 → 곧장 바보까지 내려벤 뒤 오른 황소로 퍼올림). 다른 꼴(왼쪽 바꿈을 지나 왼 황소로)은 안 쓴 후보로 문서에만
//  고유 동작 단계(10/9): 小手·跨虎 연타를 더해 셋. 表5 는 남은 후보(JAPANESE_SPARE, ai:false). 켜고 끈 까닭·수는 docs/strike/school_unique_2026-10-09.md
const JAPANESE_UNIQUE = [
  { name: 'tsubameGaeshi', nameKo: '燕返し (츠바메가에시)', from: G.tag, path: [[0.0, 0.14], G.alber, [0.06, -0.15], G.ochsR], open: 'H', kind: 'cut', reach: -0.05, base: 0.8, presses: true, chain: 2, src: '이름 [전승] · 동작 오륜서 表2 R0000015/23 「打ちはづしたる太刀其儘置きて…下よりすくひ上げて打つ」 [원문] · 길의 수 [추정]' },
  // 小手 — 길은 중국 zuoyi 와 같은 것 하나로 둔다(두 초안이 같은 꼴이라 적음). 유파마다 이름만 다르다
  { name: 'kote', nameKo: '小手 (코테)', from: G.langort, path: [[0.05, 0.2], [0.03, -0.05]], open: 'UL', kind: 'cut', reach: 0.2, base: 0.5, fast: true, fit: { online: 1.4 }, src: '검도형 2본·6본 小手 (읽기 담당 표) · 오륜서 「手をはる」 [원문] · 길은 중국 zuoyi 와 같음 [추정]' },
  // 跨虎 연타 — 발을 바꿔 디디며 앞으로 거듭 친다. 원문은 네 번이지만 길 하나에 넷을 넣으면 몰리넬로처럼 가운데가 오래 빈다 → 두 번(袈裟 → 왼쪽으로 들어 올려 真向).
  //  나머지 이음은 앞무게 흐름(installFlow — 내리치기를 ×3 먼저 고른다)이 맡는다. 오른 어깨 → 왼쪽 바꿈 → 지붕 → 바보
  { name: 'kokoRenda', nameKo: '跨虎 연타', from: G.tagR, path: [[0.12, 0.14], G.wechselL, [-0.14, 0.3], G.tag, [0.0, 0.14], G.alber], open: 'UL', kind: 'cut', reach: 0.05, base: 0.9, presses: true, chain: 2, src: '왜검 運光流 「作跨虎勢 兩手前一打 右手左脚前一打 右手右脚前一打 右手右脚前一跳前一打」 무도 권2 p076~p087/68~79 [원문] · 네 번 → 두 번으로 줄임 [해석] · 길의 수 [추정]' },
  // 開き斬り(体捌き): 오른쪽 앞으로 비스듬히 몸을 열어 딛고(먼저 비킴) 왼 어깨에서 逆袈裟 쪽으로 — 길 = 공용 zornhauL, base = 앞무게 꾸러미 zornhauL 1.4.
  //  step 칸 뜻은 아래 GERMAN_UNIQUE 의 zwerchAbtritt 주석 (lat 오른쪽 + m · fwd 앞 m · when)
  //  걸음 기술 다섯: 48 판 측정에서 걸음이 승률을 깎았으나(세 무기 144 판 40 대 51 %) **사장님 10/9 12:xx "우선 다 켜봐. 내가 겪어 봐야 판단"** 으로 켬. 끄려면 ai:false (재기: motion_lab SCHOOL_UNIQUE=이름)
  { name: 'hirakiGiri', nameKo: '開き斬り (히라키기리)', from: G.tagL, path: [[-0.1, 0.14], G.wechselR], open: 'UR', kind: 'cut', reach: -0.05, base: 1.4, presses: true, step: { lat: 0.3, fwd: 0.3, when: 'approach' }, src: '開き(체捌き)·斜めに開いて斬る [전승] · 오륜서 水の巻 「足づかひ」(陰陽の足) 항목 [원문 — 쪽 확인 전] · 길은 공용 逆袈裟 · 수 [추정]' },
];
// 일본 남은 후보 (고유 셋에 들지 못함 — ai:false 자료)
const JAPANESE_SPARE = [
  { name: 'omote5', nameKo: '表5 (오모테 5)', ai: false, from: G.sideR, path: [[0.3, 0.3], G.tag, [0.0, 0.14], G.alber], open: 'H', kind: 'cut', reach: -0.05, base: 0.6, presses: true, chain: 1, src: '오륜서 水の巻 表5 「我右の肩に横に構へて…上段に振り上げ、上より直ちにきる」 R0000016/24 [원문] · 길의 수 [추정]' },
];

// 중국 (劍 — 지금 청강검 = 한손 두루 틀, 한손 찌르기 자세표 위). 이름 14 자리 — 조선세법 24 세 12 + 세 안 자세 이름(直符送書) 1 + 원전 없음 1.
//  바탕 글은 《무비지》 劍 장의 조선세법(저자가 '조선에서 얻었다'고 적음 — 조선/중국 어느 쪽 것인지 학설이 갈림). 사장님 10/9 01:4x: 게임에 '중국 유파' 이름표가 보이는 것은 아니니 그대로 섞어 쓴다(본국검 낱말도 됨)
const CHINESE_NAMES = {
  '지붕 (Vom Tag)': { name: '표두세 (豹頭勢)', desc: '높이 든 손에서 벼락같이 위로부터 친다', src: '무비지 쪽157/0571 · 무도 권2 p036/28' },
  '어깨 지붕 (Vom Tag)': { name: '우익세 (右翼勢)', desc: '오른 날개 — 오른 어깨 높이에서 친다', src: '무비지 쪽168/0582 · 자리 [해석]' },
  '황소 (Ochs)': { name: '역린세 (逆鱗勢)', desc: '비늘을 거슬러 목구멍·목을 곧게 찌른다', src: '무비지 쪽173/0587' },
  '긴 자세 (Langort)': { name: '직부송서 (直符送書)', desc: '팔을 뻗어 칼끝을 가운데 높이로 곧게 보낸다 · 쉴 자세', src: '무비지 쪽156/0570 左翼勢 안의 자세 이름 · 본국검 무도 권3 p033/25 「作直符送書勢 右手左脚一刺」 [원문]. 中平은 劍 장에 없는 창 장(권87) 낱말이라 뺌 — 사장님 10/9 01:4x' },
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

// ── 서양·무유파 이름 (10/9, docs/motion/schools/names_west_none_2026-10-09.md §2-3·§3-4·§4 그대로 — 사장님 결정: 이베리아는 포르투갈어 철자(피게이레두),
//    '베기 이름 + 준비' 다섯 자리도 원문 낱말). 이름·설명·출처만(HUD) — 판에 닿지 않는다
// 이베리아 (몬탄테 — 츠바이핸더, 앞무게 틀). 이름 14 자리 — 피게이레두 1651 원문 낱말 + 자리 근거 7, 자리 [해석] 7.
//  피 단Ⅰ = 단순 규칙 Ⅰ, 피 복Ⅱ = 복합 규칙 Ⅱ (Myers·Hick 전사). 고디뉴 = Arte de Esgrima 1599 fol (PDF 쪽 = 2×fol − 7)
const IBERIAN_NAMES = {
  '지붕 (Vom Tag)': { name: '머리 위 (altibaxo)', desc: '칼을 이마 위로 들고 칼끝은 뒤로 · 곧게 내려친다', src: '피 단Ⅸ·복ⅩⅤ altibaxo · 고디뉴 fol.113r de arriba abajo · 자리 [해석]' },
  '어깨 지붕 (Vom Tag)': { name: '탈류 준비 (talho)', desc: '칼을 오른 어깨에 메어 칼끝은 뒤로 · 오른쪽 위에서 비스듬히 내려벤다', src: '피 단Ⅲ talho · 고디뉴 fol.113r tajo · 자리 [해석]' },
  '황소 (Ochs)': { name: '귀 앞 겨눔 (orelha direyta)', desc: '칼자루를 오른 귀 앞에, 칼끝은 앞 · 여기서 앞으로 탈류', src: '피 복Ⅱ' },
  '긴 자세 (Langort)': { name: '곧은 자세 (postura recta)', desc: '칼을 얼굴 앞 가운데에 곧게 · 베기마다 여기 멈춘다', src: '피 단Ⅰ·단Ⅱ·복Ⅶ · 손 높이는 [해석]' },
  '옆 자세': { name: '가로 탈류 (talho orizontal)', desc: '칼을 오른쪽에 가로로 눕힌다 · 가로로 벤다', src: '피 단Ⅺ' },
  '쟁기 (Pflug)': { name: '비낀 자세 (postura obtusa)', desc: '오른손을 허리띠 앞에, 칼은 오른 대각으로 비껴 · 찌르기를 받아 탈류로 쳐낸다', src: '피 단ⅩⅣ·복ⅩⅣ' },
  '바꿈 (Wechsel)': { name: '아래 탈류 (talho de baxo)', desc: '칼끝을 오른쪽 아래로 · 아래에서 위로 탈류를 올린다', src: '피 단Ⅰ·단Ⅸ · 자리 [해석]' },
  '옆 지킴 (Nebenhut)': { name: '뒤 탈류 (talho por detras)', desc: '칼을 오른 허리 뒤로 숨긴다 · 뒤에서 앞으로 탈류', src: '피 단Ⅰ·단Ⅲ · 자리 [해석] (대안 고디뉴 fol.117v tajo rastero)' },
  '바보 (Alber)': { name: '칼끝 땅에 (ponta no chão)', desc: '칼끝을 앞 땅으로 · 첫 규칙이 여기서 시작한다', src: '피 단Ⅰ' },
  '왼쪽 어깨 지붕': { name: '레베스 준비 (revez)', desc: '머리 위로 넘긴 칼을 왼 어깨에 떨군다 · 왼쪽에서 감아 벤다', src: '피 복Ⅱ revez cingido · 고디뉴 fol.113r' },
  '왼쪽 황소': { name: '왼 높이 비낌 (linha obtusa)', desc: '칼을 머리 앞 왼쪽 높이에 비껴 멈춘다', src: '피 복ⅩⅤ · 칼끝 방향 [해석]' },
  '왼쪽 옆 자세': { name: '가로 레베스 (revez orizontal)', desc: '칼을 왼쪽에 가로로 · 왼쪽에서 가로로 벤다', src: '피 단Ⅺ' },
  '왼쪽 쟁기': { name: '왼 비낀 자세 (postura obtusa)', desc: '칼을 왼 대각으로 비껴 · 찌르기를 레베스로 쳐낸다', src: '피 복ⅩⅣ 둘째 postura' },
  '왼쪽 바꿈': { name: '아래 레베스 (revez de baxo)', desc: '칼끝을 왼쪽 아래로 · 아래에서 위로 레베스를 올린다', src: '피 복ⅩⅤ · 자리 [해석]' },
};
// 독일 두삭 가지 (한손 베기 — 세이버·팔쉬온). 이름 14 자리 — 마이어 1570 두삭 편 원문 이름 12 + 쉬운 말 2.
//  롱소드와 같은 독일 유파라 TRADITIONS.german.names 가 아니라 가지에 둔다 (6절 — sword_art.js 가 가지 이름을 읽어야 함)
const DUSSACK_NAMES = {
  '지붕 (Vom Tag)': { name: '망루 (Wacht)', desc: '칼을 머리 위로 · 위에서 곧게 내려벤다', src: '마이어 1570 Ⅱ.20r.2' },
  '어깨 지붕 (Vom Tag)': { name: '분노 자세 (Zornhut)', desc: '칼을 오른 어깨에 메어 칼날은 뒤로 · 비스듬히 내려벤다', src: '마이어 Ⅱ.2r.2·Ⅱ.29r.1 · 꼴은 장검 Ⅰ.7v.3 [해석]' },
  '황소 (Ochs)': { name: '황소 (Stier)', desc: '칼자루를 머리 오른쪽에, 칼끝은 상대 얼굴 · 위에서 찌른다', src: '마이어 Ⅱ.22r.3' },
  '긴 자세 (Langort)': { name: '긴 자세 (Langort)', desc: '팔을 쭉 뻗어 칼끝으로 겨눈다 · 막기가 끝나는 자리', src: '마이어 Ⅱ.2r.2·Ⅱ.16r' },
  '옆 자세': { name: '가운데 지킴 (Mittelhut)', desc: '칼을 오른 옆 뒤로 눕힌다 · 가로로 벤다(가운데 베기)', src: '마이어 Ⅱ.2r.2·Ⅱ.43r.2 · 오른쪽 꼴 [해석]' },
  '쟁기 (Pflug)': { name: '멧돼지 (Eber)', desc: '칼자루를 오른 허리 아래에, 칼끝은 상대 얼굴 · 아래에서 찌르고 올려벤다', src: '마이어 Ⅱ.41r.3 · 자리 [해석] (레크퀴흐너 Eber = Pflug)' },
  '바꿈 (Wechsel)': { name: '바꿈 (Wechsel)', desc: '칼끝을 오른쪽 아래 땅으로 · 올려베기 준비', src: '마이어 Ⅱ.45v.2' },
  '옆 지킴 (Nebenhut)': { name: '옆 지킴', desc: '칼을 오른 허리 뒤로 숨긴다', src: '두삭 편에 없음 (쉬운 말)' },
  '바보 (Alber)': { name: '보루 (Bastei)', desc: '칼끝을 앞 땅으로 멀리 · 아래를 막고 올려친다', src: '마이어 Ⅱ.47v.4 「gleich dem Olber」' },
  '왼쪽 어깨 지붕': { name: '왼 분노 자세 (Zornhut)', desc: '칼을 왼 어깨에 메어 칼날은 뒤로 · 왼쪽에서 비스듬히 내려벤다', src: '마이어 Ⅱ.29r.1 「zu beiden seiten」' },
  '왼쪽 황소': { name: '왼 황소 (Stier)', desc: '칼자루를 머리 왼쪽에, 칼끝은 상대 얼굴', src: '마이어 Ⅱ.2r.2' },
  '왼쪽 옆 자세': { name: '왼 가운데 지킴 (Mittelhut)', desc: '가로 베기가 끝나 칼이 왼 옆에 눕는다 · 되받아 가로로', src: '마이어 Ⅱ.43r.2' },
  '왼쪽 쟁기': { name: '왼 허리 겨눔', desc: '칼자루를 왼 허리에, 칼끝은 상대 얼굴', src: '원전 없음 (마이어 Ⅱ.41r.3: Eber 는 오른쪽만)' },
  '왼쪽 바꿈': { name: '왼 바꿈 (Wechsel)', desc: '칼끝을 왼쪽 아래로 · 분노 베기가 끝나는 자리', src: '마이어 Ⅱ.45v.2 「zu beiden seiten」' },
};
// 무유파 (둔기·총 — 냉동 참치·나뭇가지·고무 닭·모르겐슈테른·권총). 쉬운 말 14 — 역사 낱말 없음. 앞무게 표·한손 표에 같은 말
const NONE_NAMES = {
  '지붕 (Vom Tag)': { name: '머리 위', desc: '머리 위로 높이 든다 · 내려친다', src: '쉬운 말' },
  '어깨 지붕 (Vom Tag)': { name: '오른 어깨 메기', desc: '오른 어깨에 메어 끝을 뒤로 · 비스듬히 내려친다', src: '쉬운 말' },
  '황소 (Ochs)': { name: '머리 옆 겨눔', desc: '손을 머리 오른쪽에, 끝은 상대 얼굴', src: '쉬운 말' },
  '긴 자세 (Langort)': { name: '앞으로 겨눔', desc: '끝을 상대에게 곧게 겨눈다 · 쉴 때 돌아오는 자리', src: '쉬운 말' },
  '옆 자세': { name: '오른쪽 젖히기', desc: '오른쪽 뒤로 젖혀 둔다 · 옆으로 후려친다', src: '쉬운 말' },
  '쟁기 (Pflug)': { name: '허리 겨눔', desc: '손을 오른 허리에, 끝은 상대 얼굴', src: '쉬운 말' },
  '바꿈 (Wechsel)': { name: '오른 아래로 내림', desc: '끝을 오른쪽 아래로 · 올려친다', src: '쉬운 말' },
  '옆 지킴 (Nebenhut)': { name: '오른 뒤로 숨김', desc: '오른 허리 뒤로 숨겨 길이를 감춘다', src: '쉬운 말' },
  '바보 (Alber)': { name: '앞으로 늘어뜨림', desc: '끝을 앞 아래로 늘어뜨린다 · 머리를 비워 끌어들인다', src: '쉬운 말' },
  '왼쪽 어깨 지붕': { name: '왼 어깨 메기', desc: '왼 어깨에 메어 끝을 뒤로 · 반대쪽으로 비스듬히 내려친다', src: '쉬운 말' },
  '왼쪽 황소': { name: '왼 머리 옆 겨눔', desc: '손을 머리 왼쪽에, 끝은 상대 얼굴', src: '쉬운 말' },
  '왼쪽 옆 자세': { name: '왼쪽 젖히기', desc: '왼쪽 뒤로 젖혀 둔다 · 반대쪽으로 후려친다', src: '쉬운 말' },
  '왼쪽 쟁기': { name: '왼 허리 겨눔', desc: '손을 왼 허리에, 끝은 상대 얼굴', src: '쉬운 말' },
  '왼쪽 바꿈': { name: '왼 아래로 내림', desc: '끝을 왼쪽 아래로 · 내려친 끝, 여기서 되올린다', src: '쉬운 말' },
};
// 유파 기질 (10/9 유파 걸음 '싼 층 먼저' — docs/strike/school_temper_2026-10-09.md): AI 성격(ai.js this.pers)의 기본 범위를 유파마다.
//  [lo, hi] = 그 사이에서 rand 로 한 번 굴림, 숫자 = 그 값 그대로. 없는 칸은 예전 기본값. 인물(characters.js persona.pers)이 정한 값이 늘 이긴다.
//  물리·걸음은 그대로 — 간격을 얼마나 두고 서는가(margin m)·얼마나 도는가(circleRate)·자세 바꾸는 박자(rhythm s)·가까운 자세 고집(guardStick)·
//  간 볼 때 손 빠르기(guardSpeed m/s)·달려드는 상대를 맞받는가(vor 0~1)·참을성(patienceTime s)·공격 성향(aggr) 만 바꾼다.
//  칸마다 rand 호출 수가 예전과 같다(범위 칸은 범위 그대로, 숫자 칸은 예전에도 숫자) → 독일·무유파는 같은 난수를 같은 차례로 뽑아 바이트 동일.
//  독일·무유파 = 예전 값 그대로 (롱소드 기준 회귀 sha 를 지킨다)
const GERMAN_TEMPER = { margin: [0.2, 0.5], aggr: [0.85, 1.2], circleRate: [0.15, 0.4], rhythm: [2.4, 4.5], vor: [0.15, 0.6], patienceTime: [7, 12], guardStick: 2.5, guardSpeed: 0.9 };
const NONE_TEMPER = GERMAN_TEMPER;
// 이탈리아 (레이피어, 카포 페로) [추정 — 사장님 확인 전]: 좁은 간격(misura stretta 쪽에 붙어 선다)·거의 돌지 않음(곧은 선 위에서 칼끝을 겨눔)·
//  짧은 박자(tempo 마다 칼끝 자리를 바꾼다)·가까운 자세 고집(테르차·콰르타 사이만 오간다)·손 빠름·박자에 맞받음(contratempo — 들어오는 박자에 찌른다)
const ITALIAN_TEMPER = { ...GERMAN_TEMPER, margin: [0.1, 0.3], circleRate: [0.05, 0.2], rhythm: [1.8, 3.0], guardStick: 3.5, guardSpeed: 1.2, vor: [0.4, 0.8] };
// 이베리아 (몬탄테) [추정 — 사장님 확인 전]: 긴 칼을 휘둘러 자리를 차지한다 — 넓은 간격·많이 돎(둥글게 걸으며 휘두름)·자세를 자유로이 옮김(고집 약함)·맞받기 보통보다 조금 많이.
//  처음 안(margin 0.35~0.6 · circleRate 0.35~0.6 · rhythm 2.0~3.5 · guardStick 1.5 · vor 0.3~0.7)은 츠바이핸더 48 판 21 → 13 승(−17 점)이라 모든 칸을 예전 값 쪽으로 반쯤 되돌렸다(21 승)
const IBERIAN_TEMPER = { ...GERMAN_TEMPER, margin: [0.28, 0.55], circleRate: [0.25, 0.5], rhythm: [2.2, 4.0], guardStick: 2.0, vor: [0.22, 0.65] };
// 일본 (한 칼 — 上段·八相에서 기다림) [추정 — 사장님 확인 전]: 간격 끝(一足一刀)에서 오래 기다린다·적게 돎·자세를 오래 지키고 고집·손 느긋함·
//  먼저 치지 않다가 들어오는 순간(出鼻·先の先)을 맞받는다·참을성 김
const JAPANESE_TEMPER = { ...GERMAN_TEMPER, margin: [0.3, 0.5], circleRate: [0.1, 0.25], rhythm: [4.0, 7.0], guardStick: 4.0, guardSpeed: 0.7, patienceTime: [9, 14], vor: [0.5, 0.9] };
// 중국 (조선세법) [추정 — 사장님 확인 전]: 좁은 간격·몰아붙임(進步 — 걸어 들어가며 잇달아 친다)·자세를 자주 바꿈(勢 가 이어진다)·참을성 짧음·공격 성향 높음
const CHINESE_TEMPER = { ...GERMAN_TEMPER, margin: [0.1, 0.3], circleRate: [0.2, 0.4], rhythm: [2.0, 3.5], aggr: [1.0, 1.3], patienceTime: [6, 10] };
// 중국 기술 가중치 (초안 §3-2, 지금 jianTech 의 찌르기 ×1.5 위에 곱한다). 안 A (24 세 쪽, 베기 : 찌르기 ≈ 3 : 1) — 腰擊 ×2.0(10/9 腰擊 쓰임에서 ×3.0) · 걷어 올리기 ×1.2 · 손 노리기 ×1.2
//  腰擊 ×2.0 → ×3.0 (10/9 腰擊 쓰임 — docs/strike/chinese_yaoji_2026-10-09.md): ×2 로는 공용 腰擊(zwerch·zwerchL)이 휘두름의 6 % — 옆 자세에 손이 있어도 base 0.5 가 분노의 베기(1.4)에 졌다
const CHINESE_TECHK = { '*': { zwerch: 3.0, zwerchL: 3.0, unterhau: 1.2, unterhauL: 1.2, wristCut: 1.2 } };
// 중국 간 보는 자세 (10/9 腰擊 쓰임): 독일 9 곳 + 腰擊勢(옆 자세). 조선세법 「腰擊勢者… 劍中之首擊也. 右脚右手斬蛇勢」 무비지 쪽166/0580 [원문] — 腰擊을 치는 자세.
//  threat·high·low 는 [추정](칼끝이 옆으로 비켜 덜 겨누고, 가슴 높이로 가로 친다). 이 자세는 물러남(pressed)에서 잡는다 — 아래 TRADITIONS.chinese withdraw
const CHINESE_GUARDS = [...WATCH_GUARDS, { name: 'sideR', pad: G.sideR, threat: 0.2, high: 0.4, low: 0.2 }];
// 안 B (초습 쪽, ≈ 1.6 : 1) — 안 A + 찌르기 ×1.87 (= 2.8 ÷ 1.5). 재기용으로만 내보낸다(기본에 이어 두지 않음 — 도구가 TRADITIONS.chinese.techK 를 이것으로 바꿔 끼운다)
export const CHINESE_TECHK_B = { '*': { ...CHINESE_TECHK['*'], thrust: 1.87 } };
// 중국 고유 동작 셋 (초안 §4: 刺·擊 고리 둘 + 斂翅. 수는 [추정])
const CHINESE_UNIQUE = [
  // 찌른 뒤(긴 자세) 오른쪽으로 당겨 가로로 — 坦腹·左夾 → 腰擊
  { name: 'yaoji', nameKo: '腰擊 (요격)', from: G.langort, path: [[0.35, 0.08], [0.0, 0.1], G.sideL], open: 'UL', kind: 'cut', reach: 0, base: 0.3, chain: 1, src: '조선세법 「向前進步腰擊」 무비지 쪽158/0572·쪽170/0584 [원문]' },
  // 찌른 뒤 치켜 올렸다 눌러 손을 침 — 逆鱗刺 → 左翼擊 「上挑下壓 直殺虎口」
  { name: 'zuoyi', nameKo: '左翼擊 (좌익격)', from: G.langort, path: [[0.05, 0.2], [0.03, -0.05]], open: 'UL', kind: 'cut', reach: 0.2, base: 0.5, fast: true, fit: { online: 1.4 }, src: '조선세법 左翼勢 무비지 쪽156/0570·쪽173/0587 [원문]' },
  // 斂翅 — 패한 척 물러났다가 갑자기 腰擊. 속임수 꼴: 찌르는 척(坦腹)하다 칼을 옆 뒤로 거둬들이고(물러나는 척) 오른 옆에서 허리를 가로 벤다.
  //  속임수는 가짜 몫 동안 발을 내딛지 않는다 — 몸이 실제로 물러나는 것은 그리지 못한다(손만 거둬들임) [해석]
  { name: 'lianchi', feint: { name: '斂翅 (찌르는 척 → 거둬 腰擊)', fake: 'stichPflug', at: 0.3, then: [G.nebenR, G.sideR, [0.0, 0.1], G.sideL], open: 'UL' }, src: '조선세법 斂翅勢 무비지 쪽174/0588 · 무도 권2 p045/37 「法能佯北誘賺 … 倒退進步腰擊」 [원문] · 물러남을 손 거둠으로 [해석]' },
  // 掣步 腰擊: 앞발을 왼쪽 앞으로 비껴 딛고(뒷발 끌어붙임) 찌른 자리(긴 자세)에서 오른쪽으로 당겨 허리를 가로 벤다 — 길 = 위 yaoji, base = yaoji × 1.1.
  //  처음엔 공용 zwerch 길(오른 옆 시작·base 0.5)이었으나 48 판에 한 번도 안 골랐다(청강검 손이 오른 옆에 거의 안 감) → 원문 「向前進步腰擊」(찌른 뒤 腰擊)대로 yaoji 길로 (10/9 잼)
  { name: 'chebuYaoji', nameKo: '掣步 腰擊 (끌어 딛는 요격)', from: G.langort, path: [[0.35, 0.08], [0.0, 0.1], G.sideL], open: 'UL', kind: 'cut', reach: 0, base: 0.33, chain: 1, step: { lat: -0.25, fwd: 0.25, when: 'strike' }, src: '조선세법 掣步(앞발 딛고 뒷발 끌어붙임) 「向前掣擊中殺」 쪽154/0568(무도 권2 p035/27 글자) · 「向前掣步左翼擊」 쪽173/0587 · 腰擊 「向前進步腰擊」 쪽158/0572 [원문] · 옆으로 비끼는 것은 [해석] · 수 [추정]' },
];

// ── 고유 동작 (10/9 — 사장님 01:5x '각 유파마다 강점과 특징을 살릴 고유 동작', docs/strike/school_unique_2026-10-09.md) ──
//  유파마다 셋. 패드 자리·칼끝 각·몸 돌림은 그대로 — 새 길은 14 자리 패드와 닿는 범위 안의 빈 패드 점을 잇는 것뿐.
//  base 는 꾸러미에 들어간 뒤 값 그대로다(라이브러리의 틀·방식 곱 — 앞무게 내리치기 ×1.4, 찌르기 방식 찌르기 ×1.8 — 을 거치지 않는다: applySchoolArt 가 그 뒤에 더한다).
//  그래서 같은 유파 무기의 비슷한 공용 동작 실제 base 에 맞춰 적었다. 수는 모두 [추정], 사장님 확인 전

// 독일 (리히테나워·마이어 다섯 비밀 베기 가운데 TECH 에 없는 둘 + 맺은 뒤 거듭 치기 + 비껴 가로베기). 10/9 12:2x 사장님 '우선 다 켜봐' → 넷 다 켬(전엔 ai:false — 롱소드 AI 를 바꾸므로 수를 보시고 정하기로 했던 것)
const GERMAN_UNIQUE = [
  // fit 칸(10/9 13:xx — 사장님 '고유 동작이 잘 안 보인다·개념이 달라야', docs/strike/passive_fire_2026-10-09.md): 상대 자세가 그 기술이 깨는 꼴일 때 pickTech 의 fit 에 곱한다
  //  (열쇠 = foeClass 의 online·high·low·left·right + parried 바로 앞 내 공격이 막힘). 칸이 없으면 셈은 전과 같다. 수는 모두 사장님 확인 전 — 작게 둔다
  // 굽은 베기: 오른 어깨에서 팔을 엇걸어 왼쪽 아래로 — 칼끝을 상대 손 위로 던진다(몸통보다 가까운 손을 노려 reach +0.2). 황소를 깬다
  { name: 'krumphau', nameKo: 'Krumphau (굽은 베기)', from: G.tagR, path: [[0.3, 0.3], [0.0, 0.05], G.pflugL], open: 'UL', kind: 'cut', reach: 0.2, base: 0.6, fit: { online: 2.0, high: 1.3 }, src: 'Zettel 「Krump auf behende, wirf den Ort auf die Hände」 · Ringeck 주해 42절 · Meyer 1570 장검 4장 [원전 2차 — docs/motion/clips/krumphau_*.json 출처] · 길의 수 [추정]' },
  // 사팔뜨기 베기: 오른 어깨에서 손을 뒤집어 뒷날로 위에서 상대 칼·오른 어깨를 치고, 팔을 뻗어 칼끝으로 겨눈 채 끝낸다(긴 자세). 쟁기·찌르기를 깬다
  { name: 'schielhau', nameKo: 'Schielhau (곁눈 베기)', from: G.tagR, path: [[0.22, 0.36], [0.06, 0.2], G.langort], open: 'UR', kind: 'cut', reach: 0.05, base: 0.7, presses: true, fit: { online: 2.2 }, src: 'Zettel 「Schieler bricht, was Büffel schlägt oder sticht」 · Ringeck 주해 58~59절 · Meyer 1570 장검 4장 [원전 2차 — docs/motion/clips/schielhau_*.json 출처] · 길의 수 [추정]' },
  // 거듭 치기(Duplieren): 분노의 베기가 맺힌 자리(긴 자세 위)에서 멈추지 않고 칼자루를 들어 엇걸어, 상대 칼 뒤(칼과 사람 사이)로 머리를 다시 친다
  { name: 'duplieren', nameKo: 'Duplieren (겹치기)', from: G.tagR, path: [[0.12, 0.14], [-0.08, 0.3], [0.12, 0.22], G.pflugL], open: 'UL', kind: 'cut', reach: 0, base: 0.8, presses: true, chain: 2, fit: { parried: 1.5 }, src: 'Ringeck 주해 Duplieren(분노의 베기 뒤 맺음이 단단하면 칼과 사람 사이로 머리를 친다) [원전 2차] · 길 [해석] · 수 [추정]' },
  // 비껴 가로베기 Zwerch mit Abtritt (10/9 — 사장님 '대각선 옆으로 빠르게 살짝 돌아 걸어 들어가면서 옆에서 베기', docs/strike/school_step_2026-10-09.md): 가로베기 길 + step 칸 하나 —
  //  step { lat: 몸 기준 오른쪽 +(m, 왼쪽 −), fwd: 앞(m), when: 'strike'(베기 시작과 함께 비껴 딛음) | 'approach'(먼저 비껴 딛고 발이 닿으면 벰) }. base 는 같은 길 공용 동작의 꾸러미 실제 값. 수는 모두 [추정]
  //  딛는 발은 비껴 가는 쪽 발(앞발이면 내딛고, 뒷발이면 앞발을 지나 그쪽 앞으로 — ai.js techStepRequest). 켬(10/9 12:2x 사장님 '우선 다 켜봐' — 전엔 ai 끔, 롱소드 AI 결정 몫)
  //  길: 처음엔 공용 zwerch(오른 옆 시작·base 0.25)였으나 롱소드 AI 는 그 자리를 거의 안 가서 48 판에 공용 zwerch 도 이것도 0 번 →
  //  리히테나워 Zwerch 처럼 오른 어깨 지붕에서 머리 높이로 가로 [추정], base 는 같은 자리 고유 동작 schielhau 와 같은 0.7 (10/9 잼)
  { name: 'zwerchAbtritt', nameKo: 'Zwerch mit Abtritt (비껴 딛는 가로베기)', from: G.tagR, path: [[0.3, 0.22], [0.0, 0.2], [-0.45, 0.2]], open: 'UL', kind: 'cut', reach: 0, base: 0.7, step: { lat: -0.3, fwd: 0.35, when: 'strike' }, src: 'Meyer 1570 장검 — 삼각 걸음(Triangel)으로 비껴 딛으며 Zwerch(오른쪽에서 칠 때 왼발을 왼쪽 앞으로) [원전 2차] · Zettel 「Zwerch benimmt, was vom Tag dar kommt」 [원전 2차] · 수 [추정]' },
];

// 이탈리아 (카포 페로 1610 — 레이피어, 한손 찌르기). 찌르기 방식 꾸러미의 실제 찌르기 base(stichPflug 0.63·stichAlber 0.54)에 맞춤
const ITALIAN_UNIQUE = [
  // 임브로카타: 프리마(지붕 자리)에서 손을 돌리지 않은 채 상대 왼 어깨에서 오른 무릎 쪽으로 내리꽂는 찌르기
  { name: 'imbroccata', nameKo: 'imbroccata (위에서 내려 찌르기)', from: G.tag, path: [[0.12, 0.3], [0.04, -0.06]], open: 'UL', kind: 'thrust', reach: 0.1, base: 0.55, src: 'Capo Ferro 1610 용어 풀이 「l\'imbroccata si parte dalla prima guardia, & và à ferire dalla spalla sinistra dell\'avversario fino al suo ginocchio dritto … e vuol esser buttata」 PDF 53쪽 [원문] · 길의 수 [추정]' },
  // 파사타 소토(아래로 빠져 찌르기): 몸을 낮춰 상대 칼 밑으로 — 몸 낮추기는 기술 꼴로 못 그린다(찌르기 방식 런지 덧씌우기가 이미 0.16 m 낮춘다).
  //  그래서 낮은 오른쪽(바꿈 자리)에서 아래로 처져 올려 찌르는 길로 둔다. 상대 칼이 높을 때(아래 빈틈 ×1.8) 고르기 쉽다
  { name: 'passataSotto', nameKo: 'passata sotto (밑으로 들어가 찌르기)', from: G.wechselR, path: [[0.2, -0.36], [0.04, -0.16]], open: 'LL', kind: 'thrust', reach: 0.15, base: 0.5, fit: { high: 1.6 }, src: 'Capo Ferro 1610 「punta in falso, che vien di giù in su, verso il petto … ritrovandosi la spada in guardia bassa」 PDF 53쪽 [원문] · 이름 passata sotto [원전 2차] · 몸 낮춤 없음 = 런지 덧씌우기 몫 [해석]' },
  // 카바치오네(칼끝 돌려 빼기): 높이 찌르는 척(황소) → 상대 칼 밑으로 칼끝을 돌려 반대쪽에서 곧게 찌른다 — 속임수 꼴
  { name: 'cavazione', feint: { name: 'cavazione (위 찌르는 척 → 밑으로 돌려 찌름)', fake: 'stichOchs', at: 0.5, then: [[0.12, 0.0], [-0.08, -0.04], G.langort], open: 'C' }, src: 'Capo Ferro 1610 「in quell\'istante si caverà, & stringerà caminando innanzi … si ferirà di quarta di punta nel petto」 PDF 80쪽 [원문] · 속임수 꼴 [해석]' },
  // 인콰르타타: 오른쪽으로 비켜 딛으며(뒷발을 돌려 몸을 상대 칼 줄에서 뺌) 쟁기에서 찌른다 — 먼저 비키고 찌름('approach'). 길 = 공용 stichPflug, base = 레이피어 꾸러미 stichPflug 0.63
  { name: 'inquartata', nameKo: 'inquartata (비껴서며 찌르기)', from: G.pflugR, path: [[0.06, -0.1], G.langort], open: 'C', kind: 'thrust', reach: 0.1, base: 0.63, fast: true, step: { lat: 0.3, fwd: 0.15, when: 'approach' }, src: 'Capo Ferro 1610 inquartata(몸을 상대 칼 줄에서 빼며 찌름) [원전 2차 — 원문 쪽 못 찾음] · 길은 공용 쟁기 찌르기 · 수 [추정]' },
];

// 이베리아 (몬탄테 — 츠바이핸더. 탈류→레베스(규칙 1)는 frames.js NEW_TECH.heavy 에 그대로 둔다: 옮기면 무유파 참치가 잃는다).
//  앞무게 꾸러미의 실제 base(zornhau 1.96·oberhau 1.12·talhoReves 1.1)에 맞춤. 고디뉴 1599 사본은 손글씨라 못 읽었다 → 몬탄테 규칙 요약 [원전 2차]
const IBERIAN_UNIQUE = [
  // 둥근 베기(redondo·molinete): 머리 위로 칼을 돌려 가로베기를 두 번 — 오른 어깨 → 오른 옆 → 왼 옆 → 머리 위로 넘겨 → 오른 옆 → 왼 옆. 둘러싸였을 때 사방을 쓴다
  //  시작은 오른 어깨 지붕(앞무게가 간 보는 높은 자세) — 처음(오른 옆 자세 시작·base 0.6)엔 혼자 켜면 48 판에 한 번도 안 골랐다. 어깨로 옮겨도 0 →
  //  같은 자리의 분노의 베기(1.96)에 밀린 것이라 base 를 같은 몬탄테 여러 칼 길 talhoReves 와 같은 1.1 로 (10/9 잼)
  { name: 'redondo', nameKo: 'redondo (머리 위 돌려 베기)', from: G.tagR, path: [G.sideR, [0.0, 0.1], G.sideL, [-0.3, 0.45], [0.3, 0.45], G.sideR, [0.0, 0.1], G.sideL], open: 'UL', kind: 'cut', reach: 0.05, base: 1.1, chain: 2, src: '몬탄테 규칙의 머리 위 돌려 베기(redondo·molinete) — Godinho 1599 · Figueiredo 1651 요약 [원전 2차] · 길 [해석] · 수 [추정]' },
  // 내려 올려 베기(altibaixo): 지붕에서 곧게 내려베고(altabaixo) 같은 줄로 곧장 되올려 다시 지붕 — 흐름이 다음 내려베기로 잇는다
  { name: 'altibaixo', nameKo: 'altibaixo (위아래 사슬)', from: G.tag, path: [[0.0, 0.14], G.alber, [0.02, -0.1], [0.02, 0.3], G.tag], open: 'H', kind: 'cut', reach: 0, base: 0.9, presses: true, chain: 2, src: '몬탄테 altabaixo(위에서 아래로) + 되올림 — Godinho 1599 · Figueiredo 1651 요약 [원전 2차] · 되올림 [해석] · 수 [추정]' },
  // 바퀴로 받기: 맞받아 베기를 탈류→레베스(8자)로 — 몬탄테는 받는 칼도 멈추지 않고 돌린다. 맞받아치기 목록 꼴(같은 거리면 앞 이름이 이긴다)
  { name: 'rodaCounter', counter: { highR: ['talhoReves', 'zornhauL', 'oberhau', 'zornhau'], default: ['talhoReves', 'zornhau', 'oberhau', 'zornhauL'] }, src: '몬탄테 규칙 1 탈류·레베스를 받는 자리에서 [원전 2차] · 맞받아치기에 씀 [해석]' },
  // 돌아 들며 탈류(talho rodeado): 오른쪽 앞으로 둥글게 돌아 딛으며 오른 어깨에서 사선 내려베기 — 길 = 공용 zornhau(talho), base = 앞무게 꾸러미 zornhau 1.96
  { name: 'talhoRodeado', nameKo: 'talho rodeado (둥근 걸음 탈류)', from: G.tagR, path: [[0.12, 0.14], G.wechselL], open: 'UL', kind: 'cut', reach: 0, base: 1.96, presses: true, step: { lat: 0.35, fwd: 0.3, when: 'strike' }, src: '몬탄테 규칙의 둥근 걸음(원을 그리며 나아감) — Godinho 1599 · Figueiredo 1651 요약 [원전 2차] · 이름 붙임 [해석] · 수 [추정]' },
];

// ── 패시브 고유 동작 (10/9 — 사장님 02:1x '어떤 고유 동작은 패시브여도 좋을 거 같아', docs/strike/school_passive_design_2026-10-09.md) ──
//  능동 고유 동작(unique)은 AI 가 빈틈을 보고 고르는 길이고, 패시브(passives)는 상황(사건)이 오면 저절로 나오는 반응이다.
//  꼴: { name, nameKo, when: 사건 열쇠(하나 또는 여럿), cond: 사건 안의 조건(없으면 늘), do: 행동 하나, p: 발동 확률, src, ai:false = 자료만 }
//   사건 열쇠 — landed 맞힘 · missed 헛침 · parried 내 칼이 막힘 · bindDef 막는 중 칼 맞닿음 · threat 상대 칼이 들어옴 ·
//    foeRaise 상대가 칼을 듦 · foeCharge 상대가 달려듦 · foeRecover 상대가 헛치고 자세 잡기 전 · foeStepIn 상대가 간격 안으로 걸어 듦 ·
//    pressed 몰아치는 상대에게 물러남 · standoff 둘 다 간 보기(위협 없음 2 s 넘게, 상대 손 느림)
//   cond — thrust(들어오는 칼이 찌르기)·cut(베기)·line(들어오는 줄 목록)·myThrust(방금 내 기술이 찌르기)
//   do — tech(그 기술로 곧장, 목록이면 손에서 가까운 것 — far 면 먼 것, alt = 없을 때 대신) · chain(이어 치기 차례) · withdraw(그 자세로 겨누며 물러남, time) ·
//    counter(이 위협의 맞받아치기 목록, 또는 줄마다 목록 { thrust·lowL·…·default } — 굴려 나오면 확정: 손에서 가까운 것을 거리 문턱 없이, 준비 자세를 빠르게 거쳐) · chamber(tech 꼴도 준비 자세를 거친다) · parry/void(막기/피하기) · feint(속임수 이름) · prefer(기술 고르기 가중치: thrust·fast·presses) · why(공격 까닭) · at:'end'(물러남 끝에)
//  실제 확률 = p × (0.5 + 0.5 × 읽는 눈 L.read). 한 사건에 한 번만 굴린다. 그 사건의 패시브가 없는 유파는 난수를 하나도 더 쓰지 않는다(독일 끔 → 롱소드 관문 바이트 같음).
//  p 값은 모두 사장님 확인 전(확인표). 발동 자리는 ai.js passiveFor 를 부르는 곳들
// 독일 (리히테나워·마이어) — 켬(사장님 10/9 12:xx '우선 다 켜봐'). **10/9 13:xx 재편**(docs/strike/passive_fire_2026-10-09.md — 사장님 '패시브가 거의 안 나온다·개념이 달라야'):
//  받기·따라가기·겹치기 셋으로 — Absetzen·Überlaufen(맞받아치기 둘, 준비 자세 거리 규칙에 걸려 거의 못 냄)을 Indes 하나로 합치고, 상대가 헛친 뒤를 따라 들어가는 Nachreisen 을 더했다
const GERMAN_PASSIVES = [
  // 맞받기(Indes): 들어오는 칼을 막지 않고 그 줄에 맞서 가운데를 차지하며 그대로 친다 — 찌르기는 쟁기·황소로 받아 찌르고(옛 Absetzen),
  //  낮은 베기는 위에서 넘어 치고(옛 Überlaufen), 높은 베기는 분노의 베기·정수리 베기로 맞받는다. 굴려 나오면 확정(준비 자세가 멀면 빠르게 거친다 — ai.js passiveThreat)
  { name: 'indes', nameKo: 'Indes (맞받기)', when: 'threat', do: { counter: { thrust: ['stichPflug', 'stichOchs'], lowL: ['oberhau', 'zornhau'], lowR: ['oberhau', 'zornhau'], highL: ['zornhau', 'zornhauL', 'oberhau'], highR: ['zornhau', 'zornhauL', 'oberhau'], highC: ['zornhau', 'zornhauL', 'oberhau'] } }, p: 0.7, src: 'Zettel 「Indes」·「Absetzen」·「Überlaufen」 · Ringeck 주해 [원전 2차] · 줄마다 기술 [해석]' },
  // 따라 들어가기(Nachreisen): 상대가 헛치고 칼을 다시 들기 전(seize 의 recovering)에 따라 들어가며 친다 — 준비 자세를 빠르게 거치고(chamber) 내디딘다
  { name: 'nachreisen', nameKo: 'Nachreisen (따라 들어가기)', when: 'foeRecover', do: { tech: ['zornhau', 'oberhau', 'stichPflug'], why: 'recover', chamber: true }, p: 0.8, src: 'Zettel 「Nachreisen」 · Ringeck 주해 [원전 2차]' },
  // 겹치기: 막혀 칼이 맞물리면 물러나지 않고 상대 칼 뒤로 곧장 가로베기 (zwerch·zwerchL 가운데 손에서 가까운 쪽)
  { name: 'duplieren', nameKo: 'Duplieren (겹치기)', when: 'parried', do: { tech: ['zwerch', 'zwerchL'], why: 'follow' }, p: 0.6, src: 'Ringeck 주해 Duplieren [원전 2차] · 가로베기로 [해석]' },
];
// 이탈리아 (카포 페로, 레이피어). 물러남(Ritirata — 테르차 = 긴 자세로 칼끝을 겨눈 채 물러남)은 패시브가 아니라 유파 withdraw 값으로 넣었다(TRADITIONS.italian)
const ITALIAN_PASSIVES = [
  // 상대 박자(칼을 들거나 달려드는 순간)에 찌른다 — 무거운 베기 말고. 치기 가지를 늘 고르고, 기술 고르기는 'windup'(빠른 기술) 셈에 찌르기 ×3
  //  (stop 셈은 찌르기를 0.3 으로 깎아 뜻과 어긋난다 — 공격 까닭만 stop: 조금 일찍 치고 내딛지 않는다)
  { name: 'contratempo', nameKo: 'contratempo (박자 찌르기)', when: ['foeRaise', 'foeCharge'], do: { prefer: { thrust: 3.0 }, why: 'stop' }, p: 0.8, src: 'Capo Ferro 1610 「contratempo」 [원전 2차]' },
  // 칼이 맞물리면 빼서 반대편으로 찌른다 (stichPflug ↔ stichPflugL, 지금 손에서 먼 쪽)
  { name: 'cavazione', nameKo: 'cavazione (맞물림에서 빼 찌름)', when: ['parried', 'bindDef'], do: { tech: ['stichPflug', 'stichPflugL'], far: true, why: 'riposte' }, p: 0.7, src: 'Capo Ferro 1610 「si caverà」 PDF 80쪽 [원전 2차]' },
];
// 이베리아 (몬탄테, 츠바이핸더)
const IBERIAN_PASSIVES = [
  // 베어서 막기: 들어오는 베기를 가만히 받지 않고 그쪽으로 탈류를 친다 (맞받아치기 굴림 없이 곧장)
  { name: 'talhoParry', nameKo: '베어서 막기 (talho)', when: 'threat', cond: { cut: true }, do: { counter: ['zornhau', 'zornhauL', 'talhoReves'] }, p: 0.8, src: '몬탄테 규칙 — 받기보다 벤다 (Godinho 1599 · Figueiredo 1651 요약) [원전 2차]' },
  // 이어 돌기: 헛치거나 막혀도 멈추지 않고 반대 어깨로 흘러 벤다
  { name: 'seguirRoda', nameKo: '이어 돌기', when: ['missed', 'parried'], do: { chain: ['talhoReves'] }, p: 0.9, src: '몬탄테 규칙 1 [원전 2차]' },
  // 돌려 물러남: 몰아치는 상대에게 가로로 한 번 베고 물러난다
  { name: 'rodaRetirada', nameKo: '돌려 물러남', when: 'pressed', do: { tech: ['zwerch', 'zwerchL'], why: 'press' }, p: 0.5, src: '[해석]' },
];
// 일본 (카타나 가족, 모노호시자오)
const JAPANESE_PASSIVES = [
  // 残心: 맞힌 뒤 이어 치지 않고 中段(긴 자세)으로 칼끝을 겨눈 채 길게 물러난다. 일본 간 보는 자세(높은 자세)에 긴 자세가 없어 그 자세 하나만 빌려 쓴다(ai.js passiveGuard)
  { name: 'zanshin', nameKo: '残心', when: 'landed', do: { withdraw: 'langort', time: 1.2 }, p: 1.0, src: '兵法家伝書 p18/18 「殘心之事 懸待ともに用」 [원문] · 검도형 각 本 끝 残心 [원문]' },
  // 出端: 상대가 칼을 들거나 걸어 드는 순간 먼저 친다 — 치기 가지를 늘 고르고, 빠른 기술 ×2 · 누르는 베기 ×1.5
  { name: 'debana', nameKo: '出端 (데바나)', when: ['foeRaise', 'foeStepIn'], do: { prefer: { fast: 2.0, presses: 1.5 } }, p: 1.0, src: '兵法家伝書 p16/15 「一ッ上れば、つけて打」 [원문] · 오륜서 表4 [원문]' },
  // 返し: 받은 칼을 그대로 되받아 벤다 — 燕返し 길(없으면 정수리 베기)
  { name: 'kaeshi', nameKo: '返し (카에시)', when: 'bindDef', do: { tech: 'tsubameGaeshi', alt: 'oberhau', why: 'riposte' }, p: 0.8, src: '오륜서 表2 [원문]' },
];
// 중국 (조선세법, 청강검)
const CHINESE_PASSIVES = [
  // 斂翅: 몰려 물러나다가 물러남 끝에 갑자기 들어가며 腰擊 (속임수 꼴 고유 동작 lianchi 와 이름만 같다 — 이것은 물러남에 붙는 패시브)
  { name: 'lianchi', nameKo: '斂翅 (패한 척 물러났다 腰擊)', when: 'pressed', do: { tech: ['zwerch', 'zwerchL'], why: 'press', at: 'end' }, p: 0.5, src: '무비지 쪽174/0588 「佯北誘賺… 倒退進步腰擊」 [원문]' },
  // 刺→擊 고리: 찌른 뒤(맞든 헛치든) 곧장 腰擊 (yaoji 길, 없으면 zwerch)
  { name: 'ciji', nameKo: '刺→擊 고리', when: ['missed', 'landed'], cond: { myThrust: true }, do: { chain: ['yaoji'], alt: 'zwerch' }, p: 0.8, src: '무비지 쪽158/0572 「向前進步腰擊」 [원문]' },
  // 看守: 상대가 머뭇거리면 기미를 따라 굴려 친다
  { name: 'kanshou', nameKo: '看守 (간수)', when: 'standoff', do: { tech: ['zwerch', 'zwerchL'], why: 'open' }, p: 0.4, src: '무도 권2 p039/31 「相機隨勢滾殺」 [원문]' },
];

// ── 공용 동작 이름 (techNames — 10/9 고유 동작 단계, 자료만) ──
//  공용 동작 = TECH 12 + 라이브러리 셋(talhoReves·wristCut·molinello). 동작은 같고 유파 말만 다르다. HUD 는 기술 이름을 보이지 않는다(코드 없음) — 문서·갤러리용
const nm = (name, src) => (src ? { name, src } : { name });
export const TECH_NAMES = {
  german: {
    zornhau: nm('분노의 베기 (Zornhau)', 'Zettel·Meyer 1570 4장'), zornhauL: nm('왼 분노의 베기'), oberhau: nm('정수리 베기 (Oberhau·Scheitelhau 꼴)', 'Meyer 1570 4장'), zwerch: nm('가로베기 (Zwerchhau)', 'Zettel 「Zwerch benimmt, was vom Tag dar kommt」'), zwerchL: nm('왼 가로베기'),
    unterhau: nm('올려베기 (Unterhau)', 'Meyer 1570'), unterhauL: nm('왼 올려베기'), stichPflug: nm('쟁기 찌르기 (Pflug)'), stichPflugL: nm('왼 쟁기 찌르기'), stichOchs: nm('황소 찌르기 (Ochs)'), stichOchsL: nm('왼 황소 찌르기'), stichAlber: nm('바보 찌르기 (Alber)'),
    talhoReves: nm('분노의 베기 좌우 이어 (Zornhau 8자)', '[해석]'), wristCut: nm('손 베기 (Abschneiden 꼴)', '[해석]'), molinello: nm('돌려 베기 (Radschlag 꼴)', '[해석]'),
  },
  italian: {
    zornhau: nm('mandritto squalembrato (오른쪽 사선 내려베기)', 'Capo Ferro 용어 풀이 [원전 2차]'), zornhauL: nm('riverso squalembrato (왼쪽 사선)'), oberhau: nm('fendente (곧게 내려베기)'), zwerch: nm('mandritto tondo (가로)'), zwerchL: nm('riverso tondo'),
    unterhau: nm('montante (올려베기 — 이탈리아 말)'), unterhauL: nm('riverso montante'), stichPflug: nm('stoccata (terza 에서 아래로부터)', 'Capo Ferro PDF 53쪽 「la stoccata … si parta dalla terza」 [원문]'), stichPflugL: nm('punta riversa (quarta 에서)', 'Capo Ferro PDF 53쪽 [원문]'),
    stichOchs: nm('punta dritta alta (seconda)', '[해석]'), stichOchsL: nm('punta riversa alta'), stichAlber: nm('stoccata bassa', '[해석]'),
    talhoReves: nm('mandritto e riverso'), wristCut: nm('stramazzone (손목 끝 베기)', '[원전 2차]'), molinello: nm('molinello', '[원전 2차]'),
  },
  iberian: {
    zornhau: nm('talho (오른쪽 사선)', '몬탄테 규칙 [원전 2차]'), zornhauL: nm('revés (왼쪽 사선)', '[원전 2차]'), oberhau: nm('altabaixo (위에서 아래로)', '[원전 2차]'), zwerch: nm('talho horizontal', '[해석]'), zwerchL: nm('revés horizontal', '[해석]'),
    unterhau: nm('talho de baixo (올려베기)', '[해석]'), unterhauL: nm('revés de baixo', '[해석]'), stichPflug: nm('estocada'), stichPflugL: nm('estocada (왼쪽)'), stichOchs: nm('estocada alta'), stichOchsL: nm('estocada alta (왼쪽)'), stichAlber: nm('estocada baixa'),
    talhoReves: nm('talho e revés (규칙 1)', '몬탄테 규칙 1 [원전 2차]'), wristCut: nm('talho curto (손 베기)', '[해석]'), molinello: nm('molinete', '[원전 2차]'),
  },
  japanese: {
    zornhau: nm('袈裟 (けさ) 斬り', '이름 [전승] · 오륜서 「筋かひにきる」 R16/24 [원문]'), zornhauL: nm('左袈裟'), oberhau: nm('真向 (정수리 베기) · 正面打ち', '검도형 p06/5 · 오륜서 表2·表5'), zwerch: nm('胴 (どう)', '검도형 7본 右胴'), zwerchL: nm('逆胴'),
    unterhau: nm('切り上げ', '오륜서 「下より…手をはる」'), unterhauL: nm('逆袈裟', '이름 [전승]'), stichPflug: nm('突き (청안에서)', '검도형 3·4·7본'), stichPflugL: nm('突き (왼 허리에서)'), stichOchs: nm('突き (머리 옆에서)'), stichOchsL: nm('突き (왼 머리 옆에서)'), stichAlber: nm('突き (하단에서)'),
    talhoReves: nm('左右垂劍打', '무도 권2 p142/134 교전 [원문] · 이름 붙임 [해석]'), wristCut: nm('片手小手', '[해석]'), molinello: nm('손목 돌려 베기 (원전 없음)'),
  },
  chinese: {
    zornhau: nm('과우격 (跨右擊)', '무비지 跨右 「撩剪下殺」 [원문] · 자리 [해석]'), zornhauL: nm('과좌격 (跨左擊)', '무비지 쪽171/0585 「掃掠下殺」'), oberhau: nm('표두격 (豹頭擊)', '무비지 쪽157/0571 「霹擊上殺」'), zwerch: nm('요격 (腰擊)', '무비지 쪽166/0580 「劍中之首擊」'), zwerchL: nm('좌요격 (左腰擊)', '본국검 p036/28'),
    unterhau: nm('요략 (撩掠)', '무도 권2 p038/30 「遮駕下殺」'), unterhauL: nm('흔격 (掀擊)', '「掀抵上殺」 [원문] · 자리 [해석]'), stichPflug: nm('탄복자 (坦腹刺)', '무비지 쪽158/0572'), stichPflugL: nm('좌협자 (左夾刺)', '무도 권2 p043/35'),
    stichOchs: nm('역린자 (逆鱗刺)', '무비지 쪽173/0587'), stichOchsL: nm('우협자 (右夾刺)', '[해석]'), stichAlber: nm('점검 (點劍)', '무비지 쪽155/0569'),
    talhoReves: nm('과좌·과우 번갈아', '[해석]'), wristCut: nm('어거 (御車) 손 깎기', '무비지 쪽161/0575 「削殺雙手」'), molinello: nm('살화개정 (撒花蓋頂)', '검결가 쪽151/0565 「右滾花六劍」'),
  },
  none: {
    zornhau: nm('사선 내려치기'), zornhauL: nm('왼 사선 내려치기'), oberhau: nm('내려치기'), zwerch: nm('가로 휘두르기'), zwerchL: nm('왼 가로 휘두르기'), unterhau: nm('올려치기'), unterhauL: nm('왼 올려치기'),
    stichPflug: nm('허리에서 찌르기'), stichPflugL: nm('왼 허리에서 찌르기'), stichOchs: nm('머리 옆에서 찌르기'), stichOchsL: nm('왼 머리 옆에서 찌르기'), stichAlber: nm('아래에서 찌르기'),
    talhoReves: nm('좌우 이어 치기'), wristCut: nm('손 치기'), molinello: nm('돌려 치기'),
  },
};

// 유파 전통 여섯 (사장님 10/8 20:xx: 유파 5 + 무유파). rest = 쉴 자세(보정 v2 ③ 되돌아옴 겨눔의 목표) — 사장님 10/8 21:5x '유파가 정한다'
//  (독일 쟁기/긴 자세 · 이탈리아 테르차 · 이베리아 중단형 · 일본 中段 · 중국 中平 · 무유파 앞으로 겨눔). null = SKILL.homeGuard(쟁기 자리) 그대로.
//  일본·중국 rest = 'langort'(긴 자세 자리 [0.0, 0.03] = 中段·中平) — **사장님 10/9 01:2x 답: 안 A**(확인표 198). 쉴 자세는 스위치(SKILL.schoolArt)와 상관없이 늘 쓴다(플레이어 ③ 되돌아옴만).
//  비교용 `?schoolRest=pflugR`(= 안 B, 쟁기 자리 = SKILL.homeGuard — 10/9 00:49 까지의 판)
export const TRADITIONS = {
  // 독일: 두손 두루(롱소드·엑스칼리버·라이트세이버·에스톡)와 한손 베기(세이버·팔쉬온 — 두삭 가지).
  //  가지(branches, 열쇠 = 몸 틀:싸움 방식): 두삭(한손 베기)은 찌르기를 덜 믿는다 — 찌르기 기술 가중치 × thrustK (전 schools.js 세이버·팔쉬온 weakThrust 0.5 그대로) · 이름은 DUSSACK_NAMES (sword_art.js schoolNames 가 가지 이름을 먼저 읽는다)
  german: { id: 'german', nameKo: '독일', ...GERMAN, branches: { 'one:cut': { nameKo: '두삭 (한손 베기)', thrustK: 0.5, names: DUSSACK_NAMES } }, rest: null, techNames: TECH_NAMES.german, unique: GERMAN_UNIQUE, passives: GERMAN_PASSIVES, temper: GERMAN_TEMPER },
  // 이탈리아 물러남(10/9 패시브 단계 — Ritirata): 몰리면 테르차(긴 자세)로 칼끝을 겨눈 채 물러난다, 그 밖엔 긴 자세·쟁기 (전 독일 값 황소 · 쟁기·긴 자세).
  //  레이피어 간 보는 자세(WATCH_GUARDS)에 긴 자세가 있다 — 재기 손잡이 motion_lab SCHOOL_RITIRATA=0 (전 값)
  // 이탈리아: 한손 찌르기(레이피어). 지금은 독일 내용 그대로(전 레이피어 꾸러미 = 롱소드 꾸러미 + 간격) — 카포 페로 자료는 다음 단계 — 10/9 고유 동작 셋(unique)과 공용 동작 이름(techNames)은 따로 가진다
  italian: { id: 'italian', nameKo: '이탈리아', ...GERMAN, withdraw: { pressed: 'langort', calm: ['langort', 'pflugR'] }, rest: null, techNames: TECH_NAMES.italian, unique: ITALIAN_UNIQUE, passives: ITALIAN_PASSIVES, temper: ITALIAN_TEMPER },
  // 이베리아: 앞무게 베기·때리기(츠바이핸더·냉동 참치) — 몬탄테. 지금은 독일 내용 그대로(전 두 꾸러미 = 롱소드 꾸러미 + 간격) — 10/9 고유 동작 셋(unique)과 공용 동작 이름(techNames)은 따로 가진다
  iberian: { id: 'iberian', nameKo: '이베리아', ...GERMAN, rest: null, names: IBERIAN_NAMES, techNames: TECH_NAMES.iberian, unique: IBERIAN_UNIQUE, passives: IBERIAN_PASSIVES, temper: IBERIAN_TEMPER },
  // 일본: 카타나 가족(지금 모노호시자오 — 스펙 school). 기술·속임수·막기 자리는 독일 내용 그대로, 그 위에 유파 자료.
  //  간 보는 자세·물러남 = 한 칼 자세(上段·八相에서 기다렸다 들어오는 순간 벤다 — 10라운드 6-7 무기 PM, 전 WEAPON_OVER.monohoshizao 그대로 옮김).
  //  맞받아치기 후보(초안 §12 counter: 真向 먼저)는 이번엔 넣지 않았다(지시 범위 밖 — 문서에 후보로)
  japanese: { id: 'japanese', nameKo: '일본', ...GERMAN, guards: HIGH_GUARDS, withdraw: { pressed: 'tagR', calm: ['tagR', 'tag'] }, rest: 'langort', names: JAPANESE_NAMES, techK: JAPANESE_TECHK, techNames: TECH_NAMES.japanese, unique: JAPANESE_UNIQUE, spare: JAPANESE_SPARE, passives: JAPANESE_PASSIVES, temper: JAPANESE_TEMPER },
  // 중국: 청강검·지안(스펙 school). 기술 목록 = 지금 지안 꾸러미 그대로 (기술별 reach 보정은 청강검 실측 — ③ 단계에서 무기 쪽으로 가를 후보), 그 위에 유파 자료.
  //  맞받아치기(초안 §8): 막은 뒤 곧장 찌른다 — 찌르기 먼저 [추정]
  //  물러남(10/9 腰擊 쓰임): 몰려 물러날 때 腰擊勢(옆 자세)로 거둔다 — 斂翅 「佯北誘賺… 倒退進步腰擊」(무비지 쪽174/0588 [원문]): 물러나며 腰擊을 들고 있다가 들어가 벤다.
  //   그 밖(calm)은 독일 그대로(쟁기·긴 자세 — 坦腹·中平, 찌르기 쪽). 전엔 독일 값(pressed 황소)이라 기술을 고를 때 손이 옆 자세 0.2 m 안에 있던 적이 48 판 pickTech 502 번 가운데 0 번
  chinese: { id: 'chinese', nameKo: '중국', ...GERMAN, guards: CHINESE_GUARDS, withdraw: { ...GERMAN.withdraw, pressed: 'sideR' }, tech: jianTech, techByName: byName(jianTech), rest: 'langort', names: CHINESE_NAMES, techK: CHINESE_TECHK, counterArt: { default: ['stichPflug', 'zwerch', 'zornhau'] }, techNames: TECH_NAMES.chinese, unique: CHINESE_UNIQUE, passives: CHINESE_PASSIVES, temper: CHINESE_TEMPER },
  // 무유파: 둔기(나뭇가지·고무 닭·모르겐슈테른)·총. 지금은 독일 내용 그대로 — 날 없는 무기의 찌르기 빼기는 싸움 방식 규칙(weaponSchool)
  none: { id: 'none', nameKo: '무유파', ...GERMAN, rest: null, names: NONE_NAMES, techNames: TECH_NAMES.none, unique: [], passives: [], temper: NONE_TEMPER }, // 무유파: 고유 동작 없음 — 공용 동작만(사장님 10/9 01:5x)
};

// 유파 자료 켬 묶음 (재기 전용): SKILL.schoolArt 1 일 때 무엇을 입히나. 기본 모두 true — 도구(motion_lab)만 하나씩 끄고 켜 본다. 다른 곳은 읽지 않는다
export const SCHOOL_ART = { weights: true, rest: true, counter: true, unique: true }; // unique: 유파 고유 동작 가운데 ai:false 가 아닌 것을 꾸러미에 더함(옛 이름 newTech — 10/9 고유 동작 단계에서 이름 바꿈). 독일 셋은 ai:false(사장님 확인 전), 재면 motion_lab SCHOOL_UNIQUE= 로 켬

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
