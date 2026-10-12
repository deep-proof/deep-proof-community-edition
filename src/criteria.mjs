const clean=s=>s.trim().replace(/^#{1,6}\s+|^(?:[-*+]\s+|\d+[.)]\s+)/,'').replace(/^\*\*(.*?)\*\*(?=\s|$)/,'$1').trim();
const identified=/^([A-Z][A-Z0-9_-]*\d+)\s*(?:[—–:.)-]\s*|\s+)/i;
const titleOf=s=>s.split(/\s+(?:Evidence|Test|Acceptance condition|Warning signs|Uncertainty):/i)[0].replace(/\.\s*$/,'').trim();
// Explicit IDs win over headings/introduction. Otherwise Markdown sections or
// list entries define criteria; plain legacy one-criterion-per-line stays valid.
export function parseCriteria(markdown=''){
 const lines=markdown.replace(/\r/g,'').split('\n');
 const starts=lines.map((raw,index)=>({raw,index,text:clean(raw)}));
 let entries=starts.filter(x=>identified.test(x.text));
 if(!entries.length){
  const headings=starts.filter(x=>/^#{2,6}\s/.test(x.raw));
  if(headings.length){const depth=Math.max(...headings.map(x=>/^#+/.exec(x.raw)[0].length));entries=headings.filter(x=>/^#+/.exec(x.raw)[0].length===depth);}
  else {entries=starts.filter(x=>/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(x.raw));
   if(!entries.length)entries=starts.filter(x=>x.text&&!/^#|^\s*<!--|^\s*```|^\s*---\s*$/.test(x.raw));}
 }
 const ids=new Set();
 return entries.map((entry,index)=>{
  const match=identified.exec(entry.text),id=match?match[1].toUpperCase():`CR${String(index+1).padStart(3,'0')}`;
  if(ids.has(id))throw Error(`Duplicate review criterion ID: ${id}`);ids.add(id);
  const next=entries[index+1]?.index??lines.length;
  return {id,title:titleOf(match?entry.text.slice(match[0].length):entry.text),source:entry.text,instructions:lines.slice(entry.index,next).join('\n').trim()};
 });
}
export function criterionBlocks(markdown){
 const lines=markdown.split('\n'),blocks=[];let current=null,marker=null;
 for(const line of lines){
  const m=/^\s*<!--\s*criterion:\s*([A-Za-z0-9_-]+)\s*-->\s*$/.exec(line);
  if(m){marker=m[1];continue;}
  const h=/^### (.+)$/.exec(line);
  if(h){current={id:marker,title:clean(h[1]),lines:[]};blocks.push(current);marker=null;}
  else if(current)current.lines.push(line);
 }
 return blocks.map(b=>({...b,markdown:b.lines.join('\n').trim()}));
}
