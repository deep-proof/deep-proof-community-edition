import {t} from './i18n.js';
export function userAccessFields(user,levels,esc){
 return `<fieldset><legend>${t('access_levels')}</legend><p class="muted">${t('user_access_help')}</p>${levels.map(level=>`<label class="check"><input name="accessLevelIds" type="checkbox" value="${esc(level.id)}" ${user.accessLevelIds.includes(level.id)?'checked':''}>${esc(level.name)}</label>`).join('')||`<p>${t('no_access_levels_user')}</p>`}<label>${t('primary_access_level')}<select name="primaryAccessLevelId"></select></label><p class="muted">${t('primary_access_help')}</p></fieldset>`;
}
export function bindUserAccess(form,user,levels){
 const select=form.elements.primaryAccessLevelId;
 const update=()=>{const current=select.value||user.primaryAccessLevelId,ids=new FormData(form).getAll('accessLevelIds');select.replaceChildren();for(const level of levels.filter(l=>ids.includes(l.id))){const option=document.createElement('option');option.value=level.id;option.textContent=level.name;select.append(option);}if(!ids.length){const option=document.createElement('option');option.value='';option.textContent=t('none');select.append(option);}if(ids.includes(current))select.value=current;};
 form.querySelectorAll('[name=accessLevelIds]').forEach(box=>box.onchange=update);update();
}
export async function editProjectAccess(project,ctx){
 try{
  const data=await ctx.api(`/projects/${project.id}/access`);
  ctx.modal(`<h2>${t('project_access')}</h2><p>${ctx.esc(project.company)}</p><p class="muted">${t('project_access_help')}</p><form><fieldset><legend>${t('access_levels')}</legend>${data.levels.map(l=>`<label class="check"><input type="checkbox" name="accessLevelIds" value="${ctx.esc(l.id)}" ${data.accessLevelIds.includes(l.id)?'checked':''}>${ctx.esc(l.name)}${l.grants_all?' · '+t('all_projects'):''}</label>`).join('')||`<p>${t('no_access_levels_defined')}</p>`}</fieldset><fieldset><legend>${t('individual_users')}</legend><label>${t('find_users')}<input id="shareUserSearch" type="search" placeholder="${ctx.esc(t('search_by_username'))}"></label><div class="access-user-list">${data.users.map(u=>`<label class="check" data-share-user="${ctx.esc(u.username.toLocaleLowerCase())}"><input type="checkbox" name="userIds" value="${ctx.esc(u.id)}" ${data.userIds.includes(u.id)||u.id===data.ownerId?'checked':''} ${u.id===data.ownerId?'disabled':''}>${ctx.esc(u.username)}${u.id===data.ownerId?' · '+t('owner'):''}${!u.active?' · '+t('disabled'):''}</label>`).join('')}</div></fieldset><button type="submit" class="button">${t('save_project_access')}</button></form>`,async(_b,form)=>{
   const values=new FormData(form);await ctx.api(`/projects/${project.id}/access`,ctx.post({accessLevelIds:values.getAll('accessLevelIds'),userIds:values.getAll('userIds')}));document.querySelector('#dialog').close();ctx.notice(t('project_access_saved'));
  });
  document.querySelector('#shareUserSearch').oninput=event=>{const query=event.target.value.toLocaleLowerCase().trim();document.querySelectorAll('[data-share-user]').forEach(row=>row.hidden=!row.dataset.shareUser.includes(query));};
 }catch(error){ctx.notice(error.message);}
}
export function bindAccessLevelAdmin(levels,ctx){
 const edit=(level={})=>{
  ctx.modal(`<h2>${t(level.id?'edit_access_level':'add_access_level')}</h2><form><label>${t('access_level_name')}<input name="name" required maxlength="80" value="${ctx.esc(level.name||'')}"></label><button type="submit" class="button">${t('save_access_level')}</button>${level.id?`<button type="button" id="deleteAccessLevel" class="button secondary danger">${t('delete_access_level')}</button>`:''}</form>`,async b=>{await ctx.api('/admin/access-levels',ctx.post({...b,id:level.id}));await ctx.refreshAdmin();});
  if(level.id)document.querySelector('#deleteAccessLevel').onclick=()=>ctx.modal(`<h2>${t('delete_title',{name:ctx.esc(level.name)})}</h2><p>${[t('delete_access_level_text'),level.grants_all&&t('delete_access_level_all'),level.is_default&&t('delete_access_level_default')].filter(Boolean).join(' ')}</p><form><button type="submit" id="confirmDeleteAccessLevel" class="button danger-solid">${t('delete_access_level')}</button></form>`,async()=>{await ctx.api('/admin/access-levels/'+level.id,{...ctx.post({}),method:'DELETE'});await ctx.refreshAdmin();});
 };
 document.querySelector('#addAccessLevel').onclick=()=>edit();document.querySelectorAll('[data-access-level]').forEach(button=>button.onclick=()=>edit(levels.find(l=>l.id===button.dataset.accessLevel)));
}
