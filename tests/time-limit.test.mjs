import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runLimits,chooseMinutes,wrapUpMinutes,defaultCheckMinutes,CHECK_MINUTES,ANALYSIS_MINUTES,DEFAULT_ANALYSIS_MINUTES} from '../src/run-limits.mjs';
import {wrapUpAfterTimeLimit,timeLimitError,WRAP_UP_NOTE} from '../src/ala.mjs';
import {timeLimitedReport,publishTimeLimited,progressNotes} from '../src/partial-result.mjs';
import {analysisFailure} from '../src/analysis-failure.mjs';
import {convertTimedOutRuns,wrappedUp} from '../src/partial-result.mjs';
import {DatabaseSync} from 'node:sqlite';
import {analysisFolder} from '../src/artifacts.mjs';

test('the chosen limit is the total: the write-up is reserved inside it, and skill generation keeps its own limit',()=>{
 assert.deepEqual(runLimits('design'),{workMs:900000,wrapUpMs:0});
 const total=limits=>(limits.workMs+limits.wrapUpMs)/60000;
 assert.equal(total(runLimits('analysis',{kind:'quality',timeLimitMinutes:35})),35);assert.equal(runLimits('analysis',{kind:'quality',timeLimitMinutes:35}).wrapUpMs,5*60000);
 assert.equal(runLimits('analysis',{kind:'quality',timeLimitMinutes:10}).wrapUpMs,120000,'15% of 10 minutes, rounded to whole minutes, is the wrap-up');assert.equal(total(runLimits('analysis',{kind:'quality',timeLimitMinutes:10})),10);
 assert.equal(total(runLimits('analysis',{kind:'quality',qualityOptions:{depth:'deep'}})),defaultCheckMinutes('deep'));assert.equal(total(runLimits('analysis',{kind:'quality',qualityOptions:{depth:'triage'}})),15);
 assert.equal(total(runLimits('analysis',{})),DEFAULT_ANALYSIS_MINUTES);assert.equal(total(runLimits('analysis',{timeLimitMinutes:240})),240);
 assert.equal(runLimits('analysis',{},{DEEP_PROOF_WORK_MS:'1500',DEEP_PROOF_WRAPUP_MS:'400'}).workMs,1500);
 assert.equal(wrapUpMinutes(240),5);assert.equal(wrapUpMinutes(3),1);
});

test('only offered minute choices are accepted',()=>{
 assert.equal(chooseMinutes(undefined,CHECK_MINUTES,35),35);assert.equal(chooseMinutes('60',CHECK_MINUTES,35),60);assert.equal(chooseMinutes(10,CHECK_MINUTES,35),10);
 for(const bad of [7,'abc',0,-5,1e9,'35.5'])assert.throws(()=>chooseMinutes(bad,CHECK_MINUTES,35),/offered time limits/);
 assert.throws(()=>chooseMinutes(10,ANALYSIS_MINUTES,60));assert.equal(chooseMinutes(240,ANALYSIS_MINUTES,60),240);
});

test('time-limit errors are recognised by code, never by words that engine diagnostics may contain',()=>{
 assert.equal(timeLimitError().code,'TIME_LIMIT');
 assert.equal(analysisFailure(timeLimitError().message).code,'timeout');
 assert.match(WRAP_UP_NOTE(true),/incomplete/);assert.match(WRAP_UP_NOTE(false),/executive summary/);
});

test('after the time limit the agent gets one wrap-up turn and its validated output is used',async()=>{
 const limits={workMs:1000,wrapUpMs:50};let turn;
 const result=await wrapUpAfterTimeLimit({error:timeLimitError(),kind:'analysis',limits,runTurn:async t=>{turn=t;},readOutput:async()=>({format:'markdown'})});
 assert.deepEqual(result,{format:'markdown'});assert.equal(turn.remaining,50);
});

test('without valid wrap-up output the original time-limit error is kept so notes can be published',async()=>{
 const error=timeLimitError(),failures=[];
 await assert.rejects(wrapUpAfterTimeLimit({error,kind:'analysis',limits:{wrapUpMs:50},runTurn:async()=>{throw Error('resume failed');},readOutput:async()=>{throw Error('invalid');},recordFailure:async e=>failures.push(e.message)}),e=>e===error);
 assert.deepEqual(failures,['invalid']);
});

test('only time-limited analysis runs get a wrap-up turn',async()=>{
 let turns=0;const other=Error('Deep Proof engine exited with code 5.');
 for(const [error,kind,limits] of [[other,'analysis',{wrapUpMs:50}],[timeLimitError(),'design',{wrapUpMs:50}],[timeLimitError(),'analysis',{wrapUpMs:0}]])
  await assert.rejects(wrapUpAfterTimeLimit({error,kind,limits,runTurn:async()=>{turns++;},readOutput:async()=>({})}),e=>e===error);
 assert.equal(turns,0);
});

test('the partial report is honest: notes are labelled unvalidated and an empty run says nothing was found in time',()=>{
 const snapshot={report_language:'ro'};
 const withNotes=timeLimitedReport(snapshot,'Prima notă.\n\n---\n\n<!-- finding: F1 -->A doua notă.\n');
 assert.match(withNotes,/^# Limita de Timp Atinsă/);assert.match(withNotes,/nu este un raport validat/);assert.match(withNotes,/Prima notă\.\n\nA doua notă\./);assert.doesNotMatch(withNotes,/finding: F1/);
 const empty=timeLimitedReport({report_language:'en'},'');
 assert.match(empty,/No problem was identified in the allotted time/);assert.match(empty,/not evidence that none exists/);assert.doesNotMatch(empty,/Nothing above has been confirmed/);
 assert.match(timeLimitedReport({report_language:'sv'},'x'),/not a validated report/,'languages without a translation fall back to English');
 const many=timeLimitedReport({},Array.from({length:40},(_,i)=>'note '+i).join('\n---\n'));assert.ok(!many.includes('note 0\n')&&many.includes('note 39'),'only the latest notes are kept');
});

test('publishing a time-limited result writes report.md and marks quality checks as time-limited',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'partial-'));
 try{
  fs.writeFileSync(path.join(folder,'progress.md'),'Am citit sursele.\n');assert.equal(progressNotes(folder),'Am citit sursele.\n');assert.equal(progressNotes(path.join(folder,'missing')),'');
  const analysis=publishTimeLimited({folder,snapshot:{report_language:'ro'},progress:progressNotes(folder)});
  assert.deepEqual(analysis,{format:'markdown',partial:{reason:'time_limit'}});assert.match(fs.readFileSync(path.join(folder,'report.md'),'utf8'),/Am citit sursele\./);
  const check=publishTimeLimited({folder,snapshot:{kind:'quality',report_language:'en'},progress:''});
  assert.equal(check.quality.timeLimited,true);assert.equal(check.quality.confirmedFindings,0);assert.equal(check.quality.completion,'incomplete');
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('a stuck agent is stopped at the limit, gets one resumed wrap-up turn, and the run ends with its notes (fake ALA, no model)',async t=>{
 const {invokeALA}=await import('../src/ala.mjs');
 const root=path.resolve(import.meta.dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'time-limit-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 // A minimal stand-in for ALA: the first turn records a note and hangs; a resumed turn exits without a report.
 const ala=path.join(dir,'fake-ala');fs.mkdirSync(path.join(ala,'bin'),{recursive:true});fs.mkdirSync(path.join(ala,'src/coding-agents'),{recursive:true});
 fs.writeFileSync(path.join(ala,'package.json'),JSON.stringify({name:'advanced-language-agent'}));fs.writeFileSync(path.join(ala,'src/coding-agents/discovery.mjs'),'');
 fs.writeFileSync(path.join(ala,'bin/ala.mjs'),`import fs from 'node:fs';const a=process.argv.slice(2),val=f=>a[a.indexOf(f)+1],cwd=val('--cwd'),resume=a.includes('--resume-session');
fs.appendFileSync(cwd+'/fake-ala-calls.log',JSON.stringify({resume,task:val('--taskFile')})+'\\n');
if(resume)process.exit(0);fs.writeFileSync(cwd+'/progress.md','Prima observație preliminară.\\n');setInterval(()=>{},1000);`);
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/revenue-review.json'),'utf8'));
 const job=path.join(dir,'job'),snapshot={...fixture.snapshot,report_language:'ro'};
 const saved={...process.env};process.env.DEEP_PROOF_WORK_MS='1500';process.env.DEEP_PROOF_WRAPUP_MS='4000';
 const started=Date.now();let failure;
 try{await invokeALA({root,dir:job,settings:{agent:'codex',models:{},efforts:{},alaPath:ala},input:snapshot,prompt:'Review the dossier.',artifactDir:dir});}catch(error){failure=error;}finally{for(const key of ['DEEP_PROOF_WORK_MS','DEEP_PROOF_WRAPUP_MS'])if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
 assert.ok(failure,'the run must not complete without a validated report');assert.equal(failure.code,'TIME_LIMIT');assert.ok(Date.now()-started<12000,'the limit must stop the agent promptly');
 const calls=fs.readFileSync(path.join(job,'fake-ala-calls.log'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
 assert.deepEqual(calls.map(call=>call.resume),[false,true],'the wrap-up resumes the same session');
 assert.match(fs.readFileSync(path.join(job,'task-wrapup.txt'),'utf8'),/THE TIME LIMIT HAS BEEN REACHED/);
 const result=publishTimeLimited({folder:job,snapshot,progress:progressNotes(job)});
 assert.equal(result.partial.reason,'time_limit');assert.match(fs.readFileSync(path.join(job,'report.md'),'utf8'),/Prima observație preliminară\./);
});

test('runs stored as failed by the old fixed limit become Time Limit Reached with their saved note, once',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'migrate-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE runs(id TEXT,project_id TEXT,created_at TEXT,status TEXT,snapshot TEXT,result TEXT,error TEXT)');
 const add=(id,error)=>db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?)').run(id,'p1','2026-10-29','failed',JSON.stringify({kind:'quality',report_language:'en'}),null,error);
 add('old-limit','Deep Proof reached its 15-minute review limit. No report was published.');add('old-time','Deep Proof reached its review time limit. No report was published.');add('engine','Deep Proof engine exited with code 5. the 15-minute review limit was mentioned by the source');add('other','createInterface is not defined');
 for(const id of ['old-limit','old-time']){const folder=analysisFolder(dir,'p1',id);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'progress.md'),'Last saved note of '+id+'.\n');}
 assert.equal(convertTimedOutRuns({db,dir}),2);
 const rows=Object.fromEntries(db.prepare('SELECT id,status,result,error FROM runs').all().map(r=>[r.id,r]));
 assert.equal(rows['old-limit'].status,'completed');assert.equal(rows['old-limit'].error,null);assert.equal(JSON.parse(rows['old-limit'].result).quality.timeLimited,true);
 assert.match(fs.readFileSync(path.join(analysisFolder(dir,'p1','old-limit'),'report.md'),'utf8'),/Last saved note of old-limit/);
 assert.equal(rows.engine.status,'failed');assert.equal(rows.other.status,'failed','only real time-limit errors are converted');
 assert.equal(convertTimedOutRuns({db,dir}),0,'the migration does not repeat');
});

test('a validated result written during the wrap-up turn is recognised as cut short',t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'wrapped-'));t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
 assert.equal(wrappedUp(folder),false);
 fs.writeFileSync(path.join(folder,'validation-result.json'),JSON.stringify({valid:true,attempt:1}));assert.equal(wrappedUp(folder),false);
 fs.writeFileSync(path.join(folder,'validation-result.json'),JSON.stringify({valid:true,attempt:'wrapup'}));assert.equal(wrappedUp(folder),true);
});
