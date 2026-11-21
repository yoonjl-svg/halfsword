import re,sys,json,collections
root=sys.argv[1]
src=open(root+'/src/config.js',encoding='utf8').read().split('\n')
leaves=json.load(open('cfg_leaves.json'))
# top-level block line ranges
starts=[(i,re.match(r'export const (\w+)',l).group(1)) for i,l in enumerate(src,1) if re.match(r'export const (\w+)',l)]
rng={}
for j,(i,n) in enumerate(starts):
    rng[n]=(i,starts[j+1][0]-1 if j+1<len(starts) else len(src))
def find(l):
    top=l['path'].split('.')[0]; a,b=rng.get(top,(1,len(src)))
    pat=re.compile(r'(?<![\w.])'+re.escape(l['key'])+r'\s*:')
    for i in range(a,b+1):
        if pat.search(src[i-1]): return i
    return None
def words(k):
    return [w.lower() for w in re.findall(r'[A-Z]?[a-z]+|[A-Z]+(?![a-z0-9])|\d+',k)]
def valtext(ln,key):
    if not ln: return ''
    t=src[ln-1]; m=re.search(r'(?<![\w.])'+re.escape(key)+r'\s*:\s*(.*)',t)
    if not m: return ''
    v=m.group(1)
    # up to next ', word:' 
    mm=re.search(r',\s*[A-Za-z_]\w*\s*:',v)
    return v[:mm.start()] if mm else v
for l in leaves:
    l['line']=find(l); l['w']=words(l['key']); l['src']=valtext(l['line'],l['key'])
json.dump(leaves,open('cfg_leaves_ann.json','w'))
dk=lambda f:sorted({l['key'] for l in leaves if f(l)})
def report(title,pred_words,matchlast=False):
    pass
# 1a multiplier
MW=['mul','mult','k','scale','gain','keep','cut','ratio','frac','factor','boost','coef','rate','share','pct','amp','weight','mix','damp','bias','coeff','fraction','per']
print('== 1a multiplier-like words: leaves / distinct keys / examples')
for w in MW:
    ls=[l for l in leaves if w in l['w']]
    # also camel suffix K e.g. slideK  -> words gives 'k'
    ks=sorted({l['key'] for l in ls})
    ex=[f"{l['path']}@{l['line']}" for l in ls[:3]]
    print(w,len(ls),len(ks),ks[:6],ex[:2])
# keys ending in K / Mul etc
print('suffix K (camel) leaves:',sum(1 for l in leaves if re.search(r'[a-z0-9]K$',l['key'])), 'exact k:',sum(1 for l in leaves if l['key']=='k'))
# 1b boolean
print('== 1b booleans')
bool_leaves=[l for l in leaves if l['type']=='boolean']
print('boolean-valued leaves',len(bool_leaves),[ (l['path'],l['line']) for l in bool_leaves])
forms={'on':r'^on$','enabled':r'^enabled$|Enabled$','use*':r'^use[A-Z]','*On':r'[a-z]On$','*Off':r'Off$|^off','no*':r'^no[A-Z]','allow*':r'^allow','is*':r'^is[A-Z]','has*':r'^has[A-Z]','can*':r'^can[A-Z]','skip*':r'^skip[A-Z]','force*':r'^force[A-Z]','disable*':r'^disable','show*':r'^show[A-Z]'}
for n,p in forms.items():
    ls=[l for l in leaves if re.search(p,l['key'])]
    print(n,len(ls),sorted({l['key'] for l in ls})[:6], 'bool-valued:',sum(1 for l in ls if l['type']=='boolean'))
# 1c time
print('== 1c time')
def isT(l):
    k=l['key']; w=l['w']
    return bool(re.search(r'(^t$|T$|Time|Sec|Seconds|Ms$|Dur|Delay|Lag|Window|Cd$|Cooldown|Wait|Hold$|Until|Linger|Life)',k)) or 't' in w or 'time' in w or 'sec' in w or 'seconds' in w or 'ms' in w
tl=[l for l in leaves if l['type']=='number' and isT(l)]
wrapped=[l for l in tl if 'realS(' in l['src']]
ms=[l for l in tl if re.search(r'Ms$',l['key'])]
raw=[l for l in tl if l not in wrapped and l not in ms]
print('time-like numeric leaves',len(tl),'realS-wrapped',len(wrapped),'name ends Ms',len(ms),'raw(other)',len(raw))
allrealS=sum(1 for l in leaves if 'realS(' in l['src'])
print('all leaves with realS( in value text',allrealS,' realS( occurrences in file',sum(s.count('realS(') for s in src),' realV(',sum(s.count('realV(') for s in src),' realRate(',sum(s.count('realRate(') for s in src))
byb=collections.defaultdict(lambda:[0,0,0])
for l in tl:
    b=l['path'].split('.')[0]
    byb[b][0 if l in wrapped else (1 if l in ms else 2)]+=1
mixed=[(b,v) for b,v in byb.items() if v[0] and v[2]]
mixed.sort(key=lambda x:-min(x[1][0],x[1][2]))
print('blocks with both wrapped and raw time-like keys (block:[wrapped,ms,raw]):',len(mixed))
for b,v in mixed[:10]: print(' ',b,v)
json.dump({b:v for b,v in mixed},open('time_mixed.json','w'))
# comments mention ms
print('time-like key suffix distribution:',collections.Counter(re.search(r'(T|Time|Sec|Seconds|Ms|Dur|Delay|Lag|Window|Wait|Hold)$',l['key']).group(1) if re.search(r'(T|Time|Sec|Seconds|Ms|Dur|Delay|Lag|Window|Wait|Hold)$',l['key']) else 'other' for l in tl))
# 1d angles
print('== 1d angles')
ang=[l for l in leaves if re.search(r'Deg$|Deg[A-Z]|Rad$|Rad[A-Z]|^deg|^rad',l['key'])]
print('names with Deg',sum(1 for l in ang if 'deg' in l['w']),'with Rad',sum(1 for l in ang if 'rad' in l['w']))
print('Deg keys',sorted({l['key'] for l in ang if 'deg' in l['w']})[:15]); print('Rad keys',sorted({l['key'] for l in ang if 'rad' in l['w']})[:15])
ang2=[l for l in leaves if re.search(r'yaw|pitch|roll|angle|fov|tilt|swing|spread|cone|arc',l['key'].lower()) and l['type']=='number']
print('angle-ish named numeric leaves (yaw/pitch/roll/angle/fov/tilt/swing/spread/cone/arc)',len(ang2),'of which carry Deg/Rad in name',sum(1 for l in ang2 if 'deg' in l['w'] or 'rad' in l['w']))
# 1e
print('== 1e max/min')
pats={'max*':r'^max[A-Z]|^max$','*Max':r'[a-z0-9]Max$','cap':r'^cap$|Cap$|^cap[A-Z]','limit':r'[Ll]imit','ceil':r'[Cc]eil','floor':r'[Ff]loor','min*':r'^min[A-Z]|^min$','*Min':r'[a-z0-9]Min$','top':r'^top$|Top$','hi/lo':r'^(hi|lo)$|(Hi|Lo)$','upper/lower':r'[Uu]pper|[Ll]ower'}
for n,p in pats.items():
    ls=[l for l in leaves if re.search(p,l['key'])]
    print(n,len(ls),sorted({l['key'] for l in ls})[:6])
