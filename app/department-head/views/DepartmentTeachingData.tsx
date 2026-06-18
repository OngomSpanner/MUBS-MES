'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Badge } from 'react-bootstrap';
import StatCard from '@/components/StatCard';
import TeachingSubmissionModal from '@/components/DepartmentHead/TeachingSubmissionModal';
import { academicYearLabelFromKey } from '@/lib/academic-year';

type Tab = 'course-units' | 'programmes';

type CourseRecord = {
  id: number;
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

type ProgrammeRecord = {
  id: number;
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

const STATUS_BADGE: Record<string, string> = {
  draft: 'secondary',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export default function DepartmentTeachingData() {
  const [tab, setTab] = useState<Tab>('course-units');
  const [courseRecords, setCourseRecords] = useState<CourseRecord[]>([]);
  const [programmeRecords, setProgrammeRecords] = useState<ProgrammeRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewCourse, setReviewCourse] = useState<CourseRecord | null>(null);
  const [reviewProgramme, setReviewProgramme] = useState<ProgrammeRecord | null>(null);
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [courseRes, progRes] = await Promise.all([
        axios.get('/api/department-head/academic-teaching'),
        axios.get('/api/department-head/academic-programme-allocations'),
      ]);
      setCourseRecords(courseRes.data.records ?? []);
      setProgrammeRecords(progRes.data.records ?? []);
      setAcademicYears(courseRes.data.academicYears ?? progRes.data.academicYears ?? []);
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Could not load teaching data' : 'Could not load teaching data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const yearLabel = (key: string) => academicYearLabelFromKey(key, academicYears);

  const openReview = (record: CourseRecord | ProgrammeRecord) => {
    setComment('');
    if (tab === 'course-units') setReviewCourse(record as CourseRecord);
    else setReviewProgramme(record as ProgrammeRecord);
  };

  const closeReview = () => {
    setReviewCourse(null);
    setReviewProgramme(null);
    setComment('');
  };

  const submitReview = async (action: 'approve' | 'reject' | 'resubmit') => {
    const record = reviewCourse ?? reviewProgramme;
    if (!record) return;

    if ((action === 'reject' || action === 'resubmit') && !comment.trim()) {
      alert('Please enter a comment before rejecting or requesting resubmit.');
      return;
    }

    const url =
      tab === 'course-units'
        ? `/api/department-head/academic-teaching/${record.id}`
        : `/api/department-head/academic-programme-allocations/${record.id}`;

    setActing(true);
    try {
      await axios.post(url, { action, comment: comment.trim() });
      closeReview();
      await load();
    } catch (e: unknown) {
      alert(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Review failed' : 'Review failed');
    } finally {
      setActing(false);
    }
  };

  if (loading) return <div className="text-muted small py-4">Loading academic teaching data…</div>;
  if (error) return <div className="alert alert-danger small">{error}</div>;

  const activeRecords = tab === 'course-units' ? courseRecords : programmeRecords;
  const pendingCount = activeRecords.filter((r) => r.status === 'submitted').length;
  const approvedCount = activeRecords.filter((r) => r.status === 'approved').length;
  const rejectedCount = activeRecords.filter((r) => r.status === 'rejected').length;

  const reviewRecord = reviewCourse ?? reviewProgramme;
  const canReview = reviewRecord?.status === 'submitted';

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-4">
          <StatCard label="Awaiting approval" value={pendingCount} color="yellow" />
        </div>
        <div className="col-6 col-md-4">
          <StatCard label="Approved" value={approvedCount} color="green" />
        </div>
        <div className="col-12 col-md-4">
          <StatCard label="Rejected" value={rejectedCount} color="red" />
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <button type="button" className={`btn btn-sm fw-bold ${tab === 'course-units' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTab('course-units')}>
          Course units & teaching load
        </button>
        <button type="button" className={`btn btn-sm fw-bold ${tab === 'programmes' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTab('programmes')}>
          Programme allocations
        </button>
      </div>

      {tab === 'course-units' && (
        <div className="table-responsive table-card">
          <table className="table table-sm mb-0">
            <thead className="table-light">
              <tr>
                <th>Staff</th>
                <th>Position / designation</th>
                <th>Course unit</th>
                <th>Programme</th>
                <th>Academic year</th>
                <th>Students</th>
                <th>Hours</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {courseRecords.length === 0 ? (
                <tr><td colSpan={9} className="text-muted small text-center py-4">No course unit assignments yet.</td></tr>
              ) : courseRecords.map((r) => (
                <tr key={r.id}>
                  <td>{r.staffName}</td>
                  <td>{r.positionDesignation}</td>
                  <td>{r.courseUnitName}</td>
                  <td>{r.programmeName ?? '—'}</td>
                  <td>{yearLabel(r.financialYearKey)}</td>
                  <td>{r.studentCount ?? '—'}</td>
                  <td>{r.teachingHours ?? '—'}</td>
                  <td><Badge bg={STATUS_BADGE[r.status] ?? 'secondary'}>{r.status}</Badge></td>
                  <td>
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={() => openReview(r)}>
                      {r.status === 'submitted' ? 'Review' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'programmes' && (
        <div className="table-responsive table-card">
          <table className="table table-sm mb-0">
            <thead className="table-light">
              <tr>
                <th>Staff</th>
                <th>Position / designation</th>
                <th>Programme</th>
                <th>Academic year</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {programmeRecords.length === 0 ? (
                <tr><td colSpan={6} className="text-muted small text-center py-4">No programme allocations yet.</td></tr>
              ) : programmeRecords.map((r) => (
                <tr key={r.id}>
                  <td>{r.staffName}</td>
                  <td>{r.positionDesignation}</td>
                  <td>{r.programmeName}</td>
                  <td>{yearLabel(r.financialYearKey)}</td>
                  <td><Badge bg={STATUS_BADGE[r.status] ?? 'secondary'}>{r.status}</Badge></td>
                  <td>
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={() => openReview(r)}>
                      {r.status === 'submitted' ? 'Review' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TeachingSubmissionModal
        show={reviewRecord != null}
        kind={tab}
        record={reviewRecord}
        yearLabel={yearLabel}
        canReview={canReview}
        comment={comment}
        acting={acting}
        onCommentChange={setComment}
        onClose={closeReview}
        onReview={(action) => void submitReview(action)}
      />
    </div>
  );
}
