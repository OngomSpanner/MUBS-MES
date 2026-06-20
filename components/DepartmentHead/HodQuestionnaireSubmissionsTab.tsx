'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Badge, Button, Form, Modal } from 'react-bootstrap';
import { HOD_REVIEW_STATUS_LABELS, type HodReviewStatus } from '@/lib/hod-review-workflow-constants';

type Submission = {
  indicator_id: number;
  department_id: number;
  hod_review_status: HodReviewStatus;
  submitted_at: string | null;
  indicator_text: string;
  outcome_type: string;
  outcome_label: string;
  department_name: string;
  submitted_by_name: string | null;
};

function statusBadge(status: HodReviewStatus) {
  switch (status) {
    case 'submitted':
      return 'warning';
    case 'approved':
      return 'success';
    case 'returned':
      return 'danger';
    default:
      return 'secondary';
  }
}

export default function HodQuestionnaireSubmissionsTab() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/department-head/questionnaire-submissions');
      setRows(res.data.submissions ?? []);
    } catch {
      setError('Failed to load performance indicator submissions.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (action: 'approve' | 'return') => {
    if (!selected) return;
    if (action === 'return' && !comment.trim()) {
      alert('Comment required when returning.');
      return;
    }
    setActing(true);
    try {
      await axios.patch('/api/department-head/questionnaire-submissions', {
        indicatorId: selected.indicator_id,
        departmentId: selected.department_id,
        action,
        comment: comment.trim(),
      });
      setSelected(null);
      setComment('');
      await load();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : 'Review failed';
      alert(String(msg ?? 'Review failed'));
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th className="small">Indicator</th>
              <th className="small">Outcome / output</th>
              <th className="small">Department</th>
              <th className="small">Submitted</th>
              <th className="small">Status</th>
              <th className="small text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4 small">
                  No performance indicator submissions yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.indicator_id}-${r.department_id}`}>
                  <td className="small fw-semibold">{r.indicator_text}</td>
                  <td className="small text-muted">
                    {r.outcome_type}: {r.outcome_label}
                  </td>
                  <td className="small">{r.department_name}</td>
                  <td className="small text-muted">
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                  </td>
                  <td>
                    <Badge bg={statusBadge(r.hod_review_status)} style={{ fontSize: '0.65rem' }}>
                      {HOD_REVIEW_STATUS_LABELS[r.hod_review_status]}
                    </Badge>
                  </td>
                  <td className="text-end">
                    {r.hod_review_status === 'submitted' ? (
                      <Button size="sm" variant="outline-primary" onClick={() => { setSelected(r); setComment(''); }}>
                        Review
                      </Button>
                    ) : (
                      <span className="text-muted small">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal show={selected != null} onHide={() => !acting && setSelected(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">Review performance indicator</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selected ? (
            <>
              <p className="small mb-2">
                <strong>{selected.indicator_text}</strong>
              </p>
              <p className="small text-muted mb-3">
                {selected.department_name} · submitted by {selected.submitted_by_name || 'Ambassador'}
              </p>
              <Form.Group>
                <Form.Label className="small fw-semibold">Comment (required if returning)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={acting}
                />
              </Form.Group>
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setSelected(null)} disabled={acting}>
            Cancel
          </Button>
          <Button variant="outline-danger" disabled={acting} onClick={() => void review('return')}>
            Return
          </Button>
          <Button variant="primary" disabled={acting} onClick={() => void review('approve')}>
            Approve
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
