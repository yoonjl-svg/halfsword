// ─────────────────────────────────────────────────────────────
//  상대 캐릭터 5인: 저마다 다른 유파·성격·자세 전환 습관을 가진 검객들.
//
//  ai.persona가 ai.js의 AI 클래스에 그대로 전달된다:
//   - level: AI_LEVELS(난이도) 숫자 위에 캐릭터별로 덮어쓰는 값 (반응 시간·막기 확률·읽는 눈·힘 등)
//   - pers:  성격(자세 취향·간격·박자·속임수) 위에 덮어쓰는 값. guardStick이 이번에 새로 생긴 핵심 손잡이:
//            크면(예: 6) 가까운 자세만 고집하는 신중한 검객, 작으면(예: 0.6) 먼 자세로도 서슴없이
//            건너뛰는 변덕스러운 검객이 된다. guardPref는 자세 이름별 선호도를 부분적으로 못박아 둔다.
//
//  weapon: 무기 목록(다른 담당이 작업 중)의 id만 적어 둔다. 실제 무기 모델·능력치는 여기서 정하지 않는다.
//  look: looks.js의 LOOKS 항목이 지원하는 값만 쓴다 (옷·가죽끈·투구·머리카락 색 등). 몸매·나이 같은
//        생김새는 글로 묘사만 하고(문서 참고), fighter.js의 몸 크기 자체는 아직 캐릭터마다 다르게 만들 수 없다.
// ─────────────────────────────────────────────────────────────

export const CHARACTERS = [
  // ───────────────────────────────────────────── 1. 쉬움 : 촌뜨기 난동꾼 ─────────────────────────────────────────────
  {
    id: 'bran',
    name: '오소리 브란',
    epithet: '나무꾼',
    age: 34,
    origin: '검은숲 변두리 화전민 마을',
    backstory:
      '장작 패는 도끼질 말고는 배운 게 없다. 술집에서 시비가 붙을 때마다 몽둥이(사실은 잘 마른 참나무 가지)를 ' +
      '휘둘러 이겼다는 소문이 마을 밖까지 퍼졌고, 어느 날 흥행사가 찾아와 "진짜 검객"과 싸우면 은화를 준다고 꼬드겼다.',
    want: '은화. 그리고 이번엔 아무도 자기를 "그냥 힘센 촌놈"이라 부르지 못하게 만들고 싶다.',
    school: '유파 없음(자기 흐름). 정식으로 검을 배운 적이 없어 리히테나워식 자세 이름도 모른다. ' +
      '큰 동작으로 내리찍거나 옆으로 후려치는 것만 반복하지만, 타고난 힘과 대담함으로 어설프게나마 맞아떨어질 때가 있다.',
    signatureMoves: '머리 위로 크게 들어 올렸다가 내리찍는 정수리 베기, 옆에서 크게 감아 치는 가로베기. 준비 동작이 매우 크고 느려서 훈련된 눈에는 다 보인다.',
    favoriteGuards: '지붕(막 들어 올린 자세)과 바보(칼끝을 아예 땅에 늘어뜨린 자세) 사이를 정신없이 오간다. "자세"라는 개념이 없어 아무 자세로나 불쑥 넘어간다.',
    temperament:
      '단순하고 다혈질. 이기고 있으면 더 크게 휘두르며 웃어젖히고, 맞아서 피가 나면 당황해 마구잡이로 달려든다(참을성이 매우 빨리 바닥난다). ' +
      '진짜로 위험해지면(많이 다치면) 그제서야 주춤주춤 물러난다.',
    movementNotes:
      '간격 개념이 없어 상대에게 바짝 붙어 서고, 자세도 박자 없이 아무 때나(약 1.6초마다) 바꾼다 — 가까운 자세 고집이 거의 없어(guardStick 낮음) ' +
      '지붕에서 곧장 바보 자세로 건너뛰는 식의 "먼 자세 점프"가 잦다. 속임수는 쓸 줄 모른다(feint 0). 달려드는 것을 두려워하지 않는다(vor 높음).',
    weaknesses: '준비 동작이 크고 느려 낌새를 미리 읽기 쉽다. 막기 판단이 늦고 부정확하며, 자세 전환이 무작위라 다음 수를 읽긴 어렵지만 정작 방어는 허술하다. 속임수에 매우 잘 속는다.',
    weapon: 'branch',
    ai: {
      level: 'easy',
      persona: {
        school: 'longsword',
        level: { reaction: 0.42, guardChance: 0.22, counter: 0, feint: 0, followUp: 0.12, read: 0.2, discipline: 0.35, strength: 0.68, aggression: 0.9, windup: 1.6, chamberSpeed: 1.8, skill: 0.28 },
        pers: {
          guardStick: 0.6,
          fearful: 0.45, // 베이면 당황한다 — 많이 다치면 주춤주춤 물러나는 성격
          guardSpeed: 1.6,
          rhythm: 1.6,
          margin: 0.22,
          aggr: 0.95,
          vor: 0.55,
          patienceTime: 8,
          circleRate: 0.1,
          guardPref: { tag: 1.6, tagR: 1.7, alber: 1.5, wechselR: 1.3 },
        },
      },
    },
    look: {
      tunic: 0x5b4a2f,
      quilt: 0x4a3b24,
      sleeve: 0x5b4a2f,
      straps: 0x2e2013,
      belt: 0x2e2013,
      hoseUpper: 0x3a3a2a,
      hoseLower: 0x6b5a3a,
      shoes: 0x3a2a1a,
      skin: 0xc98f5e,
      hands: 0xc98f5e,
      helmet: null,
      metal: 0x6b6258,
      hair: 0x2a1c10,
      grip: 0x3a2a1a,
      hilt: 0x6b5a3a,
    },
    taunt: '이 나뭇가지도 아프거든?!',
  },

  // ───────────────────────────────────────────── 2. 쉬움~보통 : 성실한 신입 검사 ─────────────────────────────────────────────
  {
    id: 'isolde',
    name: '이졸데 반 아커러',
    epithet: '브루게의 견습생',
    age: 21,
    origin: '브루게 검술 길드',
    backstory:
      '길드에서 가장 어린 정식 단원. 피오레 데이 리베리 계보를 잇는다는 늙은 사범 밑에서 3년째 매일 자세 교정을 받고 있다. ' +
      '사범은 아직 "실전에 내보내기엔 이르다"고 하지만, 몰래 이 경기장에 이름을 올렸다.',
    want: '사범에게 인정받는 것. 그리고 "여자는 체력이 부족해 검을 오래 못 쓴다"는 선배들의 말이 틀렸음을 보여주는 것.',
    school: '피오레 데이 리베리(이탈리아식)의 기본기를 독일식 자세 이름으로 옮겨 배웠다. 교본을 그대로 따르는 정직한 검술 — 창의적이진 않지만 빈틈이 없다.',
    signatureMoves: '쟁기·긴 자세를 오가며 칼끝으로 거리와 각도를 재는 정석적인 응대. 상대가 헛치면 정직하게 받아친다(Nach)기보다 일단 한 번 더 확인하고 들어가는 조심스러운 스타일.',
    favoriteGuards: '쟁기(오른쪽)와 긴 자세를 거의 벗어나지 않는다. 교본에 없는 자세(바꿈·옆 지킴)는 거의 쓰지 않는다.',
    temperament:
      '침착하고 신중하다. 맞아도 동요하지 않고 배운 대로 물러나 다시 거리를 잰다(패닉하지 않음). 다만 상대가 교본에 없는 방식으로 나오면 판단이 한 박자 늦다. ' +
      '이기고 있어도 서두르지 않는다 — 사범의 가르침("승부를 서두르는 자가 먼저 벤다") 때문에 오히려 과할 만큼 참는다.',
    movementNotes:
      '자세를 거의 안 바꾼다(guardStick 매우 높음, 박자도 5초 이상으로 느긋함) — 늘 같은 두세 자세 사이만 오가는 예측 가능한 검객. ' +
      '간격을 아주 넉넉히 두고(margin 큼) 절대 먼저 붙지 않는다. 속임수는 배우지 않았다(feint 거의 0).',
    weaknesses: '패턴이 매우 일정해 몇 합만 겪으면 다음 자세를 짐작할 수 있다. 달려드는 상대를 맞받아치기보다 무조건 물러나려 해서(vor 낮음), 집요하게 몰아붙이면 구석으로 밀린다. 이어 치기가 약하다(followUp 낮음) — 한 번 맞히면 그걸로 끝인 경우가 많다.',
    weapon: 'longsword',
    ai: {
      level: 'easy',
      persona: {
        school: 'longsword',
        level: { reaction: 0.31, guardChance: 0.6, counter: 0.12, feint: 0.05, followUp: 0.28, read: 0.62, discipline: 0.95, strength: 0.85, aggression: 0.68, windup: 0.82, skill: 0.56 },
        pers: {
          guardStick: 4.2,
          fearful: 0.3, // 침착하지만 실전 경험이 없다 — 베이면 교본대로 물러나 거리를 다시 잰다
          guardSpeed: 0.58,
          rhythm: 5.2,
          margin: 0.4,
          aggr: 0.78,
          vor: 0.36,
          patienceTime: 10,
          circleRate: 0.2,
          guardPref: { pflugR: 1.6, langort: 1.55, ochsR: 1.2, alber: 0.3, nebenR: 0.3 },
        },
      },
    },
    look: {
      tunic: 0x8a5fc2,
      quilt: 0x6a45a0,
      sleeve: 0x8a5fc2,
      straps: 0x3a2a3a,
      belt: 0x3a2a3a,
      hoseUpper: 0x3a3548,
      hoseLower: 0xd8d2c0,
      shoes: 0x4a3626,
      skin: 0xe3b98f,
      hands: 0xe3b98f,
      helmet: null,
      metal: 0xb9c0c7,
      hair: 0x3a2416,
      headband: 0x8a5fc2,
      grip: 0x2e1c12,
      hilt: 0x9aa3ad,
    },
    taunt: '사범님… 보고 계신가요. 정확하게 갈게요.',
  },

  // ───────────────────────────────────────────── 3. 보통 : 떠돌이 이류검객 ─────────────────────────────────────────────
  {
    id: 'liao',
    name: '랴오 쓰위엔',
    epithet: '떠도는 검',
    age: 40,
    origin: '동방에서 흘러온 방랑 검객',
    backstory:
      '고향의 문파에서 파문당했다는 소문도, 스스로 뛰쳐나왔다는 소문도 있다. 본인은 아무 말도 하지 않는다. ' +
      '수년째 이 나라 저 나라를 떠돌며 현상금이 걸린 결투장에 나타났다 사라지길 반복한다. 검(도·검) 다루는 법이 이 지역 유파와는 확연히 다르다.',
    want: '다음 여비. 그 이상도 이하도 아닌 척하지만, 사실 자신의 검이 "이 서양식 철검"에도 통하는지 시험해 보고 싶어한다.',
    school: '동방 도검술(도·검)을 독학으로 서양 롱소드에 옮겨 쓴다. 정해진 자세 순서를 따르지 않고 몸이 기억하는 대로 움직여, 리히테나워식 눈으로 보면 "격식이 없다".',
    signatureMoves: '가짜 동작으로 유인한 뒤 손목만 틀어 반대쪽을 치는 잔기술이 특기. 한 번 맞부딪히면 곧장 두세 번을 이어 붙인다.',
    favoriteGuards: '정해진 애용 자세가 없다 — 낮은 자세(바꿈·옆 지킴처럼 칼을 숨기는 자세)와 높은 자세를 가리지 않고 넘나든다.',
    temperament:
      '심드렁하고 여유롭다. 맞아도 표정 하나 안 바꾸고, 이기고 있어도 딱히 서두르지 않는다 — 다만 상대가 자신의 잔기술에 두 번 연달아 당하면 그제야 흥미를 보이며 몰아붙인다.',
    movementNotes:
      '자세를 아주 자주(1.5~2초마다), 그것도 먼 자세로 거리낌 없이 건너뛴다(guardStick 낮음) — 다음 자세를 종잡을 수 없는 것이 이 사람의 정체성이다. ' +
      '속임수를 즐겨 쓰고(feint 높음), 맞히거나 막히면 반드시 이어 붙인다(followUp 높음).',
    weaknesses: '정석 간격 관리를 안 배워 규율(discipline)이 낮다 — 덤벼들 때 살짝 과하게 들어오는 버릇이 있어, 그 순간을 미리 알고 맞받아치면(Vor) 잡을 수 있다. 힘 자체는 평범해 묵직한 반격 한 방에 균형이 잘 무너진다.',
    weapon: 'jian',
    ai: {
      level: 'normal',
      persona: {
        school: 'longsword',
        level: { reaction: 0.25, guardChance: 0.55, counter: 0.15, feint: 0.36, followUp: 0.62, read: 0.6, discipline: 0.55, strength: 0.95, aggression: 1.05, windup: 0.5, skill: 0.75 },
        pers: {
          guardStick: 0.9,
          fearful: 0.15, // 맞아도 표정 하나 안 바꾼다
          guardSpeed: 1.3,
          rhythm: 1.8,
          margin: 0.28,
          aggr: 1.1,
          vor: 0.5,
          patienceTime: 8,
          circleRate: 0.3,
          guardPref: { wechselR: 1.6, wechselL: 1.5, nebenR: 1.4, alber: 1.3, ochsL: 1.2 },
        },
      },
    },
    look: {
      tunic: 0x1f2e22,
      quilt: 0x16221a,
      sleeve: 0x1f2e22,
      straps: 0x2a1c10,
      belt: 0x2a1c10,
      hoseUpper: 0x2a2a2a,
      hoseLower: 0x3a3a3a,
      shoes: 0x1a1a1a,
      skin: 0xd8a878,
      hands: 0xd8a878,
      helmet: null,
      metal: 0x8f8a82,
      hair: 0x111111,
      headband: 0x7a1f1f,
      grip: 0x1a1208,
      hilt: 0x5a4630,
    },
    taunt: '검이 다 똑같지, 뭘 그리 재나.',
  },

  // ───────────────────────────────────────────── 4. 보통~어려움 : 화려한 흥행 검객 ─────────────────────────────────────────────
  {
    id: 'heinrich',
    name: '하인리히 폰 도른',
    epithet: '미치광이',
    age: 29,
    origin: '마이어 검술관 출신, 지금은 떠돌이 흥행 검객',
    backstory:
      '요아힘 마이어의 검술관에서 정식으로 배운 실력자였지만, "검술은 관중이 봐야 값어치가 있다"며 학관을 뛰쳐나와 장터·결투장을 돌며 돈을 받고 싸운다. ' +
      '진짜 실력자라는 것은 그와 겨뤄 본 사람만 안다 — 겨루기 전까진 다들 그를 광대로 본다.',
    want: '박수. 그리고 은근히, 자신을 내쳤던 학관 사범들이 이 소문을 듣기를 바란다.',
    school: '마이어식 롱소드 — 화려하고 리듬감 있는 자세 전환 자체가 하나의 기술이다. 큰 동작으로 상대의 눈을 자세에 묶어 두고 그 틈에 진짜 공격을 꽂는다.',
    signatureMoves: '속임수를 겹겹이 쌓는 연속 페인트, 상대가 달려들면 물러나지 않고 마주 걸어 들어가며 맞받아치는 강단 있는 카운터.',
    favoriteGuards: '지붕·어깨 지붕·옆 자세처럼 "보여주기 좋은" 크고 화려한 자세를 즐겨 쓰며, 관중을 의식해 자세를 자주 바꾼다.',
    temperament:
      '자신만만하고 과시욕이 강하다. 이기고 있으면 더 화려하게(그리고 더 공격적으로) 나오다가 과감하게 들어가는 순간 빈틈을 보이기도 한다. ' +
      '맞아서 아프면 오히려 히죽 웃으며 더 달려든다 — 쉽게 물러나지 않는다.',
    movementNotes:
      '자세를 매우 자주(1.3초 안팎) 바꾸고, 먼 자세로도 서슴없이 건너뛴다(guardStick 낮음) — 그런데 브란이나 랴오와 달리 이건 계산된 눈속임이다(feint·followUp이 모두 높다). ' +
      '간격을 바짝 좁혀 상대를 압박하고(margin 작음), 달려드는 상대를 물러나지 않고 맞받는다(vor 높음).',
    weaknesses: '인내심이 짧아(patienceTime 짧음) 판이 길어지면 먼저 무리하게 들어온다. 화려함에 자신이 있어 같은 유인책(가짜 공격)에 두 번 걸리면 오히려 더 큰 동작으로 반응해 큰 빈틈을 남긴다.',
    weapon: 'excalibur', // 진품이라 우기는 싸구려 복제 명검 — 흥행을 위한 소품
    ai: {
      level: 'normal',
      persona: {
        school: 'longsword',
        level: { reaction: 0.21, guardChance: 0.66, counter: 0.32, feint: 0.46, followUp: 0.72, read: 0.72, discipline: 0.75, strength: 1.05, aggression: 1.15, windup: 0.45, skill: 0.82 },
        pers: {
          guardStick: 0.8,
          fearful: 0.08, // 아프면 오히려 웃으며 더 달려든다
          guardSpeed: 1.7,
          rhythm: 1.3,
          margin: 0.2,
          aggr: 1.3,
          vor: 0.72,
          patienceTime: 6,
          circleRate: 0.35,
          guardPref: { tag: 1.6, tagR: 1.6, sideR: 1.5, sideL: 1.4, ochsR: 1.2 },
        },
      },
    },
    look: {
      tunic: 0xb3232f,
      quilt: 0x8a1a24,
      sleeve: 0xb3232f,
      straps: 0x2a1a10,
      belt: 0x2a1a10,
      hoseUpper: 0x1c1c1c,
      hoseLower: 0xd9c26a,
      shoes: 0x2a1a10,
      skin: 0xe0b08a,
      hands: 0xe0b08a,
      helmet: null,
      metal: 0xd8c060,
      hair: 0xc9a227,
      headband: 0xb3232f,
      grip: 0x2a1a10,
      hilt: 0xd8c060,
    },
    taunt: '박수는 나중에! 지금은 피를 보자고!',
  },

  // ───────────────────────────────────────────── 5. 어려움 : 진짜 고수 ─────────────────────────────────────────────
  {
    id: 'margarethe',
    name: '마르그레테 슈바르츠',
    epithet: '침묵의 벽',
    age: 58,
    origin: '리히테나워 계보를 40년째 가르치는 노장',
    backstory:
      '이름이 알려진 검술 사범들 중 실제로 결투장에 서는 몇 안 되는 사람. 젊을 때 남편을 결투로 잃은 뒤 검술관을 열어 40년째 제자를 길러 왔다. ' +
      '가끔 "가르치는 것과 베는 것은 다른 근육"이라며 직접 검을 들고 낯선 상대와 겨룬다 — 이번이 그런 날이다.',
    want: '가르침이 아직 녹슬지 않았음을 스스로 확인하는 것. 이기고 지는 것보다 "한 순간도 서두르지 않고 이겼는가"가 그에게는 더 중요하다.',
    school: '요하네스 리히테나워 전통의 정수. 자세를 거의 바꾸지 않고 한 자리를 지키다가, 상대가 스스로 무너뜨린 빈틈 딱 한 번만 정확히 친다.',
    signatureMoves: '들어오는 칼을 그대로 맞받아 베어 버리는 인데스(Indes), 한 번 맞부딪히면 반드시 되받아 치는 나흐(Nach). 헛손질이 거의 없다.',
    favoriteGuards: '황소(오른쪽)와 쟁기(왼쪽)에서 거의 움직이지 않는다 — 두 자세만으로도 위·아래 모든 빈틈을 겨눌 수 있다는 것을 안다.',
    temperament:
      '한없이 차분하다. 맞아도 흔들리지 않고(패닉 없음), 이기고 있어도 전혀 서두르지 않는다 — 오히려 상대가 조급해질 때까지 몇 초고 기다린다. ' +
      '그 침묵과 미동 없음 자체가 상대를 조급하게 만드는 무기다.',
    movementNotes:
      '자세를 거의 바꾸지 않고(guardStick 매우 높음, 박자 8초 이상) 손도 느긋하게 움직인다 — 그런데 위협도(threat)가 가장 높은 자세만 골라 지키므로 얕보고 들어오면 바로 베인다. ' +
      '무리해서 먼저 뛰어들지 않고(vor 낮은 편) 상대의 실수를 기다리는 정통 나흐(Nach) 검객.',
    weaknesses: '스스로 먼저 판을 깨지 않는다 — 인내심이 거의 무한에 가까워(patienceTime 매우 김) 상대가 절대 먼저 들어오지 않고 완벽하게 간격만 지키면 좀처럼 기회를 만들지 못한다(물론 그러면 판이 매우 길어진다). 화려한 잔기술은 거의 안 쓴다(feint 낮음).',
    weapon: 'longsword',
    ai: {
      level: 'hard',
      persona: {
        school: 'longsword',
        level: { reaction: 0.11, guardChance: 0.96, counter: 0.68, feint: 0.1, followUp: 0.88, read: 0.98, discipline: 1.05, strength: 1.22, aggression: 1.0, windup: 0.28, skill: 0.97 },
        pers: {
          guardStick: 6.2,
          fearful: 0, // 한없이 차분하다 — 감정층이 꺼져 있는 것과 같다
          guardSpeed: 0.5,
          rhythm: 6,
          margin: 0.34,
          aggr: 1.05,
          vor: 0.45,
          patienceTime: 8,
          circleRate: 0.18,
          guardPref: { ochsR: 1.7, pflugL: 1.65, langort: 1.2, alber: 0.2, tag: 0.4 },
        },
      },
    },
    look: {
      tunic: 0x3a3a3f,
      quilt: 0x2a2a2f,
      sleeve: 0x3a3a3f,
      straps: 0x1a1a1a,
      belt: 0x1a1a1a,
      hoseUpper: 0x2a2a2a,
      hoseLower: 0x4a4a4a,
      shoes: 0x1a1a1a,
      skin: 0xc9a074,
      hands: 0xc9a074,
      helmet: null,
      metal: 0x9aa3ad,
      hair: 0xd8d8d8,
      grip: 0x1a1a1a,
      hilt: 0x8a8a8a,
    },
    taunt: '서두르는 쪽이 먼저 벤다.',
  },
];

export const CHARACTERS_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

/** id가 없거나 목록에 없으면 무작위 캐릭터 (excludeId가 있으면 그 캐릭터는 뺀다) */
export function randomCharacter(excludeId) {
  const pool = excludeId ? CHARACTERS.filter((c) => c.id !== excludeId) : CHARACTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}
