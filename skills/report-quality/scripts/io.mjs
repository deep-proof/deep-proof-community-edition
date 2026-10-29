import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export function safePath(root,name='',missing=false){
 const base=path.resolve(root),file=path.resolve(base,name);if(file!==base&&!file.startsWith(base+path.sep))throw Error('Path escapes the workspace.');
 let current=path.parse(file).root;for(const part of file.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);let s;try{s=fs.lstatSync(current);}catch(e){if(missing&&e.code==='ENOENT')continue;throw e;}if(s.isSymbolicLink()||(s.isFile()&&s.nlink!==1))throw Error('Linked artifacts are not allowed.');}return file;
}
export function readBytes(root,name,max=30000000){const file=safePath(root,name),stat=fs.statSync(file);if(!stat.isFile()||stat.size>max)throw Error('Artifact must be a regular file within the size limit.');return fs.readFileSync(file);}
export const read=(root,name,max=20000000)=>readBytes(root,name,max).toString('utf8');
export function write(root,name,value){const file=safePath(root,name,true);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value,null,2),{mode:0o600});}
export const readJSON=(root,name)=>JSON.parse(read(root,name));
export function readJSONL(root,name){const text=read(root,name);return text.split(/\r?\n/).filter(x=>x.trim()).map((line,i)=>{try{return JSON.parse(line);}catch{throw Error(`${name}:${i+1}: invalid JSON.`);}});}
export const jsonl=rows=>rows.map(x=>JSON.stringify(x)).join('\n')+(rows.length?'\n':'');
