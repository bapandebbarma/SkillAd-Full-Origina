const fs=require('fs');const path=require('path');
const roots=['E:/SkillAd-Full-Origina/mobile-app/app','E:/SkillAd-Full-Origina/mobile-app/components'];
function walk(d,acc=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,acc);else if(/\.(tsx|ts)$/.test(e.name))acc.push(p);}return acc;}
const files=walk(roots[0]).concat(walk(roots[1]));

// Find object UI fields with English literals
const uiKeys='title|headerTitle|headerBackTitle|tabBarLabel|label|message|description|placeholder|subtitle|badge|billedAs|desc|hint|emptyText|buttonText|confirmText|cancelText|okText|name|caption|helperText|errorText|successMessage|errorMessage';
const re=new RegExp('\\b('+uiKeys+')\\s*:\\s*["\`]([^"\`\\\\]|\\\\.)*["\`]','g');

for (const f of files) {
  const src=fs.readFileSync(f,'utf8');
  const rel=path.relative('E:/SkillAd-Full-Origina/mobile-app',f).replace(/\\/g,'/');
  let m;
  const re2=new RegExp(re.source,'g');
  while((m=re2.exec(src))){
    const val=m[0].split(':').slice(1).join(':').trim();
    const line=src.slice(0,m.index).split(/\n/).length;
    const full=m[0];
    // skip empty
    if (/:\s*["\`]["\`]$/.test(full)) continue;
    if (/\bt\./.test(src.slice(Math.max(0,m.index-30),m.index))) continue;
    console.log(rel+':'+line+'  '+full.slice(0,120));
  }
}

console.log('\n## Multiline JSX-ish: lines with only quoted English in Text context');
// Search for >\n\s*English
for (const f of files) {
  const src=fs.readFileSync(f,'utf8');
  const rel=path.relative('E:/SkillAd-Full-Origina/mobile-app',f).replace(/\\/g,'/');
  const lines=src.split(/\n/);
  for (let i=0;i<lines.length;i++){
    const L=lines[i];
    // line that is mostly a string literal assignment shown in UI - Text>
    if (/>\s*$/.test(L) && i+1<lines.length) {
      const n=lines[i+1].trim();
      if (/^[A-Za-z][A-Za-z0-9 ,.'!?&\-]{2,}$/.test(n) && !/^(return|const|let|var|function|if|else|switch|case|import|export|type|interface)\b/.test(n)) {
        console.log(rel+':'+(i+2)+'  jsx-next-line '+JSON.stringify(n));
      }
    }
    // {\"English\"} 
    if (/\{\s*["'][A-Za-z]/.test(L) && !/\bt\.|translate\(/.test(L)) {
      const mm=L.match(/\{\s*(["'])([^"'\\{]+)\1\s*\}/);
      if (mm && /[A-Za-z]{3,}/.test(mm[2]) && !/^(flex|row|column|center|absolute|relative|transparent)$/i.test(mm[2])) {
        // might be style
        if (!/style|color|font|align|justify|position|display|overflow/.test(L))
          console.log(rel+':'+(i+1)+'  expr '+JSON.stringify(mm[2])+' :: '+L.trim().slice(0,100));
      }
    }
  }
}
