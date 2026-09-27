# 무기 밸런스·비주얼 PM 상태 (3라운드)

감독 확인용 상태 파일. 커밋마다 갱신한다. (브랜치: `claude/pm-weapons-balance`)

## 지금까지 된 것

- **감독 확정 스펙 병합 완료** (`origin/claude/pm-weapons` 310db86 + `origin/claude/first-game-development-2q36ha` 5c82cae)
  - 등급 5단계(tier/power/durability), 확률 파손(질량 가중·지수 4), 청강검(qinggang, 에픽, mCut 1.35),
    라이트세이버 확정 이름, 한손 무기 양손 가정(토크 22 통일), 무기 배터리 AI 간격 보정, 무기 사건 공포 트리거 — 전부 그대로 받음
  - 중복 정리: excalibur_replica 하나, 별칭 지도 하나(branch/stick·chicken·tuna·jian→qinggang 포함), 등급 표 하나
  - 엑스칼리버 오라는 aura.js(attachAura) 하나만 — weapons.js 안의 중복 오라 구현은 제거. 진품·복제품 겉모습 동일 유지
- **병합에서 잡은 회귀 2건**
  - ai.js MEASURED에 qinggang 항목이 없어(옛 jian id) 길이 비율 어림으로 떨어지던 것 → 실측치 추가
  - 캐릭터 유파 꾸러미(청강검·나뭇가지·복제품)는 measure가 이미 그 무기 실측인데 ai.js가 롱소드 기준으로
    또 줄여 **이중 축소** → 기준을 school.weapon으로 바꿔 수정 (기본 롱소드 AI는 비트 동일)
- **회귀 검사 (병합 직후)**
  - `live_battery.mjs`: 감독 브랜치(5c82cae)와 **비트 동일**
  - `fights12.mjs`: 9/12 죽음 (기준 6–10 안, 출력 병합 전과 동일)
  - `hybrid.mjs fights12.mjs`: 10/12, NaN·크래시 없음

## 다음 할 일

1. 무기 밸런스 배터리(`weapon_balance.mjs 12`, 17종) 실측 → 승률 15–85% (쓰레기·장난 무기 15–35%) 확인, 필요하면 근본 원인 레버로만 보정
2. 파손 횟수 표 작성
3. 등급이 한눈에 읽히는 비주얼(쓰레기=낡음·이빠짐, 커먼=수수, 레어=마감, 에픽=세공·광), 청강검 재디자인
4. 스크린샷(docs/weapon_shots/) + 브라우저 스모크 테스트

## 승률 표 (아직 없음 — 배터리 돌리는 중)

## 파손 표 (아직 없음)

## 스크린샷 (아직 없음)

## 감독/오너 결정 필요

- 지금은 없음.
