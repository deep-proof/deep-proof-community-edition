import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createPDF} from '../../src/pdf.mjs';
import {validateMarkdownReport} from '../../src/markdown-report.mjs';
test('recorded Markdown review exports to a professional PDF with chart and readable citations',async()=>{
 const folder='/tmp/deep-proof-pdf-qa';await fs.mkdir(folder,{recursive:true});
 const fixture=JSON.parse(await fs.readFile(new URL('../fixtures/revenue-review.json',import.meta.url),'utf8'));
 const markdown=await fs.readFile(new URL('../fixtures/revenue-review.md',import.meta.url),'utf8');
 await fs.writeFile(path.join(folder,'report.md'),markdown);await fs.cp(new URL('../fixtures/charts',import.meta.url),path.join(folder,'charts'),{recursive:true});
 const run={snapshot:fixture.snapshot,result:validateMarkdownReport(markdown,fixture.snapshot),created_at:'2026-10-07T00:00:00.000Z'};
 const output=await createPDF(run,folder);const pdf=await fs.readFile(output);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
 const text=spawnSync('pdftotext',[output,'-'],{encoding:'utf8'});assert.equal(text.status,0,text.stderr);assert.match(text.stdout,/Executive Assessment/);assert.match(text.stdout,/Evidence References/);assert.match(text.stdout,/Reported revenue differs/);assert.doesNotMatch(text.stdout,/gpt-6-luna|Download JSON/);
 console.log(`PDF QA: ${output}`);
});
