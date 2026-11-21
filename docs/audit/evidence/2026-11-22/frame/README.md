# ② 프레임 쪽 일과 판 시작 멈칫 — 근거

기준: 본판 `9c5ba917`. 헤드리스 브라우저(소프트웨어 그래픽)라 밀리초는 폰 값이 아니다. 몫과 비율로 읽는다.

## 다시 재는 법
```
# 싸우는 동안 한 프레임 (개발 서버)
npx vite --port 5197 --strictPort
node q1_profile.mjs http://127.0.0.1:5197 poseidon 4 out/q1_poseidon_r4_a 20      # 무대, CPU 배율, 결과 이름, 초
node prof_bucket.mjs out/q1_poseidon_r4_a.cpuprofile <그린 프레임 수> --nonphys   # 어디에 쓰였나
NOSHADOW=1 node q1_profile.mjs http://127.0.0.1:5197 poseidon 1 out/q1_poseidon_r1_noshadow 20

# 판 시작 멈칫 (배포 빌드)
npx vite build --outDir dist --sourcemap && npx vite preview --outDir dist --port 5198
node q2_hitch.mjs http://127.0.0.1:5198 1 out/v_base_1.json 4 1                    # CPU 배율, 결과, 무대 바뀜 횟수, 같은 무대 횟수
node v_summary.mjs out                                                            # 가운데값과 범위
PROFILE=out/q2_prof_r4 node q2_hitch.mjs http://127.0.0.1:5198 4 out/q2_r4_a.json 4 1
node prof_map.mjs out/q2_prof_r4.cpuprofile dist out/q2_prof_r4.mapped.cpuprofile node_modules
node prof_hitch.mjs out/q2_prof_r4.mapped.cpuprofile 25
```
`run_verify.sh`는 그대로인 빌드와 "셰이더 오류 검사 끔" 빌드를 번갈아 3번씩 돌린다(뒤의 빌드는 `main.js`의 렌더러 만든 줄 아래에 `renderer.debug.checkShaderErrors = false;` 한 줄을 임시 사본에 넣어 만든 것).

## 파일
| 파일 | 무엇 |
|---|---|
| `out/q1_*.json` | 20초 싸움의 게임 자체 성능 표 값(물리·그리기 ms), DOM 쓰기 수, 그리기 호출 수 |
| `out/q2_r1_a.json`, `out/q2_r4_a.json` | 조사에서 잰 멈칫(CPU 그대로 / 4배), 프레임 간격 원본 포함 |
| `out/v_base_*.json`, `out/v_nock_*.json` | 감사가 다시 잰 멈칫 3번씩(그대로 / 검사 끔) |
| `out/v_summary.txt` | 위 여섯 번의 요약 |
| `notes_en.md` | 조사 기록 전문(영어) |

CPU 프로파일 원본(0.3 ~ 1 MB씩)은 싣지 않았다. 위 명령으로 다시 만든다.
