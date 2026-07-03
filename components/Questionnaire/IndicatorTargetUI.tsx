'use client';

import { Form } from 'react-bootstrap';
import { normalizeFinancialYear } from '@/lib/questionnaire/fy-utils';

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
