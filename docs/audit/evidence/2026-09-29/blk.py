import sys,re
# usage: blk.py file regex  -> prints start,end,len of the brace block starting at first line matching regex
f,rx=sys.argv[1],sys.argv[2]
L=open(f).read().split('\n')
for i,l in enumerate(L):
    if re.search(rx,l):
        d=0;seen=False
        for j in range(i,len(L)):
            s=re.sub(r"//.*","",L[j]); s=re.sub(r"'[^']*'|\"[^\"]*\"|`[^`]*`","",s)
            d+=s.count('{')-s.count('}')
            if s.count('{'): seen=True
            if seen and d<=0: print(f"{f}:{i+1}-{j+1} ({j-i+1} lines) {l.strip()[:80]}"); break
        break
