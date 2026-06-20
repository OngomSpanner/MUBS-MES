'use client';

import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

export type WorkforceRecord = {
  id: number;
  assessmentDetail: string;
  financialYearKey: string;
  financialYearLabel: string;
  countValue: number;
};

type WorkforceEntryModalProps = {
  show: boolean;
  mode: 'create' | 'edit';
  record: WorkforceRecord | null;
  years: { key: string; label: string }[];
  saving: boolean;
  error: string | null;
  onHide: () => void;
  onSave: (payload: { assessmentDetail: string; financialYearKey: string; countValue: number; submitForReview?: boolean }) => void;
};

function workforceFormDefaults(
  mode: 'create' | 'edit',
  record: WorkforceRecord | null,
  years: { key: string; label: string }[]
) {
  if (record && mode === 'edit') {
    return {
      assessmentDetail: record.assessmentDetail,
      financialYearKey: record.financialYearKey,
      countValue: String(record.countValue),
    };
  }
  return {
    assessmentDetail: '',
    financialYearKey: years[years.length - 1]?.key ?? '',
    countValue: '0',
  };
}

function WorkforceEntryForm({
  mode,
  record,
  years,
  saving,
  error,
  onHide,
  onSave,
}: Omit<WorkforceEntryModalProps, 'show'>) {
  const defaults = workforceFormDefaults(mode, record, years);
  const [assessmentDetail, setAssessmentDetail] = useState(defaults.assessmentDetail);
  const [financialYearKey, setFinancialYearKey] = useState(defaults.financialYearKey);
  const [countValue, setCountValue] = useState(defaults.countValue);

  const save = (submitForReview: boolean) => {
    if (!assessmentDetail.trim() || !financialYearKey) return;
    onSave({
      assessmentDetail: assessmentDetail.trim(),
      financialYearKey,
      countValue: Math.max(0, Number(countValue) || 0),
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
        <Form.Group className="mb-3">
          <Form.Label className="fw-bold small">Assessment details</Form.Label>
          <Form.Control
            value={assessmentDetail}
            onChange={(e) => setAssessmentDetail(e.target.value)}
            placeholder="e.g. Performance review completed"
            required
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="fw-bold small">Financial year</Form.Label>
          <Form.Select value={financialYearKey} onChange={(e) => setFinancialYearKey(e.target.value)} required>
            {years.map((y) => (
              <option key={y.key} value={y.key}>
                {y.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="fw-bold small">Count</Form.Label>
          <Form.Control
            type="number"
            min={0}
            value={countValue}
            onChange={(e) => setCountValue(e.target.value)}
            required
          />
        </Form.Group>
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

export default function WorkforceEntryModal({
  show,
  mode,
  record,
  years,
  saving,
  error,
  onHide,
  onSave,
}: WorkforceEntryModalProps) {
  const formKey = mode === 'edit' && record ? `edit-${record.id}` : `create-${years.length}`;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="modal-header-mubs">
        <Modal.Title className="fw-bold">
          {mode === 'create' ? 'Add workforce assessment' : 'Edit workforce assessment'}
        </Modal.Title>
      </Modal.Header>
      {show ? (
        <WorkforceEntryForm
          key={formKey}
          mode={mode}
          record={record}
          years={years}
          saving={saving}
          error={error}
          onHide={onHide}
          onSave={onSave}
        />
      ) : null}
    </Modal>
  );
}
