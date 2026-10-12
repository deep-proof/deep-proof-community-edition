import {defaultReportTemplate,reportTemplate} from './report-template.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {readArtifact,writeArtifact,safeDirectory,safePath} from './safe-files.mjs';
import {readSkillFiles} from './skill-bundle.mjs';
import {CERTIFICATE_FILE} from './verification.mjs';
const identifier=value=>{if(typeof value!=='string'||!/^[a-zA-Z0-9_-]+$/.test(value))throw Error('Invalid type artifact identifier.');return value;};
export const typeFolder=(dir,tid)=>path.join(dir,'project-types',identifier(tid));
export const attachmentFolder=(dir,tid,aid)=>path.join(typeFolder(dir,tid),'attachments',identifier(aid));
export const typeSkillFolder=(dir,tid,revision)=>path.join(dir,'analysis-skills',identifier(tid),'revisions',identifier(revision));
export const typeReferences=(db,tid)=>db.prepare('SELECT id,name,file_type,size,created_at FROM type_attachments WHERE type_id=? ORDER BY created_at,id').all(tid);
export function sourceReferences(db,tid){return db.prepare('SELECT * FROM type_attachments WHERE type_id=? ORDER BY created_at,id').all(tid);}
export function saveTypeAttachment(db,dir,tid,upload,replaceId){
 const aid=randomUUID(),folder=attachmentFolder(dir,tid,aid);safeDirectory(folder);writeArtifact(folder,'original.'+upload.type,upload.buffer);writeArtifact(folder,'content.md',upload.markdown);if(upload.preview)writeArtifact(folder,'preview.pdf',upload.preview);
 try{
  db.exec('BEGIN');db.prepare('INSERT INTO type_attachments VALUES(?,?,?,?,?,?,?,?)').run(aid,tid,upload.name,upload.type,upload.markdown,upload.buffer.length,new Date().toISOString(),upload.preview?1:0);
  if(replaceId)db.prepare('DELETE FROM type_attachments WHERE type_id=? AND id=?').run(tid,replaceId);
  db.prepare("UPDATE types SET reference_version=reference_version+1,status=CASE WHEN skill_revision IS NULL THEN 'draft' ELSE 'outdated' END,generation_error=NULL WHERE id=?").run(tid);db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');fs.rmSync(folder,{recursive:true,force:true});throw error;}
 if(replaceId){const old=attachmentFolder(dir,tid,replaceId);safePath(typeFolder(dir,tid),path.relative(typeFolder(dir,tid),old),{missing:true});fs.rmSync(old,{recursive:true,force:true});}
 return aid;
}
export function prepareReferenceFiles(dir,job,tid,references){
 for(const reference of references){const source=attachmentFolder(dir,tid,reference.id);writeArtifact(job,`reference-files/${reference.id}/content.md`,reference.markdown);for(const filename of ['original.'+reference.file_type,...(reference.has_preview?['preview.pdf']:[])])writeArtifact(job,`reference-files/${reference.id}/${filename}`,readArtifact(source,filename,30*1024*1024));}
 writeArtifact(job,'reference-manifest.md','# Reference material\n\n'+references.map(r=>`${r.name}\n\nText: reference-files/${r.id}/content.md\nOriginal: reference-files/${r.id}/original.${r.file_type}${r.has_preview?`\nPreview: reference-files/${r.id}/preview.pdf`:''}`).join('\n\n'));
}
// A certificate attests one exact methodology. Callers keep it only when that methodology is unchanged.
export function saveSkillRevision(dir,type,files,references=[],{keepCertificate=false}={}){
 files={...files};if(!keepCertificate)delete files[CERTIFICATE_FILE];files={...files,'references/report-template.md':files['references/report-template.md']||defaultReportTemplate};reportTemplate(files['references/report-template.md']);
 const revision=randomUUID(),folder=typeSkillFolder(dir,type.id,revision);safeDirectory(folder);
 try{for(const [name,text] of Object.entries(files))writeArtifact(folder,name,text);writeArtifact(folder,'references/review-criteria.md',type.criteria);writeArtifact(folder,'references/review-playbook.md',type.playbook);for(const reference of references)writeArtifact(folder,`references/source-material/${reference.id}.md`,reference.markdown);return revision;}catch(error){fs.rmSync(folder,{recursive:true,force:true});throw error;}
}
export function compatibilitySkill(type){
 return {'references/report-template.md':defaultReportTemplate,'SKILL.md':`---\nname: analysis-type-${type.id}\ndescription: ${JSON.stringify("Apply the configured review methodology for "+type.name+".")}\n---\n\n# ${type.name}\n\nRead [Report Template](references/report-template.md), [Review Criteria](references/review-criteria.md), [Review Playbook](references/review-playbook.md), [Methodology](references/methodology.md) and [Source map](references/source-map.md). These saved rules are authoritative; do not invent thresholds. Apply this domain guidance alongside the standard evidence-review and review-progress skills. Methodology references are not evidence of facts about the current project.\n`,
 'references/review-criteria.md':type.criteria,'references/review-playbook.md':type.playbook,
 'references/methodology.md':`# Existing review methodology\n\n${type.playbook}\n\nApply each configured criterion to the dossier. Record source-supported observations, contradicting evidence and uncertainty. Use only the dossier for factual report citations.`,
 'references/source-map.md':'# Existing review rules\n\nThis version packages the previously saved administrator criteria and playbook. Regenerate from reference files to create expanded methods and domain-specific code.\n'};
}
export function ensureTypeSkill(db,dir,type){
 if(type.skill_revision){
  const files=readSkillFiles(typeSkillFolder(dir,type.id,type.skill_revision));
  if(files['references/report-template.md'])return type;
  files['references/report-template.md']=defaultReportTemplate;
  files['SKILL.md']+='\nRead [Report Template](references/report-template.md) for the authoritative report chapters and guidance; the current caller contract overrides older fixed report structures.\n';
  const revision=saveSkillRevision(dir,type,files,[],{keepCertificate:true});
  db.prepare('UPDATE types SET skill_revision=? WHERE id=?').run(revision,type.id);
  return {...type,skill_revision:revision};
 }
 if(!type.criteria.trim()||!type.playbook.trim())return type;
 const revision=saveSkillRevision(dir,type,compatibilitySkill(type),sourceReferences(db,type.id));db.prepare('UPDATE types SET skill_revision=?,skill_reference_version=reference_version WHERE id=?').run(revision,type.id);return {...type,skill_revision:revision,skill_reference_version:type.reference_version};
}
export function migrateTypeSkills(db,dir){
 for(let type of db.prepare('SELECT * FROM types').all()){
  let input;try{input=JSON.parse(type.generation_input||'null');}catch{}
  if(input?.attachment&&!sourceReferences(db,type.id).length){const r=input.attachment;saveTypeAttachment(db,dir,type.id,{name:r.name,type:r.name.toLowerCase().endsWith('.md')?'md':'txt',markdown:r.text,buffer:Buffer.from(r.text)},null);const {attachment,...rest}=input;db.prepare('UPDATE types SET generation_input=?,status=? WHERE id=?').run(JSON.stringify(rest),type.status,type.id);type=db.prepare('SELECT * FROM types WHERE id=?').get(type.id);}
  ensureTypeSkill(db,dir,type);
 }
}
export function copyTypeSkill(dir,type,job){
 if(!type.skill_revision)throw Error('This project type has no analysis skill.');
 const name='analysis-type-'+type.id,files=readSkillFiles(typeSkillFolder(dir,type.id,type.skill_revision));for(const [file,text] of Object.entries(files))writeArtifact(job,`skills/${name}/${file}`,text);return name;
}

export function skillReportTemplate(dir,type){
 if(!type.skill_revision)return defaultReportTemplate;
 const files=readSkillFiles(typeSkillFolder(dir,type.id,type.skill_revision));
 const template=files['references/report-template.md']||defaultReportTemplate;reportTemplate(template);return template;
}
