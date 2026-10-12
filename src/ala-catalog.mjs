import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const unavailable=()=>Object.assign(Error('Could not load the ALA catalog. Check the ALA installation and agent configuration, then retry.'),{status:503});
export function readALACatalog(entry,agent){
 if(!entry)return Promise.reject(Object.assign(Error('ALA was not found. Set its location in Deep Proof Configuration, then retry.'),{status:503}));
 return new Promise((resolve,reject)=>{
  const worker=fileURLToPath(new URL('./ala-catalog-worker.mjs',import.meta.url));
  const child=spawn(process.execPath,[worker,entry,...(agent?[agent]:[])],{stdio:['ignore','pipe','pipe'],detached:true});
  let output='',settled=false;
  const stop=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}};
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
  const timer=setTimeout(()=>{stop();finish(unavailable());},25000);
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>2000000){stop();finish(unavailable());}});
  // Native stderr can contain installation paths or account diagnostics; do not expose it through the API.
  child.stderr.resume();
  child.on('error',()=>finish(unavailable()));
  child.on('close',code=>{if(code!==0)return finish(unavailable());try{finish(null,JSON.parse(output));}catch{finish(unavailable());}});
 });
}
export function createALACatalog(locate,{read=(agent)=>readALACatalog(locate()?.entry,agent),ttl=60000}={}){
 const cached=new Map(),pending=new Map();
 async function fetchCatalog(key,agent){
  const previous=cached.get(key);if(previous&&previous.until>Date.now())return previous.value;
  if(pending.has(key))return pending.get(key);
  if(pending.size>=4)throw Object.assign(Error('Catalog requests are busy. Please retry shortly.'),{status:429});
  const job=(async()=>{
   const result=await read(agent),field=agent?'models':'agents';
   if(!Array.isArray(result?.[field]))throw unavailable();
   const seen=new Set(),values=result[field].filter(item=>typeof item?.id==='string'&&item.id.length>0&&item.id.length<=256&&!/[\r\n\0]/.test(item.id)).filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true;}).map(item=>({id:item.id,label:typeof item.label==='string'?item.label.slice(0,256):item.id,...(!agent?{available:item.available===true}:{})}));
   const value={[field]:values};cached.set(key,{value,until:Date.now()+ttl});return value;
  })();pending.set(key,job);try{return await job;}finally{pending.delete(key);}
 }
 return {
  clear:()=>cached.clear(),
  agents:({refresh=false}={})=>{if(refresh)cached.delete('agents');return fetchCatalog('agents');},
  async models(agent,{refresh=false}={}){if(refresh)cached.delete('models:'+agent);const {agents}=await fetchCatalog('agents');if(!agents.some(a=>a.id===agent&&a.available))throw Object.assign(Error('Choose an installed Agent.'),{status:400});return fetchCatalog('models:'+agent,agent);},
  async validate(body){
   if(typeof body.agent!=='string'||typeof body.model!=='string')throw Object.assign(Error('Choose a Agent and Model.'),{status:400});
   const {agents}=await fetchCatalog('agents');if(!agents.some(a=>a.id===body.agent&&a.available))throw Object.assign(Error('Choose an installed Agent.'),{status:400});
   if(body.model){const {models}=await this.models(body.agent);if(!models.some(m=>m.id===body.model))throw Object.assign(Error('Choose a model supported by the selected Agent.'),{status:400});}
   return {agent:body.agent,models:body.model?{[body.agent]:body.model}:{},efforts:{}};
  }
 };
}
