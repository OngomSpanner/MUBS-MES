const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Basic dotenv parser for .env.local
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      line = line.replace('\r', '').trim();
      if (!line || line.startsWith('#')) return;
      const index = line.indexOf('=');
      if (index > 0) {
        const key = line.substring(0, index).trim();
        const value = line.substring(index + 1).trim();
        process.env[key] = value;
      }
    });
  }
}

async function runMigration() {
  loadEnv();
  
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mubs_super_admin',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  const queries = [
    `CREATE TABLE IF NOT EXISTS objectives (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS standards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      quality_standard TEXT,
      output_standard TEXT,
      target TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS standard_processes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      standard_id INT NOT NULL,
      step_name TEXT NOT NULL,
      step_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (standard_id) REFERENCES standards(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS staff_process_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      activity_id INT NOT NULL,
      standard_process_id INT NOT NULL,
      staff_id INT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      actual_value DECIMAL(10,2) DEFAULT 0,
      commentary TEXT,
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (activity_id) REFERENCES strategic_activities(id) ON DELETE CASCADE,
      FOREIGN KEY (standard_process_id) REFERENCES standard_processes(id),
      FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  ];

  const alterActivitiesQueries = [
    `ALTER TABLE strategic_activities ADD COLUMN objective_id INT NULL`,
    `ALTER TABLE strategic_activities ADD COLUMN standard_id INT NULL`,
    `ALTER TABLE strategic_activities ADD COLUMN unit_of_measure VARCHAR(50) NULL DEFAULT 'numeric'`,
    `ALTER TABLE strategic_activities ADD CONSTRAINT fk_sa_objective FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE SET NULL`,
    `ALTER TABLE strategic_activities ADD CONSTRAINT fk_sa_standard FOREIGN KEY (standard_id) REFERENCES standards(id) ON DELETE SET NULL`
  ];

  try {
    for (const query of queries) {
      console.log('Executing:', query.split('\n')[0].trim() + '...');
      await pool.execute(query);
    }
    
    console.log('Testing ALTER strategic_activities...');
    for (const query of alterActivitiesQueries) {
      try {
        console.log('Executing:', query);
        await pool.execute(query);
      } catch (err) {
         if(err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_CANT_DROP_FIELD_OR_KEY' || err.code === 'ER_DUP_KEYNAME') {
            console.log('-> Column/Key already exists. Skipping.');
         } else {
            console.error('-> Error:', err.message);
         }
      }
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

runMigration();
