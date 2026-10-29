import test from 'node:test';
import assert from 'node:assert/strict';
import {executeTurnWithContinuation,isEmptyResponseFailure,MAX_EMPTY_CONTINUATIONS,CONTINUATION_NOTE} from '../src/ala.mjs';

const empty=()=>Error('Deep Proof engine exited with code 5. ala: OpenCode completed without a final response.\n');
const base={root:'.',dir:'.',settings:{},attempt:1,prompt:'work',started:Date.now(),budgetMs:900000,kind:'analysis',sessionId:'s',input:{},artifactDir:'.'};

test('an empty model response is recognised only from the engine diagnostic',()=>{
 assert.equal(isEmptyResponseFailure(empty()),true);
 assert.equal(isEmptyResponseFailure(Error('Deep Proof reached its 15-minute review limit.')),false);
});

test('an empty response is recovered once in the same session with a recovery note',async()=>{
 const turns=[],prepared=[];
 await executeTurnWithContinuation({...base,prepare:async x=>prepared.push(x),run:async turn=>{turns.push(turn);if(turns.length<2)throw empty();}});
 assert.deepEqual(turns.map(t=>t.attempt),[1,'1-continue1']);
 assert.ok(turns.every(t=>t.sessionId==='s'));assert.deepEqual(turns.map(t=>t.resume),[false,true]);
 assert.equal(turns[0].prompt,'work');assert.equal(turns[1].prompt,'work'+CONTINUATION_NOTE);
 assert.equal(prepared.length,1);
});

test('continuations are bounded and other failures are never retried',async()=>{
 let calls=0;
 await assert.rejects(executeTurnWithContinuation({...base,prepare:async()=>{},run:async()=>{calls++;throw empty();}}),/without a final response/);
 assert.equal(calls,2);assert.equal(MAX_EMPTY_CONTINUATIONS,1);
 calls=0;
 await assert.rejects(executeTurnWithContinuation({...base,prepare:async()=>{},run:async()=>{calls++;throw Error('Deep Proof engine exited with code 2.');}}),/code 2/);
 assert.equal(calls,1);
 calls=0;
 await assert.rejects(executeTurnWithContinuation({...base,kind:'design',prepare:async()=>{},run:async()=>{calls++;throw empty();}}));
 assert.equal(calls,1);
});

test('the recovery budget is shared by every turn of one run so repair attempts cannot loop',async()=>{
 const recoveries={used:0};let calls=0;
 const run=async()=>{calls++;throw empty();};
 await assert.rejects(executeTurnWithContinuation({...base,recoveries,prepare:async()=>{},run}));
 assert.equal(calls,2);
 await assert.rejects(executeTurnWithContinuation({...base,attempt:2,recoveries,prepare:async()=>{},run}));
 assert.equal(calls,3);
});

test('a validation repair turn after a successful first turn resumes the session',async()=>{
 const recoveries={used:0,turns:0},seen=[];
 await executeTurnWithContinuation({...base,recoveries,run:async t=>{seen.push(t.resume);}});
 await executeTurnWithContinuation({...base,attempt:2,recoveries,run:async t=>{seen.push(t.resume);}});
 assert.deepEqual(seen,[false,true]);
});
