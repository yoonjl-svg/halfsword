// 스킬트리 자료 · 규칙 (10/21 사장님 확정 — docs/design/skill_tree_2026-10-21/README.md · data.mjs 가 원본 · 이 파일 = 게임이 읽는 판)
//  유파마다 11 칸 · 뿌리 = 보법 I · pre = 먼저 익힐 칸 '모두'(독일 2단계 관문 · 이탈리아 보법 II 줄기 · 이베리아 패시브 → 비기 · 독일 보법 II → 패시브 → 비기가 이미 여기 들어 있다).
//  값(사장님 10/21 19:0x): 편지 금화 100 · 패시브 머리 10(금화 없음) · 보법 II 금화 100 · 비기 금화 400 + 머리 20 · 나머지는 깊이마다 금화 — data.mjs 그대로.
//  닫힌 칸: 비기는 SECRET.openSchools(config — 지금 일본만)에 없으면 '준비 중'(사람 · 살 수 없음 — 10/21 20:xx) · 일본 J8 손목 치기 심화는 이점이 아직 없어 '준비 중'(확인표 2107).
//  칸 → 판 몫(아래 f · u · perk): 칸 하나가 제 몫 하나만 켠다 — 몫 열쇠는 skill_kit.js kitOff 가 싸움 코드에서 읽는다(사람만 · AI 는 숙련도 그대로).
//   표 · 근거: IMPLEMENTATION.md §2 · docs/strike/school_kit_map.md §2 '스킬트리'. 글(l1 · l2 · eff)은 화면 글 지침(docs/text/editing_guide.md) — data.mjs eff 는 설계 메모라 고쳐 씀.
//  이 파일은 저장 · 화면을 모른다(시험이 바로 읽음) — 저장은 skill_tree_store.js · 화면은 skill_tree.js.
import { SECRET, LETTER } from './config.js';

/** 탭 차례 (감독 10/16: 독일 · 이탈리아 · 이베리아 · 일본 · 동방) */
export const TREE_SCHOOLS = Object.freeze(['german', 'italian', 'iberian', 'japanese', 'chinese']);

/** 칸 갈래 — label = 상세 카드 갈래 글 · tier = 색(등급 색 --tier-* — entrance_type.css [data-tier], 옛 책 급 색 그대로) · stage = 개발 인자 ?uniqueStage=N 의 옛 급(1 보법 … 5 비기) */
export const NODE_CAT = Object.freeze({
  foot: { label: '보법', tier: 'common', stage: 1 },
  parry: { label: '막기', tier: 'uncommon', stage: 2 },
  atk: { label: '고유 공격', tier: 'rare', stage: 3 },
  deep: { label: '심화', tier: 'rare', stage: 3 },
  passive: { label: '패시브', tier: 'epic', stage: 4 },
  secret: { label: '비기', tier: 'legend', stage: 5 },
  letter: { label: '편지', tier: 'mystery', stage: null },
});

/** 판 몫 열쇠 (skillKit 칸 — 칸이 없으면 false). unique · perk 는 이름 모음 */
export const KIT_KEYS = Object.freeze(['footwork', 'chase', 'backFlat', 'burstSide', 'stepCost', 'parry', 'parryCover', 'parryCut', 'opposition', 'flow', 'flowShield', 'ibFlow', 'passive', 'secret']);

export const RESET_HEADS = 1; // 유파 초기화 값 — 머리 1 (사장님 10/21)

// 칸 하나: id · cat · pre(모두) · price(금화) · heads(머리) · opt(곁가지 — 점선) · closed(늘 닫힘) · d(줄) · cx(가로 0~1000 — data.mjs 그대로)
//  name = 트리 판 칸에 보이는 기술 이름 (사장님 10/22 '보법1 보법2 이런 건 우리가 보려고 만든 범주 구분 … 아이콘만 보이거나 기술 이름이 보이는 게' — 갈래(보법 I · 막기 II · 패시브 …)는 상세 카드에만)
//  l1 · l2 = 옛 판 칸의 두 줄(갈래 · 이름 — 알림 · 읽기 이름에 남음) · title · orig = 상세 카드 제목(없으면 두 줄 · 원어는 대기실 스킬에서만 — 화면 글 지침 §1) · eff = 상세 카드 효과 한 줄 · f = 켜는 몫 열쇠 · u = 켜는 고유 공격(unique_assist.js PLAYER_UNIQUE name) · perk = 켜는 강화동작 이점 · letter = 편지
const N = (o) => Object.freeze({ pre: [], heads: 0, ...o, pre: Object.freeze(o.pre ?? []), f: Object.freeze(o.f ?? []) });
const TREE_SRC = {
  german: {
    gate: { from: ['G5', 'G8', 'G3'], to: ['G7', 'G6', 'G4'] }, // 2단계 셋을 모두 익히면 3단계가 열림 (사장님 18:5x — 그림의 금색 띠)
    nodes: [
      N({ id: 'G1', name: '뒤 박차기', cat: 'foot', l1: '보법 I', l2: '뒤 박차기', eff: '서 있다가 뒤로 밀면 첫 걸음을 박찬다', price: 100, d: 0, cx: 500, f: ['footwork'] }),
      N({ id: 'G2', name: '간격 잡기', cat: 'foot', l1: '보법 II', l2: '간격 잡기', eff: '상대가 헛치면 두 걸음 빠르게 들어가 선다', pre: ['G1'], price: 100, d: 1, cx: 100, f: ['chase'] }),
      N({ id: 'G5', name: '곁눈 베기', cat: 'atk', l1: '곁눈 베기', l2: '강화동작', eff: '분노의 베기를 그으면 더 힘 있는 곁눈 베기가 나간다', pre: ['G1'], price: 200, d: 1, cx: 310, u: 'schielhau' }),
      N({ id: 'G8', name: '비껴 딛는 가로베기', cat: 'atk', l1: '비껴 딛는', l2: '가로베기', eff: '옆으로 걸으며 가로로 긋는다', pre: ['G1'], price: 200, d: 1, cx: 500, u: 'zwerchAbtritt' }),
      N({ id: 'G3', name: '세워 받기', cat: 'parry', l1: '막기 I', l2: '막기 자리', eff: '오는 칼 쪽에 칼을 세워 받는다', pre: ['G1'], price: 200, d: 1, cx: 690, f: ['parry'] }),
      N({ id: 'G11', name: '뉘른베르크에서 온 편지', cat: 'letter', l1: '뉘른베르크', l2: '온 편지', title: '뉘른베르크에서 온 편지', pre: ['G1'], price: 100, opt: true, d: 1, cx: 900, letter: true }),
      N({ id: 'G7', name: '겹치기', cat: 'atk', l1: '겹치기', l2: '이어 긋기', eff: '칼이 맞물리면 곧바로 다시 그어 들어간다', pre: ['G5', 'G8', 'G3'], price: 300, d: 2, cx: 310, u: 'duplieren' }),
      N({ id: 'G6', name: '무릎 꺾기', cat: 'deep', l1: '심화', l2: '무릎 꺾기', title: '곁눈 베기 심화 · 무릎 꺾기', eff: '곁눈 베기에 맞은 상대가 무릎을 꿇기도 한다', pre: ['G5', 'G8', 'G3'], price: 300, d: 2, cx: 500, perk: 'schielhau' }),
      N({ id: 'G4', name: '왕관', cat: 'parry', l1: '막기 II', l2: '왕관', title: '막기 II · 왕관 (크론)', orig: 'Kron', eff: '머리 위로 오는 칼을 칼자루로 받는다', pre: ['G5', 'G8', 'G3'], price: 300, d: 2, cx: 690, f: ['parryCover'] }),
      N({ id: 'G9', name: '인데스', cat: 'passive', l1: '패시브', l2: '인데스', eff: '상대가 헛치거나 막힌 직후에 친 칼은 피해가 증가한다', pre: ['G2'], price: 0, heads: 10, d: 2, cx: 100, f: ['passive'] }),
      N({ id: 'G10', name: '받아 베기', cat: 'secret', l1: '비기', l2: '받아 베기', eff: '치명적인 칼이 들어올 때 공격하면, 받아내며 동시에 벤다', pre: ['G9', 'G7', 'G4'], price: 400, heads: 20, d: 3, cx: 420, f: ['secret'] }),
    ],
  },
  italian: {
    nodes: [
      N({ id: 'I1', name: '박자 걸음', cat: 'foot', l1: '보법 I', l2: '박자 걸음', eff: '짧게 두 번, 길게 두 번 박자를 타며 걷는다', price: 100, d: 0, cx: 500, f: ['footwork'] }),
      N({ id: 'I11', name: '시에나에서 온 편지', cat: 'letter', l1: '시에나에서', l2: '온 편지', title: '시에나에서 온 편지', pre: ['I1'], price: 100, opt: true, d: 1, cx: 860, letter: true }),
      N({ id: 'I3', name: '물러서기', cat: 'foot', l1: '보법 II', l2: '물러서기', eff: '뒤로 걸어도 느려지지 않는다', pre: ['I1'], price: 100, d: 1, cx: 500, f: ['backFlat'] }),
      N({ id: 'I2', name: '비껴서며 찌르기', cat: 'atk', l1: '비껴서며', l2: '찌르기', eff: '옆으로 걸으며 찌른다', pre: ['I3'], price: 200, d: 2, cx: 330, u: 'inquartata' }),
      N({ id: 'I5', name: '뻗어 받기', cat: 'parry', l1: '막기 I', l2: '막기 자리', eff: '팔을 뻗고 칼끝을 곧게 둔 채 받는다', pre: ['I3'], price: 200, d: 2, cx: 670, f: ['parry', 'parryCover'] }),
      N({ id: 'I7', name: '위에서 내려 찌르기', cat: 'atk', l1: '위에서', l2: '내려 찌르기', eff: '황소 찌르기를 하면 위에서 내려 찌르기가 나간다', pre: ['I2'], price: 300, d: 3, cx: 330, u: 'imbroccata' }),
      N({ id: 'I6', name: '막아찌르기', cat: 'parry', l1: '막기 II', l2: '막아찌르기', eff: '막기를 누르면 바로 짧게 찌르고, 그동안 받는 피해가 줄어든다', pre: ['I5'], price: 300, d: 3, cx: 670, f: ['opposition'] }),
      N({ id: 'I8', name: '틈 파고들기', cat: 'deep', l1: '심화', l2: '틈 파고들기', title: '내려 찌르기 심화 · 틈 파고들기', eff: '내려 찌르기가 옷과 갑옷 틈을 더 파고든다', pre: ['I7'], price: 400, d: 4, cx: 330, perk: 'imbroccata' }),
      N({ id: 'I9', name: '칼끝 돌려 빼기', cat: 'atk', l1: '칼끝', l2: '돌려 빼기', eff: '찌르기가 맞물리거나 꺾인 뒤 다시 찌른다', pre: ['I6'], price: 300, d: 4, cx: 670, u: 'cavazione' }),
      N({ id: 'I4', name: '엇박 찌르기', cat: 'secret', l1: '비기', l2: '엇박 찌르기', eff: '상대가 칼을 들거나 달려들 때 공격하면, 밑으로 들어가 찌른다', pre: ['I8'], price: 400, heads: 20, d: 5, cx: 330, f: ['secret'] }),
      N({ id: 'I10', name: '곧은 선', cat: 'passive', l1: '패시브', l2: '곧은 선', eff: '찌르는 동안 칼끝이 상대를 조금 따라간다', pre: ['I9'], price: 0, heads: 10, d: 5, cx: 670, f: ['passive'] }),
    ],
  },
  iberian: {
    nodes: [
      N({ id: 'B1', name: '넓은 옆걸음', cat: 'foot', l1: '보법 I', l2: '넓은 옆걸음', eff: '넓은 보폭으로 옆으로 빠르게 돈다', price: 100, d: 0, cx: 500, f: ['footwork'] }),
      N({ id: 'B2', name: '옆 박차기', cat: 'foot', l1: '보법 II', l2: '옆 박차기', eff: '옆으로 누르면 첫 걸음을 박찬다', pre: ['B1'], price: 100, opt: true, d: 1, cx: 84, f: ['burstSide'] }),
      N({ id: 'B10', name: '손목 힘', cat: 'passive', l1: '패시브', l2: '손목 힘', eff: '큰 칼을 돌리는 손목 힘이 세진다', pre: ['B1'], price: 0, heads: 10, d: 1, cx: 252, f: ['passive'] }),
      N({ id: 'B3', name: '돌며 베기', cat: 'atk', l1: '돌며 베기', l2: '걸음 기술', eff: '옆으로 걸으며 사선으로 내려 긋는다', pre: ['B1'], price: 200, d: 1, cx: 420, u: 'talhoRodeado' }),
      N({ id: 'B4', name: '머리 위 돌려 베기', cat: 'atk', l1: '머리 위', l2: '돌려 베기', eff: '왼 가로베기를 그으면 머리 위로 돌려 베기가 나간다', pre: ['B1'], price: 200, d: 1, cx: 588, u: 'redondo' }),
      N({ id: 'B8', name: '쳐내기', cat: 'parry', l1: '막기 I', l2: '쳐내기', title: '막기 I · 쳐내기 (탈류 · 레베스)', eff: '높이 오는 칼을 베어 쳐낸다', pre: ['B1'], price: 200, d: 1, cx: 756, f: ['parry', 'parryCover'] }),
      N({ id: 'B11', name: '리스본에서 온 편지', cat: 'letter', l1: '리스본에서', l2: '온 편지', title: '리스본에서 온 편지', pre: ['B1'], price: 100, opt: true, d: 1, cx: 924, letter: true }),
      N({ id: 'B5', name: '흐르는 긋기', cat: 'atk', l1: '이어 긋기', l2: '흐름', eff: '이어 그을 때 칼이 멈추지 않고 다음 긋기로 흐른다', pre: ['B4'], price: 300, d: 2, cx: 560, f: ['ibFlow'] }),
      N({ id: 'B9', name: '굳은 받기', cat: 'parry', l1: '막기 II', l2: '굳은 받기', eff: '막는 동안 받는 피해가 줄어든다', pre: ['B8'], price: 300, d: 2, cx: 800, f: ['parryCut'] }),
      N({ id: 'B7', name: '길목 지키기', cat: 'secret', l1: '비기', l2: '길목 지키기', eff: '칼끝 거리 밖에서 기다리다 상대가 넘어올 때 공격하면, 크게 둘러 벤다', pre: ['B10', 'B3', 'B5'], price: 400, heads: 20, d: 3, cx: 420, f: ['secret'] }),
      N({ id: 'B6', name: '거듭 돌려 베기', cat: 'deep', l1: '심화', l2: '쌓기', title: '돌려 베기 심화 · 쌓기', eff: '돌려 베기를 이어 그을수록 피해가 증가한다', pre: ['B5'], price: 400, d: 3, cx: 680, perk: 'redondo' }),
    ],
  },
  japanese: {
    nodes: [
      N({ id: 'J1', name: '낮은 걸음', cat: 'foot', l1: '보법', l2: '낮은 걸음', eff: '낮게 걸어 흔들려도 잘 버티지만, 걸을 때 기력이 더 든다', price: 100, d: 0, cx: 500, f: ['footwork', 'stepCost'] }),
      N({ id: 'J6', name: '비껴 베기', cat: 'atk', l1: '비껴 베기', l2: '걸음 기술', eff: '옆으로 걸으며 왼 사선으로 내려 긋는다', pre: ['J1'], price: 200, d: 1, cx: 120, u: 'hirakiGiri' }),
      N({ id: 'J7', name: '손목 치기', cat: 'atk', l1: '손목 치기', l2: '강화동작', eff: '가운데서 짧게 내려베면 더 힘 있는 손목 치기가 나간다', pre: ['J1'], price: 200, d: 1, cx: 360, u: 'kote' }),
      N({ id: 'J2', name: '머리 위 받기', cat: 'parry', l1: '막기 I', l2: '머리 위 받기', eff: '머리 위로 오는 칼을 받고, 막는 동안 받는 피해가 줄어든다', pre: ['J1'], price: 200, d: 1, cx: 650, f: ['parry', 'parryCover', 'parryCut'] }),
      N({ id: 'J11', name: '에도에서 온 편지', cat: 'letter', l1: '에도에서', l2: '온 편지', title: '에도에서 온 편지', pre: ['J1'], price: 100, opt: true, d: 1, cx: 890, letter: true }),
      N({ id: 'J9', name: '제비 베기', cat: 'atk', l1: '제비 베기', l2: '이어 긋기', eff: '내려벤 칼이 빗나가거나 막힌 뒤 위로 긋는다', pre: ['J6', 'J7'], price: 300, d: 2, cx: 200, u: 'tsubameGaeshi' }),
      N({ id: 'J8', name: '손목 치기 심화', cat: 'deep', closed: true, l1: '심화', l2: '손목 치기', title: '손목 치기 심화', eff: '준비 중입니다', pre: ['J7'], price: 300, d: 2, cx: 420 }), // 이점 미정(확인표 2107) — 닫힘 · 몫 없음
      N({ id: 'J3', name: '흘려 받기', cat: 'parry', l1: '막기 II', l2: '흘려 받기', title: '막기 II · 흘려 받기 (우케나가시)', orig: '受け流し', eff: '흘려 받으면 상대 팔이 늦고 기력이 깎인다', pre: ['J2'], price: 300, d: 2, cx: 650, f: ['flow'] }),
      N({ id: 'J10', name: '기다림과 침', cat: 'passive', l1: '패시브', l2: '기다림과 침', eff: '치지 않고 기다릴수록 다음 칼의 피해가 증가한다', pre: ['J9'], price: 0, heads: 10, d: 3, cx: 200, f: ['passive'] }),
      N({ id: 'J4', name: '흘린 칼', cat: 'parry', l1: '막기 III', l2: '흘린 칼', eff: '흘린 공격의 피해가 크게 줄어든다', pre: ['J3'], price: 400, d: 3, cx: 650, f: ['flowShield'] }),
      N({ id: 'J5', name: '뒤에서 앞서기', cat: 'secret', l1: '비기', l2: '뒤에서 앞서기', eff: '간격 밖에서 기다리다 상대가 치려 할 때 공격하면, 먼저 벤다', pre: ['J4'], price: 400, heads: 20, d: 4, cx: 650, f: ['secret'] }),
    ],
  },
  chinese: {
    nodes: [
      N({ id: 'C1', name: '가벼운 발', cat: 'foot', l1: '보법 I', l2: '가벼운 발', eff: '발을 가볍게 떼고 바로 멈춘다', price: 100, d: 0, cx: 500, f: ['footwork'] }),
      N({ id: 'C2', name: '덜 지치는 걸음', cat: 'foot', l1: '보법 II', l2: '덜 지치는 걸음', eff: '걸을 때 기력이 덜 든다', pre: ['C1'], price: 100, opt: true, d: 1, cx: 110, f: ['stepCost'] }),
      N({ id: 'C3', name: '허리 베기', cat: 'atk', l1: '허리 베기', l2: '강화동작', eff: '가로베기를 그으면 더 힘 있는 허리 베기가 나간다', pre: ['C1'], price: 200, d: 1, cx: 380, u: 'yaoji' }),
      N({ id: 'C7', name: '세 자세 받기', cat: 'parry', l1: '막기 I', l2: '세 자세 받기', eff: '위 · 가운데 · 아래로 오는 칼을 세 자세로 받는다', pre: ['C1'], price: 200, d: 1, cx: 660, f: ['parry', 'parryCover'] }),
      N({ id: 'C11', name: '한양에서 온 편지', cat: 'letter', l1: '한양에서', l2: '온 편지', title: '한양에서 온 편지', pre: ['C1'], price: 100, opt: true, d: 1, cx: 900, letter: true }),
      N({ id: 'C4', name: '깊은 허리 베기', cat: 'deep', l1: '심화', l2: '출혈', title: '허리 베기 심화 · 출혈', eff: '허리 베기로 몸통을 베면 피를 더 흘린다', pre: ['C3'], price: 300, d: 2, cx: 130, perk: 'yaoji' }),
      N({ id: 'C5', name: '끌어 딛고 허리 베기', cat: 'atk', l1: '끌어 딛고', l2: '허리 베기', eff: '앞으로 끌어 딛으며 가로로 긋는다', pre: ['C3'], price: 300, d: 2, cx: 310, u: 'chebuYaoji' }),
      N({ id: 'C6', name: '날개 접기', cat: 'atk', l1: '날개 접기', l2: '이어 긋기', eff: '찌르다가 칼을 거두며 벤다', pre: ['C3'], price: 300, d: 2, cx: 490, u: 'lianchi' }),
      N({ id: 'C8', name: '단단한 받기', cat: 'parry', l1: '막기 II', l2: '단단한 받기', eff: '막는 동안 받는 피해가 크게 줄어든다', pre: ['C7'], price: 300, d: 2, cx: 680, f: ['parryCut'] }),
      N({ id: 'C10', name: '숨 바꾸기', cat: 'passive', l1: '패시브', l2: '숨 바꾸기', eff: '휘두르지 않는 동안 출혈이 빨리 잦아든다', pre: ['C7'], price: 0, heads: 10, d: 2, cx: 880, f: ['passive'] }),
      N({ id: 'C9', name: '세 번 이어 치기', cat: 'secret', l1: '비기', l2: '세 번 이어 치기', eff: '높이 막아 낸 직후 공격하면, 세 번 이어 친다', pre: ['C6', 'C8'], price: 400, heads: 20, d: 3, cx: 590, f: ['secret'] }),
    ],
  },
};
/** 유파 → { gate?, nodes } (얼림) */
export const TREE = Object.freeze(Object.fromEntries(Object.entries(TREE_SRC).map(([s, t]) => [s, Object.freeze({ ...t, nodes: Object.freeze(t.nodes) })])));

export const nodesOf = (school) => TREE[school]?.nodes ?? [];
export const nodeOf = (school, id) => nodesOf(school).find((n) => n.id === id) ?? null;
/** 칸 id → 유파 (G1 → german …) */
export function schoolOfNode(id) {
  for (const s of TREE_SCHOOLS) if (nodeOf(s, id)) return s;
  return null;
}
/** 닫힌 칸('준비 중' — 살 수 없음 · 판 몫 없음): 비기 = SECRET.openSchools 에 없는 유파 · 그 밖 = closed 칸(일본 J8) */
export const isClosed = (school, node) => (node?.cat === 'secret' ? !SECRET.openSchools.includes(school) : !!node?.closed);
/** 먼저 익힐 칸을 모두 익혔나 (뿌리는 늘 참) */
export const prereqsMet = (node, learned) => node.pre.every((id) => learned.has(id));

/**
 * 칸 상태: 'learned'(익힘) · 'closed'(준비 중) · 'open'(배울 수 있음 — 앞 칸을 모두 익힘) · 'locked'(앞 칸이 모자람)
 *  learned = 이 유파의 익힌 칸 id 모음
 */
export function nodeState(school, node, learned) {
  if (learned.has(node.id)) return 'learned';
  if (isClosed(school, node)) return 'closed';
  return prereqsMet(node, learned) ? 'open' : 'locked';
}
/** 배울 수 있나 — { ok, why }: why = 'learned' · 'closed' · 'pre'(앞 칸) · 'coins' · 'heads' · 'bad' */
export function canLearn(school, node, learned, { coins = 0, heads = 0 } = {}) {
  if (!node) return { ok: false, why: 'bad' };
  const st = nodeState(school, node, learned);
  if (st === 'learned') return { ok: false, why: 'learned' };
  if (st === 'closed') return { ok: false, why: 'closed' };
  if (st === 'locked') return { ok: false, why: 'pre' };
  if (coins < node.price) return { ok: false, why: 'coins' };
  if (heads < node.heads) return { ok: false, why: 'heads' };
  return { ok: true, why: null };
}

/**
 * 익힌 칸 → 판 몫 (사람만 — main.js newRound 가 몸에 skillKit 으로 넣는다 · skill_kit.js kitOff 가 읽는다).
 *  school = 손에 든 무기 유파 · ids = 이 유파의 켤 칸 id 모음(닫힌 칸은 늘 뺀다). 유파 칸이 없는 무기(무유파)는 null — 유파 몫이 원래 없다(지금 그대로).
 *  돌려줌 { school, footwork … secret: bool, unique: Set<고유 공격 이름>, perk: Set<강화동작 이름> } — 칸 하나가 제 몫만 켠다(IMPLEMENTATION.md §2 표)
 */
export function kitFromNodes(school, ids) {
  if (!TREE_SCHOOLS.includes(school)) return null;
  const kit = { school, unique: new Set(), perk: new Set() };
  for (const k of KIT_KEYS) kit[k] = false;
  for (const n of nodesOf(school)) {
    if (!ids.has(n.id) || isClosed(school, n)) continue;
    for (const k of n.f) kit[k] = true;
    if (n.u) kit.unique.add(n.u);
    if (n.perk) kit.perk.add(n.perk);
  }
  return kit;
}
/** 이 유파의 칸 id 모두 (테스트 경로 = 모두 익힘) */
export const allNodeIds = (school) => new Set(nodesOf(school).map((n) => n.id));
/** 개발 인자 `?uniqueStage=N` → 옛 급 N 까지의 칸(보법 1 · 막기 2 · 고유 공격 · 심화 3 · 패시브 4 · 비기 5 — 편지는 판 몫이 없어 뺌). 0 = 칸 없음 */
export const nodesUpToStage = (school, n) => new Set(nodesOf(school).filter((x) => NODE_CAT[x.cat].stage != null && NODE_CAT[x.cat].stage <= n).map((x) => x.id));
/** 개발 인자 `?skillNodes=G1,G5` → 그 무기 유파의 칸만 (모르는 id · 다른 유파 칸은 버림) · 'all' = 모두 · 없으면 null */
export function nodesParam(raw, school) {
  if (raw == null) return null;
  if (raw === 'all') return allNodeIds(school);
  return new Set(String(raw).split(',').map((s) => s.trim()).filter((id) => nodeOf(school, id)));
}

// ── 편지 (사장님 결정 '칸마다 무게' — 뽑기 칸마다 무게 = 그 등급 TIER_DRAW ÷ 그 등급 칸 수 · 편지 유파 칸 × config LETTER.mult · 모든 등급에서 한 번에 — weapons.js drawWeaponCards) ──
/** 익힌 칸 모음(유파 → Set) → 편지를 가진 유파 모음 */
export function letterSchools(learnedBySchool) {
  const out = new Set();
  for (const s of TREE_SCHOOLS) for (const n of nodesOf(s)) if (n.letter && learnedBySchool[s]?.has(n.id)) out.add(s);
  return out;
}
/** 무기 유파 → 뽑기 칸 무게 배율 (편지가 있으면 config LETTER.mult · 아니면 1 — 무유파 무기도 1) */
export const letterMul = (school, letters) => (letters?.has(school) ? LETTER.mult : 1);
/** 칸 효과 한 줄 — 편지는 배율(config LETTER.mult)을 읽어 쓴다 (값이 바뀌어도 글이 맞게) */
export const nodeEff = (school, n) => (n.letter ? `${SCHOOL_KO[school]} 무기 카드가 더 자주 나온다` : n.eff);
const SCHOOL_KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방' }; // schools.js TRADITIONS.*.nameKo 와 같은 말 (이 파일은 schools.js 를 들여오지 않는다)
