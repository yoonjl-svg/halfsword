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
- R0 상태: 관문 G0(깃발 끄면 바이트 동일)·G2·G3a·G3b·G5·G6·G7 통과. G4는 60 Hz 입력이 120 Hz처럼 움직이게 된 의도된 변화(120 Hz 기준선 대비 ±3% 안)라 기준을 120 Hz로 다시 정의. G3c(가벼운 칼 손목 부호 뒤집힘)는 기존 문제, 수정 라운드에서 안정성 조건(c·dt/I ≤ 0.9, 상한 아님)으로 처리 중.
- 시험판 /wb/는 옛 것(4b5c56a). R0+R1(팔 베기 지연)까지 되면 다시 만들어 사장님께 드린다.

## 사장님 답 대기
- Meyer 1570 번역서 전달(드라이브 비공개 폴더 PDF/EPUB 파일 이름).
- 무기 PM 제안 "가벼운 무기 T0 아래 한도"(디렉터 의견: 두지 않기). 설정 점검 ⑥-4·5·8. 여정 대화 목업은 보류.
- 무기 PM 교체 시점(80% 규칙대로), 디렉터 교체(85%).
