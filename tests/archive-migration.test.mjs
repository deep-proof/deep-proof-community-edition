import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openStore} from '../src/store.mjs';
test('archive migration preserves old projects and persists archive state across restarts',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'analyst-migration-'));
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');let db;
 try{
  db=new DatabaseSync(path.join(dir,'analyst.sqlite'));
  db.exec("CREATE TABLE projects(id TEXT PRIMARY KEY,company TEXT,sector TEXT,type_id TEXT); INSERT INTO projects VALUES('legacy','Existing project','Software','investment')");db.close();
  db=openStore(dir);assert.equal(db.prepare('SELECT archived_at FROM projects WHERE id=?').get('legacy').archived_at,null);
  db.prepare('UPDATE projects SET archived_at=? WHERE id=?').run('2026-10-07T12:00:00.000Z','legacy');db.close();
  db=openStore(dir);const row=db.prepare('SELECT * FROM projects WHERE id=?').get('legacy');assert.equal(row.company,'Existing project');assert.equal(row.archived_at,'2026-10-07T12:00:00.000Z');
 }finally{db?.close();await rm(dir,{recursive:true,force:true});}
});
