"use client";

import { useEffect, useState } from 'react';

interface StaffDocument {
    id: number;
    title: string;
    description: string | null;
    category: string | null;
    file_url: string;
    original_filename: string;
    file_size: number | null;
    created_at: string;
}

export default function StaffDocuments() {
    const [documents, setDocuments] = useState<StaffDocument[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/documents')
            .then((r) => (r.ok ? r.json() : { documents: [] }))
            .then((data: { documents?: StaffDocument[] }) => setDocuments(data.documents || []))
            .catch(() => setDocuments([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="content-area w-100 position-relative">
            <div className="p-4 mb-4 rounded-3" style={{ background: 'linear-gradient(135deg,#0f172a,var(--mubs-navy))', border: '1px solid rgba(255,255,255,.1)' }}>
                <div className="row align-items-center g-3">
                    <div className="col">
                        <h4 className="text-white mb-1">Documents</h4>
                        <p className="text-white-50 mb-0">Policy documents and reference materials available for viewing and download.</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="d-flex justify-content-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            ) : documents.length === 0 ? (
                <div className="text-muted small py-4">No documents available yet.</div>
            ) : (
                <div className="row g-3">
                    {documents.map((doc) => (
                        <div className="col-12 col-md-6 col-lg-4" key={doc.id}>
                            <div className="card h-100 border-0 shadow-sm rounded-3">
                                <div className="card-body d-flex flex-column">
                                    {doc.category && (
                                        <span className="status-badge align-self-start mb-2" style={{ background: '#eff6ff', color: 'var(--mubs-blue)' }}>
                                            {doc.category}
                                        </span>
                                    )}
                                    <h6 className="mb-2">{doc.title}</h6>
                                    {doc.description && (
                                        <p className="text-muted small flex-grow-1">{doc.description}</p>
                                    )}
                                    <a
                                        href={doc.file_url}
                                        download
                                        className="btn btn-sm btn-primary align-self-start mt-auto"
                                    >
                                        Download
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
