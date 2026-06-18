'use client';

import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

/** Scroll wrapper for reports data tables. */
export function ReportsTableWrap({ children, className }: Props) {
  return <div className={`table-responsive reports-table-wrap ${className ?? ''}`.trim()}>{children}</div>;
}

export const REPORTS_TABLE_CLASS = 'reports-data-table';
