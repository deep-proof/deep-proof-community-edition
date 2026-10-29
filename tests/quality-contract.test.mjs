// Hand-authored schema and arithmetic cases, not generated reviews or captured model output.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {hash,write,jsonl,readJSON} from '../skills/report-quality/scripts/io.mjs';
import {prepareQualityInputs,normalizeOptions} from '../skills/report-quality/scripts/prepare.mjs';
import {validateQualityRecords,outputFiles} from '../skills/report-quality/scripts/validate.mjs';
import {reportQualityFiles,reportQualitySkill,qualityPrompt} from '../src/report-quality.mjs';
import {validateSkillBundle} from '../src/skill-bundle.mjs';
import {withQualityWorkspace,publishQualityOutput} from '../src/quality-job.mjs';
import {writeArtifact} from '../src/safe-files.mjs';
import {analysisFailure} from '../src/analysis-failure.mjs';

const packageDir=fileURLToPath(new URL('../skills/report-quality',import.meta.url));
function schemaCase(){
 const input={documents:[{id:'target',title:'Target',markdown:'# Report\n\nRevenue is 10.',file_type:'md'},{id:'source',title:'Source',markdown:'# Accounts\n\nRevenue is 10.',file_type:'md'}],sourceReport:{documentId:'target'},type:{criteria:'C01 — Check revenue claims.'}};
 const locator=id=>({documentId:id,startLine:3,endLine:3,quote:'Revenue is 10.',sourceHash:hash(input.documents.find(d=>d.id===id).markdown),physicalPage:null,printedPage:null,section:null,paragraphId:id+':L3'});
 const prep=prepareQualityInputs;
 const data={
  mandate:{id:'mandate',targetDocumentId:'target',targetVersion:hash(input.documents[0].markdown),scope:'The supplied report only.',purpose:'Verify the declared revenue.',audience:null,reportDate:null,coveredPeriod:null,decisionDate:null,evaluationDate:null,referenceDate:null,temporalBasis:'Only supplied contemporaneous evidence.',researchMode:'closed',depth:'deep',profiles:[{id:'commercial',reason:'The target reports revenue.'}],materiality:'An incorrect revenue changes the decision.',criteriaIds:['C01'],assumptions:[],limits:[]},
  claims:[{id:'CL01',text:'Revenue is 10.',locator:locator('target'),type:'fact',qualifications:{population:null,period:null,conditions:null,modality:'asserted',quantifiers:null},importance:'Primary amount.',premiseIds:[],status:'supported_within_limits',limitations:[]}],
  criteria:[{id:'C01',text:'Check revenue claims.',basis:{kind:'mandate',field:'type.criteria',quote:'Check revenue claims.'},scope:'Revenue assertion.',validFrom:null,validTo:null,obligation:'advisory',exceptions:[],applicability:'applicable',claimIds:['CL01'],evidenceIds:['E01'],coverage:'addressed',reason:'Applies to the target.'}],
  evidence:[{id:'E01',claimId:'CL01',relation:'supports',locator:locator('source'),originId:'accounts'}],
  checks:[{id:'CH01',kind:'comparison',status:'executed',claimIds:['CL01'],criterionIds:['C01'],findingIds:[],locators:[locator('target'),locator('source')],method:'Compare the matching amounts in the two supplied texts.',result:'Both say 10; no discrepancy.',artifactPaths:[],limitation:null}],
  omissions:[],findings:[],'review-coverage':[],'external-sources':[],
  coverage:{id:'coverage',completion:'complete',segments:[],sources:input.documents.map(d=>({id:d.id,originalReview:'verified',reason:'The supplied original is Markdown text, read directly.'})),gates:Array.from({length:7},(_,i)=>({id:'G'+(i+1),status:'passed',reason:'Resolved in this bounded schema test.'})),plannedCheckIds:['CH01'],verifiedClaimIds:['CL01'],limitations:[],counts:{segmentsRead:2,claimsChecked:1,confirmedFindings:0}}
 };
 return {input,data,locator,prep};
}
async function setup(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quality-contract-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const c=schemaCase();for(const d of c.input.documents)write(dir,`sources/${d.id}.md`,d.markdown);const prepared=c.prep(dir,c.input);c.data.coverage.segments=prepared.segments.map(s=>({id:s.id,sourceHash:hash(c.input.documents.find(d=>d.id===s.documentId).markdown),extraction:'extracted',reading:'read',claims:'checked',requirements:'checked',reason:'Read and checked.'}));return {...c,dir};}
function save(c){for(const name of outputFiles){const key=name.replace(/\.jsonl?$/,'');write(c.dir,'quality/'+name,name.endsWith('.jsonl')?jsonl(c.data[key]):c.data[key]);}const confirmed=c.data.findings.filter(f=>['confirmed','narrowed'].includes(f.verdict));write(c.dir,'report.md',`<!-- quality-summary: ${c.data.coverage.completion}; confirmed=${confirmed.length} -->\n`+confirmed.map(f=>`<!-- finding: ${f.id} -->\n<!-- finding-detail: ${f.id} -->\nSchema citation[^e1].\n`).join('\n')+(confirmed.length?'\n[^e1]: [Source](sources/source.md#L3-L3)\n    > Revenue is 10.\n':''));}

test('self-contained package imports as an Analyst Skill and standalone preparation works outside the app',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quality-portable-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const files=reportQualityFiles();assert.equal(validateSkillBundle(files),files);const input=schemaCase().input;
 const external=path.join(dir,'package');await fs.cp(packageDir,external,{recursive:true});await fs.writeFile(path.join(dir,'input.json'),JSON.stringify(input));
 const prepared=spawnSync(process.execPath,[path.join(external,'scripts/prepare.mjs'),path.join(dir,'input.json'),path.join(dir,'work')],{encoding:'utf8'});assert.equal(prepared.status,0,prepared.stderr);assert.equal(readJSON(path.join(dir,'work'),'quality-input/manifest.json').sources.length,2);
 const snapshot={type:reportQualitySkill(),sourceReport:{documentId:'target'}};assert.match(qualityPrompt(snapshot),/Zero confirmed findings is valid/);assert.ok(snapshot.type.methodology_revision);assert.ok(!Object.keys(files).some(name=>name.startsWith('eval')));
});

test('clean schema permits zero confirmed findings and rejects fabricated citations, hashes, coverage and completion claims',async t=>{
 const c=await setup(t);save(c);assert.equal(validateQualityRecords(c.dir,c.input).confirmedFindings,0);
 const original=structuredClone(c.data);
 for(const mutate of [x=>x.evidence[0].locator.quote='Invented quote',x=>x.evidence[0].locator.sourceHash='wrong-version',x=>x.coverage.segments.pop(),x=>x.coverage.counts.claimsChecked=99,x=>x.coverage.segments[0].claims='pending',x=>x.coverage.gates[0].status='failed',x=>x.criteria[0].basis.quote='Invented obligation',x=>x.mandate.depth='triage',x=>x.claims[0].premiseIds=['CL01'],x=>x.checks[0].artifactPaths=['quality/../../secret']]){
  c.data=structuredClone(original);mutate(c.data);save(c);assert.throws(()=>validateQualityRecords(c.dir,c.input));
 }
 c.data=structuredClone(original);c.data.coverage.segments[0].claims='pending';c.data.coverage.completion='incomplete';save(c);assert.equal(validateQualityRecords(c.dir,c.input).completion,'incomplete');
 c.data=structuredClone(original);save(c);write(c.dir,'quality-input/manifest.json',{id:'tampered'});assert.throws(()=>validateQualityRecords(c.dir,c.input),/manifest was changed/);
});

test('confirmed findings require a contested alternative, applicable criterion, original review and a separate serious revisit',async t=>{
 const c=await setup(t);
 const makeCheck=(id,kind)=>({id,kind,status:'executed',claimIds:['CL01'],criterionIds:['C01'],findingIds:['FIND01'],locators:[c.locator('target'),c.locator('source')],method:'Hand-authored contract test inspection.',result:'Structural test result only; this is not a generated finding.',artifactPaths:[],limitation:null});
 c.data.checks.push(makeCheck('CH02','alternative'),makeCheck('CH03','original_review'),makeCheck('CH04','serious_revisit'));
 c.data.findings=[{id:'FIND01',title:'Schema acceptance test only',categories:['F02'],profiles:['commercial'],level:'target',object:{text:'Revenue is 10.',locator:c.locator('target')},criterionIds:['C01'],evidenceIds:['E01'],checkIds:['CH01','CH03','CH04'],challenge:{alternative:'A possible contextual qualification.',checkIds:['CH02'],result:'Recorded as tested in this contract-only case.'},verdict:'confirmed',impact:'A bounded schema impact.',severity:'major',severityReason:'Required field test.',urgency:'before_decision',urgencyReason:'Required field test.',confidence:'high',confidenceReason:'Required field test.',remedy:'Provide the missing justification.',closure:'Recheck the justification.',dependentClaimIds:['CL01'],relatedFindingIds:[],limitations:[],originalReview:{status:'verified',checkIds:['CH03'],limitation:null}}];
 c.data.coverage.plannedCheckIds=c.data.checks.map(x=>x.id);c.data.coverage.counts.confirmedFindings=1;save(c);assert.equal(validateQualityRecords(c.dir,c.input).confirmedFindings,1);
 const original=structuredClone(c.data);for(const mutate of [x=>x.findings[0].challenge.checkIds=[],x=>x.findings[0].confidence='low',x=>x.findings[0].checkIds=['CH01','CH03'],x=>x.findings[0].originalReview.checkIds=[],x=>{x.criteria[0].applicability='not_applicable';x.criteria[0].coverage='not_applicable';},x=>x.findings[0].categories=['F06']]){c.data=structuredClone(original);mutate(c.data);save(c);assert.throws(()=>validateQualityRecords(c.dir,c.input));}
 c.data=structuredClone(original);c.data.findings[0].verdict='rejected';c.data.coverage.counts.confirmedFindings=0;save(c);assert.equal(validateQualityRecords(c.dir,c.input).confirmedFindings,0);
});

test('external evidence and historical dates require explicit per-run scope; triage cannot claim completeness',async t=>{
 assert.deepEqual(normalizeOptions(),{depth:'deep',researchMode:'closed',referenceDate:null,externalAuthorized:false,scope:null,purpose:null});assert.throws(()=>normalizeOptions({researchMode:'historical'}));assert.throws(()=>normalizeOptions({researchMode:'historical',referenceDate:'2026-02-30'}));assert.throws(()=>normalizeOptions({researchMode:'external'}));assert.equal(normalizeOptions({researchMode:'external',externalAuthorized:true}).externalAuthorized,true);
 const c=await setup(t);c.data['external-sources']=[{id:'EXT01',url:'https://example.org/source',accessedAt:'2026-10-29',publishedAt:null,version:'v1',content:'Public text.',sha256:hash('Public text.'),availability:'available',role:'reference'}];save(c);assert.throws(()=>validateQualityRecords(c.dir,c.input),/external evidence is not authorized/);
 c.input.qualityOptions={researchMode:'external',externalAuthorized:true};c.data.mandate.researchMode='external';save(c);assert.equal(validateQualityRecords(c.dir,c.input).completion,'complete');
 c.input.qualityOptions={depth:'triage'};c.data.mandate.depth='triage';c.data.mandate.researchMode='closed';c.data['external-sources']=[];save(c);assert.throws(()=>validateQualityRecords(c.dir,c.input),/Triage must never/);c.data.coverage.completion='triage';save(c);assert.equal(validateQualityRecords(c.dir,c.input).completion,'triage');
});

test('Decimal arithmetic separates conditional accuracy, coverage, rounding, missing data and zero denominators',async()=>{
 const base={operation:'percent',unit:'percent',reported:'98',tolerance:'0.01',sourceRefs:['E01'],missingPolicy:'reject'};
 const result=spawnSync('python3',[path.join(packageDir,'scripts/check_numbers.py'),'--stdio'],{input:JSON.stringify([{id:'accuracy',...base,values:['98','100']},{id:'coverage',...base,reported:'10',values:['100','1000']},{id:'rounding',...base,operation:'sum',unit:'EUR',values:['0.1','0.2'],reported:'0.3',tolerance:'0'},{id:'zero',...base,values:['0','0']},{id:'missing',...base,values:['98',null]}]),encoding:'utf8'});assert.equal(result.status,0,result.stderr);const rows=JSON.parse(result.stdout);assert.equal(rows[0].actual,'98');assert.equal(rows[1].actual,'10');assert.equal(rows[2].difference,'0.0');assert.equal(rows[3].status,'unavailable');assert.equal(rows[4].status,'unavailable');
});

test('numeric output is replayed and linked artifacts cannot escape the workspace',async t=>{
 const c=await setup(t),numbers=[{id:'N1',operation:'sum',values:['10','2'],unit:'EUR',reported:'10',tolerance:'0',sourceRefs:['E01'],missingPolicy:'reject'}];
 write(c.dir,'quality/numeric-input.json',numbers);const run=spawnSync('python3',[path.join(packageDir,'scripts/check_numbers.py'),'--stdio'],{input:JSON.stringify(numbers),encoding:'utf8'});write(c.dir,'quality/numeric-output.json',run.stdout);
 c.data.checks[0].kind='numeric';c.data.checks[0].artifactPaths=['quality/numeric-input.json','quality/numeric-output.json'];save(c);assert.equal(validateQualityRecords(c.dir,c.input).completion,'complete');
 const changed=JSON.parse(run.stdout);changed[0].actual='99';write(c.dir,'quality/numeric-output.json',changed);assert.throws(()=>validateQualityRecords(c.dir,c.input),/fresh Decimal/);
 await fs.rm(path.join(c.dir,'quality/numeric-output.json'));await fs.symlink('/etc/passwd',path.join(c.dir,'quality/numeric-output.json'));assert.throws(()=>validateQualityRecords(c.dir,c.input),/Linked artifacts/);
});

test('quality execution uses a private temporary folder, copies originals and cleans up on success or failure',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quality-lifecycle-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));writeArtifact(dir,'sources/target.pdf','%PDF-example');const input={documents:[{id:'target',file_type:'pdf'}]};let workspace;
 const result=await withQualityWorkspace(dir,input,async folder=>{workspace=folder;assert.notEqual(folder,dir);assert.equal(await fs.readFile(path.join(folder,'sources/target.pdf'),'utf8'),'%PDF-example');return 'lifecycle-only';});assert.equal(result,'lifecycle-only');await assert.rejects(fs.access(workspace));
 await assert.rejects(withQualityWorkspace(dir,input,async folder=>{workspace=folder;throw Error('Execution failed');}),/Execution failed/);await assert.rejects(fs.access(workspace));
 const incomplete=path.join(dir,'invalid-result');await fs.mkdir(incomplete);await assert.rejects(publishQualityOutput(incomplete,dir,{}));await assert.rejects(fs.access(path.join(dir,'verification-index.json')));
});

test('business failure codes distinguish service access, engine, timeout, validation and interruption without leaking diagnostics',()=>{
 for(const [message,code] of [['Server restarted before this run completed.','interrupted'],['Reached its 15-minute review limit.','timeout'],['Could not validate the review after 3 attempts. SECRET','validation'],['401 authentication failed, private-token','access'],['ALA was not found.','engine'],['disk error SECRET','unexpected'],['Deep Proof engine exited with code 5. timeout validate quoted source\nala: OpenCode completed without a final response.\n','empty_response']]){const result=analysisFailure(message);assert.equal(result.code,code);assert.equal(result.reportAvailable,false);assert.ok(!JSON.stringify(result).includes('SECRET'));assert.ok(!JSON.stringify(result).includes('private-token'));}
});
