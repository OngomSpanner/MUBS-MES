'use client';

import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import type { CourseUnitEnrollmentRecord } from '@/lib/ambassador/enrollment-records';
import FacultySelectField from '@/components/Enrollment/FacultySelectField';

export type { CourseUnitEnrollmentRecord };

type CourseUnitEnrollmentEntryModalProps = {
  show: boolean;
  mode: 'create' | 'edit';
  record: CourseUnitEnrollmentRecord | null;
  saving: boolean;
  error: string | null;
  onHide: () => void;
  onSave: (payload: {
    facultyName: string;
    courseUnitName: string;
    totalStudents: number;
    maleCount: number;
    femaleCount: number;
    pwdCount: number;
    submitForReview?: boolean;
  }) => void;
};

function formDefaults(mode: 'create' | 'edit', record: CourseUnitEnrollmentRecord | null) {
  if (record && mode === 'edit') {
    return {
      facultyName: record.facultyName,
      courseUnitName: record.courseUnitName,
      totalStudents: String(record.totalStudents),
      maleCount: String(record.maleCount),
      femaleCount: String(record.femaleCount),
      pwdCount: String(record.pwdCount),
    };
  }
  return {
    facultyName: '',
    courseUnitName: '',
    totalStudents: '0',
    maleCount: '0',
    femaleCount: '0',
    pwdCount: '0',
  };
}

function CourseUnitEnrollmentForm({
  mode,
  record,
  saving,
  error,
  onHide,
  onSave,
}: Omit<CourseUnitEnrollmentEntryModalProps, 'show'>) {
  const defaults = formDefaults(mode, record);
  const [facultyName, setFacultyName] = useState(defaults.facultyName);
  const [courseUnitName, setCourseUnitName] = useState(defaults.courseUnitName);
  const [totalStudents, setTotalStudents] = useState(defaults.totalStudents);
  const [maleCount, setMaleCount] = useState(defaults.maleCount);
  const [femaleCount, setFemaleCount] = useState(defaults.femaleCount);
  const [pwdCount, setPwdCount] = useState(defaults.pwdCount);

  const save = (submitForReview: boolean) => {
    if (!courseUnitName.trim() || !facultyName.trim()) return;
    onSave({
      facultyName: facultyName.trim(),
      courseUnitName: courseUnitName.trim(),
      totalStudents: Math.max(0, Number(totalStudents) || 0),
      maleCount: Math.max(0, Number(maleCount) || 0),
      femaleCount: Math.max(0, Number(femaleCount) || 0),
      pwdCount: Math.max(0, Number(pwdCount) || 0),
      submitForReview,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save(false);
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Modal.Body>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <FacultySelectField value={facultyName} onChange={setFacultyName} disabled={saving} />
        <Form.Group className="mb-3">
          <Form.Label className="fw-bold small">Course unit</Form.Label>
          <Form.Control value={courseUnitName} onChange={(e) => setCourseUnitName(e.target.value)} required />
        </Form.Group>
        <div className="row g-3">
          <div className="col-6 col-md-3">
            <Form.Label className="fw-bold small">Total students</Form.Label>
            <Form.Control type="number" min={0} value={totalStudents} onChange={(e) => setTotalStudents(e.target.value)} required />
          </div>
          <div className="col-6 col-md-3">
            <Form.Label className="fw-bold small">Male</Form.Label>
            <Form.Control type="number" min={0} value={maleCount} onChange={(e) => setMaleCount(e.target.value)} required />
          </div>
          <div className="col-6 col-md-3">
            <Form.Label className="fw-bold small">Female</Form.Label>
            <Form.Control type="number" min={0} value={femaleCount} onChange={(e) => setFemaleCount(e.target.value)} required />
          </div>
          <div className="col-6 col-md-3">
            <Form.Label className="fw-bold small">PwD</Form.Label>
            <Form.Control type="number" min={0} value={pwdCount} onChange={(e) => setPwdCount(e.target.value)} required />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="outline-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save draft'}
        </Button>
        <Button type="button" variant="primary" disabled={saving} style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }} onClick={() => save(true)}>
          Submit for HOD review
        </Button>
      </Modal.Footer>
    </Form>
  );
}

export default function CourseUnitEnrollmentEntryModal({
  show,
  mode,
  record,
  saving,
  error,
  onHide,
  onSave,
}: CourseUnitEnrollmentEntryModalProps) {
  const formKey = mode === 'edit' && record ? `edit-${record.id}` : 'create';

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton className="modal-header-mubs">
        <Modal.Title className="fw-bold">
          {mode === 'create' ? 'Add course unit enrollment' : 'Edit course unit enrollment'}
        </Modal.Title>
      </Modal.Header>
      {show ? (
        <CourseUnitEnrollmentForm
          key={formKey}
          mode={mode}
          record={record}
          saving={saving}
          error={error}
          onHide={onHide}
          onSave={onSave}
        />
      ) : null}
    </Modal>
  );
}
