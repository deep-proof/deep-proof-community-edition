import {reportTemplate,defaultReportTemplate} from './report-template.mjs';
export const sections=reportTemplate(defaultReportTemplate).map(s=>s.title);
export function reportErrors(report,snapshot) {
 const errors=[],add=message=>{if(errors.length<100)errors.push(message);};
 if(!report||!Array.isArray(report.sections)){return ['The root object must have a sections array: {"sections":[...]}'];}
 if(report.sections.length!==sections.length)add(`Expected all nine sections; found ${report.sections.length}.`);
 const criteria=snapshot.type.criteria.split('\n').map(x=>x.trim()).filter(Boolean),covered=new Set();
 for(const [index,title] of sections.entries()){
  const section=report.sections[index],prefix=`sections[${index}] (${title})`;
  if(section?.title!==title)add(`${prefix}: title must match exactly.`);
  if(!Array.isArray(section?.items)||!section.items.length){add(`${prefix}: supply at least one substantive, cited item.`);continue;}
  for(const [j,item] of section.items.entries()){
   const at=`${prefix}.items[${j}]`;
   if(!item||typeof item!=='object'){add(`${at}: expected an object.`);continue;}
   if(typeof item.statement!=='string'||!item.statement.trim())add(`${at}.statement: an atomic assertion is required.`);
   if(!['fact','inference','gap','recommendation','question'].includes(item.kind))add(`${at}.kind: use fact, inference, gap, recommendation or question.`);
   if(!['high','medium','low'].includes(item.confidence))add(`${at}.confidence: use high, medium or low.`);
   if(typeof item.uncertainty!=='string'||!item.uncertainty.trim())add(`${at}.uncertainty: explain the limits of this assertion.`);
   if(index===1){
    if(!criteria.includes(item.criterion))add(`${at}.criterion: must exactly match a nonempty criteria line in input.json.`);else covered.add(item.criterion);
    if(!['met','partial','not_met','not_assessable'].includes(item.status))add(`${at}.status: use met, partial, not_met or not_assessable.`);
   }
   if(!Array.isArray(item.citations)||!item.citations.length){add(`${at}.citations: every assertion requires supporting evidence.`);continue;}
   for(const [k,c] of item.citations.entries()){
    const cite=`${at}.citations[${k}]`,doc=snapshot.documents.find(d=>d.id===c?.documentId);
    if(!doc){add(`${cite}.documentId: select an existing document ID from input.json.`);continue;}
    const lines=doc.markdown.split(/\r?\n/);
    if(!Number.isInteger(c.startLine)||!Number.isInteger(c.endLine)||c.startLine<1||c.endLine<c.startLine||c.endLine>lines.length){add(`${cite}: invalid line range for ${doc.id}; use 1-based inclusive lines between 1 and ${lines.length}.`);continue;}
    if(typeof c.quote!=='string'||!c.quote.trim()||!lines.slice(c.startLine-1,c.endLine).join('\n').includes(c.quote))add(`${cite}.quote: must be an exact nonempty substring of ${doc.id}, lines ${c.startLine}–${c.endLine}. Read the raw source and correct the quote or range; never change the source.`);
   }
  }
 }
 for(const criterion of criteria)if(!covered.has(criterion))add(`Criterion was not reviewed: ${criterion}`);
 return errors;
}
export function validateReport(report,snapshot){
 const errors=reportErrors(report,snapshot);
 if(errors.length){const error=new Error(errors.join('\n'));error.issues=errors;throw error;}
 return report;
}
export function reviewPrompt(snapshot){
 const chapters=reportTemplate(snapshot?.reportTemplate||defaultReportTemplate),criteriaTitle=chapters.find(s=>s.role==='criteria').title;
 return `Read skills/evidence-review/SKILL.md and skills/evidence-review/references/charts.md. Review the supplied sources/*.md against review-criteria.md and review-playbook.md. input.json and evidence-lines.json are reference metadata for exact source identifiers and line numbers. Create the complete professional narrative report in report.md using normal Markdown, following report-template.md (chapter guidance and order are authoritative), with these canonical section identifiers in order: ${chapters.map(s=>s.title).join('; ')}. For each section, put <!-- section: CANONICAL ENGLISH TITLE --> immediately before ## followed by its title translated into the requested report language; the markers above remain exact. Read criteria.json for the canonical assessable criteria (IDs, short titles and detailed instructions). Under ${criteriaTitle}, put <!-- criterion: ID --> immediately before each ### short translated criterion title, followed by <!-- assessment: supported|mixed|unsupported|insufficient_evidence --> with exactly one value. Assess each ID exactly once. Do not assess document titles or introductory instructions, and do not paste the full criterion instructions into headings. Write a concise, cited assessment explaining what the evidence shows and what remains uncertain; no repetitive Status/Confidence/Uncertainty fields. Assessment labels refer to the criterion in context, not an invented universal compliance standard. Confidence concerns the strength of the actual finding and belongs in the explanation when useful and the final uncertainty section. Use at most two text columns per table: short item title and substantive details including citations. Findings, risks and issues may add up to three narrow categorical estimate columns (Low/Medium/High, translated), only for dimensions relevant to the analysis; do not invent numeric scores. Use narrative paragraphs where clearer; never bullet points or numbered lists. Read skills/evidence-review/references/report-structure.md for decision summaries and evidence-grounded overview charts. Every substantive paragraph, table data row and chart caption must cite evidence using [^e1] footnotes. Define footnotes at the end in this exact Markdown form:
[^e1]: [Source title](sources/DOCUMENT_ID.md#L2-L3)
    > Exact quotation from the indicated source lines
Use real IDs and 1-based inclusive source lines. Continue multiline quotations with four spaces followed by > on every line. Footnote labels contain letters, numbers, underscores or hyphens. Each factual assertion must be supported by its citations, not merely followed by an unrelated link. Distinguish reported claims from independent verification. Cover every criterion, cite both sides of contradictions, bound missing-evidence claims to the reviewed sources, and explain uncertainty. Create sophisticated relevant charts when the source data supports them, following the chart skill. Put static SVG/PNG figures and matching CSV data with an evidence column under charts/. Embed figures as ![Meaningful caption](charts/name.svg), with source footnotes in the adjacent caption. Never fabricate chart data, thresholds, precision or confidence intervals. Run node validate-output.mjs, inspect and repair every reported error, and repeat until it exits 0. Then review the reasoning, citation relevance and visual clarity; revalidate after any edit. Do not alter sources, review rules, input metadata, skills or validator code. Do not browse. Keep the final response short; the application reads report.md and its chart files, never the chat response.`;
}
