import re,sys
old=open('A/config_0930.js',encoding='utf-8').read()
oldkeys=set(re.findall(r'([A-Za-z_][A-Za-z0-9_]*)\s*:',old))
pat=re.compile(r'(min|max|cap|floor|cool|Cd\b|cd[A-Z]|gap|hold|lock|window|win[A-Z]|delay|freeze|stun|limit|quiet|wait|stiff|recover|lag|ceil|clamp|gate|refract|rest[A-Z]|Dwell|dwell|after|time|dur|cost)',re.I)
lines=open('wt_main/src/config.js',encoding='utf-8').read().split('\n')
out=[]
for i,l in enumerate(lines,1):
    code=l.split('//')[0]
    for k in re.findall(r'([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(?:realS\(|realV\(|realRate\()?-?[0-9.]',code):
        if k in oldkeys: continue
        if not pat.search(k): continue
        ctx=' '.join(lines[max(0,i-4):i])
        st='OWNER' if re.search(r'사장님[^확]{0,40}(결정|지시|승인|확인 1|ok|\'|")',l) else ('UNCONF' if '확인 전' in l else ('?'))
        out.append(f'{i}\t{k}\t{st}')
print(len(out))
open('A/newkeys.tsv','w').write('\n'.join(out))
