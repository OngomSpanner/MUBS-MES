'use client';

import React from 'react';

interface ComplianceHistory {
  month: string;
  year: number;
  status: 'submitted' | 'missing';
}

interface ComplianceUnit {
  id: number;
  name: string;
  history: ComplianceHistory[];
}

interface ComplianceGridProps {
  months: string[];
  grid: ComplianceUnit[];
  title?: string;
  loading?: boolean;
}

const ComplianceGrid: React.FC<ComplianceGridProps> = ({ months, grid, title, loading }) => {
  if (loading) {
    return (
      <div className="table-card p-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading Compliance Data...</span>
        </div>
        <p className="mt-3 text-muted small fw-bold">Gathering Institutional Compliance Data...</p>
      </div>
    );
  }

  return (
    <div className="table-card p-0 border-0 shadow-sm overflow-hidden mb-4">
      <div className="table-card-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
        <h5 className="mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1rem', fontWeight: 800 }}>
          <span className="material-symbols-outlined text-primary">calendar_month</span>
          {title || 'Monthly Strategic Submission Tracking'}
        </h5>
        <div className="d-flex align-items-center gap-3">
           <div className="d-flex align-items-center gap-1">
             <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '2px' }}></div>
             <span style={{ fontSize: '.65rem', fontWeight: 700, color: '#64748b' }}>Submitted</span>
           </div>
           <div className="d-flex align-items-center gap-1">
             <div style={{ width: '12px', height: '12px', background: '#e2e8f0', borderRadius: '2px' }}></div>
             <span style={{ fontSize: '.65rem', fontWeight: 700, color: '#64748b' }}>Pending</span>
           </div>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th className="ps-4 py-3" style={{ fontSize: '.75rem', fontWeight: 800, color: '#475569', minWidth: '220px' }}>DEPARTMENT / UNIT</th>
              {months.map((m, i) => (
                <th key={i} className="text-center py-3" style={{ fontSize: '.75rem', fontWeight: 800, color: '#475569' }}>
                  {m.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.length === 0 ? (
              <tr>
                <td colSpan={months.length + 1} className="text-center py-5 text-muted small">
                  No departments found for compliance tracking.
                </td>
              </tr>
            ) : grid.map((unit) => (
              <tr key={unit.id} className="compliance-row">
                <td className="ps-4">
                  <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{unit.name}</div>
                </td>
                {unit.history.map((h, i) => (
                  <td key={i} className="text-center">
                    <div className="d-flex justify-content-center">
                      <div 
                        title={`${h.month} ${h.year}: ${h.status === 'submitted' ? 'Report Received' : 'Missing Report'}`}
                        className={`compliance-box ${h.status === 'submitted' ? 'active' : 'inactive'}`}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: h.status === 'submitted' ? '#10b981' : '#f1f5f9',
                          border: h.status === 'submitted' ? 'none' : '1px solid #e2e8f0',
                          transition: 'all 0.2s ease',
                          cursor: 'help'
                        }}
                      ></div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <style jsx>{`
        .compliance-row:hover {
          background-color: #f8fafc;
        }
        .compliance-box.active {
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
        }
        .compliance-box:hover {
          transform: scale(1.1);
          z-index: 10;
        }
        .compliance-box.inactive:hover {
          background-color: #fca5a5 !important;
          border-color: #ef4444 !important;
        }
      `}</style>
    </div>
  );
};

export default ComplianceGrid;
