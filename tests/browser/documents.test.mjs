import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {processUpload} from '../../src/documents.mjs';
test('Word converts to a browser PDF and both formats preserve searchable evidence',async()=>{
 const bytes=await fs.readFile(new URL('../fixtures/source-document.docx',import.meta.url));const word=await processUpload({name:'source.docx',data:bytes.toString('base64')},'Evidence');assert.equal(word.preview.subarray(0,5).toString(),'%PDF-');assert.match(word.markdown,/Revenue in 2025 was EUR 12 million/);
 const pdf=await processUpload({name:'source.pdf',data:word.preview.toString('base64')},'Evidence');assert.match(pdf.markdown,/Revenue in 2025 was EUR 12 million/);assert.match(pdf.markdown,/## Page 1/);
 await fs.writeFile('/tmp/deep-proof-word-preview.pdf',word.preview);
});

test('PowerPoint preserves notes and hidden slides, and legacy Word/PowerPoint produce PDF previews',async()=>{
 for(const name of ['source-presentation.pptx','source-presentation.ppt','source-document.doc']){
  const data=await fs.readFile(new URL('../fixtures/'+name,import.meta.url));const output=await processUpload({name,data:data.toString('base64')},name);assert.equal(output.preview.subarray(0,5).toString(),'%PDF-');assert.match(output.markdown,/12 million/);
  if(name==='source-presentation.pptx'){assert.match(output.markdown,/Speaker instruction: reconcile/);assert.match(output.markdown,/Slide 2 \(hidden\)/);assert.match(output.markdown,/verify customer concentration/);}
 }
});
