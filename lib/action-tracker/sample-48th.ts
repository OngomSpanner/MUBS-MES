import { query } from '@/lib/db';
import { copyAssignedActionToSds } from '@/lib/action-tracker/sds-link';

const MEETING_TITLE = 'THE 48TH DEVELOPMENT COMMITTEE MEETING HELD ON AUGUST 05, 2026';
const MEETING_DATE = '2026-08-05';

type SeatDef = { label: string; match: string[]; secretariat: boolean };

const SEATS: SeatDef[] = [
  { label: 'Principal', match: ['Principal'], secretariat: false },
  { label: 'Deputy Principal', match: ['Deputy Principal', 'Dy. Principal'], secretariat: false },
  { label: 'Legal', match: ['Legal'], secretariat: false },
  { label: 'Bursar', match: ['Bursar', 'Finance'], secretariat: false },
  { label: 'School Secretary', match: ['School Secretary'], secretariat: false },
  { label: 'Strategy', match: ['Strategy & Projects', 'Strategy', 'Projects'], secretariat: true },
  { label: 'Estates', match: ['Estates & Works', 'Estates', 'Works'], secretariat: false },
  { label: 'MIS', match: ['Management Information', 'MIS'], secretariat: false },
  { label: 'PDU', match: ['Procurement', 'PDU'], secretariat: false },
  { label: 'Chief Security Officer', match: ['Chief Security', 'Security'], secretariat: false },
  { label: 'PPP Secretariat', match: ['PPP', 'Public Private'], secretariat: false },
  { label: 'DC Secretariat', match: ['Strategy & Projects', 'Strategy'], secretariat: true },
];

type SampleAction = {
  minute_no: string;
  title: string;
  seat: string;
  deadline: string;
  status: 'not_started' | 'in_progress' | 'done';
  progress_note: string;
};

const ACTIONS: SampleAction[] = [
  {
    minute_no: 'Min48/4.0',
    title: 'Engage MoF to secure additional funding for renovation works, especially the WTO Building.',
    seat: 'Strategy',
    deadline: '2026-08-30',
    status: 'not_started',
    progress_note: 'Pending – awaiting final renovation plan from Estates.',
  },
  {
    minute_no: 'Min48/4.1(i)',
    title: 'Prepare a comprehensive renovation and rehabilitation plan for all School buildings, including Phase II of the Main Lobby, main and small gates, Capital Shoppers gate, regional campuses, and rainwater harvesting provisions among others.',
    seat: 'Estates',
    deadline: '2026-08-21',
    status: 'not_started',
    progress_note: 'To be developed in Quarter 2. Detailed report expected from Engineer.',
  },
  {
    minute_no: 'Min48/4.1(ii)',
    title: 'Assess technical staffing gaps (carpenters, builders, painters) and submit recommendations.',
    seat: 'Estates',
    deadline: '2026-08-30',
    status: 'done',
    progress_note: 'Report submitted to Management.',
  },
  {
    minute_no: 'Min48/4.1(iii)',
    title: 'Identify equipment required for maintenance and renovation under Force Account and submit for budgeting.',
    seat: 'Estates',
    deadline: '2026-08-30',
    status: 'done',
    progress_note: 'Requirements submitted for budgeting.',
  },
  {
    minute_no: 'Min48/4.1(B)(i)',
    title: 'Identify and designate space in the renovated Main Lobby for Reception, Security Office, and Stores.',
    seat: 'Strategy',
    deadline: '2026-12-18',
    status: 'in_progress',
    progress_note: 'Presented at the Space Management Committee. Space Mgt. Committee to present options to Management for consideration.',
  },
  {
    minute_no: 'Min48/4.1(B)(ii)',
    title: 'Develop designated spaces or mechanisms for displaying student campaign materials to reduce poster litter.',
    seat: 'Strategy',
    deadline: '2027-03-31',
    status: 'in_progress',
    progress_note: 'Plan ongoing. Currently working with guild to present proposal to management.',
  },
  {
    minute_no: 'Min48/4.1(D)(i)',
    title: 'Establish additional waste collection points near Guild Canteen and sports pitch; assess adequacy of skips.',
    seat: 'School Secretary',
    deadline: '2026-09-01',
    status: 'in_progress',
    progress_note: 'Report to be presented at the meeting.',
  },
  {
    minute_no: 'Min48/4.1(D)(ii)',
    title: 'Monitor waste collection and maintain a register (vehicle registration, driver signature).',
    seat: 'School Secretary',
    deadline: '2026-08-20',
    status: 'in_progress',
    progress_note: 'Report to be presented at the meeting.',
  },
  {
    minute_no: 'Min48/4.1(D)(iii)',
    title: 'Monitor cleaning service providers for contractual compliance.',
    seat: 'School Secretary',
    deadline: '2026-08-06',
    status: 'in_progress',
    progress_note: 'Report to be presented at the meeting.',
  },
  {
    minute_no: 'Min48/4.1(D)(iv)',
    title: 'Review frequency of compound maintenance, especially during rainy season.',
    seat: 'School Secretary',
    deadline: '2026-08-06',
    status: 'in_progress',
    progress_note: 'Report to be presented at the meeting.',
  },
  {
    minute_no: 'Min48/5.1(1)',
    title: 'Follow up and obtain revised BOQs and outstanding technical documents from Arch. Muhanguzi.',
    seat: 'Estates',
    deadline: '2026-08-10',
    status: 'done',
    progress_note: 'Revised BOQs received and shared.',
  },
  {
    minute_no: 'Min48/5.1(4)',
    title: 'Identify a suitable data backup system and sensitise staff on backing up documents to the shared drive.',
    seat: 'MIS',
    deadline: '2026-08-12',
    status: 'in_progress',
    progress_note: 'Implementation commenced using Microsoft 365 licences (OneDrive).',
  },
  {
    minute_no: 'Min48/5.2(2)',
    title: 'Commence procurement for the Education Complex upon approval of BOQs.',
    seat: 'PDU',
    deadline: '2026-09-15',
    status: 'not_started',
    progress_note: 'Awaiting Development Committee approval of BOQs.',
  },
  {
    minute_no: 'Min48/5.2(3)',
    title: 'Write to Makerere University to facilitate change of ownership of the red station wagon on URA portal.',
    seat: 'Strategy',
    deadline: '2026-08-10',
    status: 'in_progress',
    progress_note: 'Letter written and delivered. Awaiting response.',
  },
  {
    minute_no: 'Min48/6.1(i–v)',
    title: 'Close four business operators with rental arrears and develop procedures for admission, contracting, and monitoring of business operators.',
    seat: 'Chief Security Officer',
    deadline: '2026-08-05',
    status: 'done',
    progress_note: 'Operators closed. Later reinstated upon clearing arrears.',
  },
  {
    minute_no: 'Min48/6.2(i–ii)',
    title: 'Complete valuation and due diligence of Aga Khan Foundation premises for potential Mbale Campus tenancy.',
    seat: 'Strategy',
    deadline: '2026-08-10',
    status: 'in_progress',
    progress_note: 'Valuation facilitation initiated. Awaiting payment to commence.',
  },
  {
    minute_no: 'Min48/6.2(iii–iv)',
    title: 'Develop five-year performance targets for Mbale Campus and a performance framework for all regional campuses.',
    seat: 'Strategy',
    deadline: '2026-08-30',
    status: 'in_progress',
    progress_note: 'Assessment ongoing for all campuses. To be presented at the next Development Committee Meeting.',
  },
  {
    minute_no: 'Min48/6.3(b)(i)',
    title: 'Convene meeting with Grant Thornton to resolve PPP feasibility report comments.',
    seat: 'PPP Secretariat',
    deadline: '2026-08-25',
    status: 'not_started',
    progress_note: 'To be set up upon submission of designs and masterplan by Arch. Muhanguzi.',
  },
  {
    minute_no: 'Min48/6.3(b)(ii)',
    title: 'Follow up nomination of a Process Auditor with Accountant General.',
    seat: 'Strategy',
    deadline: '2026-08-06',
    status: 'done',
    progress_note: 'Reminder letter signed and delivered.',
  },
  {
    minute_no: 'Min48/6.3(c)(i)',
    title: 'Complete external works at Career Guidance Building (pavers, landscaping, grassing, access roads).',
    seat: 'Estates',
    deadline: '2026-08-20',
    status: 'in_progress',
    progress_note: 'Works progressing.',
  },
  {
    minute_no: 'Min48/6.3(c)(ii)',
    title: 'Coordinate commissioning ceremony for Career Guidance Building.',
    seat: 'Strategy',
    deadline: '2026-08-20',
    status: 'in_progress',
    progress_note: 'In progress and Commissioning due by 1 Sept 2026.',
  },
  {
    minute_no: 'Min48/6.4(a)(i)',
    title: 'Initiate renewal of MoU with Jinja City Council.',
    seat: 'Strategy',
    deadline: '2026-09-30',
    status: 'in_progress',
    progress_note: 'In progress. Currently on second draft.',
  },
  {
    minute_no: 'Min48/6.4(a)(v)',
    title: 'Prepare supporting document for Mayor’s visit, including beneficiaries of MUBS programmes.',
    seat: 'Strategy',
    deadline: '2026-08-06',
    status: 'done',
    progress_note: 'Completed and presented on Aug 7, 2026.',
  },
  {
    minute_no: 'Min48/6.5(a)',
    title: 'Allocate operating space to Vend Bar in line with approved procedures.',
    seat: 'Strategy',
    deadline: '2026-08-10',
    status: 'in_progress',
    progress_note: 'Ongoing. Space identified at Block 3. Valuers engaged.',
  },
  {
    minute_no: 'Min48/6.5(b)',
    title: 'Renew Alpha Office Solutions contract upon clearance of rent obligations.',
    seat: 'Strategy',
    deadline: '2026-08-10',
    status: 'not_started',
    progress_note: 'Pending decision on contract type.',
  },
  {
    minute_no: 'Min48/6.6(a)(iv)',
    title: 'Prepare and submit extract on establishment of Holding Company to Top Management.',
    seat: 'DC Secretariat',
    deadline: '2026-08-10',
    status: 'done',
    progress_note: 'Completed and presented at the last Top Management Committee Meeting.',
  },
];

async function matchDepartmentId(terms: string[]): Promise<number | null> {
  for (const term of terms) {
    const rows = (await query({
      query: `SELECT id FROM departments
              WHERE is_active = 1 AND (
                name LIKE ? OR COALESCE(external_name, '') LIKE ?
              )
              ORDER BY CHAR_LENGTH(name) ASC
              LIMIT 1`,
      values: [`%${term}%`, `%${term}%`],
    })) as { id: number }[];
    if (rows[0]?.id != null) return Number(rows[0].id);
  }
  return null;
}

async function findPersonForDepartment(departmentId: number | null, usedIds: Set<number>): Promise<number | null> {
  if (departmentId) {
    const hods = (await query({
      query: `SELECT id FROM users
              WHERE status = 'Active' AND (
                managed_unit_id = ?
                OR (department_id = ? AND (
                  role LIKE '%department_head%' OR role LIKE '%unit_head%'
                  OR role LIKE '%hod%' OR role LIKE '%HOD%'
                ))
              )
              ORDER BY CASE WHEN managed_unit_id = ? THEN 0 ELSE 1 END, id ASC
              LIMIT 8`,
      values: [departmentId, departmentId, departmentId],
    })) as { id: number }[];
    let fromRoles: { id: number }[] = [];
    try {
      fromRoles = (await query({
        query: `SELECT u.id FROM users u
                INNER JOIN user_roles ur ON ur.user_id = u.id
                WHERE u.status = 'Active'
                  AND ur.role IN ('department_head', 'unit_head', 'hod')
                  AND (u.managed_unit_id = ? OR u.department_id = ?)
                ORDER BY CASE WHEN u.managed_unit_id = ? THEN 0 ELSE 1 END, u.id ASC
                LIMIT 8`,
        values: [departmentId, departmentId, departmentId],
      })) as { id: number }[];
    } catch {
      fromRoles = [];
    }
    const combined = [...hods, ...fromRoles];
    const hod = combined.find((r) => !usedIds.has(Number(r.id))) || combined[0];
    if (hod?.id) return Number(hod.id);

    const staff = (await query({
      query: `SELECT id FROM users
              WHERE status = 'Active' AND department_id = ?
              ORDER BY id ASC
              LIMIT 20`,
      values: [departmentId],
    })) as { id: number }[];
    const pick = staff.find((r) => !usedIds.has(Number(r.id))) || staff[0];
    if (pick?.id) return Number(pick.id);
  }

  const any = (await query({
    query: `SELECT id FROM users WHERE status = 'Active' ORDER BY id ASC LIMIT 50`,
  })) as { id: number }[];
  const pick = any.find((r) => !usedIds.has(Number(r.id))) || any[0];
  return pick?.id != null ? Number(pick.id) : null;
}

async function ensureTeam(): Promise<number | null> {
  const existing = (await query({
    query: `SELECT id FROM action_teams WHERE name = 'Development Committee' LIMIT 1`,
  })) as { id: number }[];
  if (existing[0]?.id) return Number(existing[0].id);
  const insert = (await query({
    query: `INSERT INTO action_teams (name, kind, description, created_by)
            VALUES ('Development Committee', 'committee',
            'School Development Committee. Track decisions and actions from meetings in real time.', NULL)`,
  })) as { insertId?: number };
  return Number(insert.insertId) || null;
}

export async function seed48thDevelopmentCommittee(): Promise<void> {
  const teamId = await ensureTeam();
  if (!teamId) return;

  const usedPeople = new Set<number>();
  const seatMap = new Map<string, { userId: number | null; departmentId: number | null }>();

  for (const seat of SEATS) {
    const deptId = await matchDepartmentId(seat.match);
    let userId: number | null = null;
    const existing = (await query({
      query: `SELECT id, user_id, department_id FROM action_team_members
              WHERE team_id = ? AND seat_label = ? LIMIT 1`,
      values: [teamId, seat.label],
    })) as { id: number; user_id: number | null; department_id: number | null }[];

    if (existing[0]?.user_id) {
      userId = Number(existing[0].user_id);
    } else {
      userId = await findPersonForDepartment(deptId || (existing[0]?.department_id != null ? Number(existing[0].department_id) : null), usedPeople);
    }
    if (userId) usedPeople.add(userId);

    const departmentId = deptId || (existing[0]?.department_id != null ? Number(existing[0].department_id) : null);

    if (existing[0]?.id) {
      await query({
        query: `UPDATE action_team_members
                SET department_id = COALESCE(?, department_id),
                    user_id = COALESCE(?, user_id),
                    is_secretariat = ?
                WHERE id = ?`,
        values: [departmentId, userId, seat.secretariat ? 1 : 0, existing[0].id],
      });
    } else {
      await query({
        query: `INSERT INTO action_team_members (team_id, seat_label, department_id, user_id, is_secretariat)
                VALUES (?, ?, ?, ?, ?)`,
        values: [teamId, seat.label, departmentId, userId, seat.secretariat ? 1 : 0],
      });
    }
    seatMap.set(seat.label, { userId, departmentId });
  }

  let meetingId: number | null = null;
  const meetings = (await query({
    query: `SELECT id FROM action_meetings
            WHERE team_id = ? AND meeting_date = ? AND title LIKE '%48TH DEVELOPMENT COMMITTEE%'
            LIMIT 1`,
    values: [teamId, MEETING_DATE],
  })) as { id: number }[];
  if (meetings[0]?.id) {
    meetingId = Number(meetings[0].id);
  } else {
    const ins = (await query({
      query: `INSERT INTO action_meetings (team_id, title, meeting_date, venue, notes, created_by)
              VALUES (?, ?, ?, ?, ?, NULL)`,
      values: [
        teamId,
        MEETING_TITLE,
        MEETING_DATE,
        null,
        'Sample action report loaded from the 48th Development Committee meeting minutes.',
      ],
    })) as { insertId?: number };
    meetingId = Number(ins.insertId) || null;
  }
  if (!meetingId) return;

  const existingCount = (await query({
    query: 'SELECT COUNT(*) AS c FROM action_items WHERE meeting_id = ?',
    values: [meetingId],
  })) as { c: number }[];
  const alreadySeeded = Number(existingCount[0]?.c ?? 0) > 0;

  let assignedBy = seatMap.get('Strategy')?.userId || seatMap.get('DC Secretariat')?.userId || null;
  if (!assignedBy) {
    const any = (await query({
      query: `SELECT id FROM users WHERE status = 'Active' ORDER BY id ASC LIMIT 1`,
    })) as { id: number }[];
    assignedBy = any[0]?.id != null ? Number(any[0].id) : null;
  }

  if (!alreadySeeded) {
    for (const action of ACTIONS) {
      const seat = seatMap.get(action.seat) || { userId: null, departmentId: null };
      const ins = (await query({
        query: `INSERT INTO action_items
                (team_id, meeting_id, minute_no, title, assignee_user_id, office_department_id, deadline, status, progress_note, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [
          teamId,
          meetingId,
          action.minute_no,
          action.title,
          seat.userId,
          seat.departmentId,
          action.deadline,
          action.status,
          action.progress_note,
          assignedBy,
        ],
      })) as { insertId?: number };
      const actionId = Number(ins.insertId);
      if (actionId && seat.userId && assignedBy) {
        try {
          await copyAssignedActionToSds({
            actionId,
            assignedBy,
            assignedByName: 'Development Committee Secretariat',
            skipNotify: true,
          });
        } catch (e) {
          console.error('action-tracker sample SDS copy failed', action.minute_no, e);
        }
      }
    }
  }

  const pendingSds = (await query({
    query: `SELECT id FROM action_items
            WHERE assignee_user_id IS NOT NULL AND sds_assignment_id IS NULL`,
  })) as { id: number }[];
  for (const row of pendingSds) {
    if (!assignedBy) break;
    try {
      await copyAssignedActionToSds({
        actionId: Number(row.id),
        assignedBy,
        assignedByName: 'Development Committee Secretariat',
        skipNotify: true,
      });
    } catch (e) {
      console.error('action-tracker SDS backfill failed', row.id, e);
    }
  }
}
