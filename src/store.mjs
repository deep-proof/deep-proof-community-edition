import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
export const id = () => randomUUID();
export function hashPassword(password) { const salt=randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password,salt,64).toString('hex')}`; }
export function verifyPassword(password,hash) { const [salt,key]=hash.split(':'); return timingSafeEqual(Buffer.from(key,'hex'),scryptSync(password,salt,64)); }
export function openStore(dir) {
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const db=new DatabaseSync(path.join(dir,'analyst.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER);
  CREATE TABLE IF NOT EXISTS types(id TEXT PRIMARY KEY,name TEXT NOT NULL,criteria TEXT NOT NULL,playbook TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS grants(user_id TEXT REFERENCES users(id),type_id TEXT REFERENCES types(id),PRIMARY KEY(user_id,type_id));
  CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,company TEXT,sector TEXT,type_id TEXT REFERENCES types(id));
  CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),title TEXT,markdown TEXT);
  CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),created_at TEXT,status TEXT,snapshot TEXT,result TEXT,error TEXT);
  CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT);
  `);
  if(!db.prepare('PRAGMA table_info(projects)').all().some(column=>column.name==='archived_at'))db.exec('ALTER TABLE projects ADD COLUMN archived_at TEXT');
  if(!db.prepare('PRAGMA table_info(projects)').all().some(column=>column.name==='owner_id'))db.exec('ALTER TABLE projects ADD COLUMN owner_id TEXT REFERENCES users(id)');
  const documentColumns=db.prepare('PRAGMA table_info(documents)').all().map(c=>c.name);
  if(!documentColumns.includes('file_type'))db.exec("ALTER TABLE documents ADD COLUMN file_type TEXT NOT NULL DEFAULT 'md'");
  if(!documentColumns.includes('original_name'))db.exec('ALTER TABLE documents ADD COLUMN original_name TEXT');
  const typeColumns=db.prepare('PRAGMA table_info(types)').all().map(c=>c.name);
  for(const [name,definition] of [['status',"TEXT NOT NULL DEFAULT 'ready'"],['generation_input','TEXT'],['generation_error','TEXT']])if(!typeColumns.includes(name))db.exec(`ALTER TABLE types ADD COLUMN ${name} ${definition}`);
  for(const [name,definition] of [['skill_revision','TEXT'],['reference_version','INTEGER NOT NULL DEFAULT 0'],['skill_reference_version','INTEGER NOT NULL DEFAULT -1']])if(!typeColumns.includes(name))db.exec(`ALTER TABLE types ADD COLUMN ${name} ${definition}`);
  // Keep the legacy column for existing databases; new runs store language in their own snapshot.
  if(!typeColumns.includes('report_language'))db.exec("ALTER TABLE types ADD COLUMN report_language TEXT NOT NULL DEFAULT 'en'");
  db.exec('CREATE TABLE IF NOT EXISTS type_attachments(id TEXT PRIMARY KEY,type_id TEXT NOT NULL REFERENCES types(id) ON DELETE CASCADE,name TEXT NOT NULL,file_type TEXT NOT NULL,markdown TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL,has_preview INTEGER NOT NULL DEFAULT 0)');
  db.prepare("UPDATE types SET status='failed',generation_error='Generation was interrupted. Retry to continue.' WHERE status='generating'").run();
  // A new installation starts empty apart from the initial administrator; each organization adds its own projects and skills.
  if(!db.prepare('SELECT id FROM users LIMIT 1').get())db.prepare('INSERT INTO users VALUES(?,?,?,?,1)').run(id(),'admin',hashPassword('admin'),'admin');
  db.prepare("UPDATE runs SET status='failed',error='Server restarted before this run completed.' WHERE status='running'").run();
  return db;
}
export function transaction(db,fn) {db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
