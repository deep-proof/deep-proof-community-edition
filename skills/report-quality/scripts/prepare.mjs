import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {hash,read,write,jsonl,safePath} from './io.mjs';
export const profiles=['scientific','ai','progress','decision','commercial','technical','security','audit','incident','review'];
export function normalizeOptions(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Verification options must be an object.');
 const depth=raw.depth||'deep',researchMode=raw.researchMode||'closed';
 if(!['deep','triage'].includes(depth)||!['closed','historical','external'].includes(researchMode))throw Error('Choose a supported verification depth and research mode.');
 const date=value=>{if(!value)return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('Reference Date must use YYYY-MM-DD.');return value;};
 const referenceDate=date(raw.referenceDate);if(researchMode==='historical'&&!referenceDate)throw Error('Historical verification needs a Reference Date.');
 if(researchMode==='external'&&raw.externalAuthorized!==true)throw Error('External research needs explicit authorization for this run.');
 const text=key=>{const value=raw[key]??'';if(typeof value!=='string'||value.length>10000)throw Error('Verification scope and decision question must be text, up to 10,000 characters.');return value.trim()||null;};
 return {depth,researchMode,referenceDate,externalAuthorized:researchMode==='external',scope:text('scope'),purpose:text('purpose')};
}
export function qualityInputs(input){
 if(!input||!Array.isArray(input.documents)||!input.documents.length)throw Error('Provide documents and sourceReport.documentId.');
 const ids=new Set();for(const d of input.documents){if(!d||typeof d.id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(d.id)||ids.has(d.id)||typeof d.markdown!=='string')throw Error('Documents need unique safe IDs and Markdown text.');ids.add(d.id);}
 if(!ids.has(input.sourceReport?.documentId))throw Error('The target document must exist in documents.');
 const sources=input.documents.map(d=>({id:d.id,name:d.original_name||d.title||d.id,role:d.id===input.sourceReport.documentId?'target':'reference',version:d.version||hash(d.markdown),sha256:hash(d.markdown),originalSha256:d.original_sha256||null,author:d.author||null,date:d.date||null,fileType:d.file_type||'md',originalFile:d.originalFile||`sources/${d.id}.${d.file_type||'md'}`,relatedVersions:d.relatedVersions||[],extraction:'extracted',originalReview:'pending',originalAvailable:d.original_available??((d.file_type||'md')==='md'),lineCount:d.markdown.split(/\r?\n/).length}));
 for(const source of sources){const duplicate=sources.find(s=>s.id!==source.id&&s.sha256===source.sha256);source.sameOriginAs=duplicate?.id||null;}
 const segments=[];for(const doc of input.documents){let segmentNumber=0;const lines=doc.markdown.split(/\r?\n/);let start=0,section=null,page=null;
  const add=end=>{if(end<=start)return;const text=lines.slice(start,end).join('\n');segments.push({id:`${doc.id}:S${++segmentNumber}`,documentId:doc.id,startLine:start+1,endLine:end,text,quoteHash:hash(text),section,physicalPage:page,printedPage:null,paragraphId:`${doc.id}:L${start+1}`,extraction:'extracted',reading:'pending',claims:'pending',requirements:'pending'});start=end;};
  for(let i=0;i<lines.length;i++){if(/^#{1,6} /.test(lines[i])){add(i);section=lines[i].replace(/^#+ /,'');const p=/^## Page (\d+)\s*$/.exec(lines[i]);if(p)page=Number(p[1]);}if(i-start>=100)add(i);}add(lines.length);
 }
 return {manifest:{schemaVersion:1,id:'source-manifest',targetDocumentId:input.sourceReport.documentId,sources},segments};
}
export function prepareQualityInputs(dir,input){const {manifest,segments}=qualityInputs(input);write(dir,'quality-input/manifest.json',manifest);write(dir,'quality-input/segments.jsonl',jsonl(segments));write(dir,'quality-input/options.json',normalizeOptions(input.qualityOptions));return {manifest,segments};}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const skill=path.dirname(path.dirname(fileURLToPath(import.meta.url)));input.type??={criteria:read(skill,'references/review-criteria.md')};const dir=process.argv[3]?path.resolve(process.argv[3]):fs.mkdtempSync(path.join(os.tmpdir(),'report-quality-'));safePath(dir,'',true);fs.mkdirSync(dir,{recursive:true,mode:0o700});write(dir,'input.json',input);
  for(const d of input.documents||[])write(dir,`sources/${d.id}.md`,d.markdown);prepareQualityInputs(dir,input);
  for(const [source,target] of [['references/report-template.md','report-template.md'],['references/review-criteria.md','review-criteria.md'],['SKILL.md','review-playbook.md']])write(dir,target,read(skill,source));console.log(dir);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
