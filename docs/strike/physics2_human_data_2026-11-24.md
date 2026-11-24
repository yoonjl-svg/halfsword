# Human biomechanics reference values for a physics-based sword-fighting simulation

Compiled 2026-11-24 from web-accessible literature. Target population: adult male, young and strong/trained where the literature distinguishes.

No number in this file was invented. Every row names its source and how deeply that source was read. Where no citable value was found the row says **not found**, and the gaps are collected at the end.

## Read-depth legend

| Code | Meaning |
|---|---|
| **FT-pdf** | Full text obtained as PDF; I read the extracted text and tables myself. |
| **FT-web** | Full-text page (mostly PubMed Central) read through a page-fetch tool that returns extracted values; numbers were transcribed by the tool and not re-checked against the PDF. |
| **ABS** | PubMed abstract only (retrieved verbatim through NCBI E-utilities). |
| **SEC** | Secondary citation: the value is reported by another paper/review that I read; the primary paper was not opened. |
| **SNIP** | Only a search-engine excerpt of the abstract/page was seen. Lowest confidence; verify before citing. |
| **DER** | Derived by me from sourced values (the arithmetic is shown). Not a measurement. |

Units: torque in N·m, force in N, energy in J, speed in m/s, angular velocity in deg/s unless stated. Values are mean ± SD unless stated.

---

## A. Maximal voluntary joint torques

### A1–A3. Hip, knee, ankle

| Quantity | Value (mean ± SD or range) | Population / conditions | Source | Read depth |
|---|---|---|---|---|
| Hip extension, isometric peak | 0.161 ± 0.049 × (body weight × height) → **≈ 201 ± 61 N·m** | 7 healthy active men, 19.6 ± 1.1 y, 72.8 ± 7.2 kg, 1.748 ± 0.052 m; Biodex; model parameter C1 (peak of torque–angle curve). Conversion uses BW×H = 72.8 × 9.81 × 1.748 = 1248 N·m | Anderson DE, Madigan ML, Nussbaum MA (2007). Maximum voluntary joint torque as a function of joint angle and angular velocity: model development and application to the lower limb. J Biomech 40(14):3105–3113. https://pmc.ncbi.nlm.nih.gov/articles/PMC6820133/ | FT-web (normalised values); DER (N·m) |
| Hip flexion, isometric peak | 0.113 ± 0.025 × BW×H → **≈ 141 ± 31 N·m** | same | Anderson et al. 2007 | FT-web; DER |
| Knee extension, isometric peak | 0.163 ± 0.040 × BW×H → **≈ 203 ± 50 N·m** | same | Anderson et al. 2007 | FT-web; DER |
| Knee flexion, isometric peak | 0.087 ± 0.015 × BW×H → **≈ 109 ± 19 N·m** | same | Anderson et al. 2007 | FT-web; DER |
| Ankle plantarflexion, isometric peak | 0.095 ± 0.022 × BW×H → **≈ 119 ± 27 N·m** | same | Anderson et al. 2007 | FT-web; DER |
| Ankle dorsiflexion, isometric peak | 0.033 ± 0.005 × BW×H → **≈ 41 ± 6 N·m** | same | Anderson et al. 2007 | FT-web; DER |
| Angular velocity at which concentric torque falls to 75 % / 50 % of isometric (model C4 / C5, rad/s) | hip ext 1.58 / 3.19; hip flex 2.10 / 4.27; knee ext 1.52 / 3.95; knee flex 2.01 / 5.23; plantarflexion 0.99 / 3.56; dorsiflexion 0.70 / 1.94 | same 7 young men; fitted from isokinetic tests at 60–150 deg/s plus a 500 deg/s "as fast as possible" trial | Anderson et al. 2007, Table 3 | FT-web |
| Angle of peak isometric torque (model C3, rad; flexion positive) | hip ext 0.93; hip flex −0.21; knee ext 1.13; knee flex 0.52; plantarflexion 0.41; dorsiflexion −0.19 | same | Anderson et al. 2007, Table 3 | FT-web |
| Eccentric enhancement (model C6, dimensionless) | hip ext 0.24; hip flex 0.22; knee ext 0.10; knee flex 0.30; plantarflexion 0.30; dorsiflexion 0.83 | same; eccentric tested at 60–75 deg/s only | Anderson et al. 2007, Table 3 | FT-web |
| Knee extension, isometric | 265 ± 73 (age < 30); 294 ± 39 (30–39); all men 246.6 ± 56.3 (n = 80) | Healthy **non-athletic** Danish men (93 men, 15–83 y); < 30 group: 24 ± 5 y, 179 ± 6 cm, 74 ± 8 kg; Biodex System 3, gravity-corrected | Harbo T, Brincks J, Andersen H (2012). Maximal isokinetic and isometric muscle strength of major muscle groups related to age, body mass, height, and sex in 178 healthy subjects. Eur J Appl Physiol 112:267–275. doi:10.1007/s00421-011-1975-3 | FT-pdf |
| Knee extension, isokinetic 90 deg/s | 215 ± 41 (< 30); 212 ± 22 (30–39) | same | Harbo et al. 2012, Table 5 | FT-pdf |
| Knee flexion, isokinetic 90 deg/s | 106 ± 30 (< 30); 96 ± 18 (30–39) | same | Harbo et al. 2012 | FT-pdf |
| Hip flexion, isometric | 167 ± 37 (< 30); 170 ± 18 (30–39) | same | Harbo et al. 2012 | FT-pdf |
| Hip flexion, isokinetic 60 deg/s | 154 ± 39 (< 30) | same | Harbo et al. 2012 | FT-pdf |
| Hip extension, isokinetic 60 deg/s | 197 ± 58 (< 30); 202 ± 35 (30–39) | same | Harbo et al. 2012 | FT-pdf |
| Ankle plantarflexion ("ankle flexion"), isokinetic 60 deg/s | 128 ± 24 (< 30); 118 ± 22 (30–39) | same | Harbo et al. 2012 | FT-pdf |
| Ankle dorsiflexion ("ankle extension") | isometric 44 ± 11; isokinetic 60 deg/s 35 ± 6 (< 30) | same; the paper's "ankle extension" is read as dorsiflexion from its magnitude | Harbo et al. 2012 | FT-pdf |
| Hip extension / hip flexion / plantarflexion, isometric, per kg | 4.51 ± 0.94 / 2.67 ± 0.51 / 2.64 ± 0.59 N·m/kg | 10 young adults (5 M, 5 F), 23.9 ± 3.3 y, 61.7 ± 7.3 kg | Anderson DE, Madigan ML (2014). Healthy older adults have insufficient hip range of motion and plantar flexor strength to walk like healthy young adults. J Biomech 47(5):1104–1109. https://pmc.ncbi.nlm.nih.gov/articles/PMC3975833/ | FT-web |
| Hip abduction, isometric | 95 ± 21 (custom rig, supine) to 117 ± 22 (Biodex, side-lying) | 20 recreationally active adults, **50 % female**, 26.0 ± 2.5 y, 69.9 ± 14.0 kg; hip 15° abducted | Goncalves BAM, Saxby DJ, Kositsky A, Barrett RS, Diamond LE (2021). Reliability of hip muscle strength measured in principal and intermediate planes of movement. PeerJ 9:e11521. https://pmc.ncbi.nlm.nih.gov/articles/PMC8179216/ | FT-web |
| Hip adduction, isometric | 90 ± 24 (Biodex) to 124 ± 29 (rig) | same mixed-sex sample | Goncalves et al. 2021 | FT-web |
| Hip internal rotation, isometric | 65 ± 19 to 68 ± 20 | same; seated, hip and knee 90° | Goncalves et al. 2021 | FT-web |
| Hip external rotation, isometric | 48 ± 11 to 50 ± 13 | same | Goncalves et al. 2021 | FT-web |
| Hip flexion / extension, isometric (same study, for cross-check) | flexion 87 ± 17 to 97 ± 22; extension 152 ± 27 (Biodex) to 226 ± 54 (rig) | same | Goncalves et al. 2021 | FT-web |
| Ankle inversion, isokinetic (speed not stated in abstract) | 37.0 ± 11.6 (men) | 69 men / 31 women, healthy physically active non-athletes, 38.5 ± 13.5 y; Biodex 3 (abstract prints the unit as "N/m") | da Fonseca LF et al. (2025). Normative values of ankle strength and its importance for rehabilitation and return to activity: a cross-sectional study. World J Orthop 16(10):108858. doi:10.5312/wjo.v16.i10.108858 | ABS |
| Ankle eversion, isokinetic | 33.4 ± 9.9 (men) | same | da Fonseca et al. 2025 | ABS |
| Ankle dorsiflexion / plantarflexion, isokinetic (same study) | 53.6 ± 13.0 / 158.1 ± 33.4 (men) | same | da Fonseca et al. 2025 | ABS |
| Knee extension vs speed (see caveat) | isometric 212 ± 81 at 75° flexion; 158 at 60 deg/s; 135 at 120; 116 at 180; 101 at 240; 89 at 300 deg/s | 27 men, 24.2 ± 5.1 y, 180.1 ± 6.3 cm, 81.5 ± 9.2 kg; Biodex. **Caveat:** in the page text the captions of the knee flexion and extension tables appear swapped and male rows were identified by shading; I assigned this table to knee extension from its torque–angle shape | Frey-Law LA, Laake A, Avin KG, Heitsman J, Marler T, Abdel-Malek K (2012). Knee and elbow 3D strength surfaces: peak torque–angle–velocity relationships. J Appl Biomech 28(6):726–737. https://pmc.ncbi.nlm.nih.gov/articles/PMC7050840/ | FT-web (assignment uncertain) |

### A4. Trunk

| Quantity | Value | Population / conditions | Source | Read depth |
|---|---|---|---|---|
| Trunk (lumbar) extension, isometric | 235.8 ± 85.2 (full extension) rising linearly to 464.9 ± 150.7 (72° lumbar flexion) | 56 men, 29.4 ± 10.7 y; isometric lumbar extension tested at 7 angles from 0 to 72° of lumbar flexion (device not named in the abstract) | Graves JE, Pollock ML, Carpenter DM, Leggett SH, Jones A, MacMillan M, Fulton M (1990). Quantitative assessment of full range-of-motion isometric lumbar extension strength. Spine 15(4):289–294. doi:10.1097/00007632-199004000-00008 | ABS |
| Trunk extension, isokinetic concentric, seated | athletes 440 ± 66 (60 deg/s), 434 ± 55 (90), 345 ± 125 (120); non-athletes 373 ± 68, 365 ± 82, 344 ± 71 | 18 high-level male boxers/wrestlers/weightlifters vs 15 recreationally active men; Biodex 3 | Ben Moussa Zouita A, Ben Salah FZ, Dziri C, Beardsley C (2018). Comparison of isokinetic trunk flexion and extension torques and powers between athletes and nonathletes. J Exerc Rehabil 14(1):72–77. https://pmc.ncbi.nlm.nih.gov/articles/PMC5833971/ | FT-web |
| Trunk flexion, isokinetic concentric, seated | athletes 297 ± 50 (60 deg/s), 262 ± 51 (90), 212 ± 69 (120); non-athletes 249 ± 50, 261 ± 56, 190 ± 42 | same | Zouita et al. 2018 | FT-web |
| Trunk extension / flexion, pooled literature for untrained adults | extension mean 208 (range 121–360); flexion mean 176 (range 111–296); flexion/extension 0.84 | pooled "several studies", mixed protocols | cited in the introduction of Zouita et al. 2018 (attributed there to Thompson et al. 1985) | SEC |
| Trunk axial rotation, isometric, neutral | **97 N·m** (men); 60 N·m (women) | 10 men, 21 women; maximal isometric twist at 0° twist | McGill SM, Hoodless K (1990). Measured and modelled static and dynamic axial trunk torsion during twisting in males and females. J Biomed Eng 12(5):403–409. doi:10.1016/0141-5425(90)90024-h | ABS |
| Trunk axial rotation, isometric, pre-rotated 30° and twisting back toward neutral | ≈ 105 N·m (men); ≈ 68 N·m (women) | same | McGill & Hoodless 1990 | ABS |
| Trunk axial rotation, isometric (second sample) | 91 N·m measured (example value) | 10 men, 15 women | McGill SM (1991). Electromyographic activity of the abdominal and low back musculature during the generation of isometric and dynamic axial trunk torque. J Orthop Res 9(1):91–103. doi:10.1002/jor.1100090112 | ABS |
| Axial rotation, effect of speed | isokinetic torque drops 1–1.5 N·m per deg/s between 10 and 40 deg/s; isometric > isokinetic | 27 men, 23 women, seated | Kumar S, Narayan Y, Garand D (2003). An electromyographic study of isokinetic axial rotation in young adults. Spine J 3(1):46–54. doi:10.1016/s1529-9430(02)00447-3 | ABS |
| Axial rotation, effect of pre-rotation | 20–25 % weaker when twisting further into the pre-rotation; ≈ 30 % stronger twisting back | 50 young adults | Kumar S (1997). Axial rotation strength in seated neutral and prerotated postures of young adults. Spine 22(19):2213–2221 | ABS |
| Trunk lateral bending, isometric (N·m) | **not found** as an absolute torque. Qualitative: lateral flexion significantly stronger than axial rotation; isokinetic 60–70 % of isometric; women 60–70 % of men | 41 men, 32 women | Kumar S, Dufresne RM, Van Schoor T (1995). Human trunk strength profile in lateral flexion and axial rotation. Spine 20(2):169–177 | ABS |
| Isokinetic vs isometric trunk flexion/extension | isokinetic = 60–70 % of isometric; average = 70–80 % of peak | 41 men, 32 women | Kumar S, Dufresne RM, Van Schoor T (1995). Human trunk strength profile in flexion and extension. Spine 20(2):160–168 | ABS |

### A5. Shoulder

| Quantity | Value | Population / conditions | Source | Read depth |
|---|---|---|---|---|
| Shoulder abduction, isometric | 60 ± 14 (< 30 y); 70 ± 9 (30–39); all men 61.1 ± 14.1 (n = 79) | non-athletic Danish men; Biodex, neutral position | Harbo et al. 2012 | FT-pdf |
| Shoulder abduction, isokinetic 60 deg/s | 57 ± 12 (< 30); 67 ± 10 (30–39) | same | Harbo et al. 2012 | FT-pdf |
| Shoulder adduction, isokinetic 60 deg/s | 77 ± 14 (< 30); 92 ± 16 (30–39); all men 83.1 ± 17.7 | same | Harbo et al. 2012 | FT-pdf |
| Shoulder adduction, isometric | 67.9 ± 28.4 | 10 young healthy adults of **both sexes** (20th-percentile female to 97th-percentile male) | Holzbaur KRS, Delp SL, Gold GE, Murray WM (2007). Moment-generating capacity of upper limb muscles in healthy adults. J Biomech 40(11):2442–2449. doi:10.1016/j.jbiomech.2006.11.013 | ABS |
| Shoulder internal rotation, isometric (hand-held dynamometer at the wrist) | force = 0.27 ± 0.06 × body weight → ≈ 199 N → **≈ 52 N·m** if the lever arm is 0.26 m | 546 physically active college men, 18.8 ± 1.0 y, 75.3 ± 12.2 kg; lever arm not reported, 0.26 m forearm length is my assumption | Westrick RB, Duffey ML, Cameron KL, Gerber JP, Owens BD (2013). Isometric shoulder strength reference values for physically active collegiate males and females. Sports Health 5(1):17–21. https://pmc.ncbi.nlm.nih.gov/articles/PMC3548662/ | FT-web (ratio); DER (N·m, assumed lever) |
| Shoulder external rotation, isometric | force = 0.20 ± 0.04 × body weight → ≈ 148 N → **≈ 38 N·m** with the same assumed lever | same | Westrick et al. 2013 | FT-web; DER |
| Shoulder abduction, isometric (dynamometer just proximal to elbow) | force = 0.35 ± 0.08 × body weight → ≈ 259 N (≈ 75 N·m with an assumed 0.29 m lever; compare 60–70 N·m in Harbo) | same | Westrick et al. 2013 | FT-web; DER |
| Shoulder flexion, extension, horizontal adduction (absolute N·m) | **not found**. Rank order of shoulder strength: extension > adduction > flexion > abduction > internal rotation > external rotation. Ratios: extension:flexion 5:4, internal:external rotation 3:2, adduction:abduction 2:1 | order: 26 men 21–40 y, Cybex II at 0/60/180/300 deg/s, and 15 non-athletic men at 60–180 deg/s; ratios: 31 volunteers | Cahalan TD, Johnson ME, Chao EY (1991). Clin Orthop 271:249–257; Shklar A, Dvir Z (1995). Clin Biomech 10(7):369–373; Ivey FM et al. (1985). Arch Phys Med Rehabil 66(6):384–386. Absolute tables exist in Otis JC et al. (1990) Am J Sports Med 18(2):119–123 and Hughes RE et al. (1999) Am J Sports Med 27(5):651–657, not accessible | ABS |

### A6–A7. Elbow, forearm, wrist

| Quantity | Value | Population / conditions | Source | Read depth |
|---|---|---|---|---|
| Elbow flexion, isometric | 63.0 ± 12.9 at 65° (56.4–63.0 over 15–110°) | 30 men, 24.2 ± 5.1 y, 81.5 ± 9.2 kg; Biodex 3 (units not printed on the page; male rows identified by magnitude) | Frey-Law et al. 2012 | FT-web |
| Elbow flexion vs speed | 44.7 at 60 deg/s; 38.7 at 120; 33.9 at 180; 30.0 at 240; 25.7 at 300 deg/s (best angle) | same | Frey-Law et al. 2012 | FT-web |
| Elbow extension, isometric | 52.8 ± 13.6 at 65° (40.2–52.8 over 15–110°) | same | Frey-Law et al. 2012 | FT-web |
| Elbow extension vs speed | 39.6 at 60 deg/s; 35.6 at 120; 33.0 at 180; 28.5 at 240; 26.7 at 300 deg/s | same | Frey-Law et al. 2012 | FT-web |
| Elbow flexion, isometric | 50 ± 18 (< 30); 51 ± 11 (30–39); all men 50.9 ± 13.6 | non-athletic Danish men | Harbo et al. 2012 | FT-pdf |
| Elbow flexion / extension, isokinetic 60 deg/s | flexion 52 ± 14; extension 43 ± 11 (< 30); extension 52 ± 9 (30–39) | same | Harbo et al. 2012 | FT-pdf |
| Elbow flexion / extension, literature peak used to validate the Stanford upper-limb model | flexion ≈ 77; extension ≈ 52 | experimental values of Amis et al. 1980 and Buchanan et al. 1998 as quoted | Holzbaur KRS, Murray WM, Delp SL (2005). A model of the upper extremity for simulating musculoskeletal surgery and analyzing neuromuscular control. Ann Biomed Eng 33(6):829–840. doi:10.1007/s10439-005-3320-7 | FT-pdf (SEC for the primary values) |
| Elbow strength ratios | extension = 61 % of flexion; pronation = 86 % of supination; men ≈ 2 × women; dominant side 6 % stronger | 104 normal subjects, mean 43 y | Askew LJ, An KN, Morrey BF, Chao EY (1987). Isometric elbow strength in normal individuals. Clin Orthop 222:261–266 | ABS |
| Forearm supination, isometric | mean maximum 16.2 (forearm 75 % prone) | 24 men; 4 elbow × 3 forearm angles | O'Sullivan LW, Gallwey TJ (2002). Upper-limb surface electro-myography at maximum supination and pronation torques: the effect of elbow and forearm angle. J Electromyogr Kinesiol 12(4):275–285. doi:10.1016/s1050-6411(02)00014-7 | ABS |
| Forearm pronation, isometric | mean maximum 13.1 (neutral forearm, elbow 45°) | same | O'Sullivan & Gallwey 2002 | ABS |
| Forearm pronation, isometric (supinated start position) | 11.9 ± 3.7 right, 10.4 ± 3.3 left (men) | 51 right-handed adults 22–45 y; custom torque cell with grip | Matsuoka J, Berger RA, Berglund LJ, An KN (2006). An analysis of symmetry of torque strength of the forearm under resisted forearm rotation in normal subjects. J Hand Surg Am 31(5):801–805. doi:10.1016/j.jhsa.2006.02.019 | ABS |
| Wrist flexion, isometric | 12.2 ± 3.7 (range 5.2–18.7); peaks at 40° flexion | 10 healthy adult men; shoulder abducted 90°, elbow 90° | Delp SL, Grierson AE, Buchanan TS (1996). Maximum isometric moments generated by the wrist muscles in flexion-extension and radial-ulnar deviation. J Biomech 29(10):1371–1375. doi:10.1016/0021-9290(96)00029-2 | ABS |
| Wrist extension, isometric | 7.1 ± 2.1 (range 3.4–9.4) | same | Delp et al. 1996 | ABS |
| Wrist radial deviation, isometric | 11.0 ± 2.0 (range 7.9–15.3) | same | Delp et al. 1996 | ABS |
| Wrist ulnar deviation, isometric | 9.5 ± 2.2 (range 5.9–11.9) | same | Delp et al. 1996 | ABS |
| Wrist flexion (different rig) | isometric 25 ± 6; isokinetic 90 deg/s 21 ± 5 (< 30 y); all men isometric 24.7 ± 7.5 | non-athletic Danish men; Biodex. About twice Delp's value: posture and attachment differ | Harbo et al. 2012 | FT-pdf |
| Wrist extension, isokinetic 90 deg/s | 11 ± 3 (< 30) | same | Harbo et al. 2012 | FT-pdf |
| Wrist extension, isometric | 10.2 ± 4.6 | 10 young adults, both sexes | Holzbaur et al. 2007 | ABS |

### A8–A9. Neck and grip

| Quantity | Value | Population / conditions | Source | Read depth |
|---|---|---|---|---|
| Neck extension, isometric | 52 ± 11 (men); 21 ± 12 (women) | 11 men, 5 women, mean 31 y (20–42); moments resolved about the midpoint between C7 spinous process and sternal notch | Vasavada AN, Li S, Delp SL (2001). Three-dimensional isometric strength of neck muscles in humans. Spine 26(17):1904–1909. doi:10.1097/00007632-200109010-00018 | ABS |
| Neck flexion, isometric | 30 ± 5 (men); 15 ± 4 (women) | same | Vasavada et al. 2001 | ABS |
| Neck lateral bending, isometric | 36 ± 8 (men); 16 ± 8 (women) | same | Vasavada et al. 2001 | ABS |
| Neck axial rotation, isometric | 15 ± 4 (men); 6 ± 3 (women) | same | Vasavada et al. 2001 | ABS |
| Grip force | 47 ± 9.5 kgf right, 45 ± 8.8 kgf left at 20–29 y → **≈ 461 ± 93 N** right; 47 ± 9.7 kgf at 30–39 y; 40 kgf at 60–69 y | population-based Australian sample (about 1300 men); Jamar dynamometer, handle position II, seated, elbow 90°, mean of 3 trials | Massy-Westropp NM, Gill TK, Taylor AW, Bohannon RW, Hill CL (2011). Hand grip strength: age and gender stratified normative data in a population-based study. BMC Res Notes 4:127. https://pmc.ncbi.nlm.nih.gov/articles/PMC3101655/ | FT-web; DER (N) |
| Grip, age of peak | highest scores at 25–39 y | 310 men, 328 women, 20–94 y | Mathiowetz V et al. (1985). Grip and pinch strength: normative data for adults. Arch Phys Med Rehabil 66(2):69–74 | ABS |

---

## B. Whole-body movement

### B10. Walking

| Quantity | Value | Population / conditions | Source | Read depth |
|---|---|---|---|---|
| Walking speed, self-selected normal | 1.227 ± 0.111 m/s | 15 men 20–29 y; 5.5 m indoor walkway | Öberg T, Karsznia A, Öberg K (1993). Basic gait parameters: reference data for normal subjects, 10–79 years of age. J Rehabil Res Dev 30(2):210–223 | FT-pdf |
| Walking speed, self-selected fast | 1.626 ± 0.201 m/s (slow: 0.831 ± 0.091) | same | Öberg et al. 1993 | FT-pdf |
| Step length | slow 52.7 ± 3.1 cm; normal 61.6 ± 3.5 cm; fast 71.2 ± 5.7 cm | same | Öberg et al. 1993 | FT-pdf |
| Step frequency (cadence) | slow 1.55 ± 0.13; normal 1.98 ± 0.13; fast 2.34 ± 0.17 steps/s (119 and 140 steps/min for normal and fast) | same | Öberg et al. 1993 | FT-pdf |
| Comfortable walking speed | 1.393 ± 0.153 m/s (men in their 20s); 1.458 ± 0.094 m/s (30s); 1.462 m/s (40s, highest group) | 230 healthy volunteers 20–79 y; timed over 7.62 m | Bohannon RW (1997). Comfortable and maximum walking speed of adults aged 20–79 years: reference values and determinants. Age Ageing 26(1):15–19. doi:10.1093/ageing/26.1.15 | ABS for the 40s value and range; SNIP for the 20s/30s table values |
| Maximum walking speed | 2.533 m/s (men in their 20s, highest group); 2.456 ± 0.315 m/s (30s) | same | Bohannon 1997 | ABS (2.533); SNIP (30s) |
| Comfortable speed, step length, cadence (small young sample) | 1.26 ± 0.10 m/s; 0.70 ± 0.04 m; 108 ± 6 steps/min | 10 young adults (5 M, 5 F) | Anderson & Madigan 2014 | FT-web |
| Sideways walking, preferred speed | **0.575 ± 0.123 m/s**; metabolically optimal 0.610 ± 0.064 m/s; cost per distance more than 3 × forward walking | healthy adults, no practice | Handford ML, Srinivasan M (2014). Sideways walking: preferred is slow, slow is optimal, and optimal is expensive. Biol Lett 10(1):20131006. doi:10.1098/rsbl.2013.1006 | ABS |
| Backward walking | forward comfortable ≈ 1.46 m/s; backward stride length = 78 % (comfortable) and 70 % (fast) of forward, cadence unchanged → backward comfortable **≈ 1.1 m/s** | 30 young adults (15 M, 15 F), 24.0 ± 2.3 y; instrumented walkway. Exact backward speeds are only in a figure | Laufer Y (2005). Effect of age on characteristics of forward and backward gait at preferred and accelerated walking speed. J Gerontol A 60(5):627–632. doi:10.1093/gerona/60.5.627 | FT-pdf (percentages); DER (m/s) |

### B11. Fencing footwork and lunge

Unless marked otherwise, values are as tabulated in the review: Chen TL-W, Wong DW-C, Wang Y, Ren S, Yan F, Zhang M (2017). Biomechanics of fencing sport: a scoping review. PLoS ONE 12(2):e0171578. https://pmc.ncbi.nlm.nih.gov/articles/PMC5302478/ (review read FT-web; primary studies are SEC).

| Quantity | Value | Population / conditions | Source | Read depth |
|---|---|---|---|---|
| Lunge, body centre-of-mass peak velocity (pooled trend) | 1.92 m/s (foil); 1.72 m/s (épée) | pooled across nine studies of the simple lunge | Chen et al. 2017 | FT-web (pooled) |
| Lunge velocity | 3.35 ± 0.70 m/s | fencers, lunge test | Turner et al. 2016, in Chen et al. 2017 | SEC |
| Lunge, maximal horizontal hip velocity | 2.28–2.33 m/s | 4 fencers | Hassan & Klauck 1998, in Chen et al. 2017 | SEC |
| Fencer velocity during a real sabre bout (hip marker) | mean 1.97 m/s (range 1.38–2.22); lunge length mean 1.24 m (0.88–1.86); hip peak acceleration 8.57 m/s² | 1 internationally ranked sabre fencer, 6 lunges with preceding footwork, 120 Hz 2D video | Schiffman J, Zebas C (1997). Kinematic analysis of an elite level fencer. Proc 15th Int Symp Biomechanics in Sports. https://ojs.ub.uni-konstanz.de/cpa/article/view/3742 | FT-web (proceedings abstract) |
| Advance-lunge (marché-fente): peak velocity, force, power | peak velocity 2.6 ± 0.9 m/s; peak horizontal force 469.6 ± 77.4 N; peak power 1051.8 ± 231.5 W; peak acceleration 6.5 ± 0.9 m/s² | 10 elite **female** sabre fencers on a 6.6 m force-platform track (leg not separated) | Guilhem G, Giroux C, Couturier A, Chollet D, Rabita G (2014). Mechanical and muscular coordination patterns during a high-level fencing assault. Med Sci Sports Exerc 46(2):341–350 (numbers via Chen et al. 2017) | ABS for design; SEC for numbers |
| Rear-leg push force, isolated | **not found** as a separate rear-leg ground reaction force. Related: rear hip/knee extensor strength correlates with maximal forward velocity (r = 0.60–0.81) | same elite female sabre fencers | Guilhem et al. 2014 | ABS |
| Weapon (foil) peak horizontal velocity in lunge | 3.40–3.91 m/s; 2.96–3.56 m/s at the hit | 4 fencers | Hassan & Klauck 1998, in Chen et al. 2017 | SEC |
| Weapon peak velocity in lunge | 3.21 ± 0.22 m/s (expert) vs 2.63 ± 0.29 m/s (non-elite); pooled 2.91 m/s foil, 2.49 m/s épée | foil lunge | Mulloy et al. 2015, in Chen et al. 2017 | SEC |
| Weapon velocity in lunge with target change | 2.55 ± 0.42 m/s (elite) vs 1.88 ± 0.48 m/s (medium level) | lunge | Gutiérrez-Dávila et al. 2013, in Chen et al. 2017 | SEC |
| Épée velocity at touch | 12.8 ± 3.3 m/s — **inconsistent with every other study (2–4 m/s); possibly tip speed or a unit problem; do not use without checking the paper** | 14 club épée fencers, 3D motion capture | Bottoms L, Greenhalgh A, Sinclair J (2013). Acta Bioeng Biomech 15(4):109–113, in Chen et al. 2017 | SEC (abstract read, gives no number) |
| Front-foot peak velocity in lunge | 4.56 ± 0.75 m/s (elite) vs 3.59 ± 0.30 m/s (medium); pooled 4.56 foil, 4.10 épée | lunge | Gutiérrez-Dávila et al. 2013, in Chen et al. 2017 | SEC |
| Lunge length | 1.40 ± 0.15 m (elite) vs 1.13 ± 0.13 m; 1.17 ± 0.17 m vs 1.02 ± 0.10 m; 1.12 ± 0.07 leg lengths (expert) | lunge | Gutiérrez-Dávila 2013; Gholipour 2008; Mulloy 2015, in Chen et al. 2017 | SEC |
| Lunge timing | total response time 808 ± 53 ms (elite) vs 934 ± 34 ms (novice), of which reaction time 333 ± 128 ms vs 613 ± 62 ms | lunge to a stimulus | Williams & Walmsley 2000, in Chen et al. 2017 | SEC |
| Foot contact times | leading heel in lunge 705 ± 167 ms; leading hallux in retreat 205 ± 43 ms; trailing forefoot 192–682 ms (advance, retreat, lunge) | plantar-pressure study | Trautmann et al. 2011, in Chen et al. 2017 | SEC |
| Sabre exchange duration | action 2.5 ± 0.6 s; break 16.5 ± 2.7 s | sabre bouts | Aquili et al. 2013, in Chen et al. 2017 | SEC |
| Advance / retreat step speed | **not found** (not reported in the review; nearest values are the lunge and bout velocities above) | — | — | — |
| Kendo forward strike, for comparison | men-strike time (lamp on → hit, from 2.30 m) 1.031 ± 0.105 s (range 0.80–1.17) | 20 university kendo players, 13.2 ± 1.7 y experience | Murase N, Horiuchi G, Sumi K, Horiyama K, Sakurai S (2017). Biomechanical factors to shorten the movement time of men striking motion in kendo. Int J Sport Health Sci 15:36–45. doi:10.5432/ijshs.201611 | FT-pdf |
| Kendo strike time from movement onset to impact | men 0.818 ± 0.085 s; kote 0.745 ± 0.101 s | 19 trained collegiate kendo athletes; onset = centre-of-mass speed ≥ 0.15 m/s | Murase N (2026). Lower limb mechanics in kendo men and kote strikes. Sports Biomech 25(8):1257–1268. doi:10.1080/14763141.2026.2632112 | ABS |

### B12. Standing balance and compensatory stepping

| Quantity | Value | Population / conditions | Source | Read depth |
|---|---|---|---|---|
| Stability condition (model) | Extrapolated centre of mass XcoM = x + v / ω0, with ω0 = √(g / l), must stay inside the base of support | inverted-pendulum theory with example data | Hof AL, Gazendam MGJ, Sinke WE (2005). The condition for dynamic stability. J Biomech 38(1):1–8. doi:10.1016/j.jbiomech.2004.03.025 | ABS |
| Effective base of support after an unexpected push | only about **30 %** of the static base-of-support area, because the centre of pressure needs time to move | humans standing on two feet, sudden perturbations | Hof AL, Curtze C (2016). A stricter condition for standing balance after unexpected perturbations. J Biomech 49(4):580–585. doi:10.1016/j.jbiomech.2016.01.021 | ABS |
| Push withstood **without stepping**, measured | impulses of 2–10 N·s (forces 20–100 N) to the back at inter-scapular level; the range was chosen "small enough to exclude a step response". Centre-of-pressure shift 0.93 cm per N·s (range 0.72–1.15), governed by impulse, not peak force | 14 young adults (7 M, 70.3 ± 6.0 kg; 7 F, 54.0 ± 4.2 kg), barefoot, feet at pelvis width | Paterna M, Dvir Z, De Benedictis C, Maffiodo D, Franco W, Ferraresi C, Roatta S (2022). Center of pressure displacement due to graded controlled perturbations to the trunk in standing subjects: the force–impulse paradigm. Eur J Appl Physiol. doi:10.1007/s00421-021-04844-9 (volume and pages not seen) | FT-pdf (author manuscript) |
| Push withstood without stepping, model estimate | J ≈ m · ω0 · d. Example: m = 80 kg, l = 1.0 m (ω0 = 3.13 s⁻¹), d = 0.15 m from centre-of-mass projection to the toe edge → 38 N·s ideal; ≈ 11 N·s if only 30 % of the margin is usable | my calculation from Hof 2005 and Hof & Curtze 2016; consistent with the ≤ 10 N·s no-step range above | — | DER |
| Step-trigger threshold in position terms | young adults: always step once the pull moves the body past 107 % of base-of-support length (slow pulls); never step behind 72 % (fast pulls); transition at 121 % BoS/s. Young stepped in 40 % of trials, older adults in 69 % | forward waist pulls, displacement–velocity controlled | Mille M-L, Rogers MW, Martinez K, Hedman LD, Johnson ME, Lord SR, Fitzpatrick RC (2003). Thresholds for inducing protective stepping responses to external perturbations of human standing. J Neurophysiol 90(2):666–674. doi:10.1152/jn.00974.2002 | ABS |
| Small waist pulls | 1–5 % body weight; at 4–5 % BW older women needed 0.5 more steps than young women | 13 healthy young women (23 y) and two older groups | Schulz BW, Ashton-Miller JA, Alexander NB (2005). Compensatory stepping in response to waist pulls in balance-impaired and unimpaired women. Gait Posture 22(3):198–209 | ABS |
| Largest forward lean recoverable **with one step** | 32.5° (young men); 23.9° (older men) | 10 young men (24.3 y), released from a tethered forward lean | Thelen DG, Wojcik LA, Schultz AB, Ashton-Miller JA, Alexander NB (1997). Age differences in using a rapid step to regain balance during a forward fall. J Gerontol A 52(1):M8–M13 | ABS |
| Same, young women | 30.7° | 10 young women (25.0 y) | Wojcik LA, Thelen DG, Schultz AB, Ashton-Miller JA, Alexander NB (1999). Age and gender differences in single-step recovery from a forward fall. J Gerontol A 54(1):M44–M50 | ABS |
| Same, with step timing | max lean 27.3 ± 4.7°; reaction time 80 ± 1 ms; weight-transfer time 153 ± 25 ms; step time 196 ± 24 ms; step length 0.98 ± 0.11 m; step velocity 5.05 ± 0.58 m/s | 6 young adults (3 M, 3 F), 24.5 ± 4.2 y, 67 ± 8.1 kg | Moglo KE, Smeesters C (2005). The threshold of balance recovery is not affected by the type of postural perturbation. ISB XXth Congress / ASB 29th Annual Meeting, abstract 464. https://media.isbweb.org/images/conf/2005/abstracts/0464.pdf | FT-pdf (conference abstract) |
| Largest sustained forward waist pull recoverable with one step | 488 ± 44 N with a 20.4° initial lean; 577 ± 39 N with 19.7°; while walking at 1.8–2.1 m/s: 466 ± 75, 394 ± 59, 368 ± 55 N | same 6 young adults (pull ≈ 0.6–0.9 body weight) | Moglo & Smeesters 2005 | FT-pdf |
| Single-step recovery boundary (lean angle vs angular velocity) | θ ≈ 31.1° − 0.174 · ω (deg and deg/s; r² = 0.89). Axis assignment inferred from the figure | same; angular position and velocity of the ankle–centre-of-mass line when joint torques start | Moglo & Smeesters 2005 | FT-pdf |
| Push recoverable with one step, as an impulse | **not found** as a measurement. Rough extrapolation of the line above: a 70 N·s push on a 70 kg person gives ≈ 1 m/s (≈ 57 deg/s for a 1 m pendulum), still inside the one-step region (allowed lean ≈ 21°). Low confidence | extrapolated outside the tested range | Moglo & Smeesters 2005 | DER |
| Compensatory step timing, second sample | reaction time 80–82 ms; weight transfer 130–138 ms; first step time 164–192 ms; first step length 0.84–1.03 m; first step velocity 5.1–5.4 m/s; max lean 30.4–33.2° | 6 young adults, lean-release with three recovery restrictions | Cyr M-A, Moglo KE, Smeesters C (2005). Effect of recovery restrictions on the threshold of balance recovery: preliminary results. ISB XXth Congress, abstract 401. https://media.isbweb.org/images/conf/2005/abstracts/0401.pdf | FT-pdf (conference abstract) |
| Stepping to unpredictable platform translation | subjects stepped in 98 % of trials although free to respond any way; older adults took extra steps in 63 % of trials, about twice as often as young | 5 young (22–28 y) and 9 older adults; 600 ms platform translation | McIlroy WE, Maki BE (1996). Age-related changes in compensatory stepping in response to unpredictable perturbations. J Gerontol A 51(6):M289–M296 | ABS |

### B13. Getting up from the floor

| Quantity | Value | Population / conditions | Source | Read depth |
|---|---|---|---|---|
| Supine-to-stand time, young adults | 2.6 s | 22 young controls, mean 23 y (19–30). The primary abstract describes its samples as women; the review lists 11 of the 22 as female | Ulbrich J, Raheja A, Alexander NB (2000). Body positions used by healthy and frail older adults to rise from the floor. J Am Geriatr Soc 48(12):1626–1632; value via Cattuzzo MT et al. (2020). Assessment in the supine-to-stand task and functional health from youth to old age: a systematic review. Int J Environ Res Public Health 17(16):5794. https://pmc.ncbi.nlm.nih.gov/articles/PMC7460168/ | SEC (review FT-web; primary ABS) |
| Supine-to-stand time, young adults | 3.7 s (older adults 5.7 s) | 14 young adults 19–39 y, inertial sensors | Schwickert et al. 2015, in Cattuzzo et al. 2020 | SEC |
| Supine-to-stand time, typical controls | 2.86 s | 9 controls aged 7–36 y | Belt et al. 2001, in Cattuzzo et al. 2020 | SEC |
| Supine-to-stand time, older adults for scale | 4.1 ± 1.1 s (range 1.8–7.2) | 52 community-living adults 50–90 y | Bohannon & Lusardi 2004, in Cattuzzo et al. 2020 | SEC |
| Kneeling-to-standing time | **not found** | — | — | — |

### B14. Joint moments and ground reaction forces in walking

| Quantity | Value | Population / conditions | Source | Read depth |
|---|---|---|---|---|
| Peak hip extension moment | 0.72 ± 0.19 N·m/kg | 20 young men, 22.8 ± 2.8 y, 64.0 ± 8.3 kg, self-selected 1.26 ± 0.12 m/s; inverse dynamics, 7-link model | Toda H, Nagano A, Luo Z (2015). Age and gender differences in the control of vertical ground reaction force by the hip, knee and ankle joints. J Phys Ther Sci 27(6):1833–1838. https://pmc.ncbi.nlm.nih.gov/articles/PMC4499994/ | FT-web |
| Peak hip flexion moment | 0.71 ± 0.14 N·m/kg | same | Toda et al. 2015 | FT-web |
| Peak knee extension moment (early stance) | 0.71 ± 0.20 N·m/kg | same | Toda et al. 2015 | FT-web |
| Peak ankle plantarflexion moment | 1.30 ± 0.11 N·m/kg | same | Toda et al. 2015 | FT-web |
| Peak ankle plantarflexion moment, fast walking | 1.53 N·m/kg at 1.52 m/s | 10 young adults | Anderson & Madigan 2014 | FT-web |
| Peak sagittal / frontal moments, older adults | hip 1.21 ± 0.21 / 0.87 ± 0.10; knee 0.68 ± 0.18 / 0.46 ± 0.13; ankle 1.05 ± 0.23 / 0.16 ± 0.05 N·m/kg | 52 adults 60–92 y, 1.10 ± 0.20 m/s | Ko S-U, Ling SM, Winters J, Ferrucci L (2009). Age-related mechanical work expenditure during normal walking: the Baltimore Longitudinal Study of Aging. J Biomech 42(12):1834–1839. https://pmc.ncbi.nlm.nih.gov/articles/PMC2725196/ | FT-web |
| Vertical ground reaction force peak, walking | about 1.0 → 1.5 body weights as speed rises from 1.0 to 3.0 m/s | 12 healthy men, force platform | Nilsson J, Thorstensson A (1989). Ground reaction forces at different speeds of human walking and running. Acta Physiol Scand 136(2):217–227. doi:10.1111/j.1748-1716.1989.tb08655.x | ABS |
| Vertical ground reaction force peak, running | about 2.0 → 2.9 body weights (1.5–6.0 m/s) | same | Nilsson & Thorstensson 1989 | ABS |
| Horizontal ground reaction forces | antero-posterior peak about one tenth of the vertical on average; rises about 2 × with speed in walking, 2–4 × in running | same | Nilsson & Thorstensson 1989 | ABS |

---

## C. Striking with implements

### C15. Sword cuts

| Quantity | Value | Method / conditions | Source | Read depth |
|---|---|---|---|---|
| Longsword point speed, mean of per-technique maxima | **11.13 m/s** over 22 principles and master strikes; highest 14.09 ± 1.80 m/s (cross strike attacking the openings); thrust-type techniques 9.05–9.28 m/s | 9 male HEMA fencers (27–47 y; 4 with 1–2 y, 5 with 5–10 y experience), partner training. **Steel longsword 1.9 kg, total length 1.27 m, blade 0.95 m.** 16 body-worn inertial sensors; point speed built from segment angular velocities and segment lengths with no root translation, so the author notes true speed may be higher | Merkert H (2019). A biomechanical analysis of technique training and freefight in Historical European Martial Arts. Master thesis, Bielefeld University, Faculty of Psychology and Sports Science. https://noah.nrw/ubbihs/download/pdf/5139823 | FT-pdf (thesis, not peer-reviewed) |
| Longsword point speed by technique (mean ± SD) | crooked strike on hands 12.77 ± 3.30; range strike against upper strike 12.81 ± 2.52; scalp strike against the Fool 11.89 ± 2.04; cross strike no reaction 10.91 ± 2.05; setting off 10.09 ± 1.85 | same | Merkert 2019, Table B.2 | FT-pdf |
| Longsword timing | time from first sword movement to peak point speed: mean 0.52 s (0.37 ± 0.08 s to 0.77 ± 0.21 s); whole technique 1.34–2.85 s in training; average free fight 24.96 ± 4.79 s | same | Merkert 2019 | FT-pdf |
| Longsword cut kinetic energy | **not measured anywhere I could find.** Uniform-rod estimate for the 1.9 kg sword: (1/6)·m·v² = 39 J at 11.1 m/s and 63 J at 14.1 m/s for rotation about the hilt end; about 90 J at 14.1 m/s if the rotation centre is 0.6 m behind the hilt | my calculation from Merkert's sword and speeds; sword only, arm mass excluded | — | DER |
| Sword cut, blade angular velocity | 1000–2000 deg/s at the top; fast cut 250–350 ms; ordinary cut ≥ 600 ms; near-constant-speed arc lasts < 50 ms | 100 fps video of the author's own cuts, blade angle differentiated frame by frame; sword 1.2 kg | Renk T (2025). Cutting mechanics. https://science-and-fiction.org/swordfighting/cuts.html | FT-web (personal website, not peer-reviewed) |
| Sword cut, kinetic energy estimate | about 330 J for a "typical" full cut (calculated from arm length, sword mass and angular speed); "useful fight cut" presumed < 100 J (author's estimate) | calculation, not measurement | Renk 2025 | FT-web (not peer-reviewed) |
| Sword / axe blow energy used in armour research | 60–130 J for a normal blow; about 130 J upper limit for hand-held cutting weapons | attributed to Williams A (2003), The Knight and the Blast Furnace, Brill. **The book was not seen**; test conditions and weapon masses unknown | as quoted in Devereaux B (2019). Collections: Punching through some armor myths. https://acoup.blog/2019/06/21/collections-punching-through-some-armor-myths/ | SEC (blog quoting the book) |
| Sabre cut, blade-tip peak speed | elite **17.55–19.53 m/s** (SD 1.01); novice 12.97–14.93 m/s | 3 elite (17.5 ± 1.5 y, 6–7 y experience) and 3 novice (≈ 14 y) fencers; vertical cut to a target with a standard sabre (88 cm blade); 240 fps video with point tracking | Greene A, Barona F, Simon X (2023). The effect of joint angle differences on blade velocity in elite and novice saber fencers: a kinematic study. J Emerg Invest. https://emerginginvestigators.org/articles/21-230 | FT-pdf (student journal, n = 6) |
| Kendo shinai tip speed | **not found** as a number. Shinai used in studies: 120 cm, 510 g. No difference in shinai velocity between top and collegiate players; higher downswing angular velocity goes with shorter strike time (r = −0.68) | optical motion capture | Murase et al. 2017; Miyake S, Kaga M (2003). Res J Budo 36(2):51–58 (abstract) | FT-pdf (Murase); ABS (Miyake) |
| Kendo strike, head acceleration of a helmeted target | mean 13.5–14.7 g with new helmets; 17.9 g with helmets older than 5 years | 7 practitioners, more than 1900 shinai strikes on a sensor-equipped mannequin | Wong E, Chu HG, Leo A, Chu G (2026). Striking concerns: reduced protection in older kendo helmets. Cureus 18(2):e102889. doi:10.7759/cureus.102889 | ABS |
| Knife slash, for scale | velocity maximum 14.88 m/s, 95th percentile 9.89 m/s; peak force maximum 212 N, 95th percentile 181 N; mean cut length 25–34 cm | 87 untrained students, one slash each with an instrumented blade on a vertical target | Bleetman A, Watson CH, Horsfall I, Champion SM (2003). Wounding patterns and human performance in knife attacks. J Clin Forensic Med 10(4):243–248. doi:10.1016/j.jcfm.2003.09.005 | ABS |

### C16. Comparison implements and segment contributions

| Quantity | Value | Method / conditions | Source | Read depth |
|---|---|---|---|---|
| Baseball bat, maximum linear speed | 31 m/s | skilled hitters, 3D motion analysis; lead-foot force 123 % body weight | Welch CM, Banks SA, Cook FF, Draovitch P (1995). Hitting a baseball: a biomechanical description. J Orthop Sports Phys Ther 22(5):193–201. doi:10.2519/jospt.1995.22.5.193 | ABS |
| Baseball bat, linear speed at contact | 30 m/s (adults) vs 25 m/s (youth) | 12 skilled adult and 12 skilled youth hitters | Escamilla RF, Fleisig GS, DeRenne C, Taylor MK, Moorman CT, Imamura R, Barakatt E, Andrews JR (2009). A comparison of age level on baseball hitting kinematics. J Appl Biomech 25(3):210–218 | ABS |
| Baseball bat mass and length in these studies | **not found** (not given in the abstracts) | — | — | — |
| Golf, clubhead speed at impact | 33.2 ± 5.9 m/s (professionals); 30.6 ± 3.3 m/s (amateurs) | 11 professional and 5 amateur men, 3D motion capture; club not stated in the extract | Zhou JY, Richards A, Schadl K, Ladd A, Rose J (2022). The Swing Performance Index. Front Sports Act Living 4:986281. https://pmc.ncbi.nlm.nih.gov/articles/PMC9816382/ | FT-web |
| Tennis serve, racket-head centre speed at impact | 31.0 m/s | 11 high-performance players, 200 Hz three-camera cinematography | Elliott BC, Marshall RN, Noffal GJ (1995). Contributions of upper limb segment rotations during the power serve in tennis. J Appl Biomech 11:433–442 | SNIP (abstract text seen only as a search excerpt) |
| Tennis serve, **share of racket speed by segment rotation** | upper-arm internal rotation 54.2 %; hand (wrist) flexion 31.0 %; upper-arm horizontal flexion and abduction 12.9 % | same; trunk share not stated in the excerpt | Elliott et al. 1995 | SNIP |
| Trunk vs arm contribution in throwing | a 20 % loss of kinetic energy delivered from hip and trunk needs a 34 % increase in shoulder rotational velocity for the same force at the hand | calculation by Kibler & Chandler 1995 | Seroyer ST, Nho SJ, Bach BR, Bush-Joseph CA, Nicholson GP, Romeo AA (2010). The kinetic chain in overhand pitching. Sports Health 2(2):135–146. https://pmc.ncbi.nlm.nih.gov/articles/PMC3445080/ | SEC (review FT-web) |
| Boxing straight punch | hand speed 9.14 ± 2.06 m/s; force 3427 ± 811 N; effective mass 2.9 ± 2.0 kg (→ ≈ 121 J from the means, my arithmetic) | 7 Olympic boxers, 18 punches to a Hybrid III dummy face | Walilko TJ, Viano DC, Bir CA (2005). Biomechanics of the head for Olympic boxer punches to the face. Br J Sports Med 39(10):710–719. doi:10.1136/bjsm.2004.014126 | ABS; DER (energy) |
| Boxing hook | hand speed change 11.0 ± 3.4 m/s; force 4405 ± 2318 N | 11 Olympic boxers, 51–130 kg | Viano DC, Casson IR, Pellman EJ, Bir CA, Zhang L, Sherman DC, Boitano MA (2005). Concussion in professional football: comparison with boxing head impacts, part 10. Neurosurgery 57(6):1154–1172 | ABS |
| Heavyweight punch | 8.9 m/s at impact after 0.49 m of travel in 0.1 s; peak force 4096 N within 14 ms | one world-ranked professional heavyweight; instrumented padded ballistic pendulum | Atha J, Yeadon MR, Sandover J, Parsons KC (1985). The damaging punch. BMJ 291(6511):1756–1757 | ABS |
| Axe, sledgehammer, hammer head speed | **not found** (the one instrumented framing-hammer study located could not be retrieved) | — | — | — |

### C17. Proximal-to-distal sequencing

| Quantity | Value | Method / conditions | Source | Read depth |
|---|---|---|---|---|
| Batting: peak pelvis ("hip segment") axial rotation speed | 714 deg/s | skilled hitters | Welch et al. 1995 | ABS |
| Batting: peak upper-trunk ("shoulder segment") rotation speed | 937 deg/s (Welch); 857 deg/s adults vs 717 deg/s youth (Escamilla) | skilled hitters | Welch et al. 1995; Escamilla et al. 2009 | ABS |
| Batting: other peaks | lead elbow extension 752 deg/s; lead knee extension 386 deg/s (adults) | 12 skilled adults | Escamilla et al. 2009 | ABS |
| Golf downswing: peak pelvis / upper-torso rotation speed | 415 ± 33 / 552 ± 48 deg/s (professionals); upper torso reaches 929 ± 185 deg/s in follow-through | 11 professionals | Zhou et al. 2022 | FT-web |
| Golf: order of peaks | professionals: pelvis → thorax → arm → club; amateurs' arm peak comes before the thorax peak | — | Cheetham et al., as cited in Zhou et al. 2022 | SEC |
| Pitching: peak pelvis rotation speed | 400–700 deg/s | adult pitchers | Fleisig et al., as cited in Seroyer et al. 2010 | SEC |
| Pitching: peak elbow extension / shoulder internal rotation speed | 2251 deg/s / 7500–7700 deg/s (7000–9000 in an older study) | adult pitchers | Matsuo 2001, Fleisig 1995, Pappas 1985, as cited in Seroyer et al. 2010 | SEC |
| Pitching: **timing of peaks** as a share of the interval from front-foot contact to ball release | pelvis 25–39 %; upper torso 51–52 %; elbow extension 90–95 %; forward trunk tilt 93–96 %; shoulder internal rotation 102–104 % (3–4 ms after release) | adult pitchers | Seroyer et al. 2010, Table 1 | SEC |
| Pitching: duration of the kinetic chain | front-foot contact to release 0.145 s; maximum external rotation to release 42–58 ms | adult pitchers | Stodden 2008, Pappas 1985, as cited in Seroyer et al. 2010 | SEC |
| Sword cut: segment sequencing | **not found** | — | — | — |

### C18. Thrusts and stabs

| Quantity | Value | Method / conditions | Source | Read depth |
|---|---|---|---|---|
| Knife stab, energy at the target | maximum 64 J underarm; maximum **115 J** overarm; contact loads often near 1000 N | volunteers from several sample populations, instrumented knife measuring axial force and acceleration | Horsfall I, Prosser PD, Watson CH, Champion SM (1999). An assessment of human performance in stabbing. Forensic Sci Int 102(2–3):79–89. doi:10.1016/s0379-0738(99)00055-9 | ABS |
| Knife stab, 95th-percentile values | axial force **1885 N**; energy **69 J** | 20 volunteers, near-maximal effort; short forward thrust, horizontal sweep and overhand stab; six-camera motion capture plus force-measuring knife; energy from trunk, upper arm, forearm and hand segments | Chadwick EKJ, Nicol AC, Lane JV, Gray TGF (1999). Biomechanics of knife stab attacks. Forensic Sci Int 105(1):35–44. doi:10.1016/s0379-0738(99)00117-6 | ABS |
| Knife stab, speed at entry | about 10 m/s overarm; about 7 m/s underarm; 9.2 m/s used as "typical maximum arm velocity" | values attributed to Miller SA, Jones MD (1996). Kinematics of four methods of stabbing: a preliminary study. Forensic Sci Int 82:183–190 | quoted in Gilchrist MD et al. (2008), arXiv:0811.3955, and Ní Annaidh A et al. (2012 preprint), arXiv:2008.13757 | SEC (both citing papers FT-pdf) |
| Knife stab, force on the target | about 150 N (men, dominant hand, maximal effort, pork thigh); women about half | 5 men and 5 women; force-plate dynamometer under the target | Nolan G, Hainsworth SV, Rutty GN (2018). Forces generated in stabbing attacks. Int J Legal Med 132(1):229–236. https://pmc.ncbi.nlm.nih.gov/articles/PMC5748396/ | FT-web |
| Body-armour stab test energies derived from such data | 23, 33 and 43 J protection levels | UK/US stab-resistance standards | US National Institute of Justice, "Taking the stab out of stabbings" (2000). https://www.ojp.gov/library/publications/taking-stab-out-stabbings | SNIP |
| Fencing thrust, weapon speed | 2.5–3.9 m/s (see B11) | lunge studies | Chen et al. 2017 | SEC |
| Longsword techniques that include a thrust, point speed | 9.05 ± 1.86 to 9.28 ± 0.99 m/s | see C15 | Merkert 2019 | FT-pdf |
| Sword thrust force or energy | **not found** | — | — | — |

---

## D. Tissue and impact tolerance

### D19. Blade penetration and cutting

| Quantity | Value | Method / conditions | Source | Read depth |
|---|---|---|---|---|
| Force to penetrate human skin with a knife | 15–17 N quasi-static; 10–12 N at 1–9.2 m/s | cadaveric human skin, porcine skin and polyurethane; cook's knife on a test machine and drop rig | Ní Annaidh A, Cassidy M, Curtis M, Destrade M, Gilchrist MD. A combined experimental and numerical study of stab-penetration forces. Preprint submitted to Forensic Sci Int (2012); arXiv:2008.13757 | FT-pdf |
| Earlier values for skin penetration (summary table in the paper above) | Knight 1975: < 5 N sharp blade, 30–50 N blunt blade; Green 1978: < 10 N bare skin, 70–100 N clothed; O'Callaghan 1999: 35–55 N; Ankersen 1999: 10–15 N (pig skin); Gilchrist 2008: 13–20 N (polyurethane) | cadaveric tissue or simulants | Ní Annaidh et al., Table 3 | SEC |
| Skin simulant penetration | about 20 N (range 18–36 N); nominally identical knives differ by up to 100 %; higher skin tension lowers the force | 4 household knives, biaxially tensioned polyurethane, quasi-static | Gilchrist MD, Keenan S, Curtis M, Cassidy M, Byrne G, Destrade M (2008). Measuring knife stab penetration into skin simulant using a novel biaxial tension device. Forensic Sci Int 177:52–65; arXiv:0811.3955 | FT-pdf |
| Penetration force by implement | sharp kitchen knife 12.6 N (simulant), 12.1 N (pork leg); steak knife 19.8 N and 41.2 N; flat screwdriver 73 N (simulant); cross-head screwdriver 63 N (simulant), 234 N (pork leg) | materials testing machine, averages | Nolan et al. 2018, Table 1 | FT-web |
| Force to penetrate deeper tissue | cartilage 140 N; sternum 200 N; ribs with pocket knives 906–1198 N | cadaveric tests | O'Callaghan et al. 1999 and Bolliger et al. 2016, as cited in Nolan et al. 2018 | SEC |
| Stab force available vs needed | volunteers' "mild" to "severe" stabs almost always exceeded the skin penetration force | 10 volunteers | Nolan et al. 2018 | FT-web |
| Slash / cut energy to sever tissue with a sword-like blade | **not found** (only slash force and speed, see C15) | — | — | — |

### D20. Head impact and bone fracture

| Quantity | Value | Method / conditions | Source | Read depth |
|---|---|---|---|---|
| Concussion: head velocity change | 7.2 ± 1.8 m/s (concussed) vs 5.0 ± 1.1 m/s (struck, uninjured); impact speed 9.3 ± 1.9 m/s | 31 helmeted American-football impacts reconstructed with Hybrid III dummies | Pellman EJ, Viano DC, Tucker AM, Casson IR, Waeckerle JF (2003). Concussion in professional football: reconstruction of game impacts and injuries. Neurosurgery 53(4):799–812. doi:10.1093/neurosurgery/53.3.799 | ABS |
| Concussion: peak head acceleration | 98 ± 28 g over a 15 ms half-sine (concussed) vs 60 ± 24 g (uninjured) | same | Pellman et al. 2003 | ABS |
| Concussion: nominal tolerance | Head Injury Criterion 250; Severity Index 300 | same | Pellman et al. 2003 | ABS |
| Regulatory head injury limits | HIC15 ≤ 700; HIC36 ≤ 1000 | US vehicle standard FMVSS 208 (skull-fracture / serious head injury based) | NHTSA rule-making documents | SNIP |
| Punch producing concussion-range head motion | hook: head acceleration 71.2 ± 32.2 g and 9306 ± 4485 rad/s² (the abstract prints the unit as "r/s"); straight punch 58 ± 13 g and 6343 ± 1789 rad/s² | Olympic boxers striking a Hybrid III dummy | Viano et al. 2005; Walilko et al. 2005 | ABS |
| Skull fracture force | 4.5–14.1 kN; mean 6.4 ± 1.1 kN quasi-static, 11.9 ± 0.9 kN at 7.1–8.0 m/s | 12 unembalmed intact cadaver heads; vertex, parietal, temporal, frontal, occipital loading | Yoganandan N, Pintar FA, Sances A, Walsh PR, Ewing CL, Thomas DJ, Snyder RG (1995). Biomechanics of skull fracture. J Neurotrauma 12(4):659–668. doi:10.1089/neu.1995.12.659 | ABS |
| Skull fracture **energy** | 14.1–68.5 J; mean 33.5 ± 8.5 J quasi-static, **28.0 ± 5.1 J dynamic**; deflection at failure 3.4–16.6 mm | same | Yoganandan et al. 1995 | ABS |
| Temporo-parietal skull fracture, small blunt impactor | peak fracture force 5633 ± 2095 N; deformation 7.8 ± 3.2 mm; proposed tolerance 2346 N | 7 cadaver heads, 14 impacts with a 38 mm instrumented projectile at 18–37 m/s | Raymond D, Van Ee C, Crawford G, Bir C (2009). Tolerance of the skull to blunt ballistic temporo-parietal impact. J Biomech 42(15):2479–2485. doi:10.1016/j.jbiomech.2009.07.018 | ABS |
| Scalp laceration by blunt impact | minimum 4000 N | pig heads, instrumented drop tower, single fronto-parietal impact | Sharkey EJ, Cassidy M, Brady J, Gilchrist MD, NicDaeid N (2012). Investigation of the force associated with the formation of lacerations and skull fractures. Int J Legal Med 126(6):835–844. doi:10.1007/s00414-011-0608-z | ABS |
| Blunt impact speed that can lacerate scalp and fracture skull | of the order of 4 m/s against blunt objects | statement citing head-impact reconstruction studies | Gilchrist et al. 2008 (arXiv:0811.3955) | SEC |
| Forearm (radius and ulna) fracture, bending moment | mean 94 N·m; about 45 N·m for a small person with low bone density | 30 cadaver forearms, dynamic three-point bending at 3.3 and 7.6 m/s | Pintar FA, Yoganandan N, Eppinger RH (1998). Response and tolerance of the human forearm to impact loading. Stapp Car Crash Conf, SAE 983149 | SNIP |
| Forearm fracture, force | dynamic peak load 1370 N; peak moment 89 N·m; static values about 20 % lower; radius and ulna not significantly different | 10 pairs of cadaver lower arms | Begeman PC, Prasad P (1999). Bending strength of the human cadaveric forearm due to lateral loads. Stapp Car Crash Conf, SAE 99SC24 | SNIP |
| Ulna fracture energy | **not found** | — | — | — |

---

## Most important caveats

1. **Isometric peak is not what a fast movement gets.** Torque falls steeply with shortening speed. In Anderson et al. (2007) the knee extensors are at 75 % of isometric by about 87 deg/s and at 50 % by about 226 deg/s; elbow flexion in Frey-Law et al. (2012) falls from 63 to 26 N·m between 0 and 300 deg/s. Sword cuts involve joint speeds of many hundreds of deg/s (pelvis 400–700, trunk 550–940, arm joints in the thousands in other striking sports), where single-joint concentric torque is a small fraction of the isometric figure. Use a torque–velocity curve, not a constant cap.
2. **Angle dependence.** Every peak above is the best angle of a torque–angle curve. Lumbar extension doubles from full extension to full flexion (236 → 465 N·m, Graves 1990). Anderson's C2 and C3 parameters give the shape for hip, knee and ankle.
3. **Eccentric torque exceeds isometric** by roughly 10–30 % (Anderson's C6; dorsiflexion much more). This matters for parrying and absorbing blows.
4. **Protocol differences are as large as population differences.** Wrist flexion is 12 N·m in Delp (1996) and 25 N·m in Harbo (2012); hip extension is 152 or 226 N·m in the same subjects on two rigs (Goncalves 2021). Treat any single number as ± 30 %.
5. **Populations are mostly untrained young men or mixed-sex samples.** Harbo's sample is explicitly non-athletic. The only trained-athlete torque data here are isokinetic trunk values for boxers, wrestlers and weightlifters (extension 440 vs 373 N·m at 60 deg/s, about + 18 %). Samples in several key papers are small (7 to 30 men).
6. **Single-joint dynamometry is not a functional limit.** Multi-joint tasks are limited by the weakest link, by bi-articular muscles shared between joints, and by balance; summing single-joint maxima overestimates whole-body force. Maximal axial twist exertions also show strong co-contraction (McGill 1991).
7. **Sword-cut speed data are thin and not peer-reviewed.** The only instrumented longsword numbers (9–14 m/s point speed) come from a master's thesis, with a heavy 1.9 kg sword, partner drills rather than full-power cuts, and a method that omits whole-body translation. A personal-website video analysis implies about twice the angular rate. The sabre figure (17.5–19.5 m/s) is from six teenage fencers in a student journal. **No instrumented measurement of sword-cut kinetic energy was found**; the J values given are calculations or unverified secondary quotes.
8. **Stab energies are not blade energies.** Horsfall and Chadwick report energy of the knife plus the effective mass of hand, arm and part of the trunk (69–115 J at the top end). Tip speed alone would greatly understate the energy available.
9. **Tissue thresholds vary by an order of magnitude with blade tip geometry**, skin tension, direction and clothing (skin penetration from < 5 N to 100 N). Cadaveric skull data ignore scalp and site; the 28 J dynamic fracture energy has a 14–68 J range. Concussion figures come from helmeted impacts with long duration and are not a knockout threshold for a short, hard blow.
10. **Balance thresholds are largely derived.** The no-step impulse (about 10 N·s measured as a safe range, 11–38 N·s from the model) depends on stance width, push height, direction and anticipation; the one-step impulse is an extrapolation from lean-release experiments reported only in conference abstracts.
11. **Derived values (DER)** are my arithmetic on sourced numbers and carry my assumptions (lever arms, uniform-rod sword, pendulum length). They are flagged so they are not mistaken for measurements.
12. **FT-web rows** were extracted by an automated page reader. Two known problems are flagged in place: the Frey-Law knee tables (caption order, male rows) and the Chen review's épée speed of 12.8 m/s.

## Rows that could not be sourced

- Shoulder flexion, extension and horizontal adduction torques in N·m (only rank order and ratios; absolute tables are in Otis 1990, Cahalan 1991, Hughes 1999, which were not accessible).
- Shoulder internal and external rotation torque measured directly in N·m (only body-weight-normalised forces, converted with an assumed lever arm).
- Trunk lateral bending torque in N·m; isometric trunk flexion in N·m for a male-only sample.
- Isokinetic values at high speed (above 300 deg/s) for any joint; isokinetic values at all for hip abduction/adduction/rotation in a male-only sample, ankle inversion/eversion speed, neck, forearm rotation.
- Fencing advance and retreat step speeds; isolated rear-leg push force in the lunge; lunge duration as a single agreed figure.
- Measured impulse a standing adult withstands with exactly one step; absolute foot-off latency for waist-pull or push perturbations in young men.
- Kneeling-to-standing time.
- Hip abduction moment in walking for young adults (only the older-adult value 0.87 N·m/kg).
- Kendo shinai tip speed and impact force in physical units (the papers that report them, Abe & Kimpara 2012 and Yokoyama et al. 1995, give no numbers in their accessible abstracts).
- Katana / iaido cut speed; any instrumented sword-cut kinetic energy; sword thrust force or energy; segment contribution or sequencing analysis for a sword cut.
- Baseball bat mass and length for the cited speeds; axe, sledgehammer and hammer head speeds; trunk share of racket speed in the tennis serve.
- Slash / cut energy needed to sever tissue with a long blade; ulna fracture energy; delta-v or HIC for knockout by a short-duration blow.
- Standard references named in the request that could not be opened: Winter's *Biomechanics and Motor Control of Human Movement*, the NASA anthropometry and strength data (the NASA Man-Systems Integration Standards host did not resolve), and Delp's lower-limb model papers. Publisher sites for Springer, the American Physiological Society, MDPI and CORE blocked automated access.
