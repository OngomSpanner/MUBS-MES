'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import axios from 'axios';
import { PRACTICE_TYPE_LABELS, type PracticeType } from '@/lib/results-framework';
import type { ResultsFrameworkIndicatorRow } from './ResultsFrameworkTable';

type Props = {
  show: boolean;
  row: ResultsFrameworkIndicatorRow | null;
  financialYear: string;
  onHide: () => void;
  onSaved: () => void;
};

export default function RfNarrativeModal({ show, row, financialYear, onHide, onSaved }: Props) {
  const [outcomeReason, setOutcomeReason] = useState('');
  const [practiceType, setPracticeType] = useState<PracticeType | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show && row) {
      setOutcomeReason(row.outcomeReason && row.narrativeSource === 'ambassador' ? row.outcomeReason : '');
      setPracticeType(row.practiceType && row.narrativeSource === 'ambassador' ? row.practiceType : '');
      setError('');
    }
  }, [show, row]);

  const needsPracticeType =
    row?.performanceStatus === 'achievement' || row?.performanceStatus === 'overachievement';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!row) return;
    setSubmitting(true);
    setError('');
    try {
      await axios.post('/api/ambassador/results-framework/narratives', {
        activityId: row.id,
        financialYear,
        outcomeReason,
        practiceType: needsPracticeType ? practiceType : null,
      });
      onSaved();
      onHide();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to save narrative.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={() => !submitting && onHide()} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title className="fw-bold" style={{ fontSize: '1rem' }}>
          Record Results Framework outcome
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          {row ? (
            <>
              <p className="small text-muted mb-3">
                <strong>{row.title}</strong>
                {row.performanceStatus ? (
                  <> · Status: <span className="text-dark">{row.performanceStatusLabel}</span></>
                ) : null}
              </p>
              {error ? <div className="alert alert-danger py-2 small">{error}</div> : null}
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">Explain the outcome</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={outcomeReason}
                  onChange={(e) => setOutcomeReason(e.target.value)}
                  placeholder="Why was performance below, at, or above target?"
                  required
                />
              </Form.Group>
              {needsPracticeType ? (
                <Form.Group>
                  <Form.Label className="fw-semibold small">Performance source</Form.Label>
                  <Form.Select
                    value={practiceType}
                    onChange={(e) => setPracticeType(e.target.value as PracticeType | '')}
                    required
                  >
                    <option value="">Select…</option>
                    {(Object.entries(PRACTICE_TYPE_LABELS) as [PracticeType, string][]).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              ) : null}
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || !row}>
            {submitting ? 'Saving…' : 'Save narrative'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
