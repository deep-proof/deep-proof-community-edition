import {reportTemplate} from './report-template.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {readArtifact,safePath} from './safe-files.mjs';
export function skillIdentity(entry){
 const frontmatter=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(entry||'');
 if(!frontmatter)throw Error('SKILL.md must start with YAML frontmatter containing name and description.');
 const fields=frontmatter[1].split(/\r?\n/),names=fields.filter(line=>/^name:/.test(line)),descriptions=fields.filter(line=>/^description:/.test(line));
 if(names.length!==1||descriptions.length!==1)throw Error('SKILL.md frontmatter must contain exactly one name and one description.');
 const name=names[0].slice(5).trim();
 if(name.length>64||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))throw Error('Skill name must be an unquoted lowercase kebab-case slug of 1–64 ASCII characters, without spaces, underscores or repeated hyphens.');
 const raw=descriptions[0].slice(12).trim();let description=raw;
 if(raw.startsWith('"')){try{description=JSON.parse(raw);}catch{throw Error('Skill description must be a valid single-line string.');}}
 else if(raw.startsWith("'")){if(!raw.endsWith("'")||raw.length<2)throw Error('Skill description must be a valid single-line string.');description=raw.slice(1,-1).replace(/''/g,"'");}
 if(typeof description!=='string'||!description.trim()||description.length>1024||/[\r\n]/.test(description)||/^[|>]/.test(raw))throw Error('Skill description must be a nonempty single-line string of at most 1,024 characters.');
 return {name,description};
}
export const validSkillFile=name=>['SKILL.md','LICENSE','NOTICE'].includes(name)||/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_][a-zA-Z0-9_.-]*\.(md|txt|csv|json|mjs|js|ts|py|sh|yaml|yml|toml|html|css|svg)$/.test(name);
export function readSkillFiles(folder){
 const files=Object.create(null);let total=0;
 const visit=(relative='',depth=0)=>{if(depth>6)throw Error('Skill folders are nested too deeply.');for(const item of fs.readdirSync(safePath(folder,relative),{withFileTypes:true})){const name=relative?relative+'/'+item.name:item.name;safePath(folder,name);if(item.isDirectory()){visit(name,depth+1);continue;}if(!validSkillFile(name))throw Error(`Unsupported skill file: ${name}`);const bytes=readArtifact(folder,name,name.startsWith('references/source-material/')?10000000:2000000);if(!name.startsWith('references/source-material/'))total+=bytes.length;if(total>20000000)throw Error('Generated skill exceeds 20 MB.');files[name]=bytes.toString('utf8');}};visit();return files;
}
export function validateSkillBundle(files,input={}){
 const required=['SKILL.md','references/review-criteria.md','references/review-playbook.md','references/methodology.md','references/source-map.md','references/report-template.md'];
 const errors=[];for(const name of required)if(!files[name]?.trim())errors.push(`Missing nonempty generated-skill/${name}.`);
 try{reportTemplate(files['references/report-template.md']);}catch(error){errors.push(error.message);}
 const entry=files['SKILL.md']||'';
 try{const identity=skillIdentity(entry);if(input.typeId&&identity.name!=='analysis-type-'+input.typeId)errors.push('Use name: analysis-type-'+input.typeId+' in SKILL.md.');}catch(error){errors.push(error.message);}
 for(const name of required.slice(1))if(!entry.includes(name))errors.push(`SKILL.md must link to ${name}.`);
 const scripts=Object.keys(files).filter(name=>/^scripts\/.*\.(mjs|py)$/.test(name));if(!scripts.length)errors.push('Include at least one useful domain-specific helper under scripts/ (.mjs or .py).');
 for(const name of scripts){if(!entry.includes(name))errors.push(`Explain when and how to use ${name} in SKILL.md.`);const checked=name.endsWith('.mjs')?spawnSync(process.execPath,['--check','--input-type=module'],{input:files[name],encoding:'utf8',timeout:5000,maxBuffer:100000}):spawnSync('python3',['-c','import ast,sys; ast.parse(sys.stdin.read())'],{input:files[name],encoding:'utf8',timeout:5000,maxBuffer:100000});if(checked.status!==0)errors.push(`${name} has invalid syntax: ${(checked.stderr||checked.error?.message||'syntax check failed').slice(0,1000)}`);}
 const map=files['references/source-map.md']||'';
 for(const reference of input.references||[]){const pattern=new RegExp('source-material/'+reference.id+'\\.md#L(\\d+)-L(\\d+)','g'),matches=[...map.matchAll(pattern)];if(!matches.length)errors.push(`Source map must cover ${reference.name} using a source-material/${reference.id}.md#Lx-Ly link.`);for(const m of matches)if(Number(m[1])<1||Number(m[2])<Number(m[1])||Number(m[2])>reference.lineCount)errors.push(`Invalid source-map line range for ${reference.name}.`);}
 if(errors.length){const error=Error(errors.join('\n'));error.issues=errors;throw error;}return files;
}
