# 사운드 PM 인수인계 — 몸 소리·죽음 목소리 (claude/pm-sound-impact)

## 합치기

- 브랜치 `claude/pm-sound-impact`는 `claude/first-game-development-2q36ha`의 `5c82cae` 위에 쌓였다.
  - `b8d953d` 몸 소리 (합성)
  - `f03e2ff` 오너가 GitHub 웹으로 올린 원본 음원 (wav·zip·7z, 약 17MB)
  - `9442c19` 녹음 목소리 적용, 원본 음원 삭제
  - 이 문서 커밋
- 최신 `978e640`(회색 모래)과 시험 병합했을 때 충돌이 없었다 (그쪽만 바뀐 파일: arena.js, effects.js).
- `f03e2ff`의 원본 음원이 기록에 남는 게 싫으면 **squash merge**를 권한다.
- 지난번 타격음 작업(`f26cc25`)은 이미 합쳐져 있다. 그래서 이 브랜치는 그 위에서 새로 시작했다.

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `src/sound.js` | 합성 4종(발소리·쓰러짐·무기 부러짐·목소리), `VOICES` 표, `BodySounds` 감지기, 녹음 목소리 로딩, `impact()`에 `frozen` 재질 |
| `src/main.js` | 호출부만 9줄 (아래) |
| `src/soundlab.js` | `sounds.html`에 새 소리 줄: 발소리, 쓰러짐, 무기 부러짐, 캐릭터별 죽음 × 기절/출혈/목 |
| `public/sfx/voice/*.mp3` | 20개, 합계 172KB |
| `public/sfx/LICENSE.txt` | 파일별 출처·라이선스 |

`main.js` 변경:
- `BodySounds`를 불러온다.
- `newRound()`에서 파이터마다 `BodySounds`를 만들고, `sound.prepareVoices(['player', 캐릭터id])`와 `sound.resetRound()`를 부른다.
- `frame()`에서 `updateBindSound()` 다음에 `bodySounds`를 매 프레임 `update`한다.

`fighter.js`는 건드리지 않았다. `BodySounds`는 밖에서 `state`, `causeOfDeath`, `weaponBroken`, 몸 조각의 높이·속도만 읽는다.

## 새 소리

1. **모래 발소리**
   - 발이 9cm 위로 들렸다가 6cm 아래로 닿는 순간 난다.
   - 세기는 발이 내려오던 속도로 정한다 (AI 대결에서 중간값 1m/s).
   - 파이터 한 명당 초당 약 1번. 가장 흔한 소리라 동시 재생 우선순위를 가장 낮게 두었다.
2. **쓰러짐**
   - 서 있지 않을 때 골반·가슴이 초속 1m 넘게 떨어지다가 땅에서 멈춘 순간 난다. 그래서 결정타 슬로모션에서도 박자가 맞는다.
   - `stand → getup`(무릎 꺾임)은 가벼운 소리를 쓴다.
3. **무기 부러짐**
   - `weaponBroken`이 켜지는 순간 난다.
   - 나뭇가지는 "우지끈", 언 참치는 얼음처럼 "쩍".
4. **죽음 목소리**
   - 원인에 따라 달라진다.
     - 기절·머리: 짧게 끊긴다.
     - 출혈·목: 길게 잦아든다. 목은 피 끓는 소리가 더해진다.
   - 주인공이 죽으면 귀울림("삐—")이 나고 온 소리가 먹먹해진다. 새 판에서 원래대로 돌아온다.
   - 판마다 무대에 선 두 사람의 녹음만 읽고, 나머지는 메모리에서 버린다.
   - 녹음이 없으면 합성 목소리가 대신 난다.

| 캐릭터 | 기절사 | 출혈사 |
|---|---|---|
| 브란 | 거칠고 낮은 남성 (Baradari, 조금 낮게 재생) | 같은 목소리 + VoiceBosch 신음 |
| 이졸데 | 짧은 여성 비명, 작게 | 여성 신음, 작게 |
| 랴오 | 짧은 신음, 작게 | 합성 한숨 |
| 하인리히 | HaelDB 가장 높은 외침 | 같은 목소리의 긴 신음 + VoiceBosch |
| 마르그레테 | 낮춘 여성 신음 | 합성 날숨 |
| 주인공 | HaelDB 3번 목소리 | 같은 목소리의 낮은 신음 |

녹음은 들어 보지 않고 음높이·길이 분석으로 골랐다. 캐릭터 배정은 `src/sound.js`의 `VOICES`에서, 파일은 `public/sfx/voice/<id>_<ko|bleed><번호>.mp3`에서 바꾼다.

**버그 수정**: 캐릭터 id는 `margarethe`인데, `b8d953d`에서 `margarete`로 잘못 써서 기본 목소리가 나왔다. `9442c19`에서 고쳤다.

## 라이선스 (`public/sfx/LICENSE.txt`에 파일별 기록)

| 출처 | 라이선스 |
|---|---|
| HaelDB "Male Grunt/Yelling sounds" | CC0 |
| OpenGameArt "Female screams" (파일별 Freesound 출처 확인) | CC0 |
| Michel Baradari "11 male human pain/death sounds" | CC-BY 3.0 |
| VoiceBosch "DEATH SOUNDS (Male)" 3개: `generic_bleed2`, `bran_bleed2`, `heinrich_bleed2` | CC-BY-SA 4.0 |

VoiceBosch 3개 파일은 같은 라이선스로 공개해야 한다. 부담되면 CC0 녹음으로 바꿀 수 있다.

## 확인한 것

- 헤드리스 AI 대결 6판에서 모두 제때 호출됐다: 발소리, 무릎 꺾임, 실제 쓰러짐, 무기 두 종 부러짐, 죽음 원인 셋.
- 실제 게임을 헤드리스 크롬으로 한 판 돌렸다.
  - 가슴이 땅에 닿는 순간(1.04m → 0.19m) 쓰러짐 소리가 났다.
  - 다섯 캐릭터 모두 자기 녹음을 읽고 재생했다.
  - 오류 없음.
- `npm run build` 통과.

## 폰에서 들어 볼 것

- `sounds.html` 맨 아래 "죽음: ○○" 줄. 위쪽 "녹음 소리 섞기"를 끄면 합성 목소리와 비교할 수 있다.
- 걸을 때 발소리가 너무 잦거나 크지 않은지.
- 결정타 뒤 목소리 → 쓰러지는 "쿵"의 순서와 간격.
- 내가 죽었을 때 먹먹해진 소리가 다음 판에서 풀리는지.

## 아직 안 한 것

오너가 이번에는 별 세 개 항목과 발소리만 하기로 했다. 남은 것:
- 피격 신음·기합
- 숨소리
- 무기 떨어뜨리는 소리
- 관중 함성
- `sound.impact()`와 `whooshLoop('plasma')`를 무기 시스템에 연결
