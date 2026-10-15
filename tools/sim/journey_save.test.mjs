// 여정 이어하기 지점 저장 · 첫 화면 건너뛰기 규칙 (샛별 저장소 journey_save.test.mjs 를 우리 열쇠·규칙에 맞춤 — docs/import/lobby_port_2026-10-16.md §5)
//  node --test tools/sim/journey_save.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEY_SAVE_KEY, readJourney, writeJourney, skipsTitle } from '../../src/journey_save.js';
const memory=()=>{const data=new Map([['stillness.journeyClears.v1','37'],['gladiator-settings','keep']]);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('our key names: no clash with existing keys, no other-build names',()=>{
 assert.equal(JOURNEY_SAVE_KEY,'stillness.journey.checkpoint.v1');
 for(const k of ['stillness.journeyClears.v1','stillness.testRoute.v1','gladiator-settings'])assert.notEqual(JOURNEY_SAVE_KEY,k);
 assert.ok(!/fork/i.test(JOURNEY_SAVE_KEY));
});
test('draw and armed checkpoints round-trip without changing other saved data',()=>{
 const s=memory(),round={stage:'castle',foe:'isolde',foeWeapon:'longsword',weapon:null,lastWeapon:'rapier',cards:['longsword','ganjiang']};
 assert.equal(writeJourney(round,s),true);assert.deepEqual(readJourney(s),round);
 const armed={...round,weapon:'longsword',cards:null};writeJourney(armed,s);assert.deepEqual(readJourney(s),armed);
 assert.equal(s.getItem('stillness.journeyClears.v1'),'37');assert.equal(s.getItem('gladiator-settings'),'keep');
});
test('next-stage checkpoint does not retain old opponent or weapon choice',()=>{
 const s=memory();writeJourney({stage:'clearing',lastWeapon:'longsword'},s);
 assert.deepEqual(readJourney(s),{stage:'clearing',lastWeapon:'longsword',foe:null,foeWeapon:null,weapon:null,cards:null});
});
test('missing, malformed, future-version and incomplete checkpoint are ignored',()=>{
 const s=memory();assert.equal(readJourney(s),null);
 for(const value of ['{bad','null','[]',JSON.stringify({version:2,stage:'castle'}),JSON.stringify({version:1,stage:12}),JSON.stringify({version:1,stage:'castle',cards:['longsword']}),JSON.stringify({version:1,stage:'castle',weapon:'longsword'}),JSON.stringify({version:1,stage:'castle',foe:{id:'heinrich'}})]){
  s.setItem(JOURNEY_SAVE_KEY,value);assert.equal(readJourney(s),null);assert.equal(s.getItem(JOURNEY_SAVE_KEY),value);
 }
});
test('blocked storage and blocked storage property do not stop a new game',()=>{
 const denied={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 assert.equal(readJourney(denied),null);assert.equal(writeJourney({stage:'castle'},denied),false);
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try{Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('blocked property')}});assert.equal(readJourney(),null);assert.equal(writeJourney({stage:'castle'}),false);}
 finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete globalThis.localStorage;}
});
test('any game argument keeps the old direct entry; plain address shows the title',()=>{
 const p=q=>new URLSearchParams(q);
 for(const query of ['test=1','stage=castle','weapon=longsword','hero=heinrich','foe=random','look=heinrich:v0','lookv=0','foeWeapon=rapier','stamina=0','foeWhiff=1','tempo=1','itRhythm=4','camFollow=old','cards=longsword,rapier','clears=37','fps=1','offline=1','title=0','title=0&stage=castle'])assert.equal(skipsTitle(p(query)),true,query);
 for(const query of ['','title=1','nosw=1','title=1&stage=castle','title=1&cards=longsword,rapier','utm_source=x','fbclid=abc','gclid=abc'])assert.equal(skipsTitle(p(query)),false,query);
});
