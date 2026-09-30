# 검술 보정 v2 기준 sha (시뮬 stdout sha256)

잰 코드: feat-corr `corr limits` 커밋 (item L, `BODY.humanLimits` 기본 true 로 뒤집은 커밋). 저장소 뿌리에서, stdout 만 (stderr 의 'using deprecated parameters' 줄은 뺌: `2>/dev/null`).
fights12 는 바이트 관문 전용 (`tools/sim/README.md` '소음 폭'). sha256 앞 8자리, 전체는 아래.

**새 본판 기준의 까닭: 사장님 9/30 23:40 관절 한도·자기 몸 충돌 켬** (`docs/decisions.md` 9/30 23:40, 확인표 54행). 한도는 사람 움직임 봉투의 물리 범위다
(`src/fighter.js` `HUMAN`: 척추 비틀림 −29~46°, 칼 어깨 들림 면 −45~130°, 칼 팔꿈치 0~150°, 아래팔-칼 각 ≤ 163°, 아래팔 돌림 ±80°, 제 칼·칼팔 ↔ 제 몸통·허벅지 충돌. 값마다 확인표 70~77행 '사장님 확인 전 (해부학 범위)').
이 기준은 한도 쪽 버그를 고칠 때만 까닭을 옆에 적고 다시 잰다. 보정(corr) 쪽 변경으로는 다시 재지 않는다 — 바뀌면 새는 곳을 찾아 고친다.

## 1. 기본값 (한도 켬, 보정 old, AI old)
| 명령 | sha | 두 번 |
|---|---|---|
| `node tools/sim/fights12.mjs` | `5613b5b9` (5613b5b90da11b03c70fc48ed2d1cdaba7952b9e1cc6a61234fe2c357e4c2d0f) | 같음 |
| `node tools/sim/live_battery.mjs` | `37f25f76` (37f25f7676c75e9a2af96288161b4e147a9575a70931b3fd646c878e9d89be0e) | 같음 |

## 2. 한도 끔 = 오늘 (b03af1a 와 바이트 같음)
| 명령 | sha |
|---|---|
| `node tools/sim/with_config.mjs BODY.humanLimits=false fights12.mjs` | `12223139` |
| `node tools/sim/with_config.mjs BODY.humanLimits=false live_battery.mjs` | `2f453e0b` |
| `node tools/sim/with_config.mjs BODY.humanLimits=false SKILL.corr=old SKILL.corrAI=old live_battery.mjs` | `2f453e0b` |

## 3. SKILL.corr=v2 fights12 (AI 판이라 AI 는 corrAI 'old' — 보정 스위치가 판을 바꾸지 않는다)
| 명령 | sha |
|---|---|
| `node tools/sim/with_config.mjs SKILL.corr=v2 fights12.mjs` (한도 켬) | `5613b5b9` (= 1) |
| `node tools/sim/with_config.mjs BODY.humanLimits=false SKILL.corr=v2 fights12.mjs` (한도 끔) | `12223139` (= 2) |

## 4. 한도 켬이 판을 어떻게 바꿨나 (참고, 판정 아님)
- fights12: 사망 9/12 → 7/12, 넘어짐 1.2/판 그대로, 연 상처 7.0 → 6.1/판 (12판은 소음 폭 안 — README).
- live_battery cuts: 세 베기 평균 칼끝 19.4 → 18.3 m/s (자세 지도 옛 보정 0.7, 교본 자세 일부를 한도가 막음: 확인표 71행).
- 기록: `…/scratchpad/corr/impl/impl/gates/itemL/` (명령·시간 shas.txt, 출력 *.txt).
