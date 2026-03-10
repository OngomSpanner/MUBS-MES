import mysql from 'mysql2/promise';

async function run() {
  const p = mysql.createPool({host:'localhost',user:'root',database:'mubs_super_admin'});
  const [tables] = await p.query('SHOW TABLES'); 
  for (let t of tables) { 
    const tName = Object.values(t)[0]; 
    const [rows] = await p.query('SHOW CREATE TABLE `' + tName + '`'); 
    console.log('--- ' + tName + ' ---'); 
    console.log(rows[0]['Create Table']); 
  } 
  p.end(); 
} 
run().catch(console.error);
