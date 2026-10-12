function esc(s='') {
  return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

export function renderInline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s=s.replace(/(?<!!)\[([^\]\n]+)\]\(([^\s)]+)\)/g,(match,label,url)=>{
    if(!/^(?:https?:\/\/|mailto:|#|(?:\.?\.?\/)?[a-zA-Z0-9_-]+(?:\/|\.))/i.test(url)||/^(?:javascript|data|vbscript):/i.test(url))return match;
    return `<a href="${url}" rel="noopener noreferrer">${label}</a>`;
  });
  return s;
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}/.test(line) && line.includes('|');
}

export function splitTable(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(x => x.trim().replace(/\\\|/g,'|'));
}

export function renderMarkdown(markdown, {inline=renderInline,reportTables=false}={}) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let i = 0;
  let inList = false;
  let inQuote = false;

  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const closeQuote = () => { if (inQuote) { out.push('</blockquote>'); inQuote = false; } };

  while (i < lines.length) {
    const raw = lines[i];
    const n = i + 1;
    const line = raw.trimEnd();

    if (/^\s*<!--.*-->\s*$/.test(line)) { i++; continue; }
    if (/^\s*(```|~~~)/.test(line)) {
      closeList();closeQuote();const fence=line.trim().slice(0,3),code=[];i++;
      while(i<lines.length&&!lines[i].trim().startsWith(fence))code.push(lines[i++]);
      i++;out.push(`<pre data-line="${n}" data-end-line="${i}"><code>${esc(code.join('\n'))}</code></pre>`);continue;
    }
    if (!line.trim()) {
      closeList(); closeQuote(); i++; continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      closeList(); closeQuote();
      const level = h[1].length;
      out.push(`<h${level} data-line="${n}">${inline(h[2])}</h${level}>`);
      i++; continue;
    }

    if (line.startsWith('>')) {
      closeList();
      if (!inQuote) { out.push('<blockquote>'); inQuote = true; }
      out.push(`<p data-line="${n}">${inline(line.replace(/^>\s?/, ''))}</p>`);
      i++; continue;
    }
    closeQuote();

    if (line.includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      closeList();
      const headers = splitTable(line),rows=[];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitTable(lines[i]));i++;
      }
      out.push(renderTable(headers,rows,{inline,reportTables,line:n}));
      continue;
    }

    const li = /^(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      closeQuote();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li data-line="${n}">${inline(li[1])}</li>`);
      i++; continue;
    }

    closeList();
    const paragraph=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!/^\s*(?:#{1,6} |>|[-*+] |\d+\. |```|~~~|<!--)/.test(lines[i])&&!(lines[i].includes('|')&&isTableDivider(lines[i+1]||'')))paragraph.push(lines[i++]);
    out.push(`<p data-line="${n}" data-end-line="${i}">${inline(paragraph.join('\n')).replace(/ {2}\n/g,'<br>')}</p>`);
  }
  closeList(); closeQuote();
  return '<div class="markdown-content">'+out.join('\n')+'</div>';
}

export function renderMarkdownDocument(title, markdown, extraCss='') {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
  body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:980px;margin:0 auto;padding:40px 28px;color:#0b1a22;line-height:1.55;background:#fff}
  h1{font-size:2rem;margin:.2rem 0 1.2rem} h2{font-size:1.35rem;margin-top:2.2rem;border-bottom:1px solid #dce1d9;padding-bottom:.35rem} h3{margin-top:1.8rem}
  blockquote{margin:1rem 0;padding:.75rem 1rem;border-left:4px solid #4a7300;background:#eef1eb;color:#3d5054}
  blockquote p{margin:.15rem 0} table{border-collapse:collapse;width:100%;margin:1rem 0 1.4rem;font-size:.95rem} th,td{border:1px solid #dce1d9;padding:.55rem .65rem;text-align:left} th{background:#eef1eb} code{background:#eef1eb;padding:.1rem .28rem;border-radius:4px} strong{color:#0b1a22}${extraCss}
  </style></head><body>${renderMarkdown(markdown)}</body></html>`;
}

export const isRating=value=>/^(?:critical|high|medium|moderate|low|n\/a|not assessed|not assessable|unknown|alto|alta|medio|media|bajo|baja|basso|bassa|ridicat|ridicată|mediu|medie|scăzut|scăzută|hohe?|mittel|niedrig|élevé|élevée|moyen|moyenne|faible|hoog|gemiddeld|laag|высокий|средний|низкий|високий|середній|низький|wysoki|średni|niski|vysoká|střední|nízká|vysoké|střední|nízké|magas|közepes|alacsony|hög|medel|låg|yüksek|orta|düşük|υψηλή|μέτρια|χαμηλή|alt|mitjà|baix|висок|средњи|низак|baixo|médio)$/iu.test(value.replace(/\[\^[^\]]+\]/g,'').replace(/[*_.]/g,'').trim());
export function ratingColumns(headers,rows){
 return headers.map((h,index)=>index>0&&h.length<45&&rows.length>0&&rows.every(row=>isRating(row[index]||''))?index:-1).filter(i=>i>=0).slice(0,3);
}
function renderTable(headers,rows,{inline,reportTables,line}){
 const ratings=reportTables?ratingColumns(headers,rows):[],textColumns=headers.map((_,i)=>i).filter(i=>!ratings.includes(i));
 const fold=reportTables&&textColumns.length>2;
 const head=fold?[headers[0],'Details',...ratings.map(i=>headers[i])]:headers;
 const outputRows=rows.map(row=>fold?[inline(row[0]||''),textColumns.filter(i=>i!==0).map(i=>`<div class="table-detail"><strong>${inline(headers[i])}</strong><div>${inline(row[i]||'')}</div></div>`).join(''),...ratings.map(i=>inline(row[i]||''))]:headers.map((_,i)=>inline(row[i]||'')));
 const compact=fold?head.map((_,i)=>i>=2):head.map((_,i)=>ratings.includes(i));
 return `<div class="markdown-table"><table data-line="${line}"${reportTables?' class="report-table"':''}><thead><tr>${head.map((h,i)=>`<th scope="col"${compact[i]?' class="rating-column"':''}>${inline(h)}</th>`).join('')}</tr></thead><tbody>${outputRows.map((row,index)=>`<tr data-line="${line+2+index}">${row.map((c,i)=>`<td${compact[i]?' class="rating-column"':''}>${compact[i]?`<span class="rating-value">${c}</span>`:c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export class MarkdownView{
 constructor(element){this.element=element;this.element.classList.add('markdown-view');}
 render(markdown){this.element.innerHTML=renderMarkdown(markdown);}
}
