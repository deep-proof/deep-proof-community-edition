import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
// Agent-writable artifacts must never redirect server reads or writes outside their tree.
export function safePath(root,name='',{missing=false}={}){
 const base=path.resolve(root),target=path.resolve(base,name);
 if(target!==base&&!target.startsWith(base+path.sep))throw Error('Artifact path escapes its folder.');
 let current=path.parse(target).root;const parts=target.slice(current.length).split(path.sep).filter(Boolean);
 for(let i=0;i<parts.length;i++){
  current=path.join(current,parts[i]);let stat;try{stat=fs.lstatSync(current);}catch(error){if(missing&&error.code==='ENOENT')continue;throw error;}
  if(stat.isSymbolicLink()||(i<parts.length-1&&!stat.isDirectory()))throw Error('Artifact paths must not contain symbolic links.');
  if(stat.isFile()&&stat.nlink!==1)throw Error('Artifact files must not use hard links.');
 }
 return target;
}
export function safeDirectory(root,name=''){
 const folder=safePath(root,name,{missing:true});fs.mkdirSync(folder,{recursive:true,mode:0o700});safePath(root,name);return folder;
}
export function readArtifact(root,name,maxBytes=10000000){
 const file=safePath(root,name),fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
 try{const resolved=fs.realpathSync(`/proc/self/fd/${fd}`),base=path.resolve(root);if(resolved!==base&&!resolved.startsWith(base+path.sep))throw Error('Artifact resolved outside its folder.');const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||stat.size>maxBytes)throw Error('Artifact must be a regular file within the size limit.');const buffer=Buffer.alloc(stat.size+1);let bytes=0,n;while(bytes<buffer.length&&(n=fs.readSync(fd,buffer,bytes,buffer.length-bytes,null)))bytes+=n;if(bytes>stat.size)throw Error('Artifact changed while being read.');return buffer.subarray(0,bytes);}finally{fs.closeSync(fd);}
}
export function writeArtifact(root,name,data){
 const target=safePath(root,name,{missing:true});safeDirectory(root,path.dirname(name));
 const temporary=path.join(path.dirname(target),'.write-'+randomUUID());
 try{fs.writeFileSync(temporary,data,{flag:'wx',mode:0o600});safePath(root,name,{missing:true});fs.renameSync(temporary,target);}finally{fs.rmSync(temporary,{force:true});}
}
