import {id,transaction} from './store.mjs';
const invalid=message=>{throw Object.assign(Error(message),{status:400});};
export function migrateAccess(db){
 const initialized=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='access_levels'").get();
 db.exec(`CREATE TABLE IF NOT EXISTS access_levels(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,is_default INTEGER NOT NULL DEFAULT 0,grants_all INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS user_access_levels(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,level_id TEXT REFERENCES access_levels(id) ON DELETE CASCADE,is_primary INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,level_id));
 CREATE TABLE IF NOT EXISTS project_access_levels(project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,level_id TEXT REFERENCES access_levels(id) ON DELETE CASCADE,PRIMARY KEY(project_id,level_id));
 CREATE TABLE IF NOT EXISTS project_access_users(project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(project_id,user_id));`);
 if(!db.prepare('PRAGMA table_info(access_levels)').all().some(c=>c.name==='grants_all'))db.exec('ALTER TABLE access_levels ADD COLUMN grants_all INTEGER NOT NULL DEFAULT 0');
 if(!initialized)transaction(db,()=>{
  for(const [name,defaultLevel,globalAccess] of [['High Confidential',0,1],['Normal',0,0],['Everyone',1,0]])db.prepare('INSERT INTO access_levels VALUES(?,?,?,?)').run(id(),name,defaultLevel,globalAccess);
  const everyone=db.prepare('SELECT id FROM access_levels WHERE is_default=1').get().id;
  db.prepare('INSERT INTO user_access_levels SELECT id,?,1 FROM users').run(everyone);
  // Preserve the exact current audience of existing dossiers, never broaden it to Everyone.
  db.exec(`INSERT OR IGNORE INTO project_access_users SELECT id,owner_id FROM projects WHERE owner_id IS NOT NULL;
   INSERT OR IGNORE INTO project_access_users SELECT p.id,g.user_id FROM projects p JOIN grants g ON g.type_id=p.type_id WHERE p.owner_id IS NULL;
   UPDATE projects SET type_id=NULL;`);
 });
}
export const accessLevels=db=>db.prepare('SELECT id,name,is_default,grants_all FROM access_levels ORDER BY name').all();
export function userAccess(db,uid){const rows=db.prepare('SELECT level_id,is_primary FROM user_access_levels WHERE user_id=? ORDER BY level_id').all(uid);return {accessLevelIds:rows.map(r=>r.level_id),primaryAccessLevelId:rows.find(r=>r.is_primary)?.level_id||null};}
export function canAccessProject(db,user,project){
 return user.role==='admin'||!!db.prepare('SELECT 1 FROM user_access_levels u JOIN access_levels l ON l.id=u.level_id WHERE u.user_id=? AND l.grants_all=1').get(user.id)||project.owner_id===user.id||!!db.prepare('SELECT 1 FROM project_access_users WHERE project_id=? AND user_id=?').get(project.id,user.id)||!!db.prepare('SELECT 1 FROM project_access_levels p JOIN user_access_levels u ON u.level_id=p.level_id WHERE p.project_id=? AND u.user_id=?').get(project.id,user.id);
}
function ids(db,values,table,label){if(!Array.isArray(values)||values.length>1000||values.some(v=>typeof v!=='string'||!db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(v)))invalid(`Choose existing ${label}.`);return [...new Set(values)];}
export function validateUserAccess(db,body,old){
 const defaults=accessLevels(db).filter(x=>x.is_default).map(x=>x.id);
 const accessLevelIds=ids(db,body.accessLevelIds??old?.accessLevelIds??defaults,'access_levels','Access Levels');
 const primaryAccessLevelId=body.primaryAccessLevelId===undefined?(old?.primaryAccessLevelId&&accessLevelIds.includes(old.primaryAccessLevelId)?old.primaryAccessLevelId:accessLevelIds[0]||null):body.primaryAccessLevelId||null;
 if(accessLevelIds.length&&!primaryAccessLevelId)invalid('Choose a Primary Access Level.');
 if(primaryAccessLevelId&&!accessLevelIds.includes(primaryAccessLevelId))invalid('The Primary Access Level must be assigned to the user.');
 return {accessLevelIds,primaryAccessLevelId};
}
export function saveUserAccess(db,uid,access){
 db.prepare('DELETE FROM user_access_levels WHERE user_id=?').run(uid);
 for(const level of access.accessLevelIds)db.prepare('INSERT INTO user_access_levels VALUES(?,?,?)').run(uid,level,level===access.primaryAccessLevelId?1:0);
}
export function projectAccess(db,pid){return {accessLevelIds:db.prepare('SELECT level_id FROM project_access_levels WHERE project_id=?').all(pid).map(r=>r.level_id),userIds:db.prepare('SELECT user_id FROM project_access_users WHERE project_id=?').all(pid).map(r=>r.user_id)};}
export function saveProjectAccess(db,pid,body){
 const levels=ids(db,body.accessLevelIds,'access_levels','Access Levels'),users=ids(db,body.userIds,'users','Users');
 transaction(db,()=>{db.prepare('DELETE FROM project_access_levels WHERE project_id=?').run(pid);db.prepare('DELETE FROM project_access_users WHERE project_id=?').run(pid);for(const level of levels)db.prepare('INSERT INTO project_access_levels VALUES(?,?)').run(pid,level);for(const uid of users)db.prepare('INSERT INTO project_access_users VALUES(?,?)').run(pid,uid);});
}
export function deleteAccessLevel(db,levelId){
 transaction(db,()=>{
  db.prepare('DELETE FROM access_levels WHERE id=?').run(levelId);
  for(const {user_id} of db.prepare('SELECT DISTINCT user_id FROM user_access_levels WHERE user_id NOT IN (SELECT user_id FROM user_access_levels WHERE is_primary=1)').all()){
   const first=db.prepare('SELECT level_id FROM user_access_levels WHERE user_id=? ORDER BY level_id LIMIT 1').get(user_id);
   db.prepare('UPDATE user_access_levels SET is_primary=1 WHERE user_id=? AND level_id=?').run(user_id,first.level_id);
  }
 });
}
