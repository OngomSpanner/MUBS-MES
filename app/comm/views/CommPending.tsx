"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { linkify } from '@/lib/linkify';

interface ProposalItem {
    id: number;
    title: string;
    status: string;
    date: string | null;
    meta: string;
    committee_type?: string;
    department_name?: string;
    minute_reference?: string;
    description?: string;
    submitted_by_name?: string | null;
    committee_position?: string | null;
    budget?: number | null;
}

export default function CommPending() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const detailId = searchParams.get('id');
    const [list, setList] = useState<ProposalItem[]>([]);
    const [loading, setLoading] = useState(true);

    const selectedProposal = detailId ? list.find((p) => String(p.id) === detailId) : null;
    const closeDetail = () => router.replace('/comm?pg=pending', { scroll: false });

    const fetchList = async () => {
        try {
            const res = await axios.get('/api/comm/proposals?status=Pending');
            setList(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error('Pending proposals fetch error', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, []);

    return (
        <div className="content-area-comm">
            <div className="alert d-flex align-items-center gap-2 mb-4" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '5px solid var(--mubs-yellow)', borderRadius: '10px', color: '#713f12' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>hourglass_top</span>
                <div><strong>{list.length} proposal{list.length !== 1 ? 's' : ''}</strong> {list.length === 1 ? 'is' : 'are'} currently awaiting review. Once the Principal makes a decision, you will be notified by email and in-system.</div>
            </div>

            <div className="d-flex flex-column gap-0">
                {loading ? (
                    <div className="p-4 text-center text-muted">Loading…</div>
                ) : list.length === 0 ? (
                    <div className="p-4 text-center text-muted">No pending proposals.</div>
                ) : (
                    list.map((p) => (
                        <div key={p.id} className="proposal-card pending">
                            <div className="d-flex align-items-start gap-3 flex-wrap">
                                <div className="activity-icon"><span className="material-symbols-outlined">description</span></div>
                                <div className="flex-fill">
                                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                        <div className="proposal-title">{p.title}</div>
                                        <span className="status-badge" style={{ background: '#fef9c3', color: '#a16207' }}>{p.status === 'Edit Requested' ? 'Edit Requested' : 'Pending — Principal Review'}</span>
                                    </div>
                                    <div className="proposal-meta">
                                        {p.minute_reference ? `${p.minute_reference} · ` : ''}
                                        {p.date ? `Proposed ${p.date}` : ''}
                                        {p.committee_type ? ` · Committee: ${p.committee_type}` : ''}
                                        {p.department_name ? ` · Department: ${p.department_name}` : ''}
                                    </div>
                                    <div className="stepper mt-3 mb-2" style={{ maxWidth: '420px' }}>
                                        <div className="step done"><div className="step-dot"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span></div><div className="step-label">Submitted</div></div>
                                        <div className="step done"><div className="step-dot"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span></div><div className="step-label">Admin</div></div>
                                        <div className="step active-step"><div className="step-dot"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>gavel</span></div><div className="step-label">Principal</div></div>
                                        <div className="step"><div className="step-dot">4</div><div className="step-label">Decision</div></div>
                                    </div>
                                    {p.minute_reference && (
                                        <div className="d-flex align-items-center gap-2 mt-1">
                                            <span style={{ fontSize: '.73rem', background: '#f5f3ff', color: '#6d28d9', padding: '.18rem .55rem', borderRadius: '99px', fontWeight: 700 }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>description</span> Minutes attached</span>
                                        </div>
                                    )}
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <Link href={`/comm?pg=pending&id=${p.id}`} className="btn btn-sm btn-outline-secondary fw-bold">View Details</Link>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Detail modal when ?id= is in URL */}
            {selectedProposal && (
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} aria-modal="true" role="dialog">
                    <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                        <div className="modal-content">
                            <div className="modal-header border-0">
                                <h5 className="modal-title fw-bold">{selectedProposal.title}</h5>
                                <button type="button" className="btn-close" onClick={closeDetail} aria-label="Close" />
                            </div>
                            <div className="modal-body">
                                <div className="small">
                                    <p className="text-muted mb-2">
                                        {selectedProposal.committee_type && <span className="me-2">Committee: {selectedProposal.committee_type}</span>}
                                        {selectedProposal.date && <span className="me-2">· Proposed {selectedProposal.date}</span>}
                                        {selectedProposal.minute_reference && <span>· <span style={{ wordBreak: 'break-word' }}>{linkify(selectedProposal.minute_reference)}</span></span>}
                                    </p>
                                    {(selectedProposal.submitted_by_name || selectedProposal.committee_position) && (
                                        <p className="mb-2">
                                            <strong>Submitted by:</strong> {selectedProposal.submitted_by_name || '—'}
                                            {selectedProposal.committee_position ? `, ${selectedProposal.committee_position}` : ''}
                                        </p>
                                    )}
                                    {selectedProposal.department_name && <p className="mb-2"><strong>Suggested department:</strong> {selectedProposal.department_name}</p>}
                                    {selectedProposal.budget != null && <p className="mb-2"><strong>Budget:</strong> {selectedProposal.budget}</p>}
                                    {selectedProposal.description && (
                                        <div className="mt-2">
                                            <strong>Description / Rationale</strong>
                                            <div className="mt-1 p-2 rounded bg-light" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{linkify(selectedProposal.description)}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer border-0">
                                <button type="button" className="btn btn-outline-secondary" onClick={closeDetail}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
