import sys
p=sys.argv[1]; s=open(p).read()
def rep(old,new,count=1):
    global s
    n=s.count(old)
    if n!=count: raise SystemExit(f"count {n} for: {old[:70]}")
    s=s.replace(old,new)
rep("import { bwTick } from './burst_whiff.js';", "import { J, JA } from './_j.js';\nimport { bwTick } from './burst_whiff.js';")
rep("      if (fallTilt > BODY.fallTiltDeg || this.balance <= 0 || lostFooting) this.knockDown(fallTilt > BODY.fallTiltDeg + 15);\n      else if (this.legsCannotSupport) this.knockDown(false);",
    "      if (fallTilt > BODY.fallTiltDeg || this.balance <= 0 || lostFooting) { J('kd.' + (fallTilt > BODY.fallTiltDeg ? 'tilt' : this.balance <= 0 ? 'balance' : 'footing') + (fallTilt > BODY.fallTiltDeg + 15 ? '.heavy' : '.light')); this.knockDown(fallTilt > BODY.fallTiltDeg + 15); }\n      else if (this.legsCannotSupport) { J('kd.legs'); this.knockDown(false); }")
rep("        if (h.energy * k > 45) this.knockDown(h.energy * k > 90);", "        if (h.energy * k > 45 && this.state === 'stand') J('kd.headBlunt' + (h.energy * k > 90 ? '.heavy' : '.light'));\n        if (h.energy * k > 45 && !JA('headBluntKD')) this.knockDown(h.energy * k > 90);")
rep("    if (!noRevive && tryRevive(this, cause)) return;", "    if (!noRevive && tryRevive(this, cause)) { J('revive.' + cause); return; }\n    J('die.' + cause + (noRevive ? '.finish' : ''));")
rep("    this.decapitated = true;", "    this.decapitated = true; J('decap');")
rep("  dropSword() {", "  dropSword() {\n    if (this.armed) J('dropSword');")
rep("  knockOffHelmet(dir, energy) {", "  knockOffHelmet(dir, energy) {\n    if (this.hasHelmet) J('helmetOff');")
rep("    const bleed = this.physiology.bleeds ? sev * bleedPerSev", "    J('wound.' + h.type + '.' + (sev < 0.1 ? 'lt0.1' : sev < 0.5 ? 'lt0.5' : sev < 1 ? 'lt1' : 'ge1'));\n    const bleed = this.physiology.bleeds ? sev * bleedPerSev")
open(p,'w').write(s); print('ok')
