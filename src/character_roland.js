// 롤랑 — 돌아온 왕 (샛별 저장소 전달본 977c2a43 — 그쪽 id 'sebastian' · 들여오며 id 를 이름에 맞춤, docs/import/wander_heroes_import_2026-10-23.md)
//  손님 인물(characters.js CHARACTER_GUESTS — 무작위 회전 밖) · 방랑 전용(wander_rules.js WANDER_EXCLUSIVE — 일반 여정 무대에는 나오지 않는다).
//  겉모습 · 이야기는 샛별 쪽 승인 판. 실력 숫자(persona.level)는 아르토리아의 것을 빌리고, 숙련도는 6(사장님 10/24 01:1x '롤랑과 베르나르도는 6' — 전 4 · config AI_PROFICIENCY 6 칸),
//  자세 · 기술은 이베리아 유파가 스스로 고르게 아르토리아의 자세 · 기술 취향은 지운다.
//  무기 = 뒤랑달 (사장님 10/24 — 샛별 저장소 c039bcc7 에서 들여온 이베리아 레전드 · docs/import/durandal_import_2026-10-24.md): AI 꾸러미도 뒤랑달(schools.js — 스펙 school 'iberian'
//   · 무거운 틀이라 츠바이핸더와 같은 이베리아 몬탄테 동작 · 간격은 weapon_measured.js 뒤랑달 줄). 10/23 저녁 ~ 10/24 는 츠바이핸더(임시), 방랑 전달본은 티소나였다
import { getLook, CHARACTER_LOOK_VERSION } from './looks.js';

/** baseline = 실력 숫자를 빌릴 인물 시트(아르토리아) */
export function createRoland(baseline) {
  const ai = JSON.parse(JSON.stringify(baseline.ai));
  ai.proficiency = 6; // 사장님 10/24 01:1x — 이베리아 숙련도 6 (실력 이름 hard · 반응 0.05 s · 고유 특성 적극성 1.6 — 6 칸 수는 사장님 확인 전 · AI 이베리아 비기는 aiOpenSchools 로 닫힌 채)
  ai.persona.school = 'durandal'; // 유파 꾸러미 id = 무기 id (10/24 — 전 'zweihander')
  delete ai.persona.pers.guardPref;
  delete ai.persona.pers.techPref;
  ai.persona.idle = { guard: 'wechselR', gesture: 'still' };
  return {
    id: 'roland',
    name: '롤랑',
    epithet: '돌아온 왕',
    age: null,
    origin: '이베리아 서쪽 · 바다 너머에서 사라진 왕국',
    backstory: '왕이 군대를 이끌고 바다를 건넌 뒤, 누구도 돌아오지 않았다. 오랜 세월이 지나 안개가 성문을 덮은 밤, 왕의 문장을 새긴 기사가 홀로 돌아왔다. 상아빛 갑옷과 포도주색 망토는 출정하던 날 그대로였으나, 얼굴을 가린 투구는 끝내 열리지 않았다. 그를 뒤따르던 군대가 어디에 있는지, 귀환한 것이 정말 왕인지 아는 이는 없다.',
    want: '돌아오지 못한 군대의 길을 다시 여는 것. 그 길이 고향으로 이어지는지는 말하지 않는다.',
    school: '큰 양손검을 든 이베리아 몬탄테 검객. 기존 유파 몸꼴·보법·탈류와 레베스 쳐내기를 사용한다.',
    signatureMoves: '넓은 베기로 앞길을 닫고, 맞받은 칼을 바깥으로 쳐낸다.',
    favoriteGuards: '아래 탈류에서 칼을 되찾고, 양쪽 베기를 잇는다.',
    temperament: '승리한 왕의 위엄을 잃지 않았으나, 상대를 보는지 그 너머의 행군을 보는지 알 수 없다.',
    movementNotes: '새 전용 기술 없이 기존 이베리아 동작과 판금 감속을 적용한다. 전투 수치는 검토용 시작값이다.',
    weaknesses: '무거운 판금과 큰 검의 회수. 목은 기존 판금 규칙대로 보호하지 않는다.',
    weapon: 'durandal', // 롤랑의 성검 (사장님 10/24 — 전 츠바이핸더 임시)
    voice: 'tome',
    vitality: 1.1, // 버티는 힘 +10 % (사장님 10/24 01:5x '롤랑과 베르나르도는 체력도 +10%' — 초당 잃는 피 · 머리를 맞아 잃는 의식 ÷ 1.1, fighter.js · 방법은 사장님 확인 전)
    ai,
    look: getLook('roland'),
    lookVersion: CHARACTER_LOOK_VERSION.roland, // v2 (10/23 줄이면서 다듬은 판) — 옛 판 ?look=roland:v1
    taunt: '성문을 열어라. 아직 돌아올 자들이 있다.',
    lines: {
      intro: ['성문을 열어라. 아직 돌아올 자들이 있다.', '…너도 저 발소리가 들리느냐.'],
      attack: ['길을 비켜라.'],
      hurt: ['…아직이다.'],
      win: ['행군을 멈출 수는 없다.'],
      lose: ['그들은… 어디에…'],
    },
  };
}
