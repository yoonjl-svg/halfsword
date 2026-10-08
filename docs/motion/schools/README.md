# 유파 원전 읽기·검산·초안 (2026-10-08 밤, 사장님 제공 PDF 10 종에서)

- 원전 PDF 는 저장소 밖(디렉터 세션 scratchpad/sources)에 두고, 여기에는 **우리가 뽑은 표·검산·초안**만 둔다(짧은 인용 + 책·쪽 번호). 출처 목록은 `docs/motion/sources.md` §10/8.
- 읽기(3 등급, 5 표): `choseon_sebeop.md`(《무비지》 국역 조선세법 24 세·검결가) · `kendo_kata.md`(日本剣道形 해설서: 다섯 자세·太刀 7 본·小太刀 3 본·용어) · `gorin_no_sho.md`(오륜서 五方の構え·水の巻·二刀) · `muyedobotongji_vol2.md`(권2 쌍수도·예도·왜검 4 유파·교전) · `muyedobotongji_vol3.md`(권3 제독검·본국검·쌍검).
- 검산(2 등급): `verification.md` — 70 건 중 맞음 37 · 고침 27 · 못 확인 6. 큰 고침: 쌍수도는 17 이 아니라 **15 勢**, 본국검 총보에 右鑽擊 있음, 제독검 맺음말 뜻, 검도형 1 본 주체(打太刀), 「惟運光流中間失其傳」= 운광류만 끊김, 愛洲移香은 陰流. 국역본의 깨진 글자(撩掠·銀蟒·掀擊·虎蹲·橫衝·掣步)는 권2 쪽 그림으로 풀림.
- 초안(2 등급): `school_japanese_draft.md`(14 자리 중 원전 근거 10 — 上段·八相·中段·右脇·脇構え·下段·左脇 강함 7, 晴眼·右下藏·左藏 해석 3) · `school_chinese_draft.md`(14 자리 중 13 — 조선세법 12 + 中平 1, 자리 배정은 해석). 둘 다 칼끝 각·몸 돌림은 '그대로' 권고(이미 측정된 값; 자리 값을 바꾸면 승률이 떨어진 기록).
- 상태: ~~구현 전~~ → 10/9 자료·스위치로 구현(아래 줄) (설계서 `docs/strike/sword_art_layers_design_2026-10-08.md` ②③ 단계). 값은 모두 '사장님 확인 전'. 신뢰도 중상 — 틀림은 세는 일·작은 글자·해석 문장에 몰림.
- 구현 (10/9 00:3x, 2 등급 — `docs/strike/school_impl_2026-10-09.md`): 두 초안을 `src/schools.js` TRADITIONS 일본·중국에 자료로 넣음 — 자세 이름 14 자리는 늘 켬(HUD 만), 기술 가중치·쉴 자세·중국 맞받아치기는 스위치 `SKILL.schoolArt`(기본 0 = 오늘 판 바이트 그대로), 새 기술 다섯(燕返し·表5·小手·yaoji·zuoyi)은 `ai:false` 자료만. 값·안 A/B 선택은 모두 사장님 확인 전(확인표 195~202).
- 고유 동작 (10/9 02:0x, 2 등급 — `docs/strike/school_unique_2026-10-09.md`): 사장님 '새 베기 길을 열어야 유파의 의미' → 공용 동작(TECH 12 + talhoReves·wristCut·molinello)은 유파 말 이름만(`techNames`), 유파마다 고유 동작 셋(`unique`, 옛 newTech) — 독일 Krumphau·Schielhau·Duplieren(**ai 끔, 사장님 확인 전**) · 이탈리아 imbroccata·passata sotto·cavazione · 이베리아 redondo·altibaixo·바퀴로 받기 · 일본 燕返し·小手·跨虎 연타(表5 는 spare) · 중국 yaoji·zuoyi·斂翅. 수는 모두 [추정], 사장님 확인 전
