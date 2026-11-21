import re,sys,os,glob,collections,json
root=sys.argv[1]
files=sorted(glob.glob(root+'/src/*.js'))
defre=re.compile(r'^(\s*)(?:export\s+)?(?:function\s+(\w+)\s*\(|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|\w+\s*=>))')
def body(text,pos):
    # from pos (after match start) find extent: bracket matching until statement end
    depth=0;i=pos;n=len(text);instr=None;started=False
    while i<n:
        c=text[i]
        if instr:
            if c=='\\': i+=2;continue
            if c==instr: instr=None
        elif c in '"\'`': instr=c
        elif c=='/' and text[i+1:i+2]=='/':
            j=text.find('\n',i); i=j if j>=0 else n; continue
        elif c=='/' and text[i+1:i+2]=='*':
            j=text.find('*/',i); i=j+2 if j>=0 else n; continue
        elif c in '({[': depth+=1; started=started or c=='{'
        elif c in ')}]':
            depth-=1
            if depth==0 and c=='}' and started:
                # function declaration ends; arrow const may continue to ; but ok
                return text[pos:i+1]
            if depth<0: return text[pos:i]
        elif depth==0 and (c==';' or (c=='\n' and not started and text[pos:i].count('=>')>0 and text[i+1:i+2] not in ' \t.?:&|+-*/(')):
            return text[pos:i]
        i+=1
    return text[pos:]
def strip_comments(s):
    s=re.sub(r'/\*.*?\*/','',s,flags=re.S); s=re.sub(r'//[^\n]*','',s); return re.sub(r'\s+','',s)
defs=collections.defaultdict(list)
for f in files:
    t=open(f,encoding='utf8').read()
    off=0
    for m in re.finditer(r'(?m)^',t):
        pass
    for m in re.finditer(r'(?m)^(\s*)(?:export\s+)?(?:function\s+(\w+)\s*\(|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|\w+\s*=>))',t):
        name=m.group(2) or m.group(3)
        b=body(t,m.start(2) if m.group(2) else m.start(3))
        line=t.count('\n',0,m.start())+1
        defs[name].append((os.path.basename(f),line,strip_comments(b),b.count('\n')+1,len(m.group(1))==0))
res=[]
for name,l in defs.items():
    fs={x[0] for x in l}
    if len(fs)>=2:
        norm=collections.Counter(x[2] for x in l)
        top=[x for x in l if x[4]]
        res.append(dict(name=name,files=len(fs),defs=len(l),top_defs=len(top),distinct_bodies=len(norm),biggest_identical_group=norm.most_common(1)[0][1],lines=sum(x[3] for x in l),dup_lines=sum(x[3] for x in l)-max(x[3] for x in l),ex=[f'{x[0]}:{x[1]}' for x in l[:3]]))
res.sort(key=lambda r:-r['dup_lines'])
json.dump(res,open('dups.json','w'),indent=0)
want='clamp clamp01 lerp smooth smoothstep smoothStep sign wrapAngle angleDiff len dist rand rnd mulberry32 seeded easeOut easeIn easeInOut easeOutCubic easeOutQuad ease realS lerpAngle shortestAngle wrap01 sat saturate mix hypot dot cross norm normalize v3 vec len2 dist2 pick randRange randIn rand01 sgn deg2rad toRad toDeg D2R DEG'.split()
print('distinct fn/const-fn names',len(defs),'names defined in >=2 files',len(res),'total dup lines (sum over names of all-but-largest copy)',sum(r['dup_lines'] for r in res))
print('name files defs topdefs distinctBodies biggestIdentGroup lines dup_lines examples')
for r in res:
    if r['name'] in want or r['dup_lines']>=30 or r['files']>=4:
        print(r['name'],r['files'],r['defs'],r['top_defs'],r['distinct_bodies'],r['biggest_identical_group'],r['lines'],r['dup_lines'],r['ex'])
