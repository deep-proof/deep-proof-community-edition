import {t} from './i18n.js';
// "Use With Caution" is explained wherever it appears: every marker carries data-caution and opens this dialog.
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const cautionBadge=()=>`<span class="trust-badge demo caution-link" role="button" tabindex="0" data-caution title="${esc(t('caution_hint'))}">${t('badge_demo')}</span>`;
let dialog;
export function showCaution(){
 dialog?.remove();
 dialog=document.createElement('dialog');dialog.className='caution-dialog';dialog.setAttribute('aria-labelledby','cautionTitle');
 dialog.innerHTML=`<button type="button" class="icon-button close-modal" aria-label="${esc(t('close'))}">×</button><span class="trust-badge demo">${t('badge_demo')}</span><h2 id="cautionTitle">${t('caution_lead')}</h2><p>${t('caution_p1')}</p><p>${t('caution_p2')}</p><p>${t('caution_p3')}</p><p class="muted">${t('caution_p4')}</p><div class="dialog-actions"><a class="text-link" href="#docs">${t('caution_docs')}</a><button type="button" class="button" data-close>${t('close')}</button></div>`;
 document.body.append(dialog);
 const close=()=>{dialog.close();dialog.remove();};
 dialog.querySelector('.close-modal').onclick=close;dialog.querySelector('[data-close]').onclick=close;
 dialog.querySelector('.text-link').onclick=()=>{close();document.querySelector('#dialog')?.open&&document.querySelector('#dialog').close();};
 dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
 dialog.addEventListener('close',()=>dialog.remove());
 dialog.showModal();dialog.querySelector('[data-close]').focus();
}
// Capture phase, so a marker inside a clickable row explains itself instead of triggering the row.
export function bindCaution(){
 document.addEventListener('click',event=>{const marker=event.target.closest?.('[data-caution]');if(!marker)return;event.preventDefault();event.stopPropagation();showCaution();},true);
 document.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const marker=event.target.closest?.('[data-caution]');if(!marker||marker.tagName==='BUTTON')return;event.preventDefault();event.stopPropagation();showCaution();},true);
}
