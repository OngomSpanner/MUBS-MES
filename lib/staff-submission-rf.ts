import { query } from '@/lib/db';
import {
  computePerformanceStatus,
  isPracticeType,
  type PerformanceStatus,
  type PracticeType,
} from '@/lib/results-framework';
import { buildRfActivityCoalesceSelect, resolveRfTargetValue, type RfActivityTargetInput } from '@/lib/rf-activity-targets';

export type KpiSubmissionContext = {
  taskType: string;
  kpiTargetValue: number | null;
};

export type ParsedRfSubmission = {
  outcomeReason: string | null;
  practiceType: PracticeType | null;
  performanceStatus: PerformanceStatus | null;
  kpiActualNum: number | null;
};

type RfContextRow = RfActivityTargetInput & { task_type: string };

function kpiTargetFromRow(row: RfContextRow): number | null {
  return resolveRfTargetValue(row);
}

export async function resolveKpiSubmissionContext(
  assignmentType: string,
  assignmentId: number,
  userId: number
): Promise<KpiSubmissionContext | null> {
  if (assignmentType === 'process_subtask') {
    const rows = (await query({
      query: `
        SELECT COALESCE(psa_sa.task_type, 'process') AS task_type,
               ${buildRfActivityCoalesceSelect('psa_sa', 'parent_sa')}
        FROM staff_process_subtasks sps
        JOIN staff_process_assignments spa ON sps.process_assignment_id = spa.id
        LEFT JOIN strategic_activities psa_sa ON spa.activity_id = psa_sa.id
        LEFT JOIN strategic_activities parent_sa ON psa_sa.parent_id = parent_sa.id
        LEFT JOIN standards st ON st.id = COALESCE(psa_sa.standard_id, parent_sa.standard_id)
        WHERE sps.id = ? AND sps.assigned_to = ?
      `,
      values: [assignmentId, userId],
    })) as RfContextRow[];
    return rows[0]
      ? {
          taskType: rows[0].task_type,
          kpiTargetValue: kpiTargetFromRow(rows[0]),
        }
      : null;
  }

  if (assignmentType === 'process_task') {
    const rows = (await query({
      query: `
        SELECT COALESCE(psa_sa.task_type, 'process') AS task_type,
               ${buildRfActivityCoalesceSelect('psa_sa', 'parent_sa')}
        FROM staff_process_assignments spa
        LEFT JOIN strategic_activities psa_sa ON spa.activity_id = psa_sa.id
        LEFT JOIN strategic_activities parent_sa ON psa_sa.parent_id = parent_sa.id
        LEFT JOIN standards st ON st.id = COALESCE(psa_sa.standard_id, parent_sa.standard_id)
        WHERE spa.id = ? AND spa.staff_id = ?
      `,
      values: [assignmentId, userId],
    })) as RfContextRow[];
    return rows[0]
      ? {
          taskType: rows[0].task_type,
          kpiTargetValue: kpiTargetFromRow(rows[0]),
        }
      : null;
  }

  const rows = (await query({
    query: `
      SELECT COALESCE(sa.task_type, 'process') AS task_type,
             ${buildRfActivityCoalesceSelect()}
      FROM activity_assignments aa
      JOIN strategic_activities sa ON aa.activity_id = sa.id
      LEFT JOIN strategic_activities p ON sa.parent_id = p.id
      LEFT JOIN standards st ON st.id = COALESCE(sa.standard_id, p.standard_id)
      WHERE aa.id = ? AND aa.assigned_to_user_id = ?
    `,
    values: [assignmentId, userId],
  })) as RfContextRow[];

  return rows[0]
    ? {
        taskType: rows[0].task_type,
        kpiTargetValue: kpiTargetFromRow(rows[0]),
      }
    : null;
}

export function parseRfSubmissionFromForm(
  formData: FormData,
  kpiContext: KpiSubmissionContext | null,
  isDraft: boolean
): { data: ParsedRfSubmission; error?: string } {
  const kpiRaw = String(formData.get('kpiActualValue') || '').trim();
  const kpiActualNum = kpiRaw !== '' && !Number.isNaN(Number(kpiRaw)) ? Number(kpiRaw) : null;

  const outcomeReasonRaw = String(formData.get('outcomeReason') || '').trim();
  const practiceTypeRaw = String(formData.get('practiceType') || '').trim();

  const isKpiDriver = kpiContext?.taskType === 'kpi_driver';

  if (!isKpiDriver) {
    return {
      data: {
        outcomeReason: null,
        practiceType: null,
        performanceStatus: null,
        kpiActualNum,
      },
    };
  }

  if (!isDraft) {
    if (kpiActualNum == null) {
      return { data: { outcomeReason: null, practiceType: null, performanceStatus: null, kpiActualNum }, error: 'KPI achieved value is required.' };
    }
    if (!outcomeReasonRaw || outcomeReasonRaw.length < 10) {
      return {
        data: { outcomeReason: null, practiceType: null, performanceStatus: null, kpiActualNum },
        error: 'Please explain the outcome (at least 10 characters).',
      };
    }
    if (!isPracticeType(practiceTypeRaw)) {
      return {
        data: { outcomeReason: null, practiceType: null, performanceStatus: null, kpiActualNum },
        error: 'Please indicate whether this result is from existing practice or new innovation.',
      };
    }
  }

  const practiceType = isPracticeType(practiceTypeRaw) ? practiceTypeRaw : null;
  const performanceStatus = computePerformanceStatus(kpiContext?.kpiTargetValue, kpiActualNum);

  return {
    data: {
      outcomeReason: outcomeReasonRaw || null,
      practiceType,
      performanceStatus,
      kpiActualNum,
    },
  };
}
