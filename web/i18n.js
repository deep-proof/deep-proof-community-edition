// UI language for the browser chrome. Separate from the per-run Report Language (report-languages.js).
// Every key in ./i18n/en.js must exist in de, fr, it and rm (tests/i18n.test.mjs).
import en from './i18n/en.js';import de from './i18n/de.js';import fr from './i18n/fr.js';import it from './i18n/it.js';import rm from './i18n/rm.js';
export const dictionaries={en,de,fr,it,rm};
export const languages=[['en','English'],['de','Deutsch'],['fr','Français'],['it','Italiano'],['rm','Rumantsch']].map(([code,name])=>({code,name}));
const locales={en:'en-GB',de:'de-CH',fr:'fr-CH',it:'it-CH',rm:'rm-CH'};
let current='en';
export const lang=()=>current;
export const locale=()=>locales[current];
// t('key',{name:'x',n:2}): {var} placeholders are replaced verbatim; escape dynamic values before inserting HTML.
export function t(key,vars={}){
 const pick=k=>dictionaries[current][k]??en[k];
 let text=(vars.n===1?pick(key+'_one'):undefined)??pick(key)??key;
 return text.replace(/\{(\w+)\}/g,(m,name)=>Object.hasOwn(vars,name)?String(vars[name]):m);
}
const supported=code=>Object.hasOwn(dictionaries,code);
export function applyStatic(root=document){
 for(const el of root.querySelectorAll('[data-i18n]'))el.innerHTML=t(el.dataset.i18n);
 for(const el of root.querySelectorAll('[data-i18n-attr]'))for(const pair of el.dataset.i18nAttr.split(';')){const [attr,key]=pair.split(':');el.setAttribute(attr,t(key));}
 document.title=t('page_title');
}
export function setLang(code,{persist=true}={}){
 current=supported(code)?code:'en';document.documentElement.lang=current;
 if(persist)try{localStorage.setItem('lang',current);}catch{}
 applyStatic();const select=document.querySelector('#langSelect');if(select)select.value=current;
 window.DP_T=t;window.DP_LANG=lang;window.DP_THEME?.refresh?.();
 document.dispatchEvent(new CustomEvent('dp:lang',{detail:{lang:current}}));
}
export function initLang(onChange){
 let stored=null;try{stored=localStorage.getItem('lang');}catch{}
 const browser=(navigator.languages||[navigator.language]).map(l=>String(l||'').toLowerCase().split('-')[0]).find(supported);
 setLang(supported(stored)?stored:browser||'en',{persist:false});
 const select=document.querySelector('#langSelect');
 if(select)select.onchange=()=>{setLang(select.value);onChange?.(current);};
}
