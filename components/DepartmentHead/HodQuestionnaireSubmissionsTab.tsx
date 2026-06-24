'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Badge, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { uomLabel } from '@/lib/questionnaire/uom';
import { HOD_REVIEW_STATUS_LABELS, HOD_UNIT_HEAD_LABEL, type HodReviewStatus } from '@/lib/hod-review-workflow-constants';

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

type Metric = { id: number; metric_text: string; unit_of_measure: string; sort_order: number };

type SubmissionDetail = {
  metrics: Metric[];
  financial_years: string[];
  responses: { metric_id: number; financial_year: string; value: string | null }[];
  hod_review_status: HodReviewStatus | null;
  hod_review_comment: string | null;
  hod_reviewed_at: string | null;
  reviewed_by_name: string | null;
};

function statusBadge(status: HodReviewStatus) {
  switch (status) {
    case 'submitted':
      return 'warning';
    case 'approved':
      return 'success';
    case 'returned':
      return 'warning';
    default:
      return 'secondary';
  }
}

function responseValue(
  responses: SubmissionDetail['responses'],
  metricId: number,
  fy: string,
): string | null {
  const row = responses.find((r) => r.metric_id === metricId && r.financial_year === fy);
  const v = row?.value;
  return v != null && String(v).trim() !== '' ? String(v) : null;
}

function SubmissionDataTable({ detail }: { detail: SubmissionDetail }) {
  if (detail.metrics.length === 0) {
    return <div className="alert alert-warning py-2 small mb-0">No metric data submitted yet.</div>;
  }

  return (
    <div className="table-responsive">
      <table className="table table-bordered table-sm mb-0" style={{ fontSize: '0.8rem' }}>
        <thead className="table-dark">
          <tr>
            <th style={{ minWidth: '220px' }}>Performance Metric</th>
            <th style={{ width: '110px' }}>Unit of Measure</th>
            {detail.financial_years.map((fy) => (
              <th key={fy} className="text-center" style={{ minWidth: '120px' }}>{fy}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {detail.metrics.map((m, mi) => (
            <tr key={m.id}>
              <td className="align-middle">
                <span className="fw-semibold me-2" style={{ color: 'var(--mubs-gold, #C8922A)' }}>{mi + 1}.</span>
                {m.metric_text}
              </td>
              <td className="align-middle">
                <Badge bg="light" className="text-dark border" style={{ fontSize: '0.62rem' }}>
                  {uomLabel(m.unit_of_measure)}
                </Badge>
              </td>
              {detail.financial_years.map((fy) => {
                const val = responseValue(detail.responses, m.id, fy);
                return (
                  <td
                    key={fy}
                    className={`align-middle text-center ${val ? 'fw-semibold' : 'text-muted'}`}
                    style={{ fontSize: '0.78rem', fontStyle: val ? 'normal' : 'italic' }}
                  >
                    {val ?? '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HodQuestionnaireSubmissionsTab() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
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

  const openSubmission = async (submission: Submission, readOnly: boolean) => {
    setSelected(submission);
    setViewOnly(readOnly);
    setComment('');
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await axios.get('/api/department-head/questionnaire-submissions', {
        params: {
          indicatorId: submission.indicator_id,
          departmentId: submission.department_id,
        },
      });
      setDetail({
        metrics: res.data.metrics ?? [],
        financial_years: res.data.financial_years ?? [],
        responses: res.data.responses ?? [],
        hod_review_status: res.data.hod_review_status ?? submission.hod_review_status,
        hod_review_comment: res.data.hod_review_comment ?? null,
        hod_reviewed_at: res.data.hod_reviewed_at ?? null,
        reviewed_by_name: res.data.reviewed_by_name ?? null,
      });
    } catch {
      setDetailError('Failed to load submitted data.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    if (acting) return;
    setSelected(null);
    setViewOnly(false);
    setDetail(null);
    setDetailError(null);
    setComment('');
  };

  const review = async (action: 'approve' | 'return') => {
    if (!selected) return;
    if (action === 'return' && !comment.trim()) {
      alert('Feedback is required when requesting revision.');
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
      closeModal();
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
                    <Badge
                      bg={statusBadge(r.hod_review_status)}
                      className={r.hod_review_status === 'submitted' || r.hod_review_status === 'returned' ? 'text-dark' : ''}
                      style={{ fontSize: '0.65rem' }}
                    >
                      {HOD_REVIEW_STATUS_LABELS[r.hod_review_status]}
                    </Badge>
                  </td>
                  <td className="text-end">
                    {r.hod_review_status === 'submitted' ? (
                      <Button size="sm" variant="outline-primary" onClick={() => void openSubmission(r, false)}>
                        Review
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline-secondary" onClick={() => void openSubmission(r, true)}>
                        View
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal show={selected != null} onHide={closeModal} size="xl" scrollable centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">
            {viewOnly ? 'Performance indicator submission' : 'Review performance indicator'}
          </Modal.Title>
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

              {detail?.hod_review_status && detail.hod_review_status !== 'draft' ? (
                <div className="mb-3 d-flex flex-wrap gap-2 align-items-center">
                  <Badge
                    bg={statusBadge(detail.hod_review_status)}
                    className={detail.hod_review_status === 'submitted' || detail.hod_review_status === 'returned' ? 'text-dark' : ''}
                    style={{ fontSize: '0.65rem' }}
                  >
                    {HOD_REVIEW_STATUS_LABELS[detail.hod_review_status]}
                  </Badge>
                  {detail.hod_reviewed_at ? (
                    <span className="text-muted small">
                      Reviewed {new Date(detail.hod_reviewed_at).toLocaleString()}
                      {detail.reviewed_by_name ? ` by ${detail.reviewed_by_name}` : ''}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {detail?.hod_review_comment?.trim() ? (
                <div className={`alert small py-2 mb-3 ${detail.hod_review_status === 'returned' ? 'alert-warning' : 'alert-light border'}`}>
                  <span className="fw-semibold d-block mb-1">
                    {detail.hod_review_status === 'returned' ? `${HOD_UNIT_HEAD_LABEL} feedback` : 'Review comment'}
                  </span>
                  {detail.hod_review_comment}
                </div>
              ) : null}

              <div className="text-muted fw-bold text-uppercase mb-2" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                Submitted data
              </div>

              {detailLoading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" size="sm" className="text-primary" />
                </div>
              ) : detailError ? (
                <div className="alert alert-danger py-2 small mb-3">{detailError}</div>
              ) : detail ? (
                <div className="mb-4">
                  <SubmissionDataTable detail={detail} />
                </div>
              ) : null}

              {!viewOnly ? (
                <Form.Group>
                  <Form.Label className="small fw-semibold">Feedback (required when requesting revision)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={acting}
                    placeholder="Optional for approval. Required if you request revision."
                  />
                </Form.Group>
              ) : null}
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={closeModal} disabled={acting}>
            Close
          </Button>
          {!viewOnly ? (
            <>
              <Button variant="outline-warning" disabled={acting || detailLoading} onClick={() => void review('return')}>
                Request revision
              </Button>
              <Button variant="primary" disabled={acting || detailLoading} onClick={() => void review('approve')}>
                Approve
              </Button>
            </>
          ) : null}
        </Modal.Footer>
      </Modal>
    </div>
  );
}
