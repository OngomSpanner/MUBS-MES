'use client';

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { Badge, Button, Form, Modal, Spinner } from 'react-bootstrap';
import axios from 'axios';
import * as XLSX from 'xlsx';
import ReportsSectionHeader from '@/components/Reports/ReportsSectionHeader';
import StrategicPillarBadge from '@/components/Questionnaire/StrategicPillarBadge';
import IndicatorPickerField, {
  indicatorMatchesQuery,
  sortStrategyIndicators,
} from '@/components/Reports/data-collection/IndicatorPickerField';
import { fyShortLabel } from '@/lib/questionnaire/fy-utils';
import { strategicPillarNumber, strategicPillarShortLabel } from '@/lib/strategic-plan';
import {
  RESULT_OPERATION_LABELS,
  RESULT_OPERATIONS,
  type ResultFormulaOperand,
  type ResultOperation,
} from '@/lib/questionnaire/result-formulas-constants';
import type {
  StrategyFormulaResult,
  StrategyFyCell,
  StrategyIndicatorResult,
  StrategyResultsPayload,
} from '@/lib/questionnaire/strategy-results-types';
import { PERFORMANCE_STATUS_LABELS, type PerformanceStatus } from '@/lib/results-framework';

function statusBadge(status: PerformanceStatus | null) {
  if (status === 'underperformance') return 'danger';
  if (status === 'overachievement') return 'primary';
  if (status === 'achievement') return 'success';
  return 'secondary';
}

function CellView({ cell }: { cell: StrategyFyCell | undefined }) {
  if (!cell) return <span className="text-muted">—</span>;
  return (
    <div>
      <div className="fw-semibold" style={{ fontSize: '0.82rem' }}>
        {cell.display ?? '—'}
      </div>
      {cell.target ? (
        <div className="text-muted" style={{ fontSize: '0.68rem' }}>
          Target {cell.target}
          {cell.pctOfTarget != null ? ` · ${cell.pctOfTarget}%` : ''}
        </div>
      ) : null}
      {cell.performance ? (
        <Badge bg={statusBadge(cell.performance)} className="mt-1" style={{ fontSize: '0.58rem' }}>
          {PERFORMANCE_STATUS_LABELS[cell.performance]}
        </Badge>
      ) : null}
      {cell.note ? (
        <div className="text-muted mt-1" style={{ fontSize: '0.62rem', maxWidth: 220 }}>
          {cell.note}
        </div>
      ) : null}
    </div>
  );
}

function emptyOperand(): ResultFormulaOperand {
  return { indicatorId: 0, metricId: null };
}

export default function StrategyResultsPanel() {
  const [data, setData] = useState<StrategyResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [pillar, setPillar] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [officeId, setOfficeId] = useState('all');
  const [showFormula, setShowFormula] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState('');
  const [formOp, setFormOp] = useState<ResultOperation>('share');
  const [formA, setFormA] = useState<ResultFormulaOperand>(emptyOperand());
  const [formB, setFormB] = useState<ResultFormulaOperand>(emptyOperand());
  const [formCompare, setFormCompare] = useState<number | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<StrategyResultsPayload>('/api/admin/questionnaire/results', {
        params: { approvedOnly: approvedOnly ? '1' : '0' },
      });
      setData(res.data);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : null;
      setError(typeof msg === 'string' ? msg : 'Failed to load strategy results.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [approvedOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const pillars = useMemo(() => {
    const map = new Map<string, { label: string; code: string | null }>();
    for (const ind of data?.indicators ?? []) {
      if (!ind.strategicPillar) continue;
      if (!map.has(ind.strategicPillar)) {
        map.set(ind.strategicPillar, { label: ind.strategicPillar, code: ind.pillarCode });
      }
    }
    return [...map.values()].sort(
      (a, b) => (strategicPillarNumber(a.label) ?? 99) - (strategicPillarNumber(b.label) ?? 99),
    );
  }, [data]);

  const offices = useMemo(() => {
    const map = new Map<number, string>();
    for (const ind of data?.indicators ?? []) {
      for (const o of ind.offices ?? []) map.set(o.id, o.name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const outcomes = useMemo(() => {
    const set = new Set<string>();
    for (const ind of data?.indicators ?? []) {
      if (pillar !== 'all' && ind.strategicPillar !== pillar) continue;
      if (ind.outcomeLabel) set.add(`${ind.outcomeType}|${ind.outcomeLabel}`);
    }
    return [...set]
      .map((key) => {
        const [type, label] = key.split('|');
        return { key, type, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data, pillar]);

  const filteredIndicators = useMemo(() => {
    return (data?.indicators ?? [])
      .filter((ind) => {
        if (pillar !== 'all' && ind.strategicPillar !== pillar) return false;
        if (outcome !== 'all') {
          const [type, label] = outcome.split('|');
          if (ind.outcomeType !== type || ind.outcomeLabel !== label) return false;
        }
        if (officeId !== 'all' && !(ind.offices ?? []).some((o) => String(o.id) === officeId)) return false;
        return indicatorMatchesQuery(ind, search);
      })
      .sort(sortStrategyIndicators);
  }, [data, search, pillar, outcome, officeId]);

  const groupedRows = useMemo(() => {
    const groups: Array<{
      pillarKey: string;
      pillar: string | null;
      code: string | null;
      outcomes: Array<{ key: string; label: string; indicators: StrategyIndicatorResult[] }>;
    }> = [];
    for (const ind of filteredIndicators) {
      const pillarKey = ind.strategicPillar || 'Unassigned';
      let group = groups[groups.length - 1];
      if (!group || group.pillarKey !== pillarKey) {
        group = { pillarKey, pillar: ind.strategicPillar, code: ind.pillarCode, outcomes: [] };
        groups.push(group);
      }
      const outcomeKey = `${ind.outcomeType}|${ind.outcomeLabel}`;
      const lastOutcome = group.outcomes[group.outcomes.length - 1];
      if (lastOutcome && lastOutcome.key === outcomeKey) lastOutcome.indicators.push(ind);
      else group.outcomes.push({ key: outcomeKey, label: `${ind.outcomeType}: ${ind.outcomeLabel}`, indicators: [ind] });
    }
    return groups;
  }, [filteredIndicators]);

  const years = data?.financialYears ?? [];

  const applySuggestion = (ind: StrategyIndicatorResult, suggestion: StrategyIndicatorResult['suggested'][number]) => {
    setFormName(`${ind.indicatorText} (${RESULT_OPERATION_LABELS[suggestion.operation]})`);
    setFormOp(suggestion.operation);
    setFormA(suggestion.operands[0] ?? emptyOperand());
    setFormB(suggestion.operands[1] ?? emptyOperand());
    setFormCompare(ind.indicatorId);
    setShowFormula(true);
  };

  const saveFormula = async () => {
    if (!formName.trim() || !formA.indicatorId) return;
    setSaving(true);
    try {
      const operands: ResultFormulaOperand[] = [formA];
      if (['divide', 'percent', 'share', 'ratio', 'sum', 'mean'].includes(formOp) && formB.indicatorId) {
        operands.push(formB);
      }
      await axios.post('/api/admin/questionnaire/result-formulas', {
        name: formName.trim(),
        operation: formOp,
        operands,
        compareIndicatorId: formCompare === '' ? null : formCompare,
      });
      setShowFormula(false);
      setFormName('');
      setFormA(emptyOperand());
      setFormB(emptyOperand());
      setFormCompare('');
      await load();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : 'Save failed';
      alert(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const removeFormula = async (id: number) => {
    if (!confirm('Remove this formula?')) return;
    try {
      await axios.delete('/api/admin/questionnaire/result-formulas', { params: { id } });
      await load();
    } catch {
      alert('Could not remove formula.');
    }
  };

  const exportExcel = () => {
    if (!data) return;
    const rows: Record<string, string | number>[] = [];
    const pushCells = (name: string, kind: string, byFy: Record<string, StrategyFyCell>) => {
      for (const fy of years) {
        const cell = byFy[fy];
        rows.push({
          Kind: kind,
          Name: name,
          'Financial year': fy,
          Actual: cell?.display ?? '',
          Target: cell?.target ?? '',
          '% of target': cell?.pctOfTarget ?? '',
          Offices: cell?.officesWithValues ?? '',
          Note: cell?.note ?? '',
        });
      }
    };
    for (const ind of filteredIndicators) {
      pushCells(ind.indicatorText, 'Indicator', ind.byFy);
    }
    for (const f of data.formulas) {
      pushCells(f.name, `Formula: ${RESULT_OPERATION_LABELS[f.operation]}`, f.byFy);
    }
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Strategy results');
    XLSX.writeFile(wb, 'strategy-indicator-results.xlsx');
  };

  const metricsFor = (indicatorId: number) =>
    data?.indicators.find((i) => i.indicatorId === indicatorId)?.metrics.filter((m) => m.isInput) ?? [];

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" size="sm" className="text-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger py-2 small">{error}</div>;
  }

  return (
    <div>
      <ReportsSectionHeader
        icon="calculate"
        title="Indicator results"
        count={filteredIndicators.length}
        description="Numeric indicators are added across all assigned offices for each financial year. Percentages and ratios are not added together. Type to find an indicator, outcome, or office. Results stay grouped by pillar, then outcome."
        filters={(
          <>
            <Form.Check
              type="switch"
              id="results-approved-only"
              label="Approved only"
              checked={approvedOnly}
              onChange={(e) => setApprovedOnly(e.target.checked)}
            />
            <Form.Select
              size="sm"
              value={pillar}
              onChange={(e) => {
                setPillar(e.target.value);
                setOutcome('all');
              }}
              style={{ width: 190 }}
            >
              <option value="all">All pillars</option>
              {pillars.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.code ? `${p.code} · ${strategicPillarShortLabel(p.label)}` : strategicPillarShortLabel(p.label)}
                </option>
              ))}
            </Form.Select>
            <Form.Select size="sm" value={outcome} onChange={(e) => setOutcome(e.target.value)} style={{ width: 220 }}>
              <option value="all">All outcomes</option>
              {outcomes.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </Form.Select>
            <Form.Select size="sm" value={officeId} onChange={(e) => setOfficeId(e.target.value)} style={{ width: 200 }}>
              <option value="all">All offices</option>
              {offices.map((o) => (
                <option key={o.id} value={String(o.id)}>{o.name}</option>
              ))}
            </Form.Select>
            <Form.Control
              size="sm"
              placeholder="Search indicator, outcome or office…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 240 }}
            />
            <Button size="sm" variant="outline-primary" onClick={() => setShowFormula(true)}>
              Add formula
            </Button>
            <Button size="sm" variant="outline-secondary" onClick={exportExcel} disabled={!data}>
              Export Excel
            </Button>
          </>
        )}
      />

      {officeId !== 'all' ? (
        <p className="small text-muted mb-2">
          Showing indicators assigned to that office. The numbers are still school-wide totals, not that office alone.
        </p>
      ) : null}

      {(data?.formulas.length ?? 0) > 0 ? (
        <div className="mb-4">
          <h6 className="fw-bold small text-uppercase text-muted">Saved formulas</h6>
          <div className="table-responsive border rounded-3">
            <table className="table table-sm mb-0 align-middle" style={{ fontSize: '0.8rem' }}>
              <thead className="table-light">
                <tr>
                  <th>Formula</th>
                  {years.map((fy) => (
                    <th key={fy}>{fyShortLabel(fy)}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.formulas.map((f: StrategyFormulaResult) => (
                  <tr key={f.id}>
                    <td>
                      <div className="fw-semibold">{f.name}</div>
                      <div className="text-muted" style={{ fontSize: '0.68rem' }}>
                        {RESULT_OPERATION_LABELS[f.operation]}
                      </div>
                    </td>
                    {years.map((fy) => (
                      <td key={fy}><CellView cell={f.byFy[fy]} /></td>
                    ))}
                    <td className="text-end">
                      <Button size="sm" variant="outline-danger" onClick={() => void removeFormula(f.id)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="table-responsive border rounded-3">
        <table className="table table-sm mb-0 align-middle" style={{ fontSize: '0.8rem' }}>
          <thead className="table-light">
            <tr>
              <th style={{ minWidth: 280 }}>Indicator</th>
              <th>Offices</th>
              {years.map((fy) => (
                <th key={fy}>{fyShortLabel(fy)}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {groupedRows.map((group) => (
              <Fragment key={`pillar-${group.pillarKey}`}>
                <tr className="table-light">
                  <td colSpan={3 + years.length}>
                    <StrategicPillarBadge pillar={group.pillar} code={group.code} showUnassigned />
                    <span className="text-muted small ms-2">
                      {group.outcomes.reduce((n, o) => n + o.indicators.length, 0)} indicators
                    </span>
                  </td>
                </tr>
                {group.outcomes.map((og) => (
                  <Fragment key={`outcome-${group.pillarKey}-${og.key}`}>
                    <tr>
                      <td colSpan={3 + years.length} className="py-1" style={{ background: '#f8fafc' }}>
                        <span className="text-muted small fw-semibold">{og.label}</span>
                      </td>
                    </tr>
                    {og.indicators.map((ind) => (
                      <tr key={ind.indicatorId}>
                        <td>
                          <div className="fw-semibold">{ind.indicatorText}</div>
                        </td>
                        <td className="text-muted" title={(ind.offices ?? []).map((o) => o.name).join(', ')}>
                          {(ind.offices?.length ?? 0) === 1
                            ? ind.offices[0].name
                            : `${ind.assignedOffices} offices`}
                        </td>
                        {years.map((fy) => (
                          <td key={fy}><CellView cell={ind.byFy[fy]} /></td>
                        ))}
                        <td className="text-nowrap">
                          {ind.suggested.map((s) => (
                            <Button
                              key={`${ind.indicatorId}-${s.operation}`}
                              size="sm"
                              variant="outline-primary"
                              className="me-1 mb-1"
                              onClick={() => applySuggestion(ind, s)}
                            >
                              {s.operation === 'share' ? '% female' : 'Parity'}
                            </Button>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filteredIndicators.length === 0 ? (
        <div className="text-muted small py-3">No indicators match this filter.</div>
      ) : null}

      <Modal show={showFormula} onHide={() => !saving && setShowFormula(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">Add result formula</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted">
            Type to find an indicator. Results are grouped by pillar. Each input is first added across offices, then the formula runs.
          </p>
          <Form.Group className="mb-2">
            <Form.Label className="small fw-semibold">Name</Form.Label>
            <Form.Control size="sm" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. % female enrolled (MUBS-wide)" />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small fw-semibold">Formula</Form.Label>
            <Form.Select size="sm" value={formOp} onChange={(e) => setFormOp(e.target.value as ResultOperation)}>
              {RESULT_OPERATIONS.map((op) => (
                <option key={op} value={op}>{RESULT_OPERATION_LABELS[op]}</option>
              ))}
            </Form.Select>
          </Form.Group>
          {([formA, formB] as const).map((op, idx) => (
            <div key={idx} className="border rounded-2 p-2 mb-2">
              <div className="small fw-semibold mb-1">{idx === 0 ? 'A' : 'B'}</div>
              <div className="mb-1">
                <IndicatorPickerField
                  indicators={data?.indicators ?? []}
                  value={op.indicatorId}
                  onChange={(indicatorId) => {
                    const next = { indicatorId, metricId: null };
                    if (idx === 0) setFormA(next);
                    else setFormB(next);
                  }}
                  placeholder="Type to search indicators…"
                />
              </div>
              <Form.Select
                size="sm"
                value={op.metricId ?? ''}
                disabled={!op.indicatorId}
                onChange={(e) => {
                  const metricId = e.target.value === '' ? null : Number(e.target.value);
                  const next = { ...op, metricId };
                  if (idx === 0) setFormA(next);
                  else setFormB(next);
                }}
              >
                <option value="">Numeric total (sum of input metrics)</option>
                {metricsFor(op.indicatorId).map((m) => (
                  <option key={m.id} value={m.id}>{m.metricText} ({m.unitOfMeasure})</option>
                ))}
              </Form.Select>
            </div>
          ))}
          <Form.Group>
            <Form.Label className="small fw-semibold">Compare with target of (optional)</Form.Label>
            <IndicatorPickerField
              indicators={data?.indicators ?? []}
              value={typeof formCompare === 'number' ? formCompare : 0}
              onChange={(id) => setFormCompare(id || '')}
              allowEmpty
              emptyLabel="None"
              placeholder="Type to search an indicator target…"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" disabled={saving} onClick={() => setShowFormula(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={saving || !formName.trim() || !formA.indicatorId}
            onClick={() => void saveFormula()}
          >
            {saving ? 'Saving…' : 'Save formula'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
