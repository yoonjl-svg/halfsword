import sys,glob,os,json
root=sys.argv[1]
def split(t):
    com=0;code=0;i=0;n=len(t);instr=None;enc=lambda s:len(s.encode('utf8'))
    start=0;mode='code'
    out_c=[];
    while i<n:
        c=t[i]
        if instr:
            if c=='\\': i+=2;continue
            if c==instr: instr=None
            i+=1;continue
        if c in '"\'`': instr=c;i+=1;continue
        if c=='/' and t[i+1:i+2]=='/':
            j=t.find('\n',i); j=n if j<0 else j
            com+=enc(t[i:j]); i=j; continue
        if c=='/' and t[i+1:i+2]=='*':
            j=t.find('*/',i); j=n if j<0 else j+2
            com+=enc(t[i:j]); i=j; continue
        i+=1
    return com
rows=[]
for f in sorted(glob.glob(root+'/src/*.js')):
    t=open(f,encoding='utf8').read()
    tot=len(t.encode('utf8')); com=split(t)
    L=t.split('\n')
    rows.append(dict(f=os.path.basename(f),tot=tot,com=com,code=tot-com,share=com/tot if tot else 0,
      gt200=sum(len(l)>200 for l in L),gt400=sum(len(l)>400 for l in L),gt1000=sum(len(l)>1000 for l in L),
      longest=sorted(((len(l),i+1) for i,l in enumerate(L)),reverse=True)[:5]))
json.dump(rows,open('density.json','w'))
T=sum(r['tot'] for r in rows);C=sum(r['com'] for r in rows)
print('src total bytes',T,'comment bytes',C,'share %.1f%%'%(100*C/T),'files',len(rows))
big=[r for r in rows if r['tot']>20000]
print('files >20KB',len(big))
print('top10 by comment share (files>20KB): file total_KB comment_KB share')
for r in sorted(big,key=lambda r:-r['share'])[:10]: print(' ',r['f'],r['tot']//1024,r['com']//1024,'%.0f%%'%(100*r['share']))
print('lines >200/>400/>1000 across src:',sum(r['gt200'] for r in rows),sum(r['gt400'] for r in rows),sum(r['gt1000'] for r in rows))
allL=[]
for r in rows:
    for ln,i in r['longest']: allL.append((ln,r['f'],i))
allL.sort(reverse=True); print('5 longest lines in src:',allL[:5])
cr=[r for r in rows if r['f']=='config.js'][0]
print('config.js: total',cr['tot'],'comment',cr['com'],'share %.1f%%'%(100*cr['com']/cr['tot']),'>200/400/1000:',cr['gt200'],cr['gt400'],cr['gt1000'],'longest',cr['longest'])
print('files with any line>1000:',sum(1 for r in rows if r['gt1000']),'files with any >200:',sum(1 for r in rows if r['gt200']))
# top by gt200
print('top files by lines>200:',[(r['f'],r['gt200']) for r in sorted(rows,key=lambda r:-r['gt200'])[:6]])
