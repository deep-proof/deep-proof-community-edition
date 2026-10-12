import {defaultReportTemplate} from './report-template.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {safeDirectory,writeArtifact} from './safe-files.mjs';
import {legacyReportToMarkdown} from './markdown-report.mjs';
const safe=value=>{if(!/^[a-zA-Z0-9_-]+$/.test(value))throw Error('Invalid artifact identifier.');return value;};
export const projectFolder=(dir,pid)=>path.join(dir,'projects',safe(pid));
export const analysisFolder=(dir,pid,rid)=>path.join(projectFolder(dir,pid),'analyses',safe(rid));
export function writeProjectFiles(dir,project,documents){
 const folder=projectFolder(dir,project.id);safeDirectory(folder,'documents');
 writeArtifact(folder,'project.md',`# ${project.company}\n\nProject ID: ${project.id}\n\nStatus: ${project.archived_at?'Archived':'Active'}\n`);
 for(const d of documents)writeArtifact(folder,'documents/'+safe(d.id)+'.md',d.markdown);
 return folder;
}
export function writeAnalysisSources(folder,snapshot){
 safeDirectory(folder,'sources');safeDirectory(folder,'charts');
 writeArtifact(folder,'report-template.md',snapshot.reportTemplate||defaultReportTemplate);
 writeArtifact(folder,'review-criteria.md',snapshot.type.criteria);writeArtifact(folder,'review-playbook.md',snapshot.type.playbook);
 for(const d of snapshot.documents)writeArtifact(folder,'sources/'+safe(d.id)+'.md',d.markdown);
 writeArtifact(folder,'sources/index.md','# Evidence inventory\n\n'+snapshot.documents.map(d=>`- ${d.id}.md — ${d.title}`).join('\n'));
}
export function migrateArtifacts(db,dir){
 for(const project of db.prepare('SELECT * FROM projects').all()){
  writeProjectFiles(dir,project,db.prepare('SELECT * FROM documents WHERE project_id=?').all(project.id));
  for(const run of db.prepare('SELECT * FROM runs WHERE project_id=?').all(project.id)){
   const folder=analysisFolder(dir,project.id,run.id),old=path.join(dir,'jobs',safe(run.id));
   if(!fs.existsSync(folder)&&fs.existsSync(old)){fs.mkdirSync(path.dirname(folder),{recursive:true});fs.renameSync(old,folder);}
   writeAnalysisSources(folder,JSON.parse(run.snapshot));
   if(run.result&&!fs.existsSync(path.join(folder,'report.md'))){const result=JSON.parse(run.result);if(result.sections)writeArtifact(folder,'report.md',legacyReportToMarkdown(result));}
  }
 }
}
