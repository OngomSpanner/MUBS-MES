#!/usr/bin/env node
/**
 * Import SDS from:
 *  1) data/sds_activities.csv  (activities hierarchy)
 *  2) data/sds_standards_from_pdf.json (titles, purpose, pathway, matrix blocks)
 *
 * Usage:
 *   node scripts/import-sds-full.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const { ensureSchema, parseCsv, normalizeCode, parseCode, durationToDays, matchDept, OWNER_HINTS } = (() => {
  // inline minimal helpers (shared with seed script patterns)
  function normalizeCode(raw) {
    return String(raw || '').replace(/\s*\/\s*/g, '/').replace(/\s+/g, '').trim();
  }
  function parseCode(raw) {
    const normalized = normalizeCode(raw);
    const parts = normalized.split('/').filter(Boolean);
    const pillarPart = parts.find((p) => /^P\d+$/i.test(p));
    const objPart = parts.find((p) => /^OBJ\d+$/i.test(p));
    return {
      normalized,
      pillarNum: pillarPart ? Number(pillarPart.replace(/\D/g, '')) : null,
      objectiveNum: objPart ? Number(objPart.replace(/\D/g, '')) : null,
      pillarAbbrev: parts[3] || null,
      ownerAbbrev: parts[4] || null,
    };
  }
  function durationToDays(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return null;
    if (s === 'immediate' || s === 'instant') return 0;
    let m = s.match(/(\d+)\s*day/); if (m) return Number(m[1]);
    m = s.match(/(\d+)\s*week/); if (m) return Number(m[1]) * 7;
    m = s.match(/(\d+)\s*month/); if (m) return Number(m[1]) * 30;
    m = s.match(/^day\s*(\d+)$/); if (m) return Number(m[1]);
    return null;
  }
  function parseCsv(text) {
    const source = text.replace(/^\uFEFF/, '');
    const rows = [];
    let row = []; let field = ''; let inQuotes = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i]; const next = source[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') { field += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else field += ch;
        continue;
      }
      if (ch === '"') { inQuotes = true; continue; }
      if (ch === ',') { row.push(field.trim()); field = ''; continue; }
      if (ch === '\n' || (ch === '\r' && next === '\n') || ch === '\r') {
        row.push(field.trim()); field = '';
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
        if (ch === '\r' && next === '\n') i++;
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
      headers.forEach((h, idx) => { obj[h] = (cols[idx] || '').trim(); });
      return obj;
    });
  }
  function normName(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z0-9&]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const OWNER_HINTS = {
    SR: ['SCHOOL REGISTRAR'],
    FGSR: ['FACULTY OF GRADUATE STUDIES'],
    MIS: ['MANAGEMENT OF INFORMATION SYSTEM'],
    'S&P': ['STRATEGY & PROJECTS'],
    'E&W': ['ESTATES AND WORKS'],
    HS: ['HEALTH SERVICES'],
    DOS: ['DEAN OF STUDENTS'],
    DoS: ['DEAN OF STUDENTS'],
    DRLC: ['DISABILITY'],
    DLA: ['LEGAL AFFAIRS'],
    HRD: ['HUMAN RESOURCE'],
    IA: ['INTERNAL AUDIT'],
    PDU: ['PROCUREMENT AND DISPOSAL'],
    SB: ['SCHOOL BURSAR'],
    SS: ['SCHOOL SECRETARY'],
    OCs: ['OUTREACH'],
    PRO: ['PUBLIC RELATIONS'],
    SL: ['SCHOOL LIBRARIAN'],
    SO: ['SECURITY SECTION'],
    QAD: ['QUALITY ASSURANCE'],
  };
  function matchDept(ownerAbbrev, ownerLabel, departments) {
    const pick = (hits) => [...hits].sort((a, b) => a.id - b.id)[0] || null;
    const labelNorm = normName(ownerLabel || '');
    if (labelNorm) {
      const exact = departments.filter((d) => normName(d.name) === labelNorm);
      if (exact.length) return pick(exact);
      const contains = departments.filter((d) => {
        const n = normName(d.name);
        return n.includes(labelNorm) || labelNorm.includes(n);
      });
      if (contains.length) return pick(contains);
    }
    const hints = OWNER_HINTS[ownerAbbrev] || (ownerAbbrev ? [ownerAbbrev] : []);
    for (const hint of hints) {
      const h = normName(hint);
      if (!h) continue;
      const hits = departments.filter((d) => normName(d.name).includes(h));
      if (hits.length) {
        const main = hits.filter((d) => !/\(/.test(d.name));
        return pick(main.length ? main : hits);
      }
    }
    return null;
  }
  async function ensureSchema(conn) {
    await conn.query(`CREATE TABLE IF NOT EXISTS sds_standards (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      code VARCHAR(120) NOT NULL,
      title VARCHAR(500) NOT NULL,
      owner_department_id INT NULL,
      owner_label VARCHAR(255) NULL,
      supporting_units TEXT NULL,
      pathway TEXT NULL,
      user_fee TEXT NULL,
      purpose TEXT NULL,
      objectives_json JSON NULL,
      pillar VARCHAR(255) NULL,
      pillar_code VARCHAR(16) NULL,
      objective_code VARCHAR(16) NULL,
      owner_code VARCHAR(64) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id), UNIQUE KEY uq_sds_standard_code (code),
      KEY idx_sds_standards_owner_dept (owner_department_id), KEY idx_sds_standards_pillar (pillar)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    try {
      await conn.query(`ALTER TABLE sds_standards MODIFY COLUMN user_fee TEXT NULL`);
    } catch (_) { /* already TEXT */ }
    await conn.query(`CREATE TABLE IF NOT EXISTS sds_outputs (
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
      PRIMARY KEY (id), UNIQUE KEY uq_sds_output_code (output_code), KEY idx_sds_outputs_standard (standard_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS sds_activities (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      output_id INT UNSIGNED NOT NULL,
      sequence_no INT UNSIGNED NOT NULL DEFAULT 1,
      activity_name VARCHAR(500) NOT NULL,
      duration_text VARCHAR(120) NULL,
      duration_days INT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id), KEY idx_sds_activities_output (output_id),
      UNIQUE KEY uq_sds_activity_output_seq (output_id, sequence_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS sds_activity_assignments (
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
      PRIMARY KEY (id), KEY idx_sds_assign_activity (activity_id), KEY idx_sds_assign_staff (staff_user_id),
      KEY idx_sds_assign_status (status), KEY idx_sds_assign_dept (department_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS sds_indicator_reports (
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
      PRIMARY KEY (id), KEY idx_sds_pi_standard (standard_id), KEY idx_sds_pi_dept (department_id), KEY idx_sds_pi_period (reporting_period)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  return { ensureSchema, parseCsv, normalizeCode, parseCode, durationToDays, matchDept, OWNER_HINTS };
})();

async function main() {
  const csvPath = path.join(process.cwd(), 'data', 'sds_activities.csv');
  const pdfJsonPath = path.join(process.cwd(), 'data', 'sds_standards_from_pdf.json');
  if (!fs.existsSync(csvPath)) throw new Error('Missing ' + csvPath);
  if (!fs.existsSync(pdfJsonPath)) throw new Error('Missing ' + pdfJsonPath + ' — run scripts/parse-sds-pdf.py first');

  const activityRows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const pdfStandards = JSON.parse(fs.readFileSync(pdfJsonPath, 'utf8'));
  const pdfByCode = new Map(pdfStandards.filter((s) => s.code).map((s) => [normalizeCode(s.code), s]));

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
      SELECT id, COALESCE(NULLIF(TRIM(external_name), ''), name) AS name FROM departments
    `);

    // 1) Upsert standards from activity CSV codes + enrich from PDF
    const stdIds = new Map();
    for (const row of activityRows) {
      const code = normalizeCode(row.standard_code || '');
      if (!code || stdIds.has(code)) continue;
      const parsed = parseCode(code);
      const pdf = pdfByCode.get(code) || {};
      const match = matchDept(pdf.owner_code || parsed.ownerAbbrev, pdf.owner_label, depts);
      const title = (pdf.title && !String(pdf.title).startsWith('SDS ')) ? pdf.title : (pdf.title || `SDS ${code}`);
      const [exists] = await conn.query('SELECT id FROM sds_standards WHERE code=?', [code]);
      if (exists.length) {
        await conn.query(
          `UPDATE sds_standards SET title=?, owner_department_id=COALESCE(?, owner_department_id),
            owner_label=COALESCE(?, owner_label), supporting_units=COALESCE(?, supporting_units),
            pathway=COALESCE(?, pathway), user_fee=COALESCE(?, user_fee), purpose=COALESCE(?, purpose),
            objectives_json=COALESCE(?, objectives_json), pillar=COALESCE(?, pillar),
            pillar_code=COALESCE(?, pillar_code), objective_code=COALESCE(?, objective_code),
            owner_code=COALESCE(?, owner_code), is_active=1
           WHERE code=?`,
          [
            title,
            match ? match.id : null,
            pdf.owner_label || parsed.ownerAbbrev || null,
            pdf.supporting_units || null,
            pdf.pathway || null,
            pdf.user_fee || null,
            pdf.purpose || null,
            pdf.objectives ? JSON.stringify(pdf.objectives) : null,
            pdf.pillar || null,
            pdf.pillar_code || null,
            pdf.objective_code || null,
            pdf.owner_code || parsed.ownerAbbrev || null,
            code,
          ],
        );
        stdIds.set(code, Number(exists[0].id));
      } else {
        const [ins] = await conn.query(
          `INSERT INTO sds_standards
            (code, title, owner_department_id, owner_label, supporting_units, pathway, user_fee, purpose,
             objectives_json, pillar, pillar_code, objective_code, owner_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            code, title, match ? match.id : null, pdf.owner_label || parsed.ownerAbbrev || null,
            pdf.supporting_units || null, pdf.pathway || null, pdf.user_fee || null, pdf.purpose || null,
            JSON.stringify(pdf.objectives || []), pdf.pillar || null, pdf.pillar_code || null,
            pdf.objective_code || null, pdf.owner_code || parsed.ownerAbbrev || null,
          ],
        );
        stdIds.set(code, Number(ins.insertId));
      }
    }

    // Also upsert PDF-only standards not in CSV
    for (const pdf of pdfStandards) {
      const code = normalizeCode(pdf.code || '');
      if (!code || stdIds.has(code)) continue;
      const match = matchDept(pdf.owner_code, pdf.owner_label, depts);
      const [ins] = await conn.query(
        `INSERT INTO sds_standards
          (code, title, owner_department_id, owner_label, supporting_units, pathway, user_fee, purpose,
           objectives_json, pillar, pillar_code, objective_code, owner_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title=VALUES(title), purpose=VALUES(purpose), pathway=VALUES(pathway)`,
        [
          code, pdf.title || `SDS ${code}`, match ? match.id : null, pdf.owner_label || null,
          pdf.supporting_units || null, pdf.pathway || null, pdf.user_fee || null, pdf.purpose || null,
          JSON.stringify(pdf.objectives || []), pdf.pillar || null, pdf.pillar_code || null,
          pdf.objective_code || null, pdf.owner_code || null,
        ],
      );
      if (ins.insertId) stdIds.set(code, Number(ins.insertId));
      else {
        const [r] = await conn.query('SELECT id FROM sds_standards WHERE code=?', [code]);
        if (r[0]) stdIds.set(code, Number(r[0].id));
      }
    }

    // 2) Outputs + activities from CSV; attach matrix_rows / blocks by sequence order
    const outputIds = new Map();
    let activitiesUpserted = 0;
    for (const row of activityRows) {
      const stdCode = normalizeCode(row.standard_code || '');
      const outputCode = normalizeCode(row.output_id || '');
      const seq = Number(row.sequence) || 1;
      const activityName = String(row.activity_name || '').trim();
      if (!stdCode || !outputCode || !activityName) continue;
      const standardId = stdIds.get(stdCode);
      if (!standardId) continue;

      if (!outputIds.has(outputCode)) {
        const m = outputCode.match(/-O(\d+)$/i);
        const outSeq = m ? Number(m[1]) : 1;
        const pdf = pdfByCode.get(stdCode) || {};
        const blockIdx = Math.max(0, outSeq - 1);
        const matrixRow = Array.isArray(pdf.matrix_rows) ? pdf.matrix_rows[blockIdx] : null;
        const fallbackOne = (arr) =>
          (arr && arr[blockIdx])
          || ((arr || []).length === 1 && outSeq === 1 ? arr[0] : null);

        const serviceDescription = (matrixRow && matrixRow.service_description)
          || `Output ${outputCode}`;
        const pis = (matrixRow && Array.isArray(matrixRow.performance_indicators)
          ? matrixRow.performance_indicators
          : []);
        const processText = (matrixRow && matrixRow.process_text)
          || fallbackOne(pdf.matrix_process_blocks);
        const quality = (matrixRow && matrixRow.quality_standard)
          || fallbackOne(pdf.matrix_quality_blocks);
        const coverage = (matrixRow && matrixRow.coverage)
          || fallbackOne(pdf.matrix_coverage_blocks);
        const frequency = (matrixRow && matrixRow.frequency)
          || fallbackOne(pdf.matrix_frequency_blocks);
        const beneficiary = (matrixRow && matrixRow.target_beneficiary) || null;

        const [exists] = await conn.query('SELECT id FROM sds_outputs WHERE output_code=?', [outputCode]);
        if (exists.length) {
          await conn.query(
            `UPDATE sds_outputs SET standard_id=?, sequence_no=?,
              service_description=?,
              performance_indicators_json=?,
              quality_standard=COALESCE(?, quality_standard),
              process_text=COALESCE(?, process_text),
              coverage=COALESCE(?, coverage),
              frequency=COALESCE(?, frequency),
              target_beneficiary=COALESCE(?, target_beneficiary)
             WHERE output_code=?`,
            [
              standardId, outSeq, serviceDescription, JSON.stringify(pis),
              quality, processText, coverage, frequency, beneficiary, outputCode,
            ],
          );
          outputIds.set(outputCode, Number(exists[0].id));
        } else {
          const [ins] = await conn.query(
            `INSERT INTO sds_outputs
              (standard_id, output_code, sequence_no, service_description, performance_indicators_json,
               quality_standard, process_text, coverage, frequency, target_beneficiary)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              standardId, outputCode, outSeq, serviceDescription, JSON.stringify(pis),
              quality, processText, coverage, frequency, beneficiary,
            ],
          );
          outputIds.set(outputCode, Number(ins.insertId));
        }
      }

      const outputId = outputIds.get(outputCode);
      await conn.query(
        `INSERT INTO sds_activities (output_id, sequence_no, activity_name, duration_text, duration_days)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE activity_name=VALUES(activity_name), duration_text=VALUES(duration_text), duration_days=VALUES(duration_days)`,
        [outputId, seq, activityName, String(row.duration_text || '').trim() || null, durationToDays(row.duration_text)],
      );
      activitiesUpserted += 1;
    }

    // Rebuild process_text from activities when missing
    for (const [outputCode, outputId] of outputIds.entries()) {
      const [acts] = await conn.query(
        'SELECT activity_name, duration_text FROM sds_activities WHERE output_id=? ORDER BY sequence_no',
        [outputId],
      );
      const rebuilt = acts.map((a) => (a.duration_text ? `${a.activity_name} (${a.duration_text})` : a.activity_name)).join(' → ');
      await conn.query(
        `UPDATE sds_outputs SET process_text = COALESCE(NULLIF(TRIM(process_text), ''), ?) WHERE id=?`,
        [rebuilt || null, outputId],
      );
      // Only fill stub descriptions that still look like codes / empty
      await conn.query(
        `UPDATE sds_outputs SET service_description = ?
         WHERE id=? AND (
           service_description IS NULL
           OR TRIM(service_description)=''
           OR service_description LIKE 'Output MUBS/%'
           OR service_description LIKE 'Output activities:%'
         )`,
        [
          acts.length
            ? `Output activities: ${acts.slice(0, 3).map((a) => a.activity_name).join('; ')}${acts.length > 3 ? '…' : ''}`
            : `Output ${outputCode}`,
          outputId,
        ],
      );
    }

    console.log(JSON.stringify({
      standards: stdIds.size,
      outputs: outputIds.size,
      activitiesUpserted,
      pdfStandards: pdfStandards.length,
    }, null, 2));
  } finally {
    await conn.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
