import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validateMarkdownReport,renderReportFragment} from '../src/markdown-report.mjs';
import {readValidatedOutput,recordValidationFailure} from '../src/output-validation.mjs';
import {prepareALAJob} from '../src/ala.mjs';
import {safeSVG} from '../src/charts-validation.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/revenue-review.json',import.meta.url),'utf8'));
const markdown=await fs.readFile(new URL('./fixtures/revenue-review.md',import.meta.url),'utf8');
test('Markdown report preserves recorded assertions, validated footnotes and professional charts',async()=>{
 const report=validateMarkdownReport(markdown,fixture.snapshot);assert.equal(report.sections.length,9);assert.deepEqual(report.chartFiles,['revenue-comparison.svg']);
 assert.ok(report.sections[0].markdown.includes(fixture.report.sections[0].items[0].statement));
 const html=renderReportFragment(report.sections[2].markdown);assert.match(html,/report-chart/);assert.match(html,/data-citation/);
 assert.ok(!renderReportFragment('<script>alert(1)</script>').includes('<script>'));
});
test('Markdown validation gives actionable feedback for missing claims, citations and criteria',()=>{
 for(const damaged of [markdown.replace('## Risks','## Wrong section'),markdown.replace('sources/management.md#L2-L2','sources/missing.md#L2-L2'),markdown.replace('    > Revenue in 2025 was EUR 12 million.','    > Invented evidence'),markdown.replace('### Revenue consistency','### Different criterion'),markdown.replace('## Findings\n','## Findings\n\nUncited assertion.\n'),markdown.replace('**Status:** partial','**Status:** invalid')])assert.throws(()=>validateMarkdownReport(damaged,fixture.snapshot),e=>Array.isArray(e.issues)&&e.issues.length>0);
 assert.throws(()=>validateMarkdownReport(markdown.replace('## Findings\n','## Findings\n\nIssue | Evidence\n--- | ---\nReported revenue | [^e1]\nUncited finding | None\n\n'),fixture.snapshot),/table data row/);
 assert.throws(()=>safeSVG('<svg><script>alert(1)</script></svg>'));
});
test('the exact agent-side validator accepts full files beyond chat limits and rejects damaged output without a model call',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'analyst-file-validation-'));
 try{
  await prepareALAJob({root,dir,settings:{agent:'codex',models:{codex:'gpt-6-luna'},efforts:{}},input:fixture.snapshot,prompt:'Offline validator test',kind:'analysis'});
  const large=markdown.replace('## Findings\n\n','## Findings\n\n'+(fixture.report.sections[2].items[0].statement+' [^e1]\n\n').repeat(160));assert.ok(Buffer.byteLength(large)>16384);
  await fs.writeFile(path.join(dir,'report.md'),large);await fs.cp(new URL('./fixtures/charts',import.meta.url),path.join(dir,'charts'),{recursive:true});
  // Chat text is deliberately irrelevant: the application only reads the complete report file.
  await fs.writeFile(path.join(dir,'response-1.txt'),'Review completed.');
  assert.equal((await readValidatedOutput(dir,fixture.snapshot,'analysis')).sections.length,9);
  const pass=spawnSync(process.execPath,['validate-output.mjs'],{cwd:dir,encoding:'utf8'});assert.equal(pass.status,0,pass.stderr);
  await fs.writeFile(path.join(dir,'report.md'),'# Partial report\n\n## Executive Assessment\n\nUncited claim.');
  const rejected=spawnSync(process.execPath,['validate-output.mjs'],{cwd:dir,encoding:'utf8'});assert.equal(rejected.status,1);assert.match(rejected.stderr,/citation|footnote/i);
  try{await readValidatedOutput(dir,fixture.snapshot,'analysis');assert.fail('Invalid report accepted');}catch(e){await recordValidationFailure(dir,1,e);}
  const feedback=JSON.parse(await fs.readFile(path.join(dir,'validation-errors.json'),'utf8'));assert.ok(feedback.errors.length>1);
  await fs.writeFile(path.join(dir,'report.md'),large);assert.equal((await readValidatedOutput(dir,fixture.snapshot,'analysis')).format,'markdown');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
