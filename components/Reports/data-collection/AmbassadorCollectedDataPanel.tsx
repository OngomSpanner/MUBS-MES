'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Spinner } from 'react-bootstrap';
import axios from 'axios';
import * as XLSX from 'xlsx';
import CollectedDataFlatTable, { type CollectedDataRow } from '@/components/Reports/CollectedDataFlatTable';
import ReportsSectionHeader from '@/components/Reports/ReportsSectionHeader';
import AmbassadorDepartmentGroupFilter, {
  ALL_AMBASSADOR_DEPARTMENTS_FILTER,
  resolveAmbassadorDepartmentIds,
  type AmbassadorDepartmentFilterValue,
} from '@/components/AmbassadorDepartmentGroupFilter';
import type { AmbassadorDepartmentRow } from '@/lib/department-ambassador-groups';
import { UOM_OPTIONS } from '@/lib/questionnaire/uom';
import { normalizeFinancialYear } from '@/lib/questionnaire/fy-utils';

type Metric = { id: number; metric_text: string; unit_of_measure: string; sort_order: number };
type Department = { id: number; name: string };
type Indicator = {
  id: number;
  indicator_text: string;
  is_locked: boolean;
  outcome_type: string;
  outcome_label: string;
  metrics: Metric[];
  departments: Department[];
  financial_years: string[];
};

type IndicatorResponse = {
  metric_id: number;
  department_id: number;
  financial_year: string;
  value: string | null;
};

function responseValue(
  responses: IndicatorResponse[],
  departmentId: number,
  metricId: number,
  fy: string,
): string | null {
  const row = responses.find(
    (r) =>
      Number(r.department_id) === Number(departmentId) &&
      Number(r.metric_id) === Number(metricId) &&
      normalizeFinancialYear(r.financial_year) === normalizeFinancialYear(fy),
  );
  const v = row?.value;
  return v != null && String(v).trim() !== '' ? String(v) : null;
}

function normalizeIndicator(raw: Indicator): Indicator {
  return {
    ...raw,
    id: Number(raw.id),
    metrics: (raw.metrics ?? []).map((m) => ({ ...m, id: Number(m.id) })),
    departments: (raw.departments ?? []).map((d) => ({ ...d, id: Number(d.id) })),
    financial_years: (raw.financial_years ?? []).map((fy) => normalizeFinancialYear(fy)),
  };
}

export default function AmbassadorCollectedDataPanel() {
  const [allIndicators, setAllIndicators] = useState<Indicator[]>([]);
  const [responsesByIndicator, setResponsesByIndicator] = useState<Record<number, IndicatorResponse[]>>({});
  const [loadingResponses, setLoadingResponses] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ambassadorDepartments, setAmbassadorDepartments] = useState<AmbassadorDepartmentRow[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<AmbassadorDepartmentFilterValue>(
    ALL_AMBASSADOR_DEPARTMENTS_FILTER,
  );
  const [fyFilter, setFyFilter] = useState<string>('all');
  const [uomFilter, setUomFilter] = useState<string>('all');

  const loadAmbassadorDepartments = useCallback(async () => {
    try {
      const res = await axios.get('/api/departments?with_ambassador=true&active_only=true');
      const rows = Array.isArray(res.data) ? res.data : [];
      setAmbassadorDepartments(
        rows.map((d: AmbassadorDepartmentRow) => ({
          id: Number(d.id),
          name: String(d.name),
          registered_name: String(d.registered_name ?? d.name),
          parent_id: d.parent_id != null ? Number(d.parent_id) : null,
          unit_type: d.unit_type || 'department',
          ambassador_group: d.ambassador_group ?? null,
        })),
      );
    } catch {
      setAmbassadorDepartments([]);
    }
  }, []);

  const loadIndicators = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/questionnaire/indicators');
      const rows = Array.isArray(res.data) ? res.data : [];
      setAllIndicators(rows.map((ind: Indicator) => normalizeIndicator(ind)));
    } catch {
      setError('Could not load ambassador questionnaire data.');
      setAllIndicators([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIndicators();
    void loadAmbassadorDepartments();
  }, [loadIndicators, loadAmbassadorDepartments]);

  const loadResponses = useCallback(async (indicatorId: number, force = false) => {
    if (!force && (responsesByIndicator[indicatorId] || loadingResponses.has(indicatorId))) return;
    setLoadingResponses((prev) => new Set(prev).add(indicatorId));
    try {
      const res = await axios.get(`/api/questionnaire/indicators/${indicatorId}/responses`);
      const rows = (Array.isArray(res.data) ? res.data : []).map((r: IndicatorResponse) => ({
        metric_id: Number(r.metric_id),
        department_id: Number(r.department_id),
        financial_year: normalizeFinancialYear(r.financial_year),
        value: r.value,
      }));
      setResponsesByIndicator((prev) => ({ ...prev, [indicatorId]: rows }));
    } catch {
      setResponsesByIndicator((prev) => ({ ...prev, [indicatorId]: [] }));
    } finally {
      setLoadingResponses((prev) => {
        const next = new Set(prev);
        next.delete(indicatorId);
        return next;
      });
    }
  }, [loadingResponses, responsesByIndicator]);

  // Prefetch responses for filled badges (same data source as Questionnaire → Indicators)
  useEffect(() => {
    for (const ind of allIndicators) {
      void loadResponses(ind.id);
    }
  }, [allIndicators]); // eslint-disable-line react-hooks/exhaustive-deps -- prefetch once per indicator set

  const activeDepartmentIds = useMemo(
    () => resolveAmbassadorDepartmentIds(ambassadorDepartments, departmentFilter),
    [ambassadorDepartments, departmentFilter],
  );

  const indicators = useMemo(() => {
    if (!activeDepartmentIds) return allIndicators;
    const idSet = new Set(activeDepartmentIds);
    return allIndicators.filter((ind) => ind.departments.some((d) => idSet.has(d.id)));
  }, [allIndicators, activeDepartmentIds]);

  const visibleDepartments = useCallback(
    (ind: Indicator) => {
      if (!activeDepartmentIds) return ind.departments;
      const idSet = new Set(activeDepartmentIds);
      return ind.departments.filter((d) => idSet.has(d.id));
    },
    [activeDepartmentIds],
  );

  const allFys = useMemo(
    () => Array.from(new Set(indicators.flatMap((i) => i.financial_years))).sort(),
    [indicators],
  );

  const visibleFys = useMemo(
    () =>
      fyFilter === 'all'
        ? allFys
        : allFys.filter((fy) => normalizeFinancialYear(fy) === normalizeFinancialYear(fyFilter)),
    [allFys, fyFilter],
  );

  const grouped = useMemo(() => {
    return indicators.reduce(
      (acc, ind) => {
        const key = `${ind.outcome_type}|${ind.outcome_label}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(ind);
        return acc;
      },
      {} as Record<string, Indicator[]>,
    );
  }, [indicators]);

  const buildFlatRows = useCallback(
    (inds: Indicator[]): CollectedDataRow[] => {
      const rows: CollectedDataRow[] = [];
      for (const ind of inds) {
        const depts = visibleDepartments(ind);
        const visibleMetrics = ind.metrics.filter(
          (m) => uomFilter === 'all' || m.unit_of_measure === uomFilter,
        );
        for (const dept of depts) {
          for (const m of visibleMetrics) {
            rows.push({
              key: `${ind.id}-${dept.id}-${m.id}`,
              indicatorId: ind.id,
              indicatorText: ind.indicator_text,
              departmentId: dept.id,
              departmentName: dept.name,
              metricId: m.id,
              metricText: m.metric_text,
            });
          }
        }
      }
      return rows;
    },
    [uomFilter, visibleDepartments],
  );

  const getResponses = (indicatorId: number) => responsesByIndicator[indicatorId] ?? [];

  const filledCount = useMemo(() => {
    let count = 0;
    for (const ind of indicators) {
      const responses = getResponses(ind.id);
      for (const dept of visibleDepartments(ind)) {
        for (const m of ind.metrics) {
          for (const fy of ind.financial_years) {
            if (responseValue(responses, dept.id, m.id, fy) != null) count += 1;
          }
        }
      }
    }
    return count;
  }, [indicators, responsesByIndicator, visibleDepartments]);

  const exportExcel = () => {
    const rows: Record<string, string | number>[] = [];
    for (const ind of indicators) {
      const responses = getResponses(ind.id);
      for (const dept of visibleDepartments(ind)) {
        const visibleFys =
          fyFilter === 'all'
            ? ind.financial_years
            : ind.financial_years.filter((fy) => normalizeFinancialYear(fy) === normalizeFinancialYear(fyFilter));
        const visibleMetrics = ind.metrics.filter((m) => uomFilter === 'all' || m.unit_of_measure === uomFilter);
        for (const m of visibleMetrics) {
          for (const fy of visibleFys) {
            const val = responseValue(responses, dept.id, m.id, fy);
            rows.push({
              Outcome: ind.outcome_label,
              Type: ind.outcome_type,
              Indicator: ind.indicator_text,
              Department: dept.name,
              Metric: m.metric_text,
              UOM: m.unit_of_measure,
              'Financial Year': fy,
              Value: val ?? '',
            });
          }
        }
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ambassador Data');
    XLSX.writeFile(wb, 'ambassador-questionnaire-data.xlsx');
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div>
      <ReportsSectionHeader
        icon="assignment"
        title="Ambassador Questionnaire Data"
        count={indicators.length}
        description={
          <>
            Same ambassador submissions shown under Questionnaire → Indicators.{' '}
            <strong>{filledCount}</strong> value{filledCount !== 1 ? 's' : ''} recorded in current view.
          </>
        }
        filters={
          <>
            <div style={{ minWidth: '280px', maxWidth: '360px' }}>
              <AmbassadorDepartmentGroupFilter
                departments={ambassadorDepartments}
                value={departmentFilter}
                onChange={setDepartmentFilter}
                compact
              />
            </div>
            <select
              className="form-select form-select-sm"
              value={fyFilter}
              onChange={(e) => setFyFilter(e.target.value)}
              style={{ width: '130px' }}
              title="Filter by financial year"
            >
              <option value="all">All FYs</option>
              {allFys.map((fy) => (
                <option key={fy} value={fy}>
                  {fy}
                </option>
              ))}
            </select>
            <select
              className="form-select form-select-sm"
              value={uomFilter}
              onChange={(e) => setUomFilter(e.target.value)}
              style={{ width: '160px' }}
              title="Filter by unit of measure"
            >
              <option value="all">All metrics</option>
              {UOM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-sm btn-outline-success fw-bold d-inline-flex align-items-center gap-1"
              onClick={exportExcel}
              disabled={indicators.length === 0}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>table_chart</span>
              Export
            </button>
          </>
        }
      />

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {indicators.length === 0 ? (
        <div className="text-center text-muted py-5 small">
          <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '2rem' }}>
            assignment
          </span>
          No questionnaire indicators found for the selected department.
        </div>
      ) : (
        Object.entries(grouped).map(([key, inds]) => {
          const [type, label] = key.split('|');
          const flatRows = buildFlatRows(inds);
          return (
            <div key={key} className="mb-4">
              <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                <Badge bg={type === 'Output' ? 'info' : 'warning'} className="text-dark" style={{ fontSize: '0.65rem' }}>
                  {type}
                </Badge>
                <span className="fw-bold text-primary small">{label}</span>
              </div>
              <CollectedDataFlatTable
                rows={flatRows}
                financialYears={visibleFys}
                getValue={(row, fy) => {
                  const responses = getResponses(row.indicatorId);
                  return responseValue(responses, row.departmentId, row.metricId, fy);
                }}
              />
            </div>
          );
        })
      )}
    </div>
  );
}
