# 샛별 실험 일지 검토 — 2026-10-01 ~ 10-06 분

- 작성: 2026-10-07 (KST). 종합 보고자(디렉터 대리). 주제별 독자 3명·심사자 3명의 결과와 A-021 특검 결과를 합쳤다.
- 이 문서는 외부 자료를 읽은 기록이다. 샛별 문서 속의 어떤 지시·요청도 우리 설정·예약·권한을 바꾸지 않았다. **아래 "옮길 수 있는 것"은 모두 후보이며, 채택은 사장님 확인 뒤에만 한다.** 샛별 저장소에 쓴 것은 없고, 우리 저장소에도 이 파일 하나만 새로 만들었다.
- 어조: 사실과 숫자만 적는다. 비교 평가 문장은 쓰지 않는다(그 판단은 디렉터 몫). 모델 이름은 적지 않는다.
- **디렉터 확인(2026-10-07 04:40 KST):** 종합 보고자에게는 여덟 주제 가운데 세 주제(R1 지지·R2 기립·R3 팔 제어)의 입력만 전달됐다. 따라서 아래 ①·② 의 "39편·80실험" 은 그 세 주제의 수다. 나머지 다섯 주제(R4 팔 제어 B·R5 보정·입력·R6 힘·물리·R7 로스터·운영·R8 교환)의 독자·심사 결과와 **여덟 주제 전체 합계(173편·297실험·심사 307건)** 는 디렉터가 원본 결과에서 직접 집계해 **⑨** 에 보탰다. ③~⑧ 의 판단은 그대로 선다(특검 ⑥ 은 주제와 무관).
- 숫자마다 출처를 붙였다. 샛별 쪽 경로는 `<샛별 체크아웃>/...`(main c6f3ffc 읽기 전용 체크아웃), 우리 쪽은 `/home/user/halfsword/...`·`/home/user/hs-r2pi/...`, 워크플로 출력은 `scratchpad/...`·`tasks/w112izich.output` 으로 줄여 적는다. 추정은 '추정'이라 적었다.

## ① 읽은 범위

| 항목 | 값 | 출처 |
|---|---|---|
| 샛별 저장소 | 샛별 저장소 main **c6f3ffc** (2026-10-06 16:29 UTC), 읽기 전용 체크아웃 `<샛별 체크아웃>` | `git rev-parse`·`git log -1` |
| 읽은 문서 수 | **39편** (R1 지지 10 · R2 기립 16 · R3 팔 제어 13) | 주제별 독자 결과 theme_stats.n_docs |
| 기간 | 2026-10-01 ~ 10-06 (R1 10/1~10/5, R2 ~10/6, R3 10/2~10/4) | 각 문서 머리 날짜 |
| 참고 | 같은 기간 `docs/strike` 변경 커밋 88개·md 138편 가운데 39편을 세 주제로 읽었다. 나머지는 이번 범위 밖(이전 열람 기록 `docs/dev_exchange/inbox/2026-10-06.md` 와 겹치는 부분 있음) | `git log --since=2026-10-01 -- docs/strike`, `ls docs/strike/*.md` |
| 수신 상태 | 세 주제의 독자 결과는 전부, 심사 결과는 R1·R2 전부·R3 는 끝 두 실험(native API 34검사·native 팔꿈치 게임 32행)의 심사 항목이 잘려 오지 않았다. 그 두 건은 독자 요약과 A-021 특검(⑥)으로 보강했다 | 이 보고의 입력 |
| 우리 쪽 대조 파일 | `docs/handoff/director_state.md` '지금 상태', `docs/strike/r2p_spec_2026-10-02.md`, `docs/devmeet/2026-10-06.md` S-008~S-016, `docs/dev_exchange/inbox/2026-10-06.md`, `tasks/w112izich.output`(w2·judge), `tools/sim/README.md` | — |

## ② 실험 수와 상태 분포 · 근거 품질 분포

실험 단위 **80개**(R1 29 · R2 27 · R3 24). 상태는 독자가 문서 본문의 반영 상태를 그대로 옮긴 것이다.

| 상태 | R1 지지 | R2 기립 | R3 팔 제어 | 합계 |
|---|---|---|---|---|
| 기본 반영(샛별 일반판 기본값이 바뀜) | 2 | 0 | 0 | **2** |
| 선택형(URL·설정 분기로 남음) | 2 | 4 | 3 | **9** |
| 연구(격리 코드·수치만) | 14 | 13 | 10 | **37** |
| 기각·철회 | 9 | 8 | 9 | **26** |
| 운영(배포·검증·기록 절차) | 2 | 2 | 2 | **6** |

- 기본값이 바뀐 2건: 걸음 균형 공유 벡터 결함 수정 7da5f3f(우리는 S-010 으로 이미 이식, `docs/devmeet/2026-10-06.md` S-010)와 paired 그립 승격 b2e49bf(사용자 피드백 "크게 체감되는 차이는 아님", `docs/strike/support_transfer_round2.md` 머리). 두 건 모두 10/1.
- 근거 품질(독자 채점, 1~4): **1점 1 · 2점 23 · 3점 46 · 4점 10**. 4점은 기준 sha·명령·원자료 해시·동일성 관문이 모두 있고 우리 환경에서 재현되었거나 독립 감사가 붙은 것(R1S-01·09·14·17·24·25·28, E15, 팔꿈치 15.21° 진단, native API 34검사). 1점은 후보가 실행되지 않은 채 결론을 적었다가 철회한 것(R1S-20).
- 공통 조건: 거의 모든 물리 실험이 시드 7 하나(일부 19)·합성 손상·대본 장면이다. 실제 전투 표본은 R1 2편(12판·2판), R2 1~2장면, R3 결투 4~6행. 폰 실기 0.
- 반복 사실(독자 candid_note 합산): 같은 누움 checkpoint(seed 7·25 s) 위에서 회복 후보가 R1 10종·R2 7종 시험되어 손상 재넘어짐 3회가 어떤 후보로도 1 아래로 내려가지 않았다(최선 1). 같은 츠바이핸더 사선 1획에서 팔꿈치·양손 목표 후보 7건이 연달아 기각됐다(종료 축 이동 원래 .620 rad 가 늘 최선). 'upright(닻)를 없애면' 가설은 세 회차(3차·5차·6차) 모두 미채택. 계측 정정은 R1 4건·R2 거의 매 회차 1건.

## ③ 주제별 요지

### R1 지지 (10편 · 29실험 · 기본 2 / 선택 2 / 연구 14 / 기각 9 / 운영 2)
- 흐름: 받침·반사 6설정×9장면 비교 → 수직 받침을 발↔골반 내부 힘쌍으로 옮긴 연구판 출시(b2e49bf) → 같은 날 '누워 있다 치솟음' 보고로 1시간 안에 철회(16:23→17:09 UTC, `support_launch_incident.md`) → 원인 분리 5회차 → 10/5 관찰 1편.
- 뒤집히지 않은 '엔진·제어 의미' 발견 넷: (a) 0계수 모터 ≠ 자유(`support_control_semantics_metrics.json zeroMotor.rows`: 미설정/제거 2.1772 rad/s 유지, 0·0 은 첫 스텝 ≈0), (b) j.max 는 위치오차 항만 제한(316.967 → 1,288.998/1,350.552 N·m, `support_motor_limits_round3_metrics.json nativeLimit`), (c) 연결된 서기 사슬에서 고관절 충격량 응답이 자유 두 강체의 7.81 %(무릎 26.73, 발목 2.82; `jointResponse.responses`), (d) Gait 가 딛은 발 질량 2 kg 을 토글한다. (a)·(b)는 우리 node_modules Rapier 0.19.3 에서 같은 수로 재현됐다(`scratchpad/<샛별 도구 폴더>/out/zero-motor.json`·`native-motor-limit.json`).
- 바닥 제거로 잰 보이지 않는 받침: 받침 0.1 설정 서기 726.51 N, getup 725.12, kneel 762.14, down 454.91 N(`support_transfer_round2_metrics.json rows[floorless_*]`). 샛별 일반 지지는 끝까지 legacy·받침 0.3 그대로.
- 발 미끄럼 정의(solver 접촉점 상대속도 mean/p95/max, A/B/C .04239/.07225/.05167 m/s 평균; `support_pair_cause_metrics.json strictStanceSlip`)와 '개입 코드 호출 횟수 관문'(두 번의 무효 실험에서 나온 교훈, `laterValidityCorrection`)이 운영 산출물.

### R2 기립 (16편 · 27실험 · 기본 0 / 선택 4 / 연구 13 / 기각 8 / 운영 2)
- 두 줄기: 기립 인계 4차~10차(관절 응답 → 목표 연속 → enabled bit → 발 목표 → COM 이전 → capture 목표 → Nf 초기화)와 피격 뒤 팔 활성 분리 3편(모두 공개 보류).
- 숫자가 분명히 움직인 것: 10차 'Gait.enter 에서 Nf 만 0'(3줄, `src/stance_memory.js`) — legacy 6조건 최대 slip 4.319→0.893·3.109→1.474 m/s(`recovery_contact_memory_round10_metrics.json batches[].summary`), K 는 30.9→33.5 J 증가, projected 재넘어짐 3→3 미해결. 샛별 기본값 `GAIT.stanceMemory 'legacy'` 그대로(선택형).
- 묵은 마찰 하중 경로: 이전 서기 Nf peak 2126 N 이 down/getup 을 지나 새 stand 첫 step 에 1896 N → 마찰 한도 1706 N 으로 쓰임(`recovery_capture_round9.md` §후속 관찰). 우리 `src/gait.js` enter/exit 에도 Nf 초기화가 없다(심사자 코드 대조, 137-178·972·995).
- 6/7 교정 독립 실측: 75 kg 상자 raw/Mg 1.1666668, correctedToMg 1.0000001, Rapier 0.19.3·dt 1/120·solverIterations 6(`contact_force_calibration_metrics.json statistics`) — 우리 확인표 127 ×6/7 과 같은 조건.
- stand 는 kneelTime+riseTime 시간으로 선언되고 getup 중 gait N 이 이전 서기 값(409.75/321.20 N)으로 잔존(`recovery_support_observations.md`); 우리 `fighter.js:1179-1188` 도 같은 시간 전환(심사자 확인).
- enabled bit 로 끄기(6차)는 샛별이 별도 재빌드한 엔진 0.19.2 의 raw API(`jointSetMotorEnabled` 등) 위에서만 돌았고 npm 0.19.3 에는 그 함수가 없다(심사자 `rapier_wasm3d.js` grep 0건; 특검 d.ts 확인 동일).

### R3 팔 제어 (13편 · 24실험 · 기본 0 / 선택 3 / 연구 10 / 기각 9 / 운영 2)
- 선택형 셋: 어깨·손목 최종 벡터 한도 armTrial=sharedCap(공개 feature-lab, 배포 main ca1a590c), 절삭 예산 budgeted 와의 결합(Q05), 재기립 Nf 비우기. 사용자의 '절삭 자세 붕괴' 보고 뒤 B 추천 버튼은 로컬에서 제거(`arm_cut_mobile_round1.md` 머리).
- 진단 둘: 보정 0 에서 손 요청 거리 .619~.657 m > IK .565 m → 팔꿈치 목표 15.21° 고정 66/66 프레임(`elbow_coordination_round1.json datasets[0]`); 팔 상처 severity 1.001 → 기능 1→.299 다음 step 에 getup 전환, 손 오차 .66 m(`arm_hit_reinput_round1.json branches`). 우리 코드 대조: 깊이식·IK 상수·`limbs −= sev×0.7`·`balance −= E×0.5` 가 같다(심사자, `fighter.js:169-173, 1258, 1314`).
- 명시 어깨 토크가 swing cap 뒤 twist 추가로 cap 의 최대 1.565×(sabre)·손목 1.971×(armWeak zwei)(`arm_capacity_round1.md` 표 1); 우리 `fighter.js:2345-2347, 2557-2566` 도 같은 구조.
- native API 34검사: 같은 handle 에서 disable 은 ±1.5 rad/s 유지, configureMotor(0,0,0,0) 은 ±1.08333 으로 감소(`native_motor_api_round1_metrics.json apiCalibration.tests[31]`; 이 fixture 는 cap 5 등 힘 한도 있음). impulse getter = 마지막 substep(비 −6).
- legacy 절삭 반작용: 칼 −J 날 중심선 점, 몸 +0.8J 뼈 점 → 운동량 잔차 ΔP 0.833 N·s·ΔL 1.394 N·m·s, 양의 pair ΔK 207/1,416 쌍(`arm_cut_interaction_round1_metrics.json conclusions`); 우리 `combat.js:361-372` 에 같은 길(0.8배·작용점 분리) — 결함인지 설계 흡수인지 단정하지 않음.

## ④ 우리 작업에 옮길 수 있는 것 (심사자 판정 '채택 가능'·'손봐서 채택' 만, 채택은 사장님 확인 뒤)

시간은 심사자 추정(h). 음수는 '측정 열이 늘어 시간이 더 든다'는 뜻. 단계 번호는 우리 다음 단계 목록(①~⑧).

| # | 항목 | 출처 | 우리 단계 | 예상 시간 | 조건 |
|---|---|---|---|---|---|
| 1 | A-021 재현 fixture: zero_motor_probe(독립 스크립트, 우리 0.19.3 에서 동일 수치) + 3차·5차 '0계수 유지 vs 관절 제거' 절차 + native API 두 강체 fixture | `tools/sim/experiments/zero_motor_probe.mjs`; `recovery_handoff_round5.md` §첫0.35초; `native_motor_api_probe.mjs` | ① | **−1.0 (절감, 이미 소진)** | 특검이 이 설계로 16칸을 돌려 ① 을 끝냈다(⑥). 남는 일 없음 |
| 2 | upright_motor_candidate.mjs(58줄, 의존 0): 끄는 축이 있으면 자유 generic 관절 재생성, 양수 축만 설정 | `tools/sim/experiments/upright_motor_candidate.mjs`; `support_control_semantics_metrics.json nativeHelper.results` | W1b 수정(①과 ② 사이) | **1.5 절감** | 특검 C1·G3 가 재생성 경로의 자유 복귀를 확인(α 78.757). 핸들 교체 시 chain_ledger 닻 토크 재계산·chainDbg 손질 필요. 더 짧은 길(legs 가지에서 raw 5 호출 안 함, 특검 G)이 있으면 helper 는 anchor→legs 런타임 전환에만 |
| 3 | joint_response_probe 의 측정 설계(관절 재생성 → 누산기 비움 → snapshot → 분기 한 스텝 ±충격 응답비) | `tools/sim/experiments/joint_response_probe.mjs`; `support_motor_limits_round3_metrics.json jointResponse` | ② | **2.0 절감(조건부)** | R1′ 가 축 교정 W2 재측정 뒤에도 필요할 때만. 데이터(Z축·받침 .3)는 옮기지 않음. 우리 y 축 1개만 뗄지 결정 필요 |
| 4 | native_motor_limit_probe(독립 실행): 한 스텝 native 토크 = I·Δω/dt 로 엉덩이 암시 모터의 실제 토크가 j.max×mus 안인지 검증 | `tools/sim/experiments/native_motor_limit_probe.mjs`; `scratchpad/<샛별 도구 폴더>/out/native-motor-limit.json` | ② | **0.5 절감(조건부)** | 상수(k 1800·d 160·cap 560)만 바꿔 돌림. 고정점 관절이라 사슬 분배는 못 봄 |
| 5 | 팔 피격 → balance 0 → knockDown(false) → getup 전환 경로(우리 코드 동일) | `arm_hit_reinput_round1.md` '다음 수정 구간'; 우리 `fighter.js:1175, 1217, 1258, 1314` | ⑥ | **1.0 절감** | '팔 없는 몸이 어느 상태로 들어가나'를 설계 첫 줄에 둠. 손 오차 .66 m 수치는 샛별 조건 |
| 6 | 절단 뒤 지지 기록·pin·upright 즉시 초기화 교차검사 항목(600프레임: supportForceCalls 0, upright 1,800회 모두 0) | `support_transfer_round2_metrics.json severCrossCheck` | ⑥ | **0.5 절감** | 샛별은 axial 모델에서 검사 — 우리는 '절단 다리의 핀·Nf·받침 몫·닻 pitch/roll' 로 물음을 바꿔 적음 |
| 7 | 공개 배포 기계 검증 JSON 뼈대(HTTP200·SHA256 표, 모바일 CDP 입력 결과, scope 문장) + 배포 영수증 스키마(commit·Actions run·publicBytes.exactBuild) | `support_transfer_public_metrics.json`; `arm_capacity_trial_release.json` | ⑧ | **1.0 절감** | 우리 발행 CI(S-015)는 git push+manifest 라 열 이름 1:1 아님 — 뼈대만 |
| 8 | 6/7 교정 독립 실측(0.19.3·dt 1/120·iter 6·raw/Mg 1.1666668) 을 확인표 127 의 근거로 인용 | `contact_force_calibration_metrics.json statistics` | ③ | **0.5 절감(조건부)** | 우리 계획에 상자 시험이 있었을 때만. 관절 인체 과도 응답은 보증 안 함 |
| 9 | legacy 절삭 반작용 0.8배·작용점 분리 사실(우리 `combat.js:361-372` 동일) | `arm_cut_interaction_round1_metrics.json conclusions[1]` | ④ | **0.5 절감** | 효과표 설계 전 메모. 고칠지는 사장님 몫 |
| 10 | 보정 0 조건(손 깊이식 .62 m > IK .565 m)에서 팔꿈치 고정 여부를 우리 armFull·elbowS 로 1회 측정하는 설계 | `elbow_coordination_round1.json datasets`; 우리 `fighter.js:169-173, 2594` | ⑦ | **0.5 절감** | `corr_s0.mjs --limits` 는 보정 0 시험이 아님(humanLimits 인자) — corr_lib 패드 획 + armFull 로 짬. inbox 답 2 '우리 v2 는 범위 안으로 당긴다'는 s>0 에서만 참 → 답 정정 필요 |
| 11 | 발 미끄럼을 solver 접촉점 상대속도 mean/p95/max 로 재는 열 추가 + support_contacts.js(순수 함수, 의존 0) 복사 | `support_slip_observation.patch`; `src/support_contacts.js` | ③ | **−2.5 (추가)** | 선택. G11 사건 수(p24 Σ6→Σ29) 를 크기 분포로 적을 수 있음. stance 필터·slop 정의를 README 관문 줄에 먼저 적을 것 |
| 12 | 실제 누움 회복 장면(knockDown(true)·무입력 25 s, 지표: 재넘어짐·최장 접점 부재 s·골반 최고·상향속도·관절 간격) 을 폭주 검사에 추가 | `heavy_down_README.md`; `same_lying_recovery_summary.json` | ③ | **−1.0 (추가)** | 선택. 샛별 철회 원인이 이 장면 누락. 우리 폭주 검사는 NaN 0·넘어짐만 |
| 13 | 결투 폭주 문턱 열(기준 대비 속도×3+10 m/s·골반 +.75 m·관절 gap +.1 m) | `arm_capacity_duel_probe.mjs:252-254`; `arm_capacity_trial_metrics.json duels.tripwires` | ③ | **−1.0 (추가)** | 선택. 샛별도 '진단용, 성공 기준 아님' |
| 14 | 새 서기 Gait.enter 직전 Nf=0(3줄) 을 legs 가지 안 또는 스위치로 두고 W2 에 'legs+fresh' 1칸 | `src/stance_memory.js`; 우리 `gait.js:137-178, 831-834, 995-996` | ③ | **−0.5 (추가)** | 본판 기본에 넣으면 fights12 afd3a954·live_battery 5e3f14c2 가 바뀜 → 사장님 결정. legs 가지 w_l = Nf_l/ΣNf 에 묵은 Nf 가 들어가는 경로 확인됨 |
| 15 | chain_ledger 가 질량을 attach 때 한 번만 읽음(`chain_ledger.mjs:116-118`) ↔ gait 가 딛은 발 +2 kg 토글(`gait.js:734-739`) → 걸음 있는 장면의 L_z 에 틀어진 질량 | 샛별 `massFactorial` 발견 → 우리 코드 대조(새 발견) | ③ | 0 (도구 수정 10분) | ③ 재측정 전 필수. 샛별 수치(재넘어짐 3→1)는 옮기지 않음 |
| 16 | 측정 규칙·기록 규약(코드 0): getup 조각은 '첫 stand 시각' 대신 발 하중·골반 높이로 읽기; levH>0 동안 N 무시 공중 판정 수 열; 첫 entry 뒤 0.2 s 따로 세기; 개입 함수 호출 횟수 열(0이면 무효); 무효 실행 보존; measured/exposed/passed 세 열 분리; 같은 입력 A/B 흐름; 명시 토크 부호·일만으로 원인 확정 금지 | R1S-04·19·20·21, E03·E24·E27, A-conflict §3 | ③·⑧ | 0 | 문장 몇 줄, 시간 변화 없음 |
| 17 | R1′ 설계 메모(사실 나란히): 수직 요구 JᵀF 복사 → 1,525 N·m 포화 실패; 두 강체 근사 명시 PD 는 연결 다리에서 발산(건강 재넘어짐 0→2~8), 포화 3/15,984 = 상한 원인 아님; 팔꿈치 명시 PD 교체 15.6→13.3 m/s(cap 미포화); upright 3축 통째 끄면 건강 재넘어짐 0→1·K 84→286 J | R1S-10·27, A-arm-cap-1-elbow, E07 | ② | 0 | 우리 '암시 모터+σ' 선택과 같은 방향의 독립 사례. 수치는 다른 축 |
| 18 | applyWound bounded payload(접촉 없이 부위 상처), 팔 문턱 22 J + severity×90 J, IK 전완 5 mm 차(slack 이 상쇄, 총 도달 .565 같음) | `native_elbow_followthrough_probe.mjs:78-83`; `elbow_continuity_round2.md` | ④·⑥ | 0 | 우리 decap_check.mjs 가 이미 같은 방법. 사실 기록만 |

합계(심사자 추정): 절감 9.0 h(① 1.0 은 특검으로 이미 소진, ② 4.0 은 R1′ 착수 시에만, ③ 0.5 조건부) · 추가 5.0 h(③ 선택 열 4개 모두 넣을 때). 전부 채택하면 순 +4.0 h. 선택 열을 넣지 않으면 순 +9.0 h 이지만 그중 확정분은 ①1.0+④0.5+⑥1.5+⑦0.5+⑧1.0 = **4.5 h** 다.

## ⑤ 옮기지 않는 것과 이유 (한 줄씩)

- 받침·반사 6설정×9장면 표, 2×2 효과표: 샛별 사본 받침 .1/.3·catchMode 설정, 우리 받침 0.2 고정(r2p_spec §0.3)이라 어느 칸도 우리 설정과 같지 않음.
- 바닥 제거 상향력 726 N 등: 우리 장부는 받침을 선언 외부 힘으로 매 스텝 직접 적어(`chain_ledger.mjs` supportV) 간접 측정이 필요 없음.
- 중력 보상 켬/끔 16장면: 츠바이핸더 2.9 kg·시드 1·세 관절 동시 변경 — 모르겐슈테른 1.88 kg·우리 G6 와 조건 다름.
- 12판 실제 전투 상처 로그(92건, 팔 44 %): 샛별 AI·보정·limb_sever 위의 분포 — 우리 fights12·weapon_anatomy 로 직접 잼.
- 회복 개입 후보(projected·zeroUpright·catchLoad·catchHold·contactPivot·targetBlend·observedPlant·unsupportedReach·supportShift·captureCarry 등 17종): 철회된 axial 지지·합성 손상·시드 7 조건, 샛별 쪽에서도 채택 0. 우리 catch·기립 경로는 바이트 그대로 두기로 함(r2p_spec §7 R9).
- 팔꿈치·양손 목표 후보 7건(radial·relative·bimanual·coherent·폼멜·항 분리·swivel·task-velocity): 샛별 팔 제어 구조 전용, 우리 v2(home 도달 보정) 와 다름. radial 의 '가장자리 입력 flex>2.5 rad' 실패 조건만 '하지 말 것' 메모.
- enabled bit 로 모터 끄기·native maxForce 한도(nativeCap) 계열: 샛별이 별도 재빌드한 엔진 0.19.2 의 raw API — npm 0.19.3 에 없음(특검 d.ts·심사자 grep). 엔진 재빌드는 사장님 결정 사항.
- late_upright·delayed_ablation·same_lying·recovery_control·combat_recovery·knee_lateral·gravity·support_probe·heavy_down_launch·arm_capacity/conflict/hit_reinput/path/native_elbow 탐침: 샛별 harness_m·force_ledger·support_contacts·axial 원판·git archive 의존. 측정식만 옮기고 코드는 안 옮김.
- 모바일 feature-lab 검사 스크립트(arm_trial·arm_cut_interaction): 우리는 URL 스위치를 10/1 에 없앴고(README 10/1 22:05) CDP 터치 흐름은 live_diag 에 이미 있음.
- 결투 baseline 골반 1.064 m·gap 7.36 mm, getup 295/549 N, 첫 기립 뒷발 216→52 N, COM 지지영역 밖 .381/.644 m, 전완·정강이 지지 시간표 수치: 조건이 달라 비교란에도 두지 않음(설계 자릿수 참고만).
- 중력 −11.772 m/s² 한 행, 폰 세로 1.35×: 우리 안건 없음·샛별 사장님 요청 사항.
- R3 효과표·⑤ 모르겐슈테른·⑦ 폰 입력에 직접 쓸 수치·도구: 세 주제 어디에도 없음(⑦ 은 진단 조건 1개, ④ 는 메모 1개뿐).

## ⑥ A-021 특검 결과 (숫자)

판정 **참** — "0·0 모터 설정은 자유가 아니라 관절 제약(경성 속도 잠금)이다"는 우리 Rapier 0.19.3 npm·우리 닻 관절 타입·축 설정에서 재현됐다. 덤으로 **축 번호 오해**가 드러났다.

- 시험: `scratchpad/a021/anchor_motor_test.mjs`(16칸, 결과 `anchor_motor_test.json`)·`axis_map_test.mjs`. 구성은 우리 닻과 동일: 운동학 닻 + 골반 상자(half 0.1·0.085·0.16, 10.7 kg; `hs-r2pi/src/fighter.js:53`), `JointData.generic(axis (1,0,0), axesMask 0)`, 세 회전축 `jointConfigureMotorModel(…,1)`(`fighter.js:486-492`), dt 1/120, iter 6, 중력 0·접촉 없음. 자극 = 초기 yaw 2 rad/s 및/또는 yaw 토크 10 N·m, 0.5 s. 자유면 α = 10/0.12697 = 78.76 rad/s².
- 축 매핑(`axis_map_test.mjs`): generic(axis x) 관절에서 raw 축 단독 2500·330 설정 뒤 각속도 (1,1,1)→ 축 3 (−0.002,1,1) · 축 4 (1,1,−0.001) · 축 5 (1,−0.003,1). **raw 3 = 세계 x, raw 4 = 세계 z, raw 5 = 세계 y(yaw)**. spherical 은 3→x,4→y,5→z 로 정상. 원인은 Rust 쪽 frame 구성(소스 미독, 추정).
- 0·0 잠금: 같은 축을 k=0·d=0 으로 두면 그 성분이 1 스텝 만에 0.000, 12 스텝 뒤에도 0.000 — 샛별 `zeroMotor.rows`(2.1772→≈0)와 같은 현상.
- A_no_motor: α 78.757(자유), 관절 토크 0.000 N·m, 0.5 s 뒤 ω 41.38 rad/s.
- B(raw 4 를 0·0 매 스텝/한 번/토크 없이): yaw 는 A 와 완전히 같음(78.757, 0.000) — W1b 가 '닻 yaw 0·0' 으로 믿은 호출(`fighter.js:1849 MOTOR_AXES[1]=4`)이 정확히 이것.
- D_game_legs_as_implemented(raw 3·5 2500·330 + raw 4 0·0 + 닻 추종): yaw 토크 10 N·m 에 α 0.934 rad/s²(자유의 **1.19 %**), 관절 흡수 9.881 N·m(**98.8 %**), 0.5 s 뒤 ω 0.467 rad/s·10.15°. D1(초기 2 rad/s): 첫 스텝 2.0→0.0233. D2(축 4 호출 삭제): D 와 동일 → 축 4 호출은 yaw 에 무관.
- D3(같은 legs 설정, 세계 z 토크 10 N·m): α 0.000(자유 162.8), 흡수 10.000 N·m — raw 4 의 0·0 은 골반 pitch/roll 쪽 한 축을 닻에 **경성 잠금**(W2 r_H 44.0→62.1 증가와 방향 일치, 수치 연결은 추정).
- E_old_anchor(3·4·5 모두 2500·330, 닻 고정): 첫 스텝 2.0→0.0233, 0.5 s 뒤 0.0006 rad/s, 흡수 10.51 N·m. C2(raw 3·5 만): E 와 동일 → yaw 를 잡는 건 축 5.
- G_fix_skip_axis5(raw 3·4 2500·330, raw 5 미호출, 닻 추종): α 78.757(자유), 흡수 0.000. G2(raw 5 를 0·0): α 0.000, 흡수 10.000(yaw 완전 동결). G3(anchor 24 스텝 뒤 관절 제거·재생성, 3·4 만): 25 스텝째부터 자유, 60 스텝 평균 α 47.99 = (36/60)·78.76. C1(0·0 뒤 제거·재생성): 자유 78.757. C3(raw 5 k0 d1e-3): α 78.586(참고만, 명세 123 은 중간 형태 금지).
- 샛별 수치 대조: `support_control_semantics_metrics.json zeroMotor.rows` initial_zero 첫 스텝 3.2e-38, warm_zero_existing 1.4e-45(≈0) ↔ 우리 0.000; `native_motor_api_round1_metrics.json apiCalibration.tests[31].zeroCoeffEqualsDisabled = false`(단 재빌드 바인딩).
- W2 와의 연결(`tasks/w112izich.output result.w2.gates·judge`): 대본 베기 r_V rms anchor 52.4 → legs 36.4 N·m(기준 ≤5); τ̂닻_V 49.0 → 0.0 은 식(k·e+d·ω, `fighter.js:1860 D.anchorTau=0`·`chain_ledger.mjs:94 AX y=4`)으로 0 을 적은 것이지 측정 0 이 아님; 엉덩이 τ̂ 수직 rms 339 N·m 중 골반 I·α 몫 0.018(중앙) ↔ 단일 관절 D 의 1.2 %(크기 일치, 조건 다르므로 추정); 골반 ω 최고 227 → 94 °/s; 서기 yaw 흔들림 1.14 → 7.45 °/s; r_H 44.0 → 62.1.
- 결론(특검): W1b 는 닻 yaw 권한을 0 으로 만들지 못했고(raw 5 모터 2500·330×assist 가 측정 골반 yaw 를 한 스텝 늦게 뒤쫓는 '가속 저항'으로 남음), 대신 raw 4 로 pitch 축 하나를 경성 잠금했다. **W1b·W2 결과는 '닻 yaw 0' 조건의 측정이 아니다.** 명세 §2.2 K1·확인표 123 의 '0·0' 문구, `chain_ledger.mjs:94` 의 축 가정, `fighter.js:1847` 주석('AngY = 연직')은 `fighter.js:1703·1712 uprightRelax`(5 = yaw)와 모순이며 측정은 uprightRelax 쪽이 맞다.
- 0.19.3 npm 바인딩에 모터 enabled bit·maxForce API 없음(d.ts 확인). 쓸 수 있는 '실제 끄기'는 (a) 처음부터 raw 5 를 configure 하지 않음(G), (b) 관절 제거·재생성(C1·G3)뿐.

## ⑦ 우리 로드맵 영향 표

| 단계 | 전 | 후 | 이유 |
|---|---|---|---|
| ① A-021 재현 | 1 h 예정(한 관절 시험) | **끝남**(특검 16칸 + 축 매핑 시험; 참 판정) | 샛별 fixture(R1S-17·E18·native API)가 설계를 대신했고 특검이 우리 닻 조건으로 변형해 돌림. 코드·문서 변경은 디렉터 승인 뒤 |
| W1b 수정(① 과 ② 사이, 새 소단계) | '축 4 를 0·0' 유지 | legs 가지에서 **raw 5(yaw) 를 configureMotorPosition 하지 않음**(또는 anchor→legs 전환 시 관절 제거·재생성) + raw 3·4 는 오늘 그대로 + `chain_ledger.mjs:94` 축 가정을 측정 매핑(3=x, 4=z, 5=y)으로 + 명세 §2.2 K1·확인표 123 '0·0' → '모터 미설정(bit off)' | 특검 D·G·G3. 샛별 helper(R1S-18)는 재생성 길의 참고 설계(1.5 h 절감 추정) |
| ② R1′ 엉덩이 구동 경로 재설계 | W2 G2b 실패(싱크 몫 0.018)·judge 'R1′ 발동' 근거로 착수 예정 | **보류** — 축 교정 W2 재측정 결과를 본 뒤 필요 여부 판단 | W2 의 싱크·잔차는 닻이 꺼지지 않은 상태의 값(특검). 착수하게 되면 R1S-28 측정 설계(2 h)·R1S-25(0.5 h)·설계 메모(#17)가 쓰임 |
| ③ W2 재측정(12 관문) | 12 관문, 같은 HEAD·같은 장면 | 같은 12 관문을 **축 교정 뒤 1회 먼저**(G2 r_V·G2b 싱크·G4 골반 ω·r_H 비교). 필수 손질 1: ledger 질량 매 스텝 읽기(10분, #15). 선택 열 4개(#11~14, +5 h)는 디렉터 선택. 상자 시험은 생략 가능(#8) | 특검 next_action; 심사자 ③ 항목. 시간은 늘면 늘지 줄지 않음 |
| ④ R3 부위·둔기 효과표 | 그대로 | 그대로 + 설계 전 메모 1(절삭 반작용 0.8배·작용점 분리, 0.5 h) | 직접 쓸 수치 없음 |
| ⑤ 모르겐슈테른 띠 보정 | 그대로 | **그대로**(쓸 자료 없음) | 세 주제 모두 해당 자료 0 |
| ⑥ 팔·다리 절단 설계 | 그대로 | 그대로 + 설계 첫 줄 자료 2(피격→getup 상태기계 1 h, 절단 뒤 초기화 검사 목록 0.5 h) | 우리 코드 경로 동일 확인 |
| ⑦ 폰 입력·AI 보정 재측정 | 그대로 | 그대로 + 보정 0 팔꿈치 고정 진단 1회(0.5 h), inbox 답 2 정정, 손 뗌 뒤 목표 변화율 확인 열 1 | S-009 원인 후보 1개를 가름. 단계 수 변화 없음 |
| ⑧ 운영(발행 CI·실험 기록 규약) | S-015 설계 예정 | 발행 CI 결과 JSON 뼈대(1 h 절감) + 규약 몇 줄(호출 횟수·무효 보존·noexposure/efficacy 분리·A/B 흐름) | 샛별 운영 산출물 |

줄어드는 단계: ① 하나(끝남). 순서가 바뀌는 단계: ② 가 ③(축 교정 재측정) 뒤로. 그대로인 단계: ④·⑤·⑥·⑦(자료만 보탬). 늘어나는 것: W1b 수정 소단계 1개와 ③ 의 재측정 1회.

## ⑧ 샛별에게 물을 것

1. `zero_motor_probe`·`upright_motor_candidate` 의 generic 관절은 어느 axis 로 만들었고 raw 축 3·4·5 가 세계 어느 축에 닿는지 확인했는가(우리 측정: generic(axis x) 에서 4 = z, 5 = y). 세 축 모두 0·0 으로 둔 실험이라 축별 결과를 적지 않은 것인지.
2. `nativeHelper` 'translating and rotating kinematic anchor' 검사는 '제거' 쪽만 있다(results[0]). '0·0 + 매 스텝 회전하는 운동학 앵커' 조합(우리 D1: 첫 스텝 2.0→0.0233)을 잰 적이 있는지.
3. 재빌드 엔진 0.19.2 와 npm 0.19.3 의 바이트 동등은 8쌍 exact 로만 확인됐는데(문서 '표본 밖 동등성 미입증'), enabled bit 결과(1.5 vs 1.08333)를 npm 쪽 '관절 제거' 와 같은 handle·같은 fixture 로 대조한 행이 있는지.
4. `GAIT.stanceMemory 'fresh'` 를 일반 기본값으로 올릴 계획이 있는지, 올릴 때 기준 trace 해시를 어떻게 갱신하는지(우리는 fights12·live_battery sha 가 바뀌어 사장님 결정 사항).
5. 6/7 교정은 정적 상자 1조건이다 — 관절 인체(서기·걷기)에서 impulse/dt 와 실제 하중의 비를 잰 행이 있는지.
6. 팔 문턱 22 J + severity×90 J 와 `limbs −= sev×0.7` 상수가 공통 조상 14bcf1f 그대로인지(우리 쪽은 그대로임).
7. `native_motor_api_round1` fixture 의 configureMotor(0,0,0,0) 뒤 1.08333 rad/s 는 한 스텝 값인지 구간 끝 값인지, 그리고 cap 5 의 힘 한도가 없을 때도 같은 비(72 %)가 나오는지.

— 끝. 채택은 사장님 확인 뒤. 샛별 저장소 쓰기 0, 우리 저장소 쓰기는 이 파일 1개.

## ⑨ 보강(디렉터) — 종합에 빠진 다섯 주제 R4~R8 과 여덟 주제 전체 합계

종합 보고자에게는 R1~R3 입력만 닿았다(워크플로 입력 길이). 아래는 독자 8명·심사자 8명의 원본 결과(워크플로 journal)에서 디렉터가 직접 집계한 것이다. 숫자는 독자·심사자가 적은 그대로이고, 시간은 모두 심사자 추정이다.

### ⑨-1 여덟 주제 전체

| 항목 | 값 |
|---|---|
| 읽은 문서 | **173편** — R1 10 · R2 16 · R3 13 · R4 29 · R5 18 · R6 33 · R7 17 · R8 37 (우리 문서의 사본 4편 안팎 포함: corr_baselines·corr_v2_probe_note·r2_live_diagnosis·director_state 사본) |
| 실험 단위 | **297개**(독자 목록 기준; theme_stats 합 294) — R1 29 · R2 27 · R3 24 · R4 41 · R5 17 · R6 37 · R7 70 · R8 52 |
| 상태 | 기본 반영 **37** · 선택형 **49** · 연구 **117** · 기각·철회 **59** · 운영 **35** |
| 근거 품질(독자 채점 1~4) | 1점 5 · 2점 112 · 3점 139 · 4점 41 |
| 심사(이식 가능성) | **307건** — 채택 가능 58 · 손봐서 채택 78 · 안 맞음 140 · 근거 부족 31 |
| 기본 반영 37 중 물리·제어 기본값이 바뀐 것 | 약 10건: 걸음 균형 공유 벡터 수정(10/1, 우리 S-010 으로 이식 완료) · paired 그립(10/2) · 폰 세로 터치 1.35배(10/3) · 검술 보정 12종 단일 기본(10/5) · 부상 뒤 재활성 prevAim 초기화(10/6) · 모노호시자오·라이트세이버 시작 힘점 axial(10/6) · 10/7 일반 채택 3건(회복 fresh 츠바이핸더, 절삭 반작용 centerline 롱소드·츠바이핸더, 재베기 bounded 롱소드·청강검). 나머지는 소리(fleshHit drawn, 숨·베기 음량)·손 외형·우리 자세표 이식(A-020)·운영 |
| 공통 조건 | 거의 모든 물리 실험이 시드 7 하나(일부 17·19)·장면 1~2·합성 손상 또는 대본 획. 폰 실기 0. 'exact/prefix exact/PASS' 는 거의 전부 '바뀌지 않았음' 의 근거로 쓰였고 '좋아졌음' 의 근거는 사용자 소감과 10/5 보정 108실행 하나 |
| 원자료 | 저장소 밖(/workspace/halfsword-handoff, 13파일 620 MB 등) — checkout 만으로 재현 불가. 저장소 안 JSON 요약·도구까지만 우리 손에 있음 |

### ⑨-2 주제별 요지(R4~R8)

**R4 팔 제어 B (29편 · 41실험 · 기본 3 / 선택 9 / 연구 14 / 기각 12 / 운영 3 · 심사 39: 채택 7 · 손봐서 10 · 안 맞음 19 · 근거 부족 3)**
- 기본값이 바뀐 셋은 우리 한손 자세표 이식(A-020)·엄지 있는 손 표시·엄지 좌우 정정뿐이고 물리·제어 기본값은 10/2~10/5 나흘 동안 변경 0(각 JSON defaultChanged false). 공개된 것은 feature-lab 선택형 A/B 다섯 앵커.
- 반복 사실: 날 평면·정렬 토크 줄기 7회차·12후보(intent_edge → edge_transition → edge_plane_torque → edge_turn_guard → onehand_stop → onehand_thrust → thrust_plane)가 모두 '정지·탭 구간 peak 는 줄고 다음 베기·찌르기·날 오차는 늘어남' 의 같은 맞바꿈으로 끝났다. 청강검 접촉 급회전은 같은 저장 장면 tick965 하나를 네 길(모터·속도 유지·반작용 경로·collider)로 돌려 셋 기각·하나 선택형.
- 우리 코드와 글자 그대로 같은 자리(심사자 대조): guardDir y=.1 꺾임(`fighter.js:225-231`), flatTarget 부호 선택·twist(`2476·2564`), follow 감쇠(`skill.js:602`), 검 angularDamping 0.3(`fighter.js:545`), IK 상수 .300/.270 대 native .265(5 mm). 옮길 것은 ③·⑦ 의 측정 열(날 정렬 부호 반전 열, guardDir 꺾임 기여 열, acos→atan2 각도 누적 정정)이며 매핑 수정은 사장님 결정 전 하지 않는다.

**R5 보정·입력 (18편 · 17실험 · 기본 3 / 선택 5 / 연구 7 / 기각 1 · 심사 27: 채택 1 · 손봐서 11 · 안 맞음 13 · 근거 부족 2)**
- 기본값 변경 둘: 폰 세로 1.35배(사용자 선호 한 줄), 통합 검술 보정 + 수동 팔을 근접 12종에 일반 적용(10/5, 108실행; 예외 2건은 사용자 해석). 보정 제거 가설은 10/2 하루 3회차 + 실전 1차 뒤 10/5 사용자 지시로 방향이 '보정 유지·갱신' 으로 바뀌었다.
- 샛별 'v2' 는 이름만 우리 S-004 v2 와 같고 내용(단계·수동 팔 연결·빠른 베기 손 목표 보존)이 다르다 — 비교 공통 지표 없음(우리 맞힘/획·베임/획, 그쪽 칼끝 에너지·공격 후 운동).
- 심사: 코드 이식 0건. 옮길 것은 측정 규약·점검표(세로 1.35 비교 칸, 보정 0 팔꿈치 고정 진단 조건, 손 뗌 뒤 목표 변화율 열). ⑤ 모르겐슈테른에 쓸 수치 없음(관성 .43605 는 다른 모델 계산값, 복귀 배율 .8 은 우리 띠 미달 원인(접촉 수)과 방향이 반대).

**R6 힘·물리 (33편 · 37실험 · 기본 8 / 선택 5 / 연구 18 / 기각 5 · 심사 36: 채택 14 · 손봐서 15 · 안 맞음 3 · 근거 부족 4)**
- 기본값 변경: paired 그립(10/2; 칼끝 속도는 어느 조건에서도 늘지 않았고 순토크 1.5~2.2 N·m 제거만 입증), 폰 입력 생명주기 수정(10/4), prevAim 재활성 수정(10/6), 두 무기 시작 힘점(10/6), 10/7 일반 채택 3건(새 측정 0, '개입 뒤 능동 절삭 위력'·'잔여 축회전' 두 관문 미노출인 채 사용자 승인으로 승격).
- 반복 사실: P4 재베기 날 면 점프 5회차(10/4 기하 2안 기각 → 10/5 recut v2 2안 기각 → 명령 면 보류 → 10/6 1쌍 보류 → bounded 선택형 → 일반 채택)에서 '제한기 개입 뒤 생존 상대 능동 절삭 한 쌍' 은 끝까지 미노출. 전신 힘 전달(P-03)은 10/1 프로브 → 10/2 가슴 운반 90행 기각 → 10/5 지연 후보 기각·선행 B ±1 % 로, 몸통 기여가 칼끝에 실린 수치는 한 번도 나오지 않았다.
- 우리 코드와 같은 구조로 확인된 것(심사자 대조): 절삭 반작용이 칼 −J(날 중심선 pA)·몸 +0.8J(뼈 점 pv) 로 작용점이 다르고 0.8 의 근거 주석이 없음(`combat.js:361-372`); 손 목표를 heading yaw 로 세계에 놓고 armIK 가 실제 가슴 회전의 역으로 푸는 경로(`fighter.js:2401-2402·709`); 몸 강체 14·질량합 75.1 kg + 딛은 발 2 kg; 롱소드 1.6 kg·COM .2401 m; 스텝 순서 driveSword → … → trackBlade(1 스텝 지연). 독자 메모 정정 1건: 우리 offHand 도 손·폼멜 두 점 ±F 스프링(`fighter.js:2623-2662`)이라 10/6 inbox 답 3('두 손 모두 자루 관절')은 고쳐 보내야 한다.
- 심사 시간(추정, 조건부): ② R1′ 5 h(가슴 참고각 운반·소량 선행 축을 후보에서 뺄 근거 — R1′ 를 하게 될 때만), ④ R3 효과표 6.5 h('같은 세계 점 + 비역전 상한 + ΔK≤0' 관문과 반례 fixture; 단 우리 절삭 경로를 바꾸면 fights12·live_battery sha 가 깨지는 물리 변경 → 사장님 결정 뒤), ③ 4 h(G3 발 하중 정의: 바닥 제거 대조, 6/7 조건표, paired 6줄은 물리 변경이라 보류), ⑥ 2 h, ⑤ 0.5 h(관성 기준점 환산 I_COM+m·d² 가 우리 손 기준 값과 맞음), ⑧ 1 h.

**R7 로스터·운영 (17편 · 70실험 · 기본 10 / 선택 15 / 연구 30 / 기각 10 · 심사 71: 채택 2 · 손봐서 4 · 안 맞음 55 · 근거 부족 10)**
- 소리는 하루(10/2) 3회차 뒤 사용자 선택으로 닫혔다(fleshHit 'drawn', 숨 ×0.875→×0.85, 베기 ×1.15). 우리 35차 후보가 그쪽에서 하루 기본값이었다가 '둔기 소리 같다' 피드백으로 대체된 사실은 우리 본판 칼→몸 소리 선택(사장님 대기)의 참고.
- 사지 절단 시험안 `src/limb_sever.js`(110줄)·`limb_sever_fx.js`(110줄)·`limb_demo.js`(16줄)·`tools/sim/limb_sever.test.mjs`: 팔꿈치·무릎 관절 단위 분리, 조건 '통과 베기·박히지 않음·심각도 ≥1.2·관절 앵커 8.5 cm 이내'(샛별 스스로 '게임 시험용 가정'), 질량·속도 보존, 분리 관절 모터 끄기, 보행 체중 캐시 갱신, 출혈 단면 귀속, 총알·레이저 제외, 다리 상실 시 보행·받침·upright 중단. THREE·COMBAT 만 import 하고 우리에도 있는 jointByName·applyWound(h.pass/passing/severity/local)·gait.footMass 위에서 동작한다. 기본 off(`?limbTrial=1`), 10/1 뒤 승률·발생률 측정 0.
- 모르겐슈테른 시험 무기(trialOnly): 질량·COM 거의 같음(1.8/0.452 대 우리 1.88/0.449). '게임 판정 E = 물리 E × 2.0' 은 공통 조상 상수 STRIKE.energyScale 2.0 그대로이고 우리 둔타는 mBlunt 1.3·power 1.05 가 더 곱혀 2.73 이라 환산 계수로 쓰면 틀린다. 승률·접촉 수는 그쪽에서 재지 않았다.
- 커밋 수 10/2 79 → 10/3 67 → 10/4 27 → 10/5 24 → 10/6 3; docs/strike 는 10/3 85 MD → 10/6 138 MD. 일지 계약(10/3)에 '같은 실패 가설 무조건 재실행 금지' 를 적은 뒤에도 지지·팔 제어 계열은 가설을 조금씩 바꿔 회차를 이었다(사실 기록).
- 심사 시간(추정): ① 0.75 h(zero_motor_probe — 우리 node_modules 로 0.63 s 에 재현, 샛별 수치와 소수 10자리 일치), ② 1 h(helper 참고), ⑥ 2 h(절단 모듈을 설계 점검표·시제품으로), ⑧ 1 h(8항목 일지 계약 중 우리에 없는 4항목). ③·④·⑤·⑦ 은 0.

**R8 교환·운영 (37편 · 52실험 · 기본 11 / 선택 6 / 연구 10 / 기각 6 · 심사 47: 채택 11 · 손봐서 11 · 안 맞음 17 · 근거 부족 8)**
- 발행 운영: 샛별 쪽 예약 발행은 10/1~10/5 다섯 번 중 정시 자동 성공이 한 번도 관찰되지 않았다(10/1 수동, 10/2 실패→10/3 재발행, 10/3 지연 2 h, 10/4 지연 15 h, 10/5 수동 23:30:27, 10/6 지연 발행 01:28 KST). 우리 쪽을 조회한 회차는 10/6 00:12 한 번(404 — 우리 한도 정지 중). 10/2 밤 인증 상실(401) → 10/3 새 환경 복원(코드 52커밋·원자료 943개·보충 118개)의 기록이 '총괄 교체' 의 문서 흔적으로 읽힌다(추정).
- 운영 산출물 중 우리 ⑧ 에 쓸 것(모두 손봐서): 전달 영수증 JSON 양식(approval_scope·release·validation·withheld·withdrawals), 발행 전 validate-notes 분리(코드 블록 안 '## ' 제외·무번호 H2 처리 — 우리 publish.py 는 번호 H2 1~6 만 봄), 무인 회귀 runner(fingerprint 캐시·실패 보존·개별 timeout), 8항목 일지 계약. 합계 3~5 h(추정).
- 새로 확인된 우리 쪽 결함 후보 1건(심사자 격리 시험, 디렉터 재실행으로 확인): Rapier 0.19.3 에서 `collider.setEnabled(false)` 는 충돌을 끄지 못한다(비활성 뒤에도 13스텝째 접촉·manifold 107회, 벽에 정지; collisionGroups 0 또는 removeCollider 만 통과). 우리 `trimSword`(`fighter.js:1651·1658`)가 setEnabled(false) 로 철구 머리·떨어진 부품을 '떨어뜨리므로' 파손 뒤에도 그 부품이 닿는다 → ⑤ 띠 보정 측정 전에 고칠 1줄(사장님 확인 뒤).

### ⑨-3 여덟 주제를 합쳐 우리 단계별로(중복 제거, 모두 추정)

같은 항목을 여러 심사자가 따로 셌으므로(A-021 프로브는 R1·R3·R7·R8, 절단 모듈은 R7·R8, 일지 계약은 R7·R8) 합산하지 않고 디렉터가 중복을 지웠다.

| 우리 단계 | 옮길 것 | 시간 변화(추정) | 조건 |
|---|---|---|---|
| ① A-021 재현 | 끝남(⑥). 샛별 fixture 가 설계를 대신함 | −1 h(이미 소진) | — |
| W1b 수정(새 소단계) | raw 5(yaw) 모터 미설정 또는 관절 재생성; chain_ledger 축 가정·명세 K1·확인표 123 문구 수정 | +2~3 h(새 작업) | 사장님 확인 뒤 |
| ② R1′ 구동 경로 재설계 | **보류**(축 교정 W2 재측정 뒤 판단). 하게 되면: joint_response 측정 설계 2 h, native_motor_limit 0.5 h, 가슴 참고각 운반·소량 선행 축 제외 4 h, 설계 메모(명시 PD 발산·JᵀF 포화·upright 3축 끄기 반례) | −5~6 h(조건부) | R1′ 가 필요할 때만 |
| ③ W2 재측정 | 같은 12 관문 1회 먼저. 필수: ledger 질량 매 스텝 읽기(10분). 6/7 조건표·바닥 제거 대조는 G3 정의 확인에 1~2 h 절약. 선택 열 4개(접점 미끄럼·누움 25 s·폭주 문턱·legs+fresh Nf)는 +5 h | −1~2 h / +5 h(선택) | 선택 열은 디렉터 선택 |
| ④ R3 효과표 | '같은 세계 점 + 비역전 상한 + ΔK≤0' 관문·반례 fixture, 0.8배·작용점 분리 메모, S-016 검사표 항목 | −4~6 h(조건부) | 절삭 반작용을 바꾸는 것은 물리 변경 → 사장님 결정 |
| ⑤ 모르겐슈테른 띠 | setEnabled(false) 결함 1줄, 관성 기준점 환산 확인 | −1 h | 결함 수정은 사장님 확인 뒤 |
| ⑥ 팔·다리 절단 설계 | 절단 모듈(236줄)을 설계 점검표·시제품으로, 피격→getup 상태기계 자료, 절단 뒤 초기화 검사 목록, prevAim 재활성 결함(우리 `fighter.js:2405·2451-2455` 같은 꼴) | −4~5 h | 문턱 1.2·8.5 cm 는 가져오지 않음(사장님 확인 전) |
| ⑦ 폰 입력·AI 보정 재측정 | 보정 0 팔꿈치 고정 진단 1회, 손 뗌 뒤 목표 변화율 열, 세로 1.35 비교 칸, inbox 답 2 정정 | ±0.5 h | — |
| ⑧ 운영(발행 CI·기록 규약) | 영수증 JSON 양식, validate-notes 분리, 무인 회귀 runner, 8항목 일지 계약, 호출 횟수·무효 보존·노출/효능 분리 규약 줄 | −4~5 h | — |

줄어드는 단계: ① 하나(끝남). 순서가 바뀌는 것: ② 가 '축 교정 W2 재측정' 뒤로 밀리고 필요 없어질 수 있음(이것이 가장 큰 변화). 그대로인 단계: ④·⑤·⑥·⑦·⑧(자료·점검표만 보탬, 각 1~6 h 안팎). 늘어나는 것: W1b 수정 소단계와 ③ 재측정 1회.

### ⑨-4 우리 코드에서 같은 꼴로 확인된 결함·구조 후보(모두 사장님 확인 전, 고친 것 없음)

| # | 내용 | 우리 자리 | 근거 |
|---|---|---|---|
| 1 | 닻 generic 관절 raw 축 4 ≠ yaw(= 세계 z), 5 = yaw; W1b 는 yaw 를 끄지 못함 | `hs-r2pi/src/fighter.js:1846-1849`, `chain_ledger.mjs:94`, 명세 K1·확인표 123 | ⑥ 특검 |
| 2 | k=d=0 모터는 자유가 아니라 경성 속도 잠금 | 같은 자리 | ⑥ 특검, 샛별 A-021 |
| 3 | `collider.setEnabled(false)` 가 충돌을 끄지 못함 → 파손 부품이 계속 닿음 | `src/fighter.js:1651·1658` trimSword | R8 심사 격리 시험 + 디렉터 재실행 |
| 4 | 제어 정지(넘어짐·부활·절단) 뒤 재활성 첫 스텝에 묵은 prevAim 으로 큰 목표 각속도 | `src/fighter.js:2405·2451-2455`(prevAim 비우는 줄 없음) | R6 심사 코드 대조, 샛별 injury_followup |
| 5 | 넘어짐→기립→새 서기 전환에서 옛 발 마찰 하중 Nf 가 남아 다음 서기의 마찰 한도로 쓰임 | `src/gait.js` enter/exit(137-178)·pinFeet(972·995) | R2·R4·R8 심사 코드 대조, 샛별 10차 |
| 6 | chain_ledger 가 질량을 attach 때 한 번 읽음 ↔ gait 가 딛은 발 +2 kg 토글 | `chain_ledger.mjs:116-118`, `gait.js:734-739` | R1 심사(새 발견) |
| 7 | 절삭 반작용 작용점 분리·0.8배(설계 흡수인지 결함인지 미정) | `src/combat.js:361-372` | R3·R6 심사 |
| 8 | getup→stand 가 시간표만으로 전환(발 하중 조건 없음) | `src/fighter.js:1179-1188` | R1 심사 |
| 9 | AI 예측 경로에서 판금에 막힌 마무리를 즉사로 과대 예측(S-016) | `src/combat.js:270` | 우리 10/6 발견, R6 심사 검사표 참고 |
| 10 | 10/6 inbox 답 3 정정 필요: 우리 offHand 도 두 점 ±F 스프링 | `src/fighter.js:2623-2662` | R6 심사 |

— ⑨ 끝. 전수 집계 스크립트 출력은 디렉터 작업 공간(`scratchpad/devmeet/review/`)에 있다. 채택은 사장님 확인 뒤.
