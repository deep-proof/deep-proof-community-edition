import {seededStore} from '../support/seed.mjs';
import {testCatalog} from '../support/catalog.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {analysisFolder,writeAnalysisSources} from '../../src/artifacts.mjs';
import {createApp} from '../../server.mjs';
test('browser: documents, administration and mobile',{skip:process.env.ANALYST_SKIP_BROWSER==='1'},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'analyst-browser-'));
 const {server,db}=(await seededStore(dir),createApp)({dir,catalog:testCatalog()});
 const fixture=JSON.parse(await fs.readFile(new URL('../fixtures/revenue-review.json',import.meta.url),'utf8'));
 const snapshot={...fixture.snapshot,type:{...fixture.snapshot.type,id:'investment',name:'Recorded Revenue Skill'},project:{company:'Nexora Industrial Software AG'},settings:{agent:'codex',models:{codex:'gpt-6-luna'},efforts:{}}};
 const reportDir=analysisFolder(dir,'nexora-software','recorded-report');writeAnalysisSources(reportDir,snapshot);
 await fs.copyFile(new URL('../fixtures/revenue-review.md',import.meta.url),path.join(reportDir,'report.md'));await fs.cp(new URL('../fixtures/charts',import.meta.url),path.join(reportDir,'charts'),{recursive:true});
 db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?)').run('recorded-report','nexora-software','2026-10-07T00:00:00Z','completed',JSON.stringify(snapshot),JSON.stringify({format:'markdown'}),null);

 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const chrome=spawn(process.env.CHROMIUM||'/usr/bin/chromium-browser',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${path.join(dir,'chrome')}`,'about:blank'],{stdio:['ignore','ignore','pipe']});let socket;
 try{
  const endpoint=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error('Chromium startup timed out')),15000);chrome.stderr.on('data',b=>{log+=b;const m=/DevTools listening on (ws:\/\/\S+)/.exec(log);if(m){clearTimeout(timer);resolve(m[1]);}});chrome.on('error',reject);});
  socket=new WebSocket(endpoint);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map(),errors=[];
  socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const target=await send('Target.createTarget',{url:`http://127.0.0.1:${server.address().port}`});const {sessionId:sid}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});await send('Runtime.enable',{},sid);await send('Page.enable',{},sid);
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sid);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const wait=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};
  const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`);
  const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'},sid);await fs.writeFile(`/tmp/deep-proof-${name}.png`,Buffer.from(r.data,'base64'));};
  await wait('!!document.querySelector("#loginForm")');await evaluate(`document.querySelector('[name=username]').value='admin';document.querySelector('[name=password]').value='admin';document.querySelector('#loginForm').requestSubmit()`);await wait('!!document.querySelector("#create")');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},sid);await shot('home');
  const before=await evaluate('parseFloat(getComputedStyle(document.documentElement).fontSize)');await click('#fontLarger');assert.ok(await evaluate('parseFloat(getComputedStyle(document.documentElement).fontSize)')>before);await send('Page.reload',{},sid);await wait('!!document.querySelector("#create")');assert.equal(await evaluate('document.querySelector("#fontReset").textContent'),'110%');await click('#fontReset');
  await click('[data-project]');await wait('!!document.querySelector("#docView h1")');await click('#upload');await evaluate(`document.querySelector('#dialog [name=title]').value='Browser evidence';document.querySelector('#dialog [name=markdown]').value='# Browser source\\nA source statement.';document.querySelector('#dialog form').requestSubmit()`);await wait('!document.querySelector("#dialog").open && document.querySelectorAll("[data-doc]").length===15');
  await evaluate('location.hash="project/nexora-software/analysis"');await wait('document.querySelectorAll("[data-section]").length===9');
  assert.equal(await evaluate('document.querySelector("#results").textContent.includes("Download JSON")'),false);
  const exported=await evaluate(`(async()=>{const r=await fetch(document.querySelector('#exportPDF').href);const data=await r.arrayBuffer();return {status:r.status,type:r.headers.get('content-type'),magic:new TextDecoder().decode(data.slice(0,5))};})()`);assert.equal(exported.status,200);assert.equal(exported.magic,'%PDF-');assert.match(exported.type,/application\/pdf/);
  assert.equal(await evaluate('document.querySelector("#results").textContent.includes("gpt-6-luna")'),false);
  assert.equal(await evaluate('document.querySelector("#results").textContent.includes("codex")'),false);
  assert.ok(await evaluate('document.querySelector("#runs").textContent.includes('+JSON.stringify(snapshot.type.name)+')'));
  await click('#analyse');await wait('!!document.querySelector("#dialog [name=skillId]")');assert.equal(await evaluate('document.querySelector("#dialog [name=skillId]").value'),'');assert.equal(await evaluate('document.querySelector("#dialog [name=report_language]").value'),'en');await evaluate('document.querySelector("#dialog [name=report_language]").value="ro"');await shot('run-language');await click('.close-modal');await click('#analyse');assert.equal(await evaluate('document.querySelector("#dialog [name=report_language]").value'),'en');await click('.close-modal');
  await click('[data-section="1"]');assert.ok(await evaluate('document.querySelectorAll(".criterion-card").length>0'));assert.equal(await evaluate('document.querySelector("#reportView").textContent.includes("Status:")'),false);await shot('criterion-cards');
  await click('[data-section="2"]');await wait('document.querySelector(".report-chart")?.naturalWidth>0');
  await click('[data-citation]');await wait('document.querySelector("#dialog").open');assert.ok(await evaluate('document.querySelector("#dialog").textContent.includes("SUPPORTING EVIDENCE")'));assert.ok(await evaluate('!!document.querySelector(".source-document h1")'));await click('.close-modal');await shot('report');
  assert.equal(await evaluate('document.querySelector("#accountNav").textContent.includes("Password")'),false);
  assert.equal(await evaluate('document.querySelector("#accountNav").textContent.includes("ALA")'),false);
  await evaluate('location.hash=""');await wait('!!document.querySelector("#create")');await click('#create');
  assert.equal(await evaluate('!!document.querySelector("#dialog [name=sector]")'),false);assert.equal(await evaluate('!!document.querySelector("#dialog [name=typeId]")'),false);
  await evaluate(`document.querySelector('#dialog [name=company]').value='No-sector project';document.querySelector('#dialog form').requestSubmit()`);
  await wait('document.querySelector(".workspace-identity h1")?.textContent==="No-sector project"');
  await click('#projectAccess');await wait('!!document.querySelector("#shareUserSearch")');assert.equal(await evaluate('document.querySelectorAll("#dialog [name=accessLevelIds]:checked").length'),1);await evaluate('document.querySelectorAll("#dialog [name=accessLevelIds]").forEach(b=>b.checked=false);document.querySelector("#dialog form").requestSubmit()');await wait('!document.querySelector("#dialog").open');await click('#projectAccess');await wait('!!document.querySelector("#shareUserSearch")');assert.equal(await evaluate('document.querySelectorAll("#dialog [name=accessLevelIds]:checked").length'),0);await shot('project-access');await click('.close-modal');
  await click('#archiveProject');await wait('location.hash==="#archive" && !!document.querySelector("[data-project]")');
  assert.ok(await evaluate('document.querySelector("[data-project]").textContent.includes("No-sector project")'));
  await evaluate('location.hash=""');await wait('!!document.querySelector("#create")');
  assert.equal(await evaluate('[...document.querySelectorAll("[data-project]")].some(b=>b.textContent.includes("No-sector project"))'),false);
  await evaluate('location.hash="archive"');await wait('document.querySelector(".admin-heading h1")?.textContent.startsWith("Archive")');await click('[data-project]');await wait('!!document.querySelector("#archiveProject")');
  assert.equal(await evaluate('document.querySelector("#archiveProject").textContent'),'Restore Project');
  assert.equal(await evaluate('!!document.querySelector("#upload")'),false);
  assert.equal(await evaluate('document.querySelector("#analyse").disabled'),true);
  await click('#archiveProject');await wait('document.querySelector("#archiveProject")?.textContent==="Archive Project" && !!document.querySelector("#upload")');
  await click('#deleteProject');await wait('document.querySelector("#dialog").open');
  assert.ok(await evaluate('document.querySelector("#dialog").textContent.includes("No-sector project")'));
  await click('#cancelDelete');assert.equal(await evaluate('document.querySelector("#dialog").open'),false);
  assert.equal(await evaluate('document.querySelector(".workspace-identity h1").textContent'),'No-sector project');
  await click('#deleteProject');await click('#confirmDelete');await wait('!!document.querySelector("#create")');
  assert.equal(await evaluate('[...document.querySelectorAll("[data-project]")].some(b=>b.textContent.includes("No-sector project"))'),false);

  await evaluate('location.hash="admin"');await wait('!!document.querySelector("#settingsForm")');await click('[data-admin-tab=types]');await wait('!document.querySelector("[data-admin-panel=types]").hidden');await click('#addType');
  assert.equal(await evaluate('!!document.querySelector("#dialog textarea[name=criteria]")'),false);
  assert.equal(await evaluate('!!document.querySelector("#dialog input[type=file]")'),true);
  assert.equal(await evaluate('!!document.querySelector("#writeRules")'),false);
  assert.equal(await evaluate('document.querySelector("#typeBriefForm [name=name]").required'),true);
  // Persisted rules fixture: browser checks do not invoke a language model.
  db.prepare("INSERT INTO types(id,name,criteria,playbook,status) VALUES(?,?,?,?,?)").run('browser-type','Browser type','Evidence quality','Review source evidence.','generating');
  await click('.close-modal');await evaluate('location.hash="admin/review/browser-type"');await wait('!!document.querySelector(".rules-progress-banner")');
  await send('Page.reload',{},sid);await wait('document.querySelector(".rules-progress-banner")?.textContent.includes("developing")');
  db.prepare("UPDATE types SET status='ready' WHERE id='browser-type'").run();await wait('!!document.querySelector("#rulesForm") && !document.querySelector("#saveRules").disabled');
  assert.equal(await evaluate('document.querySelector("#dialog").open'),false);
  await evaluate(`document.querySelector('#typeName').value='Browser type';document.querySelector('#criteriaEditor').value='Evidence quality: '+('Assess source provenance and completeness. '.repeat(100));for(const id of ['typeName','criteriaEditor'])document.getElementById(id).dispatchEvent(new Event('input'))`);
  await click('#playbookTab');
  await evaluate(`document.querySelector('#playbookEditor').value='# Review methodology\\n'+('Compare independent evidence sources and record uncertainty. '.repeat(100));document.querySelector('#playbookEditor').dispatchEvent(new Event('input'))`);
  await click('#criteriaTab');assert.ok(await evaluate('document.querySelector("#criteriaEditor").value.length>3000'));
  await click('#saveRules');await wait('location.hash.startsWith("#admin/review/")&&!location.hash.includes("draft-")&&document.querySelector("#rulesStatus")?.textContent==="Saved"');
  await send('Page.reload',{},sid);await wait('!!document.querySelector("#rulesForm")');
  assert.ok(await evaluate('document.querySelector("#criteriaEditor").value.length>3000'));
  await click('#playbookTab');assert.ok(await evaluate('document.querySelector("#playbookEditor").value.length>3000'));
  assert.equal(await evaluate('document.querySelector("#playbookEditor").hidden'),true);assert.ok(await evaluate('!!document.querySelector("#playbookPreview h1")'));
  await click('#playbookPanel [data-mode="edit"]');assert.equal(await evaluate('document.querySelector("#playbookEditor").hidden'),false);await click('#playbookPanel [data-mode="view"]');
  assert.equal(await evaluate('!!document.querySelector("#rulesForm [name=report_language]")'),false);await click('#playbookTab');await shot('rules');await click('#templateTab');assert.ok(await evaluate('document.querySelector("[name=report_template]").value.includes("role: criteria")'));
  assert.equal(await evaluate('document.querySelector("#templateEditor").hidden'),true);assert.equal(await evaluate('document.querySelectorAll("#templatePreview h2").length'),9);
  await click('#templatePanel [data-mode="edit"]');assert.equal(await evaluate('document.querySelector("#templateEditor").hidden'),false);
  await evaluate('document.querySelector("#templateEditor").value+="\\n\\n## Additional Review Context\\n\\nExplain the decision context with evidence.";document.querySelector("#templateEditor").dispatchEvent(new Event("input"))');
  await click('#templatePanel [data-mode="view"]');assert.equal(await evaluate('document.querySelectorAll("#templatePreview h2").length'),10);assert.ok(await evaluate('document.querySelector("#templatePreview").textContent.includes("Additional Review Context")'));await shot('report-template');
  await click('#saveRules');await wait('document.querySelector("#rulesStatus")?.textContent==="Saved"');await send('Page.reload',{},sid);await wait('!!document.querySelector("#rulesForm")');await click('#templateTab');assert.equal(await evaluate('document.querySelectorAll("#templatePreview h2").length'),10);
  assert.equal(await evaluate('document.querySelector("#skillTab").hidden'),false);await click('#skillReveal');assert.equal(await evaluate('document.querySelector("#skillTab").hidden'),false);await wait('document.querySelectorAll("[data-skill-file]").length>0');await click('[data-skill-file="SKILL.md"]');await wait('document.querySelector("#skillFileView").textContent.includes("Browser type")');assert.equal(await evaluate('document.querySelector("#skillTab").hidden'),false);await shot('skill-files');
  await click('#referencesTab');await evaluate(`const picked=new DataTransfer();picked.items.add(new File(['# Reference one\\nCompare revenue.'],'reference-one.md',{type:'text/markdown'}));picked.items.add(new File(['Reconcile contractual records.'],'reference-two.txt',{type:'text/plain'}));document.querySelector('#referenceUpload').files=picked.files;document.querySelector('#referenceUpload').dispatchEvent(new Event('change'));`);await wait('document.querySelectorAll("#referenceList [data-preview]").length===2 && !document.querySelector("#referenceUpload").disabled');assert.equal(await evaluate('document.querySelector("#rulesStatus").textContent'),'Regeneration needed');
  await click('[data-preview]');await wait('document.querySelector("#dialog .source-document h1")?.textContent==="Reference one"');await click('.close-modal');
  await click('[data-replace]');await evaluate(`const replacement=new DataTransfer();replacement.items.add(new File(['# Updated guide\\nAssess evidence quality.'],'updated-guide.md',{type:'text/markdown'}));document.querySelector('#replaceReference').files=replacement.files;document.querySelector('#replaceReference').dispatchEvent(new Event('change'));`);await wait('document.querySelector("#referenceList").textContent.includes("updated-guide.md") && !document.querySelector("#referenceUpload").disabled');
  await click('[data-remove]');await wait('document.querySelectorAll("#referenceList [data-preview]").length===1');await shot('references');await click('#playbookTab');

  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},sid);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Rules editor must fit mobile viewport');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},sid);
  await evaluate('location.hash="admin"');await wait('document.querySelectorAll("[data-type]").length===2');
  await evaluate(`[...document.querySelectorAll('[data-type]')].find(b=>b.textContent.includes('Browser type')).click()`);await wait('!!document.querySelector("#rulesForm")');assert.equal(await evaluate('document.querySelector("#dialog").open'),false);
  await evaluate('location.hash="admin"');await wait('!!document.querySelector("#addUser")');await shot('admin');
  await evaluate(`document.querySelector('#userSearch').value='missing-user';document.querySelector('#userSearch').dispatchEvent(new Event('input'))`);assert.equal(await evaluate('document.querySelectorAll("[data-user]:not([hidden])").length'),0);assert.equal(await evaluate('document.querySelector("#userList .search-empty").hidden'),false);
  await evaluate(`document.querySelector('#userSearch').value='admin';document.querySelector('#userSearch').dispatchEvent(new Event('input'))`);assert.equal(await evaluate('document.querySelectorAll("[data-user]:not([hidden])").length'),1);
  await evaluate(`document.querySelector('#userSearch').value='';document.querySelector('#userSearch').dispatchEvent(new Event('input'))`);
  for(let i=0;i<4;i++)await click('#fontLarger');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},sid);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Administration must fit mobile at 140% text');await shot('admin-mobile');await click('#fontReset');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},sid);

  await click('[data-admin-tab=configuration]');await wait('document.querySelector("#settingsForm [name=model] option[value=gpt-6-luna]") && !document.querySelector("#settingsForm [name=model]").disabled');
  assert.equal(await evaluate('document.querySelectorAll("#settingsForm select").length'),2);assert.equal(await evaluate('document.querySelectorAll("#settingsForm input").length'),0);
  await evaluate('document.querySelector("#settingsForm [name=agent]").value="claude";document.querySelector("#settingsForm [name=agent]").dispatchEvent(new Event("change"))');
  await wait('!!document.querySelector("#settingsForm [name=model] option[value=test-claude-model]")');assert.equal(await evaluate('!!document.querySelector("#settingsForm [name=model] option[value=gpt-6-luna]")'),false);
  await evaluate('document.querySelector("#settingsForm [name=model]").value="test-claude-model";document.querySelector("#settingsForm [name=model]").dispatchEvent(new Event("change"));document.querySelector("#settingsForm").requestSubmit()');await wait('document.querySelector("#catalogStatus").textContent.startsWith("Saved." )');await shot('configuration');
  await send('Page.reload',{},sid);await wait('document.querySelector("#settingsForm [name=model]")?.value==="test-claude-model" && !document.querySelector("#settingsForm [name=model]").disabled');assert.equal(await evaluate('document.querySelector("#settingsForm [name=agent]").value'),'claude');
  await click('[data-admin-tab=access]');await wait('!!document.querySelector("#addAccessLevel") && !document.querySelector("[data-admin-panel=access]").hidden');assert.equal(await evaluate('document.querySelectorAll("[data-access-level]").length'),3);await shot('access-levels');await click('#addAccessLevel');await evaluate('document.querySelector("#dialog [name=name]").value="Browser Team";document.querySelector("#dialog form").requestSubmit()');await wait('document.querySelectorAll("[data-access-level]").length===4');await evaluate('[...document.querySelectorAll("[data-access-level]")].find(b=>b.textContent.includes("Browser Team")).click()');await click('#deleteAccessLevel');await click('#confirmDeleteAccessLevel');await wait('document.querySelectorAll("[data-access-level]").length===3');await click('[data-admin-tab=users]');
  await click('#addUser');
  assert.equal(await evaluate('document.querySelectorAll("#dialog [name=accessLevelIds]:checked").length'),1);assert.equal(await evaluate('document.querySelector("#dialog [name=primaryAccessLevelId] option:checked").textContent'),'Everyone');
  assert.equal(await evaluate('document.querySelector("#dialog [name=username]").autocomplete'),'username');
  assert.equal(await evaluate('document.querySelector("#dialog [name=password]").minLength'),8);
  assert.equal(await evaluate('document.querySelector("#dialog [name=password]").required'),true);
  // Submit directly to exercise server-error visibility even if client validation is bypassed.
  await evaluate(`document.querySelector('#dialog [name=username]').value='browser-reviewer';document.querySelector('#dialog [name=password]').value='short';document.querySelector('#dialog form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
  await wait('document.querySelector("#dialog .form-error")?.textContent.includes("8–256")');
  assert.ok(await evaluate('document.querySelector("#dialog").open && !document.querySelector("#dialog .form-error").hidden'));
  await evaluate(`document.querySelector('#dialog [name=password]').value='password123';document.querySelector('#dialog [name=typeIds]').checked=true;document.querySelector('#dialog form').requestSubmit()`);
  await wait('!document.querySelector("#dialog").open && document.querySelectorAll("[data-user]").length===2');
  await click('#addUser');
  await evaluate(`document.querySelector('#dialog [name=username]').value='browser-reviewer';document.querySelector('#dialog [name=password]').value='password123';document.querySelector('#dialog form').requestSubmit()`);
  await wait('document.querySelector("#dialog .form-error")?.textContent.includes("already exists")');
  await click('.close-modal');
  await evaluate(`[...document.querySelectorAll('[data-user]')].find(b=>b.textContent.includes('browser-reviewer')).click()`);
  assert.equal(await evaluate('document.querySelector("#dialog [name=password]").required'),false);
  await evaluate(`document.querySelector('#dialog form').requestSubmit()`);
  await wait('!document.querySelector("#dialog").open');

  await evaluate(`[...document.querySelectorAll('[data-user]')].find(b=>b.textContent.includes('browser-reviewer')).click()`);await click('#deleteUser');await click('#confirmDeleteUser');await wait('!document.querySelector("#dialog").open && document.querySelectorAll("[data-user]").length===1');
  await evaluate(`[...document.querySelectorAll('[data-type]')].find(b=>b.textContent.includes('Browser type')).click()`);await wait('!!document.querySelector("#deleteType")');await click('#deleteType');await click('#confirmDeleteType');await wait('document.querySelectorAll("[data-type]").length===1');
  await click('[data-admin-tab=types]');await wait('!document.querySelector("[data-admin-panel=types]").hidden');await click('#importSkill');await wait('document.querySelector("#dialog h2")?.textContent==="Import Analyst Skill"');assert.equal(await evaluate('document.querySelector("#dialog").textContent.includes("SKILL.md")'),true);
  const originalZip=await fs.readFile(new URL('../fixtures/analysis-type.zip',import.meta.url));
  // Adapt the hand-authored input archive in memory; never regenerate recorded model fixtures.
  const adapted=spawnSync('python3',['-c',`import sys,io,zipfile
src=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
files={n:src.read(n) for n in src.namelist()}
prefix=next(n[:-8] for n in files if n.endswith('SKILL.md'))
files[prefix+'references/report-template.md']=b'<!-- role: criteria -->\\n## Supplier Assessment\\nAssess every criterion.'
files[prefix+'references/review-criteria.md']=b'## C01 - Supplier Evidence\\nReview the supplied evidence.'
files[prefix+'references/review-playbook.md']=b'Compare contractual duties and delivery records.'
files[prefix+'references/methodology.md']=b'Reconcile supplied contracts with delivery records.'
out=io.BytesIO()
with zipfile.ZipFile(out,'w') as z:
 for n,b in files.items(): z.writestr(n,b)
sys.stdout.buffer.write(out.getvalue())`],{input:originalZip});assert.equal(adapted.status,0,adapted.stderr.toString());const zip=adapted.stdout;await evaluate(`const data=Uint8Array.from(atob(${JSON.stringify(zip.toString('base64'))}),c=>c.charCodeAt(0));const selection=new DataTransfer();selection.items.add(new File([data],'supplier.zip',{type:'application/zip'}));document.querySelector('#skillArchive').files=selection.files;document.querySelector('#skillArchive').dispatchEvent(new Event('change'));document.querySelector('#dialog [name=name]').value='Imported methodology';document.querySelector('#dialog form').requestSubmit();`);await wait('document.querySelector("#typeName")?.value==="Imported methodology"');assert.equal(await evaluate('document.querySelector("#rulesStatus").textContent'),'Saved');await click('#skillReveal');assert.equal(await evaluate('document.querySelector("#skillTab").hidden'),false);await wait('document.querySelectorAll("[data-skill-file]").length>=4');await click('#deleteType');await click('#confirmDeleteType');await wait('document.querySelectorAll("[data-type]").length===1');

  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},sid);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Admin must fit mobile viewport');await evaluate('location.hash=""');await wait('!!document.querySelector("#create")');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Home must fit mobile viewport');assert.deepEqual(errors,[]);
  await evaluate('location.hash="admin"');await wait('!!document.querySelector("#addUser")');await click('#addUser');
  db.prepare('DELETE FROM sessions').run();
  await evaluate(`document.querySelector('#dialog [name=username]').value='expired-session-user';document.querySelector('#dialog [name=password]').value='password123';document.querySelector('#dialog form').requestSubmit()`);
  await wait('!!document.querySelector("#loginForm")');
  assert.equal(await evaluate('document.querySelector("#dialog").open'),false);
  assert.ok(await evaluate('document.querySelector("#notice").textContent.includes("session has expired")'));

 }finally{socket?.close();chrome.kill('SIGKILL');await new Promise(r=>server.close(r));db.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
