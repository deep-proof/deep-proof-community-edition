// Analyst Skill verification and product edition. A skill is Verified only when its saved
// revision carries a structurally valid verification certificate; everything else is Demo Only.
import fs from 'node:fs';
import path from 'node:path';
import {readArtifact} from './safe-files.mjs';
import {typeSkillFolder} from './type-skills.mjs';
export const CERTIFICATE_FILE='verification-certificate.md';
export const COMMERCIAL_LICENSE='commercial-license';
const REQUIRED_SECTIONS=['Scope','Evaluation Dataset','Method','Results','Limitations'];
const fail=message=>{throw Object.assign(Error(`${CERTIFICATE_FILE}: ${message}`),{status:400});};
export function parseCertificate(text){
 const match=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text||'');if(!match)fail('start with YAML frontmatter containing verified_by, verified_on and evaluation_cases.');
 const fields=Object.fromEntries(match[1].split(/\r?\n/).map(line=>/^([a-z_]+):\s*(.*)$/.exec(line)).filter(Boolean).map(([,key,value])=>[key,value.replace(/^(['"])(.*)\1$/,'$2').trim()]));
 if(!fields.verified_by||fields.verified_by.length>200)fail('verified_by must name the accountable person and organization (at most 200 characters).');
 const date=/^\d{4}-\d{2}-\d{2}$/.test(fields.verified_on||'')?new Date(fields.verified_on+'T00:00:00Z'):null;
 if(!date||Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==fields.verified_on||date.getTime()>Date.now()+86400000)fail('verified_on must be a past or current date in YYYY-MM-DD format.');
 const cases=Number(fields.evaluation_cases);if(!/^\d+$/.test(fields.evaluation_cases||'')||cases<1)fail('evaluation_cases must be a positive whole number.');
 const body=text.slice(match[0].length),headings=[...body.matchAll(/^#{2,3}\s+(.+?)\s*$/gm)].map(m=>m[1].toLowerCase());
 const missing=REQUIRED_SECTIONS.filter(section=>!headings.some(heading=>heading.startsWith(section.toLowerCase())));
 if(missing.length)fail(`add the required sections: ${missing.join(', ')}.`);
 return {verifiedBy:fields.verified_by,verifiedOn:fields.verified_on,evaluationCases:cases,...(fields.model?{model:fields.model.slice(0,200)}:{})};
}
const DEMO={status:'demo'};
export function skillVerification(dir,type){
 if(!type?.skill_revision)return DEMO;
 let text;try{text=readArtifact(typeSkillFolder(dir,type.id,type.skill_revision),CERTIFICATE_FILE,200000).toString('utf8');}catch{return DEMO;}
 try{return {status:'verified',...parseCertificate(text)};}catch{return DEMO;}
}
// Runs created before verification existed carry no record and were produced by unverified skills.
export const runVerification=snapshot=>snapshot?.verification?.status==='verified'?snapshot.verification:DEMO;
export const edition=root=>fs.existsSync(path.join(root,COMMERCIAL_LICENSE))?'commercial':'community';
