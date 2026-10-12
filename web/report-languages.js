// European report languages; codes are persisted, never free-form prompt text.
export const reportLanguages=[
 ['en','English','English'],['ca','Catalan','Català'],['cs','Czech','Čeština'],['nl','Dutch','Nederlands'],
 ['fr','French','Français'],['de','German','Deutsch'],['el','Greek','Ελληνικά'],['hu','Hungarian','Magyar'],
 ['it','Italian','Italiano'],['pl','Polish','Polski'],['pt','Portuguese','Português'],['ro','Romanian','Română'],
 ['ru','Russian','Русский'],['sr','Serbian','Српски'],['es','Spanish','Español'],['sv','Swedish','Svenska'],
 ['tr','Turkish','Türkçe'],['uk','Ukrainian','Українська']
].map(([code,name,nativeName])=>({code,name,nativeName}));
export function reportLanguage(code='en'){
 const language=reportLanguages.find(l=>l.code===code);
 if(!language)throw Object.assign(Error('Choose a supported Report Language.'),{status:400});
 return language;
}
export function languageOptions(selected='en'){
 return reportLanguages.map(l=>`<option value="${l.code}" ${l.code===selected?'selected':''}>${l.name}${l.name===l.nativeName?'':' · '+l.nativeName}</option>`).join('');
}

// Historical runs stored the language inside the skill snapshot.
export const runReportLanguage=snapshot=>reportLanguage(snapshot?.report_language??snapshot?.type?.report_language??'en');
