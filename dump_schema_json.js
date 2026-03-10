const mysql = require('mysql2/promise');

async function run() {
  const p = mysql.createPool({host:'localhost',user:'root',database:'mubs_super_admin'});
  const [tables] = await p.query('SHOW TABLES'); 
  const result = []; 
  for (let t of tables) { 
    const tName = Object.values(t)[0]; 
    const [rows] = await p.query('SHOW CREATE TABLE `' + tName + '`'); 
    result.push('--- ' + tName + ' ---\n' + rows[0]['Create Table']); 
  } 
  
  // write to schema_dump_clean.json
  const fs = require('fs');
  fs.writeFileSync('./schema_dump_clean.json', JSON.stringify(result, null, 2), 'utf8');
  p.end(); 
} 

run().catch(console.error);
