import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readConsole,formatConsoleEvent} from '../src/console-feed.mjs';

test('console formats transcript events compactly and hides empty ones',()=>{
 assert.equal(formatConsoleEvent({type:'agent-message',at:'2026-10-29T13:00:18.518Z',text:'a\n\n  b'}),'[13:00:18] a b');
 assert.equal(formatConsoleEvent({type:'agent-message',at:'2026-10-29T13:00:18.518Z',text:''}),null);
 assert.equal(formatConsoleEvent({type:'continuation'}),null);
 assert.match(formatConsoleEvent({type:'turn-end',at:'2026-10-29T13:04:31.972Z',status:'failed',durationMs:260367,error:'OpenCode completed without a final response.'}),/Turn ended \(failed\) after 260s: OpenCode completed/);
 assert.ok(formatConsoleEvent({type:'agent-message',text:'x'.repeat(5000)}).length<700);
});

test('console reads only new complete transcript lines and reports a missing session',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'console-'));
 try{
  assert.deepEqual(readConsole(folder),{available:false,lines:[],total:0});
  const dir=path.join(folder,'.ala','sessions');fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'s.jsonl'),row=(seq,text)=>JSON.stringify({seq,type:'agent-message',at:'2026-10-29T13:00:00.000Z',text})+'\n';
  fs.writeFileSync(file,row(1,'one')+row(2,'two')+'{"seq":3,"type":"agent-mes');
  let first=readConsole(folder,0);assert.deepEqual(first.lines,['[13:00:00] one','[13:00:00] two']);assert.equal(first.total,2);
  fs.appendFileSync(file,'sage","at":"2026-10-29T13:00:01.000Z","text":"three"}\n');
  const next=readConsole(folder,first.total);assert.deepEqual(next.lines,['[13:00:01] three']);assert.equal(next.total,3);
  assert.deepEqual(readConsole(folder,next.total).lines,[]);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
