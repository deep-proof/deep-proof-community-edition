import {t} from './i18n.js';
export async function bindConfiguration(settings,{api,post,notice,isCurrent}){
 const form=document.querySelector('#settingsForm'),agent=form.elements.agent,model=form.elements.model,effort=form.elements.effort,save=form.querySelector('[type=submit]'),retry=document.querySelector('#reloadCatalog'),status=document.querySelector('#catalogStatus');
 const picker=form.querySelector('.model-picker'),button=picker.querySelector('#modelButton'),popup=picker.querySelector('#modelPopup'),search=picker.querySelector('#modelSearch'),list=picker.querySelector('#modelList');
 let catalog=[],agents=[],request=0,ready=false,saving=false,shown=[],highlighted=-1;
 const option=(select,value,label,{disabled=false,selected=false}={})=>{const item=document.createElement('option');item.value=value;item.textContent=label;item.disabled=disabled;item.selected=selected;select.append(item);};
 const active=()=>isCurrent()&&form.isConnected;
 const controls=()=>{save.disabled=!ready||saving||!agent.value||agent.selectedOptions[0]?.disabled||model.selectedOptions[0]?.disabled;sync();};
 // The native select holds the value; the picker is its searchable view, so the filter only appears while choosing.
 const sync=()=>{button.querySelector('.model-picker-value').textContent=model.selectedOptions[0]?.textContent||'';button.disabled=model.disabled;if(model.disabled)closePicker();};
 const renderList=()=>{
  const q=search.value.trim().toLowerCase();
  shown=[...model.options].filter(o=>!q||o.textContent.toLowerCase().includes(q)||o.value.toLowerCase().includes(q));
  list.replaceChildren();
  shown.forEach((o,i)=>{const item=document.createElement('li');item.id='modelOption'+i;item.setAttribute('role','option');item.setAttribute('aria-selected',String(o.selected));if(o.disabled)item.setAttribute('aria-disabled','true');item.textContent=o.textContent;item.dataset.index=i;list.append(item);});
  if(!shown.length){const none=document.createElement('li');none.className='model-picker-empty';none.setAttribute('role','presentation');none.textContent=t('no_matching_models');list.append(none);}
  highlight(Math.max(0,shown.findIndex(o=>o.selected)));
 };
 const highlight=index=>{
  highlighted=shown.length?Math.min(Math.max(index,0),shown.length-1):-1;
  for(const item of list.querySelectorAll('[role=option]'))item.classList.toggle('active',Number(item.dataset.index)===highlighted);
  if(highlighted<0)search.removeAttribute('aria-activedescendant');else{search.setAttribute('aria-activedescendant','modelOption'+highlighted);list.querySelector('#modelOption'+highlighted)?.scrollIntoView({block:'nearest'});}
 };
 function openPicker(){if(button.disabled||!popup.hidden)return;popup.hidden=false;button.setAttribute('aria-expanded','true');search.value='';renderList();search.focus();}
 function closePicker(returnFocus=false){if(popup.hidden)return;popup.hidden=true;button.setAttribute('aria-expanded','false');if(returnFocus)button.focus();}
 const choose=index=>{const o=shown[index];if(!o||o.disabled)return;model.value=o.value;renderEfforts(savedEffort());controls();closePicker(true);};
 button.onclick=()=>popup.hidden?openPicker():closePicker(true);
 button.onkeydown=event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();openPicker();}};
 search.oninput=renderList;
 search.onkeydown=event=>{
  if(event.key==='ArrowDown'){event.preventDefault();highlight(highlighted+1);}
  else if(event.key==='ArrowUp'){event.preventDefault();highlight(highlighted-1);}
  else if(event.key==='Home'){event.preventDefault();highlight(0);}
  else if(event.key==='End'){event.preventDefault();highlight(shown.length-1);}
  else if(event.key==='Enter'){event.preventDefault();choose(highlighted);}
  else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closePicker(true);}
  else if(event.key==='Tab')closePicker();
 };
 list.onmousedown=event=>event.preventDefault();
 list.onclick=event=>{const item=event.target.closest('[role=option]');if(item)choose(Number(item.dataset.index));};
 list.onmousemove=event=>{const item=event.target.closest('[role=option]');if(item&&Number(item.dataset.index)!==highlighted)highlight(Number(item.dataset.index));};
 const outside=event=>{if(!form.isConnected){document.removeEventListener('pointerdown',outside);return;}if(!picker.contains(event.target))closePicker();};
 document.addEventListener('pointerdown',outside);
 const renderEfforts=(keep=effort.value)=>{
  const levels=catalog.find(m=>m.id===model.value)?.efforts||[];effort.replaceChildren();option(effort,'',t(levels.length?'effort_default':'effort_unsupported'));
  for(const level of levels)option(effort,level,level);effort.value=levels.includes(keep)?keep:'';effort.disabled=!ready||!levels.length;
 };
 const savedEffort=()=>agent.value===settings.agent&&model.value===settings.model?settings.effort||'':'';
 const renderModels=()=>{model.replaceChildren();option(model,'',t('agent_default'));for(const entry of catalog)option(model,entry.id,entry.label===entry.id?entry.id:`${entry.label} (${entry.id})`);};
 async function loadModels(preferred='',refresh=false){
  const version=++request;ready=false;model.disabled=true;effort.disabled=true;model.replaceChildren();option(model,'',t('loading_models'));controls();status.textContent=t('loading_models_status');
  try{
   const result=await api('/admin/coding-agents/'+encodeURIComponent(agent.value)+'/models'+(refresh?'?refresh=1':''));if(!active()||version!==request)return;
   catalog=result.models;renderModels();
   if(preferred&&!result.models.some(m=>m.id===preferred)){option(model,preferred,t('name_unavailable',{name:preferred}),{disabled:true,selected:true});status.textContent=t('saved_model_unavailable');}
   else{model.value=preferred;status.textContent=t(result.models.length?'models_loaded':'no_named_models');}
   model.disabled=false;ready=true;renderEfforts(savedEffort());controls();
  }catch(error){if(!active()||version!==request)return;model.replaceChildren();option(model,'',t('models_unavailable'));status.textContent=error.message;controls();}
 }
 async function loadAgents(refresh=false){
  const selected=agent.value||settings.agent,selectedModel=ready?model.value:settings.model;
  ++request;ready=false;retry.disabled=true;agent.disabled=true;model.disabled=true;controls();status.textContent=t('detecting_agents');
  try{
   const result=await api('/admin/coding-agents'+(refresh?'?refresh=1':''));if(!active())return;agents=result.agents;agent.replaceChildren();
   for(const entry of agents)option(agent,entry.id,entry.available?entry.label:t('name_not_installed',{name:entry.label}),{disabled:!entry.available});
   if(selected&&!agents.some(a=>a.id===selected&&a.available)){if(!agents.some(a=>a.id===selected))option(agent,selected,t('name_unavailable',{name:selected}),{disabled:true});agent.value=selected;model.replaceChildren();option(model,'',t('choose_installed_agent'));status.textContent=t('saved_agent_unavailable');}
   else{agent.value=selected||agents.find(a=>a.available)?.id||'';if(agent.value)await loadModels(selectedModel||'',refresh);else{status.textContent=t('no_agents_installed');model.replaceChildren();option(model,'',t('no_models_available'));}}
   agent.disabled=!agents.some(a=>a.available);
  }catch(error){if(active())status.textContent=error.message;}
  finally{if(active()){retry.disabled=false;controls();}}
 }
 agent.onchange=()=>loadModels(agent.value===settings.agent?settings.model:'');model.onchange=()=>{renderEfforts(savedEffort());controls();};retry.onclick=()=>loadAgents(true);
 form.onsubmit=async event=>{event.preventDefault();controls();if(save.disabled)return;saving=true;agent.disabled=true;model.disabled=true;effort.disabled=true;retry.disabled=true;controls();try{await api('/admin/settings',post({agent:agent.value,model:model.value,effort:effort.value}));if(!active())return;settings={...settings,agent:agent.value,model:model.value,effort:effort.value};notice(t('agent_model_saved'));status.textContent=t('agent_model_saved_status');}catch(error){if(active())status.textContent=error.message;}finally{if(active()){saving=false;agent.disabled=false;model.disabled=false;retry.disabled=false;renderEfforts();controls();}}};
 const toggle=document.querySelector('#consoleToggle'),toggleError=document.querySelector('#consoleStatus');
 toggle.checked=settings.console===true;
 toggle.onchange=async()=>{const wanted=toggle.checked;toggle.disabled=true;toggleError.hidden=true;try{await api('/admin/console',post({enabled:wanted}));if(!active())return;settings={...settings,console:wanted};notice(t(wanted?'console_enabled':'console_disabled'));}catch(error){if(active()){toggle.checked=!wanted;toggleError.textContent=error.message;toggleError.hidden=false;}}finally{if(active())toggle.disabled=false;}};
 const limit=document.querySelector('#analysisLimit'),limitError=document.querySelector('#analysisLimitStatus');
 limit.value=String(settings.analysisLimit||60);
 limit.onchange=async()=>{const wanted=Number(limit.value),previous=settings.analysisLimit||60;limit.disabled=true;limitError.hidden=true;try{await api('/admin/analysis-limit',post({minutes:wanted}));if(!active())return;settings={...settings,analysisLimit:wanted};notice(t('analysis_limit_saved'));}catch(error){if(active()){limit.value=String(previous);limitError.textContent=error.message;limitError.hidden=false;}}finally{if(active())limit.disabled=false;}};
 await loadAgents();
}
export async function bindALA({api,post,notice,esc,isCurrent,refresh}){
 const form=document.querySelector('#alaForm'),state=document.querySelector('#alaState'),details=document.querySelector('#alaDetails'),error=document.querySelector('#alaStatus'),auto=document.querySelector('#alaAuto');
 const active=()=>isCurrent()&&form.isConnected;
 const show=status=>{
  state.textContent=t(status.found?'ala_connected':'ala_not_found');state.className='status-pill '+(status.found?'ok':'missing');
  const rows=status.found?[[t('ala_entrypoint'),`<code>${esc(status.entry)}</code>`],[t('ala_source'),esc((['environment','configured','parent','application','path'].includes(status.source)?t('ala_source_'+status.source):status.source))],[t('ala_dependencies'),status.dependencies?t('ala_installed'):`<span class="danger-text">${t('ala_dependencies_missing')}</span>`]]
   :[[t('ala_checked'),status.checked.map(c=>`<code>${esc(c.location)}</code> <small>${esc(c.reason||'')}</small>`).join('<br>')||'—'],[t('ala_next_step'),t('ala_next_step_text')]];
  details.innerHTML=rows.map(([term,value])=>`<div><dt>${term}</dt><dd>${value}</dd></div>`).join('');
  form.elements.path.value=status.configured||'';auto.disabled=!status.configured;
 };
 const save=async value=>{error.hidden=true;for(const control of form.elements)control.disabled=true;
  try{const status=await api('/admin/ala',post({path:value}));if(!active())return;show(status);notice(t(status.found?'ala_saved':'ala_auto_not_found'));await refresh();}
  catch(e){if(active()){error.textContent=e.message;error.hidden=false;}}
  finally{if(active())for(const control of form.elements)control.disabled=false;}};
 form.onsubmit=event=>{event.preventDefault();save(form.elements.path.value.trim());};
 auto.onclick=()=>save(null);
 try{const status=await api('/admin/ala');if(active())show(status);}catch(e){if(active()){state.textContent=t('unavailable');error.textContent=e.message;error.hidden=false;}}
}
