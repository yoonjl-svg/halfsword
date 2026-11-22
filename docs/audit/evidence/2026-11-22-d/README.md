# 2026-11-22 일일 점검 증거 (본판 bcadc3fc)

| 파일 | 무엇 |
|---|---|
| `gates_bcadc3fc.txt` | 관문 여덟의 출력 지문. 도구는 `../2026-11-22-w/tools/gates.sh` 그대로 |
| `build_and_test_bcadc3fc.txt` | 빌드 · 처음 받는 목록 · 아이콘 · 시험 수 |
| `g10_window_19runs.jsonl` | 독일 비기 창: 느낌표 뒤 0 · 6 · 12 · 24 · 40 프레임에 긋기(멈춘 상대 3판씩) + 진짜 상대 4판. 도구는 `../2026-11-22-w/tools/g10_window.mjs` 그대로 |
| `g10_hit_16runs.jsonl` · `g10_hit.mjs` | 같은 순서에 "무엇을 얼마나 세게 맞혔나"를 더해 잼(묶인 채 / 풀린 뒤) |
| `g10_prebind_12runs.jsonl` · `g10_prebind.mjs` | 묶였고 창은 안 열린 때의 긋기 · 톡이 막히는지 |
| `mordschlag_real_check_still.txt` | 디렉터 확인 도구(`tools/browser/mordschlag_real_check.mjs`)를 본판에서 한 판 돌린 출력(프레임 줄은 뺌) |
| `input_order_copies.txt` | 사람 손 입력 차례를 옮겨 적은 도구 목록과 벌어진 곳 (N-041) |

`g10_hit.mjs` · `g10_prebind.mjs` 는 `../2026-11-22-3/harness/hlib.mjs` 를 같은 폴더에 두고 돌린다. 본판을 `npm run build` 한 뒤 `vite preview` 주소를 첫 인자로 준다.
