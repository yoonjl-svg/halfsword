import re,json,glob,collections
src=''.join(open(f,encoding='utf-8').read() for f in glob.glob('wt_main/src/*.js'))
d=json.load(open('A/tbl.json'))
hdr=None;rows={}
for l in open('wt_main/docs/strike/owner_defaults_table.md',encoding='utf-8'):
    if not l.startswith('|'): continue
    c=[x.strip() for x in l.strip().strip('|').split('|')]
    if c[0]=='번호': hdr=c; continue
    m=re.match(r'^\**(\d+)\**$',c[0])
    if m: rows[int(m.group(1))]=l
def status(n):
    l=rows[n]
    if re.search(r'기본 끔|\(끔\)|끔 =|꺼 둠|꺼짐|폐기|지움|걷어|뺌|없앰|안 씀|시험 스위치|시뮬 전용|도구 잣대|코드에는 아직 없음',l): return 'off/gone'
    ids=set(re.findall(r'`([A-Za-z_][\w.]*)',l))
    keys=[i.split('.')[-1] for i in ids if len(i.split('.')[-1])>=4]
    if not keys: return 'no-id'
    pres=[k for k in keys if re.search(r'\b%s\b'%re.escape(k),src)]
    return 'live-id' if pres else 'id-missing'
for cat in ['UNANSWERED','EMPTY']:
    c=collections.Counter(status(n) for n in d[cat]); print(cat,len(d[cat]),dict(c))
# empty rows by number range
e=d['EMPTY']; print('EMPTY ranges', min(e), max(e), sum(1 for n in e if n<1000), sum(1 for n in e if n>=2000))
