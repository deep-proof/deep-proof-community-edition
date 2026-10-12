import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import en from '../web/i18n/en.js';
import de from '../web/i18n/de.js';
import fr from '../web/i18n/fr.js';
import it from '../web/i18n/it.js';
import rm from '../web/i18n/rm.js';
import es from '../web/i18n/es.js';
import nl from '../web/i18n/nl.js';
import pl from '../web/i18n/pl.js';
import pt from '../web/i18n/pt.js';
import ro from '../web/i18n/ro.js';

const translations={de,fr,it,rm,es,nl,pl,pt,ro};
const placeholders=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();

test('every UI language has exactly the English keys',()=>{
 for(const [code,dictionary] of Object.entries(translations))assert.deepEqual(Object.keys(dictionary).sort(),Object.keys(en).sort(),code);
});

test('translations keep placeholders and are not empty',()=>{
 for(const [code,dictionary] of Object.entries(translations))for(const key of Object.keys(en)){
  assert.ok(typeof dictionary[key]==='string'&&dictionary[key].trim(),`${code}.${key} is empty`);
  assert.deepEqual(placeholders(dictionary[key]),placeholders(en[key]),`${code}.${key} placeholders`);
 }
});

test('Swiss German never uses ß',()=>{
 for(const [key,value] of Object.entries(de))assert.ok(!/[ßẞ]/.test(value),`de.${key}`);
});

test('Romanian uses comma-below ș and ț, never cedilla ş and ţ',()=>{
 for(const [key,value] of Object.entries(ro))assert.ok(!/[şţŞŢ]/.test(value),`ro.${key}`);
 assert.ok(Object.values(ro).some(value=>/[șțȘȚ]/.test(value)),'ro uses comma-below letters');
});

test('every key referenced by the UI exists in English',async()=>{
 const web=new URL('../web/',import.meta.url),used=new Set();
 for(const file of ['app.js','access.js','configuration.js','review-rules.js']){
  const source=await fs.readFile(new URL(file,web),'utf8');
  for(const match of source.matchAll(/\bt\(\s*'([a-z0-9_]+)'/g))used.add(match[1]);
  // Keys chosen by a ternary inside t(...).
  for(const match of source.matchAll(/\bt\(([^()]*\?[^()]*)\)/g))for(const key of match[1].matchAll(/'([a-z0-9_]+)'/g))if(key[1].includes('_'))used.add(key[1]);
 }
 const html=await fs.readFile(new URL('index.html',web),'utf8');
 for(const match of html.matchAll(/data-i18n="([^"]+)"/g))used.add(match[1]);
 for(const match of html.matchAll(/data-i18n-attr="([^"]+)"/g))for(const pair of match[1].split(';'))used.add(pair.split(':')[1]);
 for(const key of ['page_title','theme_to_dark','theme_to_light'])used.add(key);
 // Prefixes such as 'role_'+role are completed at runtime.
 const missing=[...used].filter(key=>!key.endsWith('_')&&!Object.hasOwn(en,key));
 for(const key of ['role_user','role_admin','status_running','status_completed','status_failed'])assert.ok(Object.hasOwn(en,key),key);
 assert.deepEqual(missing,[]);
});
