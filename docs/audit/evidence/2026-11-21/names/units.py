import re,sys
root=sys.argv[1]
t=open(root+'/src/config.js',encoding='utf8').read()
# comments only
com=[]
for l in t.split('\n'):
    i=l.find('//')
    if i>=0: com.append(l[i:])
c='\n'.join(com)
print('comment bytes',len(c.encode()),'lines with comments',len(com))
def n(label,p,s=c,flags=0): print(f'{label:34s}{len(re.findall(p,s,flags))}')
n('m/s','m/s'); n('㎧','㎧'); n('미터/초','미터/초|미터 매 초'); n('m (number+space m) ',r'\d\s?m(?![/a-zA-Z])'); n('미터',r'미터'); n('cm',r'\dcm|\d cm'); n('mm',r'\d ?mm')
n('초 (digit+초 / 초당)',r'\d\s?초'); n('s (digit+s)',r'\d\s?s(?![a-zA-Z])'); n('"초" any','초')
n('ms (digit+ms)',r'\d\s?ms(?![a-zA-Z])'); n('밀리초','밀리초'); n('ms word',r'(?<![a-zA-Z])ms(?![a-zA-Z])')
n('° (digit+°)',r'\d\s?°'); n('도 (digit+도)',r'\d\s?도(?![로시])'); n('deg word',r'(?<![a-zA-Z])deg(?![a-zA-Z])|\d\s?deg'); n('rad',r'\d\s?rad(?![a-zA-Z])|라디안'); n('π/pi','π')
n('N (digit+N)',r'\d\s?N(?![a-zA-Z])'); n('뉴턴','뉴턴'); n('kg (digit+kg)',r'\d\s?kg'); n('킬로','킬로'); n('J (digit+J)',r'\d\s?J(?![a-zA-Z])'); n('줄(Joule)','줄\b|N·m')
n('px',r'\d\s?px'); n('Hz',r'\d\s?Hz'); n('fps',r'fps'); n('%',r'\d\s?%'); n('퍼센트','퍼센트|프로')
n('배 (digit+배)',r'\d\s?배'); n('× (multiplication sign)','×'); n('x (digit x)',r'\d x\b')
