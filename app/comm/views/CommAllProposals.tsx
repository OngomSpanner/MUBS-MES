"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface ProposalRow {
    id: number;
    title: string;
    status: string;
    date: string | null;
    committee_type?: string;
    minute_reference?: string;
    department_name?: string;
}

interface CommAllProposalsProps {
    showOnlyMine?: boolean;
}

export default function CommAllProposals({ showOnlyMine }: CommAllProposalsProps) {
    const [list, setList] = useState<ProposalRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                let url = '/api/comm/proposals';
                const params = new URLSearchParams();
                if (showOnlyMine) params.set('my', '1');
                if (statusFilter) params.set('status', statusFilter);
                if (params.toString()) url += '?' + params.toString();
                const res = await axios.get(url);
                setList(Array.isArray(res.data) ? res.data : []);
            } catch (e) {
                console.error('Proposals list fetch error', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [showOnlyMine, statusFilter]);

    const total = list.length;
    const pendingCount = list.filter((p) => p.status === 'Pending' || p.status === 'Edit Requested').length;
    const approvedCount = list.filter((p) => p.status === 'Approved').length;
    const rejectedCount = list.filter((p) => p.status === 'Rejected').length;

    const statusStyle = (s: string) => {
        if (s === 'Approved') return { background: '#dcfce7', color: '#15803d' };
        if (s === 'Pending' || s === 'Edit Requested') return { background: '#fef9c3', color: '#a16207' };
        if (s === 'Rejected') return { background: '#fee2e2', color: '#b91c1c' };
        return { background: '#f1f5f9', color: '#475569' };
    };

    return (
        <div className="content-area-comm">
            <div className="row g-3 mb-4">
                <div className="col-6 col-sm-3"><div className="stat-card text-center" style={{ borderLeftColor: '#7c3aed', padding: '.45rem .5rem' }}><div className="stat-value" style={{ fontSize: '1.05rem', color: '#7c3aed' }}>{loading ? '…' : total}</div><div className="stat-label">Total</div></div></div>
                <div className="col-6 col-sm-3"><div className="stat-card text-center" style={{ borderLeftColor: 'var(--mubs-yellow)', padding: '.45rem .5rem' }}><div className="stat-value" style={{ fontSize: '1.05rem', color: '#b45309' }}>{loading ? '…' : pendingCount}</div><div className="stat-label">Pending</div></div></div>
                <div className="col-6 col-sm-3"><div className="stat-card text-center" style={{ borderLeftColor: '#10b981', padding: '.45rem .5rem' }}><div className="stat-value" style={{ fontSize: '1.05rem', color: '#059669' }}>{loading ? '…' : approvedCount}</div><div className="stat-label">Approved</div></div></div>
                <div className="col-6 col-sm-3"><div className="stat-card text-center" style={{ borderLeftColor: 'var(--mubs-red)', padding: '.45rem .5rem' }}><div className="stat-value" style={{ fontSize: '1.05rem', color: 'var(--mubs-red)' }}>{loading ? '…' : rejectedCount}</div><div className="stat-label">Rejected</div></div></div>
            </div>

            <div className="table-card">
                <div className="table-card-header">
                    <h5><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>list_alt</span>{showOnlyMine ? 'My Committee Proposals' : 'All Committee Proposals'}</h5>
                    <div className="d-flex gap-2 flex-wrap">
                        <select className="form-select form-select-sm" style={{ width: '140px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="">All Status</option>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Edit Requested">Edit Requested</option>
                        </select>
                        <Link href="/comm?pg=propose" className="btn btn-sm fw-bold text-white" style={{ background: '#7c3aed' }}>
                            <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>add</span>New Proposal
                        </Link>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="table mb-0">
                        <thead><tr><th>Proposal</th><th>Committee</th><th>Meeting Ref.</th><th>Submitted</th><th>Status</th><th>Department</th><th>Actions</th></tr></thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="text-center p-4 text-muted">Loading…</td></tr>
                            ) : list.length === 0 ? (
                                <tr><td colSpan={7} className="text-center p-4 text-muted">No proposals found.</td></tr>
                            ) : (
                                list.map((p) => (
                                    <tr key={p.id} style={p.status === 'Pending' || p.status === 'Edit Requested' ? { background: '#fffbeb' } : p.status === 'Rejected' ? { background: '#fff9f9' } : undefined}>
                                        <td>
                                            <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{p.title}</div>
                                        </td>
                                        <td><span className="status-badge" style={{ background: '#eff6ff', color: 'var(--mubs-blue)', fontSize: '.62rem' }}>{p.committee_type || '—'}</span></td>
                                        <td style={{ fontSize: '.8rem' }}>{p.minute_reference || '—'}</td>
                                        <td style={{ fontSize: '.8rem', color: '#64748b' }}>{p.date || '—'}</td>
                                        <td><span className="status-badge" style={statusStyle(p.status)}>{p.status}</span></td>
                                        <td style={{ fontSize: '.82rem', fontWeight: p.status === 'Approved' ? 700 : 400, color: p.status === 'Approved' ? '#059669' : '#94a3b8' }}>{p.department_name || (p.status !== 'Approved' ? 'Awaiting approval' : '—')}</td>
                                        <td>
                                        <Link
                                            href={p.status === 'Approved' ? '/comm?pg=approved' : p.status === 'Rejected' ? '/comm?pg=rejected' : `/comm?pg=pending&id=${p.id}`}
                                            className="btn btn-xs btn-outline-secondary py-0 px-2"
                                            style={{ fontSize: '.74rem' }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>visibility</span>
                                        </Link>
                                    </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="table-card-footer">
                    <span className="footer-label">Showing {list.length} proposal{list.length !== 1 ? 's' : ''}</span>
                </div>
            </div>
        </div>
    );
}
