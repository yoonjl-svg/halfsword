import os,re,sys,collections
root=sys.argv[1]+'/docs'
allf=[]
for d,_,fs in os.walk(root):
    for f in fs: allf.append(os.path.join(d,f))
rel=lambda p:os.path.relpath(p,root)
md=[p for p in allf if p.endswith('.md')]
print('docs files',len(allf),'md',len(md))
img=('.png','.webp','.jpg','.jpeg','.gif','.svg')
top=collections.defaultdict(lambda:collections.Counter())
for p in allf:
    r=rel(p).split(os.sep); t=r[0] if len(r)>1 else '(root)'
    e=os.path.splitext(p)[1].lower()
    top[t]['md' if e=='.md' else 'img' if e in img else 'json' if e=='.json' else 'other']+=1
print('top-level: folder md img json other')
for t,c in sorted(top.items(),key=lambda x:-sum(x[1].values())): print(' ',t,c['md'],c['img'],c['json'],c['other'])
A=re.compile(r'_(20\d\d-\d\d-\d\d)(?=\.|_|$)'); B=re.compile(r'-(20\d{6})(?=\.|$)')
cat=collections.Counter(); stems=collections.defaultdict(set)
for p in md:
    n=os.path.basename(p)[:-3]
    a=A.search(n); b=B.search(n)
    if a: cat['A _YYYY-MM-DD']+=1; stems[(os.path.dirname(rel(p)),A.sub('',n))].add(a.group(1))
    elif b: cat['B -YYYYMMDD']+=1; stems[(os.path.dirname(rel(p)),B.sub('',n))].add(b.group(1))
    else: cat['no date']+=1
    if re.search(r'\d{4}-\d{2}-\d{2}',n) and not a: cat['other date-in-name (not suffix)']+=1
    if re.search(r'(?<!\d)\d{8}(?!\d)',n) and not b: cat['8-digit in name not -YYYYMMDD']+=1
print(dict(cat))
# name patterns of all md
pat=collections.Counter()
for p in md:
    n=os.path.basename(p)[:-3]
    pat['has hyphen' if '-' in n else 'underscore/other']+=1
    if re.search(r'[A-Z]',n): pat['has uppercase']+=1
    if re.search(r'[가-힣]',n): pat['hangul in name']+=1
print(dict(pat))
st=sorted(((len(v),k) for k,v in stems.items() if len(v)>=3),reverse=True)
print('stems with >=3 dated versions:',len(st),'; stems with >=2:',sum(1 for v in stems.values() if len(v)>=2))
for n,k in st[:10]: print('  ',n,k[0]+'/'+k[1],sorted(stems[k])[:3],'...')
big=[(os.path.getsize(p),rel(p)) for p in md if os.path.getsize(p)>200*1024]
print('md >200KB:',sorted(big,reverse=True))
print('md >50KB count:',sum(1 for p in md if os.path.getsize(p)>50*1024),'total md bytes',sum(os.path.getsize(p) for p in md))
# index/README per folder
dirs=[d for d,_,fs in os.walk(root) if any(f.endswith('.md') for f in fs)]
idx=lambda d:any(f.lower() in('readme.md','index.md') for f in os.listdir(d))
withidx=[d for d in dirs if idx(d)]
print('folders containing md',len(dirs),'with README/index',len(withidx))
tops=[d for d in os.listdir(root) if os.path.isdir(os.path.join(root,d))]
print('top-level folders',len(tops),'with README/index.md:',[d for d in tops if idx(os.path.join(root,d))],'without:',[d for d in tops if not idx(os.path.join(root,d))])
print('root README/index:',idx(root))
# sizes by top
sz=collections.Counter()
for p in md: sz[rel(p).split(os.sep)[0] if os.sep in rel(p) else '(root)']+=os.path.getsize(p)
print('md bytes by top:',sz.most_common(6))
