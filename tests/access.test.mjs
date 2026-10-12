import {seededStore,seedTestData} from './support/seed.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../server.mjs';
import {openStore,id,hashPassword} from '../src/store.mjs';
import {migrateAccess,canAccessProject,accessLevels} from '../src/access.mjs';
test('Access Levels, primary defaults, explicit sharing, global High Confidential and deletion persist',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'analyst-access-'));let {server,db}=(await seededStore(dir),createApp)({dir});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();await fs.rm(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const call=async(url,body,cookie='',method)=>{const r=await fetch(base+url,{method:method||(body?'POST':'GET'),headers:{'content-type':'application/json',cookie},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 const ac=(await call('/login',{username:'admin',password:'admin'})).cookie;
 const levels=(await call('/admin/access-levels',null,ac)).data,level=name=>levels.find(l=>l.name===name).id;
 const everyone=level('Everyone'),normal=level('Normal'),high=level('High Confidential');
 async function user(name,access){const body={username:name,password:'password123',role:'user',active:true,typeIds:['investment'],...access};const r=await call('/admin/users',body,ac);assert.equal(r.status,200);return {id:r.data.id,body,cookie:(await call('/login',{username:name,password:'password123'})).cookie};}
 const owner=await user('owner'),peer=await user('peer'),restricted=await user('normal',{accessLevelIds:[normal],primaryAccessLevelId:normal}),global=await user('global',{accessLevelIds:[high],primaryAccessLevelId:high});
 assert.deepEqual((await call('/me',null,owner.cookie)).data.accessLevelIds,[everyone]);
 const project=(await call('/projects',{company:'Private dossier'},owner.cookie)).data.id;
 const doc=(await call(`/projects/${project}/documents`,{title:'Evidence',markdown:'# Evidence\nRecorded content.'},owner.cookie)).data.id;
 assert.deepEqual((await call(`/projects/${project}/access`,null,owner.cookie)).data.accessLevelIds,[everyone]);
 assert.equal((await call(`/projects/${project}/documents`,null,peer.cookie)).status,200);
 assert.equal((await call(`/projects/${project}/documents`,null,restricted.cookie)).status,403);
 assert.equal((await call(`/projects/${project}/documents`,null,global.cookie)).status,200);
 assert.equal((await call(`/projects/${project}/access`,{accessLevelIds:[everyone],userIds:[]},peer.cookie)).status,403);
 assert.equal((await call('/admin/access-levels',{name:'Escalate'},owner.cookie)).status,403);
 assert.equal((await call(`/projects/${project}/access`,{accessLevelIds:['missing'],userIds:[]},owner.cookie)).status,400);
 assert.equal((await call(`/projects/${project}/access`,{accessLevelIds:[normal],userIds:[]},owner.cookie)).status,200);
 assert.equal((await call(`/projects/${project}/documents/${doc}`,null,peer.cookie)).status,403);
 assert.equal((await call(`/projects/${project}/documents`,null,restricted.cookie)).status,200);
 assert.equal((await call(`/projects/${project}/documents`,null,global.cookie)).status,200);
 assert.equal((await call(`/projects/${project}/access`,{accessLevelIds:[],userIds:[peer.id]},owner.cookie)).status,200);
 assert.equal((await call(`/projects/${project}/documents`,null,peer.cookie)).status,200);
 assert.equal((await call(`/projects/${project}/documents`,null,restricted.cookie)).status,403);
 assert.equal((await call(`/projects/${project}/documents`,null,owner.cookie)).status,200);
 assert.equal((await call(`/projects/${project}/documents`,null,ac)).status,200);
 assert.equal((await call('/admin/access-levels/'+high,{},ac,'DELETE')).status,200);
 assert.equal((await call(`/projects/${project}/documents`,null,global.cookie)).status,403);
 assert.deepEqual((await call('/me',null,global.cookie)).data.accessLevelIds,[]);
 assert.equal((await call('/admin/access-levels/'+everyone,{},ac,'DELETE')).status,200);
 const newcomer=await user('newcomer');assert.deepEqual((await call('/me',null,newcomer.cookie)).data.accessLevelIds,[]);
 const isolated=(await call('/projects',{company:'No default level'},newcomer.cookie)).data.id;
 assert.deepEqual((await call(`/projects/${isolated}/access`,null,newcomer.cookie)).data.accessLevelIds,[]);
 assert.equal((await call(`/projects/${isolated}/documents`,null,peer.cookie)).status,403);
 const custom=(await call('/admin/access-levels',{name:'Legal Team'},ac)).data.id;
 assert.equal((await call('/admin/access-levels',{id:custom,name:'Legal'},ac)).status,200);
 assert.equal((await call('/admin/users',{...newcomer.body,id:newcomer.id,accessLevelIds:[normal,custom],primaryAccessLevelId:custom},ac)).status,200);
 newcomer.cookie=(await call('/login',{username:'newcomer',password:'password123'})).cookie;
 const shared=(await call('/projects',{company:'Legal dossier'},newcomer.cookie)).data.id;
 assert.deepEqual((await call(`/projects/${shared}/access`,null,newcomer.cookie)).data.accessLevelIds,[custom]);
 assert.equal((await call('/admin/users',{...newcomer.body,id:newcomer.id,accessLevelIds:[normal],primaryAccessLevelId:custom},ac)).status,400);
 assert.equal((await call('/admin/access-levels/'+custom,{},ac,'DELETE')).status,200);
 assert.equal((await call('/me',null,newcomer.cookie)).data.primaryAccessLevelId,normal);
 // Re-running migration never recreates deleted defaults or broadens access.
 migrateAccess(db);assert.deepEqual(accessLevels(db).map(l=>l.name),['Normal']);
 assert.equal(canAccessProject(db,db.prepare('SELECT * FROM users WHERE id=?').get(peer.id),db.prepare('SELECT * FROM projects WHERE id=?').get(project)),true);
});

test('migration preserves legacy project audiences and never recreates deleted levels on restart',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'analyst-access-migration-'));let db;
 try{
  db=openStore(dir);seedTestData(db);const uid=id();db.prepare('INSERT INTO users VALUES(?,?,?,?,1)').run(uid,'legacy-reviewer',hashPassword('password123'),'user');db.prepare('INSERT INTO grants VALUES(?,?)').run(uid,'investment');
  const old=db.prepare('SELECT * FROM projects WHERE id=?').get('nexora-software');migrateAccess(db);
  assert.equal(canAccessProject(db,db.prepare('SELECT * FROM users WHERE id=?').get(uid),old),true);
  assert.equal(db.prepare('SELECT count(*) AS n FROM project_access_levels').get().n,0);
  assert.equal(db.prepare('SELECT type_id FROM projects WHERE id=?').get(old.id).type_id,null);
  db.exec('DELETE FROM grants; DELETE FROM access_levels');db.close();db=openStore(dir);migrateAccess(db);
  assert.deepEqual(accessLevels(db),[]);assert.equal(canAccessProject(db,db.prepare('SELECT * FROM users WHERE id=?').get(uid),old),true);
 }finally{db?.close();await fs.rm(dir,{recursive:true,force:true});}
});
