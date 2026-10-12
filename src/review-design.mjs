import {parseCriteria} from './criteria.mjs';
const invalid=message=>{throw Object.assign(new Error(message),{status:400});};
export function designInput(body) {
 const brief=typeof body.brief==='string'?body.brief.trim():'';
 if(!brief||brief.length>40000)invalid('Describe the review you need (up to 40,000 characters).');
 let attachment;
 if(body.attachment){
  const {name,text}=body.attachment;
  if(typeof name!=='string'||name.length>180||!/^.+\.(txt|md)$/i.test(name))invalid('Attach a text or Markdown file (.txt or .md).');
  if(typeof text!=='string'||!text.trim()||Buffer.byteLength(text)>350000||text.includes('\0'))invalid('The attachment must contain readable text, up to 350 KB.');
  attachment={name,text};
 }
 return {brief,...(typeof body.name==='string'?{name:body.name.trim()}:{}),...(attachment?{attachment}:{})};
}
export const designPrompt=`Read skills/review-design/SKILL.md, input.json and reference-manifest.md. Read every supplied reference-files/*/content.md completely, consulting originals and PDF previews for tables, charts, diagrams, speaker notes and visual context. Generate a detailed reusable analysis skill under generated-skill/, including SKILL.md, references/review-criteria.md, references/review-playbook.md, references/methodology.md, references/source-map.md, references/report-template.md and useful domain-specific scripts/*.mjs or scripts/*.py. Read the design skill for the full contract. Preserve the user-supplied name and scope. Source-map links must cover every reference ID using source-material/ID.md#Lx-Ly, identifying which methods or criteria it informs or why content was excluded. Distinguish method reference material from facts about a project dossier. Do not invent requirements or thresholds. Run node validate-output.mjs and fix the complete skill until it passes. Return only a short completion message. Never output the skill as chat JSON.`;
export function validateDesign(result){
 const errors=[];
 if(typeof result?.criteria==='string'){try{if(!parseCriteria(result.criteria).length)errors.push('Provide at least one assessable criterion with a stable ID and short title.');}catch(e){errors.push(e.message);}}
 for(const [field,max] of [['name',120],['criteria',100000],['playbook',100000]])if(typeof result?.[field]!=='string'||!result[field].trim()||result[field].length>max)errors.push(`${field}: provide a nonempty string of at most ${max} characters.`);
 if(errors.length){const error=new Error(errors.join('\n'));error.issues=errors;throw error;}
 return result;
}
