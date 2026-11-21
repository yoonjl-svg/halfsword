import os,re,sys,collections
base=sys.argv[1]
D1=re.compile(r'20\d\d-\d\d-\d\d'); D2=re.compile(r'(?<!\d)20\d{6}(?!\d)'); D3=re.compile(r'(?<!\d)\d{1,2}-\d{1,2}(?!\d)|(?<!\d)\d{4}(?!\d)')
for sub in ['docs','tools','src','public','art','data']:
    r=os.path.join(base,sub)
    if not os.path.isdir(r): continue
    c=collections.Counter(); n=0
    for d,_,fs in os.walk(r):
        if 'node_modules' in d: continue
        for f in fs:
            n+=1
            a=D1.search(f); b=D2.search(f)
            if a: c['YYYY-MM-DD in name']+=1
            if b: c['YYYYMMDD in name']+=1
    print(sub,'files',n,dict(c))
root=os.path.join(base,'docs')
stems=collections.defaultdict(set); pos=collections.Counter()
for d,_,fs in os.walk(root):
    for f in fs:
        if not f.endswith('.md'): continue
        n=f[:-3]
        m=D1.search(n) or D2.search(n)
        if not m: continue
        pre,suf=n[:m.start()],n[m.end():]
        pos['suffix' if not suf else ('prefix' if not pre else 'middle')]+=1
        key=(os.path.relpath(d,root),pre.rstrip('_-')+'|'+suf)
        stems[key].add(m.group(0))
print('date position in md names',dict(pos))
print('stems with >=3 distinct dates',sum(1 for v in stems.values() if len(v)>=3),' >=2:',sum(1 for v in stems.values() if len(v)>=2))
for k,v in sorted(stems.items(),key=lambda x:-len(x[1]))[:10]: print(' ',len(v),k)
# loose: stem ignoring date, across whole docs, topic-first-word grouping
tw=collections.defaultdict(set)
for d,_,fs in os.walk(root):
    for f in fs:
        if f.endswith('.md'):
            n=re.sub(r'[_-]?(20\d\d-\d\d-\d\d|20\d{6})','',f[:-3]); 
            tw[n].add(os.path.relpath(os.path.join(d,f),root))
print('md names that collide after removing date (same stem, any folder), count>=2:',sum(1 for v in tw.values() if len(v)>=2))
