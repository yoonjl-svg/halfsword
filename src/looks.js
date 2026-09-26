// ─────────────────────────────────────────────────────────────
//  검투사 겉모습(옷 색, 투구, 머리카락). 물리에는 영향이 없다.
//  색은 16진수 RGB. 새 캐릭터를 만들려면 이 목록에 하나 추가하면 된다.
// ─────────────────────────────────────────────────────────────
export const LOOKS = {
  // 누비 상의(갬비슨) + 가죽 끈 + 챙 넓은 투구(케틀햇)
  player: {
    tunic: 0xe6d9bd,
    quilt: 0xcbbd9e,
    sleeve: 0xe6d9bd,
    straps: 0x7a4a26,
    belt: 0x5a3a22,
    hoseUpper: 0x7a2121,
    hoseLower: 0xe8e4da,
    shoes: 0x6b4428,
    skin: 0xe0b08a,
    hands: 0xe0b08a,
    helmet: 'kettle',
    metal: 0xb9c0c7,
    hair: null,
    grip: 0x4a2e1a,
    hilt: 0x9aa3ad,
  },
  // 파란 더블릿 + 겨자색 바지, 투구 없이 머리띠
  enemy: {
    tunic: 0x2f5fc0,
    quilt: 0x24498f,
    sleeve: 0x2f5fc0,
    straps: null,
    belt: 0x3a2618,
    hoseUpper: 0x8a6a2a,
    hoseLower: 0x7a5e25,
    shoes: 0xa0602c,
    skin: 0xd49a78,
    hands: 0x5a3a22,
    helmet: null,
    metal: 0x8f8a82,
    hair: 0x2b1d14,
    headband: 0x2a4aa8,
    grip: 0x2a1a10,
    hilt: 0x7d7870,
  },
};
