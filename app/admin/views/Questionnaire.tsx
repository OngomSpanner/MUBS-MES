'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import { Modal, Button, Form, Badge } from 'react-bootstrap';
import axios from 'axios';
import DeleteConfirmModal from '@/components/Questionnaire/DeleteConfirmModal';
import DepartmentUnitMultiSelect, { type DepartmentUnitOption } from '@/components/DepartmentUnitMultiSelect';
import { getAvailableFinancialYears } from '@/lib/questionnaire/fy-utils';
import { UOM_OPTIONS } from '@/lib/questionnaire/uom';
import { CORE_OBJECTIVES_2025_2030, coreObjectiveNumber, coreObjectiveShortTitle } from '@/lib/strategic-plan';
import { summarizeIndicatorDepartments } from '@/lib/summarize-indicator-departments';
import { expandAmbassadorGroupSelection } from '@/lib/expand-ambassador-group-selection';
import type { AmbassadorDepartmentGroup } from '@/lib/department-ambassador-groups';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
type Outcome = {
  id: number;
  type: 'Outcome' | 'Output';
  label: string;
  strategic_objective: string | null;
  indicator_count: number;
};
type MetricFormRow = { id?: number; metric_text: string; unit_of_measure: string };
type Indicator = {
  id: number; outcome_id: number; indicator_text: string; is_locked: boolean;
  outcome_type: string; outcome_label: string; outcome_strategic_objective: string | null;
  created_at: string;
  metrics: { id: number; metric_text: string; unit_of_measure: string; sort_order: number }[];
  departments: { id: number; name: string }[];
  financial_years: string[];
  assigned_groups?: AmbassadorDepartmentGroup[];
};

type IndicatorResponse = {
  metric_id: number;
  department_id: number;
  department_name: string;
  financial_year: string;
  value: string | null;
  submitted_at: string | null;
  updated_at: string | null;
};

const AVAILABLE_FYS = getAvailableFinancialYears();

function emptyMetricRow(): MetricFormRow {
  return { metric_text: '', unit_of_measure: 'numeric' };
}

function StrategicObjectiveSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <Form.Select
      id={id}
      size="sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
    >
      <option value="">Select strategic objective…</option>
      {CORE_OBJECTIVES_2025_2030.map((obj, i) => (
        <option key={obj} value={obj} title={obj}>
          Objective {i + 1}
        </option>
      ))}
    </Form.Select>
  );
}

type OutcomeGroupSection = { objective: string | null; outcomes: Outcome[] };

function groupOutcomesByObjective(outcomes: Outcome[]): OutcomeGroupSection[] {
  const byObjective = new Map<string, Outcome[]>();
  const unassigned: Outcome[] = [];
  for (const o of outcomes) {
    if (o.strategic_objective) {
      const list = byObjective.get(o.strategic_objective) ?? [];
      list.push(o);
      byObjective.set(o.strategic_objective, list);
    } else {
      unassigned.push(o);
    }
  }
  const sections: OutcomeGroupSection[] = [];
  for (const obj of CORE_OBJECTIVES_2025_2030) {
    const list = byObjective.get(obj);
    if (list?.length) sections.push({ objective: obj, outcomes: list });
  }
  if (unassigned.length) sections.push({ objective: null, outcomes: unassigned });
  return sections;
}

type IndicatorOutcomeGroup = {
  outcomeId: number;
  outcomeType: string;
  outcomeLabel: string;
  indicators: Indicator[];
};

function groupIndicatorsByObjective(indicators: Indicator[]): {
  objective: string | null;
  outcomes: IndicatorOutcomeGroup[];
}[] {
  const objectiveMap = new Map<string, Map<number, IndicatorOutcomeGroup>>();
  const unassignedKey = '__unassigned__';

  for (const ind of indicators) {
    const objKey = ind.outcome_strategic_objective || unassignedKey;
    if (!objectiveMap.has(objKey)) objectiveMap.set(objKey, new Map());
    const outcomesMap = objectiveMap.get(objKey)!;
    if (!outcomesMap.has(ind.outcome_id)) {
      outcomesMap.set(ind.outcome_id, {
        outcomeId: ind.outcome_id,
        outcomeType: ind.outcome_type,
        outcomeLabel: ind.outcome_label,
        indicators: [],
      });
    }
    outcomesMap.get(ind.outcome_id)!.indicators.push(ind);
  }

  const sections: { objective: string | null; outcomes: IndicatorOutcomeGroup[] }[] = [];
  for (const obj of CORE_OBJECTIVES_2025_2030) {
    const outcomesMap = objectiveMap.get(obj);
    if (outcomesMap?.size) {
      sections.push({ objective: obj, outcomes: Array.from(outcomesMap.values()) });
    }
  }
  const unassigned = objectiveMap.get(unassignedKey);
  if (unassigned?.size) {
    sections.push({ objective: null, outcomes: Array.from(unassigned.values()) });
  }
  return sections;
}

function indicatorSearchHaystack(ind: Indicator): string {
  const objNum = coreObjectiveNumber(ind.outcome_strategic_objective);
  return [
    ind.indicator_text,
    ind.outcome_label,
    ind.outcome_type,
    ind.outcome_strategic_objective ?? '',
    coreObjectiveShortTitle(ind.outcome_strategic_objective),
    objNum != null ? `objective ${objNum}` : '',
  ]
    .join(' ')
    .toLowerCase();
}

// ────────────────────────────────────────────────────────────
// Sub-panel: Manage Outcomes
// ────────────────────────────────────────────────────────────
function ManageOutcomesPanel({
  outcomes, onRefresh,
}: { outcomes: Outcome[]; onRefresh: () => void }) {
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<'Outcome' | 'Output'>('Outcome');
  const [newObjective, setNewObjective] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editType, setEditType] = useState<'Outcome' | 'Output'>('Outcome');
  const [editObjective, setEditObjective] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Outcome | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleAdd = async () => {
    if (!newObjective) return setErr('Strategic objective is required');
    if (!newLabel.trim()) return setErr('Label is required');
    setSaving(true); setErr(null);
    try {
      await axios.post('/api/questionnaire/outcomes', {
        type: newType,
        label: newLabel.trim(),
        strategic_objective: newObjective,
      });
      setAdding(false);
      setNewLabel('');
      setNewObjective('');
      onRefresh();
    } catch (e: unknown) { setErr(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Error' : 'Error'); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editObjective) return setErr('Strategic objective is required');
    if (!editLabel.trim()) return setErr('Label is required');
    setSaving(true); setErr(null);
    try {
      await axios.put(`/api/questionnaire/outcomes/${editId}`, {
        type: editType,
        label: editLabel.trim(),
        strategic_objective: editObjective,
      });
      setEditId(null); onRefresh();
    } catch (e: unknown) { setErr(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Error' : 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/questionnaire/outcomes/${deleteTarget.id}`);
      setDeleteTarget(null); onRefresh();
    } catch (e: unknown) {
      alert(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Error deleting' : 'Error deleting');
    } finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h6 className="fw-bold mb-0">Outcomes &amp; Outputs <Badge bg="secondary">{outcomes.length}</Badge></h6>
        <Button size="sm" variant="primary" style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }} onClick={() => { setAdding(true); setErr(null); }}>
          <span className="material-symbols-outlined me-1" style={{ fontSize: '16px', verticalAlign: 'middle' }}>add</span> Add New
        </Button>
      </div>

      {err && <div className="alert alert-danger py-2 small mb-2">{err}</div>}

      {adding && (
        <div className="border rounded-3 p-3 mb-3 bg-light">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <Form.Label className="small fw-bold mb-1">Type</Form.Label>
              <Form.Select size="sm" value={newType} onChange={(e) => setNewType(e.target.value as 'Outcome' | 'Output')}>
                <option value="Outcome">Outcome</option>
                <option value="Output">Output</option>
              </Form.Select>
            </div>
            <div className="col-md-9">
              <Form.Label className="small fw-bold mb-1">Strategic objective <span className="text-danger">*</span></Form.Label>
              <StrategicObjectiveSelect value={newObjective} onChange={setNewObjective} />
            </div>
            <div className="col-md-10">
              <Form.Label className="small fw-bold mb-1">Label / Name <span className="text-danger">*</span></Form.Label>
              <Form.Control size="sm" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Outcome 6.1: Increased Participation in Sports…" autoFocus />
            </div>
            <div className="col-md-2 d-flex gap-1">
              <Button size="sm" variant="success" onClick={handleAdd} disabled={saving}>Save</Button>
              <Button size="sm" variant="outline-secondary" onClick={() => { setAdding(false); setErr(null); setNewObjective(''); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {outcomes.length === 0 && !adding && (
        <div className="text-center text-muted py-5 small">
          <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '2rem' }}>account_tree</span>
          No outcomes/outputs yet. Add one above.
        </div>
      )}

      <div className="d-flex flex-column gap-4">
        {groupOutcomesByObjective(outcomes).map((section) => (
          <div key={section.objective ?? 'unassigned'}>
            <div className="mb-2">
              <div className="fw-bold small text-primary">{coreObjectiveShortTitle(section.objective)}</div>
              {section.objective ? (
                <div className="text-muted" style={{ fontSize: '0.72rem', lineHeight: 1.35 }}>{section.objective}</div>
              ) : (
                <div className="text-muted small">Assign an objective when editing these entries.</div>
              )}
            </div>
            <div className="d-flex flex-column gap-2">
              {section.outcomes.map((o) => (
                <div key={o.id} className="border rounded-3 p-3 d-flex align-items-center gap-3 flex-wrap" style={{ background: '#f8fafc' }}>
                  {editId === o.id ? (
                    <>
                      <Form.Select size="sm" value={editType} onChange={(e) => setEditType(e.target.value as 'Outcome' | 'Output')} style={{ width: '110px', flexShrink: 0 }}>
                        <option value="Outcome">Outcome</option>
                        <option value="Output">Output</option>
                      </Form.Select>
                      <div className="flex-grow-1 d-flex flex-column gap-2" style={{ minWidth: '220px' }}>
                        <StrategicObjectiveSelect value={editObjective} onChange={setEditObjective} />
                        <Form.Control size="sm" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} autoFocus />
                      </div>
                      <div className="d-flex gap-1">
                        <Button size="sm" variant="success" onClick={handleEdit} disabled={saving}>Save</Button>
                        <Button size="sm" variant="outline-secondary" onClick={() => setEditId(null)}>Cancel</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Badge bg={o.type === 'Output' ? 'info' : 'warning'} className="text-dark" style={{ fontSize: '0.65rem' }}>{o.type}</Badge>
                      <span className="flex-grow-1 small fw-semibold" style={{ minWidth: 0 }}>{o.label}</span>
                      <span className="text-muted" style={{ fontSize: '0.72rem', flexShrink: 0 }}>{o.indicator_count} indicator{o.indicator_count !== 1 ? 's' : ''}</span>
                      <div className="d-flex gap-1 flex-shrink-0">
                        <Button size="sm" variant="outline-secondary" onClick={() => {
                          setEditId(o.id);
                          setEditType(o.type);
                          setEditLabel(o.label);
                          setEditObjective(o.strategic_objective ?? '');
                          setErr(null);
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle' }}>edit</span>
                        </Button>
                        <Button size="sm" variant="outline-danger" onClick={() => setDeleteTarget(o)} disabled={o.indicator_count > 0} title={o.indicator_count > 0 ? 'Delete indicators first' : 'Delete'}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle' }}>delete</span>
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <DeleteConfirmModal
        show={!!deleteTarget}
        onHide={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Outcome/Output"
        simple
        itemDescription={`Delete "${deleteTarget?.label}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Create / Edit Template modal
// ────────────────────────────────────────────────────────────
function TemplateModal({
  show, onHide, outcomes, allDepartments, editingIndicator, onSaved, onDepartmentSync,
}: {
  show: boolean;
  onHide: () => void;
  outcomes: Outcome[];
  allDepartments: DepartmentUnitOption[];
  editingIndicator: Indicator | null;
  onSaved: () => void;
  onDepartmentSync?: () => void;
}) {
  const [outcomeId, setOutcomeId] = useState<string>('');
  const [indicatorText, setIndicatorText] = useState('');
  const [deptIds, setDeptIds] = useState<number[]>([]);
  const [subscribedGroups, setSubscribedGroups] = useState<AmbassadorDepartmentGroup[]>([]);
  const [selectedFYs, setSelectedFYs] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<MetricFormRow[]>([emptyMetricRow()]);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isEditing = Boolean(editingIndicator);

  useEffect(() => {
    if (!show) return;
    if (!editingIndicator) {
      resetForm();
      return;
    }

    let cancelled = false;
    setLoadingDetail(true);
    setErr(null);

    (async () => {
      try {
        const res = await axios.get(`/api/questionnaire/indicators/${editingIndicator.id}`);
        if (cancelled) return;
        const ind = res.data as Indicator;
        const groups = ind.assigned_groups ?? [];
        const baseIds = ind.departments.map((d) => d.id);
        const expandedIds = expandAmbassadorGroupSelection(baseIds, allDepartments, groups);

        setOutcomeId(String(ind.outcome_id));
        setIndicatorText(ind.indicator_text);
        setSubscribedGroups(groups);
        setDeptIds(expandedIds);
        setSelectedFYs([...ind.financial_years]);
        setMetrics(ind.metrics.length > 0
          ? ind.metrics.map((m) => ({ id: m.id, metric_text: m.metric_text, unit_of_measure: m.unit_of_measure }))
          : [emptyMetricRow()]);

        if (expandedIds.length !== editingIndicator.departments.length) {
          onDepartmentSync?.();
        }
      } catch {
        if (cancelled) return;
        const baseIds = editingIndicator.departments.map((d) => d.id);
        setOutcomeId(String(editingIndicator.outcome_id));
        setIndicatorText(editingIndicator.indicator_text);
        setSubscribedGroups(editingIndicator.assigned_groups ?? []);
        setDeptIds(expandAmbassadorGroupSelection(baseIds, allDepartments, editingIndicator.assigned_groups));
        setSelectedFYs([...editingIndicator.financial_years]);
        setMetrics(editingIndicator.metrics.length > 0
          ? editingIndicator.metrics.map((m) => ({ id: m.id, metric_text: m.metric_text, unit_of_measure: m.unit_of_measure }))
          : [emptyMetricRow()]);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();

    return () => { cancelled = true; };
  }, [show, editingIndicator?.id, allDepartments, onDepartmentSync]);

  useEffect(() => {
    if (!show || !isEditing || deptIds.length === 0 || allDepartments.length === 0) return;
    setDeptIds((prev) => {
      const expanded = expandAmbassadorGroupSelection(prev, allDepartments, subscribedGroups);
      if (expanded.length === prev.length && expanded.every((id) => prev.includes(id))) return prev;
      return expanded;
    });
  }, [show, isEditing, allDepartments, subscribedGroups]);

  function resetForm() {
    setOutcomeId(''); setIndicatorText(''); setDeptIds([]); setSubscribedGroups([]);
    setSelectedFYs([]); setMetrics([emptyMetricRow()]); setErr(null); setSuccess(false);
  }

  const toggleFY = (fy: string) =>
    setSelectedFYs((prev) => prev.includes(fy) ? prev.filter((f) => f !== fy) : [...prev, fy]);

  const addMetric = () => setMetrics((prev) => [...prev, emptyMetricRow()]);
  const removeMetric = (i: number) => setMetrics((prev) => prev.filter((_, idx) => idx !== i));
  const updateMetric = (i: number, field: keyof MetricFormRow, val: string) =>
    setMetrics((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  const moveMetric = (i: number, dir: -1 | 1) => {
    const arr = [...metrics];
    const target = i + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[i], arr[target]] = [arr[target], arr[i]];
    setMetrics(arr);
  };

  const handleSave = async () => {
    setErr(null);
    if (!outcomeId) return setErr('Select an Outcome / Output.');
    if (!indicatorText.trim()) return setErr('Performance indicator text is required.');
    if (deptIds.length === 0) return setErr('Select at least one department.');
    if (selectedFYs.length === 0) return setErr('Select at least one financial year.');
    const validMetrics = metrics.filter((m) => m.metric_text.trim());
    if (validMetrics.length === 0) return setErr('Add at least one performance metric.');

    setSaving(true);
    try {
      const payload = {
        outcome_id: Number(outcomeId),
        indicator_text: indicatorText.trim(),
        department_ids: deptIds,
        financial_years: selectedFYs,
        metrics: validMetrics,
      };
      if (isEditing && editingIndicator) {
        await axios.put(`/api/questionnaire/indicators/${editingIndicator.id}`, payload);
      } else {
        await axios.post('/api/questionnaire/indicators', payload);
      }
      setSuccess(true);
      onSaved();
      if (!isEditing) {
        resetForm();
        setTimeout(() => setSuccess(false), 1500);
      }
    } catch (e: unknown) {
      setErr(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Save failed' : 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" scrollable centered className="modal-questionnaire-template">
      <Modal.Header closeButton className="py-2">
        <Modal.Title className="fs-6 fw-bold">
          {isEditing ? 'Edit Indicator' : 'Create Template'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loadingDetail && (
          <div className="text-muted small mb-2">Loading latest department assignments…</div>
        )}
        {isEditing && (
          <div className="alert alert-info py-2 small mb-3">
            Changes to departments and financial years will not affect collected data.
          </div>
        )}
        {err && <div className="alert alert-danger py-2 small mb-3">{err}</div>}
        {success && <div className="alert alert-success py-2 small mb-3">Saved successfully!</div>}

        <div className="d-flex flex-column gap-3">
        {/* Section 1 */}
        <div className="border rounded-3 p-3">
          <h6 className="fw-bold text-primary small mb-3">1. Outcome / Output &amp; Indicator</h6>
          <div className="row g-2">
            <div className="col-12">
              <Form.Label className="small fw-bold mb-1">Outcome / Output <span className="text-danger">*</span></Form.Label>
              <Form.Select size="sm" value={outcomeId} onChange={(e) => setOutcomeId(e.target.value)}>
                <option value="">— Select —</option>
                {CORE_OBJECTIVES_2025_2030.map((obj, i) => {
                  const opts = outcomes.filter((o) => o.strategic_objective === obj);
                  if (!opts.length) return null;
                  return (
                    <optgroup key={obj} label={`Objective ${i + 1}`}>
                      {opts.map((o) => (
                        <option key={o.id} value={o.id}>{o.type}: {o.label}</option>
                      ))}
                    </optgroup>
                  );
                })}
                {outcomes.filter((o) => !o.strategic_objective).length > 0 && (
                  <optgroup label="Unassigned objective">
                    {outcomes.filter((o) => !o.strategic_objective).map((o) => (
                      <option key={o.id} value={o.id}>{o.type}: {o.label}</option>
                    ))}
                  </optgroup>
                )}
              </Form.Select>
            </div>
            <div className="col-12">
              <Form.Label className="small fw-bold mb-1">Performance Indicator <span className="text-danger">*</span></Form.Label>
              <Form.Control size="sm" as="textarea" rows={2} value={indicatorText} onChange={(e) => setIndicatorText(e.target.value)} placeholder="e.g. Number of National sports events hosted" />
            </div>
          </div>
        </div>

        {/* Section 2 */}
        <div className="border rounded-3 p-3">
          <h6 className="fw-bold text-primary small mb-3">2. Responsible Departments &amp; Financial Years</h6>
          <DepartmentUnitMultiSelect
            departments={allDepartments}
            selectedIds={deptIds}
            onChange={setDeptIds}
            label="Responsible Department(s) / Unit(s)"
            disabled={loadingDetail}
          />
          <Form.Label className="small fw-bold mb-1 mt-2">Financial Year(s) <span className="text-danger">*</span></Form.Label>
          <div className="d-flex flex-wrap gap-2">
            {AVAILABLE_FYS.map((fy) => (
              <button
                key={fy}
                type="button"
                onClick={() => toggleFY(fy)}
                className={`btn btn-sm ${selectedFYs.includes(fy) ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={selectedFYs.includes(fy) ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : { fontSize: '0.78rem' }}
              >{fy}</button>
            ))}
          </div>
          {selectedFYs.length > 0 && (
            <div className="mt-2 d-flex flex-wrap gap-1">
              {selectedFYs.map((fy) => (
                <Badge key={fy} bg="primary" style={{ background: 'var(--mubs-blue)', fontSize: '0.68rem' }}>
                  {fy}
                  <button className="ms-1 bg-transparent border-0 text-white p-0" style={{ fontSize: '0.65rem' }} onClick={() => toggleFY(fy)}>×</button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Section 3 */}
        <div className="border rounded-3 p-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="fw-bold text-primary small mb-0">3. Performance Metrics <span className="text-danger">*</span></h6>
            <Button type="button" size="sm" variant="outline-primary" onClick={addMetric} disabled={saving}>
              + Add Metric
            </Button>
          </div>
          <p className="text-muted small mb-2" style={{ fontSize: '0.78rem' }}>List metrics in order. Set the Unit of Measure for each.</p>
          <div className="d-flex flex-column gap-2">
            {metrics.map((m, i) => (
              <div key={i} className="border rounded-2 p-2 bg-light bg-opacity-50 d-flex gap-2 align-items-start">
                <div className="bg-white border rounded-circle text-center fw-bold flex-shrink-0" style={{ width: '24px', height: '24px', lineHeight: '22px', fontSize: '0.72rem', marginTop: '4px' }}>{i + 1}</div>
                <Form.Control
                  size="sm"
                  as="textarea"
                  rows={2}
                  className="flex-grow-1"
                  value={m.metric_text}
                  onChange={(e) => updateMetric(i, 'metric_text', e.target.value)}
                  placeholder="Metric description…"
                />
                <Form.Select size="sm" value={m.unit_of_measure} onChange={(e) => updateMetric(i, 'unit_of_measure', e.target.value)} style={{ width: '140px', flexShrink: 0 }}>
                  {UOM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Form.Select>
                <div className="d-flex flex-column gap-1 flex-shrink-0">
                  <button type="button" className="btn btn-outline-secondary btn-sm p-0" style={{ width: '24px', height: '24px', lineHeight: '1' }} onClick={() => moveMetric(i, -1)} disabled={i === 0} title="Move up">▲</button>
                  <button type="button" className="btn btn-outline-secondary btn-sm p-0" style={{ width: '24px', height: '24px', lineHeight: '1' }} onClick={() => moveMetric(i, 1)} disabled={i === metrics.length - 1} title="Move down">▼</button>
                </div>
                {metrics.length > 1 && (
                  <Button size="sm" variant="outline-danger" className="flex-shrink-0 p-1" style={{ width: '28px', height: '28px', lineHeight: '1' }} onClick={() => removeMetric(i)} title="Remove">×</Button>
                )}
              </div>
            ))}
          </div>
        </div>
        </div>
      </Modal.Body>
      <Modal.Footer className="py-2 gap-2 justify-content-end">
        <Button type="button" variant="outline-primary" size="sm" onClick={addMetric} disabled={saving}>
          + Add Metric
        </Button>
        <Button variant="outline-secondary" size="sm" onClick={onHide} disabled={saving}>Cancel</Button>
        <Button
          variant="primary"
          size="sm"
          style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : isEditing ? 'Update Indicator' : 'Save Indicator'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────
// Indicators list
// ────────────────────────────────────────────────────────────
function IndicatorsPanel({
  indicators, ambassadorCatalog, onEdit, onCreate, onRefresh,
}: {
  indicators: Indicator[];
  ambassadorCatalog: DepartmentUnitOption[];
  onEdit: (ind: Indicator) => void;
  onCreate: () => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [objectiveFilter, setObjectiveFilter] = useState<'all' | string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [responsesByIndicator, setResponsesByIndicator] = useState<Record<number, IndicatorResponse[]>>({});
  const [loadingResponses, setLoadingResponses] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ ind: Indicator; responseCount: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lockingId, setLockingId] = useState<number | null>(null);

  const groupCatalog = useMemo(
    () =>
      ambassadorCatalog.map((d) => ({
        id: d.id,
        ambassador_group: d.ambassador_group ?? null,
      })),
    [ambassadorCatalog],
  );

  const loadResponses = async (indicatorId: number, force = false) => {
    if (!force && (responsesByIndicator[indicatorId] || loadingResponses.has(indicatorId))) return;
    setLoadingResponses((prev) => new Set(prev).add(indicatorId));
    try {
      const res = await axios.get(`/api/questionnaire/indicators/${indicatorId}/responses`);
      setResponsesByIndicator((prev) => ({
        ...prev,
        [indicatorId]: Array.isArray(res.data) ? res.data : [],
      }));
    } catch {
      setResponsesByIndicator((prev) => ({ ...prev, [indicatorId]: [] }));
    } finally {
      setLoadingResponses((prev) => {
        const next = new Set(prev);
        next.delete(indicatorId);
        return next;
      });
    }
  };

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(id)) {
        s.delete(id);
        setResponsesByIndicator((prevR) => {
          const next = { ...prevR };
          delete next[id];
          return next;
        });
      } else {
        s.add(id);
        void loadResponses(id, true);
      }
      return s;
    });
  };

  const responseValue = (
    responses: IndicatorResponse[],
    departmentId: number,
    metricId: number,
    fy: string,
  ): string | null => {
    const row = responses.find(
      (r) => r.department_id === departmentId && r.metric_id === metricId && r.financial_year === fy
    );
    const v = row?.value;
    return v != null && String(v).trim() !== '' ? String(v) : null;
  };

  const handleDeleteClick = async (ind: Indicator) => {
    try {
      const res = await axios.delete(`/api/questionnaire/indicators/${ind.id}`);
      if (res.status === 200) { onRefresh(); return; }
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        setDeleteTarget({ ind, responseCount: e.response.data.response_count ?? 0 });
      } else {
        alert('Error deleting indicator');
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/questionnaire/indicators/${deleteTarget.ind.id}?confirmed=1`);
      setDeleteTarget(null); onRefresh();
    } catch { alert('Error deleting'); }
    finally { setDeleting(false); }
  };

  const handleLock = async (ind: Indicator) => {
    setLockingId(ind.id);
    try {
      await axios.post(`/api/questionnaire/indicators/${ind.id}/lock`, { locked: !ind.is_locked });
      onRefresh();
    } catch { alert('Error toggling lock'); }
    finally { setLockingId(null); }
  };

  // Group by objective → outcome/output
  const outcomeOptions = useMemo(() => {
    const map = new Map<number, { id: number; type: string; label: string; objective: string | null }>();
    for (const ind of indicators) {
      if (!map.has(ind.outcome_id)) {
        map.set(ind.outcome_id, {
          id: ind.outcome_id,
          type: ind.outcome_type,
          label: ind.outcome_label,
          objective: ind.outcome_strategic_objective,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [indicators]);

  const outcomeOptionsForFilter = useMemo(() => {
    if (objectiveFilter === 'all') return outcomeOptions;
    if (objectiveFilter === 'unassigned') {
      return outcomeOptions.filter((o) => !o.objective);
    }
    return outcomeOptions.filter((o) => o.objective === objectiveFilter);
  }, [objectiveFilter, outcomeOptions]);

  const filteredIndicators = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return indicators.filter((ind) => {
      if (objectiveFilter !== 'all') {
        if (objectiveFilter === 'unassigned') {
          if (ind.outcome_strategic_objective) return false;
        } else if (ind.outcome_strategic_objective !== objectiveFilter) {
          return false;
        }
      }
      if (outcomeFilter !== 'all' && ind.outcome_id !== Number(outcomeFilter)) {
        return false;
      }
      if (term && !indicatorSearchHaystack(ind).includes(term)) {
        return false;
      }
      return true;
    });
  }, [indicators, objectiveFilter, outcomeFilter, searchTerm]);

  const indicatorSections = groupIndicatorsByObjective(filteredIndicators);
  const hasUnassignedObjective = indicators.some((i) => !i.outcome_strategic_objective);

  const renderToolbar = (badgeCount: number) => (
    <div className="mb-3 d-flex flex-wrap gap-2 align-items-center">
      <h6 className="fw-bold mb-0">Indicators <Badge bg="secondary">{badgeCount}</Badge></h6>
      <div className="ms-auto d-flex flex-wrap gap-2 align-items-center">
        <Form.Control
          type="search"
          size="sm"
          placeholder="Search objective, outcome/output, indicator…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '240px' }}
          aria-label="Search indicators"
        />
        <Form.Select
          size="sm"
          value={objectiveFilter}
          onChange={(e) => {
            setObjectiveFilter(e.target.value);
            setOutcomeFilter('all');
          }}
          style={{ width: '170px' }}
          title="Filter by strategic objective"
        >
          <option value="all">All objectives</option>
          {CORE_OBJECTIVES_2025_2030.map((obj, i) => (
            <option key={obj} value={obj}>Objective {i + 1}</option>
          ))}
          {hasUnassignedObjective ? <option value="unassigned">Unassigned objective</option> : null}
        </Form.Select>
        <Form.Select
          size="sm"
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          style={{ width: '260px' }}
          title="Filter by outcome or output"
        >
          <option value="all">All outcomes / outputs</option>
          {outcomeOptionsForFilter.map((o) => (
            <option key={o.id} value={String(o.id)}>{o.type}: {o.label}</option>
          ))}
        </Form.Select>
        <Button
          size="sm"
          variant="primary"
          style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
          onClick={onCreate}
        >
          <span className="material-symbols-outlined me-1" style={{ fontSize: '16px', verticalAlign: 'middle' }}>add</span>
          Create Template
        </Button>
      </div>
    </div>
  );

  if (indicators.length === 0) {
    return (
      <div>
        <div className="mb-3 d-flex justify-content-end">
          <Button
            size="sm"
            variant="primary"
            style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
            onClick={onCreate}
          >
            <span className="material-symbols-outlined me-1" style={{ fontSize: '16px', verticalAlign: 'middle' }}>add</span>
            Create Template
          </Button>
        </div>
        <div className="text-center text-muted py-5 small">
          <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '2rem' }}>assignment</span>
          No indicators yet. Click <strong>Create Template</strong> to add one.
        </div>
      </div>
    );
  }

  if (filteredIndicators.length === 0) {
    return (
      <div>
        {renderToolbar(0)}
        <div className="text-center text-muted py-5 small">
          No indicators match the selected filters{searchTerm.trim() ? ' or search' : ''}.
        </div>
        <DeleteConfirmModal
          show={!!deleteTarget}
          onHide={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Indicator"
          responseCount={deleteTarget?.responseCount}
          itemDescription={`"${deleteTarget?.ind.indicator_text}"`}
          loading={deleting}
        />
      </div>
    );
  }

  return (
    <div>
      {renderToolbar(filteredIndicators.length)}
      {indicatorSections.map((section) => (
        <div key={section.objective ?? 'unassigned'} className="mb-4">
          <div className="mb-3 pb-2 border-bottom">
            <div className="fw-bold text-primary">{coreObjectiveShortTitle(section.objective)}</div>
            {section.objective ? (
              <div className="text-muted" style={{ fontSize: '0.72rem', lineHeight: 1.35 }}>{section.objective}</div>
            ) : null}
          </div>
          {section.outcomes.map((outcomeGroup) => (
            <div key={outcomeGroup.outcomeId} className="mb-4">
              <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                <Badge bg={outcomeGroup.outcomeType === 'Output' ? 'info' : 'warning'} className="text-dark" style={{ fontSize: '0.65rem' }}>{outcomeGroup.outcomeType}</Badge>
                <span className="fw-bold text-primary small">{outcomeGroup.outcomeLabel}</span>
              </div>
              <div className="d-flex flex-column gap-2">
                {outcomeGroup.indicators.map((ind) => (
                <div key={ind.id} className="border rounded-3 overflow-hidden">
                  <div
                    className="d-flex align-items-start p-3 gap-2"
                    style={{ background: '#f0f4f9', cursor: 'pointer' }}
                    onClick={() => toggle(ind.id)}
                  >
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <div className="fw-semibold small d-flex align-items-center gap-2 flex-wrap">
                        {ind.indicator_text}
                        {ind.is_locked && (
                          <Badge bg="danger" style={{ fontSize: '0.6rem' }}>
                            <span className="material-symbols-outlined me-1" style={{ fontSize: '11px', verticalAlign: 'middle' }}>lock</span>Locked
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 d-flex flex-wrap gap-1">
                        {summarizeIndicatorDepartments(ind.departments, groupCatalog).map((badge) =>
                          badge.kind === 'group' ? (
                            <Badge
                              key={`group-${badge.group}-${ind.id}`}
                              bg="light"
                              className={`text-primary border ${badge.complete ? 'border-primary' : 'border-primary border-opacity-50'}`}
                              style={{ fontSize: '0.62rem', fontWeight: 600, ...(badge.complete ? {} : { borderStyle: 'dashed' }) }}
                              title={
                                badge.complete
                                  ? undefined
                                  : 'Partial group selection — open Edit and re-apply the group chip to include new ambassador units.'
                              }
                            >
                              {badge.label}
                            </Badge>
                          ) : (
                            <Badge
                              key={`unit-${badge.id}`}
                              bg="light"
                              className="text-dark border"
                              style={{ fontSize: '0.62rem' }}
                            >
                              {badge.name}
                            </Badge>
                          ),
                        )}
                        {ind.financial_years.map((fy) => (
                          <Badge key={fy} bg="primary" style={{ fontSize: '0.62rem', background: 'var(--mubs-blue)' }}>{fy}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="d-flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline-secondary" title={ind.is_locked ? 'Unlock' : 'Lock'} onClick={() => handleLock(ind)} disabled={lockingId === ind.id}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle' }}>{ind.is_locked ? 'lock_open' : 'lock'}</span>
                      </Button>
                      <Button size="sm" variant="outline-primary" title="Edit" onClick={() => onEdit(ind)}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle' }}>edit</span>
                      </Button>
                      <Button size="sm" variant="outline-danger" title="Delete" onClick={() => handleDeleteClick(ind)}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle' }}>delete</span>
                      </Button>
                    </div>
                    <span className="material-symbols-outlined text-muted flex-shrink-0" style={{ fontSize: '18px', marginTop: '2px' }}>
                      {expanded.has(ind.id) ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>

                  {expanded.has(ind.id) && (
                    <div className="p-3" style={{ background: '#fff' }}>
                      {loadingResponses.has(ind.id) ? (
                        <div className="text-center text-muted py-3 small">Loading collected data…</div>
                      ) : (
                        ind.departments.map((dept) => {
                          const responses = responsesByIndicator[ind.id] ?? [];
                          const visibleFys = ind.financial_years;
                          const visibleMetrics = ind.metrics;
                          const hasAnyValue = visibleMetrics.some((m) =>
                            visibleFys.some((fy) => responseValue(responses, dept.id, m.id, fy) != null)
                          );

                          return (
                            <div key={dept.id} className={ind.departments.length > 1 ? 'mb-4' : ''}>
                              {ind.departments.length > 1 && (
                                <div className="fw-semibold small mb-2 text-primary">{dept.name}</div>
                              )}
                              <div className="text-muted fw-bold text-uppercase mb-2" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                Performance Metrics
                                {ind.departments.length === 1 && (
                                  <span className="text-normal fw-normal ms-2 text-secondary">— {dept.name}</span>
                                )}
                              </div>
                              <div className="table-responsive">
                                <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.78rem' }}>
                                  <thead className="table-dark">
                                    <tr>
                                      <th style={{ width: '30px' }}>#</th>
                                      <th>Metric</th>
                                      {visibleFys.map((fy) => (
                                        <th key={fy} className="text-center" style={{ width: '90px' }}>{fy}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {visibleMetrics.map((m, mi) => (
                                      <tr key={m.id}>
                                        <td className="text-center fw-bold" style={{ color: 'var(--mubs-gold, #C8922A)' }}>{mi + 1}</td>
                                        <td>{m.metric_text}</td>
                                        {visibleFys.map((fy) => {
                                          const val = responseValue(responses, dept.id, m.id, fy);
                                          return (
                                            <td
                                              key={fy}
                                              className={`text-center ${val ? 'fw-semibold' : 'text-muted'}`}
                                              style={{ fontSize: '0.72rem', fontStyle: val ? 'normal' : 'italic' }}
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
                              {!hasAnyValue && (
                                <p className="text-muted small mb-0 mt-2">No data submitted yet for this office.</p>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      <DeleteConfirmModal
        show={!!deleteTarget}
        onHide={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Indicator"
        responseCount={deleteTarget?.responseCount}
        itemDescription={`"${deleteTarget?.ind.indicator_text}"`}
        loading={deleting}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main Questionnaire page
// ────────────────────────────────────────────────────────────
type SubTab = 'outcomes' | 'indicators';

export default function QuestionnaireView() {
  const [activeTab, setActiveTab] = useState<SubTab>('outcomes');
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [allDepartments, setAllDepartments] = useState<DepartmentUnitOption[]>([]);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const fetchOutcomes = useCallback(async () => {
    try { const res = await axios.get('/api/questionnaire/outcomes'); setOutcomes(res.data); } catch { /* noop */ }
  }, []);

  const fetchIndicators = useCallback(async () => {
    try { const res = await axios.get('/api/questionnaire/indicators'); setIndicators(res.data); } catch { /* noop */ }
  }, []);

  const loadDepts = useCallback(async () => {
    try {
      const res = await axios.get('/api/departments?with_ambassador=true&active_only=true');
      const rows = Array.isArray(res.data) ? res.data : [];
      setAllDepartments(
        rows.map((d: DepartmentUnitOption & { ambassador_group?: string | null }) => ({
          id: Number(d.id),
          name: String(d.name),
          parent_id: d.parent_id != null ? Number(d.parent_id) : null,
          unit_type: d.unit_type || 'department',
          ambassador_group: d.ambassador_group ?? null,
        })),
      );
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    void fetchOutcomes();
    void fetchIndicators();
    void loadDepts();
  }, [fetchOutcomes, fetchIndicators, loadDepts]);

  const handleCreate = () => {
    setEditingIndicator(null);
    setShowTemplateModal(true);
  };

  const handleEdit = (ind: Indicator) => {
    void loadDepts();
    setEditingIndicator(ind);
    setShowTemplateModal(true);
  };

  const handleTemplateSaved = () => {
    void fetchIndicators();
    void fetchOutcomes();
    setShowTemplateModal(false);
    setEditingIndicator(null);
    setActiveTab('indicators');
  };

  const handleDepartmentSync = useCallback(() => {
    void fetchIndicators();
  }, [fetchIndicators]);

  const lockedCount = indicators.filter((i) => i.is_locked).length;
  const totalMetrics = indicators.reduce((sum, i) => sum + i.metrics.length, 0);

  const TABS: { key: SubTab; label: string; icon: string; count?: number }[] = [
    { key: 'outcomes', label: 'Manage Outcomes', icon: 'account_tree', count: outcomes.length },
    { key: 'indicators', label: 'Indicators', icon: 'assignment', count: indicators.length },
  ];

  return (
    <Layout>
      <div className="page-section active-page">
        <div className="mb-4">
          <h5 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <span className="material-symbols-outlined text-primary">help_outline</span>
            Questionnaire Templates
          </h5>
          <p className="text-muted small mb-0">Manage outcomes/outputs, create performance indicator templates, and assign them to departments.</p>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <StatCard label="Outcomes & Outputs" value={outcomes.length} color="blue" />
          </div>
          <div className="col-6 col-md-3">
            <StatCard label="Indicators" value={indicators.length} color="yellow" />
          </div>
          <div className="col-6 col-md-3">
            <StatCard label="Locked" value={lockedCount} color="red" />
          </div>
          <div className="col-6 col-md-3">
            <StatCard label="Total Metrics" value={totalMetrics} color="green" />
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 mb-4 border-bottom pb-3">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`btn btn-sm fw-bold d-flex align-items-center gap-1 ${activeTab === tab.key ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={activeTab === tab.key ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : {}}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{tab.icon}</span>
              {tab.label}
              {tab.count !== undefined && <Badge bg={activeTab === tab.key ? 'light' : 'secondary'} className={activeTab === tab.key ? 'text-primary' : ''} style={{ fontSize: '0.62rem' }}>{tab.count}</Badge>}
            </button>
          ))}
        </div>

        <div className="table-card p-3 p-md-4">
          {activeTab === 'outcomes' && (
            <ManageOutcomesPanel outcomes={outcomes} onRefresh={() => { void fetchOutcomes(); void fetchIndicators(); }} />
          )}
          {activeTab === 'indicators' && (
            <IndicatorsPanel
              indicators={indicators}
              ambassadorCatalog={allDepartments}
              onEdit={handleEdit}
              onCreate={handleCreate}
              onRefresh={() => { void fetchIndicators(); void fetchOutcomes(); }}
            />
          )}
        </div>

        <TemplateModal
          show={showTemplateModal}
          onHide={() => { setShowTemplateModal(false); setEditingIndicator(null); }}
          outcomes={outcomes}
          allDepartments={allDepartments}
          editingIndicator={editingIndicator}
          onSaved={handleTemplateSaved}
          onDepartmentSync={handleDepartmentSync}
        />
      </div>
    </Layout>
  );
}
