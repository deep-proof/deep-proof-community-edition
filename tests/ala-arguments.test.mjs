import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {alaArguments} from '../src/ala.mjs';
// ALA rejects --control-stdin without --session-id (and --session-id requires
// --cwd and --home in one-shot mode), so analysis invocations must carry all three.
test('analysis invocations pass session id, home and control stdin to ALA',()=>{
 const settings={agent:'omp',models:{},efforts:{}},dir='/tmp/deep-proof-job',task=path.join(dir,'task-1.txt');
 const args=alaArguments({entry:'/ala/bin/ala.mjs',settings,dir,task,attempt:1,kind:'analysis',sessionId:'0c3d0a66-8b4e-4a24-9e2a-6d3ac83a51f1'});
 const at=i=>args.indexOf(i);
 assert.ok(at('--control-stdin')>0,'analysis runs need the control channel');
 assert.equal(args[at('--session-id')+1],'0c3d0a66-8b4e-4a24-9e2a-6d3ac83a51f1');
 assert.equal(args[at('--home')+1],os.homedir());
 assert.equal(args[at('--cwd')+1],dir);
 assert.equal(args[at('--ca')+1],'omp');
 assert.equal(args[at('--taskFile')+1],task);
 assert.equal(args[at('--output')+1],path.join(dir,'response-1.txt'));
});
test('design invocations stay one-shot without a control channel or session',()=>{
 const args=alaArguments({entry:'/ala/bin/ala.mjs',settings:{agent:'codex'},dir:'/tmp/deep-proof-job',task:'/tmp/deep-proof-job/task-2.txt',attempt:2,kind:'design',sessionId:'unused'});
 assert.equal(args.indexOf('--control-stdin'),-1);
 assert.equal(args.indexOf('--session-id'),-1);
 assert.equal(args.indexOf('--home'),-1);
 assert.equal(args[args.indexOf('--output')+1],path.join('/tmp/deep-proof-job','response-2.txt'));
});

test('turns after the first resume the saved ALA session, which ALA otherwise refuses to reuse',()=>{
 const base={entry:'/ala/bin/ala.mjs',settings:{agent:'opencode'},dir:'/tmp/job',task:'/tmp/job/task-2.txt',attempt:2,kind:'analysis',sessionId:'s1'};
 assert.equal(alaArguments(base).includes('--resume-session'),false);
 const args=alaArguments({...base,resume:true});
 assert.equal(args[args.indexOf('--resume-session')-2],'--session-id');
 assert.equal(alaArguments({...base,kind:'design',resume:true}).includes('--resume-session'),false);
});
