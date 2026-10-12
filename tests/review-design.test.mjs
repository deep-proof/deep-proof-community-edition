import test from 'node:test';
import assert from 'node:assert/strict';
import {designInput} from '../src/review-design.mjs';
test('review generation receives instructions and the full attached reference',()=>{
 const input={brief:'Review supplier evidence thoroughly.',attachment:{name:'requirements.md',text:'# Requirements\nCheck contractual obligations and evidence gaps.\n'.repeat(200)}};
 assert.deepEqual(designInput(input),input);
 assert.deepEqual(designInput({brief:'  Review quality  '}),{brief:'Review quality'});
});
test('review generation rejects invalid or oversized references before calling AI',()=>{
 for(const input of [{brief:''},{brief:'Review',attachment:{name:'source.pdf',text:'binary'}},{brief:'Review',attachment:{name:'source.txt',text:' '}},{brief:'Review',attachment:{name:'source.md',text:'x'.repeat(350001)}}])assert.throws(()=>designInput(input),e=>e.status===400);
});
