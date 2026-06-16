const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mubs_super_admin',
  });

  const tables = [
    `CREATE TABLE IF NOT EXISTS q_outcomes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type ENUM('Outcome','Output') NOT NULL DEFAULT 'Outcome',
      label TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS q_indicators (
      id INT AUTO_INCREMENT PRIMARY KEY,
      outcome_id INT NOT NULL,
      indicator_text TEXT NOT NULL,
      is_locked TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (outcome_id) REFERENCES q_outcomes(id) ON DELETE RESTRICT
    )`,

    `CREATE TABLE IF NOT EXISTS q_indicator_departments (
      indicator_id INT NOT NULL,
      department_id INT NOT NULL,
      PRIMARY KEY (indicator_id, department_id),
      FOREIGN KEY (indicator_id) REFERENCES q_indicators(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS q_indicator_fys (
      indicator_id INT NOT NULL,
      financial_year VARCHAR(20) NOT NULL,
      PRIMARY KEY (indicator_id, financial_year),
      FOREIGN KEY (indicator_id) REFERENCES q_indicators(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS q_metrics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      indicator_id INT NOT NULL,
      metric_text TEXT NOT NULL,
      unit_of_measure ENUM('numeric','ratio','percentage','currency','text','list') NOT NULL DEFAULT 'numeric',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (indicator_id) REFERENCES q_indicators(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS q_responses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      indicator_id INT NOT NULL,
      metric_id INT NOT NULL,
      department_id INT NOT NULL,
      financial_year VARCHAR(20) NOT NULL,
      value TEXT,
      submitted_at TIMESTAMP NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_response (metric_id, department_id, financial_year),
      FOREIGN KEY (indicator_id) REFERENCES q_indicators(id) ON DELETE RESTRICT,
      FOREIGN KEY (metric_id) REFERENCES q_metrics(id) ON DELETE RESTRICT,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
    )`,
  ];

  try {
    for (const sql of tables) {
      const name = sql.match(/TABLE IF NOT EXISTS (\w+)/)?.[1] ?? '?';
      try {
        await connection.execute(sql);
        console.log(`  ✓ ${name}`);
      } catch (e) {
        if (e.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`  = ${name} (exists)`);
        } else {
          throw e;
        }
      }
    }
    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

migrate();
