import { buildCourtyardNight } from './stage_courtyard_night.js'; // 밤의 봉인의 중정 — 샛별 저장소에서 가져옴 (10/21, docs/import/courtyard_night_2026-10-21.md)
import { buildCourtyard } from './stage_courtyard.js'; // 봉인의 중정 · 밤 다섯째 ~ 일곱째 넷 — 샛별 저장소에서 가져옴 (10/17, docs/import/saetbyeol_round3_2026-10-17.md). 중정은 디자인 리뷰 뒤 고쳐 여정에 (docs/design/courtyard_fix_2026-10-17.md)
import { buildDunhuangNight } from './stage_dunhuang_night.js';
import { buildDayrNight } from './stage_dayr_night.js';
import { buildLoggiaNight, buildSacredGroveNight, buildCorsairNight } from './stage_night_third.js';
import { buildSluiceNight } from './stage_sluice_night.js';
import { buildEtnaNight, buildQinglanNight } from './stage_night_fifth.js';
import { buildClearingNight, buildCastleNight, buildCathedralNight } from './stage_night_second.js';
import { buildFrozenBayNight, buildTempleNight } from './stage_night_variants.js';
// ─────────────────────────────────────────────────────────────
//  스테이지(배경) 관리: 다섯 배경 중 하나를 짓고, 바꿀 때는 먼저 지은 배경을 깨끗이 치운다
//   오너 결정: 스테이지는 고르는 화면 없이 판마다 늘 같은 순서 — 포세이돈 신전 → 화전 터 → 산사 → 성 안뜰 → 대성당 (STAGE_ORDER).
//   무대마다 그곳이 고향인 검객이 상대로 나온다 (STAGE_FOE, 오너 결정).
//   어두운 홀은 쓰지 않는다(오너 결정, 순서에서 뺐다. ?stage=darkhall 로만 볼 수 있다). 언제 바꿀지·고정은 main.js
//   배경을 짓는 함수(arena.js · stage_*.js)는 scene 에 메쉬·입자를 더하고, 같이 쓰는 빛(hemi·sun)의 색·세기·자리와
//   scene.fog·background 를 바꾼다. 그래서 바꿀 때는
//    ① 먼저 지은 배경이 더한 것을 떼어 내고 GPU 자원(모양·재질·질감)을 풀고
//    ② 빛·안개·하늘색을 처음 값(main.js 가 만든 포세이돈 값)으로 되돌린 뒤
//    ③ 새로 짓는다.
//   물리와는 상관없다 (바닥·경계 벽은 main.js 가 판마다 따로 만든다. 시뮬은 이 파일을 읽지 않는다)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { buildArena } from './arena.js';
import { buildTemple } from './stage_temple.js';
import { buildCastle } from './stage_castle.js';
import { buildCathedral } from './stage_cathedral.js';
import { buildDarkHall } from './stage_darkhall.js';
import { buildClearing } from './stage_clearing.js';
import { buildClearingB } from './stage_clearing_b.js';
import { buildPoseidonNight } from './stage_poseidon_night.js';
import { weaponEnv } from './weapon_looks.js';
import { buildLoggia } from './stage_loggia.js';
import { buildCorsair } from './stage_corsair.js';
import { buildSacredGrove } from './stage_sacred_grove.js';
import { buildFrozenBay } from './stage_frozen_bay.js';
import { buildQinglan } from './stage_qinglan.js';
import { buildSluice } from './stage_sluice.js';
import { buildDayr } from './stage_dayr.js';
import { buildDunhuang } from './stage_dunhuang.js';
import { buildEtna } from './stage_etna.js';
import { buildSaengsaBridges, buildSaengsaCourt } from './stage_saengsa_maps.js'; // 생사전 전용 맵 (11/21 — 생사전 판에서만 · 여정 차례에 없음)

// 배경 id → 짓는 함수. 짓는 함수는 { update(dt), excite(amount), sunOffset? } 를 돌려준다
const BUILDERS = {
  courtyard_night: buildCourtyardNight, // 밤의 봉인의 중정: 비밀회담 · 늦게 닿은 명령 · 잘못된 교전 끝에 새벽 3 시 포격으로 무너진 중정 · 검은 연기 · 깨진 급수정의 새는 물 (stage_courtyard_night.js) — 광기의 마야 (여정 17)
  // 샛별 저장소에서 가져온 무대 다섯 (10/17 — 사장님 10/16~17 결정, 샛별 쪽). 밤 넷은 10/17 14:xx · 중정은 디자인 리뷰를 고친 뒤 10/17 15:4x 여정 순서(STAGE_ORDER)에 들어갔다
  dayr_night: buildDayrNight, // 밤의 소금 사막: 상인으로 위장한 암살단 · 끊긴 모의 · 등불 둘레의 참상 (stage_dayr_night.js) — 광기의 다라이시
  dunhuang_night: buildDunhuangNight, // 밤의 철불 절벽: 사방에서 겨루고 행군하는 오 · 월의 망령 (stage_dunhuang_night.js) — 광기의 병마용
  courtyard: buildCourtyard, // 봉인의 중정: 라자스탄풍 장밋빛 사암 역참 · 마야 뒤 계단 우물과 붉은 봉인의 문 · 가운데 급수정 엄폐물 · 장마 앞 늦은 오후 모래바람 (stage_courtyard.js) — 마야의 무대 (낮, 여정 12)
  etna_night: buildEtnaNight, qinglan_night: buildQinglanNight, // 밤의 화산섬 · 밤의 청람잔도 (stage_night_fifth.js) — 광기의 찬다 · 광기의 김씨
  sluice_night: buildSluiceNight, loggia_night: buildLoggiaNight, sacred_grove_night: buildSacredGroveNight, corsair_night: buildCorsairNight,
  clearing_night: buildClearingNight, castle_night: buildCastleNight, cathedral_night: buildCathedralNight,
  frozen_bay_night: buildFrozenBayNight,
  temple_night: buildTempleNight,
  poseidon:(scene) => buildArena(scene), // 바닷가 절벽 위 무너진 포세이돈 신전 (arena.js). 빛·안개는 main.js 처음 값을 그대로 쓴다
  temple: buildTemple, // 한국의 산 속 절 (stage_temple.js)
  castle: buildCastle, // 눈 내리는 중세 성의 안뜰, 해 질 녘 (stage_castle.js)
  cathedral: buildCathedral, // 무너진 고딕 대성당의 안 (stage_cathedral.js)
  clearing: buildClearingB, // 검은숲 변두리의 화전 터, 봄비 내리는 새벽 (stage_clearing_b.js, 오너가 고른 2안) — 브론의 고향
  clearing_a: buildClearing, // 1안 (stage_clearing.js: 오두막·염소·숯가마·밭돌 결투 자리). 보관용, ?stage=clearing_a 로만 본다
  clearing_a_dry: (scene, lights) => buildClearing(scene, lights, { rain: false }), // 1안의 비 없는 처음 모습 (보관용: ?stage=clearing_a_dry)
  poseidon_night: buildPoseidonNight, // 밤의 포세이돈 신전 — 하인리히 재등장·흑화 (stage_poseidon_night.js). 오너 결정으로 성 안뜰 뒤, 대성당 앞
  darkhall: buildDarkHall, // 어두운 성의 큰 홀, 밤 (stage_darkhall.js) — 쓰지 않는다(오너 결정): 순서에 없고 ?stage=darkhall 로만 본다
  // 샛별 저장소에서 가져온 세 무대 (사장님 지시 10/10 — 지오메트리·재질·조명·소리 그대로, docs/characters/import_saetbyeol_2026-10-09.md)
  loggia: buildLoggia, // 붉은 회랑: 쌍기둥 아치·붉은 천·사이프러스·석재 상감 바닥 (stage_loggia.js) — 토메 비달의 무대
  corsair: buildCorsair, // 산호 항구: 산호석 성문·삼각 돛배·푸른 바다 (stage_corsair.js) — 오마리의 무대
  sacred_grove: buildSacredGrove, // 신목의 숲: 거대한 신목·금줄과 흰 종이·이끼 (stage_sacred_grove.js) — 미나미의 무대
  // 샛별 저장소에서 가져온 두 무대 더 (사장님 10/10 20:4x '얼어붙은 만이 린드, 청람잔도가 김씨 전용 스테이지' — 지오메트리·재질·조명·소리 그대로, docs/stages.md)
  frozen_bay: buildFrozenBay, // 얼어붙은 만: 동시베리아 내륙 호수의 겨울 새벽, 먹청색 얼음·눈 덮인 물가·낙엽송·선착장 (stage_frozen_bay.js) — 투야나 니콜라예바(id eira, 전 이름 에이라 린드)의 무대
  qinglan: buildQinglan, // 청람잔도: 초여름 맑은 한낮, 큰 강 협곡 위 화강암 쉼터·돌계단·작은 정자·샘, 뒤 바위 면의 옛 판자 잔도 (stage_qinglan.js — 10/15 샛별 저장소 5a4e96c 판으로 되돌리고 리뷰 여섯 가지만 고침) — 김씨의 무대
  // 샛별 저장소에서 가져온 무대 (사장님 10/14 02:3x — 진흙 감속 켬 · 가운데 말레이곰 석상 충돌, docs/import/sluice_port_2026-10-14.md). 10/14 19:4x 여정 정식 경로로
  sluice: buildSluice, // 잠든 습지: 비 그친 한낮의 열대 담수 침수림, 진흙 섬·얕은 물·옛 돌 수문, 가운데 말레이곰 석상 (stage_sluice.js) — 라트나의 무대
  // 샛별 저장소에서 가져온 무대 (사장님 10/14 08:1x — 화면 이름 '소금 사막' · 해는 그림자가 나오는 가장 낮은 각, docs/import/salt_desert_port_2026-10-14.md). 10/14 19:4x 여정 정식 경로로
  dayr: buildDayr, // 소금 사막: 소금 벌판 가 벽돌 역참 안뜰의 해 질 녘, 문루 안의 낮은 해와 긴 그림자 (stage_dayr.js) — 다라이시의 무대. 코드 id 는 샛별 쪽 그대로
  // 샛별 저장소에서 가져온 무대 (사장님 10/14 19:4x — 화면 이름 '철불 절벽' · 벽화 그대로 · 결투장 띠 · 여정 정식 경로, docs/import/ironcliff_port_2026-10-14.md)
  dunhuang: buildDunhuang, // 철불 절벽: 침식된 절벽 앞 석굴 앞뜰의 초가을 아침, 6 층 누각과 창작 벽화 (stage_dunhuang.js). 코드 id 는 샛별 쪽 그대로 — 화면 이름에 '둔황'은 넣지 않는다
  // 샛별 저장소에서 가져온 무대 (사장님 10/14 19:4x — 화면 이름 '화산섬' · 결투장 전체 비탈 · 용암 규칙 약하게 · 결투장 띠 없음 · 여정 정식 경로, docs/import/volcano_port_2026-10-14.md)
  // 생사전 전용 맵 (사장님 11/21 '생사전 맵 1과 3으로 두 개 만들어.' — 설계 docs/design/saengsa_3v3_2026-11-21.md · 무대 표 src/saengsa_maps.js): 생사전 판에서만 짓는다 (STAGE_ORDER 에 없음 · 낮 하나)
  saengsa_bridges: buildSaengsaBridges, // 두 다리 개울: 강가 풀밭 · 개울을 건너는 돌 다리 둘 (stage_saengsa_maps.js)
  saengsa_court: buildSaengsaCourt, // 성벽 안뜰: 가운데 성벽을 지나는 문 둘 (stage_saengsa_maps.js)
  etna: buildEtna, // 화산섬: 해 뜨기 전 화산 능선, 결투장 전체가 불규칙 산비탈(평균 약 10°) · 낮은 쪽 용암(화상 — 다리·팔 기능 감소, 사망 없음) (stage_etna.js · 땅 etna_ground.js). 코드 id 는 샛별 쪽 그대로
};
export const STAGE_IDS = Object.keys(BUILDERS);
const DEFAULT_SUN_OFFSET = { x: 4, y: 9, z: 3 }; // sunOffset 을 안 주는 배경(포세이돈)의 해 방향

// 판마다 나오는 순서 (오너 결정: 하인리히 → 브론 → 랴오 → 이졸데 → 밤의 포세이돈(하인리히 재등장·흑화) → 마르그레테 의 고향 순).
//  이졸데는 한 번 쓰러져도 젊은 수련생의 투지로 다시 일어선다(오너 결정: 약한 게 아니다). 대성당 다음 판은 다시 포세이돈부터
//  10/10 사장님 지시로 샛별 저장소의 세 무대를 대성당 뒤에 이었다(기존 여섯 순서는 그대로): 붉은 회랑(토메 비달) → 산호 항구(오마리) → 신목의 숲(미나미)
//  10/10 20:4x 두 무대를 그 뒤에 더 이었다(앞 아홉 순서·자리는 그대로): 얼어붙은 만(투야나) → 청람잔도(김씨). 까닭: 이미 있는 판 순서를 하나도 안 밀고,
//   눈 내리는 성 안뜰(4번째)과 겨울 얼음만이 붙지 않게 멀리 두고, 숲(신목) → 겨울 새벽(얼음만) → 여름 한낮(잔도) → 다시 바닷가(포세이돈)로 계절·빛이 번갈아 바뀐다
//  10/14 19:4x 사장님 '습지, 소금 사막과 함께 정식 경로 포함' — 청람잔도 뒤에 잠든 습지 → 철불 절벽 → 화산섬 → 소금 사막 (감독 안,
//   확인표 1119 · 1214 · 1386 · 1463). 앞 열한 판의 순서·자리는 그대로이고, 끝은 숙련도 4 다라이시(소금 사막). 소금 사막 다음 판은 다시 포세이돈부터.
//   화산섬(etna, docs/import/volcano_port_2026-10-14.md)은 철불 절벽과 소금 사막 사이 — 소금 사막은 열다섯째로 밀렸다
// 10/14 23:0x 사장님 "스테이지 순서를 '밤의 포세이돈'을 맨 마지막으로 둬" → 밤의 포세이돈(광기의 하인리히)이 여정의 끝
// 10/16 19:0x 사장님 "스테이지 순서는 그렇게 해" — 감독 제안 4 막(docs/stages.md '판마다 정해진 순서'): 포세이돈에서 떠나 세계를 한 바퀴 돌아 밤의 포세이돈으로.
//  1막 유럽(길 떠남): 포세이돈 · 화전 터 · 성 안뜰 · 붉은 회랑 · 대성당 / 2막 남쪽 바다: 산호 항구 · 잠든 습지 · 화산섬 /
//  3막 동아시아(여름 → 겨울): 청람잔도 · 신목의 숲 · 산사 · 얼어붙은 만 / 4막 비단길 귀로(마지막 하루 — 아침 · 해 질 녘 · 밤): 철불 절벽 · 소금 사막 · 밤의 포세이돈.
//  처음 · 끝(포세이돈 · 밤의 포세이돈)과 화전 터 · 대성당 · 소금 사막 자리는 그대로. 저장된 이어하기는 무대 id 라 그대로 이어진다(번호만 바뀜)
// 10/16 19:4x 사장님 "스테이지를 5개 단위로 나누어서, 5개마다 밤 스테이지 5개가 이어지게 할거야. 그 다음은 다시 원래의 낮 스테이지 순서로 돌아감."
//  → 낮 다섯 · 밤 다섯이 번갈아 온다. 낮은 위 4 막 차례 그대로(밤의 포세이돈만 빠짐), 밤은 낮과 같은 차례로 다섯씩 (docs/stages.md 표).
//  밤 첫 다섯 = 방금 지나온 낮 다섯의 밤. 둘째 다섯 = 산호 항구 · 잠든 습지 · 신목의 숲의 밤 + 산사 · 얼어붙은 만의 밤
//  (화산섬 · 청람잔도의 밤이 아직 없어 다음 낮 묶음 두 곳의 밤을 당겨 씀). 끝 낮 묶음은 지금 네 곳. 밤 무대가 새로 생기면 같은 규칙으로 자리를 다시 잡는다
// 10/17 14:xx 사장님 "밤 스테이지와 전용 얼터 캐릭터들은 바로 여정에 넣고" — 샛별 저장소 셋째 들여오기의 밤 넷(화산섬 · 청람잔도 · 철불 절벽 · 소금 사막의 밤)을
//  위 규칙대로 자리 잡음: 둘째 밤 다섯 = 산호 항구 · 잠든 습지 · 화산섬 · 청람잔도 · 신목의 숲의 밤(당겨 쓰던 산사 · 얼어붙은 만의 밤은 제자리로) ·
//  끝 낮 넷 뒤에 그 넷의 밤(산사 · 얼어붙은 만 · 철불 절벽 · 소금 사막) — 스물여덟 판, 끝판 = 밤의 소금 사막(광기의 다라이시). 그다음은 다시 포세이돈부터.
//  봉인의 중정(마야 — 낮)은 디자인 리뷰 뒤 2 막 산호 항구와 잠든 습지 사이에 넣는다(사장님 같은 때 — 감독 10/16 제안 그대로). 그때 낮 묶음이 다시 다섯씩 갈린다
// 10/17 15:4x 사장님 '다 고쳐서 올려'(봉인의 중정 디자인 리뷰 '고쳐서 넣기'의 답) — 고친 중정을 2 막 산호 항구 바로 뒤(12 번째)에 넣었다. 낮 다섯 · 밤 같은 곳 규칙(10/16 19:4x) 그대로:
//  둘째 낮 = 산호 항구 · 봉인의 중정 · 잠든 습지 · 화산섬 · 청람잔도 → 그 밤 넷(중정은 밤 짝이 없다) → 셋째 낮 = 신목의 숲 · 산사 · 얼어붙은 만 · 철불 절벽 · 소금 사막 → 그 밤 다섯.
//  스물아홉 판, 끝판은 그대로 밤의 소금 사막. 2 막 색 차례 = 바다 파랑(산호 항구) → 장밋빛 · 주황(중정) → 초록(습지) → 검정 · 빨강(화산섬)
// 10/21 사장님 승인(샛별 저장소 밤의 봉인의 중정 — 디자인 · 성능 리뷰 뒤, docs/import/courtyard_night_2026-10-21.md): 같은 규칙(10/16 19:4x)대로 둘째 밤 묶음을
//  낮 묶음과 같은 차례로 — 밤의 산호 항구 바로 뒤(17 번째)에 밤의 봉인의 중정(광기의 마야). 둘째 밤 묶음이 다섯이 되어 서른 판 · 끝판은 그대로 밤의 소금 사막
export const STAGE_ORDER = [
  'poseidon', 'clearing', 'castle', 'loggia', 'cathedral',
  'poseidon_night', 'clearing_night', 'castle_night', 'loggia_night', 'cathedral_night',
  'corsair', 'courtyard', 'sluice', 'etna', 'qinglan',
  'corsair_night', 'courtyard_night', 'sluice_night', 'etna_night', 'qinglan_night',
  'sacred_grove', 'temple', 'frozen_bay', 'dunhuang', 'dayr',
  'sacred_grove_night', 'temple_night', 'frozen_bay_night', 'dunhuang_night', 'dayr_night',
];
// 무대 → 그 무대에서 나오는 상대 (캐릭터 id). 여기 없는 무대(어두운 홀)는 무작위 상대
//  10/14 19:4x: 잠든 습지 = 라트나 · 소금 사막 = 다라이시 (손님 인물 CHARACTER_GUESTS — CHARACTERS_BY_ID 로 풀린다, 무작위 회전에는 그대로 없음).
//   철불 절벽(dunhuang) = 병마용(terracotta, 손님 인물 — 10/14 감독 짝, 사장님 19:4x 정식 경로 결정에 따름)
//   화산섬(etna) = 찬다(사장님 10/14 19:4x '찬다는 화산섬이 전용 스테이지' — 10/14 감독이 병합 때 짝 지음)
//  10/21: 밤의 봉인의 중정 = 광기의 마야(samira_mad — 늘 세이버, characters.js)
export const STAGE_FOE = { courtyard_night: 'samira_mad', dayr_night: 'silver_wanderer_mad', dunhuang_night: 'terracotta_mad', courtyard: 'samira', etna_night: 'chanda_mad', qinglan_night: 'renji_mad', sluice_night: 'ratna_mad', loggia_night: 'tome_mad', sacred_grove_night: 'minami_mad', corsair_night: 'omari_mad', clearing_night: 'bran_mad', castle_night: 'isolde_mad', cathedral_night: 'margarethe_mad', frozen_bay_night: 'eira_mad', temple_night: 'liao_mad', poseidon: 'heinrich', clearing: 'bran', clearing_a: 'bran', clearing_a_dry: 'bran', temple: 'liao', castle: 'isolde', poseidon_night: 'heinrich_mad', cathedral: 'margarethe', loggia: 'tome', corsair: 'omari', sacred_grove: 'minami', frozen_bay: 'eira', qinglan: 'renji', sluice: 'ratna', dayr: 'silver_wanderer', dunhuang: 'terracotta', etna: 'chanda' };
// 그 무대 검객 후보 (사장님 10/10 20:0x — 샛별 저장소에서 가져온 넷의 무대 짝. 무대마다 한 명뿐인 STAGE_FOE 짝을 밀어내지 않고 후보로 더한다, 확인표 752).
//  여정(foe=stage)에서 그 무대를 열 때 [본디 짝, ...후보] 가운데 하나를 고르게 고른다 → 본디 짝은 그 무대에서 절반만 나온다.
//  졌을 때 같은 무대를 다시 열면 같은 상대(아래 stageFoeId 의 prevId). STAGE_FOE 자체는 그대로다
//  10/10 20:4x: 김씨·투야나(eira)는 전용 무대(청람잔도·얼어붙은 만, 위 STAGE_FOE 정식 짝)가 생겨 산사·성 안뜰 후보에서 뺐다 → 랴오·이졸데는 다시 늘 나온다.
//   아르토리아·사미라는 후보 — 본디 짝과 반반(사장님 '무대 후보 비율은 반반')
//  10/10 23:3x 사장님 '아르토리아는 대성당으로 반반, 사미라는 볼로냐 도서관으로 반반' → 짝을 바꿨다(대성당 = 마르그레테·아르토리아, 붉은 회랑 = 토메·사미라)
//  10/17 14:xx 사장님 '전용 얼터 캐릭터들은 바로 여정에' → 밤의 대성당 후보는 광기의 아르토리아(샛별 저장소 셋째 들여오기 — 궁정 예복 · 갑옷 없음). 낮 대성당은 아르토리아 그대로
//  10/17 사장님 '봉인의 중정 이식이 끝나면 마야는 거기서만 나올거야' → 중정이 여정에 들어가(15:4x '다 고쳐서 올려') 붉은 회랑의 마야 후보를 뺐다 — 붉은 회랑은 늘 토메, 마야는 중정(STAGE_FOE)에서만
//  10/23 18:3x 사장님 '아르토리아 방랑 전용' → 대성당 · 밤의 대성당 후보를 뺐다 — 대성당은 늘 마르그레테 · 밤의 대성당은 늘 광기의 마르그레테.
//   아르토리아 두 모습은 30 무대를 모두 깬 뒤 방랑에서만 나온다(wander_rules.js WANDER_EXCLUSIVE). 후보 틀(stageFoeId)은 그대로 둔다
export const STAGE_FOE_EXTRA = {};
/** 이번 판 무대의 검객 id: 후보가 없으면 STAGE_FOE 그대로(난수 안 씀). 지난 상대(prevId)가 이 무대 후보면 그 사람 그대로(진 뒤 다시 싸우기) */
export function stageFoeId(stageId, prevId = null, rnd = Math.random) {
  const base = STAGE_FOE[stageId];
  const extra = STAGE_FOE_EXTRA[stageId];
  if (!extra?.length) return base;
  const pool = base ? [base, ...extra] : [...extra];
  if (prevId && pool.includes(prevId)) return prevId;
  return pool[Math.floor(rnd() * pool.length)];
}

// 무대의 화면 이름 (10/14 왼쪽 위 '스테이지 3 · 산사' — docs/ui/hud_intro_2026-10-14.md). 이름은 docs/stages.md 의 무대 이름 그대로
//  (보관용 1안 두 무대는 같은 화전 터). 번호는 STAGE_ORDER 의 자리 + 1, 순서표에 없는 무대(어두운 홀 등)는 이름만 (stageLabel)
export const STAGE_NAME_KO = {
  courtyard_night: '밤의 봉인의 중정', // 10/21 — 낮 이름(봉인의 중정)에 '밤의'를 붙이는 다른 밤 무대 규칙대로
  dayr_night: '밤의 소금 사막', // 사장님 10/17 14:xx '네 제안대로' — 낮 이름(소금 사막, 사장님 10/14)에 맞춤 (샛별 쪽 '밤의 소금길 역참')
  dunhuang_night: '밤의 철불 절벽',
  courtyard: '봉인의 중정',
  etna_night: '밤의 화산섬', qinglan_night: '밤의 청람잔도',
  sluice_night: '밤의 잠든 습지', loggia_night: '밤의 붉은 회랑', sacred_grove_night: '밤의 신목의 숲', corsair_night: '밤의 산호 항구',
  clearing_night: '밤의 화전 터', castle_night: '밤의 성 안뜰', cathedral_night: '밤의 대성당',
  frozen_bay_night: '밤의 얼어붙은 만', temple_night: '밤의 산사',
  poseidon: '포세이돈 신전', clearing: '화전 터', clearing_a: '화전 터', clearing_a_dry: '화전 터', temple: '산사', castle: '성 안뜰',
  poseidon_night: '밤의 포세이돈 신전', cathedral: '대성당', darkhall: '어두운 홀', loggia: '붉은 회랑', corsair: '산호 항구',
  sacred_grove: '신목의 숲', frozen_bay: '얼어붙은 만', qinglan: '청람잔도', sluice: '잠든 습지',
  dayr: '소금 사막', // 사장님 10/14 08:1x (샛별 쪽 '소금길의 (마지막) 역참') — 코드 id 는 그대로
  dunhuang: '철불 절벽', // 사장님 10/14 19:4x (샛별 쪽 '천불의 절벽') — '둔황'은 화면 이름에 넣지 않는다. 코드 id 는 그대로
  saengsa_bridges: '두 다리 개울', saengsa_court: '성벽 안뜰', // 생사전 전용 맵 (11/21 — src/saengsa_maps.js 무대 표 이름과 같음)
  etna: '화산섬', // 사장님 10/14 19:4x — 실제 지명은 화면에 쓰지 않는다 (코드 id 는 샛별 쪽 그대로)
};
/** 왼쪽 위 첫 줄: '스테이지 N · 이름' (순서표 밖이면 이름만) */
export function stageLabel(id) {
  const name = STAGE_NAME_KO[id] ?? id ?? '';
  const i = STAGE_ORDER.indexOf(id);
  return i >= 0 ? `스테이지 ${i + 1} · ${name}` : name;
}

/** prev 다음 판의 배경. prev 가 순서에 없으면(처음, 또는 순서 밖 배경) 맨 앞(포세이돈)부터 */
export function nextStage(prev = null) {
  return STAGE_ORDER[(STAGE_ORDER.indexOf(prev) + 1) % STAGE_ORDER.length];
}

const materialsOf = (o) => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []);
/** o 가 쓰는 모양·재질·질감을 set 에 모은다 */
function collect(o, set) {
  if (o.geometry) set.add(o.geometry);
  for (const m of materialsOf(o)) {
    set.add(m);
    for (const v of Object.values(m)) if (v && v.isTexture) set.add(v);
  }
}

export class Stages {
  /** scene 과 같이 쓰는 빛 { hemi, sun }. 만들 때의 빛·안개·하늘색을 처음 값으로 적어 둔다 (배경을 짓기 전에 만들 것).
   *  builders = 배경 id → 짓는 함수 (기본 BUILDERS — 시험이 작은 배경을 넣어 짓기 · 미리 짓기 · 올리기를 본다: tools/sim/stage_prep.test.mjs) */
  constructor(scene, { hemi, sun }, builders = BUILDERS) {
    this.builders = builders;
    this.scene = scene;
    this.hemi = hemi;
    this.sun = sun;
    this.base = {
      background: scene.background?.clone?.() ?? null,
      fog: scene.fog ? scene.fog.clone() : null,
      hemiColor: hemi.color.clone(),
      hemiGround: hemi.groundColor.clone(),
      hemiIntensity: hemi.intensity,
      hemiPos: hemi.position.clone(),
      sunColor: sun.color.clone(),
      sunIntensity: sun.intensity,
      sunPos: sun.position.clone(),
      shadow: shadowOf(sun), // 그림자 카메라 처음 값 (main.js: 1024² · ±4 m · 1~25 m) — 무대가 shadow 를 주면 바꿨다가 치울 때 되돌린다
    };
    this.snap = null; // 그림자 화소 맞춤 (무대 shadow.snap — 소금 사막): { right, up, du, dv } · 없으면 null
    this.id = null; // 지금 배경 id
    this.arena = null; // 지금 배경 { update, excite }
    this.sunOffset = DEFAULT_SUN_OFFSET; // 해가 싸우는 자리를 따라다닐 때의 방향
    this.objects = []; // 지금 배경이 scene 에 더한 것 (치울 때 쓴다)
    this.buildMs = 0; // 방금 짓는 데 걸린 시간 (ms) — ?fps=1 표시와 시험용
    this.clearMs = 0; // 먼저 지은 배경을 치우는 데 걸린 시간 (ms)
    this.warmMs = 0; // 새 배경을 GPU 에 미리 올리는 데 걸린 시간 (ms, warm)
    this.next = null; // 결과 창에서 미리 지은 다음 배경 (prepStep — 장면에서 떼어 둔다) { id, arena, objects, env, buildMs, step, … } · 없으면 null
    this.early = false; // 지금 배경을 결과 창에서 미리 지었나 (성능 표 · 시험용)
    this.warmed = false; // 지금 배경의 GPU 준비를 결과 창에서 다 했나 (그러면 warm 이 건너뛴다)
    this.prepFailed = null; // 미리 짓다 오류가 난 배경 id (다시 해 보지 않는다 — 단추를 누르면 build 가 예전처럼 짓는다)
  }

  /** id 배경을 짓는다 (먼저 지은 배경은 치우고, 빛·안개·하늘색은 처음 값으로 되돌린 뒤). 반환: { update, excite, sunOffset }
   *  결과 창에서 미리 지어 둔 배경이면(prepStep) 그것을 장면에 올리기만 한다 (adopt) */
  build(id) {
    const make = this.builders[id];
    if (!make) throw new Error(`모르는 배경: ${id}`);
    if (this.next?.id === id) return this.adopt();
    this.dropNext();
    const t0 = performance.now();
    this.clear();
    this.restore();
    const t1 = performance.now();
    const before = new Set(this.scene.children);
    this.arena = make(this.scene, { hemi: this.hemi, sun: this.sun });
    this.objects = this.scene.children.filter((o) => !before.has(o));
    this.sunOffset = this.arena.sunOffset ?? DEFAULT_SUN_OFFSET;
    if (this.arena.shadow) this.useShadow(this.arena.shadow);
    this.id = id;
    this.clearMs = t1 - t0;
    this.buildMs = performance.now() - t1;
    this.early = this.warmed = false;
    return this.arena;
  }

  // ── 다음 판 배경을 결과 창에서 미리 (사장님 11/22 '다음판 열 때 멈춰.' · 감사 N-025) ──
  //  무대가 바뀌는 판을 열 때 짓기 · 셰이더 만들기 · 그래픽 칩의 첫 그리기(헤드리스 크롬에서 약 1 초 — 셰이더마다 그리기 상태를 처음 맞추는 일)가
  //  한 프레임에 몰려 화면이 멈췄다. 결과 창은 3D 를 그리지 않고 쉬므로(main.js frame) 그동안 한 프레임에 한 걸음씩 해 둔다:
  //   ① 짓기 (장면에서 떼어 둔다 — 지금 배경 · 빛 · 안개는 그대로) ② 셰이더(compileAsync) · 질감 올리기 ③ 화면 밖 작은 판에 몇 재질씩 나눠 그리기.
  //  모두 같은 일 차례 안에서 다음 배경을 잠깐 장면에 올렸다 되돌린다(withNext) — 그 사이 화면에 나가는 장은 없고, 결과 창 동안 화면 크기가 바뀌어
  //  한 장 더 그려도 지금 배경 그대로다. 단추를 누르면 build(id) 가 미리 지은 것을 올리고(adopt) warm 은 남은 일만 한다.

  /** 지금 빛 · 안개 · 하늘색 · 그림자 설정 (지금 배경과 미리 지은 배경을 오갈 때) */
  envOf() {
    return {
      background: this.scene.background,
      fog: this.scene.fog,
      hemiColor: this.hemi.color.clone(),
      hemiGround: this.hemi.groundColor.clone(),
      hemiIntensity: this.hemi.intensity,
      hemiPos: this.hemi.position.clone(),
      sunColor: this.sun.color.clone(),
      sunIntensity: this.sun.intensity,
      sunPos: this.sun.position.clone(),
      shadow: shadowOf(this.sun),
      snap: this.snap,
      sunOffset: this.sunOffset,
    };
  }

  /** envOf 로 적어 둔 값으로 되돌린다 (그림자 지도 크기가 다르면 three 가 다음 그림에서 새로 만든다 — useShadow) */
  setEnv(e) {
    this.scene.background = e.background;
    this.scene.fog = e.fog;
    this.hemi.color.copy(e.hemiColor);
    this.hemi.groundColor.copy(e.hemiGround);
    this.hemi.intensity = e.hemiIntensity;
    this.hemi.position.copy(e.hemiPos);
    this.sun.color.copy(e.sunColor);
    this.sun.intensity = e.sunIntensity;
    this.sun.position.copy(e.sunPos);
    this.sunOffset = e.sunOffset;
    this.useShadow(e.shadow);
    this.snap = e.snap;
  }

  /** id 배경을 지어 두되 장면에서 떼어 둔다 (지금 배경 · 빛 · 안개는 그대로 — build 와 같은 차례로 지은 뒤 되돌린다) */
  prepare(id) {
    const make = this.builders[id];
    if (!make) throw new Error(`모르는 배경: ${id}`);
    this.dropNext();
    const t0 = performance.now();
    const cur = this.envOf();
    for (const o of this.objects) this.scene.remove(o); // 짓는 동안 장면은 build 의 clear 뒤와 같다 (이름으로 제 물체를 찾는 무대가 지금 배경 것을 집지 않게)
    const before = new Set(this.scene.children);
    let next = null;
    try {
      this.restore();
      const arena = make(this.scene, { hemi: this.hemi, sun: this.sun });
      this.sunOffset = arena.sunOffset ?? DEFAULT_SUN_OFFSET;
      if (arena.shadow) this.useShadow(arena.shadow);
      next = { id, arena, objects: this.scene.children.filter((o) => !before.has(o)), env: this.envOf(), step: 'compile' };
    } finally {
      for (const o of this.scene.children.filter((c) => !before.has(c))) this.scene.remove(o);
      this.setEnv(cur);
      for (const o of this.objects) this.scene.add(o);
    }
    next.buildMs = performance.now() - t0;
    next.t0 = t0;
    this.next = next;
  }

  /** 미리 지은 배경을 잠깐 장면에 올려 fn 을 부르고 지금 배경으로 되돌린다 (같은 일 차례 안 — 화면에 나가는 장 없음) */
  withNext(fn) {
    const n = this.next;
    const cur = this.envOf();
    for (const o of this.objects) this.scene.remove(o);
    this.setEnv(n.env);
    for (const o of n.objects) this.scene.add(o);
    try {
      return fn();
    } finally {
      for (const o of n.objects) this.scene.remove(o);
      this.setEnv(cur);
      for (const o of this.objects) this.scene.add(o);
    }
  }

  /**
   * 결과 창에서 프레임마다 한 걸음 (main.js frame — 3D 를 그리지 않고 쉬는 동안): 짓기 → 셰이더 · 질감 → 화면 밖 판에 나눠 그리기 → 끝.
   *  다 하면 true. 셰이더는 compileAsync — 그래픽 칩이 따로 만드는 동안(KHR_parallel_shader_compile 이 없으면 몇 프레임 쉬어 준다) 기다리지 않는다
   */
  prepStep(id, renderer, camera) {
    if (this.next && this.next.id !== id) this.dropNext();
    if (!this.next) {
      if (this.prepFailed === id) return false;
      try {
        this.prepare(id);
      } catch (e) {
        this.prepFailed = id; // 단추를 누르면 build 가 예전처럼 다시 짓는다 (오류도 그때 그대로 난다)
        console.warn('다음 배경 미리 짓기 실패', id, e);
      }
      return false;
    }
    const n = this.next;
    try {
      return this.prepMore(n, renderer, camera);
    } catch (e) {
      n.step = 'failed'; // 지은 배경은 그대로 쓰고 GPU 준비는 단추를 누를 때 예전처럼 (warm)
      n.rt?.dispose();
      n.rt = null;
      console.warn('다음 배경 미리 준비 실패', id, e);
      return false;
    }
  }

  /** prepStep 의 짓기 뒤 걸음들 */
  prepMore(n, renderer, camera) {
    if (n.step === 'compile') {
      const res = new Set();
      for (const o of n.objects) o.traverse((c) => collect(c, res));
      this.withNext(() => {
        // 확장(KHR_parallel_shader_compile)이 있으면 compileAsync 가 셰이더가 다 이어질 때까지 기다려 준다. 없으면 같은 compile 뒤 곧바로 풀리므로
        //  그냥 compile (three 의 '확장 없음' 경고를 콘솔에 남기지 않게) — 그래픽 칩이 셰이더를 잇는 동안 아래서 몇 프레임 쉰다
        if (renderer.extensions.has('KHR_parallel_shader_compile')) renderer.compileAsync(this.scene, camera).then(() => (n.ready = true));
        else renderer.compile(this.scene, camera), (n.ready = true);
        for (const r of res) if (r.isTexture) renderer.initTexture(r);
      });
      renderer.getContext().flush(); // 화면에 나가는 장이 없으면 명령이 쌓인 채 그래픽 칩에 안 간다 — 지금 보내 쉬는 동안 셰이더를 잇게
      n.rest = PREP_REST;
      n.step = 'wait';
      return false;
    }
    if (n.step === 'wait') {
      if (!n.ready || n.rest-- > 0) return false;
      n.chunks = this.withNext(() => warmChunks(this.scene));
      n.drawn = 0;
      n.step = 'draw';
    }
    const gl = renderer.getContext();
    if (n.step === 'draw') {
      const chunk = n.chunks.shift();
      if (chunk) {
        n.rt ??= warmTarget(renderer);
        this.withNext(() => drawOffscreen(renderer, this.scene, camera, chunk, n.rt));
        n.drawn++;
      }
      // 그린 명령을 프레임마다 그래픽 칩에 보낸다 (안 보내면 쌓였다가 단추를 누른 뒤 첫 장과 함께 가서 그때 멈칫한다)
      if (n.chunks.length) return gl.flush(), false;
      n.rt?.dispose();
      n.rt = null;
      n.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); // 그래픽 칩이 다 끝냈는지 기다리지 않고 묻는다 (다음 걸음)
      n.gl = gl;
      gl.flush();
      n.step = 'fence';
      return false;
    }
    if (n.step === 'fence') {
      if (n.fence && gl.getSyncParameter(n.fence, gl.SYNC_STATUS) !== gl.SIGNALED) return false;
      if (n.fence) gl.deleteSync(n.fence);
      n.fence = null;
      n.step = 'done';
      n.tookMs = performance.now() - n.t0; // 짓기부터 그래픽 칩이 다 그릴 때까지 (시험용 — game.stage.next)
    }
    return n.step === 'done';
  }

  /** 미리 지은 배경을 장면에 올린다 (build 가 같은 id 를 부르면): 새 배경을 먼저 올리고 지금 배경을 치운다 — 둘이 같이 쓰는 자원(모듈에 한 번 만든 질감 등)은 풀지 않게 */
  adopt() {
    const n = this.next;
    this.next = null;
    n.rt?.dispose();
    const t0 = performance.now();
    for (const o of n.objects) this.scene.add(o);
    this.clear();
    this.setEnv(n.env);
    this.objects = n.objects;
    this.arena = n.arena;
    this.id = n.id;
    this.clearMs = performance.now() - t0;
    this.buildMs = n.buildMs;
    if (n.fence) n.gl.deleteSync(n.fence);
    this.early = true;
    this.warmed = n.step === 'done' || n.step === 'fence'; // 'fence' = 다 그려 보냈고 그래픽 칩이 마저 하는 중 — 캔버스에 다시 그리지 않는다 (남은 몫은 첫 장이 기다린다)
    return this.arena;
  }

  /** 미리 지은 배경을 버린다 (다른 배경을 짓게 됐을 때): 지금 장면이 같이 쓰는 자원은 두고 푼다 (clear 와 같은 셈) */
  dropNext() {
    const n = this.next;
    if (!n) return;
    this.next = null;
    n.rt?.dispose();
    if (n.fence) n.gl.deleteSync(n.fence);
    const keep = new Set([weaponEnv()]);
    for (const o of this.scene.children) o.traverse((c) => collect(c, keep));
    const res = new Set();
    const objs = [];
    for (const o of n.objects)
      o.traverse((c) => {
        objs.push(c);
        collect(c, res);
      });
    for (const r of res) if (!keep.has(r)) r.dispose();
    for (const c of objs) c.dispose?.();
  }

  /**
   * 새 배경을 GPU 에 미리 올린다: 셰이더(compile, 화면 밖 것까지) · 질감(initTexture) · 모양(한 번 그려 보기).
   *  안 하면 이 일이 싸움 첫 프레임에 몰려 멈칫한다. 짓자마자 불러서 그 멈칫도 메뉴가 떠 있는 동안 지나가게 한다.
   *  그래픽 칩은 명령을 나중에 몰아서 처리하므로 끝까지 기다린다(finish). 안 기다리면 그 몫이 결국 첫 프레임에 온다.
   *  (한 번 그린 그림은 화면에 안 나간다: 같은 프레임 안에서 게임 루프가 다시 그린 뒤에 화면에 나간다)
   */
  warm(renderer, camera) {
    if (this.warmed) {
      // 결과 창에서 다 해 두었다 (prepStep — 셰이더 · 질감 · 화면 밖 그리기)
      this.warmed = false;
      this.warmMs = 0;
      return;
    }
    const t0 = performance.now();
    renderer.compile(this.scene, camera);
    const res = new Set();
    for (const o of this.objects) o.traverse((c) => collect(c, res));
    for (const r of res) if (r.isTexture) renderer.initTexture(r);
    renderer.render(this.scene, camera);
    renderer.getContext().finish();
    this.warmMs = performance.now() - t0;
  }

  /**
   * 지금 배경이 더한 것을 scene 에서 떼고 GPU 자원을 푼다.
   *  남는 것(캐릭터·핏방울·빛 …)이 같이 쓰는 모양·재질·질감과 무기 반사 환경(weaponEnv: 성의 종·대성당의 꽂힌 칼도 쓴다,
   *  모듈에 한 번 만들어 두고 무기마다 다시 쓴다)은 풀지 않는다
   */
  clear() {
    if (!this.objects.length) return;
    const mine = new Set(this.objects);
    const keep = new Set([weaponEnv()]);
    for (const o of this.scene.children) if (!mine.has(o)) o.traverse((c) => collect(c, keep));
    const res = new Set();
    const objs = [];
    for (const o of this.objects) {
      this.scene.remove(o);
      o.traverse((c) => {
        objs.push(c);
        collect(c, res);
      });
    }
    for (const r of res) if (!keep.has(r)) r.dispose();
    for (const c of objs) c.dispose?.(); // 인스턴스 메쉬의 자리·색 버퍼 (그 밖의 물체는 할 일이 없다)
    this.objects = [];
    this.arena = null;
  }

  /** 빛·안개·하늘색을 처음 값으로 */
  restore() {
    const b = this.base;
    this.scene.background = b.background?.clone?.() ?? null;
    this.scene.fog = b.fog ? b.fog.clone() : null;
    this.hemi.color.copy(b.hemiColor);
    this.hemi.groundColor.copy(b.hemiGround);
    this.hemi.intensity = b.hemiIntensity;
    this.hemi.position.copy(b.hemiPos);
    this.sun.color.copy(b.sunColor);
    this.sun.intensity = b.sunIntensity;
    this.sun.position.copy(b.sunPos);
    this.useShadow(b.shadow);
    this.snap = null;
  }

  /**
   * 무대 전용 그림자 카메라 (10/14 소금 사막 — 낮은 해의 긴 그림자): { left, right, top, bottom, near, far, mapSize, bias, normalBias, snap }.
   *  주지 않은 칸은 처음 값. 지도 크기가 바뀌면 지금 지도를 풀어 three 가 다음 그림에서 새 크기로 만들게 한다.
   *  snap 이면 해 방향에서 본 가로·세로 축과 화소 한 칸 크기를 적어 두고 snapSun 이 쓴다 (해 방향은 무대마다 고정)
   */
  useShadow(s) {
    const b = this.base.shadow, sh = this.sun.shadow, cam = sh.camera;
    for (const k of ['left', 'right', 'top', 'bottom', 'near', 'far']) cam[k] = s[k] ?? b[k];
    cam.updateProjectionMatrix();
    const size = s.mapSize ?? b.mapSize;
    if (sh.mapSize.x !== size || sh.mapSize.y !== size) {
      sh.mapSize.set(size, size);
      sh.map?.dispose();
      sh.map = null;
    }
    sh.bias = s.bias ?? b.bias;
    sh.normalBias = s.normalBias ?? b.normalBias;
    this.snap = null;
    if (s.snap) {
      // three 의 그림자 카메라는 해 자리에서 과녁을 본다(위 = +Y): 앞 L = 해 쪽, 가로 = Y × L, 세로 = L × 가로 (Matrix4.lookAt 과 같은 축)
      const L = new THREE.Vector3(this.sunOffset.x, this.sunOffset.y, this.sunOffset.z).normalize();
      const right = new THREE.Vector3(0, 1, 0).cross(L).normalize();
      const up = new THREE.Vector3().crossVectors(L, right);
      this.snap = { right, up, du: (cam.right - cam.left) / size, dv: (cam.top - cam.bottom) / size };
    }
  }

  /**
   * 그림자 화소 맞춤 (main.js updateCamera 가 해를 싸우는 자리로 옮긴 뒤 매 프레임): 해와 과녁을 같이 조금 옮겨 과녁이 그림자 지도 격자의
   *  화소 모서리에 오게 한다 → 카메라가 움직여도 그림자 화소 격자는 땅에 고정돼 긴 그림자 가장자리가 기어다니지 않는다. 옮기는 양은 화소 반 칸 안.
   *  snap 을 켜지 않은 무대는 아무 일도 없다 (해 자리 그대로)
   */
  snapSun() {
    const s = this.snap;
    if (!s) return;
    const t = this.sun.target.position;
    const pu = t.dot(s.right), pv = t.dot(s.up);
    _snap.copy(s.right).multiplyScalar(Math.round(pu / s.du) * s.du - pu).addScaledVector(s.up, Math.round(pv / s.dv) * s.dv - pv);
    t.add(_snap);
    this.sun.position.add(_snap);
  }
}

const _snap = new THREE.Vector3();

const PREP_REST = 3; // 셰이더를 보낸 뒤 그리기 전에 쉬는 프레임 (확장 KHR_parallel_shader_compile 이 없을 때 그래픽 칩이 셰이더를 잇는 몫)
const PREP_MATS = 10; // 화면 밖 판에 한 프레임에 처음 그리는 재질 수 (그래픽 칩의 첫 그리기 일을 여러 프레임에 나눈다 — 무대 하나가 10 ~ 20 프레임)
const WARM_LAYER = 31; // 화면 밖 그리기 동안만 잠깐 켜는 층 (게임은 층을 쓰지 않는다 — 다 0)
/** 장면의 보이는 물체를 차례대로 묶는다: 한 묶음에 처음 보는 재질이 PREP_MATS 개까지 (이미 본 재질만 쓰는 물체는 그 묶음에 같이) */
function warmChunks(scene) {
  const seen = new Set();
  const chunks = [];
  let cur = [];
  let fresh = 0;
  const walk = (o) => {
    if (!o.visible) return;
    if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.material) {
      let n = 0;
      for (const m of materialsOf(o)) if (!seen.has(m)) seen.add(m), n++;
      if (n && cur.length && fresh + n > PREP_MATS) {
        chunks.push(cur);
        cur = [];
        fresh = 0;
      }
      cur.push(o);
      fresh += n;
    }
    for (const c of o.children) walk(c);
  };
  walk(scene);
  if (cur.length) chunks.push(cur);
  return chunks;
}
/**
 * 캔버스와 같은 꼴의 작은 화면 밖 판 (색 RGBA8 · 깊이 + 스텐실 · 캔버스와 같은 표본 수). 꼴이 같아야 그래픽 칩이 여기서 맞춘 그리기 상태를 캔버스가 그대로 쓴다.
 *  three 는 판에 그릴 때 셰이더의 sRGB 바꿈을 뺀다(다른 셰이더가 된다) — XR 판 표시로 캔버스와 같은 색 공간 · 같은 셰이더로 그리게 한다 (그림은 버린다).
 *  헤드리스 크롬(ANGLE · SwiftShader, 재질 40 개 시험 쪽)에서 캔버스 첫 그림 3.5 ~ 4.0 s → 이 판에 먼저 그리면 0.05 ~ 0.19 s.
 *  스텐실 없는 판 · 표본 없는 판은 꼴이 달라 다시 1.3 ~ 2.7 s 였다. 폰에서 캔버스 꼴이 다르면 그 몫이 캔버스 첫 그림에 남는다(예전과 같음)
 */
function warmTarget(renderer) {
  renderer.setRenderTarget(null);
  const gl = renderer.getContext();
  const rt = new THREE.WebGLRenderTarget(16, 16, { samples: gl.getParameter(gl.SAMPLES) || 0, stencilBuffer: true });
  rt.isXRRenderTarget = true;
  rt.texture.colorSpace = renderer.outputColorSpace;
  rt.texture.internalFormat = 'RGBA8'; // 풀어 옮길 판도 RGBA8 (sRGB 판이면 옮길 때 바꿈이 낀다 — 그림은 버리니 같은 꼴로)
  return rt;
}
/** objs 만 화면 밖 판 rt 에 한 번 그린다 (빛은 다 — 셰이더가 같게 · 화면 밖 것까지 · 그림자 판 포함). 층 · 걸러내기 · 그릴 판은 되돌린다 */
function drawOffscreen(renderer, scene, camera, objs, rt) {
  const on = [];
  const lift = (o) => {
    if (!o.layers.isEnabled(WARM_LAYER)) o.layers.enable(WARM_LAYER), on.push(o);
  };
  scene.traverse((o) => o.isLight && lift(o));
  for (const o of objs) lift(o);
  const culled = objs.filter((o) => o.frustumCulled);
  for (const o of culled) o.frustumCulled = false;
  const mask = camera.layers.mask;
  const target = renderer.getRenderTarget();
  camera.layers.set(WARM_LAYER);
  renderer.setRenderTarget(rt);
  try {
    renderer.render(scene, camera);
  } finally {
    renderer.setRenderTarget(target);
    camera.layers.mask = mask;
    for (const o of culled) o.frustumCulled = true;
    for (const o of on) o.layers.disable(WARM_LAYER);
  }
}
/** 해 그림자 설정의 지금 값 (처음 값을 적어 둘 때) */
function shadowOf(sun) {
  const c = sun.shadow.camera;
  return { left: c.left, right: c.right, top: c.top, bottom: c.bottom, near: c.near, far: c.far, mapSize: sun.shadow.mapSize.x, bias: sun.shadow.bias, normalBias: sun.shadow.normalBias };
}
