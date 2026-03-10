import mysql from 'mysql2/promise';
import fs from 'fs';

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mubs_super_admin',
  });

  try {
    const [tables] = await pool.query('SHOW TABLES');
    const tableKey = Object.keys(tables[0])[0];
    const tableNames = tables.map(t => t[tableKey]);

    const schema = {};
    for (const tableName of tableNames) {
      const [columns] = await pool.query(`DESCRIBE \`${tableName}\``);
      schema[tableName] = columns;
    }

    fs.writeFileSync('db_schema.json', JSON.stringify(schema, null, 2));
    console.log('Schema written to db_schema.json');
  } catch (error) {
    console.error('Error fetching schema:', error);
  } finally {
    await pool.end();
  }
}

main();
