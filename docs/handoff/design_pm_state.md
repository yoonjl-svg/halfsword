# 기획 PM 상태 파일 (후임이 가장 먼저 읽는다)

- 갱신: 2026-09-30 16:10 KST. 세션 session_01QRwbXg6zS4784iUVd3XGV5, 브랜치 `claude/pm-design`, 환경 env_01YG7HgthZqrnM2wyk4jrLkh.
- 읽는 순서: 이 파일 → `docs/handoff/design_pm_charter.md` → `docs/handoff/director_state.md`(세션 명단·운영 규칙) → `docs/decisions.md` → 내 산출물 `docs/design/*`.
- 디렉터 세션: session_014nJCzE4hyxiYc9innhSUng. 알릴 때는 매번 새 트리거(create_trigger + persistent_session_id, 일정 없음) → fire_trigger.
- 정기 트리거: "기획 PM 18:00 일일 보고" trig_01BzJe3XHZK32FLGuH8UfxZq (CRON_TZ=Asia/Seoul 17:54, 이 세션으로). 교체하면 새 세션에 다시 건다.

## 진행
- ✅ 끝남: 과제 1 구조 지도 `docs/design/structure_map.md` (main `851d0af` 기준, 276줄). 물리/규칙/데이터/연출 분류, 모듈 지도, 스텝 흐름, 콘텐츠 목록(무기 15·캐릭터 6·무대 6+2·기술 12·자세 14·클립), 진행 중 항목, 세 방향 이음새 관찰 10개, 사장님 질문 3개(Q-S1~S3).
- ⏳ 진행 중: 없음.
- ⛔ 안 함: 과제 2 세 방향 문서 `docs/design/direction_{adventure,rpg,fighting}.md` (사장님 Q-S1 답 없으면 "지금 main 기준 + R2 뒤 덧붙임"으로 진행). 과제 3 수직 슬라이스(사장님이 방향을 고르신 뒤).

## 열린 질문 (사장님)
- Q-S1 방향 문서의 "핵심" 기준: 지금 main(팔 베기) vs R2 온몸 시험판. 제안 = main 먼저, R2 뒤 한 절 덧붙임.
- Q-S2 보이지 않는 힘 셋(체중 30%·이동 추진·똑바로 서기)을 핵심 물리로 볼지 임시 보조로 볼지.
- Q-S3 "판 사이 이어지는 몸 상태"를 방향 결정 전 작은 시험으로 먼저 올려도 되는지.

## 디렉터에게 맡긴 검토
- 구조 지도의 사실 오류 지적(특히 §3.2 판정 표·§3.4 보이지 않는 힘·§6 진행 중 표). 방향 문서는 검토 뒤 시작.

## 기억 사용률
- 약 25% (9/30 16:10). 80%에서 이 파일 갱신 뒤 디렉터에게 알리고 교체 준비.

## 규칙 되새김
- 코드 읽기만(src·tools 수정 금지). 문서는 docs/design/ 아래. 모델 이름 금지(등급만). 수치 제안은 근거와 "사장님 질문"으로. 보고 18:00 1회 10줄 안. 큰 출력은 파일로.
