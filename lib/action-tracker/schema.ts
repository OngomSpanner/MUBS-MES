import { query } from '@/lib/db';
import { columnExists } from '@/lib/db-schema';
import { seed48thDevelopmentCommittee } from '@/lib/action-tracker/sample-48th';

let ensured = false;
let ensurePromise: Promise<void> | null = null;

const DEV_SEATS = [
  'Principal',
  'Deputy Principal',
  'Legal',
  'Bursar',
  'School Secretary',
  'Strategy',
  'Estates',
  'MIS',
  'PDU',
];

async function tableExists(name: string): Promise<boolean> {
  const rows = (await query({
    query: `SELECT COUNT(*) AS c FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    values: [name],
  })) as { c: number }[];
  return Number(rows[0]?.c) > 0;
}

async function matchDepartmentId(label: string): Promise<number | null> {
  const rows = (await query({
    query: `SELECT id FROM departments
            WHERE is_active = 1 AND (
              name LIKE ? OR COALESCE(external_name, '') LIKE ?
            )
            ORDER BY CHAR_LENGTH(name) ASC
            LIMIT 1`,
    values: [`%${label}%`, `%${label}%`],
  })) as { id: number }[];
  return rows[0]?.id != null ? Number(rows[0].id) : null;
}

export async function ensureActionTrackerSchema(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;
  ensurePromise = ensureActionTrackerSchemaOnce();
  await ensurePromise;
}

async function ensureActionTrackerSchemaOnce(): Promise<void> {
  if (ensured) return;

  await query({
    query: `
      CREATE TABLE IF NOT EXISTS action_teams (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        kind VARCHAR(32) NOT NULL DEFAULT 'committee',
        department_id INT NULL,
        description TEXT NULL,
        auto_sds TINYINT(1) NOT NULL DEFAULT 1,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_by INT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_action_teams_kind (kind),
        KEY idx_action_teams_dept (department_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
  });

  if (!(await columnExists('action_teams', 'auto_sds'))) {
    await query({
      query: 'ALTER TABLE action_teams ADD COLUMN auto_sds TINYINT(1) NOT NULL DEFAULT 1',
    });
  }

  await query({
    query: `
      CREATE TABLE IF NOT EXISTS action_team_members (
        id INT NOT NULL AUTO_INCREMENT,
        team_id INT NOT NULL,
        seat_label VARCHAR(255) NOT NULL,
        department_id INT NULL,
        user_id INT NULL,
        is_secretariat TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_atm_team (team_id),
        KEY idx_atm_user (user_id),
        KEY idx_atm_dept (department_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
  });

  await query({
    query: `
      CREATE TABLE IF NOT EXISTS action_meetings (
        id INT NOT NULL AUTO_INCREMENT,
        team_id INT NOT NULL,
        title VARCHAR(500) NOT NULL,
        meeting_date DATE NOT NULL,
        venue VARCHAR(255) NULL,
        notes TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_am_team (team_id),
        KEY idx_am_date (meeting_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
  });

  await query({
    query: `
      CREATE TABLE IF NOT EXISTS action_items (
        id INT NOT NULL AUTO_INCREMENT,
        team_id INT NOT NULL,
        meeting_id INT NULL,
        minute_no VARCHAR(64) NULL,
        title TEXT NOT NULL,
        assignee_user_id INT NULL,
        office_department_id INT NULL,
        deadline DATE NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'not_started',
        progress_note TEXT NULL,
        sds_assignment_id INT NULL,
        created_by INT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_ai_team (team_id),
        KEY idx_ai_meeting (meeting_id),
        KEY idx_ai_assignee (assignee_user_id),
        KEY idx_ai_office (office_department_id),
        KEY idx_ai_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
  });

  await query({
    query: `
      CREATE TABLE IF NOT EXISTS action_item_updates (
        id INT NOT NULL AUTO_INCREMENT,
        action_id INT NOT NULL,
        user_id INT NOT NULL,
        status VARCHAR(32) NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_aiu_action (action_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
  });

  if (await tableExists('action_teams')) {
    const countRows = (await query({
      query: 'SELECT COUNT(*) AS c FROM action_teams',
    })) as { c: number }[];
    if (Number(countRows[0]?.c ?? 0) === 0) {
      const insert = (await query({
        query: `INSERT INTO action_teams (name, kind, description, created_by)
                VALUES ('Development Committee', 'committee',
                'School Development Committee. Track decisions and actions from meetings in real time.', NULL)`,
      })) as { insertId?: number };
      const teamId = Number(insert.insertId);
      if (teamId > 0) {
        for (const seat of DEV_SEATS) {
          const deptId = await matchDepartmentId(seat);
          await query({
            query: `INSERT INTO action_team_members (team_id, seat_label, department_id, is_secretariat)
                    VALUES (?, ?, ?, ?)`,
            values: [teamId, seat, deptId, seat === 'Strategy' ? 1 : 0],
          });
        }
      }
    }
  }

  try {
    await seed48thDevelopmentCommittee();
  } catch (e) {
    console.error('action-tracker sample 48th seed failed', e);
  }

  ensured = true;
}
