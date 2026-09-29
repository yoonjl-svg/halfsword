# 온몸 타격 재설계 측정 도구 (docs/whole_body_redesign.md 가 인용한 것)

디렉터 scratchpad 에만 있던 측정 스크립트를 옮겨 둔 것이다 (2026-09-29, 디렉터 교체 인계).
경로는 이 저장소 기준으로 고쳐 두었다: 저장소 루트에서 `node tools/redesign_probes/<스크립트>` 로 돌린다(`run_*.sh` 는 스스로 루트로 간다). 결과는 `tools/redesign_probes/**/out/` 에 쓴다.
src 패치 없이 도는 것: `ccdprobe*.mjs`, `wriststab.mjs`, `steptime.mjs`, `mx/mx.mjs`, `costs/probe.mjs`, `tech/wlist.mjs`, `tech/exp3_energy.mjs`, `duelstats.mjs`(기본 통계만).
패치한 src 가 필요한 것(각 파일 머리에 적어 두었다; 패치는 적용하지 않았다): `tseq.mjs`·`run_cf.sh`(instr_src.patch), `speedsweep.mjs`·`run_speed.sh`·`run_swept.sh`·`run_duel.sh` 의 훅·`steptime.mjs SWEPT=1`(exp_src.patch), `tech/exp1_sweep.mjs`·`tech/run1.sh`·`run2.sh`(tech/snap 의 env 패치, 저장소에 없다).

- `tseq.mjs`: 결심 베기·팔 베기의 골반·가슴·어깨·손·칼끝 속도 시계열(사슬 순서). `node tools/sim/hybrid.mjs ../redesign_probes/tseq.mjs`. 계측판 src 가 필요하다 — `instr_src.patch` 를 4b5c56a 의 src 에 적용해 만든다.
- `speedsweep.mjs`, `duelstats.mjs`: 손가락 빠르기별 칼끝·에너지, 대결 통계. R0 뒤에는 맨 src 로 돈다: `CAP`(30 = 예전 30 m/s 버림, 1e9 = 튐 검사만)·`HOLDEFF`(환산질량 붙잡기)는 config.js STRIKE.glitchFilter·gripMu 로 이어지고, 기준선(예전 방식 전부)은 `R0_OFF=1`. SWEPT·CCD·SPD 는 아직 `exp_src.patch` 의 실험판 src 가 필요하다.
- `mx/mx.mjs`: 손·칼끝이 몸 둘레에서 가는 범위(가슴 앞 상자) 측정.
- `costs/probe.mjs`, `costs/blockscan.mjs`: 온몸 베기의 대가(그만두기·헛침·회복·막힘) 측정.
- `ccdprobe*.mjs`: 빠른 칼이 얇은 몸통을 건너뛰는지(부드러운 충돌 예측 거리) 측정.
- `wriststab.mjs`: 가벼운 칼 손목 튐. `steptime.mjs`: 스텝 시간. `lethal.py`: 한 방 치명률 계산.
- `tech/`: 기술 실험(에너지·스윕). `run_*.sh`, `cmp_cf.js`: 위 도구 묶음 실행과 비교.

재현 증거로 쓰려면 이 도구로 커밋·시드·명령을 적어 다시 재야 한다 (역할 분담안: scratchpad 에만 있는 도구로 잰 숫자는 증거가 아니다).
