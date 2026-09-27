// ─────────────────────────────────────────────────────────────
//  유파 꾸러미: 무기 하나에 묶인 "검술 교본" 한 벌
//
//  AI(ai.js)는 자세·기술·속임수·막기 자세·간격 상수를 직접 들고 있지 않고, 여기서 고른 꾸러미를
//  읽기만 한다. 캐릭터 시트(characters.js)의 persona.school 이 어느 꾸러미를 쓸지 정한다.
//  무기 로스터(다른 담당)가 자리를 잡으면 무기마다 꾸러미를 하나씩 붙이면 된다 — 지금은 롱소드 하나뿐이고,
//  이 롱소드 꾸러미 값은 예전에 ai.js 안에 박혀 있던 값 그대로다 (기본 AI 회귀 기준을 지키기 위해).
//
//  꾸러미 모양 (계약):
//   weapon   무기 로스터 id (참고용. 실제 무기 물리는 여기서 정하지 않는다)
//   measure  간격 상수 (m·s). 이 물리 모델에서 롱소드로 직접 재 본 값 — 무기가 바뀌면 여기부터 다시 재야 한다
//     contact  베기가 머리·목에 제대로 닿는 거리 (칼날 70% 지점)
//     reach    서 있다가 휘두르며 한 걸음 내디디면 닿는 거리 = 이 안은 위험하다 (상대도 같다)
//     clinch   너무 붙음: 칼을 제대로 못 쓴다 → 떨어진다
//     cutTime  베기를 시작해서 닿기까지 걸리는 시간
//   guards   간 볼 때 쓰는 자세 목록 (ai_techniques.js WATCH_GUARDS 모양)
//   tech     기술 목록 (TECH 모양), techByName 은 그 이름 색인
//   feints   속임수 목록 (FEINTS 모양)
//   parry    상대 칼이 들어오는 줄(highL·highR·highC·lowL·lowR·thrust) → 그 칼을 가로막는 손 위치
//   counter  맞받아 베기(Indes)에 쓸 기술 이름들 — 들어오는 줄별로, 지금 손에서 가까운 것을 고른다
//   withdraw 물러날 때 겨누는 자세 이름: pressed(몰아치는 상대에게), calm(그 밖에, 둘 중 하나를 무작위로)
//   pose     그 밖의 고정 손 위치: cover(쓰러졌을 때 머리 위로 가리기), point(칼끝으로 겨누기)
// ─────────────────────────────────────────────────────────────
import { G, WATCH_GUARDS, TECH, TECH_BY_NAME, FEINTS } from './ai_techniques.js';

export const SCHOOLS = {
  // 독일식 롱소드 (리히테나워 전통). 값은 모두 예전 ai.js 의 MEASURE·PARRY·counterTech()·startWithdraw() 그대로
  longsword: {
    id: 'longsword',
    weapon: 'longsword',
    measure: { contact: 1.62, reach: 2.0, clinch: 1.25, cutTime: 0.3 },
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
  },
};

export const DEFAULT_SCHOOL = 'longsword';

/** id가 없거나 모르는 유파면 기본(롱소드) 꾸러미 */
export const schoolOf = (id) => SCHOOLS[id] || SCHOOLS[DEFAULT_SCHOOL];
