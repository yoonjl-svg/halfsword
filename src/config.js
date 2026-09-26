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
  aimStiffness: 150, // 칼끝 방향을 맞추는 회전 힘
  aimDamping: 8,
  maxAimTorque: 200,
  reach: 0.62, // 어깨에서 손까지 최대 거리
};

export const DAMAGE = {
  minSpeed: 3.5, // 이 속도(m/s) 이하로 맞으면 피해 없음
  perSpeed: 4.5, // 속도 1 m/s 초과당 피해량
  stabBonus: 1.5, // 찌르기 보너스 배수
  hitCooldown: 0.3, // 같은 부위 연속 피해 방지 (초)
  parts: {
    head: 1.8,
    chest: 1.0,
    pelvis: 0.9,
    arm: 0.55,
    leg: 0.6,
  },
  balanceLossPerDamage: 1.6, // 맞은 피해당 균형 감소량
  balanceRegen: 18, // 초당 균형 회복량
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
