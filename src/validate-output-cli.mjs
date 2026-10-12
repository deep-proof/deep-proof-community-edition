import fs from 'node:fs/promises';
import {readValidatedOutput,outputFile} from './output-validation.mjs';
try{
 const input=JSON.parse(await fs.readFile('input.json','utf8'));
 const {kind}=JSON.parse(await fs.readFile('output-contract.json','utf8'));
 await readValidatedOutput(process.cwd(),input,kind);
 console.log(`VALID: ${outputFile(kind)} passed structural, coverage and evidence checks. Review the meaning and relevance of every assertion before finishing.`);
}catch(error){
 console.error(JSON.stringify({valid:false,errors:error.issues||[error.message]},null,2));
 process.exitCode=1;
}
