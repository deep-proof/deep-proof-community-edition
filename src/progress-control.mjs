import {readArtifact} from './safe-files.mjs';

export const PROGRESS_INTERVAL_MS=60000;
export const PROGRESS_REMINDER='Progress checkpoint: apply skills/review-progress/SKILL.md now. Update progress.md atomically with 2–3 short sentences about the evidence or criterion actually checked, any preliminary observation supported by a named source, and the next verification. If still waiting on a tool, say what is being checked without inventing results. Continue the original analysis and validation afterward; this is not a request to stop, restart or publish the report. If the report is already validated and complete, finish without starting additional work.';

// One outstanding request at a time; a backend that queues instead of steering
// gets no more reminders, avoiding a backlog of post-analysis model turns.
export function createProgressControl({readProgress,send,now=Date.now}){
 let previous=readProgress(),lastUpdate=now(),lastRequest=0,pending=null,serial=0,stopped=false;
 return {
  tick(){
   if(stopped)return;
   const text=readProgress(),time=now();
   if(text!==previous){previous=text;lastUpdate=time;}
   if(pending||time-lastUpdate<PROGRESS_INTERVAL_MS||time-lastRequest<PROGRESS_INTERVAL_MS)return;
   pending=`progress-${++serial}`;lastRequest=time;
   try{send({type:'message',id:pending,message:PROGRESS_REMINDER});}catch{stopped=true;}
  },
  observe(event){
   if(event.type==='coding-agent-final'){stopped=true;return;}
   if(!pending||event.id!==pending)return;
   if(event.type==='message-accepted'){
    if(event.delivery!=='delivered')stopped=true;
    pending=null;
   }else if(event.type==='message-rejected'){stopped=true;pending=null;}
  },
  stop(){stopped=true;}
 };
}
export function readProgressText(dir){
 try{return readArtifact(dir,'progress.md',100000).toString('utf8').trim();}catch{return '';}
}
