import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import fsSync from 'node:fs';
const bad=message=>{throw Object.assign(Error(message),{status:400});};
export const MAX_UPLOAD_BYTES=20*1024*1024;
export function decodeUpload(file){
 if(!file||typeof file.name!=='string'||file.name.length>180||typeof file.data!=='string')bad('Choose a PDF, Word, PowerPoint, text or Markdown file.');
 const type=path.extname(file.name).slice(1).toLowerCase();if(!['pdf','doc','docx','ppt','pptx','txt','md'].includes(type))bad('Supported formats: PDF, DOC, DOCX, PPT, PPTX, TXT and Markdown.');
 if(file.data.length>Math.ceil(MAX_UPLOAD_BYTES/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.data))bad('Invalid or oversized file. Maximum upload size is 20 MB.');
 const buffer=Buffer.from(file.data,'base64');if(!buffer.length||buffer.length>MAX_UPLOAD_BYTES)bad('Choose a nonempty file up to 20 MB.');
 if(type==='pdf'&&buffer.subarray(0,5).toString()!=='%PDF-')bad('This file is not a valid PDF.');
 if(['docx','pptx'].includes(type)&&buffer.subarray(0,2).toString()!=='PK')bad('This file is not a valid Office document.');
 if(['doc','ppt'].includes(type)&&buffer.subarray(0,8).toString('hex')!=='d0cf11e0a1b11ae1')bad('This file is not a valid legacy Office document.');
 return {name:path.basename(file.name),type,buffer};
}
export async function executeDocumentTool(binary,args,workspace){
 await new Promise((resolve,reject)=>{
  const mounts=['--unshare-all','--die-with-parent','--new-session'];
  for(const entry of ['/usr','/bin','/lib','/lib64','/etc/fonts','/etc/ld.so.cache'])if(fsSync.existsSync(entry))mounts.push('--ro-bind',entry,entry);
  mounts.push('--proc','/proc','--dev','/dev','--tmpfs','/tmp','--dir','/run','--bind',workspace,workspace,'--chdir',workspace,'--setenv','HOME',workspace,'--setenv','TMPDIR',workspace,'--',binary,...args);
  const child=spawn('bwrap',mounts,{stdio:['ignore','ignore','pipe'],detached:true,env:{PATH:process.env.PATH,LANG:'C.UTF-8'}});let error='';
  const timer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}reject(Error('Document processing timed out. Please try a smaller document.'));},60000);
  child.stderr.on('data',b=>error=(error+b).slice(-1500));child.on('error',()=>{clearTimeout(timer);reject(Error(`Document processing could not start its isolated converter.`));});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Could not read this document. It may be encrypted or damaged. '+error));});
 });
}
let conversions=0;
export async function processUpload(file,title,{allowVisualOnly=false}={}){
 if(conversions>=2)throw Object.assign(Error('Two documents are being prepared. Please try again shortly.'),{status:429});
 conversions++;try{return await convertUpload(file,title,allowVisualOnly);}finally{conversions--;}
}
async function convertUpload(file,title,allowVisualOnly){
 const upload=decodeUpload(file);
 if(['txt','md'].includes(upload.type)){const markdown=upload.buffer.toString('utf8');if(!markdown.trim()||markdown.includes('\0')||markdown.length>2000000)bad('The text file must contain readable text, up to 2 million characters.');return {...upload,markdown};}
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'analyst-document-'));
 try{
  const source=path.join(tmp,'document.'+upload.type);await fs.writeFile(source,upload.buffer);let pdf=source;
  let officeText='';
  if(['doc','docx','ppt','pptx'].includes(upload.type)){
   let packageFile=source;
   const office=async(format)=>executeDocumentTool(process.env.LIBREOFFICE||'soffice',[`-env:UserInstallation=${pathToFileURL(path.join(tmp,'office-profile')).href}`,'--headless','--convert-to',format,'--outdir',tmp,source],tmp);
   if(['doc','ppt'].includes(upload.type)){const format=upload.type==='doc'?'docx':'pptx';await office(format);packageFile=path.join(tmp,'document.'+format);}
   await fs.copyFile(new URL('./extract-office.py',import.meta.url),path.join(tmp,'extract-office.py'));
   await executeDocumentTool('python3',[path.join(tmp,'extract-office.py'),packageFile,path.join(tmp,'office.txt')],tmp);
   officeText=await fs.readFile(path.join(tmp,'office.txt'),'utf8');
   await office('pdf');pdf=path.join(tmp,'document.pdf');
   try{await fs.access(pdf);}catch{bad('Document preview could not be generated. Check that the Office file is valid.');}
  }
  const output=path.join(tmp,'extracted.txt');await executeDocumentTool('pdftotext',['-layout','-enc','UTF-8',pdf,output],tmp);
  const extracted=await fs.readFile(output,'utf8');if(!extracted.trim()&&!officeText.trim()&&!allowVisualOnly)bad('This document has no extractable text. Please upload a searchable PDF or a text version; scanned pages require OCR.');
  if(extracted.length+officeText.length>2000000)bad('This document contains too much text. Split it into smaller documents.');
  const pages=extracted.split('\f').map((text,index)=>({text,index})).filter(page=>page.text.trim());
  const markdown=`# ${title}\n\n`+pages.map(page=>`## Page ${page.index+1}\n\n${page.text.trim()}`).join('\n\n')+(officeText?'\n\n# Original Office content\n\n'+officeText:'')+(!extracted.trim()&&!officeText.trim()?'\n\nThis reference has no extractable text. Review the original PDF visually; do not treat missing extracted text as missing content.':'');
  return {...upload,markdown,preview:upload.type!=='pdf'?await fs.readFile(pdf):null};
 }finally{await fs.rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}
export const mimeFor=type=>({pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',doc:'application/msword',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',md:'text/markdown; charset=utf-8',txt:'text/plain; charset=utf-8'}[type]||'text/plain; charset=utf-8');
