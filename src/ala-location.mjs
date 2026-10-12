// Locates the ALA command-line entrypoint. Deep Proof reaches coding agents only through ALA.
import fs from 'node:fs';
import path from 'node:path';
const ENTRY=path.join('bin','ala.mjs');
// Accept an ALA checkout folder or its bin/ala.mjs entrypoint.
function inspect(candidate){
 let entry=path.resolve(candidate);
 try{if(fs.statSync(entry).isDirectory())entry=path.join(entry,ENTRY);entry=fs.realpathSync(entry);}catch{return {valid:false,reason:'Not found.'};}
 const alaRoot=path.dirname(path.dirname(entry));
 let name;try{name=JSON.parse(fs.readFileSync(path.join(alaRoot,'package.json'),'utf8')).name;}catch{}
 if(path.basename(entry)!=='ala.mjs'||name!=='advanced-language-agent'||!fs.existsSync(path.join(alaRoot,'src/coding-agents/discovery.mjs')))return {valid:false,reason:'This location is not an ALA installation.'};
 return {valid:true,entry,alaRoot,dependencies:fs.existsSync(path.join(alaRoot,'node_modules'))};
}
function onPath(){
 for(const folder of (process.env.PATH||'').split(path.delimiter).filter(Boolean)){const file=path.join(folder,'ala');try{if(fs.statSync(file).isFile())return fs.realpathSync(file);}catch{}}
 return null;
}
// ALA_CLI is an operator override; a saved location comes next; automatic detection is the fallback.
export function alaCandidates(root,configured){
 if(process.env.ALA_CLI)return [{source:'environment',location:process.env.ALA_CLI}];
 if(configured)return [{source:'configured',location:configured}];
 const candidates=[{source:'parent',location:path.resolve(root,'..','AdvancedLanguageAgent')},{source:'application',location:path.resolve(root,'AdvancedLanguageAgent')}];
 const installed=onPath();if(installed)candidates.push({source:'path',location:installed});
 return candidates;
}
// An explicit location is authoritative: an invalid one is reported, never silently replaced.
export function resolveALA(root,settings={}){
 const configured=typeof settings.alaPath==='string'&&settings.alaPath.trim()?settings.alaPath.trim():null,checked=[];
 for(const candidate of alaCandidates(root,configured)){
  const result=inspect(candidate.location);checked.push({...candidate,reason:result.valid?null:result.reason});
  if(result.valid)return {found:true,source:candidate.source,entry:result.entry,root:result.alaRoot,dependencies:result.dependencies,configured,checked};
 }
 return {found:false,configured,checked};
}
export function validateALALocation(location){
 if(typeof location!=='string'||!location.trim()||location.length>4096||/[\0\r\n]/.test(location))throw Object.assign(Error('Enter the ALA folder or its bin/ala.mjs path.'),{status:400});
 if(!path.isAbsolute(location.trim()))throw Object.assign(Error('Use an absolute path for the ALA location.'),{status:400});
 const result=inspect(location.trim());if(!result.valid)throw Object.assign(Error(`${result.reason} Expected an AdvancedLanguageAgent checkout containing bin/ala.mjs.`),{status:400});
 return location.trim();
}
// First start: adopt an ALA checkout found next to the application folder as the saved location.
export function autoConfigureALA(root,settings){
 if(settings.alaPath)return null;
 const parent=path.resolve(root,'..','AdvancedLanguageAgent');return inspect(parent).valid?parent:null;
}
export const alaUnavailable='ALA was not found. An administrator must set its location in Administration → Deep Proof Configuration.';
