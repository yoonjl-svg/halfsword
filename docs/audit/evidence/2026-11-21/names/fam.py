import re,glob,os,collections,sys
root=sys.argv[1]
fs={os.path.basename(f)[:-3]:f for f in glob.glob(root+'/src/*.js')}
imp=collections.defaultdict(set)
for n,f in fs.items():
    t=open(f,encoding='utf8').read()
    for m in re.finditer(r"""(?:import[^;'"]*?from\s*|import\s*\(\s*|import\s+)['"]\.\/([\w\-/]+)(?:\.js)?['"]""",t):
        d=m.group(1)
        if d in fs and d!=n: imp[n].add(d)
fam=['stage','outfit','ai','saengsa','secret','jp','cn','ib','it','de','ui','lobby','shop','skill','team','weapon','character','start','entrance']
def fo(n):
    p=n.split('_')[0]; return p if p in fam else None
rev=collections.defaultdict(set)
for a,bs in imp.items():
    for b in bs: rev[b].add(a)
print('files',len(fs),'with import edges',sum(1 for n in fs if imp[n]),'total edges',sum(len(v) for v in imp.values()))
print('== unprefixed files imported (or importing) only by one family (>=2 importers, >=80% same family)')
for n in sorted(fs):
    if fo(n): continue
    imps=rev[n]
    if len(imps)>=2:
        c=collections.Counter(fo(x) for x in imps if fo(x))
        if c:
            f,k=c.most_common(1)[0]
            if k/len(imps)>=0.8: print(' imported-by',n,f,f'{k}/{len(imps)}')
for n in sorted(fs):
    if fo(n): continue
    out=imp[n]
    if len(out)>=2:
        c=collections.Counter(fo(x) for x in out if fo(x))
        if c:
            f,k=c.most_common(1)[0]
            if k/len(out)>=0.6: print(' imports',n,f,f'{k}/{len(out)}')
print('== prefix files that import mostly from another family (cross-family)')
print('== unprefixed files whose importers are ALL in one family (>=1 importer, excluding registry)')
for n in sorted(fs):
    if fo(n): continue
    imps=rev[n]
    if imps and all(fo(x) for x in imps):
        c=collections.Counter(fo(x) for x in imps)
        if len(c)==1: print(' ',n,'<-',list(c)[0],len(imps))
print('== prefix counts (top-level src js)')
c=collections.Counter(fo(n) or '(none)' for n in fs)
print(dict(c))
print('== unprefixed files with no importers (entry/orphan?)')
print([n for n in sorted(fs) if not rev[n]][:60], sum(1 for n in fs if not rev[n]))
