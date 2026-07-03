'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Modal, Button, Form, Badge, Spinner } from 'react-bootstrap';
import axios from 'axios';
import StatCard from '@/components/StatCard';
import { uomLabel, validateMetricValue, uomPlaceholder } from '@/lib/questionnaire/uom';
import { fyShortLabel } from '@/lib/questionnaire/fy-utils';
import { METRIC_ENTRY_TABLE, uomTableLabel } from '@/lib/questionnaire/metric-entry-table-layout';
import { HOD_REVIEW_STATUS_LABELS, HOD_UNIT_HEAD_LABEL, type HodReviewStatus } from '@/lib/hod-review-workflow-constants';
import { IndicatorFyTargetGroup, type IndicatorTarget } from '@/components/Questionnaire/IndicatorTargetUI';

type Metric = {
  id: number;
  metric_text: string;
  unit_of_measure: string;
  sort_order: number;
};
type Indicator = {
  id: number;
  indicator_text: string;
  is_locked: boolean;
  outcome_type: string;
  outcome_label: string;
  metrics: Metric[];
  targets?: IndicatorTarget[];
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
type CommentMap = Record<string, string>;
type IndicatorFilter = 'all' | 'not-completed' | 'awaiting-review' | 'completed' | 'needs-revision';

type StatusConfig = { label: string; bg: string; icon: string; textDark?: boolean };

const STATUS_CONFIG: Record<Indicator['status'], StatusConfig> = {
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

function isBulkSubmitEligible(ind: Indicator): boolean {
  const hod = ind.hod_review_status ?? 'draft';
  return !ind.is_locked && ind.status === 'complete' && (hod === 'draft' || hod === 'returned');
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

function computeEntryStatus(ind: Indicator, responses: ResponseMap): Indicator['status'] {
  const total = ind.metrics.length * ind.financial_years.length;
  if (total === 0) return 'not-started';
  let filled = 0;
  for (const m of ind.metrics) {
    for (const fy of ind.financial_years) {
      if ((responses[`${m.id}_${fy}`] ?? '').trim()) filled += 1;
    }
  }
  if (filled === 0) return 'not-started';
  if (filled < total) return 'partial';
  return 'complete';
}

function computeMissingCellKeys(
  ind: Indicator,
  responses: ResponseMap,
  validationErrors: Record<string, string>,
): string[] {
  const missing: string[] = [];
  for (const m of ind.metrics) {
    for (const fy of ind.financial_years) {
      const key = `${m.id}_${fy}`;
      const val = (responses[key] ?? '').trim();
      if (!val || validationErrors[key]) missing.push(key);
    }
  }
  return missing;
}

function snapshotForIndicator(ind: Indicator, map: ResponseMap): ResponseMap {
  const snap: ResponseMap = {};
  for (const m of ind.metrics) {
    for (const fy of ind.financial_years) {
      const key = `${m.id}_${fy}`;
      snap[key] = map[key] ?? '';
    }
  }
  return snap;
}

function snapshotCommentsForIndicator(ind: Indicator, map: CommentMap): CommentMap {
  const snap: CommentMap = {};
  for (const m of ind.metrics) {
    snap[String(m.id)] = map[String(m.id)] ?? '';
  }
  return snap;
}

function commentsMatch(ind: Indicator, current: CommentMap, baseline: CommentMap): boolean {
  for (const m of ind.metrics) {
    const key = String(m.id);
    if ((current[key] ?? '') !== (baseline[key] ?? '')) return false;
  }
  return true;
}

function buildMetricCommentsPayload(ind: Indicator, comments: CommentMap) {
  return ind.metrics.map((m) => ({
    metric_id: m.id,
    comment: (comments[String(m.id)] ?? '').trim() || null,
  }));
}

function patchIndicatorFromResponses(ind: Indicator, map: ResponseMap): Indicator {
  const total = ind.metrics.length * ind.financial_years.length;
  let filled = 0;
  for (const m of ind.metrics) {
    for (const fy of ind.financial_years) {
      if ((map[`${m.id}_${fy}`] ?? '').trim()) filled += 1;
    }
  }
  const status: Indicator['status'] =
    total === 0 || filled === 0 ? 'not-started' : filled < total ? 'partial' : 'complete';
  return { ...ind, filled, total, status };
}

function responsesMatch(ind: Indicator, current: ResponseMap, baseline: ResponseMap): boolean {
  for (const m of ind.metrics) {
    for (const fy of ind.financial_years) {
      const key = `${m.id}_${fy}`;
      if ((current[key] ?? '') !== (baseline[key] ?? '')) return false;
    }
  }
  return true;
}

function IndicatorCard({
  ind,
  onOpen,
  selectable,
  selected,
  onToggleSelect,
}: {
  ind: Indicator;
  onOpen: (ind: Indicator) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  const sc = STATUS_CONFIG[ind.status];
  const readOnly = isSubmissionReadOnly(ind);

  return (
    <div
      className="border rounded-3 p-3 d-flex align-items-start gap-3 flex-wrap"
      style={{ background: selected ? '#eff6ff' : '#f8fafc', borderColor: selected ? 'var(--mubs-blue)' : undefined }}
    >
      {selectable && (
        <Form.Check
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect?.(ind.id)}
          className="mt-1 flex-shrink-0"
          aria-label={`Select ${ind.indicator_text}`}
        />
      )}
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
  const [metricComments, setMetricComments] = useState<CommentMap>({});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());
  const [autoSaveNote, setAutoSaveNote] = useState<string | null>(null);

  const loadedResponsesRef = useRef<ResponseMap>({});
  const loadedCommentsRef = useRef<CommentMap>({});

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  const fetchIndicators = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/questionnaire/ambassador/indicators');
      setIndicators(Array.isArray(res.data) ? res.data : []);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  const refreshIndicators = useCallback(async (syncEntryId?: number) => {
    try {
      const res = await axios.get('/api/questionnaire/ambassador/indicators');
      const list: Indicator[] = Array.isArray(res.data) ? res.data : [];
      setIndicators(list);
      if (syncEntryId != null) {
        const updated = list.find((i) => i.id === syncEntryId);
        if (updated) setEntryIndicator(updated);
      }
      return list;
    } catch {
      return [] as Indicator[];
    }
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

  const bulkEligible = useMemo(
    () => indicators.filter(isBulkSubmitEligible),
    [indicators],
  );

  const selectedEligibleCount = useMemo(
    () => bulkEligible.filter((ind) => selectedIds.has(ind.id)).length,
    [bulkEligible, selectedIds],
  );

  const allEligibleSelected = bulkEligible.length > 0 && bulkEligible.every((ind) => selectedIds.has(ind.id));

  const entryNavIndex = entryIndicator
    ? filteredIndicators.findIndex((i) => i.id === entryIndicator.id)
    : -1;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllEligible = () => {
    if (allEligibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bulkEligible.map((ind) => ind.id)));
    }
  };

  const openEntry = async (ind: Indicator) => {
    setEntryIndicator(ind);
    setSaveErr(null);
    setSaveOk(false);
    setAutoSaveNote(null);
    setValidationErrors({});
    setMissingFields(new Set());
    try {
      const res = await axios.get('/api/questionnaire/responses', { params: { indicator_id: ind.id } });
      const data = res.data as {
        responses?: { metric_id: number; financial_year: string; value: string | null }[];
        metric_comments?: { metric_id: number; comment: string | null }[];
      };
      const rows = Array.isArray(data.responses) ? data.responses : (Array.isArray(res.data) ? res.data as { metric_id: number; financial_year: string; value: string | null }[] : []);
      const map: ResponseMap = {};
      for (const row of rows) {
        map[`${row.metric_id}_${row.financial_year}`] = row.value ?? '';
      }
      const comments: CommentMap = {};
      for (const row of data.metric_comments ?? []) {
        comments[String(row.metric_id)] = row.comment ?? '';
      }
      loadedResponsesRef.current = snapshotForIndicator(ind, map);
      loadedCommentsRef.current = snapshotCommentsForIndicator(ind, comments);
      setResponses(map);
      setMetricComments(comments);
    } catch {
      loadedResponsesRef.current = snapshotForIndicator(ind, {});
      loadedCommentsRef.current = snapshotCommentsForIndicator(ind, {});
      setResponses({});
      setMetricComments({});
    }
  };

  const isEntryDirty = entryIndicator
    ? !responsesMatch(entryIndicator, responses, loadedResponsesRef.current)
      || !commentsMatch(entryIndicator, metricComments, loadedCommentsRef.current)
    : false;

  const saveDraft = useCallback(async (opts?: { silent?: boolean }): Promise<boolean> => {
    if (!entryIndicator || isSubmissionReadOnly(entryIndicator)) return true;
    if (Object.keys(validationErrors).length > 0) {
      if (!opts?.silent) setSaveErr('Fix validation errors before saving.');
      return false;
    }
    if (!responsesMatch(entryIndicator, responses, loadedResponsesRef.current)
      || !commentsMatch(entryIndicator, metricComments, loadedCommentsRef.current)) {
      setSaving(true);
      if (!opts?.silent) {
        setSaveErr(null);
        setSaveOk(false);
      }
      try {
        const entries = entryIndicator.metrics.flatMap((m) =>
          entryIndicator.financial_years.map((fy) => ({
            metric_id: m.id,
            financial_year: fy,
            value: responses[`${m.id}_${fy}`] ?? '',
          })),
        );
        await axios.post('/api/questionnaire/responses', {
          indicator_id: entryIndicator.id,
          entries,
          metric_comments: buildMetricCommentsPayload(entryIndicator, metricComments),
          submitForReview: false,
        });
        loadedResponsesRef.current = snapshotForIndicator(entryIndicator, responses);
        loadedCommentsRef.current = snapshotCommentsForIndicator(entryIndicator, metricComments);
        setMissingFields(new Set());
        const patched = patchIndicatorFromResponses(entryIndicator, responses);
        setEntryIndicator(patched);
        setIndicators((prev) => prev.map((i) => (i.id === patched.id ? patched : i)));
        if (opts?.silent) {
          setAutoSaveNote('Draft saved');
          window.setTimeout(() => setAutoSaveNote(null), 2000);
        } else {
          setSaveOk(true);
          window.setTimeout(() => setSaveOk(false), 2500);
        }
        return true;
      } catch (e: unknown) {
        if (!opts?.silent) {
          setSaveErr(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Save failed' : 'Save failed');
        }
        return false;
      } finally {
        setSaving(false);
      }
    }
    return true;
  }, [entryIndicator, responses, metricComments, validationErrors]);

  const closeEntry = async () => {
    if (entryIndicator && !isSubmissionReadOnly(entryIndicator) && isEntryDirty) {
      await saveDraft({ silent: true });
    }
    setEntryIndicator(null);
    setMissingFields(new Set());
    setAutoSaveNote(null);
  };

  const navigateEntry = async (delta: number) => {
    if (entryNavIndex < 0 || saving) return;
    const nextInd = filteredIndicators[entryNavIndex + delta];
    if (!nextInd) return;

    if (entryIndicator && !isSubmissionReadOnly(entryIndicator) && isEntryDirty) {
      const ok = await saveDraft({ silent: true });
      if (!ok) return;
    }
    await openEntry(nextInd);
  };

  const setValue = (metricId: number, fy: string, val: string) => {
    const key = `${metricId}_${fy}`;
    setResponses((prev) => ({ ...prev, [key]: val }));
    setMissingFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    const metric = entryIndicator?.metrics.find((m) => m.id === metricId);
    if (metric) {
      const err = validateMetricValue(val, metric.unit_of_measure);
      setValidationErrors((prev) => {
        const next = { ...prev };
        if (err) next[key] = err;
        else delete next[key];
        return next;
      });
    }
  };

  const setComment = (metricId: number, val: string) => {
    setMetricComments((prev) => ({ ...prev, [String(metricId)]: val }));
  };

  const handleSave = async (submitForReview: boolean) => {
    if (!entryIndicator) return;
    if (!submitForReview) {
      await saveDraft({ silent: false });
      return;
    }
    if (Object.keys(validationErrors).length > 0) {
      setSaveErr('Fix validation errors before saving.');
      return;
    }
    setSaving(true);
    setSaveErr(null);
    setSaveOk(false);
    try {
      const entries = entryIndicator.metrics.flatMap((m) =>
        entryIndicator.financial_years.map((fy) => ({
          metric_id: m.id,
          financial_year: fy,
          value: responses[`${m.id}_${fy}`] ?? '',
        })),
      );
      const res = await axios.post('/api/questionnaire/responses', {
        indicator_id: entryIndicator.id,
        entries,
        metric_comments: buildMetricCommentsPayload(entryIndicator, metricComments),
        submitForReview: true,
      });
      loadedResponsesRef.current = snapshotForIndicator(entryIndicator, responses);
      loadedCommentsRef.current = snapshotCommentsForIndicator(entryIndicator, metricComments);
      setSaveOk(true);
      setMissingFields(new Set());
      await refreshIndicators(entryIndicator.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(entryIndicator.id);
        return next;
      });
      window.setTimeout(() => setSaveOk(false), 2500);
      if (res.data?.message) {
        setSaveErr(null);
      }
    } catch (e: unknown) {
      setSaveErr(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Save failed' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitClick = () => {
    if (!entryIndicator || saving) return;
    if (Object.keys(validationErrors).length > 0) {
      setSaveErr('Fix validation errors before submitting.');
      return;
    }
    const liveStatus = computeEntryStatus(entryIndicator, responses);
    if (liveStatus !== 'complete') {
      const missing = computeMissingCellKeys(entryIndicator, responses, validationErrors);
      setMissingFields(new Set(missing));
      setSaveErr(`Fill in all required metrics before submitting to ${HOD_UNIT_HEAD_LABEL}.`);
      return;
    }
    void handleSave(true);
  };

  const handleBulkSubmit = async () => {
    setBulkSubmitting(true);
    setBulkMsg(null);
    try {
      const fresh = await refreshIndicators(entryIndicator?.id);
      const eligibleIds = new Set(
        fresh.filter(isBulkSubmitEligible).map((ind) => ind.id),
      );
      const ids = [...selectedIds].filter((id) => eligibleIds.has(id));

      if (!ids.length) {
        setBulkMsg({
          type: 'danger',
          text: 'No eligible indicators selected. Each must be complete, saved, and not already submitted for review.',
        });
        return;
      }

      const res = await axios.post('/api/questionnaire/responses/bulk-submit', { indicator_ids: ids });
      const skipped = Array.isArray(res.data?.skipped) ? res.data.skipped as { id: number; reason: string }[] : [];
      let text = res.data?.message ?? `Submitted ${ids.length} indicator(s).`;
      if (skipped.length > 0) {
        const reasons = skipped.map((s) => `#${s.id}: ${s.reason}`).join('; ');
        text += ` Skipped: ${reasons}`;
      }
      setBulkMsg({ type: 'success', text });
      setSelectedIds(new Set());
      await refreshIndicators(entryIndicator?.id);
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        const data = e.response?.data as { message?: string; skipped?: { id: number; reason: string }[] } | undefined;
        let msg = data?.message ?? 'Bulk submit failed';
        if (Array.isArray(data?.skipped) && data.skipped.length > 0) {
          const reasons = data.skipped.map((s) => `#${s.id}: ${s.reason}`).join('; ');
          msg += ` Details: ${reasons}`;
        }
        setBulkMsg({ type: 'danger', text: msg });
      } else {
        setBulkMsg({ type: 'danger', text: 'Bulk submit failed. Check your connection and try again.' });
      }
    } finally {
      setBulkSubmitting(false);
    }
  };

  const liveEntryStatus = entryIndicator ? computeEntryStatus(entryIndicator, responses) : null;
  const isEntryComplete = liveEntryStatus === 'complete';

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

          {bulkEligible.length > 0 && (
            <div
              className="d-flex flex-wrap align-items-center gap-3 mb-3 p-3 rounded-3 border"
              style={{ background: '#f0f7ff', borderColor: '#bfdbfe' }}
            >
              <Form.Check
                type="checkbox"
                id="select-all-eligible"
                label={<span className="small fw-semibold">Select all ready to submit ({bulkEligible.length})</span>}
                checked={allEligibleSelected}
                onChange={toggleSelectAllEligible}
              />
              <Button
                size="sm"
                variant="primary"
                style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                disabled={bulkSubmitting || selectedEligibleCount === 0}
                onClick={() => void handleBulkSubmit()}
              >
                <span className="material-symbols-outlined me-1" style={{ fontSize: '16px', verticalAlign: 'middle' }}>send</span>
                {bulkSubmitting
                  ? 'Submitting…'
                  : `Submit selected to ${HOD_UNIT_HEAD_LABEL} (${selectedEligibleCount})`}
              </Button>
              <span className="text-muted small">
                Only completed indicators not yet submitted can be selected.
              </span>
            </div>
          )}

          {bulkMsg && (
            <div className={`alert alert-${bulkMsg.type} small py-2 mb-3`}>{bulkMsg.text}</div>
          )}

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
                <IndicatorCard
                  key={ind.id}
                  ind={ind}
                  onOpen={openEntry}
                  selectable={isBulkSubmitEligible(ind)}
                  selected={selectedIds.has(ind.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Modal show={!!entryIndicator} onHide={() => void closeEntry()} size="xl" scrollable>
        {entryIndicator && (() => {
          const readOnly = isSubmissionReadOnly(entryIndicator);
          const hasPrev = entryNavIndex > 0;
          const hasNext = entryNavIndex >= 0 && entryNavIndex < filteredIndicators.length - 1;
          return (
            <>
              <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #1e40af, var(--mubs-navy, #1a3a5c))', color: '#fff' }}>
                <Modal.Title className="fs-6 fw-bold">
                  <span className="material-symbols-outlined me-2" style={{ fontSize: '18px', verticalAlign: 'middle' }}>assignment</span>
                  {readOnly ? 'View submission' : 'Data Entry'} — {entryIndicator.indicator_text}
                  {filteredIndicators.length > 1 && entryNavIndex >= 0 && (
                    <span className="fw-normal ms-2 opacity-75" style={{ fontSize: '0.75rem' }}>
                      ({entryNavIndex + 1} of {filteredIndicators.length})
                    </span>
                  )}
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <div className="mb-3 small d-flex flex-wrap gap-1 align-items-center">
                  <Badge bg="light" className="text-dark border">{entryIndicator.department_name}</Badge>
                  <IndicatorFyTargetGroup
                    financialYears={entryIndicator.financial_years}
                    targets={entryIndicator.targets}
                  />
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

                {saveErr && (
                  <div className="alert alert-danger small py-2 mb-3">
                    <span className="material-symbols-outlined me-1" style={{ fontSize: '14px', verticalAlign: 'middle' }}>error</span>
                    {saveErr}
                  </div>
                )}

                <p className="small text-muted mb-2">
                  Indicator targets are shown above for each financial year. Enter your office&apos;s figures in the table below.
                </p>

                <div className="table-responsive">
                  <table className="table table-bordered table-sm" style={METRIC_ENTRY_TABLE.table}>
                    <colgroup>
                      <col />
                      <col style={METRIC_ENTRY_TABLE.col.unit} />
                      {entryIndicator.financial_years.map((fy) => (
                        <col key={`${fy}-actual`} style={METRIC_ENTRY_TABLE.col.actual} />
                      ))}
                      <col style={METRIC_ENTRY_TABLE.col.comment} />
                    </colgroup>
                    <thead className="table-dark">
                      <tr>
                        <th style={METRIC_ENTRY_TABLE.th.metric}>Performance Metric</th>
                        <th className="text-center" style={METRIC_ENTRY_TABLE.th.unit}>UNIT</th>
                        {entryIndicator.financial_years.map((fy) => (
                          <th
                            key={`${fy}-actual`}
                            className="text-center"
                            style={{ ...METRIC_ENTRY_TABLE.th.fy, ...METRIC_ENTRY_TABLE.th.actual }}
                          >
                            {fyShortLabel(fy)}
                          </th>
                        ))}
                        <th style={METRIC_ENTRY_TABLE.th.comment}>
                          Comment <span className="fw-normal opacity-75">(optional)</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entryIndicator.metrics.map((m, mi) => (
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
                          {entryIndicator.financial_years.map((fy) => {
                            const key = `${m.id}_${fy}`;
                            const val = responses[key] ?? '';
                            const err = validationErrors[key];
                            const isMissing = missingFields.has(key);
                            const displayVal = val.trim() || null;
                            return (
                              <td
                                key={`${fy}-actual`}
                                style={{
                                  ...METRIC_ENTRY_TABLE.td.actual,
                                  ...(isMissing ? { background: '#fff5f5' } : {}),
                                }}
                              >
                                {readOnly ? (
                                  <span
                                    className={`d-block text-center ${displayVal ? 'fw-semibold' : 'text-muted'}`}
                                    style={{ fontSize: '0.78rem', fontStyle: displayVal ? 'normal' : 'italic', wordBreak: 'break-word' }}
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
                                      isInvalid={!!err || isMissing}
                                      aria-label={`Actual value for ${m.metric_text}, ${fyShortLabel(fy)}`}
                                      style={{
                                        ...METRIC_ENTRY_TABLE.td.input,
                                        borderColor: isMissing ? '#dc3545' : undefined,
                                        boxShadow: isMissing ? '0 0 0 0.15rem rgba(220,53,69,.2)' : undefined,
                                      }}
                                      as={m.unit_of_measure === 'text' || m.unit_of_measure === 'list' ? 'textarea' : 'input'}
                                      {...(m.unit_of_measure === 'text' || m.unit_of_measure === 'list' ? { rows: 2 } : {})}
                                    />
                                    {err && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{err}</div>}
                                    {isMissing && !err && (
                                      <div className="text-danger" style={{ fontSize: '0.65rem' }}>Required</div>
                                    )}
                                  </>
                                )}
                              </td>
                            );
                          })}
                          <td style={METRIC_ENTRY_TABLE.td.comment}>
                            {readOnly ? (
                              <span
                                className={`d-block ${(metricComments[String(m.id)] ?? '').trim() ? '' : 'text-muted'}`}
                                style={{ fontSize: '0.78rem', fontStyle: (metricComments[String(m.id)] ?? '').trim() ? 'normal' : 'italic', wordBreak: 'break-word' }}
                              >
                                {(metricComments[String(m.id)] ?? '').trim() || '—'}
                              </span>
                            ) : (
                              <Form.Control
                                as="textarea"
                                rows={2}
                                size="sm"
                                value={metricComments[String(m.id)] ?? ''}
                                onChange={(e) => setComment(m.id, e.target.value)}
                                placeholder="Note…"
                                style={METRIC_ENTRY_TABLE.td.input}
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Modal.Body>
              <Modal.Footer className="flex-column gap-0 p-0">
                <div
                  className="w-100 px-3 py-2 border-top d-flex align-items-center"
                  style={{ minHeight: '36px', background: '#f8fafc' }}
                >
                  {saving && (
                    <span className="small text-muted">
                      <Spinner animation="border" size="sm" className="me-2" style={{ width: '0.75rem', height: '0.75rem' }} />
                      Saving draft…
                    </span>
                  )}
                  {!saving && saveOk && (
                    <span className="small text-success">
                      <span className="material-symbols-outlined me-1" style={{ fontSize: '14px', verticalAlign: 'middle' }}>check_circle</span>
                      Saved successfully!
                    </span>
                  )}
                  {!saving && autoSaveNote && !saveOk && (
                    <span className="small text-muted">
                      <span className="material-symbols-outlined me-1" style={{ fontSize: '14px', verticalAlign: 'middle' }}>cloud_done</span>
                      {autoSaveNote}
                    </span>
                  )}
                  {!saving && !readOnly && isEntryDirty && !saveOk && !autoSaveNote && (
                    <span className="small text-muted">
                      <span className="material-symbols-outlined me-1" style={{ fontSize: '14px', verticalAlign: 'middle' }}>edit_note</span>
                      Unsaved changes — draft is saved when you go to another indicator or close.
                    </span>
                  )}
                </div>
                <div className="w-100 d-flex flex-wrap gap-2 p-3">
                <Button size="sm" variant="outline-secondary" onClick={() => void closeEntry()} disabled={saving}>
                  Close
                </Button>
                {filteredIndicators.length > 1 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      disabled={!hasPrev || saving}
                      onClick={() => void navigateEntry(-1)}
                    >
                      <span className="material-symbols-outlined me-1" style={{ fontSize: '14px', verticalAlign: 'middle' }}>chevron_left</span>
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      disabled={!hasNext || saving}
                      onClick={() => void navigateEntry(1)}
                    >
                      Next
                      <span className="material-symbols-outlined ms-1" style={{ fontSize: '14px', verticalAlign: 'middle' }}>chevron_right</span>
                    </Button>
                  </>
                )}
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
                      style={{
                        background: 'var(--mubs-blue)',
                        borderColor: 'var(--mubs-blue)',
                        opacity: isEntryComplete ? 1 : 0.85,
                      }}
                      onClick={handleSubmitClick}
                      disabled={saving || Object.keys(validationErrors).length > 0}
                    >
                      {saving ? 'Submitting…' : `Submit for ${HOD_UNIT_HEAD_LABEL} review`}
                    </Button>
                  </>
                )}
                </div>
              </Modal.Footer>
            </>
          );
        })()}
      </Modal>
    </div>
  );
}
