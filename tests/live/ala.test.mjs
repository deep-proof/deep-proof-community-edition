import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {invokeALA} from '../../src/ala.mjs';
import {reviewPrompt} from '../../src/reports.mjs';
test('live ALA → Codex Luna: review with real evidence citations',{timeout:900000},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'analyst-live-'));
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 const input={project:{company:'Acceptance review'},type:{criteria:'Revenue consistency',playbook:'Compare the two supplied revenue statements for the same year and currency. Identify contradictions and request reconciliation.'},documents:[{id:'management',title:'Management statement',markdown:'# Management statement\nRevenue in 2025 was EUR 12 million.'},{id:'accounts',title:'Accounts extract',markdown:'# Accounts extract\nRevenue in 2025 was EUR 10 million.'}]};
 const result=await invokeALA({root,dir,settings:{agent:'codex',models:{codex:'gpt-6-luna'},efforts:{}},input,prompt:reviewPrompt(input)});
 assert.equal(result.format,'markdown');assert.equal(result.sections.length,9);
 const citations=Object.values(result.citations).map(c=>c.documentId);
 assert.ok(citations.includes('management')&&citations.includes('accounts'));
 
 console.log(`Real ALA/Codex Luna report: ${dir}/report.md`);
});
