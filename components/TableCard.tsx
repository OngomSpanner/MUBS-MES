import { ReactNode } from 'react';


interface TableCardProps {
  title: string;
  icon: string;
  children: ReactNode;
  headerActions?: ReactNode;
  footer?: ReactNode;
}

export default function TableCard({ title, icon, children, headerActions, footer }: TableCardProps) {
  return (
    <div className="table-card">
      <div className="table-card-header">
        <h5>
          <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>{icon}</span>
          {title}
        </h5>
        {headerActions && <div className="d-flex gap-2 flex-wrap">{headerActions}</div>}
      </div>
      <div className="table-responsive">
        {children}
      </div>
      {footer && <div className="table-card-footer">{footer}</div>}
    </div>
  );
}