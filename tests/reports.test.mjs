import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateReport} from '../src/reports.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/revenue-review.json',import.meta.url),'utf8'));
test('recorded real Luna report has complete sections and valid evidence citations',()=>{
 assert.doesNotThrow(()=>validateReport(fixture.report,fixture.snapshot));
});
test('report validator rejects damaged citations and missing review content',()=>{
 for(const damage of [
  r=>r.sections.pop(),
  r=>r.sections[0].items[0].citations=[],
  r=>r.sections[0].items[0].citations[0].documentId='absent-document',
  r=>r.sections[0].items[0].citations[0].quote='Not in the source',
  r=>r.sections[0].items[0].citations[0].endLine=999,
  r=>r.sections[1].items[0].criterion='Unreviewed criterion',
  r=>r.sections[1].items[0].status='unknown',
  r=>r.sections[0].items[0].uncertainty='',
 ]){const report=structuredClone(fixture.report);damage(report);assert.throws(()=>validateReport(report,fixture.snapshot));}
});
