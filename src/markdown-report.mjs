import {parseCriteria,criterionBlocks} from './criteria.mjs';
import {snapshotChapters,criteriaChapter} from './report-template.mjs';
import {renderMarkdown,renderInline,splitTable,ratingColumns} from './markdown.mjs';
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const refPattern=/\[\^([a-zA-Z0-9_-]+)\]/g;
export function parseMarkdownReport(markdown){
 const lines=markdown.replace(/\r\n/g,'\n').split('\n'),body=[],citations=Object.create(null),errors=[];
 for(let i=0;i<lines.length;i++){
  const match=/^\[\^([a-zA-Z0-9_-]+)\]:\s*\[([^\]]+)\]\(sources\/([a-zA-Z0-9_-]+)\.md#L(\d+)-L(\d+)\)\s*$/.exec(lines[i]);
  if(match){
   const quote=[];while(i+1<lines.length&&/^ {4}> ?/.test(lines[i+1]))quote.push(lines[++i].replace(/^ {4}> ?/,''));
   if(Object.hasOwn(citations,match[1]))errors.push(`Duplicate evidence footnote: ${match[1]}.`);
   citations[match[1]]={label:match[1],title:match[2],documentId:match[3],startLine:Number(match[4]),endLine:Number(match[5]),quote:quote.join('\n')};
  }else if(/^\[\^[^\]]+\]:/.test(lines[i]))errors.push(`Malformed evidence definition on line ${i+1}. Use [^e1]: [Title](sources/id.md#L2-L3) followed by indented > quote lines.`);
  else body.push(lines[i]);
 }
 const resultSections=[];let current,sectionKey=null;
 for(const line of body){
  const marker=/^\s*<!--\s*section:\s*(.*?)\s*-->\s*$/.exec(line);
  if(marker){sectionKey=marker[1];continue;}
  const match=/^## (.+)$/.exec(line);
  if(match){current={title:sectionKey||match[1].trim(),displayTitle:match[1].trim(),lines:[]};sectionKey=null;resultSections.push(current);}
  else if(current)current.lines.push(line);
  else if(line.trim()&&!line.startsWith('# '))errors.push('Put all review content inside the required sections.');
 }
 const chartFiles=[...new Set([...markdown.matchAll(/!\[[^\]]*\]\(charts\/([a-zA-Z0-9_-]+\.(?:svg|png))\)/g)].map(m=>m[1]))];
 return {format:'markdown',markdown,sections:resultSections.map(({title,displayTitle,lines})=>({title,displayTitle,markdown:lines.join('\n').trim()})),citations,chartFiles,errors};
}
export function validateMarkdownReport(markdown,snapshot){
 const sections=snapshotChapters(snapshot).map(s=>s.title),result=parseMarkdownReport(markdown),errors=[...result.errors],add=x=>{if(errors.length<100)errors.push(x);};
 if(result.sections.length!==sections.length)add('Include exactly the chapters defined by the skill Report Template.');
 for(const [i,title] of sections.entries())if(result.sections[i]?.title!==title)add(`Section ${i+1} must be "## ${title}".`);
 for(const c of Object.values(result.citations)){
  const doc=snapshot.documents.find(d=>d.id===c.documentId),lines=doc?.markdown.split(/\r?\n/);
  if(!doc){add(`Evidence ${c.label}: unknown source ${c.documentId}.`);continue;}
  if(c.startLine<1||c.endLine<c.startLine||c.endLine>lines.length){add(`Evidence ${c.label}: source ${doc.id} has ${lines.length} lines; fix the range.`);continue;}
  const normalized=s=>s.replace(/\s+/g,' ').trim();
  if(!c.quote.trim()||!normalized(lines.slice(c.startLine-1,c.endLine).join('\n')).includes(normalized(c.quote)))add(`Evidence ${c.label}: quote must match ${doc.id} lines ${c.startLine}–${c.endLine}; copy the source text without paraphrasing.`);
 }
 const citationsUsed=new Set();
 for(const section of result.sections){
  if(!section.markdown.trim())add(`${section.title}: section is empty.`);
  const paragraphs=section.markdown.split(/\n\s*\n/);
  for(const [paragraphIndex,paragraph] of paragraphs.entries()){
   const meaningful=paragraph.split('\n').filter(l=>l.trim()&&!/^\s*<!--.*-->\s*$/.test(l)&&!/^#{1,6} /.test(l)&&!/^\|?[ :|-]+\|?$/.test(l));if(!meaningful.length)continue;
   const citationContext=/^!\[[^\]]*\]\(charts\/[^)]+\)$/.test(paragraph.trim())?paragraph+' '+(paragraphs[paragraphIndex+1]||''):paragraph;
   const refs=[...citationContext.matchAll(refPattern)].map(m=>m[1]);
   if(!refs.length)add(`${section.title}: each substantive paragraph, list item, table row and chart caption needs evidence footnotes. Missing citation near "${meaningful.join(' ').slice(0,110)}".`);
   for(const ref of refs){citationsUsed.add(ref);if(!Object.hasOwn(result.citations,ref))add(`${section.title}: evidence footnote ${ref} is not defined.`);}
   for(const line of meaningful){if(/^\s*(?:[-*]|\d+\.)\s/.test(line)&&![...line.matchAll(refPattern)].length)add(`${section.title}: list item requires a citation: ${line.slice(0,100)}`);}
   const tableLines=paragraph.split('\n'),divider=tableLines.findIndex(line=>/^\s*\|?\s*:?-{3,}/.test(line)&&line.includes('|'));if(divider>0){for(const row of tableLines.slice(divider+1).filter(line=>line.trim()&&line.includes('|')))if(![...row.matchAll(refPattern)].length)add(`${section.title}: table data row requires an evidence citation.`);}
  }
  for(const match of section.markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g))if(!/^charts\/[a-zA-Z0-9_-]+\.(svg|png)$/.test(match[1]))add('Charts must use a local charts/name.svg or charts/name.png path.');
 }
 const review=result.sections.find(s=>s.title===criteriaChapter(snapshot))?.markdown||'';
 const criteria=parseCriteria(snapshot.type.criteria),assessments=criterionBlocks(review),covered=new Set();
 for(const criterion of criteria){
  const matches=assessments.filter(a=>a.id?a.id===criterion.id:[criterion.source,criterion.title,`${criterion.id} — ${criterion.title}`].includes(a.title));
  if(matches.length!==1)add(`Criterion ${criterion.id}: include exactly one <!-- criterion: ${criterion.id} --> followed by ### and a short title in the report language.`);
  for(const match of matches)covered.add(match);
 }
 for(const assessment of assessments){
  if(!covered.has(assessment))add(`Unknown criterion: ${assessment.title}. Do not assess framework titles or introductory instructions.`);
  if(assessment.id){
   const prose=assessment.markdown.replace(/<!--.*?-->/gs,'').replace(refPattern,'').trim();
   if(!prose||![...assessment.markdown.matchAll(refPattern)].length)add(`Criterion ${assessment.id}: explain the assessment and uncertainty with cited evidence.`);
   if(!/<!--\s*assessment:\s*(supported|mixed|unsupported|insufficient_evidence)\s*-->/.test(assessment.markdown))add(`Criterion ${assessment.id}: include <!-- assessment: supported|mixed|unsupported|insufficient_evidence --> and a cited explanation of the assessment and its limits.`);
  }else{
   if(!/\*\*Status:\*\*\s*(met|partial|not_met|not_assessable)\b/i.test(assessment.markdown))add(`Criterion ${assessment.title}: include **Status:** met, partial, not_met or not_assessable.`);
   if(!/\*\*Confidence:\*\*\s*(high|medium|low)\b/i.test(assessment.markdown)||!assessment.markdown.includes('**Uncertainty:**'))add(`Criterion ${assessment.title}: explain confidence and uncertainty.`);
  }
 }
 if(!citationsUsed.size)add('The report requires cited evidence.');
 if(errors.length){const error=new Error(errors.join('\n'));error.issues=errors;throw error;}
 return result;
}
export function legacyReportToMarkdown(report){
 let n=0;const definitions=[];
 return '# Review report\n\n'+report.sections.map(section=>'## '+section.title+'\n\n'+section.items.map(item=>{
  const refs=item.citations.map(c=>{const label=`e${++n}`;definitions.push(`[^${label}]: [${c.documentId}](sources/${c.documentId}.md#L${c.startLine}-L${c.endLine})\n`+c.quote.split('\n').map(l=>'    > '+l).join('\n'));return `[^${label}]`;}).join(' ');
  return (item.criterion?`### ${item.criterion}\n\n**Status:** ${item.status}. ${refs}\n\n`:'')+`${item.statement} ${refs}\n\n**Confidence:** ${item.confidence}. **Uncertainty:** ${item.uncertainty} ${refs}`;
 }).join('\n\n')).join('\n\n')+'\n\n'+definitions.join('\n\n')+'\n';
}
export function renderReportFragment(markdown,{imageURL=filename=>'charts/'+filename,print=false,criteria,language='en'}={}){
 const inline=text=>{
  let html=renderInline(text);
  html=html.replace(/!\[([^\]]*)\]\(charts\/([a-zA-Z0-9_-]+\.(?:svg|png))\)/g,(_,alt,file)=>`<img class="report-chart" alt="${alt}" src="${escapeHTML(imageURL(file))}">`);
  return html.replace(refPattern,(_,label)=>print?`<a class="evidence-ref" href="#evidence-${label}">[${label}]</a>`:`<button class="evidence-ref" data-citation="${label}" aria-label="Open evidence ${label}">[${label}]</button>`);
 };
 const render=text=>renderMarkdown(text,{inline,reportTables:true});
 if(criteria!==undefined)return renderCriteria(markdown,criteria,language,render);
 return render(markdown);
}


const assessmentLabels={
 en:['Supported','Mixed Evidence','Not Supported','Insufficient Evidence'],ro:['Susținut','Dovezi Mixte','Nesusținut','Dovezi Insuficiente'],
 de:['Gestützt','Gemischte Belege','Nicht Gestützt','Unzureichende Belege'],fr:['Étayé','Éléments Mitigés','Non Étayé','Éléments Insuffisants'],
 es:['Respaldado','Evidencia Mixta','No Respaldado','Evidencia Insuficiente'],it:['Supportato','Evidenze Miste','Non Supportato','Evidenze Insufficienti'],
 pt:['Sustentado','Evidência Mista','Não Sustentado','Evidência Insuficiente'],nl:['Onderbouwd','Gemengd Bewijs','Niet Onderbouwd','Onvoldoende Bewijs'],
 sv:['Stöds','Blandade Belägg','Stöds Inte','Otillräckliga Belägg'],pl:['Potwierdzone','Mieszane Dowody','Niepotwierdzone','Niewystarczające Dowody'],
 cs:['Podloženo','Smíšené Důkazy','Nepodloženo','Nedostatečné Důkazy'],hu:['Alátámasztott','Vegyes Bizonyítékok','Nem Alátámasztott','Elégtelen Bizonyítékok'],
 el:['Τεκμηριώνεται','Μικτά Στοιχεία','Δεν Τεκμηριώνεται','Ανεπαρκή Στοιχεία'],tr:['Destekleniyor','Karışık Kanıtlar','Desteklenmiyor','Yetersiz Kanıt'],
 ru:['Подтверждено','Неоднозначные Данные','Не Подтверждено','Недостаточно Данных'],uk:['Підтверджено','Неоднозначні Дані','Не Підтверджено','Недостатньо Даних'],
 sr:['Поткрепљено','Мешовити Докази','Није Поткрепљено','Недовољно Доказа'],ca:['Sustentat','Evidència Mixta','No Sustentat','Evidència Insuficient']
};
function renderCriteria(markdown,criteria,language,render){
 const catalog=parseCriteria(criteria),blocks=criterionBlocks(markdown),labels=assessmentLabels[language]||assessmentLabels.en;
 return blocks.map(block=>{
  const criterion=catalog.find(c=>block.id?c.id===block.id:[c.source,c.title,`${c.id} — ${c.title}`].includes(block.title));
  // Historic reports mistakenly assessed the framework introduction; retain
  // the saved Markdown but omit those non-criteria from its presentation.
  if(!criterion&&catalog.length)return '';
  const legacy=/\*\*Status:\*\*\s*(met|partial|not_met|not_assessable)\b/i.exec(block.markdown);
  const status=/<!--\s*assessment:\s*(supported|mixed|unsupported|insufficient_evidence)\s*-->/.exec(block.markdown)?.[1]||({met:'supported',partial:'mixed',not_met:'unsupported',not_assessable:'insufficient_evidence'}[legacy?.[1]]);
  const index=['supported','mixed','unsupported','insufficient_evidence'].indexOf(status);
  const headingRefs=[];
  const body=block.markdown.replace(/^\*\*Status:\*\*\s*(?:met|partial|not_met|not_assessable)\.?\s*((?:\[\^[^\]]+\]\s*)*)$/gm,(_,refs)=>{headingRefs.push(refs.trim());return '';});
  const text=body.replace(/\*\*Status:\*\*\s*(met|partial|not_met|not_assessable)\.?/gi,'').replace(/\*\*Confidence:\*\*\s*(high|medium|low)\.?/gi,'').replace(/\*\*Uncertainty:\*\*\s*/g,'').replace(/^\s*((?:\[\^[^\]]+\]\s*)+)$/gm,'$1');
  return `<section class="criterion-card ${status?'assessment-'+status:''}"><header class="criterion-heading"><span class="criterion-id">${escapeHTML(criterion?.id||'')}</span><h3>${renderInline(block.id?block.title:criterion?.title||block.title)}</h3>${index<0?'':`<span class="assessment-label">${escapeHTML(labels[index])}</span>`}${headingRefs.filter(Boolean).length?render(headingRefs.join(' ')):''}</header>${render(text)}</section>`;
 }).join('\n');
}

export function validateReportTables(markdown){
 const lines=markdown.split(/\r?\n/);
 for(let i=0;i<lines.length-1;i++){
  if(!lines[i].includes('|')||!/^\s*\|?\s*:?-{3,}/.test(lines[i+1]))continue;
  const headers=splitTable(lines[i]),rows=[];i+=2;
  while(i<lines.length&&lines[i].includes('|')&&lines[i].trim())rows.push(splitTable(lines[i++]));
  if(headers.length-ratingColumns(headers,rows).length>2)throw Error('Report tables may contain at most two text columns (short item title and details), plus up to three narrow Low/Medium/High assessment columns. Put citations, consequences and uncertainty inside Details.');
 }
}
