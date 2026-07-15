#!/usr/bin/env node
/**
 * Import SDS from:
 *  1) data/sds_activities.csv  (activities hierarchy)
 *  2) data/sds_standards_from_pdf.json (titles, purpose, pathway, matrix blocks)
 *
 * Usage:
 *   node scripts/import-sds-full.js [standards-json] [activities-csv]
 *
 * The optional standards JSON is the authoritative matrix source. Activities
 * remain sourced from the CSV, and missing activity lists are safely derived
 * from arrow-separated process steps without replacing existing activities.
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
  // These names deliberately target the primary service-unit records in the
  // MUBS departments table. Owner labels in SDS documents vary considerably
  // (Office of…, Directorate…, and abbreviations), including one record whose
  // code says MIS but whose owner label is School Bursar.
  const OWNER_LABEL_TO_DEPT = {
    'OFFICE OF THE SCHOOL REGISTRAR': 'SCHOOL REGISTRAR S OFFICE',
    'FACULTY OF GRADUATE STUDIES AND RESEARCH FGSR': 'FACULTY OF GRADUATE STUDIES AND RESEARCH FGSR',
    'FACULTY OF GRADUATE STUDIES AND RESEARCH': 'FACULTY OF GRADUATE STUDIES AND RESEARCH FGSR',
    'STRATEGY PROJECTS UNIT': 'STRATEGY PROJECTS',
    'ESTATES WORKS UNIT': 'ESTATES AND WORKS',
    'MANAGEMENT INFORMATION SYSTEMS UNIT MIS UNIT': 'MANAGEMENT OF INFORMATION SYSTEM MIS',
    'OFFICE OF THE SCHOOL BURSAR': 'SCHOOL BURSAR S OFFICE',
    'DEAN OF STUDENTS OFFICE': 'DEAN OF STUDENTS OFFICE',
    'DEAN OF STUDENTS': 'DEAN OF STUDENTS OFFICE',
    'HEALTH SERVICES CENTRE': 'HEALTH SERVICES CENTRE',
    'HUMAN RESOURCE DIRECTORATE': 'HUMAN RESOURCE DIRECTORATE',
    'SECURITY SECTION': 'SECURITY SECTION',
    'DISABILITY RESOURCE AND LEARNING CENTRE DRLC': 'DISABILITY AND RESOURCE LEARNING CENTRE',
    'QUALITY ASSURANCE DIRECTORATE QAD': 'DIRECTORATE OF QUALITY ASSURANCE',
    'SCHOOL LIBRARY': 'SCHOOL LIBRARIAN S OFFICE',
    'DIRECTORATE OF LEGAL AFFAIRS': 'DIRECTORATE OF LEGAL AFFAIRS',
    'INTERNAL AUDIT DIRECTORATE': 'INTERNAL AUDIT DIRECTORATE',
    'PROCUREMENT AND DISPOSAL UNIT PDU': 'PROCUREMENT AND DISPOSAL UNIT',
    'PUBLIC RELATIONS OFFICE PRO': 'PUBLIC RELATIONS PROMOTIONS OFFICE',
    'OFFICE OF THE SCHOOL SECRETARY': 'SCHOOL SECRETARY S OFFICE',
    // There is no Outreach Centres department. This is the closest existing
    // operational owner for the Industry Partnership standard.
    'OUTREACH CENTRES': 'CAREER AND SKILLS DEVELOPMENT CENTRE',
  };
  const OWNER_CODE_TO_DEPT = {
    SR: 'SCHOOL REGISTRAR S OFFICE',
    FGSR: 'FACULTY OF GRADUATE STUDIES AND RESEARCH FGSR',
    MIS: 'MANAGEMENT OF INFORMATION SYSTEM MIS',
    'S&P': 'STRATEGY PROJECTS',
    'E&W': 'ESTATES AND WORKS',
    HS: 'HEALTH SERVICES CENTRE',
    DOS: 'DEAN OF STUDENTS OFFICE',
    DoS: 'DEAN OF STUDENTS OFFICE',
    DRLC: 'DISABILITY AND RESOURCE LEARNING CENTRE',
    DLA: 'DIRECTORATE OF LEGAL AFFAIRS',
    HRD: 'HUMAN RESOURCE DIRECTORATE',
    IA: 'INTERNAL AUDIT DIRECTORATE',
    PDU: 'PROCUREMENT AND DISPOSAL UNIT',
    SB: 'SCHOOL BURSAR S OFFICE',
    SS: 'SCHOOL SECRETARY S OFFICE',
    OCs: 'CAREER AND SKILLS DEVELOPMENT CENTRE',
    PRO: 'PUBLIC RELATIONS PROMOTIONS OFFICE',
    SL: 'SCHOOL LIBRARIAN S OFFICE',
    SO: 'SECURITY SECTION',
    QAD: 'DIRECTORATE OF QUALITY ASSURANCE',
  };
  function matchDept(ownerAbbrev, ownerLabel, departments) {
    const pick = (hits) => [...hits].sort((a, b) => a.id - b.id)[0] || null;
    const labelNorm = normName(ownerLabel || '');
    // Use explicit source-label mappings before the code. This fixes the
    // known MIS-coded School Bursar record and makes aliases deterministic.
    const mappedName = OWNER_LABEL_TO_DEPT[labelNorm] || OWNER_CODE_TO_DEPT[ownerAbbrev];
    if (mappedName) {
      const exactMapped = departments.filter((d) => normName(d.name) === mappedName);
      if (exactMapped.length) return pick(exactMapped);
    }
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
  const pdfJsonPath = path.resolve(process.argv[2] || path.join(process.cwd(), 'data', 'sds_standards_from_pdf.json'));
  const csvPath = path.resolve(process.argv[3] || path.join(process.cwd(), 'data', 'sds_activities.csv'));
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

    // 2) Outputs + activities from CSV; attach matrix_rows by ORDINAL within each standard
    //    (CSV output codes use global O30/O31/… — NOT a 1-based matrix index)
    const outputCodesByStandard = new Map(); // stdCode -> ordered unique output codes
    for (const row of activityRows) {
      const stdCode = normalizeCode(row.standard_code || '');
      const outputCode = normalizeCode(row.output_id || '');
      if (!stdCode || !outputCode) continue;
      if (!outputCodesByStandard.has(stdCode)) outputCodesByStandard.set(stdCode, []);
      const list = outputCodesByStandard.get(stdCode);
      if (!list.includes(outputCode)) list.push(outputCode);
    }
    const ordinalByOutputCode = new Map(); // outputCode -> 0-based ordinal within its standard
    for (const [, codes] of outputCodesByStandard.entries()) {
      codes.forEach((code, idx) => ordinalByOutputCode.set(code, idx));
    }
    const activityTextByOutputCode = new Map();
    for (const row of activityRows) {
      const outputCode = normalizeCode(row.output_id || '');
      const activityName = String(row.activity_name || '').trim();
      if (!outputCode || !activityName) continue;
      activityTextByOutputCode.set(
        outputCode,
        `${activityTextByOutputCode.get(outputCode) || ''} ${activityName}`.trim(),
      );
    }
    const titleTokens = (value) => new Set(
      String(value || '').toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length >= 4 && !new Set([
          'with', 'from', 'that', 'this', 'into', 'through', 'about', 'programme', 'programmes',
          'service', 'process', 'report', 'mubs', 'output', 'their', 'within',
        ]).has(token)),
    );
    const rowSimilarity = (activityText, matrixRow) => {
      const activityTokens = titleTokens(activityText);
      const rowTokens = titleTokens(`${matrixRow?.service_description || ''} ${matrixRow?.process_text || ''}`);
      let shared = 0;
      for (const token of activityTokens) if (rowTokens.has(token)) shared += 1;
      return shared;
    };
    const matrixRowForOutput = (pdf, stdCode, outputCode, ordinal) => {
      const rows = Array.isArray(pdf.matrix_rows) ? pdf.matrix_rows : [];
      const ordinalRow = rows[ordinal] || null;
      const standardOutputCount = (outputCodesByStandard.get(stdCode) || []).length;
      // Ordinal is authoritative when the matrix and CSV have the same number
      // of outputs. If they differ, activity/title similarity is safer than
      // assigning a shifted matrix row to every subsequent CSV output.
      if (rows.length === standardOutputCount || !rows.length) return ordinalRow;
      const activityText = activityTextByOutputCode.get(outputCode) || '';
      const ranked = rows
        .map((row, index) => ({ row, index, score: rowSimilarity(activityText, row) }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
      // A single shared generic word (for example "data" or "report") is
      // not enough evidence to override position in a malformed matrix.
      return ranked[0]?.score >= 2 ? ranked[0].row : ordinalRow;
    };

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
        const codeNum = m ? Number(m[1]) : 1;
        // Prefer ordinal among this standard's outputs; fall back to code number
        const ordinal = ordinalByOutputCode.has(outputCode)
          ? ordinalByOutputCode.get(outputCode)
          : Math.max(0, codeNum - 1);
        const sequenceNo = ordinal + 1;
        const pdf = pdfByCode.get(stdCode) || {};
        const matrixRow = matrixRowForOutput(pdf, stdCode, outputCode, ordinal);
        const fallbackOne = (arr) =>
          (arr && arr[ordinal])
          || ((arr || []).length === 1 && ordinal === 0 ? arr[0] : null);

        let serviceDescription = (matrixRow && matrixRow.service_description)
          || `Output ${outputCode}`;
        // Prefer clean PDF titles; refuse quality/policy dumps
        if (/https?:\/\//i.test(serviceDescription)
          || /\b(adherence to|conformance to|compliance with)\b/i.test(serviceDescription)
            && serviceDescription.length > 80) {
          serviceDescription = `Output ${outputCode}`;
        }
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
              quality_standard=?,
              process_text=COALESCE(?, process_text),
              coverage=COALESCE(?, coverage),
              frequency=COALESCE(?, frequency),
              target_beneficiary=COALESCE(?, target_beneficiary)
             WHERE output_code=?`,
            [
              standardId, sequenceNo, serviceDescription, JSON.stringify(pis),
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
              standardId, outputCode, sequenceNo, serviceDescription, JSON.stringify(pis),
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

    // A legacy CSV reused MIS output codes O51–O54 for the separate Bursar
    // Stores & Asset Registry standard. Move the existing output/activity IDs
    // once so their history stays intact and each standard shows its own
    // authoritative matrix rows.
    const legacyOutputRehomes = [{
      fromCode: 'MUBS/P2/OBJ1/IDDT/MIS/S001',
      toCode: 'MUBS/P2/OBJ1/IDDT/MIS/S001-DUPCHECK-D',
      outputCodes: [
        'MUBS/P2/OBJ1/IDDT/MIS/S001-O51',
        'MUBS/P2/OBJ1/IDDT/MIS/S001-O52',
        'MUBS/P2/OBJ1/IDDT/MIS/S001-O53',
        'MUBS/P2/OBJ1/IDDT/MIS/S001-O54',
      ],
    }];
    for (const rehome of legacyOutputRehomes) {
      const targetId = stdIds.get(rehome.toCode);
      if (!targetId) continue;
      for (let index = 0; index < rehome.outputCodes.length; index++) {
        await conn.query(
          'UPDATE sds_outputs SET standard_id=?, sequence_no=? WHERE output_code=? AND standard_id=(SELECT id FROM sds_standards WHERE code=?)',
          [targetId, index + 1, rehome.outputCodes[index], rehome.fromCode],
        );
      }
    }

    // 3) Make every matrix row importable even when the legacy activities CSV
    // has no matching output. Existing output IDs are retained, which keeps
    // assignments and indicator reports connected to the same catalog rows.
    let matrixOutputsUpserted = 0;
    let derivedActivitiesUpserted = 0;
    let obsoleteGeneratedOutputsRemoved = 0;
    const deriveProcessActivities = (processText) => {
      const steps = String(processText || '')
        .split(/\s*(?:→|->|►)\s*/)
        .map((step) => step.trim().replace(/^[•\-–]\s*/, ''))
        .filter(Boolean);
      return steps.length > 1 ? steps : [];
    };
    for (const pdf of pdfStandards) {
      const stdCode = normalizeCode(pdf.code || '');
      const standardId = stdIds.get(stdCode);
      const matrixRows = Array.isArray(pdf.matrix_rows) ? pdf.matrix_rows : [];
      if (!standardId || !matrixRows.length) continue;
      const [existingOutputs] = await conn.query(
        'SELECT id, output_code, sequence_no FROM sds_outputs WHERE standard_id=? ORDER BY sequence_no, id',
        [standardId],
      );
      const matchedOutputIds = new Set();
      for (let index = 0; index < matrixRows.length; index++) {
        const matrixRow = matrixRows[index] || {};
        const sequenceNo = Number(matrixRow.sequence) || index + 1;
        const existing = existingOutputs.find((row) => Number(row.sequence_no) === sequenceNo)
          || existingOutputs[index]
          || null;
        const pis = Array.isArray(matrixRow.performance_indicators) ? matrixRow.performance_indicators : [];
        const values = [
          sequenceNo,
          String(matrixRow.service_description || '').trim() || `Output ${sequenceNo}`,
          JSON.stringify(pis),
          matrixRow.quality_standard || null,
          matrixRow.process_text || null,
          matrixRow.coverage || null,
          matrixRow.frequency || null,
          matrixRow.target_beneficiary || null,
          matrixRow.access_criteria || null,
          matrixRow.methodology || null,
          matrixRow.inputs || null,
        ];
        let outputId;
        if (existing) {
          outputId = Number(existing.id);
          await conn.query(
            `UPDATE sds_outputs SET sequence_no=?, service_description=?, performance_indicators_json=?,
              quality_standard=?, process_text=COALESCE(?, process_text), coverage=COALESCE(?, coverage),
              frequency=COALESCE(?, frequency), target_beneficiary=COALESCE(?, target_beneficiary),
              access_criteria=COALESCE(?, access_criteria), methodology=COALESCE(?, methodology),
              inputs=COALESCE(?, inputs) WHERE id=?`,
            [...values, outputId],
          );
        } else {
          const outputCode = `${stdCode}-M${sequenceNo}`;
          const [ins] = await conn.query(
            `INSERT INTO sds_outputs
              (standard_id, output_code, sequence_no, service_description, performance_indicators_json,
               quality_standard, process_text, coverage, frequency, target_beneficiary, access_criteria,
               methodology, inputs)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [standardId, outputCode, ...values],
          );
          outputId = Number(ins.insertId);
          outputIds.set(outputCode, outputId);
        }
        matchedOutputIds.add(outputId);
        matrixOutputsUpserted += 1;

        // The supplied matrix has no activities array. Where the CSV also has
        // none, derive assignable steps only from an explicit process flow.
        // Do not alter non-empty outputs, protecting existing assignments.
        const [activityCountRows] = await conn.query(
          'SELECT COUNT(*) AS count FROM sds_activities WHERE output_id=?',
          [outputId],
        );
        if (Number(activityCountRows[0]?.count || 0) === 0) {
          const steps = deriveProcessActivities(matrixRow.process_text);
          // An empty process field still has an explicit service deliverable;
          // use that source text as one assignable activity rather than invent
          // a workflow.
          if (!steps.length && matrixRow.service_description) steps.push(String(matrixRow.service_description).trim());
          for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
            const rawStep = steps[stepIndex];
            const durationMatch = rawStep.match(/\(([^)]*(?:day|week|month)[^)]*)\)/i);
            const durationText = durationMatch ? durationMatch[1].trim() : null;
            const activityName = rawStep.replace(/\s*\([^)]*(?:day|week|month)[^)]*\)\s*/ig, ' ').trim();
            if (!activityName) continue;
            await conn.query(
              `INSERT INTO sds_activities (output_id, sequence_no, activity_name, duration_text, duration_days)
               VALUES (?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE activity_name=VALUES(activity_name), duration_text=VALUES(duration_text),
                 duration_days=VALUES(duration_days)`,
              [outputId, stepIndex + 1, activityName, durationText, durationToDays(durationText)],
            );
            derivedActivitiesUpserted += 1;
          }
        }
      }
      // Remove only unreferenced, generated matrix placeholders left by a
      // previous import. Never delete a legacy output or one with an
      // assignment/report.
      for (const existing of existingOutputs) {
        if (matchedOutputIds.has(Number(existing.id)) || !String(existing.output_code).includes('-M')) continue;
        const [refs] = await conn.query(
          `SELECT
            (SELECT COUNT(*) FROM sds_activity_assignments aa
              JOIN sds_activities a ON a.id=aa.activity_id WHERE a.output_id=?) AS assignments,
            (SELECT COUNT(*) FROM sds_indicator_reports WHERE output_id=?) AS reports`,
          [existing.id, existing.id],
        );
        if (Number(refs[0]?.assignments || 0) || Number(refs[0]?.reports || 0)) continue;
        await conn.query('DELETE FROM sds_activities WHERE output_id=?', [existing.id]);
        await conn.query('DELETE FROM sds_outputs WHERE id=?', [existing.id]);
        obsoleteGeneratedOutputsRemoved += 1;
      }
    }

    // Rebuild process_text + replace garbled PDF service descriptions with activity-based covers
    function isBadDesc(s) {
      const t = String(s || '').trim();
      if (!t) return true;
      if (/^Output\b/i.test(t)) return true;
      if (/https?:\/\//i.test(t)) return true;
      if (/\(\s*\d+\s*wee/i.test(t)) return true;
      if (/\([A-Za-z]{2,8}\s*\(\d/i.test(t)) return true;
      if (/\b(adherence to|conformance to|compliance with|quality assurance policy)\b/i.test(t) && t.length > 70) return true;
      const open = (t.match(/\(/g) || []).length;
      const close = (t.match(/\)/g) || []).length;
      if (open > close + 1) return true;
      return false;
    }
    function coverFromActs(acts) {
      const names = acts.map((a) => String(a.activity_name || '').trim()).filter(Boolean);
      if (!names.length) return null;
      if (names.length === 1) return names[0];
      if (names.length === 2) return `${names[0]} → ${names[1]}`;
      return `Process from “${names[0]}” through “${names[names.length - 1]}” (${names.length} steps)`;
    }

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
      const [cur] = await conn.query('SELECT service_description FROM sds_outputs WHERE id=?', [outputId]);
      const currentDesc = cur[0]?.service_description;
      const cover = coverFromActs(acts);
      if (cover && isBadDesc(currentDesc)) {
        await conn.query('UPDATE sds_outputs SET service_description = ? WHERE id=?', [cover, outputId]);
      }
    }

    console.log(JSON.stringify({
      standards: stdIds.size,
      outputs: outputIds.size,
      activitiesUpserted,
      matrixOutputsUpserted,
      derivedActivitiesUpserted,
      obsoleteGeneratedOutputsRemoved,
      pdfStandards: pdfStandards.length,
      sourceJson: pdfJsonPath,
    }, null, 2));
  } finally {
    await conn.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
