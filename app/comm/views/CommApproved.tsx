"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { linkify } from '@/lib/linkify';

interface ProposalItem {
    id: number;
    title: string;
    status: string;
    date: string | null;
    reviewed_date: string | null;
    department_name?: string;
    minute_reference?: string;
    committee_type?: string;
    submitted_by_name?: string | null;
    committee_position?: string | null;
    description?: string;
    budget?: number | null;
}

export default function CommApproved() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const detailId = searchParams.get('id');
    const [list, setList] = useState<ProposalItem[]>([]);
    const [loading, setLoading] = useState(true);

    const selectedProposal = detailId ? list.find((p) => String(p.id) === detailId) : null;
    const closeModal = () => router.replace('/comm?pg=approved', { scroll: false });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get('/api/comm/proposals?status=Approved');
                setList(Array.isArray(res.data) ? res.data : []);
            } catch (e) {
                console.error('Approved proposals fetch error', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    return (
        <div className="content-area-comm">
            <div className="alert d-flex align-items-center gap-2 mb-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: '5px solid #10b981', borderRadius: '10px', color: '#14532d' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>check_circle</span>
                <div>These proposals have been <strong>approved</strong> by the Principal and assigned to implementing departments. Shown below as <strong>read-only</strong>.</div>
            </div>

            <div className="table-card" style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}>
                <div className="table-card-header d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)' }}>
                    <h5 className="mb-0 fw-bold d-flex align-items-center gap-2" style={{ color: '#0f172a', fontSize: '1rem' }}>
                        <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: '22px' }}>done_all</span>
                        Approved Proposals
                    </h5>
                    {!loading && list.length > 0 && (
                        <span className="badge rounded-pill" style={{ background: '#dcfce7', color: '#15803d', fontSize: '.8rem' }}>{list.length} approved</span>
                    )}
                </div>
                <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                        <thead style={{ background: '#f8fafc' }}>
                            <tr>
                                <th style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748b', padding: '.75rem 1rem' }}>Activity / Title</th>
                                <th style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748b', padding: '.75rem 1rem' }}>Committee</th>
                                <th style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748b', padding: '.75rem 1rem' }}>Minute Ref.</th>
                                <th style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748b', padding: '.75rem 1rem' }}>Submitted</th>
                                <th style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748b', padding: '.75rem 1rem' }}>Approved</th>
                                <th style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748b', padding: '.75rem 1rem' }}>Assigned Department</th>
                                <th style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748b', padding: '.75rem 1rem', width: '100px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-5 text-muted">Loading…</td>
                                </tr>
                            ) : list.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-5 text-muted">No approved proposals.</td>
                                </tr>
                            ) : (
                                list.map((p) => (
                                    <tr key={p.id} style={{ borderBottomColor: '#f1f5f9' }}>
                                        <td style={{ padding: '.85rem 1rem', fontSize: '.9rem' }}>
                                            <div className="fw-bold text-dark">{p.title}</div>
                                            {(p.submitted_by_name || p.committee_position) && (
                                                <div className="text-muted" style={{ fontSize: '.75rem', marginTop: '2px' }}>
                                                    {p.submitted_by_name}{p.committee_position ? ` · ${p.committee_position}` : ''}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '.85rem 1rem', fontSize: '.85rem' }}>
                                            <span className="badge bg-light text-dark border border-1" style={{ borderColor: '#e2e8f0', fontSize: '.75rem' }}>{p.committee_type || '—'}</span>
                                        </td>
                                        <td style={{ padding: '.85rem 1rem', fontSize: '.85rem', color: '#64748b' }}>{p.minute_reference || '—'}</td>
                                        <td style={{ padding: '.85rem 1rem', fontSize: '.85rem', color: '#64748b' }}>{formatDate(p.date)}</td>
                                        <td style={{ padding: '.85rem 1rem', fontSize: '.85rem' }}>
                                            <span style={{ color: '#059669', fontWeight: 600 }}>{formatDate(p.reviewed_date)}</span>
                                        </td>
                                        <td style={{ padding: '.85rem 1rem', fontSize: '.85rem', fontWeight: 600, color: '#0f172a' }}>{p.department_name || '—'}</td>
                                        <td style={{ padding: '.85rem 1rem' }}>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-success fw-bold d-inline-flex align-items-center gap-1"
                                                style={{ fontSize: '.8rem' }}
                                                onClick={() => router.push(`/comm?pg=approved&id=${p.id}`)}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail modal when ?id= is in URL */}
            {selectedProposal && (
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} aria-modal="true" role="dialog">
                    <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                        <div className="modal-content">
                            <div className="modal-header border-0 pb-0" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)' }}>
                                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                    <span className="material-symbols-outlined" style={{ color: '#059669' }}>check_circle</span>
                                    {selectedProposal.title}
                                </h5>
                                <button type="button" className="btn-close" onClick={closeModal} aria-label="Close" />
                            </div>
                            <div className="modal-body pt-3">
                                <div className="small">
                                    <p className="text-muted mb-2">
                                        {selectedProposal.committee_type && <span className="me-2">Committee: {selectedProposal.committee_type}</span>}
                                        {selectedProposal.date && <span className="me-2">· Submitted {formatDate(selectedProposal.date)}</span>}
                                        {selectedProposal.reviewed_date && <span className="me-2">· Approved {formatDate(selectedProposal.reviewed_date)}</span>}
                                        {selectedProposal.minute_reference && <span>· <span style={{ wordBreak: 'break-word' }}>{linkify(selectedProposal.minute_reference)}</span></span>}
                                    </p>
                                    {(selectedProposal.submitted_by_name || selectedProposal.committee_position) && (
                                        <p className="mb-2">
                                            <strong>Submitted by:</strong> {selectedProposal.submitted_by_name || '—'}
                                            {selectedProposal.committee_position ? `, ${selectedProposal.committee_position}` : ''}
                                        </p>
                                    )}
                                    {selectedProposal.department_name && (
                                        <p className="mb-2">
                                            <strong>Assigned department:</strong>{' '}
                                            <span className="fw-bold" style={{ color: '#059669' }}>{selectedProposal.department_name}</span>
                                        </p>
                                    )}
                                    {selectedProposal.budget != null && selectedProposal.budget !== 0 && (
                                        <p className="mb-2"><strong>Budget:</strong> {Number(selectedProposal.budget).toLocaleString()}</p>
                                    )}
                                    {selectedProposal.description && (
                                        <div className="mt-3">
                                            <strong>Description / Rationale</strong>
                                            <div className="mt-1 p-2 rounded bg-light" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{linkify(selectedProposal.description)}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer border-0">
                                <button type="button" className="btn btn-outline-secondary" onClick={closeModal}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
