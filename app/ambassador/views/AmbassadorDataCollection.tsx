'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Button, Form, Badge, Spinner } from 'react-bootstrap';
import axios from 'axios';
import StatCard from '@/components/StatCard';
import { uomLabel, validateMetricValue, uomPlaceholder } from '@/lib/questionnaire/uom';
import { HOD_REVIEW_STATUS_LABELS, HOD_UNIT_HEAD_LABEL, type HodReviewStatus } from '@/lib/hod-review-workflow-constants';

type Metric = { id: number; metric_text: string; unit_of_measure: string; sort_order: number };
type Indicator = {
  id: number;
  indicator_text: string;
  is_locked: boolean;
  outcome_type: string;
  outcome_label: string;
  metrics: Metric[];
  financial_years: string[];
  status: 'not-started' | 'partial' | 'complete';
  filled: number;
  total: number;
  department_id: number;
  department_name: string;
  hod_review_status?: HodReviewStatus;
  hod_review_comment?: string | null;
};

type ResponseMap = Record<string, string>;
type IndicatorFilter = 'all' | 'not-completed' | 'awaiting-review' | 'completed' | 'needs-revision';

const STATUS_CONFIG = {
  'not-started': { label: 'Not started', bg: 'secondary', icon: 'circle' },
  'partial': { label: 'In progress', bg: 'warning', icon: 'more_horiz', textDark: true },
  'complete': { label: 'Complete', bg: 'success', icon: 'check_circle' },
};

const FILTER_TABS: { key: IndicatorFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'not-completed', label: 'Not completed' },
  { key: 'awaiting-review', label: 'Awaiting review' },
  { key: 'completed', label: 'Completed' },
  { key: 'needs-revision', label: 'Needs revision' },
];

function isSubmissionReadOnly(ind: Indicator): boolean {
  return ind.is_locked || ind.hod_review_status === 'submitted' || ind.hod_review_status === 'approved';
}

function indicatorCategory(ind: Indicator): Exclude<IndicatorFilter, 'all'> {
  const hod = ind.hod_review_status ?? 'draft';
  if (hod === 'returned') return 'needs-revision';
  if (hod === 'submitted') return 'awaiting-review';
  if (hod === 'approved') return 'completed';
  return 'not-completed';
}

function matchesFilter(ind: Indicator, filter: IndicatorFilter): boolean {
  if (filter === 'all') return true;
  return indicatorCategory(ind) === filter;
}

function buildFilterSummary(filter: IndicatorFilter, items: Indicator[]): string {
  if (items.length === 0) {
    return filter === 'all'
      ? 'No performance indicators assigned to your office yet.'
      : `No indicators in the "${FILTER_TABS.find((t) => t.key === filter)?.label}" category.`;
  }

  const filled = items.reduce((sum, ind) => sum + ind.filled, 0);
  const total = items.reduce((sum, ind) => sum + ind.total, 0);
  const metrics = items.reduce((sum, ind) => sum + ind.metrics.length, 0);
  const countLabel = `${items.length} indicator${items.length !== 1 ? 's' : ''}`;

  switch (filter) {
    case 'all':
      return `${countLabel} assigned · ${filled}/${total} cells filled across ${metrics} metric${metrics !== 1 ? 's' : ''}.`;
    case 'not-completed': {
      const notStarted = items.filter((i) => i.status === 'not-started').length;
      const inProgress = items.filter((i) => i.status === 'partial').length;
      const ready = items.filter((i) => i.status === 'complete').length;
      const parts = [];
      if (notStarted) parts.push(`${notStarted} not started`);
      if (inProgress) parts.push(`${inProgress} in progress`);
      if (ready) parts.push(`${ready} ready to submit`);
      return `${countLabel} · ${filled}/${total} cells filled${parts.length ? ` · ${parts.join(', ')}` : ''}.`;
    }
    case 'awaiting-review':
      return `${countLabel} submitted for ${HOD_UNIT_HEAD_LABEL} review · ${filled}/${total} cells filled.`;
    case 'completed':
      return `${countLabel} approved by ${HOD_UNIT_HEAD_LABEL} · ${filled}/${total} cells recorded.`;
    case 'needs-revision':
      return `${countLabel} sent back for revision · update the data and resubmit for review.`;
    default:
      return countLabel;
  }
}

function IndicatorCard({ ind, onOpen }: { ind: Indicator; onOpen: (ind: Indicator) => void }) {
  const sc = STATUS_CONFIG[ind.status];
  const readOnly = isSubmissionReadOnly(ind);

  return (
    <div className="border rounded-3 p-3 d-flex align-items-start gap-3 flex-wrap" style={{ background: '#f8fafc' }}>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="fw-semibold small mb-1 d-flex align-items-center gap-2 flex-wrap">
          {ind.indicator_text}
          {ind.is_locked && (
            <Badge bg="danger" style={{ fontSize: '0.6rem' }}>
              <span className="material-symbols-outlined me-1" style={{ fontSize: '11px', verticalAlign: 'middle' }}>lock</span>
              Locked
            </Badge>
          )}
        </div>
        <div className="d-flex flex-wrap gap-1 mb-1">
          {ind.financial_years.map((fy) => (
            <Badge key={fy} bg="primary" style={{ fontSize: '0.62rem', background: 'var(--mubs-blue)' }}>{fy}</Badge>
          ))}
          {ind.metrics.map((m) => (
            <Badge key={m.id} bg="light" className="text-dark border" style={{ fontSize: '0.6rem' }}>{uomLabel(m.unit_of_measure)}</Badge>
          ))}
        </div>
        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
          {ind.metrics.length} metric{ind.metrics.length !== 1 ? 's' : ''} · {ind.filled}/{ind.total} cells filled
        </div>
      </div>

      <div className="d-flex flex-column align-items-end gap-2 flex-shrink-0">
        <Badge bg={sc.bg as 'secondary' | 'warning' | 'success'} className={sc.textDark ? 'text-dark' : ''} style={{ fontSize: '0.65rem' }}>
          <span className="material-symbols-outlined me-1" style={{ fontSize: '11px', verticalAlign: 'middle' }}>{sc.icon}</span>
          {sc.label}
        </Badge>
        {ind.hod_review_status && ind.hod_review_status !== 'draft' ? (
          <Badge
            bg={ind.hod_review_status === 'approved' ? 'success' : 'warning'}
            className={ind.hod_review_status === 'submitted' || ind.hod_review_status === 'returned' ? 'text-dark' : ''}
            style={{ fontSize: '0.62rem' }}
          >
            {HOD_REVIEW_STATUS_LABELS[ind.hod_review_status]}
          </Badge>
        ) : null}
        <Button
          size="sm"
          variant={readOnly ? 'outline-secondary' : 'primary'}
          style={!readOnly ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : {}}
          onClick={() => onOpen(ind)}
        >
          <span className="material-symbols-outlined me-1" style={{ fontSize: '14px', verticalAlign: 'middle' }}>
            {readOnly ? 'visibility' : 'edit'}
          </span>
          {readOnly ? 'View' : (ind.status === 'not-started' ? 'Enter Data' : 'Update')}
        </Button>
      </div>
    </div>
  );
}

export default function AmbassadorDataCollection() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<IndicatorFilter>('all');

  const [entryIndicator, setEntryIndicator] = useState<Indicator | null>(null);
  const [responses, setResponses] = useState<ResponseMap>({});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const fetchIndicators = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/questionnaire/ambassador/indicators');
      setIndicators(Array.isArray(res.data) ? res.data : []);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchIndicators(); }, [fetchIndicators]);

  const counts = useMemo(() => {
    const tally = {
      all: indicators.length,
      'not-completed': 0,
      'awaiting-review': 0,
      completed: 0,
      'needs-revision': 0,
    };
    for (const ind of indicators) {
      tally[indicatorCategory(ind)] += 1;
    }
    return tally;
  }, [indicators]);

  const filteredIndicators = useMemo(
    () => indicators.filter((ind) => matchesFilter(ind, activeFilter)),
    [indicators, activeFilter],
  );

  const summaryText = useMemo(
    () => buildFilterSummary(activeFilter, filteredIndicators),
    [activeFilter, filteredIndicators],
  );

  const openEntry = async (ind: Indicator) => {
    setEntryIndicator(ind);
    setSaveErr(null); setSaveOk(false); setValidationErrors({});
    try {
      const res = await axios.get('/api/questionnaire/responses', { params: { indicator_id: ind.id } });
      const map: ResponseMap = {};
      for (const row of res.data as { metric_id: number; financial_year: string; value: string | null }[]) {
        map[`${row.metric_id}_${row.financial_year}`] = row.value ?? '';
      }
      setResponses(map);
    } catch { setResponses({}); }
  };

  const closeEntry = () => { setEntryIndicator(null); };

  const setValue = (metricId: number, fy: string, val: string) => {
    const key = `${metricId}_${fy}`;
    setResponses((prev) => ({ ...prev, [key]: val }));
    const metric = entryIndicator?.metrics.find((m) => m.id === metricId);
    if (metric) {
      const err = validateMetricValue(val, metric.unit_of_measure);
      setValidationErrors((prev) => { const next = { ...prev }; if (err) next[key] = err; else delete next[key]; return next; });
    }
  };

  const handleSave = async (submitForReview: boolean) => {
    if (!entryIndicator) return;
    if (Object.keys(validationErrors).length > 0) { setSaveErr('Fix validation errors before saving.'); return; }
    if (submitForReview && entryIndicator.status !== 'complete') {
      setSaveErr(`Complete all metric cells before submitting for ${HOD_UNIT_HEAD_LABEL} review.`);
      return;
    }
    setSaving(true); setSaveErr(null); setSaveOk(false);
    try {
      const entries = entryIndicator.metrics.flatMap((m) =>
        entryIndicator.financial_years.map((fy) => ({
          metric_id: m.id,
          financial_year: fy,
          value: responses[`${m.id}_${fy}`] ?? '',
        }))
      );
      await axios.post('/api/questionnaire/responses', {
        indicator_id: entryIndicator.id,
        entries,
        submitForReview,
      });
      setSaveOk(true);
      void fetchIndicators();
      setTimeout(() => { setSaveOk(false); closeEntry(); }, 1200);
    } catch (e: unknown) {
      setSaveErr(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Save failed' : 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div>
      {loading && (
        <div className="text-center py-5"><Spinner animation="border" size="sm" className="text-primary" /></div>
      )}

      {!loading && (
        <>
          <div className="row g-2 mb-3">
            <div className="col-6 col-md-4 col-xl">
              <StatCard label="Total indicators" value={counts.all} color="blue" />
            </div>
            <div className="col-6 col-md-4 col-xl">
              <StatCard label="Not completed" value={counts['not-completed']} color="yellow" />
            </div>
            <div className="col-6 col-md-4 col-xl">
              <StatCard label="Awaiting review" value={counts['awaiting-review']} color="blue" />
            </div>
            <div className="col-6 col-md-4 col-xl">
              <StatCard label="Completed" value={counts.completed} color="green" />
            </div>
            <div className="col-6 col-md-4 col-xl">
              <StatCard label="Needs revision" value={counts['needs-revision']} color="red" />
            </div>
          </div>

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

          <p className="small text-muted mb-3">
            <span className="fw-semibold text-dark">{FILTER_TABS.find((t) => t.key === activeFilter)?.label}:</span>{' '}
            {summaryText}
          </p>

          {indicators.length === 0 ? (
            <div className="text-center text-muted py-5 small">
              <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '2rem' }}>assignment</span>
              No performance indicators assigned to your office yet.
            </div>
          ) : filteredIndicators.length === 0 ? (
            <div className="text-center text-muted py-5 small">
              <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '2rem' }}>filter_alt_off</span>
              No indicators match this filter.
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {filteredIndicators.map((ind) => (
                <IndicatorCard key={ind.id} ind={ind} onOpen={openEntry} />
              ))}
            </div>
          )}
        </>
      )}

      <Modal show={!!entryIndicator} onHide={closeEntry} size="xl" scrollable>
        {entryIndicator && (() => {
          const readOnly = isSubmissionReadOnly(entryIndicator);
          return (
          <>
            <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #1e40af, var(--mubs-navy, #1a3a5c))', color: '#fff' }}>
              <Modal.Title className="fs-6 fw-bold">
                <span className="material-symbols-outlined me-2" style={{ fontSize: '18px', verticalAlign: 'middle' }}>assignment</span>
                {readOnly ? 'View submission' : 'Data Entry'} — {entryIndicator.indicator_text}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="mb-3 small text-muted d-flex gap-2 flex-wrap align-items-center">
                <Badge bg="light" className="text-dark border">{entryIndicator.department_name}</Badge>
                {entryIndicator.financial_years.map((fy) => (
                  <Badge key={fy} bg="primary" style={{ background: 'var(--mubs-blue)' }}>{fy}</Badge>
                ))}
                {entryIndicator.hod_review_status && entryIndicator.hod_review_status !== 'draft' ? (
                  <Badge
                    bg={entryIndicator.hod_review_status === 'approved' ? 'success' : 'warning'}
                    className={entryIndicator.hod_review_status !== 'approved' ? 'text-dark' : ''}
                    style={{ fontSize: '0.62rem' }}
                  >
                    {HOD_REVIEW_STATUS_LABELS[entryIndicator.hod_review_status]}
                  </Badge>
                ) : null}
              </div>

              {entryIndicator.hod_review_status === 'submitted' && (
                <div className="alert alert-info small py-2 mb-3">
                  This submission is awaiting {HOD_UNIT_HEAD_LABEL} review. You can view the data but cannot edit until a revision is requested.
                </div>
              )}

              {entryIndicator.hod_review_status === 'approved' && (
                <div className="alert alert-success small py-2 mb-3">
                  This submission has been approved by the {HOD_UNIT_HEAD_LABEL}. View only.
                </div>
              )}

              {entryIndicator.hod_review_status === 'returned' && entryIndicator.hod_review_comment?.trim() && (
                <div className="alert alert-warning small py-2 mb-3">
                  <span className="fw-semibold d-block mb-1">Revision requested by {HOD_UNIT_HEAD_LABEL}</span>
                  {entryIndicator.hod_review_comment}
                </div>
              )}

              {entryIndicator.is_locked && (
                <div className="alert alert-warning small py-2 mb-3">
                  <span className="material-symbols-outlined me-1" style={{ fontSize: '14px', verticalAlign: 'middle' }}>lock</span>
                  This indicator is locked by the administrator. You can view data but cannot edit.
                </div>
              )}

              {saveErr && <div className="alert alert-danger small py-2 mb-3">{saveErr}</div>}
              {saveOk && <div className="alert alert-success small py-2 mb-3">Saved successfully!</div>}

              <div className="table-responsive">
                <table className="table table-bordered table-sm" style={{ fontSize: '0.8rem' }}>
                  <thead className="table-dark">
                    <tr>
                      <th style={{ minWidth: '240px' }}>Performance Metric</th>
                      <th style={{ width: '110px' }}>Unit of Measure</th>
                      {entryIndicator.financial_years.map((fy) => (
                        <th key={fy} className="text-center" style={{ minWidth: '140px' }}>{fy}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entryIndicator.metrics.map((m, mi) => (
                      <tr key={m.id}>
                        <td className="align-middle">
                          <span className="fw-semibold me-2" style={{ color: 'var(--mubs-gold, #C8922A)' }}>{mi + 1}.</span>
                          {m.metric_text}
                        </td>
                        <td className="align-middle">
                          <Badge bg="light" className="text-dark border" style={{ fontSize: '0.62rem' }}>{uomLabel(m.unit_of_measure)}</Badge>
                        </td>
                        {entryIndicator.financial_years.map((fy) => {
                          const key = `${m.id}_${fy}`;
                          const val = responses[key] ?? '';
                          const err = validationErrors[key];
                          const displayVal = val.trim() || null;
                          return (
                            <td key={fy} className="align-middle">
                              {readOnly ? (
                                <span
                                  className={`d-block text-center ${displayVal ? 'fw-semibold' : 'text-muted'}`}
                                  style={{ fontSize: '0.78rem', fontStyle: displayVal ? 'normal' : 'italic' }}
                                >
                                  {displayVal ?? '—'}
                                </span>
                              ) : (
                                <>
                                  <Form.Control
                                    size="sm"
                                    value={val}
                                    onChange={(e) => setValue(m.id, fy, e.target.value)}
                                    placeholder={uomPlaceholder(m.unit_of_measure)}
                                    isInvalid={!!err}
                                    style={{ fontSize: '0.78rem' }}
                                    as={m.unit_of_measure === 'text' || m.unit_of_measure === 'list' ? 'textarea' : 'input'}
                                    {...(m.unit_of_measure === 'text' || m.unit_of_measure === 'list' ? { rows: 2 } : {})}
                                  />
                                  {err && <div className="text-danger" style={{ fontSize: '0.68rem' }}>{err}</div>}
                                </>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Modal.Body>
            <Modal.Footer className="gap-2">
              <Button size="sm" variant="outline-secondary" onClick={closeEntry}>Close</Button>
              {!readOnly && (
                <>
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => void handleSave(false)}
                    disabled={saving || Object.keys(validationErrors).length > 0}
                  >
                    {saving ? 'Saving…' : 'Save draft'}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                    onClick={() => void handleSave(true)}
                    disabled={saving || Object.keys(validationErrors).length > 0 || entryIndicator.status !== 'complete'}
                  >
                    {saving ? 'Submitting…' : `Submit for ${HOD_UNIT_HEAD_LABEL} review`}
                  </Button>
                </>
              )}
            </Modal.Footer>
          </>
          );
        })()}
      </Modal>
    </div>
  );
}
