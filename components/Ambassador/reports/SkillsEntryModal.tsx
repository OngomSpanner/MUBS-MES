'use client';

import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

export type SkillsRecord = {
  id: number;
  financialYearKey: string;
  financialYearLabel: string;
  reportsProduced: number;
  skillsMissing: number;
};

type SkillsEntryModalProps = {
  show: boolean;
  mode: 'create' | 'edit';
  record: SkillsRecord | null;
  years: { key: string; label: string }[];
  saving: boolean;
  error: string | null;
  onHide: () => void;
  onSave: (payload: {
    financialYearKey: string;
    reportsProduced: number;
    skillsMissing: number;
    submitForReview?: boolean;
  }) => void;
};

function skillsFormDefaults(
  mode: 'create' | 'edit',
  record: SkillsRecord | null,
  years: { key: string; label: string }[]
) {
  if (record && mode === 'edit') {
    return {
      financialYearKey: record.financialYearKey,
      reportsProduced: String(record.reportsProduced),
      skillsMissing: String(record.skillsMissing),
    };
  }
  return {
    financialYearKey: years[years.length - 1]?.key ?? '',
    reportsProduced: '0',
    skillsMissing: '0',
  };
}

function SkillsEntryForm({
  mode,
  record,
  years,
  saving,
  error,
  onHide,
  onSave,
}: Omit<SkillsEntryModalProps, 'show'>) {
  const defaults = skillsFormDefaults(mode, record, years);
  const [financialYearKey, setFinancialYearKey] = useState(defaults.financialYearKey);
  const [reportsProduced, setReportsProduced] = useState(defaults.reportsProduced);
  const [skillsMissing, setSkillsMissing] = useState(defaults.skillsMissing);

  const save = (submitForReview: boolean) => {
    if (!financialYearKey) return;
    onSave({
      financialYearKey,
      reportsProduced: Math.max(0, Number(reportsProduced) || 0),
      skillsMissing: Math.max(0, Number(skillsMissing) || 0),
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
          <Form.Label className="fw-bold small">Reports produced</Form.Label>
          <Form.Control
            type="number"
            min={0}
            value={reportsProduced}
            onChange={(e) => setReportsProduced(e.target.value)}
            required
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="fw-bold small">Skills missing</Form.Label>
          <Form.Control
            type="number"
            min={0}
            value={skillsMissing}
            onChange={(e) => setSkillsMissing(e.target.value)}
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

export default function SkillsEntryModal({
  show,
  mode,
  record,
  years,
  saving,
  error,
  onHide,
  onSave,
}: SkillsEntryModalProps) {
  const formKey = mode === 'edit' && record ? `edit-${record.id}` : `create-${years.length}`;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="modal-header-mubs">
        <Modal.Title className="fw-bold">
          {mode === 'create' ? 'Add skills assessment' : 'Edit skills assessment'}
        </Modal.Title>
      </Modal.Header>
      {show ? (
        <SkillsEntryForm
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
