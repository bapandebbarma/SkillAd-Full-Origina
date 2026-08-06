const fs=require('fs');const path=require('path');
const roots=['E:/SkillAd-Full-Origina/mobile-app/app','E:/SkillAd-Full-Origina/mobile-app/components'];
function walk(d,acc=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,acc);else if(/\.(tsx|ts)$/.test(e.name))acc.push(p);}return acc;}
const files=walk(roots[0]).concat(walk(roots[1]));
// Find Text ... > with literal on same or next lines not using t.
for (const f of files) {
  const src=fs.readFileSync(f,'utf8');
  const rel=path.relative('E:/SkillAd-Full-Origina/mobile-app',f).replace(/\\/g,'/');
  const lines=src.split(/\n/);
  for (let i=0;i<lines.length;i++){
    if (!/<Text\b/.test(lines[i])) continue;
    // gather until </Text>
    let block=lines[i]; let j=i;
    while(j<lines.length && !/<\/Text>/.test(block)) { j++; if(j<lines.length) block+='\n'+lines[j]; }
    // remove {t.xxx} and {translate(...)} and other expressions
    let lit=block.replace(/\{[^}]+\}/g,'');
    lit=lit.replace(/<\/?Text\b[^>]*>/g,'');
    lit=lit.replace(/\/\*.*?\*\//g,'').trim();
    if (!lit) continue;
    if (!/[A-Za-z]{2,}/.test(lit)) continue;
    if (/\bt\.|translate\(/.test(block) && !/[A-Za-z]{2,}/.test(lit)) continue;
    // if block has t. and remaining lit is only punctuation/whitespace, skip
    const cleaned=lit.replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').trim();
    if (!cleaned || !/[A-Za-z]{2,}/.test(cleaned)) continue;
    // skip if only style-related leftovers
    console.log(rel+':'+(i+1)+' TEXT_LIT='+JSON.stringify(cleaned.slice(0,100)));
  }
}
