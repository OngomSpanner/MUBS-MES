'use client';

import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import type { ProgrammeEnrollmentRecord } from '@/lib/ambassador/enrollment-records';

export type { ProgrammeEnrollmentRecord };

type ProgrammeEnrollmentEntryModalProps = {
  show: boolean;
  mode: 'create' | 'edit';
  record: ProgrammeEnrollmentRecord | null;
  saving: boolean;
  error: string | null;
  onHide: () => void;
  onSave: (payload: {
    programmeName: string;
    totalStudents: number;
    maleCount: number;
    femaleCount: number;
    pwdCount: number;
    pwdDetails: string | null;
  }) => void;
};

function formDefaults(mode: 'create' | 'edit', record: ProgrammeEnrollmentRecord | null) {
  if (record && mode === 'edit') {
    return {
      programmeName: record.programmeName,
      totalStudents: String(record.totalStudents),
      maleCount: String(record.maleCount),
      femaleCount: String(record.femaleCount),
      pwdCount: String(record.pwdCount),
      pwdDetails: record.pwdDetails ?? '',
    };
  }
  return {
    programmeName: '',
    totalStudents: '0',
    maleCount: '0',
    femaleCount: '0',
    pwdCount: '0',
    pwdDetails: '',
  };
}

function ProgrammeEnrollmentForm({
  mode,
  record,
  saving,
  error,
  onHide,
  onSave,
}: Omit<ProgrammeEnrollmentEntryModalProps, 'show'>) {
  const defaults = formDefaults(mode, record);
  const [programmeName, setProgrammeName] = useState(defaults.programmeName);
  const [totalStudents, setTotalStudents] = useState(defaults.totalStudents);
  const [maleCount, setMaleCount] = useState(defaults.maleCount);
  const [femaleCount, setFemaleCount] = useState(defaults.femaleCount);
  const [pwdCount, setPwdCount] = useState(defaults.pwdCount);
  const [pwdDetails, setPwdDetails] = useState(defaults.pwdDetails);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!programmeName.trim()) return;
    onSave({
      programmeName: programmeName.trim(),
      totalStudents: Math.max(0, Number(totalStudents) || 0),
      maleCount: Math.max(0, Number(maleCount) || 0),
      femaleCount: Math.max(0, Number(femaleCount) || 0),
      pwdCount: Math.max(0, Number(pwdCount) || 0),
      pwdDetails: pwdDetails.trim() || null,
    });
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Modal.Body>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <Form.Group className="mb-3">
          <Form.Label className="fw-bold small">Programme name</Form.Label>
          <Form.Control value={programmeName} onChange={(e) => setProgrammeName(e.target.value)} required />
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
        <Form.Group className="mb-0 mt-3">
          <Form.Label className="fw-bold small">PwD details (optional)</Form.Label>
          <Form.Control as="textarea" rows={2} value={pwdDetails} onChange={(e) => setPwdDetails(e.target.value)} />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving} style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Modal.Footer>
    </Form>
  );
}

export default function ProgrammeEnrollmentEntryModal({
  show,
  mode,
  record,
  saving,
  error,
  onHide,
  onSave,
}: ProgrammeEnrollmentEntryModalProps) {
  const formKey = mode === 'edit' && record ? `edit-${record.id}` : 'create';

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton className="modal-header-mubs">
        <Modal.Title className="fw-bold">
          {mode === 'create' ? 'Add programme enrollment' : 'Edit programme enrollment'}
        </Modal.Title>
      </Modal.Header>
      {show ? (
        <ProgrammeEnrollmentForm
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
