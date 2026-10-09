// 게임 전체 화면 글 → CSV (UTF-8, BOM) — 사장님 교열용 일괄 시트 (10/10 표기 방침 — docs/text/naming_policy_2026-10-10.md)
//  열: 번호 · 분류 · 유파 · 위치(파일·열쇠) · 현재 표기 · 원어 · 국립국어원 표기(일본어만) · 비고
//  원어: 일본·중국 유파 낱말은 아래 GLOSS 표(한자·가나 읽기), 그 밖은 표기 안 괄호의 로마자 원어(독일어·이탈리아어·포르투갈어 등)를 그대로
//  국립국어원 표기: 일본 유파 글을 외래어 표기법(어두 거센소리 없음 · つ=쓰)으로 바꾼 것 — 시트의 대안 칸 (게임엔 넣지 않음)
//  같은 이름의 .json 도 쓴다: { all: 시트 '전체' 줄들, changed: 시트 '바꾼 것' 줄들 (옛 표기 → 새 표기) } — 시트에 옮겨 넣을 때 쓴다
// 실행: node tools/text/extract_texts.mjs [나갈 파일]   (기본: 시스템 임시 폴더 halfsword_text/all_texts.csv)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectTexts, HAN, schoolSet } from './texts.mjs';

const OUT = process.argv[2] ?? path.join(os.tmpdir(), 'halfsword_text', 'all_texts.csv');

const SCHOOL_KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '중국', none: '무유파' };

// 일본 관용 표기 → 국립국어원 외래어 표기법 (긴 낱말 먼저). 관용: 어두 카·타·파, つ=츠 · 국어원: 어두 가·다·바, つ=쓰
const NIKL = [
  ['츠바메가에시', '쓰바메가에시'], ['카타테코테', '가타테고테'], ['히다리케사', '히다리게사'], ['갸쿠케사', '갸쿠게사'], ['케사기리', '게사기리'],
  ['키리아게', '기리아게'], ['카에시', '가에시'], ['코테', '고테'], ['코코', '고코'], ['추단', '주단'], ['츠키', '쓰키'], ['케사', '게사'],
  ['카스미', '가스미'], ['카타나', '가타나'], ['코지로', '고지로'],
];
const nikl = (s) => NIKL.reduce((t, [a, b]) => t.split(a).join(b), s);

// 일본·중국 낱말 원어·옛 표기·비고 (열쇠 = 위치 끝 열쇠: field|key). 옛 = 10/10 방침 전 표기
const J = 'japanese';
const GLOSS = {
  // 일본 자세 이름 (바탕 자리 열쇠)
  [`${J}|guard.name|지붕 (Vom Tag)`]: { orig: '上段 (じょうだん)', old: '상단 (上段)' },
  [`${J}|guard.name|어깨 지붕 (Vom Tag)`]: { orig: '八相 (はっそう)', old: '팔상 (八相)' },
  [`${J}|guard.name|긴 자세 (Langort)`]: { orig: '中段 (ちゅうだん)', old: '중단 (中段)' },
  [`${J}|guard.name|옆 자세`]: { orig: '右脇 (みぎわき)', old: '우협 (右脇)', note: '오륜서 「右のわきに構へ」' },
  [`${J}|guard.name|쟁기 (Pflug)`]: { orig: '晴眼 (せいがん)', old: '청안 (晴眼)' },
  [`${J}|guard.name|바꿈 (Wechsel)`]: { orig: '右下藏 (うげぞう)', old: '우하장 (右下藏)', note: '[추정] 무예도보통지 왜검 용어 — 일본 쪽 읽기 기록 없음, 음독(오음)으로 정함' },
  [`${J}|guard.name|옆 지킴 (Nebenhut)`]: { orig: '脇構え (わきがまえ)', old: '협구 (脇構え)' },
  [`${J}|guard.name|바보 (Alber)`]: { orig: '下段 (げだん)', old: '하단 (下段)' },
  [`${J}|guard.name|왼쪽 어깨 지붕`]: { orig: '八相 (はっそう)', old: '왼 어깨 (八相 거울)' },
  [`${J}|guard.name|왼쪽 옆 자세`]: { orig: '左脇 (ひだりわき)', old: '좌협 (左脇)' },
  [`${J}|guard.name|왼쪽 바꿈`]: { orig: '左藏 (さぞう)', old: '좌장 (左藏)', note: '[추정] 무예도보통지 왜검 용어 — 음독으로 정함' },
  [`${J}|guard.desc|어깨 지붕 (Vom Tag)`]: { orig: '上段', old: '上段에서 오른 주먹을 …' },
  [`${J}|guard.desc|옆 자세`]: { orig: '上段 · 表5', old: '… 上段으로 올려 곧장 내려벤다(表5)' },
  [`${J}|guard.desc|쟁기 (Pflug)`]: { orig: '中段', old: '… 손이 낮은 中段 …' },
  [`${J}|guard.desc|바꿈 (Wechsel)`]: { orig: '切り上げ (きりあげ)', old: '… 올려벤다(切り上げ)' },
  [`${J}|guard.desc|왼쪽 옆 자세`]: { orig: '表4', old: '… 비스듬히 벤다(表4)' },
  [`${J}|guard.desc|왼쪽 바꿈`]: { orig: '袈裟 (けさ) · 逆袈裟 (ぎゃくけさ)', old: '… 袈裟가 끝나는 자리, 여기서 逆袈裟로 되올린다' },
  // 일본 공용 동작 이름
  [`${J}|tech.name|zornhau`]: { orig: '袈裟斬り (けさぎり)', old: '袈裟 (けさ) 斬り' },
  [`${J}|tech.name|zornhauL`]: { orig: '左袈裟 (ひだりけさ)', old: '左袈裟' },
  [`${J}|tech.name|oberhau`]: { orig: '真向 (まっこう) · 正面打ち (しょうめんうち)', old: '真向 (정수리 베기) · 正面打ち' },
  [`${J}|tech.name|zwerch`]: { orig: '胴 (どう)', old: '胴 (どう)' },
  [`${J}|tech.name|zwerchL`]: { orig: '逆胴 (ぎゃくどう)', old: '逆胴' },
  [`${J}|tech.name|unterhau`]: { orig: '切り上げ (きりあげ)', old: '切り上げ' },
  [`${J}|tech.name|unterhauL`]: { orig: '逆袈裟 (ぎゃくけさ)', old: '逆袈裟' },
  [`${J}|tech.name|stichPflug`]: { orig: '突き (つき) · 晴眼 (せいがん)', old: '突き (청안에서)' },
  [`${J}|tech.name|stichPflugL`]: { orig: '突き (つき)', old: '突き (왼 허리에서)' },
  [`${J}|tech.name|stichOchs`]: { orig: '突き (つき)', old: '突き (머리 옆에서)' },
  [`${J}|tech.name|stichOchsL`]: { orig: '突き (つき)', old: '突き (왼 머리 옆에서)' },
  [`${J}|tech.name|stichAlber`]: { orig: '突き (つき) · 下段 (げだん)', old: '突き (하단에서)' },
  [`${J}|tech.name|talhoReves`]: { orig: '左右垂劍打 (さゆうすいけんだ)', old: '左右垂劍打', note: '[추정] 무예도보통지 교전 낱말 — 일본 쪽 읽기 기록 없음, 음독으로 정함' },
  [`${J}|tech.name|wristCut`]: { orig: '片手小手 (かたてこて)', old: '片手小手' },
  // 일본 고유 동작·패시브·비기
  [`${J}|unique.nameKo|tsubameGaeshi`]: { orig: '燕返し (つばめがえし)', old: '燕返し (츠바메가에시)' },
  [`${J}|unique.nameKo|kote`]: { orig: '小手 (こて)', old: '小手 (코테)' },
  [`${J}|unique.nameKo|kokoRenda`]: { orig: '跨虎 (ここ) 연타', old: '跨虎 연타', note: '[추정] 무예도보통지 왜검 운광류(運光流) 용어 — 일본 쪽 읽기 기록 없음, 음독으로 정함' },
  [`${J}|unique.nameKo|hirakiGiri`]: { orig: '開き斬り (ひらきぎり)', old: '開き斬り (히라키기리)' },
  [`${J}|unique.nameKo|omote5`]: { orig: '表 (おもて) 五', old: '表5 (오모테 5)' },
  [`${J}|passive.nameKo|zanshin`]: { orig: '残心 (ざんしん)', old: '残心' },
  [`${J}|passive.nameKo|debana`]: { orig: '出端 (でばな)', old: '出端 (데바나)' },
  [`${J}|passive.nameKo|kaeshi`]: { orig: '返し (かえし)', old: '返し (카에시)' },
  [`${J}|secret.nameKo|goNoSen`]: { orig: '後の先 (ごのせん)', old: '後の先 (고노센 · 가칭)' },
  // 일본 무기
  [`${J}|weapon.nameKo|uchigatana`]: { orig: '打刀 (うちがたな)', old: '打刀 (우치가타나)', note: '사장님 10/10 지시' },
  [`${J}|weapon.nameKo|monohoshizao`]: { orig: '物干し竿 (ものほしざお)' },
  [`${J}|weapon.desc|monohoshizao`]: { orig: '佐々木小次郎 (ささきこじろう) · 野太刀 (のだち)' },
  [`${J}|weapon.ability|monohoshizao`]: { orig: '燕返し (つばめがえし) 의 우리말 옮김', note: '방침 검토 후보: 제비 베기 → 츠바메가에시? (지금은 번역어)' },
  // 몸 틀 앞무게 표 (일본·이베리아·무유파가 같이 씀 — 유파 이름표가 늘 덮어 화면엔 안 나옴)
  ['iberian,japanese,none|frame.name|지붕 (Vom Tag)']: { orig: '上段 (じょうだん)', old: '상단 (上段)' },
  ['iberian,japanese,none|frame.name|어깨 지붕 (Vom Tag)']: { orig: '八相 (はっそう)', old: '팔상 (八相) · 어깨 메기' },
  ['iberian,japanese,none|frame.name|왼쪽 어깨 지붕']: { orig: '八相 (はっそう)', old: '왼 팔상 · 레베스 준비', note: '한자는 없었으나 한국 한자음(팔상)이라 일본 독음으로 맞춤' },
  ['iberian,japanese,none|frame.name|긴 자세 (Langort)']: { orig: '中段 (ちゅうだん)', old: '중단 (中段)' },
  ['iberian,japanese,none|frame.name|옆 지킴 (Nebenhut)']: { orig: '脇構え (わきがまえ)', old: '협 (脇構え)' },
  // 중국 (한글 독음 (漢字) 꼴로 고친 것)
  ['chinese|guard.name|왼쪽 옆 자세']: { old: '요격세 · 왼 (腰擊)' },
  ['chinese|guard.desc|왼쪽 어깨 지붕']: { old: '치켜 올렸다 눌러 상대 손아귀(虎口)를 바로 친다' },
  ['chinese|guard.desc|왼쪽 옆 자세']: { old: '… 오른쪽 腰擊과 번갈아' },
  ['chinese|unique.nameKo|yaoji']: { old: '腰擊 (요격)' },
  ['chinese|unique.nameKo|zuoyi']: { old: '左翼擊 (좌익격)' },
  ['chinese|feint.name|lianchi']: { old: '斂翅 (찌르는 척 → 거둬 腰擊)', note: '두음법칙 렴→염' },
  ['chinese|unique.nameKo|chebuYaoji']: { old: '掣步 腰擊 (끌어 딛는 요격)' },
  ['chinese|passive.nameKo|ciji']: { old: '刺→擊 고리' },
  ['chinese|secret.nameKo|lianhuanSanji']: { old: '連環三擊 (연환삼격 · 가칭)', note: '두음법칙 련→연' },
  ['chinese|tech.name|talhoReves']: { old: '과좌·과우 번갈아', note: '한글만 있던 한자말 — 한자 병기 더함' },
  ['chinese|secret.seq.nameKo|lianhuanYao']: { old: '腰擊 (요격)' },
  ['chinese|secret.seq.nameKo|lianhuanLiao']: { old: '撩掠 (요략 — 걷어 올려 베기)' },
  ['chinese|secret.seq.nameKo|lianhuanTanfu']: { old: '坦腹刺 (탄복자)' },
  ['chinese|char.name|liao']: { note: '방침 검토 후보: 인물 이름은 중국 발음 한글 표기 — 유파 용어가 아니라 그대로 둠 (한자 이름이 정해져 있지 않음). 한국 한자음 + 한자로 바꿀지는 사장님 판단' },
  ['chinese|weapon.nameKo|qinggang']: { orig: '靑鋼劍', note: '방침 적용 후보: 청강검 (靑鋼劍) — 지금은 한글만이라 그대로' },
  ['chinese|weapon.ability|qinggang']: { orig: '蒼天', note: '방침 적용 후보: 창천 (蒼天) — 지금은 한글만이라 그대로' },
};

const lastKey = (r) => r.key ?? r.base ?? r.id ?? '';
const rows = await collectTexts({ characters: true });
const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const out = [['번호', '분류', '유파', '위치(파일·열쇠)', '현재 표기', '원어', '국립국어원 표기(일본어만)', '비고']];
const changedRows = [['번호', '유파', '분류', '위치(파일·열쇠)', '옛 표기', '새 표기', '원어', '비고']];
let changed = 0;
rows.forEach((r, i) => {
  const sc = schoolSet(r.school);
  const g = GLOSS[`${r.school}|${r.field}|${lastKey(r)}`] ?? {};
  let orig = g.orig ?? '';
  if (!orig) {
    // 중국: 괄호 안 한자 · 그 밖: 괄호 안 로마자 원어
    const paren = [...r.text.matchAll(/\(([^()]*)\)/g)].map((m) => m[1]);
    if (sc.has('chinese')) orig = paren.filter((p) => HAN.test(p)).join(' · ');
    else orig = paren.filter((p) => /[A-Za-zÀ-ÿ]/.test(p) && !/[가-힣]/.test(p)).join(' · ');
  }
  const jp = sc.has('japanese') && !r.characters;
  const n = jp ? nikl(r.text) : '';
  const notes = [];
  const schoolKo = [...sc].map((k) => SCHOOL_KO[k] ?? k).join('·') || '공용';
  if (g.old && g.old !== r.text) {
    notes.push(`옛 표기: ${g.old}`);
    changed++;
    changedRows.push([changed, schoolKo, r.cat, r.loc, g.old, r.text, orig, g.note ?? '']);
  }
  if (g.note) notes.push(g.note);
  if (r.note) notes.push(r.note);
  out.push([i + 1, r.cat, schoolKo, r.loc, r.text, orig, n, notes.join(' · ')]);
});
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, '\ufeff' + out.map((row) => row.map(csvCell).join(',')).join('\n') + '\n');
fs.writeFileSync(OUT.replace(/\.csv$/, '') + '.json', JSON.stringify({ all: out, changed: changedRows }, null, 1));
console.log(`${OUT} — 글 ${rows.length} 줄 (머리 줄 빼고) · 이번에 고친 표기 ${changed}`);
