import fs from 'node:fs';
export const defaultReportTemplate=fs.readFileSync(new URL('./default-report-template.md',import.meta.url),'utf8');
export function reportTemplate(text){
 if(typeof text!=='string'||!text.trim()||text.length>100000)throw Error('Report Template must be nonempty Markdown, at most 100,000 characters.');
 const sections=[];let role=null,key=null,fenced=false;
 for(const line of text.split(/\r?\n/)){
  if(/^\s*```/.test(line)){fenced=!fenced;continue;}if(fenced)continue;
  const r=/^<!-- role: (.+) -->$/.exec(line),k=/^<!-- section: (.+) -->$/.exec(line);
  if(r){if(r[1]!=='criteria')throw Error('Unknown Report Template role. Use criteria.');role=r[1];continue;}
  if(k){key=k[1].trim();continue;}
  const h=/^## (.+)$/.exec(line);if(h){sections.push({title:key||h[1].trim(),displayTitle:h[1].trim(),role});role=null;key=null;}
 }
 if(!sections.length||sections.length>40||new Set(sections.map(s=>s.title)).size!==sections.length)throw Error('Report Template requires 1–40 uniquely identified ## chapters.');
 if(sections.filter(s=>s.role==='criteria').length!==1)throw Error('Report Template must mark exactly one chapter with <!-- role: criteria --> before its ## heading.');
 return sections;
}
export const snapshotChapters=snapshot=>reportTemplate(snapshot?.reportTemplate||defaultReportTemplate);
export const criteriaChapter=snapshot=>snapshotChapters(snapshot).find(s=>s.role==='criteria').title;
