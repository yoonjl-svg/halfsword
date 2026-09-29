# 감사 증거 (2026-09-29 첫 감사)

보고서 `docs/audit/2026-09-29.md`의 숫자를 다시 내는 스크립트. 게임 파일은 고치지 않는다. 모두 **복사본**에서 돈다.

## 1. config 손잡이 읽힘·값 바뀜 (권고 R-004)
```
cd docs/audit/evidence/2026-09-29
node walk.mjs /home/user/halfsword > main.tsv          # 잎 값마다 src/tools 에서 읽히는 횟수
git -C /home/user/halfsword fetch --unshallow          # 역사 전체가 필요 (얕은 복제면)
node hist.mjs /home/user/halfsword origin/main > hist_main.tsv   # 잎 값마다 값이 바뀐 커밋 수
python3 blk.py                                          # 꺼진 깃발 뒤 코드 줄 수 어림
```
결과: 5988c5a 기준 잎 372개 중 329개는 들어온 뒤 값이 한 번도 안 바뀜. wbs-impl(d781ab9) 554개 중 496개.

## 2. 물리 단계 끄고 비교 (권고 R-004, R-003)
```
S=/tmp/abl; rm -rf $S; mkdir -p $S; cp -r /home/user/halfsword/{src,tools,package.json} $S/
ln -s /home/user/halfsword/node_modules $S/node_modules
cd $S && patch -p1 < /home/user/halfsword/docs/audit/evidence/2026-09-29/ablation.patch
cp /home/user/halfsword/docs/audit/evidence/2026-09-29/{fightsN.mjs,D_prof.mjs} tools/sim/
# 한 후보 (예: shove 끄기). ABL 값: shove, walkLean, lowSkillYaw, filterW, wristHill, twistFF, velLP,
#   elbowGravity, wristVT, shoulderVT, jointVT, gripSpring (ablation.patch 안 process.env.ABL 참고)
ABL=shove nice -n 10 node tools/sim/with_config.mjs BODY.weightMode=hybrid live_battery.mjs cuts,steps,kata,walk,jitter,hits
ABL=shove N=36 nice -n 10 node tools/sim/with_config.mjs BODY.weightMode=hybrid fightsN.mjs
# 설정값으로 끄는 후보: ABL 없이 CFG 인자, 예: ... BODY.weightMode=hybrid GAIT.bobAdd=0 GAIT.dsLow=0 live_battery.mjs ...
# 소음 폭(1e-6 바꿈): ... BODY.weightMode=hybrid BODY.uprightStiffness=2500.001 fightsN.mjs
# CPU: N=4 node tools/sim/D_prof.mjs   (또는 node --cpu-prof tools/sim/fightsN.mjs)
```
- 걸린 시간: live_battery 부분 약 8 초, 36판 약 80 초(CPU 4개 중 하나, nice 10).
- 싸움 36판은 혼돈계라 1e-6 바꿈에도 죽음 24~27, 플레이어 승 12~19, 넘어짐 46~62로 흔들린다. 이 폭 안의 차이는 "0이라는 증명"이 아니다.
