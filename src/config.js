// ─────────────────────────────────────────────────────────────
//  게임 밸런스/조작감 숫자는 모두 여기에 모아둔다.
//  "무기가 너무 가볍다", "적이 너무 세다" 같은 느낌은
//  코드를 뜯지 말고 이 파일의 숫자부터 바꿔보면 된다.
//  단위: 미터(m), 킬로그램(kg), 초(s), 뉴턴(N)
// ─────────────────────────────────────────────────────────────

export const PHYSICS = {
  gravity: -9.81,
  timestep: 1 / 120, // 물리 한 스텝 길이. 작을수록 안정적이지만 무겁다.
  maxStepsPerFrame: 6, // 프레임이 밀렸을 때 따라잡기 위한 최대 스텝 수
};

export const ARENA = {
  radius: 6.5, // 원형 경기장 반지름 (울타리 위치)
  startGap: 4.2, // 시작할 때 두 검투사 사이 거리 (서로 칼이 닿지 않는 간격 밖에서 시작)
};

export const CAMERA = {
  back: 2.9, // 내 캐릭터 뒤로 얼마나 떨어질지
  height: 2.3, // 카메라 높이
  shoulder: 0.9, // 오른쪽 어깨 너머로 비켜선 정도 → 내 캐릭터는 화면 왼쪽, 상대는 가운데
  fov: 55,
  follow: 5, // 따라가는 빠르기. 작을수록 부드럽게(흔들리는 골반을 그대로 따라가지 않는다)
  stepBob: 0.012, // 발을 디딜 때 카메라가 살짝 내려앉는 정도(m)
  lookAhead: 2.2, // 내 앞쪽 얼마나 먼 곳을 화면 가운데로 볼지
};

export const BODY = {
  standHeight: 0.95, // 서 있을 때 골반 높이
  support: 1.0, // 골반을 떠받치는 힘(중력 대비 배수)
  supportStiffness: 2600, // 골반 높이 스프링 강도
  supportDamping: 260,
  uprightStiffness: 2500, // 몸을 똑바로 세우는 힘 (평형감각, N·m/rad)
  uprightDamping: 330, // 감쇠: 출렁이지 않고 딱 멈추는 값(감쇠비 ≈ 1)
  uprightAssist: 1.0, // 위 보조 힘의 비율
  footReaction: 0, // 체중·추진력의 반작용을 발에 싣는 비율 (실험 중: 1이면 걷다 넘어진다)
  upperShare: 0.15, // 걸을 때 미는 힘 중 가슴 쪽에 주는 비율 (크면 상체가 앞으로 꺾인다)
  accelLean: 0, // 가속할 때 몸 전체를 앞으로 숙이는 정도 (허리 근육이 대신 버틴다)
  moveSpeed: 2.5, // 걷는 최고 속도 (m/s). 보폭이 커서 빨라진다 (발 빠르기는 그대로)
  stepLength: 0.68, // 한 걸음 보폭(m). 성큼성큼. 다리 흔드는 속도가 이동 거리와 딱 맞게 계산된다.
  turnSpeed: 2.4, // 상대 쪽으로 몸을 돌리는 최고 속도 (라디안/초)
  moveAccel: 11, // 걷기 가속 정도 (클수록 발놀림이 민첩)
  maxAccel: 4.5, // 발로 땅을 밀어 낼 수 있는 최대 가속(m/s²). 사람은 대략 중력의 0.4~0.5배
  fallTiltDeg: 55, // 몸이 이 각도 이상 기울면 넘어진다
  fallDuration: 2.2, // 넘어진 뒤 일어나기 시작할 때까지 (초)
  getUpDuration: 1.2, // 일어나는 데 걸리는 시간 (초)
  shoveForce: 320, // 바짝 붙었을 때 빈손으로 상대를 밀쳐내는 힘(N). 같은 힘이 나에게도 반대로 걸린다
};

export const WEAPON = {
  mass: 1.6, // 롱소드 무게(kg). 실제 롱소드는 1.3~1.65kg. 무게중심은 코등이에서 약 11cm (fighter.js 칼 만들기)
  length: 1.05, // 칼날 길이
  aimStiffness: 60, // 칼끝 방향을 맞추는 회전 힘 (손목 힘). 낮을수록 칼이 관성대로 따라온다
  aimDamping: 11, // 칼이 흔들리지 않고 딱 서는 값 (감쇠비 ≈ 0.9)
  maxAimTorque: 22, // 두 손목이 칼을 돌리는 최대 힘(N·m). 사람 손목 굽힘 힘은 한 손 약 12N·m (Delp 1996)
  releaseDamping: 1.5, // 칼이 목표를 향해 날아가는 동안의 감쇠 (관성으로 간다)
  releaseMargin: 1.4, // 멈출 수 있는 거리의 몇 배 앞에서 제동을 시작할지
  brakeEcc: 1.3, // 버티며 늘어나는 근육은 조금 더 힘을 낸다 (제동력 배율)
  wristVmax: 30, // 손목이 힘을 전혀 못 내는 각속도 (rad/s, 힘-속도 관계)
  shoulderVmax: 18, // 어깨
  elbowVmax: 25, // 팔꿈치
  reach: 0.62, // 어깨에서 손까지 최대 거리
};

// ─────────────────────────────────────────────────────────────
//  타격과 상처 (하프 소드식: 체력 게이지 없음)
//  칼이 닿는 순간 "그 지점의 칼 속도"로 운동 에너지(줄, J)를 계산한다.
//  참고: 실제 롱소드 베기는 대략 60~130 J.
// ─────────────────────────────────────────────────────────────
export const STRIKE = {
  armAssist: 0.3, // 휘두를 때 칼 뒤에서 함께 밀어주는 팔·몸의 유효 질량(kg). 칼 자체의 유효 질량은 강체 역학으로 계산
  energyScale: 2.0, // 판정용 에너지 = 실제 운동 에너지 × 이 값. 이 모델의 베는 속도·유효 질량이 실제보다 조금 낮게 나와서
  //   상처 문턱값(ANATOMY)과 기절·비틀거림 세기를 예전 치명성에 맞춘 보정 (AI 대결 12판에서 사망 비율이 같아지는 값)
  dragC: 44, // 칼이 몸을 가를 때의 끌림 계수 (N·s/m): 한 순간에 흡수하는 에너지 = c·속도²·dt
  dragCap: 0.35, // 한 순간에 꺾을 수 있는 칼 속도의 비율 (한 번에 멈춰 서지 않게)
  stuckTime: 0.25, // 에너지가 모자라 박힌 칼을 붙잡아 두는 시간 (초)
  stuckDamp: 150, // 박힌 칼을 붙잡는 힘 (N·s/m)
  stuckForce: 500, // 그 힘의 한계 (N)
  edgeAlign: 0.6, // 칼날(날 선 쪽)이 움직이는 방향과 이만큼(cos) 맞아야 "베기". 아니면 칼 면으로 때린 것
  stabAlign: 0.75, // 칼끝 방향으로 이만큼 움직이면 "찌르기"
  minEnergy: 6, // 이보다 약한 접촉은 무시 (J)
  hitCooldown: 0.25, // 같은 부위에 연속으로 상처가 생기지 않게 (초)
};

// ─────────────────────────────────────────────────────────────
//  반작용: 칼끼리, 칼과 딱딱한 곳(투구·뼈)이 부딪힐 때 튕겨 나오는 정도
//  반발 계수 e = 부딪힌 뒤 떨어지는 속도 ÷ 부딪히기 전 다가오던 속도 (접촉점에서, 부딪히는 방향 성분)
//   0 = 찰흙처럼 딱 붙음, 1 = 고무공처럼 그대로 튕김. 손에 쥔 쇠칼끼리는 대략 0.1~0.3
//   (칼날이 휘며 떨고 손이 받아내면서 에너지를 먹는다. 추정값)
// ─────────────────────────────────────────────────────────────
export const STEEL = {
  // 칼(칼날·코등이·손잡이·폼멜) 재질의 반발 값. 둘이 만나면 곱해진다(Multiply): 칼끼리 = 이 값², 몸·땅(0)과는 0.
  //  물리 엔진은 반복 계산(6회)이 적어서 곱한 값의 절반쯤만 실제로 나온다 → 실제 칼끼리 반발 약 0.2~0.3
  restitution: 0.7,
  // 칼끼리 붙어 있는(바인드) 동안엔 튕기지 않는다: 떨어진 뒤 이 스텝 수가 지나야 다시 튕길 수 있다
  //  (맞댄 칼을 누를 때마다 접촉점이 새로 생겨 조금씩 튕기며 떨리는 것을 막는다)
  rearmSteps: 4,
  // 투구·뼈: 날이 들지 못하고 막힌 타격은 칼이 되튄다. 부위별 반발 계수(접촉점에서 직접 계산해 준다)
  helmet: 0.35, // 강철 투구 (안에 누비 모자가 받친다)
  skull: 0.15, // 맨머리 (두개골)
  bone: 0.08, // 팔·다리 (얇은 살 밑 뼈)
  reboundMinSpeed: 1.5, // 이보다 느리게(m/s) 닿으면 튕기지 않는다 (가볍게 댄 것)
  handMass: 1.5, // 되튐 계산에서 칼과 함께 밀리는 손·아래팔의 유효 질량(kg, 칼자루에 붙은 점 질량으로 본다)
  // 칼끼리 새로 부딪힌 순간 칼이 손 안에서 길이 축으로 도는 빠르기의 한도(rad/s, 부딪히기 전보다 빨라진 몫만).
  //  손아귀가 칼자루를 잡으니 코등이에 걸려 튕겨도 날이 휙 뒤집히지 않는다 (combat.js gripTwist)
  gripTwistMax: 40,
};

// 부딪힌 충격이 몸에 전해지는 방식 (fighter.js)
//  충격은 물리 엔진이 칼 → 손목 관절 → 팔 → 가슴으로 그대로 전한다 (팔은 근육 힘에 한계가 있어 밀리며 되튄다).
export const RECOIL = {
  joltImpulse: 3, // 이 충격량(N·s)으로 부딪히면 "크게 부딪힘"(fighter.jolt = 1). 롱소드끼리 세게 치면 3~6 N·s
  joltTime: 0.25, // 그 신호가 사라지는 시간(초)
  // 실험(기본 끔): 휘두르거나 부딪히는 동안 "기준 막대"(똑바로 서기 보조)가 몸통을 덜 붙잡게 해서
  //  휘두르는 반작용과 부딪힌 충격이 골반·몸통까지 전해진다 (가로베기에서 칼 무게 때문에 골반이 도는 각도 0.6° → 약 4°).
  //  AI 대결 32판에선 넘어짐이 늘지 않았지만, 혼자 베기 연습에서 몸 기울기가 2~3° 커진다.
  //  다리가 체중을 싣는 작업(걷기·균형)이 끝난 뒤 다시 재고 켜는 것을 권한다
  anchorRelax: false,
  anchorYaw: 0.15, // 그동안 몸통 비틀기(yaw)를 붙잡는 힘의 비율
  anchorPitch: 0.4, // 앞뒤로 숙이기(pitch)
};

// 부위별 몸의 성질
//  cut/stab: 베기/찌르기가 살을 가르기 시작하는 에너지(J) — 옷(누비 상의)과 뼈가 막아준다
//  absorb:   칼이 완전히 통과하려면 필요한 에너지(J). 모자라면 칼이 박히거나 튕긴다
//  bleed:    상처 심각도 1당 초당 출혈량(전체 피의 비율)
export const ANATOMY = {
  head: { cut: 30, stab: 20, absorb: 140, bleed: 0.03 },
  neck: { cut: 24, stab: 16, absorb: 45, bleed: 0.2 }, // 누비 상의 깃이 조금 막아준다
  chest: { cut: 45, stab: 25, absorb: 110, bleed: 0.025 },
  abdomen: { cut: 40, stab: 18, absorb: 90, bleed: 0.03 }, // 배: 뼈가 없어 찌르기에 약하다
  pelvis: { cut: 40, stab: 22, absorb: 100, bleed: 0.02 },
  arm: { cut: 22, stab: 18, absorb: 45, bleed: 0.012 },
  leg: { cut: 28, stab: 20, absorb: 60, bleed: 0.015 },
  helmet: { cut: 200, stab: 120, blunt: 0.4 }, // 투구: 머리 윗부분. blunt = 충격이 뇌에 전해지는 비율
};

export const VITALS = {
  collapseBlood: 0.45, // 피가 이 비율 아래로 떨어지면 쓰러져 죽는다
  weakBlood: 0.8, // 이 아래부터 힘이 빠지기 시작
  clotting: 0.12, // 출혈이 초당 이만큼(비율) 줄어든다 (피가 굳음)
  concussionPerJoule: 1 / 140, // 머리 둔기 충격 1J당 의식 감소
  dropSwordArm: 0.15, // 칼 든 팔 기능이 이 아래면 칼을 놓친다
  staggerPerJoule: 0.5, // 맞은 에너지 1J당 균형 게이지 감소
  balanceRegen: 22, // 초당 균형 게이지 회복
};

// 진짜 균형: 무게중심이 향하는 곳(캡처 포인트)이 발 밖으로 나가면 비틀거리며 발을 딛고,
// 너무 멀리 나가면 넘어진다.
export const BALANCE = {
  footMargin: 0.14, // 발 주위로 이만큼(m)은 버틸 수 있다
  stumbleRange: 0.35, // 발 밖으로 이만큼 벗어나면 딛는 걸음이 최대
  fallRange: 0.5, // 발 밖으로 이만큼 벗어나 잠깐이라도 버티지 못하면 넘어진다
  fallDelay: 0.25, // 이 시간(초) 동안 계속 벗어나 있으면 넘어짐
};

// 두 손 잡기: 빈손이 칼자루 끝을 쥐는 부드러운 스프링
export const GRIP = {
  on: true,
  along: -0.14, // 칼자루에서 빈손이 쥐는 곳 (칼 든 손 기준 칼끝 반대쪽으로 m). 두 손 사이가 지렛대가 된다
  reach: 0.25, // 손이 이만큼(m) 안으로 들어오면 쥐기 시작
  k: 1500, // 쥐는 힘의 강도 (N/m)
  d: 50, // 감쇠 (딱 멈추는 값 근처)
  maxForce: 250, // 손아귀 힘 한계 (N). 넘으면 손이 미끄러진다
};

// 검술 층(skill.js): 캐릭터가 이미 익힌 몸놀림을 얼마나 보태줄지 (자세 지도는 guards.js)
export const SKILL = {
  level: 0.7, // 플레이어 기본 숙련도 (0 = 날것의 물리 조작, 1 = 숙련된 검사). 메뉴의 "검술 보정"
  aimFilter: 14, // 손 목표를 따라가는 빠르기(rad/s). 클수록 날렵하지만 몸이 출렁인다
  aimFilterStrike: 24, // 휘두르는 동안의 빠르기 (근육을 긴장시켜 날카롭게)
  swingSpeed: 1.5, // 손 목표가 이보다 빠르게(m/s) 움직이면 "휘두르기"로 본다
  followGain: 0.6, // 이어 베기: 휘두르는 속도에 비례해 목표를 더 밀어주는 정도
  followMax: 0.15, // 이어 베기로 더해지는 최대 거리(m). 칼의 관성이 대부분의 이어 베기를 만든다
  followDecay: 0.3, // 이어 베기가 사라지는 시간(초)
  lungeMin: 1.3, // 이 거리(m)보다 멀고
  lungeMax: 2.4, // 이 거리보다 가까우면 휘두르며 한 걸음 내딛는다
  lungeTime: 0.3, // 내딛는 시간(초)
  lungeMove: 0.9, // 내딛는 세기 (조이스틱 앞으로 민 정도와 같은 단위)
  homeGuard: [0.18, -0.28], // 베고 나서 돌아갈 기본 자세의 패드 위치 (쟁기 Pflug: 칼끝이 상대 얼굴을 겨눈다)
  recoverDelay: 0.25, // 손가락을 떼고(또는 멈추고) 이만큼 지나면 자세로 돌아간다 (초)
  recoverSpeed: 1.2, // 자세로 돌아가는 손 빠르기 (m/s, 휘두르기 기준 swingSpeed보다 느리게)
};

// 몸이 자세를 따라가는 빠르기(rad/s). 골반이 가장 빠르고 → 가슴 → 손(SKILL.aimFilter) 순서라
// 베기를 시작하면 허리가 먼저 돌고 팔과 칼이 뒤따른다
export const SKILL_BODY = {
  pelvis: 34,
  chest: 26,
  holdAmount: 1, // 베지 않고 자세만 고칠 때 몸을 트는 정도 (벨 때 = 1). 줄이면 손이 몸통 대신 멀리 뻗어야 해서 오히려 흔들린다
  holdSpeed: 0.3, // 그때 몸이 따라가는 빠르기 비율 (느긋하게)
};

// 상대 AI (ai.js). 사람 검객처럼 간격을 지키며 빈틈을 노린다
//  reaction: 상대를 보고 알아차리기까지 걸리는 시간(초). AI는 이만큼 늦게 본다
//  windup: 준비 자세에서 멈칫하는 정도 (클수록 속내가 드러난다)
//  chamberSpeed/strikeSpeed/parrySpeed: 준비·베기·막기 때 손(패드)을 옮기는 빠르기(m/s)
//  guardChance: 상대 공격을 알아채고 대응할 확률, counter: 막는 대신 같은 순간에 맞받아 벨 확률(Indes)
//  feint: 속임수를 쓸 확률, followUp: 막히거나 맞힌 뒤 이어 칠 확률(Nachschlag)
//  predict: 상대 몸의 움직임을 앞질러 내다보는 정도 (0~1), read: 상대 자세의 빈틈을 읽는 눈 (0~1)
//  discipline: 간격을 지키는 정도 (0~1)
//  aggression: 인내심이 줄어드는 빠르기·공격 성향, skill: 검술 보정(자세 지도를 따르는 정도)
export const AI_LEVELS = {
  easy: { reaction: 0.38, windup: 1.2, chamberSpeed: 2.2, strikeSpeed: 7.5, parrySpeed: 3.5, guardChance: 0.35, predict: 0.4, counter: 0, feint: 0, followUp: 0.25, read: 0.35, discipline: 0.6, strength: 0.8, aggression: 0.6, skill: 0.4 },
  normal: { reaction: 0.26, windup: 0.6, chamberSpeed: 3, strikeSpeed: 11, parrySpeed: 4.5, guardChance: 0.6, predict: 0.75, counter: 0.2, feint: 0.15, followUp: 0.5, read: 0.65, discipline: 0.85, strength: 1.0, aggression: 0.9, skill: 0.7 },
  hard: { reaction: 0.17, windup: 0.4, chamberSpeed: 3.8, strikeSpeed: 13, parrySpeed: 5.5, guardChance: 0.85, predict: 1, counter: 0.35, feint: 0.3, followUp: 0.75, read: 0.9, discipline: 1.0, strength: 1.15, aggression: 1.0, skill: 0.85 },
};

export const INPUT = {
  touchSensitivity: 2.6, // 화면 높이만큼 끌었을 때 손이 움직이는 거리(m)
  mouseSensitivity: 0.0045, // 마우스 1픽셀당 손 이동 거리(m)
  tiltFullDeg: 22, // 이 각도만큼 기울이면 최고 속도
  tiltDeadDeg: 4, // 이 각도 이하 기울임은 무시
};

// 소리 (sound.js). 소리마다 들어보기: 메뉴의 "소리 들어보기"
export const SOUND = {
  volume: 0.8, // 전체 음량
  reverb: 0, // 경기장 울림 (0 = 끔. 전투는 마른 소리가 낫다는 피드백으로 끔). 쇳소리가 관중석에 되울리는 정도 (원래 소리 대비 울림 에너지 비율의 제곱근)
  samples: true, // 녹음된 소리(public/sfx, Kenney.nl CC0)를 합성 소리에 섞기
  maxVoices: 12, // 동시에 울리는 소리 개수 한도 (넘으면 가장 오래된 소리를 끈다 → 폰 부담 줄이기)
};
