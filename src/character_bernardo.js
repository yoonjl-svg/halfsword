// 베르나르도 — 롤랑의 숙적 (사장님 10/23 19:0x '지금의 올리비에를 베르나르도로 바꾸자' — 겉모습은 샛별 저장소 전달본 977c2a43 의 올리비에(그쪽 id 'black_king') 그대로)
//  설정(감독 — 사장님께 말씀드림): 스페인 전승(13세기 연대기 · 로망세)의 레온 영웅 베르나르도 델 카르피오. 레온 왕이 샤를마뉴에게 나라를 넘기려 하자
//   외국 왕의 지배에 맞서, 롱스보에서 롤랑을 쓰러뜨린다고 전해진다. 샛별 저장소의 왕실 시안 'bernardo'(면갑을 올린 투구)와는 다른 인물이다.
//  손님 인물(characters.js CHARACTER_GUESTS — 무작위 회전 밖) · 방랑 전용(wander_rules.js WANDER_EXCLUSIVE — 사장님 10/23 저녁 '롤랑과 같은 방랑 보상': 이기면 금화 +250).
//  실력 · 유파(이베리아) · 목소리는 롤랑 시트를 복사해 같다 · 무기는 티소나(사장님 10/23 저녁 — 롤랑은 츠바이핸더). 투구가 없어 머리가 드러난다. 화면에 나오는 글 = 이름 · 별칭 · 대사(docs/text/editing_guide.md)
import { getLook } from './looks.js';
import { createRoland } from './character_roland.js';

/** baseline = 롤랑이 실력 숫자를 빌리는 인물 시트(아르토리아) */
export function createBernardo(baseline) {
  const base = structuredClone(createRoland(baseline));
  base.ai.persona.school = 'tizona'; // AI 꾸러미 = 무기(티소나 — 이베리아)
  return {
    ...base,
    id: 'bernardo',
    name: '베르나르도',
    epithet: '롤랑의 숙적',
    origin: '레온 왕국 · 카르피오',
    look: getLook('bernardo'),
    lookVersion: 'v1',
    weapon: 'tizona',
    school: '티소나를 든 이베리아 검객. 기존 유파 몸꼴·보법·탈류와 레베스 쳐내기를 사용한다.',
    backstory: '스페인 전승이 노래하는 레온의 영웅. 레온 왕이 나라를 샤를마뉴에게 넘기려 하자, 외국 왕의 지배를 받을 수 없다며 칼을 들었다. 롱스보 골짜기에서 프랑크 군을 막아서고 롤랑을 쓰러뜨렸다고 전해진다. 볕에 그을린 얼굴과 검은 수염을 감추지 않고, 먹빛 갑옷에 짙은 노란 어깨 망토를 걸쳤다.',
    want: '레온을 외국 왕의 손에 넘기지 않는 것.',
    temperament: '말보다 행동이 먼저이고, 한번 정한 뜻은 굽히지 않는다.',
    weaknesses: '투구를 쓰지 않아 머리가 드러난다. 목은 기존 판금 규칙대로 보호하지 않는다.',
    taunt: '레온은 누구에게도 넘어가지 않는다.',
    lines: {
      intro: ['레온은 누구에게도 넘어가지 않는다.', '외국 왕의 깃발은 이 골짜기를 넘지 못한다.'],
      attack: ['물러서라.'],
      hurt: ['…아직이다.'],
      win: ['레온의 땅은 레온의 것이다.'],
      lose: ['레온이여…'],
    },
  };
}
