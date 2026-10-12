// Synthetic test-only records. Deep Proof itself starts with no projects or skills.
export function seedTestData(db){
 db.prepare('INSERT OR IGNORE INTO types(id,name,criteria,playbook) VALUES(?,?,?,?)').run('investment','Investment diligence','Revenue quality\nProfitability and adjustments\nCustomer concentration and retention','Inventory the supplied evidence. Assess each criterion. Identify missing evidence.');
 for(const [id,company,sector] of [['nexora-software','Nexora Industrial Software AG','Industrial Software'],['valemont-components','Valemont Components','Manufacturing']]){
  db.prepare('INSERT OR IGNORE INTO projects(id,company,sector,type_id) VALUES(?,?,?,?)').run(id,company,sector,'investment');
  db.prepare('INSERT OR IGNORE INTO documents(id,project_id,title,markdown) VALUES(?,?,?,?)').run(id+'-financials',id,'Financial pack',`# ${company} financial pack\n\nRevenue 2025: EUR 12 million.\nEBITDA 2025: EUR 2 million.\n`);
 }
}
// Seed before createApp so startup migrations treat the records like existing data.
export async function seededStore(dir){const {openStore}=await import('../../src/store.mjs');const db=openStore(dir);seedTestData(db);db.close();return dir;}
