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
};

export const AI_LEVELS = {
  easy: { reaction: 0.55, windup: 0.9, strikeSpeed: 9, guardChance: 0.25, strength: 0.8, aggression: 0.6, skill: 0.4 },
  normal: { reaction: 0.35, windup: 0.6, strikeSpeed: 13, guardChance: 0.5, strength: 1.0, aggression: 0.8, skill: 0.7 },
  hard: { reaction: 0.2, windup: 0.4, strikeSpeed: 18, guardChance: 0.75, strength: 1.15, aggression: 1.0, skill: 1.0 },
};

export const INPUT = {
  touchSensitivity: 2.6, // 화면 높이만큼 끌었을 때 손이 움직이는 거리(m)
  mouseSensitivity: 0.0045, // 마우스 1픽셀당 손 이동 거리(m)
  tiltFullDeg: 22, // 이 각도만큼 기울이면 최고 속도
  tiltDeadDeg: 4, // 이 각도 이하 기울임은 무시
};
