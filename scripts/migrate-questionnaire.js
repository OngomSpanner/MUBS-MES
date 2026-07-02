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
      strategic_objective VARCHAR(512) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_q_outcomes_objective (strategic_objective(191))
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

    `CREATE TABLE IF NOT EXISTS q_metric_comments (
      metric_id INT NOT NULL,
      department_id INT NOT NULL,
      indicator_id INT NOT NULL,
      comment TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (metric_id, department_id),
      KEY idx_qmc_indicator_dept (indicator_id, department_id)
    )`,

    `CREATE TABLE IF NOT EXISTS q_metric_fy_targets (
      metric_id INT NOT NULL,
      financial_year VARCHAR(20) NOT NULL,
      indicator_id INT NOT NULL,
      target_value TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (metric_id, financial_year),
      KEY idx_qmft_indicator (indicator_id)
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
    try {
      const [cols] = await connection.execute(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'q_outcomes' AND COLUMN_NAME = 'strategic_objective'`
      );
      if (cols[0].c === 0) {
        await connection.execute(`
          ALTER TABLE q_outcomes
          ADD COLUMN strategic_objective VARCHAR(512) NULL AFTER label,
          ADD KEY idx_q_outcomes_objective (strategic_objective(191))
        `);
        console.log('  added q_outcomes.strategic_objective');
      } else {
        console.log('  skip (exists): q_outcomes.strategic_objective');
      }
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
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
