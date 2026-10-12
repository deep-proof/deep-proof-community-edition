import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {reportTemplate,defaultReportTemplate} from '../src/report-template.mjs';
import {validateMarkdownReport,parseMarkdownReport} from '../src/markdown-report.mjs';
import {reviewPrompt} from '../src/reports.mjs';
import {reportHTML} from '../src/pdf.mjs';
import {prepareALAJob} from '../src/ala.mjs';
import {saveSkillRevision,skillReportTemplate,copyTypeSkill,compatibilitySkill} from '../src/type-skills.mjs';
import {readArtifact} from '../src/safe-files.mjs';
const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/revenue-review.json',import.meta.url),'utf8'));
const markdown=await fs.readFile(new URL('./fixtures/revenue-review.md',import.meta.url),'utf8');
// Reorganize recorded assertions only; no generated/simulated model output.
const original=parseMarkdownReport(markdown),definitions=markdown.slice(markdown.indexOf('[^e1]:'));
const template='# Skill Report\n\n<!-- section: summary -->\n## Decision Brief\nExplain the decision.\n\n<!-- role: criteria -->\n<!-- section: assessment -->\n## Evidence Assessment\nAssess all criteria.\n';
const customMarkdown='# Review\n\n<!-- section: summary -->\n## Decision Brief\n\n'+original.sections[0].markdown+'\n\n<!-- section: assessment -->\n## Evidence Assessment\n\n'+original.sections[1].markdown+'\n\n'+definitions;
test('skill-specific chapters validate recorded content and retain evidence checks',()=>{
 const snapshot={...fixture.snapshot,reportTemplate:template};
 const result=validateMarkdownReport(customMarkdown,snapshot);assert.deepEqual(result.sections.map(s=>s.title),['summary','assessment']);
 assert.throws(()=>validateMarkdownReport(customMarkdown.replace('section: summary','section: unknown'),snapshot),/Section 1/);
 assert.throws(()=>validateMarkdownReport(customMarkdown.replace('### Revenue consistency','### Unknown criterion'),snapshot),/Criterion/);
 assert.throws(()=>validateMarkdownReport(customMarkdown.replace('sources/management.md','sources/absent.md'),snapshot),/unknown source/);
 assert.match(reviewPrompt(snapshot),/summary; assessment/);assert.doesNotMatch(reviewPrompt(snapshot),/Under Criterion-by-Criterion Review/);
 assert.equal(validateMarkdownReport(markdown,fixture.snapshot).sections.length,9);
 for(const invalid of ['', '## Empty','<!-- role: criteria -->\n## Duplicate\n## Duplicate','<!-- role: criteria -->\n## A\n<!-- role: criteria -->\n## B'])assert.throws(()=>reportTemplate(invalid));
 assert.equal(reportTemplate(defaultReportTemplate).length,9);
});
test('review files freeze the selected template and revision; PDF preserves custom Markdown chapters',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'analyst-template-'));
 try{
  const type={id:'custom',name:'Custom Analyst Skill',criteria:fixture.snapshot.type.criteria,playbook:'Compare the source evidence.'};
  const files={...compatibilitySkill(type),'references/report-template.md':template};
  type.skill_revision=saveSkillRevision(dir,type,files);
  const snapshot={...fixture.snapshot,type:{...type},reportTemplate:skillReportTemplate(dir,type)};
  const job=path.join(dir,'review');await prepareALAJob({root:process.cwd(),dir:job,artifactDir:dir,settings:{agent:'codex'},input:snapshot,prompt:reviewPrompt(snapshot),kind:'analysis'});
  const later=saveSkillRevision(dir,type,{...files,'references/report-template.md':defaultReportTemplate});
  assert.notEqual(type.skill_revision,later);assert.equal(readArtifact(job,'report-template.md').toString(),template);
  assert.equal(JSON.parse(readArtifact(job,'input.json')).type.skill_revision,type.skill_revision);
  assert.equal(readArtifact(job,`skills/analysis-type-${type.id}/references/report-template.md`).toString(),template);
  const run={snapshot,result:validateMarkdownReport(customMarkdown,snapshot),created_at:'2026-10-07T00:00:00Z'};
  const html=await reportHTML(run,job);assert.match(html,/<h2>Decision Brief<\/h2>/);assert.match(html,/<h2>Evidence Assessment<\/h2>/);assert.match(html,/Custom Analyst Skill/);assert.doesNotMatch(html,/<h2>Risks<\/h2>/);
  assert.match(html,/DEMO ONLY/);const verified=await reportHTML({...run,snapshot:{...snapshot,verification:{status:'verified',verifiedBy:'Jane Doe, Example Capital',verifiedOn:'2026-09-30',evaluationCases:120}}},job);assert.match(verified,/VERIFIED SKILL/);assert.match(verified,/Jane Doe, Example Capital/);assert.doesNotMatch(verified,/DEMO ONLY/);
  const french=await reportHTML({...run,snapshot:{...snapshot,report_language:'fr',type:{...snapshot.type,report_language:'ro'}}},job);assert.match(french,/<html lang="fr">/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
