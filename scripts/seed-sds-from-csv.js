#!/usr/bin/env node
/**
 * Seed SDS activities from data/sds_activities.csv.
 * Creates stub standards/outputs from codes when missing.
 * Idempotent: upserts by code / output_code / (output_id, sequence_no).
 *
 * Usage: node scripts/seed-sds-from-csv.js [path/to/csv]
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const PILLARS = [
  'Teaching, Learning and Student Success',
  'Infrastructure Development and Digital Transformation',
  'Research, Innovation, Employability and Community Engagement',
  'Equity, Inclusivity and Social Safeguards',
  'Human Capital, Governance, and Institutional Sustainability',
  'Partnerships, Collaborations and Internationalisation',
];

const PILLAR_BY_ABBREV = {
  TLSS: PILLARS[0],
  IDDT: PILLARS[1],
  'R&I': PILLARS[2],
  RI: PILLARS[2],
  EISG: PILLARS[3],
  HCG: PILLARS[4],
  PCI: PILLARS[5],
};

const OWNER_HINTS = {
  SR: ['SCHOOL REGISTRAR', 'REGISTRAR'],
  FGSR: ['GRADUATE STUDIES', 'FGSR'],
  MIS: ['MANAGEMENT OF INFORMATION', 'MANAGEMENT INFORMATION', 'MIS'],
  'S&P': ['STRATEGY', 'PROJECTS'],
  'E&W': ['ESTATES', 'WORKS'],
  HS: ['HEALTH SERVICES', 'HEALTH'],
  DOS: ['DEAN OF STUDENTS'],
  DoS: ['DEAN OF STUDENTS'],
  DLA: ['LEGAL'],
  HRD: ['HUMAN RESOURCE'],
  IA: ['INTERNAL AUDIT'],
  PDU: ['PROCUREMENT'],
  SB: ['BURSAR'],
  SS: ['SCHOOL SECRETARY'],
  OCs: ['OUTREACH'],
  PRO: ['PUBLIC RELATIONS', 'COMMUNICATION'],
  SL: ['LIBRARY', 'LIBRARIAN'],
  SO: ['SCHOOL SECRETARY', 'SECRETARY'],
};

function normalizeCode(raw) {
  return String(raw || '').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim();
}

function parseCode(raw) {
  const normalized = normalizeCode(raw);
  const parts = normalized.split('/').map((p) => p.trim()).filter(Boolean);
  const pillarPart = parts.find((p) => /^P\d+$/i.test(p));
  const objPart = parts.find((p) => /^OBJ\d+$/i.test(p));
  const pillarNum = pillarPart ? Number(pillarPart.replace(/\D/g, '')) : null;
  const objectiveNum = objPart ? Number(objPart.replace(/\D/g, '')) : null;
  const pillarAbbrev = parts[3] || null;
  const ownerAbbrev = parts[4] || null;
  const pillar =
    (pillarAbbrev && PILLAR_BY_ABBREV[pillarAbbrev]) ||
    (pillarNum && PILLARS[pillarNum - 1]) ||
    null;
  return { normalized, pillarNum, objectiveNum, pillarAbbrev, ownerAbbrev, pillar };
}

function durationToDays(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'immediate' || s === 'instant') return 0;
  let m = s.match(/(\d+)\s*day/);
  if (m) return Number(m[1]);
  m = s.match(/(\d+)\s*week/);
  if (m) return Number(m[1]) * 7;
  m = s.match(/(\d+)\s*month/);
  if (m) return Number(m[1]) * 30;
  m = s.match(/^day\s*(\d+)$/);
  if (m) return Number(m[1]);
  return null;
}

function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field.trim());
      field = '';
      continue;
    }
    if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(field.trim());
      field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      if (ch === '\r') i += 1;
      continue;
    }
    if (ch === '\r') {
      row.push(field.trim());
      field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  if (field.length || row.length) {
    row.push(field.trim());
    if (row.some((c) => c !== '')) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] || '').trim();
    });
    return obj;
  });
}

function normName(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9&]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchDept(ownerAbbrev, departments) {
  const hints = OWNER_HINTS[ownerAbbrev] || (ownerAbbrev ? [ownerAbbrev] : []);
  for (const hint of hints) {
    const h = normName(hint);
    const hits = departments.filter((d) => normName(d.name).includes(h));
    if (hits.length === 1) return hits[0];
  }
  return null;
}

async function ensureSchema(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sds_standards (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      code VARCHAR(120) NOT NULL,
      title VARCHAR(500) NOT NULL,
      owner_department_id INT NULL,
      owner_label VARCHAR(255) NULL,
      supporting_units TEXT NULL,
      pathway TEXT NULL,
      user_fee VARCHAR(255) NULL,
      purpose TEXT NULL,
      objectives_json JSON NULL,
      pillar VARCHAR(255) NULL,
      pillar_code VARCHAR(16) NULL,
      objective_code VARCHAR(16) NULL,
      owner_code VARCHAR(64) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sds_standard_code (code),
      KEY idx_sds_standards_owner_dept (owner_department_id),
      KEY idx_sds_standards_pillar (pillar)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sds_outputs (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      standard_id INT UNSIGNED NOT NULL,
      output_code VARCHAR(160) NOT NULL,
      sequence_no INT UNSIGNED NOT NULL DEFAULT 1,
      service_description TEXT NOT NULL,
      performance_indicators_json JSON NULL,
      quality_standard TEXT NULL,
      access_standard TEXT NULL,
      coverage TEXT NULL,
      frequency TEXT NULL,
      process_text TEXT NULL,
      target_beneficiary TEXT NULL,
      access_criteria TEXT NULL,
      methodology TEXT NULL,
      inputs TEXT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sds_output_code (output_code),
      KEY idx_sds_outputs_standard (standard_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sds_activities (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      output_id INT UNSIGNED NOT NULL,
      sequence_no INT UNSIGNED NOT NULL DEFAULT 1,
      activity_name VARCHAR(500) NOT NULL,
      duration_text VARCHAR(120) NULL,
      duration_days INT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sds_activities_output (output_id),
      UNIQUE KEY uq_sds_activity_output_seq (output_id, sequence_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sds_activity_assignments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      activity_id INT UNSIGNED NOT NULL,
      staff_user_id INT NOT NULL,
      assigned_by INT NULL,
      department_id INT NULL,
      assigned_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      target_date DATE NULL,
      notes TEXT NULL,
      status ENUM('active','cancelled') NOT NULL DEFAULT 'active',
      cancelled_at TIMESTAMP NULL,
      cancelled_by INT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sds_assign_activity (activity_id),
      KEY idx_sds_assign_staff (staff_user_id),
      KEY idx_sds_assign_status (status),
      KEY idx_sds_assign_dept (department_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sds_indicator_reports (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      standard_id INT UNSIGNED NOT NULL,
      output_id INT UNSIGNED NULL,
      department_id INT NOT NULL,
      reported_by INT NOT NULL,
      reporting_period VARCHAR(64) NOT NULL,
      indicator_text VARCHAR(1000) NOT NULL,
      value_text VARCHAR(500) NULL,
      comment TEXT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sds_pi_standard (standard_id),
      KEY idx_sds_pi_dept (department_id),
      KEY idx_sds_pi_period (reporting_period)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function main() {
  const csvPath = process.argv[2] || path.join(process.cwd(), 'data', 'sds_activities.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  console.log('CSV rows:', rows.length);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await ensureSchema(conn);
    const [depts] = await conn.query(`
      SELECT id, COALESCE(NULLIF(TRIM(external_name), ''), name) AS name
      FROM departments
    `);

    let standardsCreated = 0;
    let outputsCreated = 0;
    let activitiesUpserted = 0;
    const unmatchedOwners = new Set();

    for (const row of rows) {
      const stdCodeRaw = row.standard_code || '';
      const outputCodeRaw = row.output_id || '';
      const seq = Number(row.sequence) || 1;
      const activityName = String(row.activity_name || '').trim();
      const durationText = String(row.duration_text || '').trim() || null;
      if (!stdCodeRaw || !outputCodeRaw || !activityName) continue;

      const parsed = parseCode(stdCodeRaw);
      const stdCode = parsed.normalized;
      const outputCode = normalizeCode(outputCodeRaw);

      let [stdRows] = await conn.query('SELECT id FROM sds_standards WHERE code = ?', [stdCode]);
      let standardId;
      if (!stdRows.length) {
        const match = matchDept(parsed.ownerAbbrev, depts);
        if (!match && parsed.ownerAbbrev) unmatchedOwners.add(parsed.ownerAbbrev);
        const title = `SDS ${stdCode}`;
        const [ins] = await conn.query(
          `INSERT INTO sds_standards
            (code, title, owner_department_id, owner_label, pillar, pillar_code, objective_code, owner_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            stdCode,
            title,
            match ? match.id : null,
            parsed.ownerAbbrev || null,
            parsed.pillar,
            parsed.pillarAbbrev ? `P${parsed.pillarNum || ''}`.replace(/P$/, '') || parsed.pillarAbbrev : null,
            parsed.objectiveNum ? `OBJ${parsed.objectiveNum}` : null,
            parsed.ownerAbbrev,
          ],
        );
        standardId = Number(ins.insertId);
        standardsCreated += 1;
      } else {
        standardId = Number(stdRows[0].id);
      }

      let [outRows] = await conn.query('SELECT id FROM sds_outputs WHERE output_code = ?', [outputCode]);
      let outputId;
      if (!outRows.length) {
        // Try derive output sequence from -Onn suffix
        const m = outputCode.match(/-O(\d+)$/i);
        const outSeq = m ? Number(m[1]) : 1;
        const [ins] = await conn.query(
          `INSERT INTO sds_outputs
            (standard_id, output_code, sequence_no, service_description, process_text)
           VALUES (?, ?, ?, ?, NULL)`,
          [standardId, outputCode, outSeq, `Output ${outputCode}`],
        );
        outputId = Number(ins.insertId);
        outputsCreated += 1;
      } else {
        outputId = Number(outRows[0].id);
      }

      const days = durationToDays(durationText);
      await conn.query(
        `INSERT INTO sds_activities (output_id, sequence_no, activity_name, duration_text, duration_days)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           activity_name = VALUES(activity_name),
           duration_text = VALUES(duration_text),
           duration_days = VALUES(duration_days)`,
        [outputId, seq, activityName, durationText, days],
      );
      activitiesUpserted += 1;
    }

    console.log(JSON.stringify({
      standardsCreated,
      outputsCreated,
      activitiesUpserted,
      unmatchedOwnerAbbrevs: Array.from(unmatchedOwners).sort(),
    }, null, 2));
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
