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
  startGap: 2.4, // 시작할 때 두 검투사 사이 거리
};

export const CAMERA = {
  back: 2.9, // 내 캐릭터 뒤로 얼마나 떨어질지
  height: 2.3, // 카메라 높이
  shoulder: 0.9, // 오른쪽 어깨 너머로 비켜선 정도 → 내 캐릭터는 화면 왼쪽, 상대는 가운데
  fov: 55,
  lookAhead: 2.2, // 내 앞쪽 얼마나 먼 곳을 화면 가운데로 볼지
};

export const BODY = {
  standHeight: 0.93, // 서 있을 때 골반 높이
  support: 1.0, // 골반을 떠받치는 힘(중력 대비 배수)
  supportStiffness: 2600, // 골반 높이 스프링 강도
  supportDamping: 260,
  uprightStiffness: 900, // 몸을 똑바로 세우는 회전 힘
  uprightDamping: 90,
  moveSpeed: 1.5, // 걷는 최고 속도 (m/s)
  stepLength: 0.42, // 한 걸음 보폭(m). 다리 흔드는 속도가 이동 거리와 딱 맞게 계산된다.
  turnSpeed: 2.4, // 상대 쪽으로 몸을 돌리는 최고 속도 (라디안/초)
  moveAccel: 9, // 걷기 가속 정도
  fallTiltDeg: 55, // 몸이 이 각도 이상 기울면 넘어진다
  fallDuration: 2.2, // 넘어진 뒤 일어나기 시작할 때까지 (초)
  getUpDuration: 1.2, // 일어나는 데 걸리는 시간 (초)
};

export const WEAPON = {
  mass: 1.6, // 롱소드 무게(kg). 올리면 묵직하고 느려진다.
  length: 1.05, // 칼날 길이
  handStiffness: 1200, // 손이 목표 위치를 따라가는 스프링 강도
  handDamping: 60,
  maxHandForce: 480, // 팔 힘의 한계. 낮추면 무기가 더 무겁게 느껴진다.
  maxHandSpeed: 8, // 손이 낼 수 있는 최고 속도(m/s). 사람 손은 대략 8~10.
  aimStiffness: 70, // 칼끝 방향을 맞추는 회전 힘 (손목 힘). 낮을수록 칼이 관성대로 따라온다
  aimDamping: 5,
  maxAimTorque: 90,
  reach: 0.62, // 어깨에서 손까지 최대 거리
};

// ─────────────────────────────────────────────────────────────
//  타격과 상처 (하프 소드식: 체력 게이지 없음)
//  칼이 닿는 순간 "그 지점의 칼 속도"로 운동 에너지(줄, J)를 계산한다.
//  참고: 실제 롱소드 베기는 대략 60~130 J.
// ─────────────────────────────────────────────────────────────
export const STRIKE = {
  armAssist: 1.0, // 휘두를 때 칼 뒤에서 함께 밀어주는 팔·몸의 유효 질량(kg)
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
  neck: { cut: 12, stab: 10, absorb: 45, bleed: 0.2 },
  chest: { cut: 45, stab: 25, absorb: 110, bleed: 0.025 },
  pelvis: { cut: 40, stab: 22, absorb: 100, bleed: 0.02 },
  arm: { cut: 22, stab: 18, absorb: 45, bleed: 0.012 },
  leg: { cut: 28, stab: 20, absorb: 60, bleed: 0.015 },
  helmet: { cut: 200, stab: 120, blunt: 0.4 }, // 투구: 머리 윗부분. blunt = 충격이 뇌에 전해지는 비율
};

export const VITALS = {
  collapseBlood: 0.45, // 피가 이 비율 아래로 떨어지면 쓰러져 죽는다
  weakBlood: 0.8, // 이 아래부터 힘이 빠지기 시작
  clotting: 0.12, // 출혈이 초당 이만큼(비율) 줄어든다 (피가 굳음)
  concussionPerJoule: 1 / 80, // 머리 둔기 충격 1J당 의식 감소
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

export const AI_LEVELS = {
  easy: { reaction: 0.55, windup: 0.9, strikeSpeed: 5, guardChance: 0.25, strength: 0.8, aggression: 0.6 },
  normal: { reaction: 0.35, windup: 0.6, strikeSpeed: 7, guardChance: 0.5, strength: 1.0, aggression: 0.8 },
  hard: { reaction: 0.2, windup: 0.4, strikeSpeed: 9, guardChance: 0.75, strength: 1.15, aggression: 1.0 },
};

export const INPUT = {
  touchSensitivity: 2.6, // 화면 높이만큼 끌었을 때 손이 움직이는 거리(m)
  mouseSensitivity: 0.0045, // 마우스 1픽셀당 손 이동 거리(m)
  tiltFullDeg: 22, // 이 각도만큼 기울이면 최고 속도
  tiltDeadDeg: 4, // 이 각도 이하 기울임은 무시
};
