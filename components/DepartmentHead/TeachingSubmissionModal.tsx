'use client';

import { Badge, Form } from 'react-bootstrap';
import MubsModal, {
  MUBS_MODAL_BTN_STYLE,
  MUBS_MODAL_PRIMARY_BTN_STYLE,
  MubsModalHero,
  mubsModalBtnClass,
} from '@/components/Modals/MubsModal';
import MubsDetailRows, { type MubsDetailRow } from '@/components/Modals/MubsDetailRows';
import { formatDateTime, formatReadableName, getInitials, hasDisplayValue } from '@/lib/display-utils';

export type TeachingCourseRecord = {
  staffName: string;
  positionDesignation: string;
  departmentName: string;
  courseUnitCode: string | null;
  courseUnitName: string;
  programmeName: string | null;
  financialYearKey: string;
  reportingPeriod: string | null;
  semesterLabel: string | null;
  studentCount: number | null;
  teachingHours: number | null;
  status: string;
  hodComment: string | null;
  approvedAt: string | null;
  reviewedAt: string | null;
};

export type TeachingProgrammeRecord = {
  staffName: string;
  positionDesignation: string;
  departmentName: string;
  programmeName: string;
  financialYearKey: string;
  reportingPeriod: string | null;
  semesterLabel: string | null;
  status: string;
  hodComment: string | null;
  approvedAt: string | null;
  reviewedAt: string | null;
};

type TeachingSubmissionModalProps = {
  show: boolean;
  kind: 'course-units' | 'programmes';
  record: TeachingCourseRecord | TeachingProgrammeRecord | null;
  yearLabel: (key: string) => string;
  canReview: boolean;
  comment: string;
  acting: boolean;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onReview: (action: 'approve' | 'reject' | 'resubmit') => void;
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'secondary',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

function submissionSubject(record: TeachingCourseRecord | TeachingProgrammeRecord, kind: 'course-units' | 'programmes'): string {
  if (kind === 'course-units' && 'courseUnitName' in record) {
    return record.courseUnitName;
  }
  return record.programmeName ?? 'Submission';
}

function buildDetailRows(
  record: TeachingCourseRecord | TeachingProgrammeRecord,
  kind: 'course-units' | 'programmes',
  yearLabel: (key: string) => string
): MubsDetailRow[] {
  const reviewedOn = formatDateTime(record.reviewedAt ?? record.approvedAt);
  const rows: MubsDetailRow[] = [
    { label: 'Department', value: formatReadableName(record.departmentName) },
    { label: 'Academic year', value: yearLabel(record.financialYearKey) },
    { label: 'Status', value: STATUS_LABEL[record.status] ?? record.status },
  ];

  if (reviewedOn) {
    rows.push({ label: 'Reviewed on', value: reviewedOn });
  }

  if (kind === 'course-units' && 'courseUnitName' in record) {
    const course = record as TeachingCourseRecord;
    if (hasDisplayValue(course.programmeName)) {
      rows.push({ label: 'Programme', value: course.programmeName! });
    }
    if (hasDisplayValue(course.courseUnitCode)) {
      rows.push({ label: 'Course code', value: course.courseUnitCode! });
    }
    if (hasDisplayValue(course.semesterLabel)) {
      rows.push({ label: 'Semester', value: course.semesterLabel! });
    }
    if (hasDisplayValue(course.reportingPeriod)) {
      rows.push({ label: 'Reporting period', value: course.reportingPeriod! });
    }
    if (course.studentCount != null) {
      rows.push({ label: 'Students in unit', value: String(course.studentCount) });
    }
    if (course.teachingHours != null) {
      rows.push({ label: 'Teaching hours', value: String(course.teachingHours) });
    }
  } else {
    if (hasDisplayValue(record.semesterLabel)) {
      rows.push({ label: 'Semester', value: record.semesterLabel! });
    }
    if (hasDisplayValue(record.reportingPeriod)) {
      rows.push({ label: 'Reporting period', value: record.reportingPeriod! });
    }
  }

  if (hasDisplayValue(record.hodComment)) {
    rows.push({ label: 'HOD comment', value: record.hodComment! });
  }

  return rows;
}

export default function TeachingSubmissionModal({
  show,
  kind,
  record,
  yearLabel,
  canReview,
  comment,
  acting,
  onCommentChange,
  onClose,
  onReview,
}: TeachingSubmissionModalProps) {
  if (!record) return null;

  const subject = submissionSubject(record, kind);
  const detailRows = buildDetailRows(record, kind, yearLabel);
  const commentRows = canReview || !hasDisplayValue(record.hodComment)
    ? detailRows.filter((r) => r.label !== 'HOD comment')
    : detailRows;

  const footer = canReview ? (
    <>
      <button
        type="button"
        className={mubsModalBtnClass('outline-danger')}
        style={MUBS_MODAL_BTN_STYLE}
        disabled={acting}
        onClick={() => onReview('reject')}
      >
        Reject
      </button>
      <button
        type="button"
        className={mubsModalBtnClass('outline-warning')}
        style={MUBS_MODAL_BTN_STYLE}
        disabled={acting}
        onClick={() => onReview('resubmit')}
      >
        Request resubmit
      </button>
      <button
        type="button"
        className={mubsModalBtnClass('primary')}
        style={MUBS_MODAL_PRIMARY_BTN_STYLE}
        disabled={acting}
        onClick={() => onReview('approve')}
      >
        Approve
      </button>
      <button type="button" className={mubsModalBtnClass('light')} style={MUBS_MODAL_BTN_STYLE} onClick={onClose}>
        Close
      </button>
    </>
  ) : (
    <button type="button" className={mubsModalBtnClass('light')} style={MUBS_MODAL_BTN_STYLE} onClick={onClose}>
      Close
    </button>
  );

  return (
    <MubsModal
      show={show}
      onClose={onClose}
      title={canReview ? 'Review submission' : 'Teaching submission'}
      icon={canReview ? 'rate_review' : 'school'}
      footer={footer}
    >
      <MubsModalHero
        initials={getInitials(record.staffName)}
        title={record.staffName}
        subtitle={
          <>
            {hasDisplayValue(record.positionDesignation) ? (
              <span>{record.positionDesignation}</span>
            ) : null}
            {hasDisplayValue(record.positionDesignation) ? <span> · </span> : null}
            <span>{subject}</span>
          </>
        }
        badge={
          <Badge bg={STATUS_BADGE[record.status] ?? 'secondary'} className="text-uppercase">
            {STATUS_LABEL[record.status] ?? record.status}
          </Badge>
        }
      />

      <MubsDetailRows sectionTitle="Submission details" rows={commentRows} />

      {canReview ? (
        <Form.Group className="mt-2 mb-0">
          <div
            className="text-muted fw-bold mb-2"
            style={{ fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            HOD comment
          </div>
          <Form.Control
            as="textarea"
            rows={3}
            value={comment}
            placeholder="Required for reject or resubmit. Optional for approval."
            onChange={(e) => onCommentChange(e.target.value)}
            style={{ fontSize: '0.85rem', borderRadius: '8px' }}
          />
        </Form.Group>
      ) : null}
    </MubsModal>
  );
}
