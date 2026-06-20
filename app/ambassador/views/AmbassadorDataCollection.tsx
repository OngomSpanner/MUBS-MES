'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Form, Badge, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { uomLabel, validateMetricValue, uomPlaceholder } from '@/lib/questionnaire/uom';
import { HOD_REVIEW_STATUS_LABELS, type HodReviewStatus } from '@/lib/hod-review-workflow-constants';

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

type ResponseMap = Record<string, string>; // key: `${metric_id}_${fy}`

const STATUS_CONFIG = {
  'not-started': { label: 'Not started', bg: 'secondary', icon: 'circle' },
  'partial': { label: 'In progress', bg: 'warning', icon: 'more_horiz', textDark: true },
  'complete': { label: 'Complete', bg: 'success', icon: 'check_circle' },
};

export default function AmbassadorDataCollection() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);

  // Entry modal
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

  const openEntry = async (ind: Indicator) => {
    setEntryIndicator(ind);
    setSaveErr(null); setSaveOk(false); setValidationErrors({});
    try {
      const res = await axios.get('/api/questionnaire/responses', { params: { indicator_id: ind.id } });
      const map: ResponseMap = {};
      for (const row of res.data as any[]) {
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
      setSaveErr('Complete all metric cells before submitting for HOD review.');
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
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <span className="text-muted small">{indicators.length} indicator{indicators.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && (
        <div className="text-center py-5"><Spinner animation="border" size="sm" className="text-primary" /></div>
      )}

      {!loading && indicators.length === 0 && (
        <div className="text-center text-muted py-5 small">
          <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '2rem' }}>assignment</span>
          No performance indicators assigned to your office yet.
        </div>
      )}

      {!loading && indicators.length > 0 && (
        <div className="d-flex flex-column gap-2">
          {indicators.map((ind) => {
            const sc = STATUS_CONFIG[ind.status];
            return (
              <div key={ind.id} className="border rounded-3 p-3 d-flex align-items-start gap-3 flex-wrap" style={{ background: '#f8fafc' }}>
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  <div className="fw-semibold small mb-1 d-flex align-items-center gap-2 flex-wrap">
                    {ind.indicator_text}
                    {ind.is_locked && (
                      <Badge bg="danger" style={{ fontSize: '0.6rem' }}>
                        <span className="material-symbols-outlined me-1" style={{ fontSize: '11px', verticalAlign: 'middle' }}>lock</span>Locked
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
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>{ind.metrics.length} metric{ind.metrics.length !== 1 ? 's' : ''} · {ind.filled}/{ind.total} cells filled</div>
                </div>

                <div className="d-flex flex-column align-items-end gap-2 flex-shrink-0">
                  <Badge bg={sc.bg as any} className={(sc as any).textDark ? 'text-dark' : ''} style={{ fontSize: '0.65rem' }}>
                    <span className="material-symbols-outlined me-1" style={{ fontSize: '11px', verticalAlign: 'middle' }}>{sc.icon}</span>
                    {sc.label}
                  </Badge>
                  {ind.hod_review_status && ind.hod_review_status !== 'draft' ? (
                    <Badge
                      bg={ind.hod_review_status === 'approved' ? 'success' : ind.hod_review_status === 'submitted' ? 'warning' : 'danger'}
                      className={ind.hod_review_status === 'submitted' ? 'text-dark' : ''}
                      style={{ fontSize: '0.62rem' }}
                    >
                      {HOD_REVIEW_STATUS_LABELS[ind.hod_review_status]}
                    </Badge>
                  ) : null}
                  <Button
                    size="sm"
                    variant={ind.is_locked ? 'outline-secondary' : 'primary'}
                    style={!ind.is_locked ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : {}}
                    onClick={() => openEntry(ind)}
                  >
                    <span className="material-symbols-outlined me-1" style={{ fontSize: '14px', verticalAlign: 'middle' }}>
                      {ind.is_locked ? 'visibility' : 'edit'}
                    </span>
                    {ind.is_locked ? 'View' : (ind.status === 'not-started' ? 'Enter Data' : 'Update')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Entry Modal */}
      <Modal show={!!entryIndicator} onHide={closeEntry} size="xl" scrollable>
        {entryIndicator && (
          <>
            <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #1e40af, var(--mubs-navy, #1a3a5c))', color: '#fff' }}>
              <Modal.Title className="fs-6 fw-bold">
                <span className="material-symbols-outlined me-2" style={{ fontSize: '18px', verticalAlign: 'middle' }}>assignment</span>
                Data Entry — {entryIndicator.indicator_text}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="mb-3 small text-muted d-flex gap-2 flex-wrap">
                <Badge bg="light" className="text-dark border">{entryIndicator.department_name}</Badge>
                {entryIndicator.financial_years.map((fy) => (
                  <Badge key={fy} bg="primary" style={{ background: 'var(--mubs-blue)' }}>{fy}</Badge>
                ))}
              </div>

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
                          return (
                            <td key={fy} className="align-middle">
                              <Form.Control
                                size="sm"
                                value={val}
                                onChange={(e) => setValue(m.id, fy, e.target.value)}
                                placeholder={uomPlaceholder(m.unit_of_measure)}
                                disabled={entryIndicator.is_locked}
                                isInvalid={!!err}
                                style={{ fontSize: '0.78rem' }}
                                as={m.unit_of_measure === 'text' || m.unit_of_measure === 'list' ? 'textarea' : 'input'}
                                {...(m.unit_of_measure === 'text' || m.unit_of_measure === 'list' ? { rows: 2 } : {})}
                              />
                              {err && <div className="text-danger" style={{ fontSize: '0.68rem' }}>{err}</div>}
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
              {!entryIndicator.is_locked && (
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
                    {saving ? 'Submitting…' : 'Submit for HOD review'}
                  </Button>
                </>
              )}
            </Modal.Footer>
          </>
        )}
      </Modal>
    </div>
  );
}
