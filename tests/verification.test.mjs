import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../server.mjs';
import {hashPassword} from '../src/store.mjs';
import {parseCertificate,runVerification,CERTIFICATE_FILE} from '../src/verification.mjs';
import {importSkillArchive} from '../src/skill-import.mjs';
import {resolveALA,validateALALocation} from '../src/ala-location.mjs';
import {testCatalog} from './support/catalog.mjs';
const certificate=(fields='verified_by: Jane Doe, Head of Risk, Example Capital\nverified_on: 2026-09-30\nevaluation_cases: 120')=>`---\n${fields}\n---\n\n# Certificate\n\n## Scope\nSuppliers.\n\n## Evaluation Dataset\n120 dossiers.\n\n## Method\nBlind scoring.\n\n## Results\nRecall 96%.\n\n## Limitations\nNo OCR.\n`;
const entry='---\nname: supplier-review\ndescription: Review supplied supplier evidence.\n---\n\n# Supplier review\n\nCompare contractual duties and delivery records.\n';
const required={'references/review-criteria.md':'## C01 — Contractual Duties\nAssess supplied contracts.','references/review-playbook.md':'Compare contractual duties and delivery records.','references/methodology.md':'Compare duties with deliveries.','references/report-template.md':'<!-- role: criteria -->\n## Contractual Duties\nAssess each criterion.','SKILL.md':entry};
function archive(entries){const r=spawnSync('python3',['-c',"import sys,json,io,zipfile,base64\nb=io.BytesIO()\nwith zipfile.ZipFile(b,'w') as z:\n for name,text in json.load(sys.stdin).items(): z.writestr(name,text)\nprint(base64.b64encode(b.getvalue()).decode())"],{input:JSON.stringify(entries),encoding:'utf8'});assert.equal(r.status,0,r.stderr);return {name:'skill.zip',data:r.stdout.trim()};}

test('verification certificates require an accountable reviewer, a valid date, cases and scientific sections',()=>{
 assert.deepEqual(parseCertificate(certificate()),{verifiedBy:'Jane Doe, Head of Risk, Example Capital',verifiedOn:'2026-09-30',evaluationCases:120});
 for(const fields of ['verified_on: 2026-09-30\nevaluation_cases: 3','verified_by: A\nverified_on: 2026-02-30\nevaluation_cases: 3','verified_by: A\nverified_on: 2999-01-01\nevaluation_cases: 3','verified_by: A\nverified_on: 2026-09-30\nevaluation_cases: 0','verified_by: A\nverified_on: 2026-09-30\nevaluation_cases: many'])assert.throws(()=>parseCertificate(certificate(fields)),e=>e.status===400);
 assert.throws(()=>parseCertificate(certificate().replace('## Results','## Notes')),/Results/);
 assert.throws(()=>parseCertificate(''),/frontmatter/);
 assert.deepEqual(runVerification({}),{status:'demo'});
});

test('imports keep a valid certificate and reject a malformed one',async()=>{
 const imported=await importSkillArchive(archive({...required,[CERTIFICATE_FILE]:certificate()}),'certified');assert.ok(imported.files[CERTIFICATE_FILE]);
 await assert.rejects(importSkillArchive(archive({...required,[CERTIFICATE_FILE]:'# Trust me'}),'forged'),e=>e.status===400&&/verification-certificate\.md/.test(e.message));
});

test('ALA locations must be real ALA checkouts; explicit locations are never silently replaced',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'deep-proof-ala-'));
 try{
  await fs.mkdir(path.join(folder,'bin'));await fs.mkdir(path.join(folder,'src/coding-agents'),{recursive:true});
  await fs.writeFile(path.join(folder,'bin/ala.mjs'),'');await fs.writeFile(path.join(folder,'src/coding-agents/discovery.mjs'),'');
  assert.throws(()=>validateALALocation(folder),e=>e.status===400);
  await fs.writeFile(path.join(folder,'package.json'),JSON.stringify({name:'advanced-language-agent'}));
  assert.equal(validateALALocation(folder),folder);assert.throws(()=>validateALALocation('relative/ala'),/absolute/);
  const saved=process.env.ALA_CLI;delete process.env.ALA_CLI;
  try{
   const found=resolveALA(process.cwd(),{alaPath:folder});assert.equal(found.found,true);assert.equal(found.source,'configured');assert.equal(found.entry,path.join(await fs.realpath(folder),'bin/ala.mjs'));assert.equal(found.dependencies,false);
   const missing=resolveALA(process.cwd(),{alaPath:path.join(folder,'absent')});assert.equal(missing.found,false);assert.equal(missing.checked.length,1);
  }finally{if(saved!==undefined)process.env.ALA_CLI=saved;}
 }finally{await fs.rm(folder,{recursive:true,force:true});}
});

test('skills are Demo Only unless certified, methodology edits void verification and the edition badge follows the license folder',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'deep-proof-verification-')),appRoot=await fs.mkdtemp(path.join(os.tmpdir(),'deep-proof-edition-'));
 // A pre-existing administrator skips demo seeding, so this test needs no seed dossiers.
 const seed=new DatabaseSync(path.join(dir,'analyst.sqlite'));seed.exec('CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1)');seed.prepare('INSERT INTO users VALUES(?,?,?,?,1)').run('admin','admin',hashPassword('admin-password'),'admin');seed.close();
 const savedALA=process.env.ALA_CLI;process.env.ALA_CLI=path.join(dir,'no-ala');
 const {server}=createApp({dir,appRoot,catalog:testCatalog()});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{if(savedALA===undefined)delete process.env.ALA_CLI;else process.env.ALA_CLI=savedALA;server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});await fs.rm(appRoot,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;let cookie='';
 const call=async(url,body)=>{const r=await fetch(base+'/api'+url,body===undefined?{headers:{cookie}}:{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'admin-password'})});cookie=login.headers.get('set-cookie').split(';')[0];
 assert.match(await (await fetch(base+'/')).text(),/Community Edition/);
 await fs.mkdir(path.join(appRoot,'commercial-license'));assert.doesNotMatch(await (await fetch(base+'/')).text(),/Community Edition/);
 assert.equal((await call('/system')).data.edition,'commercial');
 const ala=await call('/admin/ala');assert.equal(ala.data.found,false);assert.equal(ala.data.source,null);assert.equal((await call('/system')).data.ala.found,false);
 assert.equal((await call('/admin/generate',{name:'Draft',brief:'Review suppliers.'})).status,503);
 const demo=await call('/admin/import-skill',{name:'Demo Supplier Review',file:archive(required)});assert.equal(demo.status,201);assert.equal(demo.data.verification.status,'demo');
 const verified=await call('/admin/import-skill',{name:'Supplier Review',file:archive({...required,[CERTIFICATE_FILE]:certificate()})});assert.equal(verified.data.verification.status,'verified');
 const skill=async id=>(await call('/admin/types/'+id)).data;
 const current=await skill(verified.data.id);assert.equal(current.verification.verifiedBy,'Jane Doe, Head of Risk, Example Capital');
 assert.equal((await call('/types')).data.find(type=>type.id===verified.data.id).verification.status,'verified');
 assert.equal((await call('/admin/types',{id:current.id,name:'Supplier Review (Renamed)',criteria:current.criteria,playbook:current.playbook,report_template:current.report_template})).status,200);
 assert.equal((await skill(current.id)).verification.status,'verified');
 assert.equal((await call('/admin/types',{id:current.id,name:'Supplier Review',criteria:current.criteria+'\nInclude delivery penalties.',playbook:current.playbook})).status,200);
 assert.equal((await skill(current.id)).verification.status,'demo');
});
