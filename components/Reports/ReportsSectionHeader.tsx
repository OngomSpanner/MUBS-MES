'use client';

import type { ReactNode } from 'react';
import { Badge } from 'react-bootstrap';

type Props = {
  icon: string;
  title: string;
  count?: number;
  description?: ReactNode;
  filters?: ReactNode;
};

/** Shared header row for Reports content sections (matches Ambassador / Questionnaire). */
export default function ReportsSectionHeader({ icon, title, count, description, filters }: Props) {
  return (
    <>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
        <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>
            {icon}
          </span>
          {title}
          {count !== undefined ? <Badge bg="secondary">{count}</Badge> : null}
        </h6>
        {filters ? <div className="ms-auto d-flex flex-wrap gap-2 align-items-center">{filters}</div> : null}
      </div>
      {description ? <p className="text-muted small mb-3">{description}</p> : null}
    </>
  );
}
