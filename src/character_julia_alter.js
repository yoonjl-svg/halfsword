// 광기의 쥘리아 크리스테바 시트 — 샛별 저장소 전달 C-JULIA-20261030 (0753eb9e) 에서 들임 · 들인 기록 docs/import/julia_import_2026-10-30.md
// 겉모습 얼터(기계 반신) — 정체 · 칭호 · 이야기는 없다(칭호는 원본 그대로 '상인'). 숙련도는 characters.js 의 얼터 맞춤(원본 +1 = 5)이 정한다.
//  10/30 방랑 가지 wk/julia-wander 에서 고친 칸 (사장님 22:2x '4번도 해. 상점과는 다른 대사이지만 같은 톤으로. 얼터도.'):
//   무기 · 꾸러미 = 레이피어(전용 무기 달타냥은 원본만 — 시트를 복사하므로 되적음) · 시작 자세 · 대사. 목소리 · 성향 숫자는 원본 복사 그대로
export function createJuliaAlter(base) {
  const c = structuredClone(base);
  return {...c,id:'julia_mad',variantOf:'julia',mad:true,
    name:'광기의 쥘리아 크리스테바',appearanceOnly:true,retainBaseStats:true,
    proficiencyFixed:4,eyes:'madGlow',lookVersion:'v4-native-mechanical',
    weapon:'rapier', // 원본의 달타냥은 원본 몫 (사장님 확인 전 — 확인표 3058)
    // 성향: 다른 얼터처럼 원본을 그대로 복사(실력 숫자 · 성격 같음 — appearanceOnly · retainBaseStats). 원본과 다른 칸은 광기의 하인리히처럼 시작 자세 하나만 —
    //  자세를 고쳐 잡는 몸짓 없이 칼끝을 겨눈 채 흔들림 없음(광기의 하인리히 idle 과 같은 꼴 · 원본은 콰르타 settle). 사장님 확인 전 (확인표 3056)
    ai:{...c.ai,persona:{...c.ai.persona,school:'rapier',idle:{guard:'langort',gesture:'still'}}},
    look:{...base.look,outfit:'julia_mechanical',tunic:0x293340,quilt:0x202832,
      sleeve:0xc0c0b7,hoseUpper:0x29313a,metal:0x8a9293},
    backstory:'',
    // 대사 (사장님 검수 전 — 확인표 3057): 원본 대사(사장님 확정 10/30 22:3x · 22:4x)의 부서진 꼴(잡음 · 끊김 · 되풀이 — 상점 얼터 대사와 같은 톤) · 감독 초안 그대로.
    //  血 · ぴったり 두 줄은 중국어 · 일본어 낱말이 섞인 꼴 — 편집 지침 §1 '원어 글자를 게임 화면에 쓰지 않는다'의 예외(상점 얼터 대사와 같은 사장님 지시 · 10/30 19:3x · 22:2x '같은 톤으로')
    //  → 표기 검사(tools/text/name_policy.mjs)는 이 시트의 대사 칸(taunt · lines)만 scriptMix 로 뺀다 — 이름 · 칭호는 그대로 검사
    scriptMix:true,
    taunt:'사러 왔—왔느냐, 팔러 왔느냐. 어느 쪽이든 대가가 있노라. 있노라. 있노ㄹ',
    lines:{
      intro:['사러 왔—왔느냐, 팔러 왔느냐. 어느 쪽이든 대가가 있노라. 있노라. 있노ㄹ','오호, 손님이로구나. 오늘 값은 네 血도 좋다.'],
      attack:['받거라. 받거—','여기로다. 삐—','값을 치를 때니라. 때니라.'],
      hurt:['…흠집이 ── 생겼구나.','이리 비싼 상처라니. 상처. 상처라ㄴ','아직 셈은 끝나지 않았느니…지직…라.'],
      winning:['하나 더 얹어 주마. 주마. 주ㅁ','그래, ぴったり 맞아떨어지는구나.'],
      losing:['이 값은… 너무… 치직… 비싸구나.','이상하구나. 이상하구나. 이상하ㄱ'],
      win:['다음에 또 오—오거라. 삐—','값은 받았노라. 받았노라. 받았ㄴ','나에 대해… 치직… 아느냐? 아느냐? 아느ㄴ'],
    }};
}
