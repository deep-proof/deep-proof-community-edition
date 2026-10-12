// Light / dark theme, shared with deepproof.ch. Loaded as a classic script in <head> so the theme applies before first paint.
(()=>{
 const root=document.documentElement,label=key=>window.DP_T?.(key)||{theme_to_dark:'Switch to Dark Theme',theme_to_light:'Switch to Light Theme'}[key];
 let theme='light';try{if(localStorage.getItem('theme')==='dark')theme='dark';}catch{}
 function apply(next){theme=next;root.dataset.theme=next;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',next==='dark'?'#07151d':'#f7f8f3');const toggle=document.getElementById('themeToggle');if(toggle){toggle.setAttribute('aria-label',label(next==='dark'?'theme_to_light':'theme_to_dark'));toggle.title=toggle.getAttribute('aria-label');}}
 apply(theme);
 // Re-reads the label after a UI language change.
 window.DP_THEME={refresh:()=>apply(theme)};
 document.addEventListener('DOMContentLoaded',()=>{apply(theme);document.getElementById('themeToggle')?.addEventListener('click',()=>{apply(theme==='dark'?'light':'dark');try{localStorage.setItem('theme',theme);}catch{}});});
})();
