import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeUpload,processUpload} from '../src/documents.mjs';
test('document upload validates formats and preserves Markdown text without model calls',async()=>{
 const file={name:'review.md',data:Buffer.from('# Evidence\n\n**Revenue:** 12 million.').toString('base64')};assert.equal((await processUpload(file,'Review')).markdown,'# Evidence\n\n**Revenue:** 12 million.');
 assert.throws(()=>decodeUpload({...file,name:'review.exe'}),/Supported formats/);assert.throws(()=>decodeUpload({...file,name:'review.pdf'}),/valid PDF/);assert.throws(()=>decodeUpload({...file,name:'review.docx'}),/valid Office/);assert.throws(()=>decodeUpload({...file,data:'!!!'}),/Invalid/);
});
