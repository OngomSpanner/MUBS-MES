'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface Staff {
    id: number;
    full_name: string;
    email: string;
    role: string;
    leave_status: string;
    contract_end_date: string;
    active_tasks: number;
}

interface Alert {
    id: number;
    name: string;
    role: string;
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
    const [data, setData] = useState<StaffData | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/department-head/staff');
                setData(response.data);
            } catch (error) {
                console.error('Error fetching department staff:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

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
        s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    return (
        <div id="page-staff" className="page-section active-page">
            <div className="row g-4">
                {/* HR Alerts (Top priority) */}
                <div className="col-12 col-xl-4 order-xl-2">
                    <div className="table-card mb-4 shadow-sm" style={{ borderTop: '4px solid var(--mubs-red)' }}>
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
                                data.alerts.map((alert, idx) => (
                                    <div key={idx} className={`warn-card mb-3 p-3 rounded-3 border-start border-4 ${alert.type === 'Leave' ? 'bg-danger-subtle border-danger' : 'bg-warning-subtle border-warning'}`}>
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
                                            Role: {alert.role}<br />
                                            Impact: {alert.activeTasks} active tasks assigned.
                                        </div>
                                        <button className={`btn btn-sm w-100 fw-bold ${alert.type === 'Leave' ? 'btn-danger' : 'btn-warning'} py-1`} style={{ fontSize: '.75rem' }}>
                                            {alert.type === 'Leave' ? 'Reassign Tasks' : 'Action'}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Staff List */}
                <div className="col-12 col-xl-8 order-xl-1">
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
                                        <th style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Role</th>
                                        <th style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Active Tasks</th>
                                        <th style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Status</th>
                                        <th className="pe-4 text-end" style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStaff.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-5 text-muted">No staff found matching your criteria.</td>
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
                                                                {s.leave_status !== 'On Duty' && (
                                                                    <span className="ms-2 badge bg-warning-subtle text-warning border border-warning-subtle" style={{ fontSize: '.6rem' }}>{s.leave_status.toUpperCase()}</span>
                                                                )}
                                                            </div>
                                                            <div className="text-muted small" style={{ fontSize: '.72rem' }}>{s.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td><span className="small text-dark fw-medium">{s.role}</span></td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className={`fw-black ${s.active_tasks > 3 ? 'text-danger' : 'text-primary'}`} style={{ fontSize: '.9rem' }}>{s.active_tasks}</span>
                                                        <span className="text-muted small">Assigned</span>
                                                    </div>
                                                </td>
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
                                                <td className="pe-4 text-end">
                                                    <div className="d-flex gap-1 justify-content-end">
                                                        <button className="btn btn-sm btn-icon border-0 bg-primary-subtle text-primary p-2" title="Assign Task">
                                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>assignment_ind</span>
                                                        </button>
                                                        <button className="btn btn-sm btn-icon border-0 bg-light-subtle text-secondary p-2" title="View Profile">
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
            </div>
        </div>
    );
}
