'use client';

import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

export type BenefitRecord = {
  id: number;
  userId: number;
  staffName: string;
  departmentName: string;
  financialYearKey: string;
  financialYearLabel: string;
  benefitType: string;
  benefitLabel: string;
  received: boolean;
};

export type ReportMeta = {
  years: { key: string; label: string }[];
  benefitTypes: { value: string; label: string }[];
  staff: { id: number; fullName: string; department: string }[];
};

type BenefitEntryModalProps = {
  show: boolean;
  mode: 'create' | 'edit';
  record: BenefitRecord | null;
  meta: ReportMeta | null;
  saving: boolean;
  error: string | null;
  onHide: () => void;
  onSave: (payload: {
    userId: number;
    financialYearKey: string;
    benefitType: string;
    received: boolean;
  }) => void;
};

function benefitFormDefaults(
  mode: 'create' | 'edit',
  record: BenefitRecord | null,
  meta: ReportMeta | null
) {
  if (record && mode === 'edit') {
    return {
      userId: String(record.userId),
      financialYearKey: record.financialYearKey,
      benefitType: record.benefitType,
      received: record.received,
    };
  }
  return {
    userId: '',
    financialYearKey: meta?.years[meta.years.length - 1]?.key ?? '',
    benefitType: meta?.benefitTypes[0]?.value ?? '',
    received: true,
  };
}

function BenefitEntryForm({
  mode,
  record,
  meta,
  saving,
  error,
  onHide,
  onSave,
}: Omit<BenefitEntryModalProps, 'show'>) {
  const defaults = benefitFormDefaults(mode, record, meta);
  const [userId, setUserId] = useState(defaults.userId);
  const [financialYearKey, setFinancialYearKey] = useState(defaults.financialYearKey);
  const [benefitType, setBenefitType] = useState(defaults.benefitType);
  const [received, setReceived] = useState(defaults.received);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !financialYearKey || !benefitType) return;
    onSave({
      userId: Number(userId),
      financialYearKey,
      benefitType,
      received,
    });
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Modal.Body>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <Form.Group className="mb-3">
          <Form.Label className="fw-bold small">Staff member</Form.Label>
          <Form.Select value={userId} onChange={(e) => setUserId(e.target.value)} required>
            <option value="">Select staff…</option>
            {(meta?.staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} — {s.department}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="fw-bold small">Financial year</Form.Label>
          <Form.Select value={financialYearKey} onChange={(e) => setFinancialYearKey(e.target.value)} required>
            {(meta?.years ?? []).map((y) => (
              <option key={y.key} value={y.key}>
                {y.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="fw-bold small">Benefit type</Form.Label>
          <Form.Select value={benefitType} onChange={(e) => setBenefitType(e.target.value)} required>
            {(meta?.benefitTypes ?? []).map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Check
          type="checkbox"
          id="benefit-received"
          label="Benefit received"
          checked={received}
          onChange={(e) => setReceived(e.target.checked)}
        />
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

export default function BenefitEntryModal({
  show,
  mode,
  record,
  meta,
  saving,
  error,
  onHide,
  onSave,
}: BenefitEntryModalProps) {
  const formKey =
    mode === 'edit' && record ? `edit-${record.id}` : `create-${meta?.years.length ?? 0}`;

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton className="modal-header-mubs">
        <Modal.Title className="fw-bold">
          {mode === 'create' ? 'Add staff benefit entry' : 'Edit staff benefit entry'}
        </Modal.Title>
      </Modal.Header>
      {show ? (
        <BenefitEntryForm
          key={formKey}
          mode={mode}
          record={record}
          meta={meta}
          saving={saving}
          error={error}
          onHide={onHide}
          onSave={onSave}
        />
      ) : null}
    </Modal>
  );
}
