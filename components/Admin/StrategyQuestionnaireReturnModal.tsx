'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Badge, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { HOD_REVIEW_STATUS_LABELS, type HodReviewStatus } from '@/lib/hod-review-workflow-constants';
import type { AssignmentRow } from '@/lib/admin/ambassador-reports-aggregate';

type ReturnTarget = 'ambassador' | 'hod';

type SubmissionDetail = {
  metrics: { id: number; metric_text: string; unit_of_measure: string; sort_order: number }[];
  financial_years: string[];
  responses: { metric_id: number; financial_year: string; value: string | null }[];
  hod_review_status: HodReviewStatus | null;
  hod_review_comment: string | null;
  admin_review_comment: string | null;
};

type Props = {
  assignment: AssignmentRow | null;
  onHide: () => void;
  onReturned: () => void;
};

export default function StrategyQuestionnaireReturnModal({ assignment, onHide, onReturned }: Props) {
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [returnTarget, setReturnTarget] = useState<ReturnTarget>('ambassador');
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!assignment) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await axios.get('/api/admin/questionnaire/submissions', {
        params: {
          indicatorId: assignment.indicatorId,
          departmentId: assignment.departmentId,
        },
      });
      setDetail(res.data);
    } catch (e: unknown) {
      setDetailError(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Failed to load submission' : 'Failed to load');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [assignment]);

  useEffect(() => {
    if (!assignment) {
      setDetail(null);
      setComment('');
      setReturnTarget('ambassador');
      setErr(null);
      return;
    }
    void loadDetail();
  }, [assignment, loadDetail]);

  const handleReturn = async () => {
    if (!assignment) return;
    if (!comment.trim()) {
      setErr('Feedback comment is required');
      return;
    }
    setActing(true);
    setErr(null);
    try {
      const action = returnTarget === 'ambassador' ? 'return_to_ambassador' : 'return_to_hod';
      await axios.patch('/api/admin/questionnaire/submissions', {
        indicatorId: assignment.indicatorId,
        departmentId: assignment.departmentId,
        action,
        comment: comment.trim(),
      });
      onReturned();
      onHide();
    } catch (e: unknown) {
      setErr(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Failed to return submission' : 'Failed to return');
    } finally {
      setActing(false);
    }
  };

  const canReturn = assignment?.hodReviewStatus === 'approved' || assignment?.hodReviewStatus === 'submitted';

  return (
    <Modal show={!!assignment} onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title className="fs-6">Return performance indicator</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {assignment ? (
          <>
            <p className="small mb-2"><strong>{assignment.indicatorText}</strong></p>
            <p className="small text-muted mb-3">
              {assignment.departmentName}
              {assignment.ambassadorName ? ` · ${assignment.ambassadorName}` : ''}
            </p>

            {assignment.hodReviewStatus ? (
              <div className="mb-3">
                <Badge bg={assignment.hodReviewStatus === 'approved' ? 'success' : 'warning'} className="text-dark">
                  {HOD_REVIEW_STATUS_LABELS[assignment.hodReviewStatus]}
                </Badge>
              </div>
            ) : null}

            {detailLoading ? (
              <div className="text-center py-4">
                <Spinner animation="border" size="sm" className="text-primary" />
              </div>
            ) : detailError ? (
              <div className="alert alert-danger py-2 small">{detailError}</div>
            ) : detail?.financial_years.length ? (
              <div className="table-responsive mb-3">
                <table className="table table-sm table-bordered mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Metric</th>
                      {detail.financial_years.map((fy) => (
                        <th key={fy} className="text-center small">{fy}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.metrics.map((m) => (
                      <tr key={m.id}>
                        <td className="small">{m.metric_text}</td>
                        {detail.financial_years.map((fy) => {
                          const val = detail.responses.find((r) => r.metric_id === m.id && r.financial_year === fy)?.value;
                          return (
                            <td key={fy} className="text-center small">{val?.trim() ? val : '—'}</td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {!canReturn ? (
              <div className="alert alert-warning py-2 small mb-0">
                Only approved or HOD-submitted items can be returned by Strategy.
              </div>
            ) : (
              <>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-semibold">Return to</Form.Label>
                  <div className="d-flex flex-column gap-2">
                    <Form.Check
                      type="radio"
                      id="return-ambassador"
                      name="returnTarget"
                      label="Ambassador — for data corrections and resubmission"
                      checked={returnTarget === 'ambassador'}
                      onChange={() => setReturnTarget('ambassador')}
                      disabled={acting}
                    />
                    <Form.Check
                      type="radio"
                      id="return-hod"
                      name="returnTarget"
                      label="Head of Department — for HOD to review again before resubmitting"
                      checked={returnTarget === 'hod'}
                      onChange={() => setReturnTarget('hod')}
                      disabled={acting}
                    />
                  </div>
                </Form.Group>

                <Form.Group>
                  <Form.Label className="small fw-semibold">
                    Feedback for {returnTarget === 'ambassador' ? 'ambassador' : 'Head of Department'} <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={acting}
                    placeholder="Explain what needs to be corrected or reviewed…"
                  />
                </Form.Group>
              </>
            )}

            {err ? <div className="alert alert-danger py-2 small mt-3 mb-0">{err}</div> : null}
          </>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onHide} disabled={acting}>Cancel</Button>
        {canReturn ? (
          <Button variant="warning" onClick={() => void handleReturn()} disabled={acting || detailLoading}>
            {acting ? 'Returning…' : returnTarget === 'ambassador' ? 'Return to ambassador' : 'Return to HOD'}
          </Button>
        ) : null}
      </Modal.Footer>
    </Modal>
  );
}
