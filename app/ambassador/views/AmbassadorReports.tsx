'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface ComplianceData {
    id: number;
    name: string;
    status: 'Submitted' | 'Pending';
    submissions: number;
    lastSubmission: string | null;
    progress: number;
}

export default function AmbassadorReports() {
    const [data, setData] = useState<ComplianceData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [dashRes, compRes] = await Promise.all([
                    axios.get('/api/dashboard/ambassador'),
                    axios.get('/api/ambassador/compliance')
                ]);
                
                const subUnitsMap = new Map();
                dashRes.data.subUnits.forEach((u: any) => subUnitsMap.set(u.id, u.progress));
                
                const mappedData: ComplianceData[] = compRes.data.grid.map((unit: any) => {
                    // The last item in history is the current month
                    const currentHistory = unit.history[unit.history.length - 1];
                    const progress = subUnitsMap.get(unit.id) || 0;
                    
                    return {
                        id: unit.id,
                        name: unit.name,
                        status: currentHistory?.status === 'submitted' ? 'Submitted' : 'Pending',
                        submissions: unit.history.filter((h: any) => h.status === 'submitted').length,
                        lastSubmission: null, // we don't have exact last submission date from this API
                        progress: progress
                    };
                });
                
                setData(mappedData);
            } catch (err: any) {
                console.error('Compliance fetch error:', err);
                setError('Failed to load compliance data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="p-4 text-center">Loading compliance data...</div>;

    const totalDepts = data.length;
    const submittedDepts = data.filter(d => d.status === 'Submitted').length;
    const pendingDepts = totalDepts - submittedDepts;
    const complianceRate = totalDepts ? Math.round((submittedDepts / totalDepts) * 100) : 0;

    return (
        <div className="page-section active-page">
            <div className="row g-4 mb-4">
                <div className="col-12 col-md-4">
                    <div className="stat-card bg-primary text-white p-2 h-100 shadow-sm" style={{ borderRadius: '12px' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="material-symbols-outlined" style={{ opacity: 0.8 }}>fact_check</span>
                            <span className="badge bg-white text-primary fw-bold" style={{ fontSize: '.7rem' }}>Monthly Cycle</span>
                        </div>
                        <h2 className="mb-0 fw-bold">{complianceRate}%</h2>
                        <div className="small opacity-75 fw-bold text-uppercase">Reporting Compliance</div>
                    </div>
                </div>
                <div className="col-6 col-md-4">
                    <div className="stat-card bg-white p-2 h-100 shadow-sm border-0" style={{ borderRadius: '12px' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="material-symbols-outlined text-success">check_circle</span>
                            <span className="text-success small fw-bold">{submittedDepts} Submitted</span>
                        </div>
                        <h4 className="mb-0 fw-bold text-dark">{submittedDepts} / {totalDepts}</h4>
                        <div className="small text-muted fw-bold text-uppercase" style={{ fontSize: '.6rem' }}>Departments Reported</div>
                    </div>
                </div>
                <div className="col-6 col-md-4">
                    <div className="stat-card bg-white p-2 h-100 shadow-sm border-0" style={{ borderRadius: '12px' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="material-symbols-outlined text-danger">pending_actions</span>
                            <span className="text-danger small fw-bold">{pendingDepts} Pending</span>
                        </div>
                        <h4 className="mb-0 fw-bold text-dark">{pendingDepts} / {totalDepts}</h4>
                        <div className="small text-muted fw-bold text-uppercase" style={{ fontSize: '.6rem' }}>Missing Submissions</div>
                    </div>
                </div>
            </div>

            <div className="table-card shadow-sm border-0 bg-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                <div className="p-4 border-bottom d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 fw-bold">Departmental Compliance Tracker</h5>
                    <div className="badge bg-light text-dark border p-2 px-3 d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>event</span>
                        Current Reporting Cycle: {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                    </div>
                </div>
                <div className="table-responsive p-0">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th className="px-4 py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>UNIT NAME</th>
                                <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>SUBMISSION STATUS</th>
                                <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>LAST REPORT</th>
                                <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>PROGRESS</th>
                                <th className="px-4 py-3 border-0 text-end" style={{ fontSize: '.7rem', fontWeight: 800 }}>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(item => (
                                <tr key={item.id}>
                                    <td className="px-4">
                                        <div className="fw-bold text-dark" style={{ fontSize: '.9rem' }}>{item.name}</div>
                                        <div className="text-muted" style={{ fontSize: '.65rem' }}>Managed Department</div>
                                    </td>
                                    <td>
                                        <span className={`badge rounded-pill px-3 py-1 ${item.status === 'Submitted' ? 'bg-success-subtle text-success border border-success' : 'bg-danger-subtle text-danger border border-danger'}`} style={{ fontSize: '.65rem', fontWeight: 800 }}>
                                            {item.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="d-flex align-items-center gap-2 small fw-bold text-dark">
                                            <span className="material-symbols-outlined text-muted" style={{ fontSize: '16px' }}>calendar_today</span>
                                            {item.lastSubmission ? new Date(item.lastSubmission).toLocaleDateString() : 'No submissions'}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="d-flex align-items-center gap-2">
                                            <div className="progress flex-fill" style={{ height: '6px', width: '80px', background: '#f1f5f9' }}>
                                                <div 
                                                    className="progress-bar px-1" 
                                                    style={{ width: `${item.progress}%`, background: item.progress > 70 ? '#10b981' : item.progress > 40 ? '#f59e0b' : '#ef4444' }}
                                                ></div>
                                            </div>
                                            <span className="small fw-bold">{item.progress}%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 text-end">
                                        <button className={`btn btn-sm rounded-pill px-3 fw-bold ${item.status === 'Submitted' ? 'btn-outline-primary' : 'btn-primary shadow-sm'}`} style={{ fontSize: '.65rem' }}>
                                            {item.status === 'Submitted' ? 'View Report' : 'Send Reminder'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
