'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Badge, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { normalizeFinancialYear, fyShortLabel } from '@/lib/questionnaire/fy-utils';
import { METRIC_ENTRY_TABLE, uomTableLabel } from '@/lib/questionnaire/metric-entry-table-layout';
import { HOD_REVIEW_STATUS_LABELS, HOD_UNIT_HEAD_LABEL, type HodReviewStatus } from '@/lib/hod-review-workflow-constants';
import { IndicatorFyTargetGroup, type IndicatorTarget } from '@/components/Questionnaire/IndicatorTargetUI';

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
  filled: number;
  total: number;
};

type SubmissionFilter = 'all' | 'not-completed' | 'awaiting-review' | 'completed' | 'needs-revision';

const FILTER_TABS: { key: SubmissionFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'not-completed', label: 'Not completed' },
  { key: 'awaiting-review', label: 'Awaiting review' },
  { key: 'completed', label: 'Completed' },
  { key: 'needs-revision', label: 'Needs revision' },
];

type Metric = { id: number; metric_text: string; unit_of_measure: string; sort_order: number };

type SubmissionDetail = {
  metrics: Metric[];
  financial_years: string[];
  responses: { metric_id: number; financial_year: string; value: string | null }[];
  metric_comments?: { metric_id: number; comment: string | null }[];
  targets?: IndicatorTarget[];
  hod_review_status: HodReviewStatus | null;
  hod_review_comment: string | null;
  hod_reviewed_at: string | null;
  reviewed_by_name: string | null;
};

type SelectionKey = string;

function submissionKey(r: Pick<Submission, 'indicator_id' | 'department_id'>): SelectionKey {
  return `${r.indicator_id}-${r.department_id}`;
}

function submissionCategory(row: Submission): Exclude<SubmissionFilter, 'all'> {
  const hod = row.hod_review_status ?? 'draft';
  if (hod === 'returned') return 'needs-revision';
  if (hod === 'submitted') return 'awaiting-review';
  if (hod === 'approved') return 'completed';
  return 'not-completed';
}

function matchesFilter(row: Submission, filter: SubmissionFilter): boolean {
  if (filter === 'all') return true;
  return submissionCategory(row) === filter;
}

function isBulkReviewEligible(row: Submission): boolean {
  return row.hod_review_status === 'submitted';
}

function listStatusLabel(status: HodReviewStatus): string {
  if (status === 'draft') return 'Not submitted';
  return HOD_REVIEW_STATUS_LABELS[status];
}

function statusBadge(status: HodReviewStatus) {
  switch (status) {
    case 'submitted':
      return 'warning';
    case 'approved':
      return 'success';
    case 'returned':
      return 'warning';
    case 'draft':
      return 'secondary';
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

function metricCommentValue(
  comments: SubmissionDetail['metric_comments'],
  metricId: number,
): string | null {
  const row = comments?.find((c) => c.metric_id === metricId);
  const v = row?.comment;
  return v != null && String(v).trim() !== '' ? String(v) : null;
}

function SubmissionDataTable({ detail }: { detail: SubmissionDetail }) {
  if (detail.metrics.length === 0) {
    return <div className="alert alert-warning py-2 small mb-0">No metric data submitted yet.</div>;
  }

  return (
    <div className="table-responsive">
      <table className="table table-bordered table-sm mb-0" style={METRIC_ENTRY_TABLE.table}>
        <colgroup>
          <col />
          <col style={METRIC_ENTRY_TABLE.col.unit} />
          {detail.financial_years.map((fy) => (
            <col key={`${fy}-actual`} style={METRIC_ENTRY_TABLE.col.actual} />
          ))}
          <col style={METRIC_ENTRY_TABLE.col.comment} />
        </colgroup>
        <thead className="table-dark">
          <tr>
            <th style={METRIC_ENTRY_TABLE.th.metric}>Performance Metric</th>
            <th className="text-center" style={METRIC_ENTRY_TABLE.th.unit}>UNIT</th>
            {detail.financial_years.map((fy) => (
              <th
                key={`${fy}-actual`}
                className="text-center"
                style={{ ...METRIC_ENTRY_TABLE.th.fy, ...METRIC_ENTRY_TABLE.th.actual }}
              >
                {fyShortLabel(fy)}
              </th>
            ))}
            <th style={METRIC_ENTRY_TABLE.th.comment}>Comment</th>
          </tr>
        </thead>
        <tbody>
          {detail.metrics.map((m, mi) => (
            <tr key={m.id}>
              <td className="align-middle">
                <span className="fw-semibold me-2" style={{ color: 'var(--mubs-gold, #C8922A)' }}>{mi + 1}.</span>
                {m.metric_text}
              </td>
              <td style={METRIC_ENTRY_TABLE.td.unit}>
                <Badge bg="light" className="text-dark border" style={METRIC_ENTRY_TABLE.td.badge}>
                  {uomTableLabel(m.unit_of_measure)}
                </Badge>
              </td>
              {detail.financial_years.map((fy) => {
                const val = responseValue(detail.responses, m.id, fy);
                return (
                  <td
                    key={`${fy}-actual`}
                    className={`${val ? 'fw-semibold' : 'text-muted'}`}
                    style={{
                      ...METRIC_ENTRY_TABLE.td.actual,
                      fontSize: '0.78rem',
                      fontStyle: val ? 'normal' : 'italic',
                      textAlign: 'center',
                      wordBreak: 'break-word',
                    }}
                  >
                    {val ?? '—'}
                  </td>
                );
              })}
              <td
                className={metricCommentValue(detail.metric_comments, m.id) ? '' : 'text-muted'}
                style={{
                  ...METRIC_ENTRY_TABLE.td.comment,
                  fontSize: '0.78rem',
                  fontStyle: metricCommentValue(detail.metric_comments, m.id) ? 'normal' : 'italic',
                  wordBreak: 'break-word',
                }}
              >
                {metricCommentValue(detail.metric_comments, m.id) ?? '—'}
              </td>
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
  const [activeFilter, setActiveFilter] = useState<SubmissionFilter>('all');
  const [selected, setSelected] = useState<Submission | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);

  const [selectedKeys, setSelectedKeys] = useState<Set<SelectionKey>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [showBulkReturnModal, setShowBulkReturnModal] = useState(false);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [bulkReturnComment, setBulkReturnComment] = useState('');

  const load = useCallback(async (): Promise<Submission[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/department-head/questionnaire-submissions');
      const list = (res.data.submissions ?? []) as Submission[];
      const mapped = list.map((r) => ({
        ...r,
        hod_review_status: (r.hod_review_status ?? 'draft') as HodReviewStatus,
        filled: Number(r.filled ?? 0),
        total: Number(r.total ?? 0),
      }));
      setRows(mapped);
      return mapped;
    } catch {
      setError('Failed to load performance indicator submissions.');
      setRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const tally = {
      all: rows.length,
      'not-completed': 0,
      'awaiting-review': 0,
      completed: 0,
      'needs-revision': 0,
    };
    for (const row of rows) {
      tally[submissionCategory(row)] += 1;
    }
    return tally;
  }, [rows]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesFilter(r, activeFilter)),
    [rows, activeFilter],
  );

  const bulkEligible = useMemo(
    () => rows.filter(isBulkReviewEligible),
    [rows],
  );

  const selectedEligibleCount = useMemo(
    () => bulkEligible.filter((r) => selectedKeys.has(submissionKey(r))).length,
    [bulkEligible, selectedKeys],
  );

  const allEligibleSelected = bulkEligible.length > 0
    && bulkEligible.every((r) => selectedKeys.has(submissionKey(r)));

  const modalNavList = useMemo(() => {
    if (viewOnly) return filteredRows;
    return filteredRows.filter((r) => r.hod_review_status === 'submitted');
  }, [filteredRows, viewOnly]);

  const modalNavIndex = selected
    ? modalNavList.findIndex(
      (r) => r.indicator_id === selected.indicator_id && r.department_id === selected.department_id,
    )
    : -1;

  const toggleSelect = (key: SelectionKey) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAllEligible = () => {
    if (allEligibleSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(bulkEligible.map(submissionKey)));
    }
  };

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
        metric_comments: res.data.metric_comments ?? [],
        targets: res.data.targets ?? [],
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

  const navigateModal = async (delta: number) => {
    if (modalNavIndex < 0 || acting || detailLoading) return;
    const next = modalNavList[modalNavIndex + delta];
    if (!next) return;
    const readOnly = viewOnly || next.hod_review_status !== 'submitted';
    await openSubmission(next, readOnly);
  };

  const review = async (action: 'approve' | 'return', advance = true) => {
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

      const nextIdx = modalNavIndex;
      const refreshed = await load();
      const navAfter = (viewOnly ? refreshed.filter((r) => matchesFilter(r, activeFilter)) : refreshed.filter((r) => matchesFilter(r, activeFilter) && r.hod_review_status === 'submitted'));

      if (advance && !viewOnly && navAfter.length > 0) {
        const next = navAfter[nextIdx] ?? navAfter[nextIdx - 1] ?? null;
        if (next) {
          await openSubmission(next, false);
          return;
        }
      }
      closeModal();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : 'Review failed';
      alert(String(msg ?? 'Review failed'));
    } finally {
      setActing(false);
    }
  };

  const runBulkReview = async (action: 'approve' | 'return', bulkComment = '') => {
    setBulkActing(true);
    setBulkMsg(null);
    try {
      const fresh = await load();
      const eligibleKeys = new Set(fresh.filter(isBulkReviewEligible).map(submissionKey));
      const items = [...selectedKeys]
        .filter((key) => eligibleKeys.has(key))
        .map((key) => {
          const [indicatorId, departmentId] = key.split('-').map(Number);
          return { indicatorId, departmentId };
        });

      if (!items.length) {
        setBulkMsg({
          type: 'danger',
          text: 'No eligible submissions selected. Only items awaiting review can be bulk-reviewed.',
        });
        return;
      }

      const res = await axios.patch('/api/department-head/questionnaire-submissions/bulk-review', {
        items,
        action,
        comment: bulkComment.trim(),
      });

      const skipped = Array.isArray(res.data?.skipped) ? res.data.skipped as { reason: string }[] : [];
      let text = res.data?.message ?? `Reviewed ${items.length} submission(s).`;
      if (skipped.length > 0) {
        text += ` Skipped: ${skipped.map((s) => s.reason).join('; ')}`;
      }
      setBulkMsg({ type: 'success', text });
      setSelectedKeys(new Set());
      setShowBulkReturnModal(false);
      setShowBulkApproveModal(false);
      setBulkReturnComment('');
      if (selected) closeModal();
      await load();
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        const data = e.response?.data as { message?: string; skipped?: { reason: string }[] } | undefined;
        let msg = data?.message ?? 'Bulk review failed';
        if (Array.isArray(data?.skipped) && data.skipped.length > 0) {
          msg += ` Details: ${data.skipped.map((s) => s.reason).join('; ')}`;
        }
        setBulkMsg({ type: 'danger', text: msg });
      } else {
        setBulkMsg({ type: 'danger', text: 'Bulk review failed. Check your connection and try again.' });
      }
    } finally {
      setBulkActing(false);
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
      {bulkMsg && <div className={`alert alert-${bulkMsg.type} py-2 small`}>{bulkMsg.text}</div>}

      <div className="d-flex flex-wrap gap-2 mb-3">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`btn btn-sm fw-semibold ${activeFilter === key ? 'btn-primary' : 'btn-outline-secondary'}`}
            style={activeFilter === key ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : { fontSize: '0.78rem' }}
            onClick={() => setActiveFilter(key)}
          >
            {label}
            <Badge
              bg={activeFilter === key ? 'light' : 'secondary'}
              className={`ms-2 ${activeFilter === key ? 'text-dark' : ''}`}
              style={{ fontSize: '0.62rem', verticalAlign: 'middle' }}
            >
              {counts[key]}
            </Badge>
          </button>
        ))}
      </div>

      {bulkEligible.length > 0 && (
        <div
          className="d-flex flex-wrap align-items-center gap-3 mb-3 p-3 rounded-3 border"
          style={{ background: '#f0f7ff', borderColor: '#bfdbfe' }}
        >
          <Form.Check
            type="checkbox"
            id="hod-select-all-awaiting"
            label={<span className="small fw-semibold">Select all awaiting review ({bulkEligible.length})</span>}
            checked={allEligibleSelected}
            onChange={toggleSelectAllEligible}
          />
          <Button
            size="sm"
            variant="primary"
            style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
            disabled={bulkActing || selectedEligibleCount === 0}
            onClick={() => setShowBulkApproveModal(true)}
          >
            <span className="material-symbols-outlined me-1" style={{ fontSize: '16px', verticalAlign: 'middle' }}>check_circle</span>
            {bulkActing ? 'Processing…' : `Approve selected (${selectedEligibleCount})`}
          </Button>
          <Button
            size="sm"
            variant="outline-warning"
            disabled={bulkActing || selectedEligibleCount === 0}
            onClick={() => setShowBulkReturnModal(true)}
          >
            <span className="material-symbols-outlined me-1" style={{ fontSize: '16px', verticalAlign: 'middle' }}>undo</span>
            Request revision for selected
          </Button>
        </div>
      )}

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              {bulkEligible.length > 0 && <th style={{ width: '36px' }} />}
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
                <td colSpan={bulkEligible.length > 0 ? 7 : 6} className="text-center text-muted py-4 small">
                  No performance indicators assigned to your departments yet.
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={bulkEligible.length > 0 ? 7 : 6} className="text-center text-muted py-4 small">
                  No submissions match this filter.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => {
                const key = submissionKey(r);
                const selectable = isBulkReviewEligible(r);
                return (
                  <tr key={key}>
                    {bulkEligible.length > 0 && (
                      <td>
                        {selectable ? (
                          <Form.Check
                            type="checkbox"
                            checked={selectedKeys.has(key)}
                            onChange={() => toggleSelect(key)}
                            aria-label={`Select ${r.indicator_text}`}
                          />
                        ) : null}
                      </td>
                    )}
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
                        {listStatusLabel(r.hod_review_status)}
                      </Badge>
                    </td>
                    <td className="text-end">
                      {r.hod_review_status === 'submitted' ? (
                        <Button size="sm" variant="outline-primary" onClick={() => void openSubmission(r, false)}>
                          Review
                        </Button>
                      ) : r.hod_review_status === 'draft' && r.filled === 0 ? (
                        <span className="text-muted small">—</span>
                      ) : (
                        <Button size="sm" variant="outline-secondary" onClick={() => void openSubmission(r, true)}>
                          View
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal show={selected != null} onHide={closeModal} size="xl" scrollable centered>
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #1e40af, var(--mubs-navy, #1a3a5c))', color: '#fff' }}>
          <Modal.Title className="fs-6 fw-bold">
            <span className="material-symbols-outlined me-2" style={{ fontSize: '18px', verticalAlign: 'middle' }}>fact_check</span>
            {viewOnly ? 'Performance indicator submission' : 'Review performance indicator'}
            {modalNavList.length > 1 && modalNavIndex >= 0 && (
              <span className="fw-normal ms-2 opacity-75" style={{ fontSize: '0.75rem' }}>
                ({modalNavIndex + 1} of {modalNavList.length})
              </span>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selected ? (
            <>
              <p className="small mb-2">
                <strong>{selected.indicator_text}</strong>
              </p>
              <p className="small text-muted mb-3">
                {selected.department_name}
                {selected.submitted_by_name ? ` · submitted by ${selected.submitted_by_name}` : ' · not yet submitted'}
              </p>

              {detail?.hod_review_status && detail.hod_review_status !== 'draft' ? (
                <div className="mb-3 d-flex flex-wrap gap-2 align-items-center">
                  <Badge
                    bg={statusBadge(detail.hod_review_status)}
                    className={detail.hod_review_status === 'submitted' || detail.hod_review_status === 'returned' ? 'text-dark' : ''}
                    style={{ fontSize: '0.65rem' }}
                  >
                    {listStatusLabel(detail.hod_review_status)}
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

              {detail && detail.financial_years.length > 0 ? (
                <div className="mb-2 d-flex flex-wrap gap-1">
                  <IndicatorFyTargetGroup
                    financialYears={detail.financial_years}
                    targets={detail.targets}
                  />
                </div>
              ) : null}

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
        <Modal.Footer className="gap-2 flex-wrap">
          <Button variant="light" onClick={closeModal} disabled={acting}>
            Close
          </Button>
          {modalNavList.length > 1 && (
            <>
              <Button
                size="sm"
                variant="outline-primary"
                disabled={modalNavIndex <= 0 || acting || detailLoading}
                onClick={() => void navigateModal(-1)}
              >
                <span className="material-symbols-outlined me-1" style={{ fontSize: '14px', verticalAlign: 'middle' }}>chevron_left</span>
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline-primary"
                disabled={modalNavIndex < 0 || modalNavIndex >= modalNavList.length - 1 || acting || detailLoading}
                onClick={() => void navigateModal(1)}
              >
                Next
                <span className="material-symbols-outlined ms-1" style={{ fontSize: '14px', verticalAlign: 'middle' }}>chevron_right</span>
              </Button>
            </>
          )}
          {!viewOnly ? (
            <>
              <Button variant="outline-warning" disabled={acting || detailLoading} onClick={() => void review('return')}>
                Request revision
              </Button>
              <Button
                variant="primary"
                style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                disabled={acting || detailLoading}
                onClick={() => void review('approve')}
              >
                Approve
              </Button>
            </>
          ) : null}
        </Modal.Footer>
      </Modal>

      <Modal show={showBulkApproveModal} onHide={() => !bulkActing && setShowBulkApproveModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">Approve selected submissions</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-2">
            You are about to approve <strong>{selectedEligibleCount}</strong> performance indicator
            {selectedEligibleCount === 1 ? '' : 's'}.
          </p>
          <p className="small text-muted mb-0">
            Each ambassador will receive a confirmation email, and System Administrators / Strategy Managers will be notified of the approved indicators.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowBulkApproveModal(false)} disabled={bulkActing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
            disabled={bulkActing}
            onClick={() => void runBulkReview('approve')}
          >
            {bulkActing ? 'Approving…' : `Approve (${selectedEligibleCount})`}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showBulkReturnModal} onHide={() => !bulkActing && setShowBulkReturnModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">Request revision for selected</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-3">
            The same feedback will be sent to the ambassador for all {selectedEligibleCount} selected submission{selectedEligibleCount === 1 ? '' : 's'}.
          </p>
          <Form.Group>
            <Form.Label className="small fw-semibold">Feedback (required)</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={bulkReturnComment}
              onChange={(e) => setBulkReturnComment(e.target.value)}
              disabled={bulkActing}
              placeholder="Explain what needs to be revised…"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowBulkReturnModal(false)} disabled={bulkActing}>
            Cancel
          </Button>
          <Button
            variant="warning"
            disabled={bulkActing || !bulkReturnComment.trim()}
            onClick={() => void runBulkReview('return', bulkReturnComment)}
          >
            {bulkActing ? 'Sending…' : `Request revision (${selectedEligibleCount})`}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
