import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {hash,read,readBytes,readJSON,readJSONL,safePath} from './io.mjs';
import {qualityInputs,normalizeOptions,profiles} from './prepare.mjs';
export const outputFiles=['mandate.json','claims.jsonl','criteria.jsonl','evidence.jsonl','checks.jsonl','omissions.jsonl','findings.jsonl','review-coverage.jsonl','external-sources.jsonl','coverage.json'];
const claimStates=['supported_within_limits','contradicted','insufficient_support','ambiguous','unverifiable','out_of_scope'];
const confirmed=f=>['confirmed','narrowed'].includes(f.verdict);
export function validateQualityRecords(dir,input){
 const errors=[],add=message=>{if(errors.length<150)errors.push(message);},need=(value,message)=>{if(!value)add(message);},text=value=>typeof value==='string'&&!!value.trim(),array=Array.isArray;
 const data=Object.fromEntries(outputFiles.map(name=>[name.replace(/\.jsonl?$/,''),name.endsWith('.jsonl')?readJSONL(dir,'quality/'+name):readJSON(dir,'quality/'+name)]));
 const {manifest,segments}=qualityInputs(input),options=normalizeOptions(input.qualityOptions),sources=new Map(input.documents.map(d=>[d.id,d.markdown]));
 need(JSON.stringify(readJSON(dir,'quality-input/manifest.json'))===JSON.stringify(manifest),'Prepared source manifest was changed.');
 need(JSON.stringify(readJSONL(dir,'quality-input/segments.jsonl'))===JSON.stringify(segments),'Prepared segment inventory was changed.');
 for(const source of manifest.sources)if(source.originalAvailable&&source.originalSha256)try{need(hash(readBytes(dir,source.originalFile))===source.originalSha256,`${source.id}: original file changed after snapshot.`);}catch(error){add(`${source.id}: original is unavailable: ${error.message}`);}
 for(const source of input.documents)try{need(read(dir,`sources/${source.id}.md`)===source.markdown,`${source.id}: source text changed after snapshot.`);}catch(error){add(`${source.id}: source text unavailable: ${error.message}`);}
 const allIds=new Set([...manifest.sources.map(s=>s.id),...segments.map(s=>s.id),'source-manifest']),maps={};
 for(const name of ['claims','criteria','evidence','checks','omissions','findings','review-coverage','external-sources']){
  maps[name]=new Map();for(const row of data[name]){if(!row||!text(row.id)||allIds.has(row.id)){add(`${name}: every record needs a unique ID across registers.`);continue;}allIds.add(row.id);maps[name].set(row.id,row);}
 }
 for(const row of [data.mandate,data.coverage]){need(row&&text(row.id)&&!allIds.has(row.id),'Mandate and coverage need distinct unique IDs.');if(row?.id)allIds.add(row.id);}
 const refs=(row,key,target,{nonempty=false}={})=>{const list=row?.[key];if(!array(list)){add(`${row?.id}: ${key} must be an array.`);return [];}if(nonempty&&!list.length)add(`${row.id}: ${key} cannot be empty.`);if(new Set(list).size!==list.length)add(`${row.id}: ${key} has duplicates.`);for(const id of list)need(target.has(id),`${row.id}: unknown ${key} reference ${id}.`);return list;};
 const fields=(row,names)=>{for(const name of names)need(text(row?.[name]),`${row?.id}: ${name} must be nonempty text.`);};
 for(const source of data['external-sources']){
  need(options.researchMode==='external'&&options.externalAuthorized,`${source.id}: external evidence is not authorized.`);
  need(!sources.has(source.id),`${source.id}: external ID collides with a supplied source.`);
  need(/^https?:\/\//.test(source.url||'')&&Number.isFinite(Date.parse(source.accessedAt)),`${source.id}: retain a public URL and access date.`);
  need(text(source.version)&&source.sha256===hash(source.content||''),`${source.id}: external version/content hash is invalid.`);
  need(['available','unavailable'].includes(source.availability),`${source.id}: declare external availability.`);
  if(source.availability==='available'){need(text(source.content),`${source.id}: available source needs content.`);sources.set(source.id,source.content);}
 }
 const locator=(l,where)=>{
  if(!l||!sources.has(l.documentId)){add(`${where}: unknown source locator.`);return;}
  const source=sources.get(l.documentId),lines=source.split(/\r?\n/);need(l.sourceHash===hash(source),`${where}: source hash does not match the retained version.`);
  const range=Number.isInteger(l.startLine)&&Number.isInteger(l.endLine)&&l.startLine>=1&&l.endLine>=l.startLine&&l.endLine<=lines.length;
  need(range&&text(l.quote)&&lines.slice(l.startLine-1,l.endLine).join('\n').includes(l.quote),`${where}: quote must exactly match the stated source lines.`);
  for(const field of ['physicalPage','printedPage','section','paragraphId'])need(Object.hasOwn(l,field),`${where}: ${field} must be present (null when unknown).`);
 };
 const m=data.mandate;fields(m,['scope','purpose','materiality','temporalBasis']);need(m.targetDocumentId===manifest.targetDocumentId&&m.targetVersion===manifest.sources.find(s=>s.id===manifest.targetDocumentId).version,'Mandate target/version differs from the input.');
 need(m.depth===options.depth&&m.researchMode===options.researchMode&&m.referenceDate===options.referenceDate,'Mandate changes configured depth, mode or cutoff.');
 for(const field of ['audience','reportDate','coveredPeriod','decisionDate','evaluationDate','assumptions','limits'])need(Object.hasOwn(m,field),`Mandate: declare ${field}, or null when unknown.`);
 need(array(m.assumptions)&&array(m.limits),'Mandate assumptions and limits must be arrays.');
 need(array(m.profiles)&&m.profiles.length&&m.profiles.every(p=>profiles.includes(p.id)&&text(p.reason)),'Mandate needs applicable profile IDs with activation reasons.');
 refs(m,'criteriaIds',maps.criteria,{nonempty:true});need(m.criteriaIds?.length===maps.criteria.size,'Mandate must enumerate all registered criteria.');
 for(const match of (input.type?.criteria||'').matchAll(/^## (Q\d+)\s/gm))need(maps.criteria.has(match[1]),`Missing configured methodology criterion ${match[1]}.`);
 for(const c of data.claims){fields(c,['text','type','importance']);locator(c.locator,c.id);need(c.qualifications&&typeof c.qualifications==='object'&&!array(c.qualifications),`${c.id}: preserve qualifications as an object.`);need(claimStates.includes(c.status)&&array(c.limitations),`${c.id}: invalid claim status/limitations.`);refs(c,'premiseIds',maps.claims);}
 const values={'type.criteria':input.type?.criteria,'sourceReport.criteria':input.sourceReport?.criteria,'qualityOptions.scope':options.scope,'qualityOptions.purpose':options.purpose};
 for(const c of data.criteria){fields(c,['text','scope','reason']);need(['mandatory','advisory','interpretation'].includes(c.obligation)&&['applicable','not_applicable','unknown'].includes(c.applicability),`${c.id}: declare obligation and applicability.`);need(['addressed','justified_absence','unverifiable','not_applicable','pending'].includes(c.coverage),`${c.id}: invalid requirement coverage.`);
  for(const key of ['validFrom','validTo','exceptions'])need(Object.hasOwn(c,key),`${c.id}: declare ${key}.`);
  const b=c.basis;if(b?.kind==='source')locator(b.locator,c.id);else if(b?.kind==='derived'){need(array(b.locators)&&b.locators.length&&text(b.interpretation),`${c.id}: derived criterion needs interpretive sources.`);for(const l of b.locators||[])locator(l,c.id);}else if(b?.kind==='mandate')need(text(values[b.field])&&text(b.quote)&&values[b.field].includes(b.quote),`${c.id}: mandate criterion must quote a supplied mandate field.`);else add(`${c.id}: criterion needs a source, derived or mandate basis.`);
  refs(c,'claimIds',maps.claims);refs(c,'evidenceIds',maps.evidence);if(c.applicability==='not_applicable')need(c.coverage==='not_applicable',`${c.id}: nonapplicable requirement cannot be reported as addressed.`);
 }
 for(const e of data.evidence){need(maps.claims.has(e.claimId),`${e.id}: unknown evidence claim.`);need(['supports','contradicts','qualifies','depends_on','supersedes','same_origin'].includes(e.relation)&&text(e.originId),`${e.id}: declare relationship and provenance origin.`);locator(e.locator,e.id);}
 const kinds=['comparison','numeric','omission','counterevidence','alternative','profile','original_review','serious_revisit','independent_review'];
 for(const c of data.checks){fields(c,['method','result']);need(kinds.includes(c.kind)&&['executed','unavailable','not_applicable','pending','failed'].includes(c.status),`${c.id}: invalid check kind/status.`);if(['unavailable','pending','failed'].includes(c.status))need(text(c.limitation),`${c.id}: unresolved check needs a limitation.`);
  refs(c,'claimIds',maps.claims);refs(c,'criterionIds',maps.criteria);refs(c,'findingIds',maps.findings);need(array(c.locators),`${c.id}: locators must be an array.`);for(const l of c.locators||[])locator(l,c.id);
  need(array(c.artifactPaths),`${c.id}: artifactPaths must be an array.`);for(const file of c.artifactPaths||[]){need(typeof file==='string'&&/^quality\/[a-zA-Z0-9_./-]+$/.test(file)&&!file.split('/').includes('..'),`${c.id}: unsafe check artifact.`);try{read(dir,file);}catch(error){add(`${c.id}: artifact ${file}: ${error.message}`);}}
  if(c.kind==='numeric'&&c.status==='executed'){
   need(c.artifactPaths?.length>=2&&c.locators?.length,`${c.id}: numeric checks must retain inputs, output and exact data sources.`);
   if(c.artifactPaths?.length>=2)try{
    const operands=read(dir,c.artifactPaths[0]),stored=readJSON(dir,c.artifactPaths[1]);
    const run=spawnSync('python3',[fileURLToPath(new URL('./check_numbers.py',import.meta.url)),'--stdio'],{input:operands,encoding:'utf8',timeout:10000,maxBuffer:5000000});
    const normalize=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
    need(run.status===0&&normalize(JSON.parse(run.stdout))===normalize(stored),`${c.id}: numeric output does not match a fresh Decimal recalculation.`);
    c.replayedNumbers=stored;
   }catch(error){add(`${c.id}: numeric replay failed: ${error.message}`);}
  }
 }
 const executed=(id,kind)=>{const check=maps.checks.get(id);return check?.status==='executed'&&(!kind||check.kind===kind);};
 for(const f of data.findings){fields(f,['title']);need(['confirmed','narrowed','clarification','rejected','out_of_scope'].includes(f.verdict),`${f.id}: invalid candidate verdict.`);need(['target','original','reviewer'].includes(f.level),`${f.id}: separate target/original/reviewer levels.`);need(array(f.categories)&&f.categories.length&&f.categories.every(c=>/^F(?:0[1-9]|1[0-2])$/.test(c)),`${f.id}: use defect codes F01–F12.`);need(array(f.profiles)&&f.profiles.length&&f.profiles.every(p=>m.profiles?.some(a=>a.id===p)),`${f.id}: finding profile is not activated.`);
  fields(f.object,['text']);locator(f.object?.locator,f.id);refs(f,'criterionIds',maps.criteria,{nonempty:confirmed(f)});refs(f,'evidenceIds',maps.evidence,{nonempty:confirmed(f)});refs(f,'checkIds',maps.checks,{nonempty:confirmed(f)});refs(f,'dependentClaimIds',maps.claims);refs(f,'relatedFindingIds',maps.findings);
  fields(f.challenge,['alternative','result']);refs(f.challenge,'checkIds',maps.checks,{nonempty:confirmed(f)});need(array(f.limitations),`${f.id}: limitations must be an array.`);
  if(confirmed(f)){
   fields(f,['impact','severityReason','urgencyReason','confidenceReason','remedy','closure']);need(['critical','major','moderate','minor'].includes(f.severity)&&['immediate','before_decision','scheduled'].includes(f.urgency)&&['high','medium'].includes(f.confidence),`${f.id}: confirmed findings need justified severity/urgency and high or medium confidence.`);
   need(f.checkIds?.some(id=>executed(id))&&f.challenge?.checkIds?.some(id=>executed(id,'alternative')),`${f.id}: confirmation needs an executed test and an executed alternative-explanation check.`);
   need(f.criterionIds?.some(id=>maps.criteria.get(id)?.applicability==='applicable'),`${f.id}: confirmation requires an applicable criterion.`);
   need(['verified','limited'].includes(f.originalReview?.status),`${f.id}: declare original-source review.`);refs(f.originalReview,'checkIds',maps.checks,{nonempty:true});need(f.originalReview?.checkIds?.some(id=>executed(id,'original_review')),`${f.id}: original review needs an executed inspection check.`);if(f.originalReview?.status==='limited')need(text(f.originalReview.limitation)&&f.limitations?.length,`${f.id}: limit the finding when original inspection is restricted.`);
   if(f.categories.includes('F06'))need(f.checkIds.some(id=>maps.checks.get(id)?.replayedNumbers?.some(n=>n.status==='executed'&&n.withinTolerance===false)),`${f.id}: a confirmed arithmetic error needs a reproduced discrepancy beyond the declared tolerance.`);
   if(['critical','major'].includes(f.severity))need(f.checkIds?.some(id=>executed(id,'serious_revisit')&&maps.checks.get(id).findingIds?.includes(f.id)),`${f.id}: serious findings need a separate original-evidence revisit.`);
  }
 }
 for(const o of data.omissions){fields(o,['expected','coverage','materiality']);refs(o,'basisCriterionIds',maps.criteria,{nonempty:true});refs(o,'searchedSegmentIds',new Map(segments.map(s=>[s.id,s])),{nonempty:true});refs(o,'checkIds',maps.checks,{nonempty:true});need(array(o.synonyms)&&['found','confirmed_absent','clarification','unverifiable','rejected'].includes(o.verdict),`${o.id}: invalid omission search.`);if(o.findingId)need(maps.findings.has(o.findingId),`${o.id}: unknown linked finding.`);if(o.verdict==='confirmed_absent')need(confirmed(maps.findings.get(o.findingId)||{})&&o.checkIds.some(id=>executed(id,'omission')),`${o.id}: absence needs a confirmed finding and an executed bounded search.`);}
 for(const r of data['review-coverage']){need((maps.claims.has(r.originalClaimId)||(r.originalClaimId===null&&r.status==='unverifiable'))&&maps.claims.has(r.reviewerClaimId),`${r.id}: review comparison claims must resolve.`);if(r.findingId)need(maps.findings.has(r.findingId),`${r.id}: unknown finding.`);fields(r,['reason']);need(['covered_correctly','covered_partially','omitted','unjustified_criticism','unverifiable'].includes(r.status),`${r.id}: invalid review coverage verdict.`);refs(r,'checkIds',maps.checks,{nonempty:true});}
 if(m.profiles?.some(p=>p.id==='review'))need(data['review-coverage'].length&&data.checks.some(c=>c.kind==='independent_review'&&['executed','unavailable'].includes(c.status)),'Review profile requires an independent original-source pass and a coverage matrix, with explicit unavailable outcomes when originals are missing.');
 const coverage=data.coverage;need(['complete','incomplete','triage'].includes(coverage.completion),'Declare complete, incomplete or triage completion.');
 const prepared=new Map(segments.map(s=>[s.id,s])),seen=new Set();need(array(coverage.segments),'Coverage must enumerate prepared segments.');
 for(const s of coverage.segments||[]){const original=prepared.get(s.id);need(original&&!seen.has(s.id)&&s.sourceHash===hash(sources.get(original?.documentId)||''),`${s.id}: segment identity/hash mismatch or duplicate.`);seen.add(s.id);need(['extracted','unavailable'].includes(s.extraction)&&['read','unavailable','pending'].includes(s.reading)&&['checked','not_applicable','unverifiable','pending'].includes(s.claims)&&['checked','not_applicable','unverifiable','pending'].includes(s.requirements),`${s.id}: separate extraction, reading and checking states are required.`);if(s.reading!=='read'||s.claims!=='checked'||s.requirements!=='checked')need(text(s.reason),`${s.id}: explain limited/not-applicable coverage.`);}
 need(seen.size===prepared.size,'Coverage must include every prepared segment, including unavailable or pending work.');
 const sourceSeen=new Set();for(const s of coverage.sources||[]){need(manifest.sources.some(d=>d.id===s.id)&&!sourceSeen.has(s.id),`${s.id}: unknown/duplicate source coverage.`);sourceSeen.add(s.id);need(['verified','limited','unavailable'].includes(s.originalReview)&&text(s.reason),`${s.id}: record original verification and limits.`);}need(sourceSeen.size===manifest.sources.length,'Every original source needs an explicit review/availability state.');
 const gates=new Map();for(const g of coverage.gates||[]){need(/^G[1-7]$/.test(g.id)&&!gates.has(g.id)&&['passed','limited','failed'].includes(g.status)&&text(g.reason),'Gates G1–G7 need unique states and reasons.');gates.set(g.id,g);}need(gates.size===7,'Record all seven gates.');
 refs(coverage,'plannedCheckIds',maps.checks);need(coverage.plannedCheckIds?.length===maps.checks.size,'Every recorded check must belong to the plan.');refs(coverage,'verifiedClaimIds',maps.claims);const verified=data.claims.filter(c=>['supported_within_limits','contradicted','insufficient_support','ambiguous'].includes(c.status)).map(c=>c.id);need(verified.length===coverage.verifiedClaimIds?.length&&verified.every(id=>coverage.verifiedClaimIds.includes(id)),'Verified claim IDs/count must match local claim states.');
 const count=data.findings.filter(confirmed).length;need(coverage.counts?.segmentsRead===(coverage.segments||[]).filter(s=>s.reading==='read').length&&coverage.counts?.claimsChecked===verified.length&&coverage.counts?.confirmedFindings===count,'Coverage counts must be computed from the registers.');need(array(coverage.limitations),'Coverage limitations must be an array.');
 if(options.depth==='triage')need(coverage.completion==='triage','Triage must never claim complete verification.');
 if(coverage.completion==='complete'){
  need(options.depth==='deep'&&![...gates.values()].some(g=>g.status==='failed'),'Complete verification requires deep mode and no failed gate.');need(!(coverage.segments||[]).some(s=>[s.reading,s.claims,s.requirements].includes('pending'))&&!data.checks.some(c=>['pending','failed'].includes(c.status))&&!data.criteria.some(c=>c.coverage==='pending'),'Unfinished planned work cannot claim complete verification.');
 }
 if(data.checks.some(c=>['unavailable','pending','failed'].includes(c.status))||(coverage.sources||[]).some(s=>s.originalReview!=='verified')||[...gates.values()].some(g=>g.status!=='passed'))need(coverage.limitations?.length,'Unresolved evidence or gates must appear in final limitations.');
 // Cycle detection prevents a conclusion depending on itself through other claims/findings.
 for(const [rows,key] of [[data.claims,'premiseIds']]){const visited=new Set(),active=new Set(),map=new Map(rows.map(r=>[r.id,r]));const visit=id=>{if(active.has(id)){add(`${id}: circular ${key} dependency.`);return;}if(visited.has(id))return;active.add(id);for(const next of map.get(id)?.[key]||[])if(map.has(next))visit(next);active.delete(id);visited.add(id);};for(const row of rows)visit(row.id);}
 const markdown=read(dir,'report.md'),footnotes=new Map();
 const narrativeLines=markdown.split(/\r?\n/);for(let i=0;i<narrativeLines.length;i++){
  const match=/^\[\^([A-Za-z0-9_-]+)\]:\s*\[([^\]]+)\]\(sources\/([A-Za-z0-9_-]+)\.md#L(\d+)-L(\d+)\)\s*$/.exec(narrativeLines[i]);if(!match)continue;
  const quote=[];while(i+1<narrativeLines.length&&/^ {4}> ?/.test(narrativeLines[i+1]))quote.push(narrativeLines[++i].replace(/^ {4}> ?/,''));
  need(!footnotes.has(match[1]),`Duplicate narrative footnote ${match[1]}.`);footnotes.set(match[1],true);
  locator({documentId:match[3],startLine:Number(match[4]),endLine:Number(match[5]),quote:quote.join('\n'),sourceHash:hash(sources.get(match[3])||''),physicalPage:null,printedPage:null,section:null,paragraphId:null},'Narrative footnote '+match[1]);
 }
 for(const f of data.findings.filter(confirmed)){const marker=`<!-- finding-detail: ${f.id} -->`,at=markdown.indexOf(marker);const tail=at>=0?markdown.slice(at+marker.length):'';const block=tail.split(/<!--\s*finding-detail:|^## /m)[0];const citations=[...block.matchAll(/\[\^([A-Za-z0-9_-]+)\]/g)].map(m=>m[1]);need(citations.length&&citations.every(label=>footnotes.has(label)),`${f.id}: detailed narrative finding needs defined source citations.`);}
 need(markdown.includes(`<!-- quality-summary: ${coverage.completion}; confirmed=${count} -->`),'Narrative needs the exact completion/count summary marker.');
 for(const [marker,pattern] of [['finding',/<!--\s*finding:\s*([^\s]+)\s*-->/g],['finding-detail',/<!--\s*finding-detail:\s*([^\s]+)\s*-->/g]]){const ids=[...markdown.matchAll(pattern)].map(m=>m[1]);need(ids.length===count&&new Set(ids).size===count&&ids.every(id=>confirmed(maps.findings.get(id)||{})),`Narrative ${marker} IDs must match confirmed findings exactly.`);}
 if(errors.length){const error=Error(errors.join('\n'));error.issues=errors;throw error;}return {completion:coverage.completion,confirmedFindings:count,coverage,files:outputFiles.map(f=>'quality/'+f),findings:data.findings.filter(confirmed).map(f=>({id:f.id,title:String(f.title).slice(0,300),severity:f.severity}))};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{const dir=process.argv[2]||process.cwd(),input=readJSON(dir,'input.json'),result=validateQualityRecords(dir,input);console.log(JSON.stringify({valid:true,completion:result.completion,confirmedFindings:result.confirmedFindings,notice:'Structural validation is not semantic certification.'}));}catch(error){console.error(JSON.stringify({valid:false,errors:error.issues||[error.message]}));process.exitCode=1;}}
