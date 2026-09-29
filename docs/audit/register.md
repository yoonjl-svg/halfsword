# 감사 권고 대장

- 감사가 권고를 적고, 디렉터가 하루 안에 수용/거부와 이유를 답한다. 감사는 답을 이 표에 옮겨 적는다.
- 답이 없으면 다음 보고에 "미답"으로 올린다.
- 시각은 모두 한국 시간이다. 몫: 사장님 = 사장님이 정할 것, 디렉터 = 디렉터가 바로 할 수 있는 것.
- 상태: 미답 / 수용 / 거부 / 완료(감사가 커밋으로 확인) / 대기(아직 권고하지 않은 후보).

| 번호 | 날짜 | 몫 | 권고 (요지) | 증거 | 디렉터 답 (수용/거부·이유) | 상태 |
|---|---|---|---|---|---|---|
| R-001 | 9/29 | 사장님 알림 + 디렉터 | wbs-impl 옛 결심 경로의 미승인 제한 13개(c ≤ 1 속도·위력·크기 천장, 회복 시간, 올려베기 쿨다운 등)를 R2 첫 작업으로 지운다. decisions.md "지울 제한"을 2개에서 전부로 고친다. `/wb/` 평가는 천장이 켜진 상태였음을 사장님께 알린다 | 2026-09-29.md R-001, 부록 A-1 | — | 미답 |
| R-002 | 9/29 | 사장님 | R2 명세 10장의 "사장님 답 전 기본값"(sL0 0.12 m, sectorMax 80°, leadMs 40·S, wristRel 60, stepS 0.3, stepHold 0.25, tauRelease 0.25 s 등)과 AI 리볼버 1.5 s·3°를 한 표로 여쭙는다. Q10(30 m/s 버림)은 미이행 | 2026-09-29.md R-002 | — | 미답 |
| R-003 | 9/29 | 디렉터 | 측정 바로잡기: weightMode 기본값 hybrid, 안 읽히는 WHOLE 스위치 8개(가짜 층 끄기), fights12 소음 폭 표기, chain.mjs 하나로 획 드라이버 5벌 합치기, 안 도는 redesign_probes 정리 | 2026-09-29.md R-003, evidence README 2절 | — | 미답 |
| R-004 | 9/29 | 디렉터(flow·motion_library 는 사장님) | 지금 설정에서 기여 0인 코드 지우기(main 약 250줄: flow, uprightRelax, footReaction, accelLean, THRUST.bind, holdAmount, loadKnee, WEAPON.mass/length, getUpDuration; wbs: tcFloor 코드, bufferLock). motion_library·weapon_class 두 벌 문제는 R2 W1 에서 정해 받기 | 2026-09-29.md R-004, evidence walk/hist/ablation | — | 미답 |
| R-005 | 9/29 | 디렉터 | 모델 이름 지우기(decisions.md:30-31, sound_pm_handoff.md:16). grep 에 한글 표기도 넣기. 어긋난 문서 6곳 고치기(whole_body_strike.md:160 "24 m/s 이하" 등) | 2026-09-29.md R-005 | — | 미답 |
| B-1 | 9/29 | 디렉터 | cacheState 게으르게(CPU 약 8%) | 부록 B | — | 대기 |
| B-2 | 9/29 | 디렉터 | 두 손 쥠 용수철이 떨림의 출처, GRIP.k/d 다시 보기 | 부록 B | — | 대기 |
| B-3 | 9/29 | 디렉터 | 사장님 결정 원장을 decisions.md 하나로 | 부록 B | — | 대기 |
| B-4 | 9/29 | 디렉터 | 도구 정리 2차(싸움 루프 9벌, 감싸기 5개, jelly_harness, director_checks, 일회성 시뮬, 안 쓰는 이미지) | 부록 B | — | 대기 |
| B-5 | 9/29 | 디렉터 | 옛 설계 문서 보관, "R2" 이름 겹침 | 부록 B | — | 대기 |
| B-6 | 9/29 | 사장님 | 느낌 쪽 작은 단계 5개(시뮬로는 거의 0) | 부록 B | — | 대기 |
