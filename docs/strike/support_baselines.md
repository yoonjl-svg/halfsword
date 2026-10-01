# 받침 적정값 기준 sha (시뮬 stdout sha256)

잰 코드: feat-support `support optimum` 커밋 (f7f490e + 기본값 주석·문서). 저장소 뿌리에서, stdout 만 (stderr 의 'using deprecated parameters' 줄은 뺌: `2>/dev/null`), `nice -n 10`.
fights12 는 바이트 관문 전용 (`tools/sim/README.md` '소음 폭'). sha256 앞 8자리, 전체는 아래.

**까닭: 10/1 사장님: 받침 적정값 시뮬로 결정** (`docs/decisions.md` 10/1 18:40, 확인표 87·88행). 사장님 결론 ① 반사 on·fall ② 받침 0.1~0.3 안 20 칸에서 PM 유사도 척도 (eb1b72b) 최고 = `a0.3_con_lasis` = **오늘 기본값 그대로** (`GAIT.assist` 0.3 · `GAIT.catchMode` 'on' · `BODY.legTorque` 'asis'). 그래서 기준 sha 도 그대로다 (`docs/strike/support_optimum_2026-10-01.md`).

## 1. 기본값
| 명령 | sha | 두 번 |
|---|---|---|
| `node tools/sim/fights12.mjs` | **`12223139`** (12223139405767739ad9a3f987acda5684333fd1c293223af0e94642cf181851) | 같음 |
| `node tools/sim/live_battery.mjs` | **`2f453e0b`** (2f453e0b6f759b7145526a79ce580d591802bbf8e8cb7040e0a402e42099ea5f) | 같음 |

## 2. 옛 기본 (= 고른 값 셋을 적어 줌) — 손대지 않은 길 모두
| 명령 | sha |
|---|---|
| `node tools/sim/with_config.mjs GAIT.assist=0.3 GAIT.catchMode=on BODY.legTorque=asis fights12.mjs` | `12223139` |
| `node tools/sim/with_config.mjs GAIT.assist=0.3 GAIT.catchMode=on BODY.legTorque=asis live_battery.mjs` | `2f453e0b` |

## 3. 잰 트리와 같음
- 격자를 잰 트리 `…/scratchpad/support/tree_opt` (= `git archive f7f490e`) 에서 `node tools/sim/with_config.mjs GAIT.assist=0.3 GAIT.catchMode=on BODY.legTorque=asis fights12.mjs` = `12223139` = 이 커밋의 기본 fights12. 커밋이 잰 설정이다.
- 바뀐 src 는 `src/config.js` 세 줄 주석뿐 (`node --check` 통과).

## 4. 주의 — corr_baselines.md 2절
- `docs/strike/corr_baselines.md` 2절 (`BODY.humanLimits=false` = `12223139` / `2f453e0b`) 은 옛 받침 기본값 (assist 0.3 · catch on · legs asis) 으로 잰 것. 이번엔 받침 기본값이 그대로라 숫자는 맞으나, 병합 때 다시 적는 것은 디렉터 몫 (이 가지에서 corr_baselines.md 는 안 고침).

- 기록: `…/scratchpad/support/opt/adopt/shas.txt` (명령 순서·시간·전체 sha), 출력 `*.out`.
