'use client';

import type { ReactNode } from 'react';
import { Badge } from 'react-bootstrap';

type Props = {
  icon: string;
  title: string;
  count?: number;
  description?: ReactNode;
  filters?: ReactNode;
  /** Full-width row under the title/filter line (e.g. department group chips). */
  filterRowBelow?: ReactNode;
};

/** Shared header row for Reports content sections (matches Ambassador / Questionnaire). */
export default function ReportsSectionHeader({ icon, title, count, description, filters, filterRowBelow }: Props) {
  return (
    <>
      <div className="d-flex flex-wrap gap-2 align-items-start mb-2">
        <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>
            {icon}
          </span>
          {title}
          {count !== undefined ? <Badge bg="secondary">{count}</Badge> : null}
        </h6>
        {filters ? <div className="ms-auto d-flex flex-wrap gap-2 align-items-start">{filters}</div> : null}
      </div>
      {filterRowBelow ? <div className="mb-2">{filterRowBelow}</div> : null}
      {description ? <p className="text-muted small mb-3">{description}</p> : null}
    </>
  );
}
