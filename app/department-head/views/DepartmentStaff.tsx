'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface Staff {
    id: number;
    full_name: string;
    email: string;
    position: string;
    leave_status: string;
    contract_end_date: string | null;
    active_tasks: number;
}

interface Alert {
    id: number;
    name: string;
    position: string;
    type: string;
    message: string;
    daysRemaining: number | null;
    activeTasks: number;
}

interface StaffData {
    staff: Staff[];
    alerts: Alert[];
}

export default function DepartmentStaff() {
    const router = useRouter();
    const [data, setData] = useState<StaffData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [profileStaff, setProfileStaff] = useState<Staff | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/department-head/staff');
                setData(response.data);
            } catch (error: any) {
                console.error('Error fetching department staff:', error);
                setError(error.response?.data?.message || 'Failed to load department staff. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (error) {
        return (
            <div className="container mt-5">
                <div className="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3 p-4" role="alert">
                    <span className="material-symbols-outlined fs-2 text-danger">error</span>
                    <div>
                        <h5 className="alert-heading text-danger fw-bold mb-1">Error Loading Staff</h5>
                        <p className="mb-0 text-dark opacity-75">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (loading || !data) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const filteredStaff = data.staff.filter(s =>
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.position || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    return (
        <div id="page-staff" className="page-section active-page">
            <div className="row g-4">
                {/* Department Staff Roster — full width first */}
                <div className="col-12">
                    <div className="table-card shadow-sm border-0">
                        <div className="table-card-header bg-white border-bottom py-3">
                            <h5 className="mb-0 fw-black text-dark d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-primary">group</span>
                                Department Staff Roster
                            </h5>
                            <div className="ms-auto" style={{ width: '220px' }}>
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-light border-end-0">
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#64748b' }}>search</span>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control bg-light border-start-0 ps-0"
                                        placeholder="Search staff..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0 align-middle">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="ps-4" style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Staff Member</th>
                                        <th style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Position</th>
                                        <th style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Leave Status</th>
                                        <th style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Contract End</th>
                                        <th style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Active Tasks</th>
                                        <th className="pe-4 text-end" style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStaff.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-5 text-muted">No staff found matching your criteria.</td>
                                        </tr>
                                    ) : (
                                        filteredStaff.map((s) => (
                                            <tr key={s.id} className={s.leave_status !== 'On Duty' ? 'bg-light bg-opacity-50' : ''}>
                                                <td className="ps-4">
                                                    <div className="d-flex align-items-center gap-3 py-1">
                                                        <div className="staff-avatar" style={{
                                                            background: 'var(--mubs-blue)',
                                                            width: '36px',
                                                            height: '36px',
                                                            borderRadius: '10px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: '#fff',
                                                            fontWeight: 'bold',
                                                            fontSize: '.85rem'
                                                        }}>
                                                            {getInitials(s.full_name)}
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>
                                                                {s.full_name}
                                                            </div>
                                                            <div className="text-muted small" style={{ fontSize: '.72rem' }}>{s.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td><span className="small text-dark fw-medium">{s.position || '—'}</span></td>
                                                <td>
                                                    <span className="status-badge" style={{
                                                        background: s.leave_status === 'On Duty' ? '#dcfce7' : '#fef9c3',
                                                        color: s.leave_status === 'On Duty' ? '#15803d' : '#a16207',
                                                        fontSize: '0.65rem'
                                                    }}>
                                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '10px' }}>circle</span>
                                                        {s.leave_status === 'On Duty' ? 'Active' : s.leave_status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {s.contract_end_date ? (
                                                        <span className="small text-dark" style={{ fontSize: '.8rem' }}>
                                                            {new Date(s.contract_end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted small">—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className={`fw-black ${s.active_tasks > 3 ? 'text-danger' : 'text-primary'}`} style={{ fontSize: '.9rem' }}>{s.active_tasks}</span>
                                                        <span className="text-muted small">Assigned</span>
                                                    </div>
                                                </td>
                                                <td className="pe-4 text-end">
                                                    <div className="d-flex gap-1 justify-content-end">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-icon border-0 bg-primary-subtle text-primary p-2"
                                                            title="Assign Task"
                                                            onClick={() => router.push(`/department-head?pg=tasks&assignee=${encodeURIComponent(s.full_name)}`)}
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>assignment_ind</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-icon border-0 bg-light-subtle text-secondary p-2"
                                                            title="View Profile"
                                                            onClick={() => setProfileStaff(s)}
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-card-footer border-top py-3 px-4">
                            <span className="footer-label small text-muted">Showing {filteredStaff.length} of {data.staff.length} staff members</span>
                        </div>
                    </div>
                </div>

                {/* HR Action Required — below roster */}
                <div className="col-12">
                    <div className="table-card shadow-sm" style={{ borderTop: '4px solid var(--mubs-red)' }}>
                        <div className="table-card-header" style={{ background: '#fff1f2', borderBottom: '1px solid #fee2e2' }}>
                            <h5 className="mb-0 fw-black text-danger d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined">assignment_late</span>
                                HR Action Required
                            </h5>
                        </div>
                        <div className="p-3">
                            {data.alerts.length === 0 ? (
                                <div className="text-center py-4 text-muted small">
                                    No HR alerts at this time.
                                </div>
                            ) : (
                                <div className="row g-3">
                                    {data.alerts.map((alert, idx) => (
                                        <div key={idx} className="col-12 col-md-6 col-lg-4">
                                            <div className={`warn-card p-3 rounded-3 border-start border-4 h-100 ${alert.type === 'Leave' ? 'bg-danger-subtle border-danger' : 'bg-warning-subtle border-warning'}`}>
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <div className="fw-bold text-dark d-flex align-items-center gap-2">
                                                        <div className="staff-avatar" style={{
                                                            background: alert.type === 'Leave' ? '#dc2626' : '#d97706',
                                                            width: '28px',
                                                            height: '28px',
                                                            fontSize: '.7rem',
                                                            borderRadius: '8px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: '#fff',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {getInitials(alert.name)}
                                                        </div>
                                                        <span style={{ fontSize: '.9rem' }}>{alert.name}</span>
                                                    </div>
                                                    <span className={`badge ${alert.type === 'Leave' ? 'bg-danger text-white' : 'bg-warning text-dark'}`} style={{ fontSize: '.6rem' }}>
                                                        {alert.type.toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="text-dark fw-bold mb-1" style={{ fontSize: '.8rem' }}>{alert.message}</div>
                                                <div className="text-muted mb-3" style={{ fontSize: '.75rem', lineHeight: '1.4' }}>
                                                    Position: {alert.position}<br />
                                                    Impact: {alert.activeTasks} active tasks assigned.
                                                </div>
                                                <button className={`btn btn-sm w-100 fw-bold ${alert.type === 'Leave' ? 'btn-danger' : 'btn-warning'} py-1`} style={{ fontSize: '.75rem' }}>
                                                    {alert.type === 'Leave' ? 'Reassign Tasks' : 'Action'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* View Profile Modal */}
            {profileStaff && (
                <>
                    <div className="modal-backdrop fade show" style={{ zIndex: 1040, background: 'rgba(15, 23, 42, 0.5)' }} onClick={() => setProfileStaff(null)} />
                    <div className="modal fade show d-block" tabIndex={-1} style={{ zIndex: 1050 }} onClick={() => setProfileStaff(null)}>
                        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                                <div className="modal-header border-bottom py-3 px-4">
                                    <h5 className="modal-title fw-black text-dark d-flex align-items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">person</span>
                                        Staff Profile
                                    </h5>
                                    <button type="button" className="btn-close" onClick={() => setProfileStaff(null)} aria-label="Close" />
                                </div>
                                <div className="modal-body p-4">
                                    <div className="d-flex align-items-center gap-4 mb-4">
                                        <div className="staff-avatar" style={{
                                            background: 'var(--mubs-blue)',
                                            width: '64px',
                                            height: '64px',
                                            borderRadius: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                            fontWeight: 'bold',
                                            fontSize: '1.5rem'
                                        }}>
                                            {getInitials(profileStaff.full_name)}
                                        </div>
                                        <div>
                                            <h6 className="fw-black text-dark mb-1" style={{ fontSize: '1.1rem' }}>{profileStaff.full_name}</h6>
                                            <div className="text-muted small">{profileStaff.email}</div>
                                            <div className="fw-medium text-dark mt-1" style={{ fontSize: '.9rem' }}>{profileStaff.position || '—'}</div>
                                        </div>
                                    </div>
                                    <div className="row g-3">
                                        <div className="col-6">
                                            <div className="p-3 rounded-3 bg-light">
                                                <div className="text-muted small text-uppercase fw-bold mb-1">Leave Status</div>
                                                <span className="status-badge" style={{
                                                    background: profileStaff.leave_status === 'On Duty' ? '#dcfce7' : '#fef9c3',
                                                    color: profileStaff.leave_status === 'On Duty' ? '#15803d' : '#a16207',
                                                    fontSize: '0.75rem'
                                                }}>
                                                    {profileStaff.leave_status === 'On Duty' ? 'Active' : profileStaff.leave_status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="p-3 rounded-3 bg-light">
                                                <div className="text-muted small text-uppercase fw-bold mb-1">Contract End</div>
                                                <div className="fw-medium text-dark">
                                                    {profileStaff.contract_end_date
                                                        ? new Date(profileStaff.contract_end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                                        : '—'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <div className="p-3 rounded-3 bg-light">
                                                <div className="text-muted small text-uppercase fw-bold mb-1">Active Tasks</div>
                                                <div className="fw-black text-primary" style={{ fontSize: '1.25rem' }}>{profileStaff.active_tasks} assigned</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer border-top py-3 px-4">
                                    <button type="button" className="btn btn-secondary fw-bold" onClick={() => setProfileStaff(null)}>Close</button>
                                    <button
                                        type="button"
                                        className="btn btn-primary fw-bold d-flex align-items-center gap-2"
                                        onClick={() => { setProfileStaff(null); router.push(`/department-head?pg=tasks&assignee=${encodeURIComponent(profileStaff.full_name)}`); }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>assignment_ind</span>
                                        Assign Task
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
