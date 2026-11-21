import re,sys,collections,json
f=sys.argv[1]
hdr=None;rows={}
for ln,l in enumerate(open(f,encoding='utf-8'),1):
    if not l.startswith('|'): continue
    cells=[c.strip() for c in l.strip().strip('|').split('|')]
    if cells and cells[0]=='번호': hdr=cells; continue
    m=re.match(r'^\**(\d+)\**$',cells[0]) if cells else None
    if not m or not hdr: continue
    n=int(m.group(1))
    if '답' in hdr: i=hdr.index('답'); kind='ans'
    elif '상태' in hdr: i=hdr.index('상태'); kind='st'
    else: i=len(hdr)-1; kind='?'
    v=cells[i] if i<len(cells) else ''
    rows.setdefault(n,[]).append((ln,kind,v,l))
print('rows distinct',len(rows),'min',min(rows),'max',max(rows))
dup=[n for n in rows if len(rows[n])>1]; print('dup numbers',len(dup))
def cls(v):
    if v=='' : return 'EMPTY'
    if re.search(r'확인 전|미답|답 전|답 없|기다림|여쭘',v): return 'UNANSWERED'
    if re.search(r'사장님',v): return 'OWNER'
    return 'OTHER'
c=collections.Counter(); ex=collections.defaultdict(list)
for n,lst in rows.items():
    k=cls(lst[-1][2]); c[k]+=1; ex[k].append(n)
print(c)
for k in ex:
  vals=collections.Counter(rows[n][-1][2][:40] for n in ex[k])
  print('==',k, vals.most_common(25))
json.dump({k:sorted(v) for k,v in ex.items()},open(sys.argv[2],'w'))
