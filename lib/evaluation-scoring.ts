/**
 * Time-based points when HOD marks a submission Complete (evaluated).
 * Process = assigned standard-process task (staff_process_assignments).
 * - Staff submitted after assignment end (calendar day) → 0 pt (late report).
 * - Staff on time, HOD evaluates after end → 2 pts + accountability note.
 * - Otherwise → 2 pts.
 */
export const DELAYED_HOD_ACTION_NOTE = 'HOD delayed action on staff submission.';

function utcDayStart(d: Date): number {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function computeCompleteEvaluationMetrics(params: {
    assignmentEnd: string | Date | null | undefined;
    staffSubmittedAt: string | Date | null | undefined;
    evaluationAt?: Date;
}): { metricsAchieved: 0 | 1 | 2; appendNote: string | null } {
    const { assignmentEnd, staffSubmittedAt, evaluationAt = new Date() } = params;

    if (!assignmentEnd || !staffSubmittedAt) {
        return { metricsAchieved: 2, appendNote: null };
    }

    const end = new Date(assignmentEnd);
    const sub = new Date(staffSubmittedAt);
    if (Number.isNaN(end.getTime()) || Number.isNaN(sub.getTime())) {
        return { metricsAchieved: 2, appendNote: null };
    }

    const staffDay = utcDayStart(sub);
    const endDay = utcDayStart(end);
    const evalDay = utcDayStart(evaluationAt);

    if (staffDay > endDay) {
        return { metricsAchieved: 0, appendNote: null };
    }

    if (evalDay > endDay) {
        return { metricsAchieved: 2, appendNote: DELAYED_HOD_ACTION_NOTE };
    }

    return { metricsAchieved: 2, appendNote: null };
}

/** MySQL evaluations.rating for Complete outcomes (0–2 scale on metrics_achieved) */
export function ratingForCompleteMetrics(metricsAchieved: 0 | 1 | 2): string {
    if (metricsAchieved >= 2) return 'Exceptional Performance';
    if (metricsAchieved === 1) return 'Meets Expectations';
    return 'Below Expectations';
}

export function mergeEvaluationFeedback(
    reviewerNotes: string,
    appendNote: string | null
): string {
    const base = String(reviewerNotes || '').trim();
    if (!appendNote) return base;
    if (base.includes(appendNote)) return base;
    return base ? `${base}\n\n${appendNote}` : appendNote;
}
