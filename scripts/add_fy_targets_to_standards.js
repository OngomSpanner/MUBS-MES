const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'mubs_super_admin'
  });

  try {
    const cols = [
      "ALTER TABLE standards ADD COLUMN unit_of_measure VARCHAR(50) DEFAULT 'numeric'",
      "ALTER TABLE standards ADD COLUMN target_fy25_26 DECIMAL(15,2) NULL",
      "ALTER TABLE standards ADD COLUMN target_fy26_27 DECIMAL(15,2) NULL",
      "ALTER TABLE standards ADD COLUMN target_fy27_28 DECIMAL(15,2) NULL",
      "ALTER TABLE standards ADD COLUMN target_fy28_29 DECIMAL(15,2) NULL",
      "ALTER TABLE standards ADD COLUMN target_fy29_30 DECIMAL(15,2) NULL",
    ];
    for (const sql of cols) {
      try {
        await connection.query(sql);
        console.log('OK:', sql.split('ADD COLUMN')[1].trim());
      } catch(e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
          console.log('Already exists:', sql.split('ADD COLUMN')[1].trim());
        } else throw e;
      }
    }
    console.log('\nDone. All FY target columns are added to standards table.');
  } finally {
    connection.end();
  }
}

migrate().catch(console.error);
