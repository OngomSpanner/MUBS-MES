'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Badge } from 'react-bootstrap';
import StatCard from '@/components/StatCard';
import { academicYearLabelFromKey } from '@/lib/academic-year';
import ProgrammeSelectField from '@/components/Enrollment/ProgrammeSelectField';

type Tab = 'course-units' | 'programmes';

type CourseRecord = {
  id: number;
  courseUnitName: string;
  programmeName: string | null;
  financialYearKey: string;
  studentCount: number | null;
  teachingHours: number | null;
  status: string;
  hodComment: string | null;
};

type ProgrammeRecord = {
  id: number;
  programmeName: string;
  positionDesignation: string;
  financialYearKey: string;
  status: string;
  hodComment: string | null;
};

type Profile = {
  staffName: string;
  positionDesignation: string;
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'secondary',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export default function StaffAcademicTeaching() {
  const [tab, setTab] = useState<Tab>('course-units');
  const [courseRecords, setCourseRecords] = useState<CourseRecord[]>([]);
  const [programmeRecords, setProgrammeRecords] = useState<ProgrammeRecord[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [academicYears, setAcademicYears] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [courseForm, setCourseForm] = useState({
    courseUnitName: '',
    courseUnitCode: '',
    programmeName: '',
    academicYearKey: '',
    reportingPeriod: 'quarterly',
    semesterLabel: '',
    studentCount: '',
    teachingHours: '',
  });
  const [programmeForm, setProgrammeForm] = useState({
    programmeName: '',
    academicYearKey: '',
    reportingPeriod: 'quarterly',
    semesterLabel: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [courseRes, progRes] = await Promise.all([
        axios.get('/api/staff/academic-teaching'),
        axios.get('/api/staff/academic-programme-allocations'),
      ]);
      setCourseRecords(courseRes.data.records ?? []);
      setProgrammeRecords(progRes.data.records ?? []);
      setProfile(courseRes.data.profile ?? progRes.data.profile ?? null);
      setAcademicYears(courseRes.data.academicYears ?? progRes.data.academicYears ?? []);
    } catch (e: unknown) {
      setError(
        axios.isAxiosError(e)
          ? e.response?.data?.message ?? 'Could not load academic teaching data'
          : 'Could not load academic teaching data'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const yearLabel = (key: string) => academicYearLabelFromKey(key, academicYears);

  const reviseRecord = async (kind: Tab, id: number) => {
    const url =
      kind === 'course-units'
        ? `/api/staff/academic-teaching/${id}`
        : `/api/staff/academic-programme-allocations/${id}`;
    try {
      await axios.post(url, { action: 'revise' });
      await load();
    } catch (e: unknown) {
      alert(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Could not reopen record' : 'Could not reopen record');
    }
  };

  const openAdd = () => {
    const defaultYear = academicYears[academicYears.length - 1]?.key ?? '';
    if (tab === 'course-units') {
      setCourseForm({
        courseUnitName: '',
        courseUnitCode: '',
        programmeName: '',
        academicYearKey: defaultYear,
        reportingPeriod: 'quarterly',
        semesterLabel: '',
        studentCount: '',
        teachingHours: '',
      });
    } else {
      setProgrammeForm({
        programmeName: '',
        academicYearKey: defaultYear,
        reportingPeriod: 'quarterly',
        semesterLabel: '',
      });
    }
    setShowModal(true);
  };

  const saveCourse = async (submit: boolean) => {
    setSaving(true);
    try {
      await axios.post('/api/staff/academic-teaching', {
        ...courseForm,
        studentCount: courseForm.studentCount ? Number(courseForm.studentCount) : null,
        teachingHours: courseForm.teachingHours ? Number(courseForm.teachingHours) : null,
        submit,
      });
      setShowModal(false);
      await load();
    } catch (e: unknown) {
      alert(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Save failed' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveProgramme = async (submit: boolean) => {
    setSaving(true);
    try {
      await axios.post('/api/staff/academic-programme-allocations', {
        ...programmeForm,
        submit,
      });
      setShowModal(false);
      await load();
    } catch (e: unknown) {
      alert(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Save failed' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-muted small py-4">Loading…</div>;
  if (error) return <div className="alert alert-danger small">{error}</div>;

  const activeRecords = tab === 'course-units' ? courseRecords : programmeRecords;
  const draftCount = activeRecords.filter((r) => r.status === 'draft').length;
  const submittedCount = activeRecords.filter((r) => r.status === 'submitted').length;
  const approvedCount = activeRecords.filter((r) => r.status === 'approved').length;
  const rejectedCount = activeRecords.filter((r) => r.status === 'rejected').length;

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-3">
          <StatCard label="Draft" value={draftCount} color="blue" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard label="With HOD" value={submittedCount} color="yellow" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard label="Approved" value={approvedCount} color="green" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard label="Rejected" value={rejectedCount} color="red" />
        </div>
      </div>

      {profile && (
        <div className="small text-muted mb-3">
          <strong>{profile.staffName}</strong>
          {profile.positionDesignation !== '—' && (
            <span> · {profile.positionDesignation}</span>
          )}
        </div>
      )}

      <div className="d-flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          className={`btn btn-sm fw-bold ${tab === 'course-units' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setTab('course-units')}
        >
          Course units & teaching load
        </button>
        <button
          type="button"
          className={`btn btn-sm fw-bold ${tab === 'programmes' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setTab('programmes')}
        >
          Programme allocations
        </button>
        <Button
          size="sm"
          className="ms-auto"
          variant="primary"
          style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
          onClick={openAdd}
        >
          Add record
        </Button>
      </div>

      {tab === 'course-units' && (
        <div className="table-responsive table-card">
          <table className="table table-sm mb-0">
            <thead className="table-light">
              <tr>
                <th>Course unit</th><th>Programme</th><th>Academic year</th><th>Students</th><th>Hours</th><th>Status</th><th>HOD comment</th><th></th>
              </tr>
            </thead>
            <tbody>
              {courseRecords.length === 0 ? (
                <tr><td colSpan={8} className="text-muted small text-center py-4">No course unit assignments yet.</td></tr>
              ) : (
                courseRecords.map((r) => (
                  <tr key={r.id}>
                    <td>{r.courseUnitName}</td>
                    <td>{r.programmeName ?? '—'}</td>
                    <td>{yearLabel(r.financialYearKey)}</td>
                    <td>{r.studentCount ?? '—'}</td>
                    <td>{r.teachingHours ?? '—'}</td>
                    <td><Badge bg={STATUS_BADGE[r.status] ?? 'secondary'}>{r.status}</Badge></td>
                    <td className="small text-muted">{r.hodComment ?? '—'}</td>
                    <td>
                      {r.status === 'rejected' && (
                        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => void reviseRecord('course-units', r.id)}>
                          Revise
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'programmes' && (
        <div className="table-responsive table-card">
          <table className="table table-sm mb-0">
            <thead className="table-light">
              <tr>
                <th>Programme</th><th>Position / designation</th><th>Academic year</th><th>Status</th><th>HOD comment</th><th></th>
              </tr>
            </thead>
            <tbody>
              {programmeRecords.length === 0 ? (
                <tr><td colSpan={6} className="text-muted small text-center py-4">No programme allocations yet.</td></tr>
              ) : (
                programmeRecords.map((r) => (
                  <tr key={r.id}>
                    <td>{r.programmeName}</td>
                    <td>{r.positionDesignation}</td>
                    <td>{yearLabel(r.financialYearKey)}</td>
                    <td><Badge bg={STATUS_BADGE[r.status] ?? 'secondary'}>{r.status}</Badge></td>
                    <td className="small text-muted">{r.hodComment ?? '—'}</td>
                    <td>
                      {r.status === 'rejected' && (
                        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => void reviseRecord('programmes', r.id)}>
                          Revise
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">
            {tab === 'course-units' ? 'Course unit & teaching load' : 'Programme allocation'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {tab === 'course-units' ? (
            <div className="row g-2">
              <div className="col-md-8">
                <Form.Label className="small fw-bold">Course unit name</Form.Label>
                <Form.Control size="sm" value={courseForm.courseUnitName} onChange={(e) => setCourseForm((f) => ({ ...f, courseUnitName: e.target.value }))} />
              </div>
              <div className="col-md-4">
                <Form.Label className="small fw-bold">Code</Form.Label>
                <Form.Control size="sm" value={courseForm.courseUnitCode} onChange={(e) => setCourseForm((f) => ({ ...f, courseUnitCode: e.target.value }))} />
              </div>
              <div className="col-md-6">
                <Form.Label className="small fw-bold">Programme</Form.Label>
                <ProgrammeSelectField
                  value={courseForm.programmeName}
                  onChange={(programmeName) => setCourseForm((f) => ({ ...f, programmeName }))}
                  disabled={saving}
                  required
                />
              </div>
              <div className="col-md-6">
                <Form.Label className="small fw-bold">Academic year</Form.Label>
                <Form.Select size="sm" value={courseForm.academicYearKey} onChange={(e) => setCourseForm((f) => ({ ...f, academicYearKey: e.target.value }))}>
                  {academicYears.map((y) => <option key={y.key} value={y.key}>{y.label}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label className="small fw-bold">Reporting period</Form.Label>
                <Form.Select size="sm" value={courseForm.reportingPeriod} onChange={(e) => setCourseForm((f) => ({ ...f, reportingPeriod: e.target.value }))}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="appraisal">Appraisal</option>
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label className="small fw-bold">Semester</Form.Label>
                <Form.Control size="sm" placeholder="e.g. Sem 1" value={courseForm.semesterLabel} onChange={(e) => setCourseForm((f) => ({ ...f, semesterLabel: e.target.value }))} />
              </div>
              <div className="col-md-4">
                <Form.Label className="small fw-bold">Students in unit</Form.Label>
                <Form.Control size="sm" type="number" min={0} value={courseForm.studentCount} onChange={(e) => setCourseForm((f) => ({ ...f, studentCount: e.target.value }))} />
              </div>
              <div className="col-md-4">
                <Form.Label className="small fw-bold">Teaching hours</Form.Label>
                <Form.Control size="sm" type="number" min={0} step="0.5" value={courseForm.teachingHours} onChange={(e) => setCourseForm((f) => ({ ...f, teachingHours: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="row g-2">
              <div className="col-12">
                <Form.Label className="small fw-bold">Position / designation</Form.Label>
                <Form.Control size="sm" value={profile?.positionDesignation ?? '—'} disabled readOnly />
              </div>
              <div className="col-md-6">
                <Form.Label className="small fw-bold">Programme</Form.Label>
                <ProgrammeSelectField
                  value={programmeForm.programmeName}
                  onChange={(programmeName) => setProgrammeForm((f) => ({ ...f, programmeName }))}
                  disabled={saving}
                  required
                />
              </div>
              <div className="col-md-6">
                <Form.Label className="small fw-bold">Academic year</Form.Label>
                <Form.Select size="sm" value={programmeForm.academicYearKey} onChange={(e) => setProgrammeForm((f) => ({ ...f, academicYearKey: e.target.value }))}>
                  {academicYears.map((y) => <option key={y.key} value={y.key}>{y.label}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label className="small fw-bold">Reporting period</Form.Label>
                <Form.Select size="sm" value={programmeForm.reportingPeriod} onChange={(e) => setProgrammeForm((f) => ({ ...f, reportingPeriod: e.target.value }))}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="appraisal">Appraisal</option>
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label className="small fw-bold">Semester</Form.Label>
                <Form.Control size="sm" placeholder="e.g. Sem 1" value={programmeForm.semesterLabel} onChange={(e) => setProgrammeForm((f) => ({ ...f, semesterLabel: e.target.value }))} />
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="outline-primary" size="sm" disabled={saving} onClick={() => void (tab === 'course-units' ? saveCourse(false) : saveProgramme(false))}>
            Save draft
          </Button>
          <Button size="sm" variant="primary" style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }} disabled={saving} onClick={() => void (tab === 'course-units' ? saveCourse(true) : saveProgramme(true))}>
            {saving ? 'Saving…' : 'Submit for HOD review'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
