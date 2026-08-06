const fs=require('fs');const path=require('path');
const roots=['E:/SkillAd-Full-Origina/mobile-app/app','E:/SkillAd-Full-Origina/mobile-app/components'];
function walk(d,acc=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,acc);else if(/\.(tsx|ts)$/.test(e.name)&&e.name!=='searchBarStyles.ts')acc.push(p);}return acc;}
const files=walk(roots[0]).concat(walk(roots[1]));

// Extract all "..." and '...' strings with 2+ English letters, then filter
const findings=[];
for (const f of files) {
  let src=fs.readFileSync(f,'utf8');
  // strip comments
  src=src.replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).replace(/(^|[^:])\/\/.*$/gm,'$1');
  const rel=path.relative('E:/SkillAd-Full-Origina/mobile-app',f).replace(/\\/g,'/');
  // remove StyleSheet.create blocks
  src=src.replace(/StyleSheet\.create\s*\([\s\S]*?\n\);/g, m => m.replace(/[^\n]/g,' '));

  const re=/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g;
  let m;
  while((m=re.exec(src))){
    const q=m[1], val=m[2];
    if(!/[A-Za-z]{2,}/.test(val)) continue;
    if(val.length>120) continue;
    const line=src.slice(0,m.index).split(/\n/).length;
    const before=src.slice(Math.max(0,m.index-60),m.index);
    const after=src.slice(m.index+m[0].length, m.index+m[0].length+40);
    const lineTxt=src.split(/\n/)[line-1]||'';

    // exclusions
    if(/\bt\.\w+\s*$/.test(before)) continue;
    if(/translate\s*\(\s*$/.test(before)) continue;
    if(/from\s+$/.test(before) || /require\s*\(\s*$/.test(before)) continue;
    if(/import\s+/.test(lineTxt) && /from/.test(lineTxt)) continue;
    if(/\.(png|jpg|jpeg|gif|svg|webp|ttf|otf)$/i.test(val)) continue;
    if(/^#([0-9a-fA-F]{3,8})$/.test(val)) continue;
    if(/^(flex|row|column|center|left|right|absolute|relative|transparent|contain|cover|bold|normal|italic|hidden|visible|scroll|auto|none|default|cancel|destructive|solid|dashed)$/i.test(val)) continue;
    if(/^[a-z0-9]+(-[a-z0-9]+)+$/.test(val)) continue; // icons
    if(/^(GET|POST|PUT|PATCH|DELETE|HEAD)$/i.test(val)) continue;
    if(/^(pending|declined|accepted|completed|cancelled|canceled|active|inactive|online|offline|customer|provider|user|admin)$/i.test(val)) continue;
    if(/^\{[a-zA-Z0-9_]+\}$/.test(val)) continue;
    if(/^(Debug|handleChangePhoto called)$/i.test(val)) continue;
    if(/console\.(log|warn|error|debug|info)\s*\(\s*$/.test(before)) continue;
    if(/\.(replace|includes|startsWith|endsWith|indexOf|test|match|exec)\s*\(\s*$/.test(before)) continue;
    if(/\bstatus\s*:\s*$/.test(before)) continue;
    if(/\b(style|color|backgroundColor|borderColor|tintColor|shadowColor|fontFamily|fontWeight|textAlign|alignItems|justifyContent|flexDirection|resizeMode|overflow|position|display|keyboardType|autoCapitalize|autoCorrect|returnKeyType|textContentType|autocomplete|importantForAutofill|pointerEvents|hitSlop|testID|nativeID|key|id|type|mode|role|href|path|url|uri|method|headers|Content-Type|Accept|authorization)\s*[:=]\s*$/i.test(before.replace(/\s+/g,' '))) continue;
    if(/\bname\s*[:=]\s*$/.test(before) && (/ionicons|Ionicons|Material|icon/i.test(lineTxt) || /^[a-z0-9-]+$/.test(val))) continue;
    if(/\bname\s*:\s*$/.test(before) && /^[a-z][a-z0-9-]*$/.test(val)) continue; // icon names
    // comparison
    if (/\b(===|!==|==|!=)\s*$/.test(before.replace(/\s+/g,' ')) || /^\s*(===|!==|==|!=)/.test(after.replace(/\s+/g,' '))) {
      if (!/\b(title|label|message|text|placeholder|description|badge|desc|billedAs|accessibilityLabel)\b/i.test(before.slice(-80))) continue;
    }
    // only keep if looks user-facing context OR has spaces (prose) OR UI keys
    const uiCtx=/\b(placeholder|label|accessibilityLabel|accessibilityHint|headerTitle|title|message|description|badge|billedAs|desc|text|Alert\.alert|subtitle|confirmText|cancelText)\b/i.test(before.slice(-100)+lineTxt);
    const prose=/\s/.test(val) && /[A-Za-z]{3,}/.test(val);
    const capitalWord=/^[A-Z][a-z]+/.test(val);
    if(!(uiCtx||prose||capitalWord)) continue;
    // skip pure route paths
    if(/^\/\([a-z]+\)/.test(val) || /^\/[a-z]/.test(val)) continue;
    findings.push({file:rel,line,text:val,before:before.slice(-40).replace(/\s+/g,' '),kind: uiCtx?'ui-ctx':(prose?'prose':'capital')});
  }
}
// dedupe
const seen=new Set();
const u=[];
for(const f of findings){const k=f.file+'|'+f.line+'|'+f.text;if(seen.has(k))continue;seen.add(k);u.push(f);}
console.log('broad count',u.length);
const byFile={};
u.forEach(f=>byFile[f.file]=(byFile[f.file]|0)+1);
Object.entries(byFile).sort((a,b)=>b[1]-a[1]).forEach(([f,c])=>console.log(c,f));
console.log('\n---');
u.forEach(f=>console.log(f.file+':'+f.line,f.kind,JSON.stringify(f.text)));
