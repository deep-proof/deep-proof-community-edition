import {seededStore} from './support/seed.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createApp} from '../server.mjs';
import {typeSkillFolder,saveSkillRevision,copyTypeSkill,compatibilitySkill} from '../src/type-skills.mjs';
import {readSkillFiles,validateSkillBundle} from '../src/skill-bundle.mjs';
import {readValidatedOutput} from '../src/output-validation.mjs';
import {prepareALAJob} from '../src/ala.mjs';
import {writeArtifact,readArtifact} from '../src/safe-files.mjs';

test('reference files can be added, replaced, removed and snapshotted without changing prior skill versions',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'analyst-types-'));const {server,db}=(await seededStore(dir),createApp)({dir});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();await fs.rm(dir,{recursive:true,force:true});});const base=`http://127.0.0.1:${server.address().port}/api`;
 async function call(url,data,cookie='',method){const r=await fetch(base+url,{method:method||(data?'POST':'GET'),headers:{'content-type':'application/json',cookie},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 const cookie=(await call('/login',{username:'admin',password:'admin'})).cookie;
 const type=(await call('/admin/type-drafts',{name:'Reference review',brief:'Compare each supplied requirement.'},cookie)).data.id;
 const file=(name,text)=>({file:{name,data:Buffer.from(text).toString('base64')}});
 const first=await call(`/admin/types/${type}/files`,file('guide.md','# Guide\nTest the stated revenue.'),cookie);assert.equal(first.status,201);
 const second=await call(`/admin/types/${type}/files`,file('policy.txt','Reconcile contradictory figures.'),cookie);assert.equal(second.status,201);
 const detail=(await call('/admin/types/'+type,null,cookie)).data;assert.equal(detail.referenceFiles.length,2);assert.equal(detail.reference_version,2);
 assert.equal((await call(`/admin/types/${type}/files/${first.data.id}`,null,'')).status,401);
 assert.match((await call(`/admin/types/${type}/files/${first.data.id}`,null,cookie)).data.html,/<h1/);
 await call('/admin/types',{id:type,name:'Reference review',criteria:'Revenue consistency',playbook:'Compare source figures.'},cookie);
 const before=db.prepare('SELECT * FROM types WHERE id=?').get(type),folder=typeSkillFolder(dir,type,before.skill_revision),oldFiles=readSkillFiles(folder);assert.ok(oldFiles[`references/source-material/${first.data.id}.md`]);
 const replacement=await call(`/admin/types/${type}/files/${first.data.id}`,file('updated.md','# Updated\nRequire reconciliation.'),cookie);assert.equal(replacement.status,201);assert.equal((await call(`/admin/types/${type}/files/${first.data.id}`,null,cookie)).status,404);
 assert.equal((await call('/admin/types/'+type,null,cookie)).data.status,'outdated');assert.match(readSkillFiles(folder)[`references/source-material/${first.data.id}.md`],/stated revenue/);
 assert.equal((await call(`/admin/types/${type}/files/${second.data.id}`,{},cookie,'DELETE')).status,200);assert.equal((await call('/admin/types/'+type,null,cookie)).data.referenceFiles.length,1);
 // A running design owns a stable reference snapshot: edits are rejected until it finishes.
 db.prepare("UPDATE types SET status='generating' WHERE id=?").run(type);assert.equal((await call(`/admin/types/${type}/files`,file('third.txt','Evidence'),cookie)).status,409);assert.equal((await call(`/admin/types/${type}/files/${replacement.data.id}`,{},cookie,'DELETE')).status,409);db.prepare("UPDATE types SET status='outdated' WHERE id=?").run(type);
 assert.ok((await call(`/admin/types/${type}/skill`,null,cookie)).data.files.some(f=>f.name==='SKILL.md'));
 assert.equal((await call(`/admin/types/${type}/skill?file=../analyst.sqlite`,null,cookie)).status,404);
 const job=path.join(dir,'snapshot-job');copyTypeSkill(dir,before,job);assert.equal(readArtifact(job,`skills/analysis-type-${type}/SKILL.md`).toString(),oldFiles['SKILL.md']);
 const snapshot=JSON.parse(await fs.readFile(new URL('./fixtures/revenue-review.json',import.meta.url),'utf8')).snapshot;const analysisJob=path.join(dir,'prepared-analysis');await prepareALAJob({root:process.cwd(),dir:analysisJob,artifactDir:dir,settings:{agent:'codex'},input:{...snapshot,type:before},prompt:'Offline preparation check',kind:'analysis'});assert.ok(readArtifact(analysisJob,'skills/evidence-review/SKILL.md').length);assert.equal(readArtifact(analysisJob,`skills/analysis-type-${type}/SKILL.md`).toString(),oldFiles['SKILL.md']);
 const fresh=saveSkillRevision(dir,{...before,criteria:'Updated criterion'},oldFiles);assert.notEqual(fresh,before.skill_revision);assert.equal(readArtifact(job,`skills/analysis-type-${type}/references/review-criteria.md`).toString(),'Revenue consistency');
});

test('generated skill contract validates source coverage and code syntax without executing generated code',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'analyst-skill-validation-'));
 try{
  const input={typeId:'test-type',name:'Reference review',brief:'Review evidence.',references:[{id:'guide',name:'Guide',lineCount:2}]};
  const files={...compatibilitySkill({id:input.typeId,name:input.name,criteria:'Revenue consistency',playbook:'Compare evidence.'}),'scripts/reconcile.mjs':"import fs from 'node:fs'; fs.writeFileSync('must-not-execute','no');\n",'references/source-map.md':'# Sources\n\nRevenue comparison follows [Guide](source-material/guide.md#L1-L2).'};
  files['SKILL.md']+='\nUse [reconcile](scripts/reconcile.mjs) for a reproducible comparison.\n';validateSkillBundle(files,input);
  assert.throws(()=>validateSkillBundle({...files,'references/source-map.md':'Missing'},input),/must cover/);
  assert.throws(()=>validateSkillBundle({...files,'scripts/reconcile.mjs':'function ('},input),/invalid syntax/);
  await prepareALAJob({root:process.cwd(),dir,settings:{agent:'codex'},input,prompt:'Offline file validation',kind:'design'});
  for(const [name,text] of Object.entries(files))writeArtifact(dir,'generated-skill/'+name,text);
  const output=await readValidatedOutput(dir,input,'design');assert.equal(output.criteria,'Revenue consistency');
  const result=spawnSync(process.execPath,['validate-output.mjs'],{cwd:dir,encoding:'utf8'});assert.equal(result.status,0,result.stderr);await assert.rejects(fs.access(path.join(dir,'must-not-execute')));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
