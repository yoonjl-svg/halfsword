# 화면 글꼴 (도트)

사장님 10/14 04:0x 결정 — 웹폰트 비교 세 안 가운데 **1안 '도트'**: 한글 **갈무리11(Galmuri11)** + 큰 영문 제목 **Jacquard 12**. 쓰는 법·크기·까닭은 `docs/ui/pixel_font_2026-10-14.md`.
오프라인 앱(PWA)이라 바깥 글꼴 서버(CDN)를 부르지 않고 이 폴더의 파일을 직접 싣는다. **파일은 받은 그대로**다(글자 덜어 내기·이름 바꾸기 없음 — 고치면 OFL 의 '고친 판'이 된다). 바이트·해시는 `provenance.json`.

| 파일 | 글꼴 | 받은 곳 | 바이트 | SHA-256 |
|---|---|---|---|---|
| `Galmuri11.woff2` | Galmuri11 Regular (판 2.403) | npm `galmuri@2.40.3` `dist/Galmuri11.woff2` — https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/Galmuri11.woff2 | 504 736 | `f467d1b10e6b88dfa8399c9f93b38c7643e050abfe4fc15800ac0b000f5a57d6` |
| `Galmuri11-Bold.woff2` | Galmuri11 Bold (판 2.403) | 같은 꾸러미 `dist/Galmuri11-Bold.woff2` | 166 632 | `8643094f395aa2dbad6bc4385cc043314801eaec2e759d549435ec8ac4f2d078` |
| `Jacquard12-latin.woff2` | Jacquard 12 Regular (판 1.002) — 구글 폰트의 라틴 조각 | https://fonts.gstatic.com/s/jacquard12/v8/vm8ydRLuXETEweL79J4rGf3OWHs.woff2 | 18 440 | `41e240a6612fc41979467e614efb14ae2647a7cfb988cee032fdfcc3cd63cac5` |
| `Jacquard12-latin-ext.woff2` | Jacquard 12 Regular (판 1.002) — 구글 폰트의 라틴 확장 조각 | https://fonts.gstatic.com/s/jacquard12/v8/vm8ydRLuXETEweL79J4rGf3AWHvH4Q.woff2 | 15 256 | `cda4fb90300fed4cb8154e8a20141f49b1dd2bd4ae166ea8add194d8115966b5` |

- 받은 때: 2026-10-13 19:12 UTC (한국 시간 10/14 04:12). 받은 뒤 `file` 로 WOFF2 임을 확인했다. 갈무리 두 파일의 해시는 jsDelivr 꾸러미 목록(`data.jsdelivr.com/v1/packages/npm/galmuri@2.40.3`)이 적은 해시와 같다.
- **갈무리**: 만든 이 이민서(quiple) · Copyright © 2019–2025 Lee Minseo (quiple@quiple.dev) · **SIL Open Font License 1.1** — 원문 `Galmuri-OFL.md`(꾸러미의 `ofl.md` 그대로) · 저장소 https://github.com/quiple/galmuri
- **Jacquard 12**: 만든 이 Sarah Cadigan-Fried · Copyright 2023 The Soft Type Project Authors (https://github.com/scfried/soft-type-jacquard) · **SIL Open Font License 1.1** — 원문 `Jacquard12-OFL.txt`(구글 폰트 저장소 `ofl/jacquard12/OFL.txt` 그대로)
- 두 글꼴 모두 예약 글꼴 이름(Reserved Font Name)이 없다. OFL 은 글꼴만 따로 파는 것을 빼고 쓰기·싣기·다시 나누기를 허락한다 — 다시 나눌 때 저작권 줄과 라이선스 원문을 함께 둔다(이 폴더).
- 도트 격자(글꼴 파일에서 잼 — 윤곽 좌표가 모두 한 도트 단위의 배수): 갈무리11 = em 12 도트(대문자 11 도트) → **12·24·36 px** 에서 도트 하나가 정수 px. Jacquard 12 = em 21 도트(대문자 12 도트) → **21·42·63 px**.
- 원작자들이 이 게임을 보증하지 않는다.
