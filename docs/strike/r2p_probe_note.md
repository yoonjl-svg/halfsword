# R2′ 첫 탐색판 메모 — 사슬 최소판(W1b) · 2026-10-02

- 명세 `docs/strike/r2p_spec_2026-10-02.md` §2·§3·§5·§6 W1b. 가지 r2p-impl(9727401 + feat-a001 2d8e23a). 값은 모두 **사장님 확인 전**(확인표 122~129).
- 주소: https://yoonjl-svg.github.io/halfsword/r2p/?chain=legs · ?chain=anchor (디렉터가 main 에 올리면 산다). 빌드는 `R2P_PROBE=1 vite build --base /halfsword/r2p/` → `public/r2p/`.
- 본판 기본값 변경 0: `BODY.chain 'anchor'` 는 오늘 바이트 그대로(아래 G1). 주소 인자 `?chain=` 은 탐색판 빌드(`R2P_PROBE=1`)에서만 읽힌다 — `vite.config.js` 의 r2pProbe 플러그인이 `src/r2p_probe.js` 를 index.html 에 끼워 넣고, 본판 빌드에는 흔적이 없다(본판에 남는 스위치는 config 상수뿐).

## 스위치와 가지 (코드 자리)
| 확인표 | 무엇 | 값 | 자리 |
|---|---|---|---|
| 122 | `BODY.chain` | 'anchor' 기본 / 'legs' 탐색판 | config.js |
| 123 | 닻 yaw 축 모터 | legs: 강성·감쇠 **0·0**(AngY), 닻 틀 = 실제 골반 yaw(pitch·roll 기준 틀만) | fighter.driveBalance |
| 124 | 엉덩이 비틀기 구동 | 딛은 다리 q_hip\* = R_y(−w_l·Δψ)·q_hip (w_l = 걸러진 Nf 몫), y 축 암시 모터 + σ = min(1, j.max·mus/\|τ_pd\|), 속도 목표 0 | gait.poseLegs·legIK(dpsi), fighter.chainAxisY |
| 125 | 척추 비틀기 ζ | `BODY.chainSpineZeta 0.5` → d_y = ζ·2√(k·I_up) (복부 ≈66·가슴 ≈57), 속도 목표 0, σ 길 공유 | fighter.chainAxisY |
| 126 | `skill.lunge` | legs 끔 | skill.js:626 |
| 127 | 핀 마찰 한계 N ×6/7 | legs 만 `l.Nf` 에 ×6/7 (l.N 그대로) | gait.pinFeet |
| 128·129 | 나눔·강성 | 그대로 | — |

## 검사 (10/2)
- G1 `chain=anchor` 바이트 동일: fights12 `afd3a954` · live_battery `5e3f14c2` · `finish_thrust 1 --stand` `f4395565` (변경 전·후 cmp 같음) · corr_s0 `--limits=on,off` 12/12 IDENTICAL.
- `legs` fights12: NaN·폭주 없이 끝남(dead 6/12, downs 0.8 — 소음 폭 안, R7 대로 sha 는 다름).
- `legs` 10 s 결투(시드 1~3, 플레이어 0.7 vs AI): 골반 ω 최고 110~135 °/s(p95 61~68) · 가슴 ω 최고 336~359 · 척추 비틀기 최고 28~29° · 넘어짐 0 · 엉덩이 σ<1 스텝 몫 0.4~0.8 % · Δψ p95 27~35° · 핀 미끄러짐 24~65/싸움꾼. anchor 같은 시드: 골반 218~1153(p95 54~130) · 가슴 518~696 · 넘어짐 1.
- 혼자 서서 heading +40°: legs 골반이 0.6 s 안에 따라감(최고 ≈88 °/s), 남는 Δψ ≈ 7~8°(pelvisYawOffset 몫).
- 명세 §2.2 '크기 감'(골반 최고 290~400 °/s)보다 **낮다**. 엉덩이 σ 는 거의 포화하지 않으므로 상한이 아니라 **땅 쪽 싱크**(발 비틀기 마찰·핀 yaw 한계, R1′)가 의심된다 — G2b 싱크 몫은 W1a 장부로 잰다. 새 수는 넣지 않았다.
- 브라우저 smoke(vite 5182, `R2P_PROBE=1`): 기본 0 오류, `?chain=legs` 0 오류, HUD 뜸·anchor 와 본판(인자 없음)엔 HUD 없음.
- 재검증(10/2, 다시 시도 — W1a WIP 297a58c 위, src 변경 0): anchor fights12 `afd3a954` · live_battery `5e3f14c2` · finish_thrust 1 --stand `f4395565`(base_sha 와 같음) · corr_s0 `--limits=on,off` 12/12 IDENTICAL; legs fights12 `f7fe531a`(NaN 0, dead 6/12, downs 0.8); 10 s 결투 시드 1~3 legs: 골반 ω 최고 110~135 °/s · 가슴 336~359 · 비틀기 최고 28~29° · 넘어짐 0 · σ<1 몫 0.4~0.8 % (anchor: 골반 218~1153 · 넘어짐 1). `R2P_PROBE=1 vite build` 결과가 public/r2p 와 바이트 같음(main-2WEkx-5L.js); 본판 빌드에는 r2pHud 흔적 0. smoke 5182: 기본·`?chain=legs` 둘 다 0 오류, HUD 는 `?chain=` 있을 때만.

## HUD 한 줄 (탐색판 전용, `?chain=` 있을 때만)
골반 ω(지금/1 s 최고) · 가슴 ω · 엉덩이 σ 포화율(0.5 s, σ·τ̂) · 잔차 r(dL_y/dt − 선언 힘의 yaw 토크, rms, 엔진 접촉 마찰·닻 토크가 남는 줄임 식) · 닻 τ_y 재계산 · Δψ · 척추 비틀기 · 핀 미끄러짐 수.

## 명세와 다르게 한 것
- 닻 yaw 축은 **AngY**(MOTOR_AXES[1]): 닻 관절은 축 (1,0,0) 으로 만들어 틀이 몸 틀과 같아 y 가 연직이다. uprightRelax 의 옛 주석("5 = 몸통 비틀기", RECOIL.anchorRelax 실험·기본 끔)과 다르다 — 그쪽은 건드리지 않았다.
- 척추 d 는 ζ 와 명세 부록 A 의 I_up 어림(복부 2.45·가슴 2.0)에서 셈한다(상수 CHAIN_SPINE_I, 새 조정값 아님).
- HUD 잔차는 W1a 장부 식의 줄임(접촉 임펄스 ×6/7×r 미포함).
