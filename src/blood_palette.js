// ─────────────────────────────────────────────────────────────
//  피 색 (사장님 10/27 23:2x — 광기의 병마용은 사람처럼 죽되 흰 피를 흘린다. 샛별 저장소 6821e98c blood_palette.js 와 같은 꼴 · 흰 값도 샛별 그대로 — 확인표 2653 '사장님 확인 전')
//  인물 시트 physiology.blood 가 'white' 면 흰 피, 그 밖(없음 포함 — 모든 사람)은 붉은 피 = 예전 값 그대로(한 자리도 바뀌지 않는다).
//  겉모습만 — 출혈 · 의식 · 죽음은 fighter.js 사람 규칙(HUMAN_BODY) 그대로. 흙 몸(body 'clay')은 피가 없어 이 색을 쓰지 않는다.
//   splash: 베인 자리에서 튀는 피 · 바닥 얼룩 · 목 · 팔다리 단면 분출 (effects.js blood · decap_fx · limb_fx)
//   drip:   상처에서 떨어지는 핏방울 · 바닥 얼룩 (effects.js drip — main.js updateDrips)
//   blade:  벤 칼에 묻는 피 (fighter.js bloodyBlade — 때린 쪽 칼에 맞은 쪽 피 색)
//   flesh · rim: 목 · 팔다리 단면의 살 · 테 (decap_fx · limb_fx — '피 표현' 끔이면 둘 다 예전 회색)
//   key:    상처 자국 그림 갈래 (effects.js stickDecal — 'red' 는 예전 그림 그대로, 'white' 는 같은 그림을 흰 피 · 회색 틈으로)
// ─────────────────────────────────────────────────────────────
export const BLOOD_RED = Object.freeze({ key: 'red', splash: 0x8a0000, drip: 0x7a0000, blade: 0x5a0808, flesh: 0x4a0a0c, rim: 0x6a1a18 });
export const BLOOD_WHITE = Object.freeze({ key: 'white', splash: 0xe8eee7, drip: 0xd8e1d8, blade: 0xd2dcd2, flesh: 0xb7c3ba, rim: 0xe2e9df });

/** 검객(또는 인물 시트)의 피 색 — physiology.blood 'white' 면 흰 피, 아니면 붉은 피 */
export const bloodPalette = (f) => (f?.physiology?.blood === 'white' ? BLOOD_WHITE : BLOOD_RED);
