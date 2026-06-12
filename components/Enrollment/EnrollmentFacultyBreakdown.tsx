'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import type { EnrollmentFacultyBreakdownRow } from '@/lib/ambassador/enrollment-records';

export default function EnrollmentFacultyBreakdown() {
  const [rows, setRows] = useState<EnrollmentFacultyBreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axios
      .get('/api/enrollment/summary')
      .then((res) => {
        if (cancelled) return;
        setRows(Array.isArray(res.data?.byFaculty) ? res.data.byFaculty : []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || rows.length === 0) return null;

  return (
    <div className="table-card shadow-sm border-0 bg-white mb-4" style={{ borderRadius: '16px', overflow: 'hidden' }}>
      <div className="p-4 border-bottom">
        <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
          <span className="material-symbols-outlined text-primary">school</span>
          Enrollment by faculty / school
        </h5>
        <p className="text-muted small mb-0 mt-1">Programme and course unit student counts aggregated by faculty.</p>
      </div>
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th className="px-4 py-3 border-0 small text-uppercase">Faculty / school</th>
              <th className="py-3 border-0 text-center small text-uppercase">Programmes</th>
              <th className="py-3 border-0 text-center small text-uppercase">Course units</th>
              <th className="py-3 border-0 text-center small text-uppercase">Students</th>
              <th className="py-3 border-0 text-center small text-uppercase">Male</th>
              <th className="py-3 border-0 text-center small text-uppercase">Female</th>
              <th className="px-4 py-3 border-0 text-center small text-uppercase">PwD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.facultyName}>
                <td className="px-4 fw-semibold small">{r.facultyName}</td>
                <td className="text-center small">{r.programmeCount}</td>
                <td className="text-center small">{r.courseUnitCount}</td>
                <td className="text-center fw-semibold small">{r.totalStudents}</td>
                <td className="text-center small">{r.maleCount}</td>
                <td className="text-center small">{r.femaleCount}</td>
                <td className="px-4 text-center small">{r.pwdCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
