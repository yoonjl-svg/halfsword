import re,sys
p=sys.argv[1]; s=open(p).read()
def rep(old,new,count=1):
    global s
    n=s.count(old)
    if n!=count: raise SystemExit(f"count {n} for: {old[:70]}")
    s=s.replace(old,new)
rep("import { pairAllowed } from './self_contact.js';", "import { J, JA } from './_j.js';\nimport { pairAllowed } from './self_contact.js';")
# hk
rep("const hk = (att.secretHit ?? 1) * fingerCutK(att, 'hit') * (itk ? itk.k : 1);",
"const _jm = [];\n    const _sh = JA('secretHit') ? 1 : (att.secretHit ?? 1), _fc = JA('fingerCut') ? 1 : fingerCutK(att, 'hit'), _ik = itk && !JA('itThrust') ? itk.k : 1;\n    if (_sh !== 1) _jm.push('secretHit'); if (_fc !== 1) _jm.push('fingerCut'); if (itk) _jm.push('itThrust');\n    const hk = _sh * _fc * _ik;")
rep("        if (att.skill?.thrustPush && (att.state === 'stand' || att.state === 'kneel')) {\n          assisted",
    "        if (att.skill?.thrustPush && (att.state === 'stand' || att.state === 'kneel') && !JA('thrustAssist')) {\n          _jm.push('thrustAssist');\n          assisted")
rep("const mStep = stepMassOf(att, pr.v.fighter);", "const mStep = JA('stepMass') ? 0 : stepMassOf(att, pr.v.fighter); if (mStep > 0) _jm.push('stepMass');")
rep("energy = ephys * STRIKE.energyScale * hk * bladeWeight(t);", "const _bw = JA('bladeWeight') ? 1 : bladeWeight(t); if (_bw !== 1) _jm.push('bladeWeight');\n          energy = ephys * STRIKE.energyScale * hk * _bw;")
rep("const emoDealt = am?.dealt ?? 1;", "const emoDealt = JA('emo') ? 1 : am?.dealt ?? 1;")
rep("const emoTaken = vm?.taken ?? 1;", "const emoTaken = JA('emo') ? 1 : vm?.taken ?? 1;")
rep("const emoPass = (am?.pass ?? 0) + (vm?.pass ?? 0);", "const emoPass = JA('emo') ? 0 : (am?.pass ?? 0) + (vm?.pass ?? 0);\n    if (emoDealt !== 1) _jm.push('emoDealt'); if (emoTaken !== 1) _jm.push('emoTaken'); if (emoPass !== 0) _jm.push('emoPass');")
rep("const rage = att.weapon?.woundRage ? woundRageMult(att) : 1;", "const rage = att.weapon?.woundRage ? woundRageMult(att) : 1; if (rage !== 1) _jm.push('rage');")
rep("const duel = att.weapon?.duelOneHand ? duelOneHandMult(att, vic) : 1;", "const duel = att.weapon?.duelOneHand ? duelOneHandMult(att, vic) : 1; if (duel !== 1) _jm.push('duel');")
rep("      if (finishPower) eff *=", "      if (finishPower) _jm.push('finishPower');\n      if (finishPower && !JA('finishPower')) eff *=")
rep("      if (att.effMul) eff *= att.effMul;", "      if (att.effMul) _jm.push('effMul');\n      if (att.effMul && !JA('effMul')) eff *= att.effMul;")
rep("        if (vic.parryGuard?.woundKeep) severity *= vic.parryGuard.woundKeep();\n        else if (vic.aiCtl) severity *= aiWoundKeep(vic);",
    "        { const _k = vic.parryGuard?.woundKeep ? vic.parryGuard.woundKeep() : vic.aiCtl ? aiWoundKeep(vic) : 1; if (_k !== 1) { _jm.push(vic.parryGuard?.woundKeep ? 'parryKeep' : 'aiParryKeep'); if (!JA('parryKeep')) severity *= _k; } }")
rep("        severity *= cnStepKeep(vic);", "        { const _k = cnStepKeep(vic); if (_k !== 1) { _jm.push('cnStep'); if (!JA('cnStep')) severity *= _k; } }")
rep("    const keepFlow = flowShieldKeep(pr.v.fighter, att);", "    let keepFlow = flowShieldKeep(pr.v.fighter, att); if (keepFlow !== 1) { _jm.push('flowShield'); if (JA('flowShield')) keepFlow = 1; }")
rep("    const rockK = vic.schoolPassive?.takenK?.() ?? 1;", "    let rockK = vic.schoolPassive?.takenK?.() ?? 1; if (rockK !== 1) { _jm.push('rock'); if (JA('rock')) rockK = 1; }")
rep("    const oppK = att.parryGuard?.opposition?.dealtK?.() ?? 1;", "    let oppK = att.parryGuard?.opposition?.dealtK?.() ?? 1; if (oppK !== 1) { _jm.push('opposition'); if (JA('opposition')) oppK = 1; }")
rep("    const spK = att.schoolPassive?.dealtK?.() ?? 1;", "    let spK = att.schoolPassive?.dealtK?.() ?? 1; if (spK !== 1) { _jm.push('schoolPassive'); if (JA('schoolPassive')) spK = 1; }")
rep("    if (SB && dir.y > SB.upY && strokeTechOf(att) === SB.tech) {", "    if (SB && dir.y > SB.upY && strokeTechOf(att) === SB.tech) _jm.push('secretBlade');\n    if (SB && dir.y > SB.upY && strokeTechOf(att) === SB.tech && !JA('secretBlade')) {")
rep("    const ibK = att.ibFlowOn", "    const ibK = JA('ibFlow') ? 1 : att.ibFlowOn")
rep("    if (ibK !== 1) {", "    if (att.ibFlowOn && type !== 'stab' && (att.secretHit ?? 1) === 1) _jm.push('ibFlow');\n    if (ibK !== 1) {")
rep("    return {\n      type,\n      zone,", "    if (helmet) _jm.push(helmOn ? 'helmet' : 'helmetIgnored'); if (plate) _jm.push(plateGuard > 0 ? 'plate' : 'plateIgnored'); if (gapV) _jm.push('gap');\n    if (UA.yaojiBleed?.k > 0 && UA.yaojiBleed.zones.includes(zone) && yaojiBleedTech(strokeTechOf(att)) && !perkOff(att, 'yaoji')) _jm.push('yaojiBleed');\n    if (att.weapon?.bleedMult && att.weapon.bleedMult !== 1) _jm.push('bleedMult');\n    return {\n      _jm,\n      type,\n      zone,")
# strike counters
rep("    if (r.type !== 'blunt' || r.severity > 0 || r.energy > 10) {\n      const cons0",
    "    J('strike.judged'); if (r.traded) J('strike.ibTraded');\n    if (r.type !== 'blunt' || r.severity > 0 || r.energy > 10) {\n      J('hit.' + r.type + (r.severity > 0 ? '+' : '0')); J('hit.zone.' + r.zone); for (const k of r._jm) J('m.' + k);\n      const cons0")
rep("vic.ibTradeTry?.(att, r)) { r.traded = true; return r; }", "vic.ibTradeTry?.(att, r)) { r.traded = true; J('strike.ibTraded'); return r; }")
rep("      if (r.type === 'cut' && r.severity > 0) this.buckleCheck(att, vic, pr.v.part);", "      if (r.type === 'cut' && r.severity > 0 && !JA('buckle')) this.buckleCheck(att, vic, pr.v.part);")
rep("    if (att.weapon?.kneelHit) this.whipKneelCheck", "    if (att.weapon?.kneelHit && !JA('whipKneel')) this.whipKneelCheck")
rep("    this.koteCheck(att, vic, pr.v.part, r); // 손목 치기 칼 떨구기 (J8", "    if (!JA('kote')) this.koteCheck(att, vic, pr.v.part, r); // 손목 치기 칼 떨구기 (J8")
rep("    const hit = att.buckleRandom() < B.p * (vic.swayScale ?? 1);", "    const hit = att.buckleRandom() < B.p * (vic.swayScale ?? 1); J('roll.buckle'); if (hit) J('roll.buckle.hit');")
rep("    const drop = att.buckleRandom() < K.p;", "    const drop = att.buckleRandom() < K.p; J('roll.kote.' + kind); if (drop) J('roll.kote.drop');")
rep("    const hit = stand && att.buckleRandom() < K.p * (vic.swayScale ?? 1);", "    const hit = stand && att.buckleRandom() < K.p * (vic.swayScale ?? 1); J('roll.whip'); if (hit) J('roll.whip.hit');")
rep("    const flowD = SA && SB && J > 0 ? this.nagashiExpanded(A, B, SA, SB, point, nrm, vn) : null;\n    if (!flowD && fresh && SA && SB && J > 0) this.ibParryBeat(",
    "    const flowD = SA && SB && J > 0 && !JA('nagashi') ? this.nagashiExpanded(A, B, SA, SB, point, nrm, vn) : null;\n    if (flowD) globalThis.__JCf?.('clash.nagashi'); if (fresh) globalThis.__JCf?.('clash.fresh');\n    if (!flowD && fresh && SA && SB && J > 0 && !JA('ibBeat')) this.ibParryBeat(")
rep("    if (fresh && SA && SB && J > 0) this.koteSword(", "    if (fresh && SA && SB && J > 0 && !JA('kote')) this.koteSword(")
open(p,'w').write(s)
print("ok")
