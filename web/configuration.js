import {t} from './i18n.js';
export async function bindConfiguration(settings,{api,post,notice,isCurrent}){
 const form=document.querySelector('#settingsForm'),agent=form.elements.agent,model=form.elements.model,save=form.querySelector('[type=submit]'),retry=document.querySelector('#reloadCatalog'),status=document.querySelector('#catalogStatus');
 let agents=[],request=0,ready=false,saving=false;
 const option=(select,value,label,{disabled=false,selected=false}={})=>{const item=document.createElement('option');item.value=value;item.textContent=label;item.disabled=disabled;item.selected=selected;select.append(item);};
 const active=()=>isCurrent()&&form.isConnected;
 const controls=()=>{save.disabled=!ready||saving||!agent.value||agent.selectedOptions[0]?.disabled||model.selectedOptions[0]?.disabled;};
 async function loadModels(preferred='',refresh=false){
  const version=++request;ready=false;controls();model.disabled=true;model.replaceChildren();option(model,'',t('loading_models'));status.textContent=t('loading_models_status');
  try{
   const result=await api('/admin/coding-agents/'+encodeURIComponent(agent.value)+'/models'+(refresh?'?refresh=1':''));if(!active()||version!==request)return;
   model.replaceChildren();option(model,'',t('agent_default'));for(const entry of result.models)option(model,entry.id,entry.label===entry.id?entry.id:`${entry.label} (${entry.id})`);
   if(preferred&&!result.models.some(m=>m.id===preferred)){option(model,preferred,t('name_unavailable',{name:preferred}),{disabled:true,selected:true});status.textContent=t('saved_model_unavailable');}
   else{model.value=preferred;status.textContent=t(result.models.length?'models_loaded':'no_named_models');}
   model.disabled=false;ready=true;controls();
  }catch(error){if(!active()||version!==request)return;model.replaceChildren();option(model,'',t('models_unavailable'));status.textContent=error.message;controls();}
 }
 async function loadAgents(refresh=false){
  const selected=agent.value||settings.agent,selectedModel=ready?model.value:settings.model;
  ++request;ready=false;controls();retry.disabled=true;agent.disabled=true;model.disabled=true;status.textContent=t('detecting_agents');
  try{
   const result=await api('/admin/coding-agents'+(refresh?'?refresh=1':''));if(!active())return;agents=result.agents;agent.replaceChildren();
   for(const entry of agents)option(agent,entry.id,entry.available?entry.label:t('name_not_installed',{name:entry.label}),{disabled:!entry.available});
   if(selected&&!agents.some(a=>a.id===selected&&a.available)){if(!agents.some(a=>a.id===selected))option(agent,selected,t('name_unavailable',{name:selected}),{disabled:true});agent.value=selected;model.replaceChildren();option(model,'',t('choose_installed_agent'));status.textContent=t('saved_agent_unavailable');}
   else{agent.value=selected||agents.find(a=>a.available)?.id||'';if(agent.value)await loadModels(selectedModel||'',refresh);else{status.textContent=t('no_agents_installed');model.replaceChildren();option(model,'',t('no_models_available'));}}
   agent.disabled=!agents.some(a=>a.available);
  }catch(error){if(active())status.textContent=error.message;}
  finally{if(active()){retry.disabled=false;controls();}}
 }
 agent.onchange=()=>loadModels(agent.value===settings.agent?settings.model:'');model.onchange=controls;retry.onclick=()=>loadAgents(true);
 form.onsubmit=async event=>{event.preventDefault();controls();if(save.disabled)return;saving=true;controls();agent.disabled=true;model.disabled=true;retry.disabled=true;try{await api('/admin/settings',post({agent:agent.value,model:model.value}));if(!active())return;settings={agent:agent.value,model:model.value};notice(t('agent_model_saved'));status.textContent=t('agent_model_saved_status');}catch(error){if(active())status.textContent=error.message;}finally{if(active()){saving=false;agent.disabled=false;model.disabled=false;retry.disabled=false;controls();}}};
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
