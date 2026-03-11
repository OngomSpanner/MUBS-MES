"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface ProposalItem {
    id: number;
    title: string;
    status: string;
    date: string | null;
    reviewed_date: string | null;
    reviewer_notes?: string;
    minute_reference?: string;
    committee_type?: string;
}

export default function CommRejected() {
    const [list, setList] = useState<ProposalItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get('/api/comm/proposals?status=Rejected');
                setList(Array.isArray(res.data) ? res.data : []);
            } catch (e) {
                console.error('Rejected proposals fetch error', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="content-area-comm">
            <div className="alert d-flex align-items-center gap-2 mb-4" style={{ background: '#fff1f2', border: '1px solid #fecaca', borderLeft: '5px solid var(--mubs-red)', borderRadius: '10px', color: '#7f1d1d' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>info</span>
                <div>These proposals were <strong>rejected</strong> by the Principal or Admin. Review the feedback below. You may revise and resubmit where applicable.</div>
            </div>

            {loading ? (
                <div className="p-4 text-center text-muted">Loading…</div>
            ) : list.length === 0 ? (
                <div className="p-4 text-center text-muted">No rejected proposals.</div>
            ) : (
                list.map((p) => (
                    <div key={p.id} className="proposal-card rejected mb-3">
                        <div className="d-flex align-items-start gap-3 flex-wrap">
                            <div className="activity-icon" style={{ background: 'rgba(227,24,55,.08)', borderColor: 'rgba(227,24,55,.15)' }}><span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)' }}>gavel</span></div>
                            <div className="flex-fill">
                                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                    <div className="proposal-title">{p.title}</div>
                                    <span className="status-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>Rejected</span>
                                </div>
                                <div className="proposal-meta">
                                    {p.minute_reference ? `${p.minute_reference} · ` : ''}
                                    {p.date ? `Submitted ${p.date}` : ''}
                                    {p.reviewed_date ? ` · Rejected ${new Date(p.reviewed_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                                    {p.committee_type ? ` · Committee: ${p.committee_type}` : ''}
                                </div>
                                {p.reviewer_notes && (
                                    <div className="mt-3 p-3 rounded" style={{ background: '#fff1f2', border: '1px solid #fecaca', borderLeft: '4px solid var(--mubs-red)' }}>
                                        <div className="d-flex align-items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-red)' }}>feedback</span>
                                            <span className="fw-black text-dark" style={{ fontSize: '.85rem' }}>Rejection Reason &amp; Feedback</span>
                                        </div>
                                        <p style={{ fontSize: '.84rem', color: '#7f1d1d', margin: 0, lineHeight: 1.65 }}>{p.reviewer_notes}</p>
                                    </div>
                                )}
                                <div className="d-flex gap-2 mt-3 flex-wrap">
                                    <Link href="/comm?pg=propose" className="btn btn-sm fw-bold text-white" style={{ background: '#7c3aed' }}>
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>edit</span>Revise &amp; Resubmit
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
