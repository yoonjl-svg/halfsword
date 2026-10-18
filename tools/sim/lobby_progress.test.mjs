// 대기실 레벨·호칭·금화 · 프로필 · 장착 저장 (샛별 저장소 lobby_progress.test.mjs 를 우리 열쇠에 맞추고 프로필·장착을 더함 — docs/import/lobby_port_2026-10-16.md §3)
//  node --test tools/sim/lobby_progress.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
const storage = new Map();
globalThis.localStorage = { getItem:k=>storage.get(k)??null, setItem:(k,v)=>storage.set(k,v) };
const { readProgress, recordAcquisition, unlockEventTitle, titleOptions, selectTitle, DEFAULT_TITLE, PROGRESS_KEY } = await import('../../src/lobby_progress.js');
const { readProfile, renamePlayer, recordDuel, cleanName, PROFILE_KEY } = await import('../../src/player_profile.js');
const { LOBBY_ITEMS, LOBBY_ARMOR, EQUIPMENT_KEY, readLobbyEquipment, saveLobbyEquipment, readLobbyArmor, saveLobbyArmor } = await import('../../src/lobby_equipment.js');
test('our key names (no fork names, no clash with existing keys)',()=>{
 const keys=[PROGRESS_KEY,PROFILE_KEY,EQUIPMENT_KEY];
 assert.deepEqual(keys,['stillness.lobby.progress.v1','stillness.lobby.profile.v1','stillness.lobby.weapon.v1']);
 for(const k of keys)assert.ok(!/fork/i.test(k)&&!['stillness.journeyClears.v1','stillness.testRoute.v1','gladiator-settings'].includes(k));
});
test('owner changes: weapon slot is tree branch only; armor name is one constant; kettle hat = epic (10/19 03:1x · 전 legend 10/16 03:5x) + 생존술 +30',()=>{
 assert.deepEqual([...LOBBY_ITEMS],['tree_branch']);
 assert.equal(LOBBY_ARMOR.nameKo,'케틀 햇');assert.equal(LOBBY_ARMOR.tier,'epic');assert.equal(LOBBY_ARMOR.staminaBonus,30);
 assert.equal(`${LOBBY_ARMOR.description} ${LOBBY_ARMOR.ability}`,'중세 보병들이 쓰던 챙 넓은 쇠 모자. 뒤집으면 요리를 할 수 있다. (생존술: 기력 +30)');
 assert.equal(saveLobbyEquipment('longsword'),false);assert.equal(saveLobbyEquipment('tree_branch'),true);assert.equal(readLobbyEquipment(),'tree_branch');
 storage.set(EQUIPMENT_KEY,JSON.stringify({version:1,weapon:'longsword'}));assert.equal(readLobbyEquipment(),null); // 옛 롱소드 장착 기록은 맨손으로
 assert.equal(saveLobbyArmor(null),true);assert.equal(readLobbyArmor(),null);assert.equal(saveLobbyArmor('kettle'),true);assert.equal(readLobbyArmor(),'kettle');
});
test('starter grants excluded; acquisition receipts count both kinds once, independently of titles',()=>{
 assert.equal(readProgress().level,1); assert.equal(readProgress().coins,100); assert.equal(readProgress().title,'여행자');
 for(const id of ['tree_branch','longsword','kettle'])assert.equal(recordAcquisition({receipt:id,kind:'item',source:'starter'}),false);
 assert.equal(readProgress().level,1);
 assert.equal(recordAcquisition({receipt:'drop-1',kind:'item',source:'loot'}),true);
 assert.equal(recordAcquisition({receipt:'book-1',kind:'skillbook',source:'reward'}),true);
 assert.equal(recordAcquisition({receipt:'drop-1',kind:'item',source:'loot'}),false);
 assert.equal(readProgress().level,3);
 assert.equal(unlockEventTitle('test-event','검증용 호칭'),true);
 assert.equal(unlockEventTitle('test-event','중복'),false);
 assert.equal(readProgress().level,3);assert.equal(readProgress().title,'여행자');
 assert.equal(JSON.parse(storage.get(PROGRESS_KEY)).acquisitions.length,2);
});
test('malformed and duplicated saved receipts cannot inflate level; invalid currency/title fall back',()=>{
 storage.set(PROGRESS_KEY,JSON.stringify({version:1,acquisitions:[null,{receipt:'x',kind:'item'},{receipt:'x',kind:'skillbook'},{receipt:'bad',kind:'unknown'}],coins:-20,title:'unearned',titles:[]}));
 assert.equal(readProgress().level,2);assert.equal(readProgress().coins,100);assert.equal(readProgress().title,'여행자');
});
// 호칭 내림 상자의 자료 (사장님 10/16 15:3x ⑥ · 16:0x '이미 가진 호칭인 여행자가 보이고' — docs/import/ui_unify_2026-10-16.md §6). '검증용 호칭'은 시험에만 쓰는 이름 (게임에 넣는 호칭 아님)
test('titles: 여행자 always owned · earned titles listed once in order · only owned can be selected · selection saved in title',()=>{
 const before=storage.get(PROGRESS_KEY); // 아래 '저장 막힘' 시험이 앞 시험들의 상태를 이어 쓴다 — 끝에 되돌린다
 storage.set(PROGRESS_KEY,JSON.stringify({version:1,acquisitions:[],coins:100,heads:0,titles:[],title:'여행자'}));
 assert.equal(DEFAULT_TITLE,'여행자');assert.deepEqual(titleOptions(),['여행자']);
 assert.deepEqual(selectTitle('없는 호칭'),{ok:false,saved:false});assert.equal(readProgress().title,'여행자');
 assert.equal(unlockEventTitle('e0','여행자'),false); // 기본 호칭은 얻는 것이 아니라 늘 가진 것
 assert.equal(unlockEventTitle('e1','검증용 호칭'),true);assert.equal(unlockEventTitle('e2','검증용 호칭'),true);assert.equal(unlockEventTitle('e3','둘째 검증용'),true);
 assert.deepEqual(titleOptions(),['여행자','검증용 호칭','둘째 검증용']);
 assert.deepEqual(selectTitle('검증용 호칭'),{ok:true,saved:true});assert.equal(readProgress().title,'검증용 호칭');
 assert.equal(JSON.parse(storage.get(PROGRESS_KEY)).title,'검증용 호칭');
 assert.deepEqual(selectTitle('여행자'),{ok:true,saved:true});assert.equal(JSON.parse(storage.get(PROGRESS_KEY)).title,'여행자');
 storage.set(PROGRESS_KEY,before);readProgress();
});
test('profile: default name, 16-character trim, literal text, win/loss counts',()=>{
 assert.deepEqual(readProfile(),{name:'Noname',wins:0,losses:0}); // 사장님 10/18 04:1x — 전 '방랑자'
 assert.equal(renamePlayer('   ').ok,false);
 assert.equal(cleanName('  가나다라마바사아자차카타파하가나다라  '),'가나다라마바사아자차카타파하가나');
 assert.equal(renamePlayer('<b>검객</b>').ok,true);assert.equal(readProfile().name,'<b>검객</b>');
 recordDuel(true);recordDuel(false);recordDuel(false);assert.deepEqual(readProfile(),{name:'<b>검객</b>',wins:1,losses:2});
});
// 기본 이름 'Noname' (사장님 10/18 04:1x): 판 끝 저장(recordDuel)이 그때의 기본 이름도 같이 저장해 왔다 — 저장된 이름이 꼭 전 기본 '방랑자'면 'Noname' · 직접 고친 이름은 그대로
test('profile: saved old default 방랑자 reads as Noname (counts kept); typed names stay; renaming to 방랑자 now is kept; the default is never marked as typed',()=>{
 const before=storage.get(PROFILE_KEY);
 storage.set(PROFILE_KEY,JSON.stringify({version:1,name:'방랑자',wins:3,losses:2})); // 10/18 전 기본 이름으로 판 끝에 저장된 것
 assert.deepEqual(readProfile(),{name:'Noname',wins:3,losses:2});
 recordDuel(true);assert.deepEqual(JSON.parse(storage.get(PROFILE_KEY)),{version:1,name:'Noname',wins:4,losses:2}); // 다음 저장부터 새 기본 이름 · 고친 표시 없음
 storage.set(PROFILE_KEY,JSON.stringify({version:1,name:'방랑 검객',wins:1,losses:0})); // 전에 직접 고친 이름 (표시 없는 옛 저장)
 assert.equal(readProfile().name,'방랑 검객');recordDuel(false);assert.equal(readProfile().name,'방랑 검객');
 storage.set(PROFILE_KEY,JSON.stringify({version:1,name:'  방랑자 ',wins:0,losses:0}));assert.equal(readProfile().name,'Noname'); // 앞뒤 빈칸만 다른 옛 기본 이름도
 assert.equal(renamePlayer('방랑자').ok,true);assert.equal(readProfile().name,'방랑자'); // 10/18 부터 직접 '방랑자'로 고치면 그대로
 assert.deepEqual(JSON.parse(storage.get(PROFILE_KEY)),{version:1,name:'방랑자',wins:0,losses:0,named:true});
 recordDuel(true);assert.deepEqual(readProfile(),{name:'방랑자',wins:1,losses:0});assert.equal(JSON.parse(storage.get(PROFILE_KEY)).named,true); // 판 끝 저장도 표시를 지킨다
 storage.set(PROFILE_KEY,JSON.stringify({version:1,name:'',wins:0,losses:0}));assert.equal(readProfile().name,'Noname'); // 빈 이름 = 기본
 storage.set(PROFILE_KEY,before);readProfile();
});
test('blocked storage keeps new acquisitions for the session',()=>{
 globalThis.localStorage={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
 assert.equal(recordAcquisition({receipt:'session-book',kind:'skillbook',source:'reward'}),true);
 assert.equal(readProgress().level,3);assert.equal(recordAcquisition({receipt:'session-book',kind:'skillbook'}),false);
});
