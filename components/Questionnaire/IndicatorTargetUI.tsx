'use client';

import { Form } from 'react-bootstrap';
import { normalizeFinancialYear } from '@/lib/questionnaire/fy-utils';
import { parseLooseNumber } from '@/lib/questionnaire/metric-tree';

export type IndicatorTarget = { financial_year: string; target_value: string | null };

export function indicatorTargetFor(
  targets: IndicatorTarget[] | undefined,
  fy: string,
): string | null {
  const normalized = normalizeFinancialYear(fy);
  const row = targets?.find((t) => normalizeFinancialYear(t.financial_year) === normalized);
  const v = row?.target_value;
  return v != null && String(v).trim() !== '' ? String(v) : null;
}

export function percentOfTarget(actual: number, target: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(target)) return null;
  if (target === 0) return actual === 0 ? 100 : null;
  return (actual / target) * 100;
}

export function formatPercentOfTarget(pct: number): string {
  const rounded = Math.abs(pct - Math.round(pct)) < 0.05 ? Math.round(pct) : Math.round(pct * 10) / 10;
  return `${rounded}% of target`;
}

export function VsTargetHint({
  actual,
  target,
}: {
  actual: string | number | null | undefined;
  target: string | number | null | undefined;
}) {
  const a = parseLooseNumber(actual == null ? null : String(actual));
  const t = parseLooseNumber(target == null ? null : String(target));
  if (a == null || t == null) return null;
  const pct = percentOfTarget(a, t);
  if (pct == null) return null;
  return (
    <div className="text-muted text-center mt-1" style={{ fontSize: '0.62rem', lineHeight: 1.2 }}>
      {formatPercentOfTarget(pct)}
    </div>
  );
}

export function IndicatorVsTargetSummary({
  financialYears,
  targets,
  actualByFy,
}: {
  financialYears: string[];
  targets?: IndicatorTarget[];
  actualByFy: Record<string, string | number | null | undefined>;
}) {
  const rows = financialYears.map((fy) => {
    const targetRaw = indicatorTargetFor(targets, fy);
    const target = parseLooseNumber(targetRaw);
    const actual = parseLooseNumber(actualByFy[fy] == null ? null : String(actualByFy[fy]));
    const pct = target != null && actual != null ? percentOfTarget(actual, target) : null;
    return { fy, targetRaw, actual, pct };
  });

  if (!rows.some((r) => r.targetRaw || r.actual != null)) return null;

  return (
    <div className="d-flex flex-wrap gap-2 mb-3">
      {rows.map((r) => (
        <span
          key={r.fy}
          className="badge border text-dark bg-light"
          style={{ fontSize: '0.72rem', fontWeight: 500 }}
        >
          {r.fy}
          {r.pct != null
            ? ` · ${formatPercentOfTarget(r.pct)} (${r.actual} / ${r.targetRaw})`
            : r.targetRaw
              ? ` · Target: ${r.targetRaw}`
              : ' · No target'}
        </span>
      ))}
    </div>
  );
}

/** Compact inline FY badges — year and target in one pill. */
export function IndicatorFyTargetGroup({
  financialYears,
  targets,
}: {
  financialYears: string[];
  targets?: IndicatorTarget[];
}) {
  if (!financialYears.length) return null;

  return (
    <>
      {financialYears.map((fy) => {
        const target = indicatorTargetFor(targets, fy);
        return (
          <span key={fy} className="indicator-fy-badge">
            {fy}
            {target ? (
              <span className="indicator-fy-badge__target">
                · <span className="indicator-fy-badge__target-label">Target:</span> {target}
              </span>
            ) : null}
          </span>
        );
      })}
    </>
  );
}

/** Compact inline target inputs. */
export function IndicatorTargetInputGrid({
  financialYears,
  valuesByFy,
  onChange,
  disabled = false,
  placeholder = 'Target',
}: {
  financialYears: string[];
  valuesByFy: Record<string, string>;
  onChange: (fy: string, value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  if (!financialYears.length) return null;

  return (
    <div className="indicator-target-inputs">
      {financialYears.map((fy) => (
        <div key={fy} className="indicator-target-inputs__row">
          <span className="indicator-fy-badge indicator-fy-badge--static">{fy}</span>
          <Form.Control
            size="sm"
            value={valuesByFy[fy] ?? ''}
            onChange={(e) => onChange(fy, e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={`Target for ${fy}`}
          />
        </div>
      ))}
    </div>
  );
}
