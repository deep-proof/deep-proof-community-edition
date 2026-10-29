import fs from 'node:fs';
import {readArtifact,safePath} from './safe-files.mjs';
// Live console: a read-only, formatted view of the coding agent's session transcript for one analysis.
const MAX_BYTES=8*1024*1024,MAX_TEXT=600;
const clip=(value,limit=MAX_TEXT)=>{const text=String(value??'').replace(/\s+/g,' ').trim();return text.length>limit?text.slice(0,limit)+' …':text;};
export function formatConsoleEvent(event){
 if(!event||typeof event!=='object')return null;
 const time=typeof event.at==='string'?event.at.slice(11,19):'--:--:--';
 let text;
 switch(event.type){
  case 'session':text='Session started';break;
  case 'user':text='Prompt sent: '+clip(event.text,300);break;
  case 'agent-message':text=clip(event.text);if(!text)return null;break;
  case 'turn-end':text=`Turn ended (${clip(event.status,40)||'unknown'})${event.durationMs?` after ${Math.round(event.durationMs/1000)}s`:''}${event.error?': '+clip(event.error,300):''}`;break;
  case 'continuation':return null;
  default:text=clip(event.type,60);
 }
 return `[${time}] ${text}`;
}
// Returns the formatted lines after the first `from` transcript lines and the new transcript length.
export function readConsole(folder,from=0){
 let name;
 try{
  const names=fs.readdirSync(safePath(folder,'.ala/sessions')).filter(n=>/^[\w.-]+\.jsonl$/.test(n)).sort();
  name=names[0];
 }catch{return {available:false,lines:[],total:from};}
 if(!name)return {available:false,lines:[],total:from};
 let text;try{text=readArtifact(folder,'.ala/sessions/'+name,MAX_BYTES).toString('utf8');}catch{return {available:false,lines:[],total:from};}
 // The last element is an empty string or a line still being written; both are skipped until complete.
 const rows=text.split('\n');rows.pop();
 const lines=[];
 for(let i=Math.max(0,from);i<rows.length;i++){let event;try{event=JSON.parse(rows[i]);}catch{continue;}const line=formatConsoleEvent(event);if(line)lines.push(line);}
 return {available:true,lines,total:rows.length};
}
