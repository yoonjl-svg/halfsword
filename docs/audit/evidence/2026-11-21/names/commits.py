import re,sys,collections,statistics
S=[l.rstrip('\n') for l in open(sys.argv[1],encoding='utf8')]
n=len(S)
L=[len(s) for s in S]
print('titles',n,'median len',statistics.median(L),'mean %.1f'%statistics.mean(L),'max',max(L),'>120:',sum(x>120 for x in L),'>200:',sum(x>200 for x in L),'<=10:',sum(x<=10 for x in L))
pre=collections.Counter()
for s in S:
    m=re.match(r'^([^\s:：—]{1,16}(?: [^\s:：—]{1,10})?)\s?[:：]',s)
    pre[m.group(1) if m else '(none)']+=1
print('prefix-before-colon (top 15):',pre.most_common(15))
conv=sum(v for k,v in pre.items() if k!='(none)')
print('titles with "X:" prefix',conv,'%.0f%%'%(100*conv/n))
big=sum(pre[k] for k in ['합침','결정 기록','기록'])
print('top-3 prefixes (합침/결정 기록/기록) share',big,'%.0f%%'%(100*big/n))
# no colon but starts with 생사전 / area word
first=collections.Counter(s.split()[0] if s.split() else '' for s in S if not re.match(r'^[^\s:：—]{1,16}(?: [^\s:：—]{1,10})?\s?[:：]',s))
print('no-colon titles',sum(first.values()),'first words top:',first.most_common(12))
print('dev <hash> 합침 style:',sum(1 for s in S if re.match(r'^dev [0-9a-f]{7,8} ',s)))
print('contain 사장님 quote ref:',sum('사장님' in s for s in S),' contain date like 11/21:',sum(bool(re.search(r'\d{1,2}/\d{1,2}',s)) for s in S))
bad=[s for s in S if re.fullmatch(r'(?i)\s*(tmp|wip|test|fix|fixes|update|\.+|x|asdf|misc|temp|stuff|changes?|commit|save|backup|wip.*|fix.*|test.*|tmp.*)\s*',s)]
print('meaningless (regex tmp/wip/test/fix/update/./misc exact):',len(bad),bad[:8])
print('non-Korean (no hangul) titles:',sum(1 for s in S if not re.search(r'[가-힣]',s)),[s for s in S if not re.search(r'[가-힣]',s)][:6])
print('ASCII-only English-looking:',sum(1 for s in S if re.fullmatch(r'[\x00-\x7f]+',s)))
print('shortest 5:',sorted(S,key=len)[:5]); print('longest 2 lens:',sorted(L)[-3:], [s[:60] for s in sorted(S,key=len)[-1:]])
print('merge-commit style ("Merge ..."):',sum(s.startswith('Merge') for s in S))
