'use client';

import { Form } from 'react-bootstrap';
import { RESULTS_FRAMEWORK_FY_OPTIONS } from '@/lib/results-framework-fy';
import { fyLabelForDateJulyJune } from '@/lib/financial-year';

type Props = {
  value: string;
  onChange: (fy: string) => void;
  disabled?: boolean;
};

export function defaultResultsFrameworkFy(): string {
  return fyLabelForDateJulyJune();
}

export default function ResultsFrameworkFyFilter({ value, onChange, disabled }: Props) {
  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      <Form.Label className="small fw-semibold text-muted mb-0">Financial year</Form.Label>
      <Form.Select
        size="sm"
        className="fw-semibold"
        style={{ width: 'auto', minWidth: '140px' }}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {RESULTS_FRAMEWORK_FY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Form.Select>
    </div>
  );
}
