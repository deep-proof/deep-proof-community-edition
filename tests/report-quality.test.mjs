import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server.mjs';
import {openStore} from '../src/store.mjs';
import {analysisFolder,writeAnalysisSources} from '../src/artifacts.mjs';
import {readArtifact,writeArtifact} from '../src/safe-files.mjs';
import {QUALITY_SKILL_ID,reportQualitySkill,reportQualityFiles,qualityDocuments,qualityPrompt} from '../src/report-quality.mjs';
import {prepareALAJob} from '../src/ala.mjs';
import {reviewPrompt} from '../src/reports.mjs';
import {reportHTML} from '../src/pdf.mjs';
import {testCatalog} from './support/catalog.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
test('external reports preserve arbitrary content and originals, share report history and enforce project access offline',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'deep-proof-report-import-'));
 // This test must never invoke a model, even when a local ALA installation exists.
 const store=openStore(dir);store.prepare('INSERT INTO settings VALUES(1,?)').run(JSON.stringify({alaPath:path.join(dir,'no-ala')}));store.close();
 const {server,db}=createApp({dir,catalog:testCatalog()});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();await fs.rm(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}/api`;
 async function call(url,data,cookie='',method){const response=await fetch(base+url,{method:method||(data?'POST':'GET'),headers:{'content-type':'application/json',cookie},...(data?{body:JSON.stringify(data)}:{})});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const admin=(await call('/login',{username:'admin',password:'admin'})).cookie;
 const pid=(await call('/projects',{company:'External Reports'},admin)).data.id;
 const route=`/projects/${pid}`;
 // User-authored upload input exercises an external format; this is not model output.
 const markdown='Introduction before any heading.\n\n# External Report\n\n## Arbitrary Section\n\nOriginal conclusion.\n\n[^other]: An external reference.\n\n<script>alert(1)</script>\n';
 const file={name:'external.md',data:Buffer.from(markdown).toString('base64')},payload={title:'Outside Report',file,report_language:'ro'};
 assert.equal((await call(route+'/report-imports',payload)).status,401);
 assert.equal((await call(route+'/report-imports',{...payload,file:{name:'bad.html',data:file.data}},admin)).status,400);
 assert.equal((await call(route+'/report-imports',{...payload,report_language:'invalid'},admin)).status,400);
 const imported=await call(route+'/report-imports',payload,admin);assert.equal(imported.status,201);const rid=imported.data.id;
 const saved=(await call(route+'/analyses/'+rid,null,admin)).data;
 assert.equal(saved.result.markdown,markdown);assert.equal(saved.result.sections.length,1);assert.equal(saved.result.sections[0].title,'Outside Report');assert.match(saved.result.sections[0].html,/Introduction before/);assert.doesNotMatch(saved.result.sections[0].html,/<script>/);assert.match(saved.result.sections[0].html,/external reference/);
 assert.equal(saved.snapshot.kind,'imported');assert.equal(saved.snapshot.report_language,'ro');assert.equal(saved.snapshot.verification.status,'demo');assert.equal(saved.snapshot.documents.length,0);assert.ok(saved.snapshot.original.sha256);
 const history=(await call(route+'/analyses',null,admin)).data;assert.equal(history[0].title,'Outside Report');assert.equal(history[0].kind,'imported');
 const original=await fetch(base+route+'/analyses/'+rid+'/original',{headers:{cookie:admin}});assert.equal(original.status,200);assert.equal(await original.text(),markdown);
 const html=await reportHTML(saved,analysisFolder(dir,pid,rid));assert.match(html,/IMPORTED REPORT/);assert.match(html,/Introduction before/);assert.doesNotMatch(html,/Produced with an unverified Analyst Skill/);
 // The built-in check accepts a report without source documents, then stops at the unavailable engine.
 const check=await call(route+'/analyses',{sourceReportId:rid},admin);assert.equal(check.status,503);assert.match(check.data.error,/ALA was not found/);
 assert.equal((await call(route+'/analyses',{sourceReportId:rid,skillId:'missing'},admin)).status,400,'a report check always uses the built-in verification skill');
 assert.equal((await call(route+'/analyses',{sourceReportId:'missing'},admin)).status,404);
 assert.equal((await call(route+'/analyses',{sourceReportId:''},admin)).status,400);
 assert.equal((await call(route+'/analyses',{skillId:QUALITY_SKILL_ID},admin)).status,404);
 assert.equal((await call(route+'/analyses',{sourceReportId:rid,qualityOptions:{researchMode:'external'}},admin)).status,400);
 for(const bad of [7,'abc',0,1e9])assert.equal((await call(route+'/analyses',{sourceReportId:rid,timeLimitMinutes:bad},admin)).status,400,'only the offered time limits are accepted');
 assert.equal((await call(route+'/analyses',{sourceReportId:rid,timeLimitMinutes:60},admin)).status,503,'an offered limit passes validation and reaches the ALA check');
 assert.equal((await call(route+'/analyses',{sourceReportId:rid,qualityOptions:{researchMode:'historical'}},admin)).status,400);
 assert.equal(db.prepare('SELECT count(*) AS n FROM runs').get().n,1);
 await call('/admin/users',{username:'other',password:'password123',role:'user',active:true,typeIds:[],accessLevelIds:[],primaryAccessLevelId:null},admin);
 const other=(await call('/login',{username:'other',password:'password123'})).cookie;
 for(const url of [route+'/report-imports',route+'/analyses'])assert.equal((await call(url,url.endsWith('report-imports')?payload:{sourceReportId:rid},other)).status,403);
 assert.equal((await call(route+'/analyses/'+rid,null,other)).status,403);
 for(const [id,message,code] of [['failed-validation','Deep Proof could not validate the review after 3 attempts. SECRET','validation'],['failed-timeout','Deep Proof reached its 15-minute review limit.','timeout'],['failed-access','Authentication error 401 PRIVATE-TOKEN','access']]){
  db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?)').run(id,pid,'2026-10-29','failed',JSON.stringify(saved.snapshot),null,message);
  const failed=(await call(route+'/analyses/'+id,null,admin)).data;assert.equal(failed.failure.code,code);assert.equal(failed.failure.reportAvailable,false);assert.equal(failed.error,undefined);assert.ok(!JSON.stringify(failed).includes('SECRET'));assert.ok(!JSON.stringify(failed).includes('PRIVATE-TOKEN'));
 }
 const otherProject=(await call('/projects',{company:'Another Project'},admin)).data.id;
 assert.equal((await call(`/projects/${otherProject}/analyses`,{sourceReportId:rid},admin)).status,404);
 await call(route+'/archive',{archived:true},admin);
 assert.equal((await call(route+'/report-imports',payload,admin)).status,409);assert.equal((await call(route+'/analyses',{sourceReportId:rid},admin)).status,409);
 assert.equal((await call(route+'/analyses/'+rid,null,admin)).status,200);
 await call(route+'/archive',{archived:false},admin);
 // Restart migrations must preserve imports without imposing the Deep Proof output contract.
 const second=createApp({dir,catalog:testCatalog()});second.db.close();second.server.close();assert.equal(readArtifact(analysisFolder(dir,pid,rid),'report.md').toString(),markdown);
});

test('quality checks freeze target report and evidence independently of current project documents and prepare a real ALA job offline',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'deep-proof-quality-job-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 // Recorded real model output is reused unchanged; no quality output is simulated.
 const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/revenue-review.json',import.meta.url),'utf8'));
 const markdown=await fs.readFile(new URL('./fixtures/revenue-review.md',import.meta.url),'utf8');
 const source={id:'recorded',created_at:'2026-10-07T00:00:00Z',snapshot:fixture.snapshot};
 const inputs=qualityDocuments(source,markdown,[{id:'current-only',title:'Later Evidence',markdown:'Later project revision.'}]);
 assert.equal(inputs.documents[0].markdown,markdown);assert.equal(inputs.sourceReport.documentId,inputs.documents[0].id);assert.equal(inputs.sourceReport.id,'recorded');assert.equal(inputs.sourceReport.criteria,fixture.snapshot.type.criteria);
 assert.deepEqual(inputs.documents.slice(1),fixture.snapshot.documents);assert.ok(!inputs.documents.some(d=>d.id==='current-only'));
 const external=qualityDocuments({...source,snapshot:{...source.snapshot,kind:'imported'}},markdown,[]);assert.equal(external.documents.length,1);assert.equal(external.sourceReport.criteria,null);
 const collision=qualityDocuments({...source,snapshot:{...source.snapshot,documents:[{id:'report-under-review',title:'Previous Report',markdown:'Previous assessment.'}]}},markdown);assert.equal(new Set(collision.documents.map(d=>d.id)).size,2);
 const type=reportQualitySkill(),snapshot={kind:'quality',project:{company:'Quality Check'},report_language:'fr',type,verification:{status:'demo'},...inputs};
 const job=path.join(dir,'job'),prompt=qualityPrompt(snapshot)+reviewPrompt(snapshot);
 await prepareALAJob({root,dir:job,settings:{agent:'codex'},input:snapshot,prompt,kind:'analysis'});
 const saved=JSON.parse(readArtifact(job,'input.json'));assert.equal(saved.kind,'quality');assert.equal(saved.report_language,'fr');assert.equal(saved.sourceReport.id,'recorded');assert.equal(saved.type.methodology_revision,type.methodology_revision);
 assert.equal(readArtifact(job,'sources/'+inputs.sourceReport.documentId+'.md').toString(),markdown);
 assert.equal(readArtifact(job,'review-playbook.md').toString(),type.playbook);assert.ok(JSON.parse(readArtifact(job,'criteria.json')).length>0);
 assert.match(readArtifact(job,'task.txt').toString(),/independent quality assessment/);assert.equal(JSON.parse(readArtifact(job,'output-contract.json')).kind,'analysis');
 assert.equal(readArtifact(job,'skills/report-quality/SKILL.md').toString(),reportQualityFiles()['SKILL.md']);
 // Source metadata remains usable in report history and survives source document changes.
 inputs.documents[1].markdown='Changed in the check snapshot';assert.notEqual(inputs.documents[1].markdown,fixture.snapshot.documents[0].markdown);
});

test('saved verification exports enforce project access, preserve binary bytes and reject artifact changes',async t=>{
 // Transport test: recorded real report content, with hand-authored export metadata only.
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'verification-export-')),{server,db}=createApp({dir,catalog:testCatalog()});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();await fs.rm(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const login=await fetch(base+'/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'admin'})}),cookie=login.headers.get('set-cookie').split(';')[0];
 const project=await fetch(base+'/projects',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({company:'Export Transport'})}),pid=(await project.json()).id;
 const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/revenue-review.json',import.meta.url),'utf8')),snapshot={...fixture.snapshot,project:{company:'Export Transport'},kind:'quality'};
 const folder=analysisFolder(dir,pid,'export-test');writeAnalysisSources(folder,snapshot);await fs.copyFile(new URL('./fixtures/revenue-review.md',import.meta.url),path.join(folder,'report.md'));
 // The endpoint exports immutable saved artifacts; no review or generated quality outcome is simulated.
 const {createHash}=await import('node:crypto');const payload=Buffer.from([0,128,255,10]),name='sources/transport.pdf';writeArtifact(folder,name,payload);writeArtifact(folder,'verification-index.json',JSON.stringify({files:[{name,sha256:createHash('sha256').update(payload).digest('hex')}]}));
 db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?)').run('export-test',pid,'2026-10-29','completed',JSON.stringify(snapshot),JSON.stringify({format:'markdown',quality:{completion:'incomplete',confirmedFindings:0}}),null);
 const url=base+`/projects/${pid}/analyses/export-test/verification`;
 assert.equal((await fetch(url)).status,401);const response=await fetch(url,{headers:{cookie}});assert.equal(response.status,200);const result=await response.json();assert.equal(result.files[0].encoding,'base64');assert.deepEqual(Buffer.from(result.files[0].content,'base64'),payload);
 const direct=await fetch(url+'?file='+encodeURIComponent(name),{headers:{cookie}});assert.deepEqual(Buffer.from(await direct.arrayBuffer()),payload);
 assert.equal((await fetch(url+'?file=../../analyst.sqlite',{headers:{cookie}})).status,404);
 writeArtifact(folder,name,'changed');assert.equal((await fetch(url,{headers:{cookie}})).status,409);
});
