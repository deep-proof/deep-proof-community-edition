import {readArtifact} from './safe-files.mjs';
export function safeSVG(text){
 if(/<\/?[a-zA-Z][\w.-]*:|<\?xml-stylesheet|\\|&#(?:x[0-9a-f]+|[0-9]+);/i.test(text))throw Error('SVG must not use namespace-prefixed elements, CSS escapes or encoded resource references.');
 if(!/<svg\b/i.test(text)||/<(?:script|foreignObject|iframe|object|embed|image|a|animate|set)\b/i.test(text)||/\bon[a-z]+\s*=/i.test(text)||/<!DOCTYPE|<!ENTITY|@import/i.test(text))throw Error('Use a self-contained static SVG without scripts, embedded content or external resources.');
 for(const match of text.matchAll(/(?:href\s*=\s*["']([^"']*)["']|url\(([^)]*)\))/gi)){const target=(match[1]??match[2]).replace(/["']/g,'').trim();if(!target.startsWith('#'))throw Error('SVG resource references must stay inside the same SVG.');}
 return text;
}
export function parseCSV(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw Error('Chart CSV has an unclosed quoted field.');
 row.push(field.replace(/\r$/,''));if(row.some(v=>v.trim()))rows.push(row);return rows;
}
export async function validateChartFiles(dir,report){
 for(const name of report.chartFiles){
  if(!/^[a-zA-Z0-9_-]+\.(svg|png)$/.test(name))throw Error('Invalid chart filename.');
  const image=readArtifact(dir,'charts/'+name);if(name.endsWith('.svg'))safeSVG(image.toString('utf8'));else if(image.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error(`Chart ${name} is not a valid PNG.`);
  let data;try{data=readArtifact(dir,'charts/'+name.replace(/\.(svg|png)$/,'.csv'),2000000).toString('utf8');}catch{throw Error(`Chart ${name} needs a regular CSV data file with an evidence column.`);}
  const rows=parseCSV(data),header=rows.shift()||[],column=header.indexOf('evidence');if(column<0||!rows.length)throw Error(`Chart ${name}: CSV must contain data rows and an evidence column.`);
  for(const [index,row] of rows.entries()){const refs=(row[column]||'').split(';').map(s=>s.trim()).filter(Boolean);if(row.length!==header.length||!refs.length||refs.some(ref=>!Object.hasOwn(report.citations,ref)))throw Error(`Chart ${name}, data row ${index+2}: cite defined evidence footnote labels in the evidence column (separate multiple labels with semicolons).`);}
 }
 return report;
}
