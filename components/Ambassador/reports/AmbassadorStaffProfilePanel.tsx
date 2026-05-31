'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import StatCard from '@/components/StatCard';
import StaffProfileModal from '@/components/Staff/StaffProfileModal';
import type { StaffProfileData } from '@/lib/staff-biodata';

type StaffRow = StaffProfileData & { department: string };

export default function AmbassadorStaffProfilePanel() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(['All Departments']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [profileStaff, setProfileStaff] = useState<StaffProfileData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get('/api/ambassador/staff-profiles');
        setStaff(res.data.staff ?? []);
        setDepartmentOptions(res.data.departmentOptions ?? ['All Departments']);
      } catch {
        setError('Failed to load unit staff profiles.');
        setStaff([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredStaff = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return staff.filter((s) => {
      if (departmentFilter !== 'All Departments' && s.department !== departmentFilter) {
        return false;
      }
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.position || '').toLowerCase().includes(q) ||
        (s.designation_grade || '').toLowerCase().includes(q)
      );
    });
  }, [staff, searchTerm, departmentFilter]);

  const departmentCount = useMemo(() => {
    const names = new Set(staff.map((s) => s.department).filter((d) => d && d !== '—'));
    return names.size;
  }, [staff]);

  const onDutyCount = useMemo(
    () => staff.filter((s) => (s.leave_status || '').toLowerCase() === 'on duty').length,
    [staff]
  );

  return (
    <div>
      {!loading && !error && (
        <div className="row g-4 mb-4">
          <div className="col-12 col-sm-6 col-xl-4">
            <StatCard label="Total staff" value={staff.length} color="blue" />
          </div>
          <div className="col-12 col-sm-6 col-xl-4">
            <StatCard label="Departments / units" value={departmentCount} color="green" />
          </div>
          <div className="col-12 col-sm-6 col-xl-4">
            <StatCard label="On duty" value={onDutyCount} color="yellow" />
          </div>
        </div>
      )}

      <div className="table-card shadow-sm border-0 bg-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div className="table-card-header flex-wrap gap-2">
          <h5 className="mb-0 d-flex align-items-center gap-2">
            <span className="material-symbols-outlined text-primary">badge</span>
            Faculty staff profiles
          </h5>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <input
              type="search"
              className="form-control form-control-sm"
              style={{ width: '200px' }}
              placeholder="Search staff…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search staff"
            />
            <select
              className="form-select form-select-sm"
              style={{ width: '220px' }}
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by department"
            >
              {departmentOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4 py-3 border-0 small fw-bold">NAME</th>
                <th className="py-3 border-0 small fw-bold">EMAIL</th>
                <th className="py-3 border-0 small fw-bold">DEPARTMENT / UNIT</th>
                <th className="py-3 border-0 small fw-bold">POSITION</th>
                <th className="py-3 border-0 small fw-bold">STATUS</th>
                <th className="pe-4 py-3 border-0 text-end small fw-bold">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <div className="alert alert-danger m-3 mb-3">{error}</div>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted small">
                    No staff match your search in this unit.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((row) => (
                  <tr key={row.id}>
                    <td className="ps-4 fw-semibold small">{row.full_name}</td>
                    <td className="small">{row.email}</td>
                    <td className="small">{row.department}</td>
                    <td className="small">{row.position || row.designation_grade || '—'}</td>
                    <td className="small">
                      <span className="badge bg-light text-dark border">
                        {row.leave_status || row.employment_status || '—'}
                      </span>
                    </td>
                    <td className="pe-4 text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold"
                        style={{ fontSize: '.65rem' }}
                        onClick={() => setProfileStaff(row)}
                      >
                        View profile
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && !error && (
          <div className="table-card-footer">
            <span className="footer-label">
              Showing {filteredStaff.length} of {staff.length} staff
            </span>
          </div>
        )}
      </div>

      <StaffProfileModal staff={profileStaff} onClose={() => setProfileStaff(null)} mode="hod" />
    </div>
  );
}
