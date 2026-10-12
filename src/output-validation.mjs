import {readArtifact,writeArtifact} from './safe-files.mjs';
import {validateMarkdownReport,validateReportTables} from './markdown-report.mjs';
import {validateChartFiles} from './charts-validation.mjs';
import {readSkillFiles,validateSkillBundle} from './skill-bundle.mjs';
import path from 'node:path';
import {validateDesign} from './review-design.mjs';
export const outputFile=kind=>kind==='analysis'?'report.md':'generated-skill/SKILL.md and all supporting skill files';
async function readFile(dir,name){
 try{return readArtifact(dir,name).toString('utf8');}catch(e){if(e.code==='ENOENT')throw Error(`${name} is missing. Write the complete Markdown file, then run node validate-output.mjs.`);throw e;}
}
export async function readValidatedOutput(dir,input,kind){
 if(kind==='analysis'){const markdown=await readFile(dir,'report.md');if(/^\s*(?:[-+*]|\d+[.)])\s+/m.test(markdown))throw Error('Bullet points and numbered lists are not allowed in report.md. Convert them to cited, prioritized tables or narrative paragraphs.');validateReportTables(markdown);const result=validateMarkdownReport(markdown,input);return validateChartFiles(dir,result);}
 const files=validateSkillBundle(readSkillFiles(path.join(dir,'generated-skill')),input);const result=validateDesign({name:input.name||'Analysis type',criteria:files['references/review-criteria.md'],playbook:files['references/review-playbook.md']});return {...result,files};
}
export async function recordValidationFailure(dir,attempt,error){
 const feedback={attempt,errors:error.issues||[error.message],instruction:'Fix the Markdown output and chart files against the supplied sources without changing input or validators. Run node validate-output.mjs until it passes. Keep the complete output in files; return only a short completion message.'};
 writeArtifact(dir,'validation-errors.json',JSON.stringify(feedback,null,2));
 writeArtifact(dir,`validation-errors-${attempt}.json`,JSON.stringify(feedback,null,2));
 return feedback;
}
