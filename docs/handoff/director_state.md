# 디렉터 상태 파일 (후임 디렉터가 가장 먼저 읽는다)

- 갱신: 2026-09-29 22:00 KST. 디렉터 세션 session_014nJCzE4hyxiYc9innhSUng (디렉터 모델, ultracode, auto — 모델은 앱의 세션 정보에서 본다).
- 읽는 순서: 이 파일 → docs/decisions.md(사장님 결정, 최신순) → docs/director_handoff.md(2장 규칙·7장 도구) → docs/strike/r2_impl_spec.md(§1·§9·§10).

## 사장님이 정한 운영 규칙 (2026-09-29)
- 보고: 한국어, 한국 시간, "끝남 / 진행 중 / 안 함". 디렉터는 하루 3회 08:00·18:20·22:00 KST(정기 트리거가 이 세션에 걸려 있다. 교체하면 새 세션에 다시 건다). PM은 18:00 1회.
- 제한·상한·조건은 사장님만 넣는다. 난이도 테스트 없음. 최종 판정은 사장님 플레이.
- 모델: PM 전원 표준 모델 high, 감사 표준 모델 xhigh(모델 이름은 저장소에 적지 않는다. 앱의 세션 정보에서 본다). 디렉터 하위 에이전트 라우팅(디렉터 기준, 하한 3등급 medium):
  - 1등급(디렉터와 같은 모델) xhigh: 설계 통합, 숨은 상한 검토, 최종 diff 판단(디렉터 자신)
  - 2등급(PM 표준 모델) high: 물리·제어 코드 구현, 원인 수정, 설계 심사, 리뷰
  - 2등급 medium: 관문 실행, 기준선 측정, 문서·팩 생성, 재현형 검증
  - 3등급(잔일 모델) medium: 파일 복사·목록·정리 같은 잔일 (low는 쓰지 않는다)
- 교체: PM은 기억 80%, 디렉터는 85%가 되는 순간 교체를 준비해 적정 시점에 교체한다. 절차: 상태 파일 갱신 → 새 세션(같은 모델·노력, 상태 파일과 헌장만 읽음) → 모든 PM에게 새 id 알림 → 정기 트리거 다시 걸기 → 옛 세션 보관.
- 디렉터 토큰 절약(전승할 것): PM 트리거는 짧게(만들 때와 쏠 때 본문이 두 번 되돌아온다), 큰 출력은 파일로 두고 요약만 읽기, 워크플로 결과는 하위 에이전트가 파일로 정리하게 하기, 세션 조회·알림은 필요한 칸만 뽑아 읽기.
- 커밋 끝 두 줄(자기 세션 안내의 Co-Authored-By·Claude-Session)만 모델 이름 예외. 하위 에이전트가 만든 커밋은 그 에이전트 세션의 안내대로 붙는다.
  - 올리기 전 모델 이름 grep(영문·한글 표기 둘 다. 이름을 글자로 적지 않으려고 코드값으로 쓴다. 0건이어야 한다): `LC_ALL=C.UTF-8 git grep -n -I -i -P '\b(\x6f\x70\x75\x73|\x73\x6f\x6e\x6e\x65\x74|\x68\x61\x69\x6b\x75|\x66\x61\x62\x6c\x65)\b|\x{C624}\x{D37C}\x{C2A4}|\x{C18C}\x{B137}|\x{C18C}\x{B124}\x{D2B8}|\x{D558}\x{C774}\x{CFE0}|\x{D398}\x{C774}\x{BE14}' -- . ':!package-lock.json'`. 커밋 본문은 같은 식을 `git log --format=%B <범위> | grep -v -E '^(Co-Authored-By|Claude-Session):' | LC_ALL=C.UTF-8 grep -n -i -P '<같은 식>'`로 본다.

## 세션 명단 (2026-09-29 22:00)
| 역할 | id | 브랜치 | 비고 |
|---|---|---|---|
| 동작 연구 PM | session_013YFFvQRnDedG7CTF1eVknA | claude/pm-motion-research | 기준 클립·검사기·채점기. 가장 생산적. v1 과제 진행 중 |
| 무기 PM | session_013j34LYEUYoaeS5xUme2DTq | claude/pm-weapons-balance | 기억 66% → 80%에 교체 준비. 남은 일: R0 뒤 Q13 값, R3 뒤 밸런스, R2 붉은 팀 |
| 캐릭터 PM | session_01HSrct4UE9qVgfTi4hd59qi | claude/pm-characters | 대기. R5에 기질값 |
| 외형 PM | session_01HNkUuYHag8VSg6xpgbkGVR | claude/pm-character-looks | 대기. R2 뒤 갑옷 뚫림 점검 |
| 사운드 PM | session_018mZ2Hqp8QUttYxEroMCesF | claude/pm-sound-impact (환경 env_01A6VUoNJgYWiFs5hTZrWavH) | 대기. R3에 hitScale 'log' 켜기 |
| 감사 | session_01P6xekotejC4FCmL2uX1S85 | claude/audit | 매일 17:00 diff 감사, 일요일 10:00 전체. 권고 대장 docs/audit/register.md. 디렉터는 권고마다 하루 안에 답 |
| 폐지 | 연구 ASS session_01QoWtSqxGN5jYBMudxkqo1x(보관), 옛 디렉터 session_01KcYCh6UfKjrR4m8QjPcEbM(은퇴), 중복 디렉터 session_01NDJVGN7xsXPq19Yzry3BvH(보관) | | |

## 온몸 타격 진행 (브랜치·워크트리)
- 설계: docs/whole_body_redesign.md(사장님 답 반영은 docs/decisions.md 우선), R2 명세 docs/strike/r2_impl_spec.md, 작업 항목 r2_workitems.json (W1 아틀라스 → W2 손짓 → W3 몸통·다리·꼭두각시 → W4 팔 → W5 관문·시험판).
- 로컬 브랜치(디렉터 컨테이너 /home/user/*): wbs-impl(hs-wbs, = origin/claude/wbs-impl + main 병합) → wbs-r0(hs-r0, R0 5항목 통합; 수정 라운드 중) → wbs-r2-gesture(hs-r2-gesture, W2 진행 중). wbs-r2-atlas(hs-r2-atlas, W1 끝, 320b8f6). 원격에는 claude/wbs-impl만 있다(사장님 허락). 컨테이너가 바뀌면 로컬 브랜치는 사라지므로 R0·W1·W2가 끝나는 대로 wbs-impl에 합쳐 origin/claude/wbs-impl로 올린다.
- 9/29 22:30 진행: R0 수정 라운드 끝(wbs-r0 fc448f1, 숨은 상한 검토 SHIP, 깃발 끄면 바이트 동일 sha 15dca714/cee16b90/b867fc3f — 옛 levitate 기본값 때 세 관문. 9/29 감사 R-003로 main 기본값을 hybrid로 바꾼 뒤 관문은 둘: main 기준 fights12 afdd8c66 · live_battery 11433650(sha256 앞 8자리); 9/30 시작 거리 7.0·2초 정지 뒤: fights12 a74bb59c · live_battery 2f453e0b (옛 값 ARENA.startGap=4.2 ARENA.startHold=0 이면 afdd8c66·11433650 그대로). wbs 쪽 기준은 main 병합 뒤 다시 뜬다. fights12는 바이트 관문 전용, 좋다/나쁘다 판단은 36판 이상과 흔들림 폭(tools/sim/README '소음 폭')). W2 손짓 층 끝(wbs-r2-gesture 93b25ac: 9ac2018 구현 A, a84a5bc 구현 B, 93b25ac 고침; 16개 검증 중 확정 항목 고침, gesture_eval 두 입력 방식 PASS). 통합 에이전트가 wbs-r0 → wbs-r2-atlas → wbs-r2-gesture 를 wbs-impl 에 합쳐 관문 뒤 origin/claude/wbs-impl 로 올리는 중(요약: scratchpad/merge/wbs_merge_2026-09-29.md). 다음: W3(drive.js 몸통·다리·꼭두각시, 스크립트 scratchpad/r2/w3_drive_workflow.js) 을 합쳐진 wbs-impl 에서 시작.
- 9/29 23:40 진행: W3 워크플로 wf_deed49f3-ba6(가지 wbs-r2-drive, 워크트리 hs-r2-drive)와 R1 워크플로 wf_9c387b92-620(가지 wbs-r1-arm, hs-r1-arm)이 wbs-impl 9fd9283 에서 나란히 진행 중(스크립트 scratchpad/r2/w3_drive_workflow.js, r1_arm_workflow.js). W2 후속 고침 에이전트가 wbs-impl 에서 (A) 되감기 숨은 쿨다운 제거·되감기 S 이어받기·sectorMax 틈 안 긋기·padExt 삭제 중(요약 scratchpad/r2/w2_followup_summary.md). 끝나면 W3·R1·후속을 wbs-impl 에 합치고 main 도 병합(2daf262 weightMode 기본 hybrid → wbs 기준 파일 재생성 필요).
- 감사 답(9/29 23:25 감사 세션에 트리거로 전달): R-001 부분 수용(삭제는 W5 유지), R-002 수용(표 docs/strike/owner_defaults_table.md → 9/30 08:00 사장님), R-003 ①③ 수용 완료(2daf262)·②④ W5, R-004 조건부 수용(9b5e94c 지금 몫, fighter.js 몫 W4 뒤, THRUST.bind 유지), R-005 수용 완료(10d9839). 이행 요약 scratchpad/audit/apply_2026-09-29.md.
- 사운드 PM(타격 소리 간격·리볼버 총성)·외형 PM(발사 이펙트)에게 9/29 23:20 지시. 끝나면 디렉터에게 트리거로 알리기로 함 → 브랜치 확인 뒤 main 병합·배포.
- R1 끝(9/29 23:45, wf_9c387b92-620, 31 에이전트): wbs-r1-arm a055980. 숨은 상한 검토 "그대로는 출하 불가": ARM.lead(aimLead 0.8)가 실제 휘두름을 −36% 느리게 함(옆베기 19.7→12.6 m/s, 사선 첫 상처 144→37 J). 디렉터 결정: ARM.lead 기본 꺼 둠(코드 유지, W4 팔 앞먹임 뒤 재측정, 사장님 표 26행), holdSpeed 0.6 은 손가락 검객만(AI 0.3 유지, 표 25행). 마무리 에이전트가 두 변경 뒤 wbs-impl 에 병합·관문·푸시(요약 scratchpad/r1/r1_final_summary.md). 열린 질문: 1.5 m/s 밑 느린 끌기에도 '고른 지연 ≤ 20 ms' 를 적용할지(적용하면 목줄 규칙 변경 필요).
- 9/30 02:00: main e11db65 = 시작 거리 7.0·2초 정지(a9bc074) + 칼 잔상 임시 0.15(2b843e7) + 외형 발사 이펙트 성능(0728a12) + 동작 v1 마지막(009509c) + 무기 PM 병합(리볼버 사실감 6연발·0.7 s·장전 9 s, 엑스칼리버 기운 절반, 둔기 제안, Q13 값 제안 docs/strike/q13_values_proposal.md — R3 combat.js 구현은 디렉터). PM 의견 모음 docs/strike/close_quarters_blunt_opinions_2026-09-30.md. 시뮬 기준(9/30): fights12=hybrid a74bb59c, live_battery 2f453e0b. 대기 중: 외형 PM 칼 잔상 v2(e9808cb, 검증 보고 기다림), 캐릭터 PM persona.idle/close 시트, W4 wf_1c503c5d-00b. 사장님 답 대기: 둔기 후보·레어, 권총 세기(승률 96%), 확인표(docs/strike/owner_defaults_table.md).
- 9/30 01:30: W3 병합 0c45eb1 + main(c93e9a9) 병합 39f4d48 + 기준 메모 1a3a57a = origin/claude/wbs-impl 1a3a57a(관문 전부 통과: 깃발 끄면 R0 기준과 동일, 온몸 깃발 전부(WHOLE.on 포함) 끄면 main 과 바이트 동일, GESTURE·DRIVE 켜도 AI 시뮬 불변 = S=0 불변; 기준 sha docs/strike/wbs_baselines.md). W4 워크플로 wf_1c503c5d-00b(가지 wbs-r2-arm, 워크트리 hs-r2-arm, 스크립트 scratchpad/r2/w4_arm_workflow.js) 시작. 다음: W4 끝나면 병합 → W5(관문·chain.mjs·s0_diff·옛 결심 경로 삭제·시험판) → R2 첫 시험판 10/2 밤.
- W3 끝(9/30 00:50, wf_deed49f3-ba6, 45 에이전트): wbs-r2-drive 05e3b6d(0f598ae drive.js·훅, 95ce101 꼭두각시, 2f53360 아틀라스 미리 읽기, 05e3b6d 검토 고침). 꼭두각시 24/24(손 6 mm, 칼 0.07°), 추적 골반 지연 ≤ 8°, 넘어짐 0, 검토 37건 중 29건 확정 → 고침. 사장님 질문 추가: 표 35(느린 긋기 걸음 시간, Q7)·36(감기 φ 넘침, Q22)·37(걸음 뒤 되돌리기). 통합 에이전트가 wbs-impl 에 병합(관문: 깃발 끄면 R0 기준과 동일, 기본값 AI 시뮬은 ea783ac 과 동일 = S=0 불변, puppet/gesture_eval/atlas_check, smoke) 뒤 main(c93e9a9) 도 wbs-impl 에 합쳐 새 기준 docs/strike/wbs_baselines.md 기록 예정. 다음: W4 스크립트(scratchpad/r2/w4_arm_workflow.js) → 병합 끝나면 시작.
- 9/30 00:40: R1 마무리 병합 → wbs-impl ea783ac(origin/claude/wbs-impl). 리볼버 v2(사운드 613c0c7·외형 a0d60be) 본판 병합 → main 6424487(외형 PM 폰 성능 후속 지시: 셰이더 예열·총구 조명 비용). /wb/ 시험판 재빌드(ea783ac, 앞섬 보정 끔) → 0cd1569, 안내문 docs/strike/wb_build_note_2026-09-30.md. 사장님 판단 요청: "더 날카로운가? 위력이 줄지 않았는가?". 시험판 빌드는 --base /halfsword/wb/ (Pages 전용; 로컬 dev 서버의 /wb/ 는 깨짐).
- 컨테이너 재시작(9/29 23:40): W3·R1 워크플로 resume 로 복구(끝난 단계는 캐시). 재시작 뒤 확인 순서: get_session(ultracode·auto), vite 5173/5174, 워크트리 미커밋 작업.
- W5 메모(9/29 23:55): 옛 결심 경로(COMMIT)를 지울 때 gesture.js readFinger 가 읽는 COMMIT.stillGap·stillFrames 는 GESTURE 로 옮겨 남긴다. 긋기 S 의 over 기울기(중→대 기울기의 절반)는 구현대로 두고 W3 드라이브가 over 이득 1로 잇는지 검토에서 확인. 명세 반영 커밋 5da96c3(§1·§3·§4·§5.2·§10, padExt 삭제).
- 감사 첫 보고(9/29 22:10, claude/audit e109cf8 docs/audit/2026-09-29.md) 권고 R-001~R-005. 답 기한 9/30 22:00. 검증 에이전트 요약: scratchpad/audit/verify_2026-09-29.md. 디렉터 소견(초안): R-001 수용(옛 결심 경로 삭제를 W3 첫 단계로 당김; 10/1 /wb/ 시험판은 옛 경로 끈 R0+R1), R-002 수용(사장님께 미승인 기본값 한 표), R-003 수용(weightMode 기본 hybrid, 기준 파일 재생성, 안 읽히는 WHOLE 스위치 정리, chain.mjs 로 통합), R-004 수용(바이트 동일 증명 붙여 삭제; flow·motion_library 는 사장님 질문), R-005 대부분 5f928a1 로 이미 고침, 나머지 문서 정합은 3등급 에이전트.
- R0·W2 에서 나온 사장님 질문(08:00 보고에 올릴 것): ① 가슴 윗띠 목 판정 폭 neckHalfZ 0.08 m(스윕 켜면 어깨 첫 닿음이 목 즉사가 아니라 가슴) ② 권총 광선의 목 띠도 같게 할지(gun.js:250) ③ 가벼운 칼 손목 뒤집힘 7% 관문에 못 드는 세이버·청강검·참치는 제어 법칙 문제(안정 조건으로는 못 고침) — 손댈지 ④ W2 (A) 방식에서 감기 없이 정지에서 바로 긋는 획을 베기로 볼지(지금은 감기로 읽음; (B) 방식은 베기) ⑤ sectorMax 80° 등 §10 기본값 표(R-002).
- R0 상태: 관문 G0(깃발 끄면 바이트 동일)·G2·G3a·G3b·G5·G6·G7 통과. G4는 60 Hz 입력이 120 Hz처럼 움직이게 된 의도된 변화(120 Hz 기준선 대비 ±3% 안)라 기준을 120 Hz로 다시 정의. G3c(가벼운 칼 손목 부호 뒤집힘)는 기존 문제, 수정 라운드에서 안정성 조건(c·dt/I ≤ 0.9, 상한 아님)으로 처리 중.
- 시험판 /wb/는 옛 것(4b5c56a). R0+R1(팔 베기 지연)까지 되면 다시 만들어 사장님께 드린다.
- 본판(main) 최근: c9c6c6c 리볼버 조준쇠(gun_fx.js 스프라이트 조준쇠, 외형 PM 모듈 — 다음 지시 때 한 줄 알린다)·이동 ×1.4. 사장님 시험 주소 `https://yoonjl-svg.github.io/halfsword/?weapon=pistol&foeWeapon=longsword`. 시험 플레이 약속: 본판은 언제나, R0+R1 시험판 /wb/ 10/1 밤, R2 첫 시험판(W2~W5) 10/4~5.

## 사장님 답 대기
- Meyer 1570 번역서 전달(드라이브 비공개 폴더 PDF/EPUB 파일 이름).
- 무기 PM 제안 "가벼운 무기 T0 아래 한도"(디렉터 의견: 두지 않기). 설정 점검 ⑥-4·5·8. 여정 대화 목업은 보류.
- 무기 PM 교체 시점(80% 규칙대로), 디렉터 교체(85%).
