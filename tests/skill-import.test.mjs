import {skillIdentity} from '../src/skill-bundle.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {importSkillArchive} from '../src/skill-import.mjs';
const entry='---\nname: supplier-review\ndescription: Review supplied supplier evidence.\n---\n\n# Supplier review\n\nCompare contractual duties and delivery records.\n';
async function archive(entries,symlink=false){const r=spawnSync('python3',['-c',`import sys,json,io,zipfile,base64,stat\nb=io.BytesIO()\nwith zipfile.ZipFile(b,'w') as z:\n for name,text in json.load(sys.stdin).items():\n  info=zipfile.ZipInfo(name)\n  if ${symlink?'True':'False'} and name.endswith('linked.md'): info.external_attr=(stat.S_IFLNK|0o777)<<16\n  z.writestr(info,text)\nprint(base64.b64encode(b.getvalue()).decode())`],{input:JSON.stringify(entries),encoding:'utf8'});assert.equal(r.status,0,r.stderr);return {name:'analysis.zip',data:r.stdout.trim()};}
test('imports one analysis type with preserved helpers, and rejects unsafe archives without executing code',async()=>{
 const required={'supplier/references/review-criteria.md':'## C01 — Contractual Duties\nAssess supplied contracts.','supplier/references/review-playbook.md':'Compare contractual duties and delivery records.','supplier/references/methodology.md':'Compare contractual duties with actual deliveries.','supplier/references/report-template.md':'<!-- role: criteria -->\n## Contractual Duties\nAssess each criterion.'};
 const imported=await importSkillArchive(await archive({...required,'supplier/SKILL.md':entry,'supplier/scripts/check.py':'raise RuntimeError("must not execute")\n'}),'imported-type');assert.match(imported.files['SKILL.md'],/name: analysis-type-imported-type/);assert.match(imported.criteria,/Contractual Duties/);assert.match(imported.playbook,/contractual duties/);assert.ok(imported.files['scripts/check.py']);
 await assert.rejects(importSkillArchive(await archive({...required,'supplier/SKILL.md':entry.replace('supplier-review','Supplier Review')}),'bad-name'),/Skill name/);
 await assert.rejects(importSkillArchive(await archive({'SKILL.md':entry}),'incomplete'),/Missing required skill file/);
 for(const file of [await archive({'SKILL.md':entry,'../outside.txt':'escape'}),await archive({'SKILL.md':entry,'references/linked.md':'/etc/passwd'},true),await archive({'first/SKILL.md':entry,'second/SKILL.md':entry})])await assert.rejects(importSkillArchive(file,'invalid'),e=>e.status===400);
});

test('skill identity is read only from frontmatter and enforces the naming contract',()=>{
 assert.equal(skillIdentity(entry).name,'supplier-review');
 for(const name of ['Supplier Review','supplier_review','-supplier','supplier-','supplier--review','révision','x'.repeat(65),'"supplier-review"'])assert.throws(()=>skillIdentity(entry.replace('name: supplier-review','name: '+name)),/Skill name/);
 for(const description of ['', '""', "''",'|','>','x'.repeat(1025)])assert.throws(()=>skillIdentity(entry.replace('description: Review supplied supplier evidence.','description: '+description)),/description/);
 assert.throws(()=>skillIdentity(entry.replace('name: supplier-review\n','')+'\nname: supplier-review\n'),/exactly one name/);
 assert.throws(()=>skillIdentity(entry.replace('name: supplier-review','name: supplier-review\nname: second')),/exactly one name/);
 assert.throws(()=>skillIdentity(entry.replace('description: Review supplied supplier evidence.','description: One\ndescription: Two')),/exactly one name/);
 assert.equal(skillIdentity(entry.replace('description: Review supplied supplier evidence.','description: "Review supplier evidence: contracts and deliveries."')).description,'Review supplier evidence: contracts and deliveries.');
});
