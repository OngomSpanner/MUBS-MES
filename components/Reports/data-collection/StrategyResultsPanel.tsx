'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Form, Modal, Spinner } from 'react-bootstrap';
import axios from 'axios';
import * as XLSX from 'xlsx';
import ReportsSectionHeader from '@/components/Reports/ReportsSectionHeader';
import StrategicPillarBadge from '@/components/Questionnaire/StrategicPillarBadge';
import { fyShortLabel } from '@/lib/questionnaire/fy-utils';
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
} from '@/lib/questionnaire/compute-strategy-results';
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
    const set = new Set<string>();
    for (const ind of data?.indicators ?? []) {
      if (ind.strategicPillar) set.add(ind.strategicPillar);
    }
    return [...set].sort();
  }, [data]);

  const filteredIndicators = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.indicators ?? []).filter((ind) => {
      if (pillar !== 'all' && ind.strategicPillar !== pillar) return false;
      if (!q) return true;
      return (
        ind.indicatorText.toLowerCase().includes(q)
        || ind.outcomeLabel.toLowerCase().includes(q)
        || (ind.strategicPillar ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, search, pillar]);

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
        description="Numeric indicators are added across all assigned offices for each financial year. Percentages and ratios are not added together. Use a formula when the result should be Female ÷ Male, a share of total, or two different indicators."
        filters={(
          <>
            <Form.Check
              type="switch"
              id="results-approved-only"
              label="Approved only"
              checked={approvedOnly}
              onChange={(e) => setApprovedOnly(e.target.checked)}
            />
            <Form.Select size="sm" value={pillar} onChange={(e) => setPillar(e.target.value)} style={{ width: 200 }}>
              <option value="all">All pillars</option>
              {pillars.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Form.Select>
            <Form.Control
              size="sm"
              placeholder="Search indicators…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
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
            {filteredIndicators.map((ind) => (
              <tr key={ind.indicatorId}>
                <td>
                  <div className="fw-semibold">{ind.indicatorText}</div>
                  <div className="text-muted" style={{ fontSize: '0.68rem' }}>
                    {ind.outcomeType}: {ind.outcomeLabel}
                  </div>
                  <div className="mt-1">
                    <StrategicPillarBadge pillar={ind.strategicPillar} code={ind.pillarCode} />
                  </div>
                </td>
                <td className="text-muted">{ind.assignedOffices}</td>
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
          </tbody>
        </table>
      </div>

      {filteredIndicators.length === 0 ? (
        <div className="text-muted small py-3">No indicators match this filter.</div>
      ) : null}

      <Modal show={showFormula} onHide={() => !saving && setShowFormula(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">Add result formula</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted">
            Each input is first added across offices, then the formula runs. Use Share of total for % female from Female and Male counts. Use Ratio for Female:Male as n:1.
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
              <Form.Select
                size="sm"
                className="mb-1"
                value={op.indicatorId || ''}
                onChange={(e) => {
                  const indicatorId = Number(e.target.value) || 0;
                  const next = { indicatorId, metricId: null };
                  if (idx === 0) setFormA(next);
                  else setFormB(next);
                }}
              >
                <option value="">Select indicator…</option>
                {(data?.indicators ?? []).map((ind) => (
                  <option key={ind.indicatorId} value={ind.indicatorId}>{ind.indicatorText}</option>
                ))}
              </Form.Select>
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
            <Form.Select size="sm" value={formCompare} onChange={(e) => setFormCompare(e.target.value ? Number(e.target.value) : '')}>
              <option value="">None</option>
              {(data?.indicators ?? []).map((ind) => (
                <option key={ind.indicatorId} value={ind.indicatorId}>{ind.indicatorText}</option>
              ))}
            </Form.Select>
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
