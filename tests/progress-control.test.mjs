import test from 'node:test';
import assert from 'node:assert/strict';
import {createProgressControl} from '../src/progress-control.mjs';

test('progress reminder waits for a quiet minute and avoids outstanding duplicates',()=>{
 let time=0,text='',sent=[];
 const control=createProgressControl({now:()=>time,readProgress:()=>text,send:message=>sent.push(message)});
 time=59000;control.tick();assert.equal(sent.length,0);
 text='Checking the revenue schedule.';time=60000;control.tick();
 time=119000;control.tick();assert.equal(sent.length,0);
 time=120000;control.tick();assert.equal(sent.length,1);assert.equal(sent[0].type,'message');
 time=180000;control.tick();assert.equal(sent.length,1);
 control.observe({type:'message-accepted',id:sent[0].id,delivery:'delivered'});control.tick();assert.equal(sent.length,2);
 control.observe({type:'message-accepted',id:sent[1].id,delivery:'delivered'});
 control.observe({type:'coding-agent-final'});time=300000;control.tick();assert.equal(sent.length,2);
});

test('queued, rejected, broken and stopped channels never accumulate reminders',()=>{
 for(const outcome of ['queued','rejected','broken','stopped']){
  let time=0,count=0,record;
  const control=createProgressControl({now:()=>time,readProgress:()=>'',send:r=>{count++;record=r;if(outcome==='broken')throw Error('closed');}});
  time=60000;control.tick();assert.equal(count,1);
  if(outcome==='queued')control.observe({type:'message-accepted',id:record.id,delivery:'queued'});
  if(outcome==='rejected')control.observe({type:'message-rejected',id:record.id});
  if(outcome==='stopped')control.stop();
  time=600000;control.tick();assert.equal(count,1);
 }
});
