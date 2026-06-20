'use client';

import { Form } from 'react-bootstrap';
import {
  ACTIVITY_FY_TARGET_COLUMNS,
  type ActivityFyTargetKey,
} from '@/lib/activity-fy-targets';
import {
  ACTIVITY_FY_UNIT_OF_MEASURE_OPTIONS,
  labelForActivityUnitOfMeasure,
  symbolForActivityUnitOfMeasure,
} from '@/lib/activity-unit-of-measure';
import { formatFyRangeShort, fyRangeJulyJune } from '@/lib/financial-year';

export type ActivityFyTargetsFormValue = {
  unit_of_measure: string;
} & Record<ActivityFyTargetKey, string>;

type Props = {
  value: ActivityFyTargetsFormValue;
  onChange: (value: ActivityFyTargetsFormValue) => void;
  disabled?: boolean;
};

export default function ActivityFyTargetsFields({ value, onChange, disabled }: Props) {
  return (
    <div className="row g-2">
      <div className="col-12">
        <Form.Label className="fw-bold small mb-1">Unit of measure (FY targets)</Form.Label>
        <Form.Select
          size="sm"
          value={value.unit_of_measure}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, unit_of_measure: e.target.value })}
        >
          {ACTIVITY_FY_UNIT_OF_MEASURE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Form.Select>
      </div>
      <div className="col-12">
        <Form.Label className="fw-bold small mb-1">Targets by financial year</Form.Label>
        <div className="table-responsive border rounded">
          <table className="table table-sm table-bordered align-middle mb-0" style={{ fontSize: '0.72rem' }}>
            <thead className="table-light">
              <tr>
                {ACTIVITY_FY_TARGET_COLUMNS.map(({ key, label }) => (
                  <th key={key} className="text-center px-1 py-1">
                    <span title={formatFyRangeShort(fyRangeJulyJune(label.replace('FY ', '')))}>
                      {label.replace('FY ', '')}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {ACTIVITY_FY_TARGET_COLUMNS.map(({ key }) => (
                  <td key={key} className="p-0 align-middle">
                    <div className="d-flex align-items-stretch">
                      <Form.Control
                        type="number"
                        step="any"
                        size="sm"
                        className="text-center border-0 rounded-0 flex-grow-1"
                        style={{ fontSize: '0.8rem', minWidth: 0 }}
                        placeholder="—"
                        disabled={disabled}
                        value={value[key]}
                        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                      />
                      <span
                        className="d-flex align-items-center justify-content-center text-secondary border-start bg-light px-1 fw-bold user-select-none"
                        style={{ fontSize: '0.65rem', minWidth: '2rem', letterSpacing: '-0.02em' }}
                        title={labelForActivityUnitOfMeasure(value.unit_of_measure)}
                      >
                        {symbolForActivityUnitOfMeasure(value.unit_of_measure)}
                      </span>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
