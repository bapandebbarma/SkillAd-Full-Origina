const fs=require('fs');const path=require('path');
const roots=['E:/SkillAd-Full-Origina/mobile-app/app','E:/SkillAd-Full-Origina/mobile-app/components'];
function walk(d,acc=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,acc);else if(/\.(tsx|ts)$/.test(e.name))acc.push(p);}return acc;}
const files=walk(roots[0]).concat(walk(roots[1]));
function show(title, re) {
  console.log('\n## '+title);
  for (const f of files) {
    const lines=fs.readFileSync(f,'utf8').split(/\n/);
    const rel=path.relative('E:/SkillAd-Full-Origina/mobile-app',f).replace(/\\/g,'/');
    lines.forEach((line,i)=>{
      if (!re.test(line)) return;
      re.lastIndex=0;
      if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) return;
      console.log(rel+':'+(i+1)+'  '+line.trim().slice(0,180));
    });
  }
}
show('placeholder= literal', /\bplaceholder\s*=\s*[\{\s]*["']/);
show('accessibilityLabel literal', /\baccessibilityLabel\s*=\s*[\{\s]*["']/);
show('Alert.alert starts with quote', /Alert\.alert\s*\(\s*["'`]/);
show('headerTitle/title/tabBarLabel', /\b(headerTitle|title|tabBarLabel)\s*:\s*["']/);
show('label: literal', /\blabel\s*:\s*["']/);
show('JSX text capital start', />[A-Z][a-zA-Z][^<>{]{1,80}</);
show('Alert.alert any', /Alert\.alert\s*\(/);
