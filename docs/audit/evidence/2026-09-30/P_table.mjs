// Summarize P_raw/*.json into a markdown table (one row per stage x config)
import fs from 'node:fs';
const dir = new URL('./P_raw/', import.meta.url).pathname;
const rows = [];
for (const st of ['poseidon','clearing','temple','castle','poseidon_night','cathedral','darkhall']) for (const cfg of ['r1','r4','tiny1','tiny4']) {
  const p = dir + `${st}_${cfg}.json`; if (!fs.existsSync(p)) { rows.push(`| ${st} | ${cfg} | missing |`); continue; }
  const s = JSON.parse(fs.readFileSync(p)).summary, sc = s.scene;
  rows.push(`| ${st} | ${cfg} | ${s.fpsAvg} / ${s.fps5low} | ${s.frameMs} | ${s.mainThread.taskMsPerFrame} | ${s.physMs} (${s.steps} st, ${(s.physMs/s.steps).toFixed(2)}/st) | ${s.renderMs} | ${s.gameSpeed}% | ${s.calls} (${s.callsMax}) | ${(s.tris/1000).toFixed(0)}k (${(s.trisMax/1000).toFixed(0)}k) | ${s.programs}/${s.geometries}/${s.textures} | ${sc.lights} ${Object.entries(sc.lightTypes).map(([k,v])=>k.replace('Light','')+v).join(',')} | ${sc.shadowLights.join(',')||'-'} / ${sc.castShadowMeshes} | ${sc.visibleMeshes}/${sc.meshes} (inst ${sc.instanced}) | ${sc.points} | ${sc.transparentMats}/${sc.additiveMats} of ${sc.materials} | ${s.heapMB} (${s.heapMinMB}-${s.heapMaxMB}) | ${s.gc5s.minor}/${s.gc5s.major} ${s.gc5s.gcMs}ms, dHeap ${s.gc5s.heapDeltaMB} | ${s.endState.simTime}s ${s.endState.pAlive&&s.endState.eAlive?'':'KO'} ${s.errors.length?'ERR':''}${s.ai2err?' AI2ERR':''} |`);
}
console.log('| stage | cfg | fps avg / 5% low | frame ms | main-thread task ms/frame | physics ms/frame | render ms | game speed | calls (max) | tris (max) | prog/geo/tex | lights | shadow maps / caster meshes | vis meshes/all | Points | transp/additive mats | heap MB (min-max) | GC minor/major per 5 s | sim time |');
console.log('|'+'---|'.repeat(19));
console.log(rows.join('\n'));
