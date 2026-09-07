"use client";

import { useCallback, useEffect, useState } from 'react';
import Layout from '@/components/Layout';

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

function formatSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminDocumentsView() {
    const [documents, setDocuments] = useState<StaffDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [formKey, setFormKey] = useState(0);

    const loadDocuments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/documents');
            const data = await res.json();
            setDocuments(data.documents || []);
        } catch {
            setError('Failed to load documents.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDocuments();
    }, [loadDocuments]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!title.trim()) {
            setError('Title is required.');
            return;
        }
        if (!file) {
            setError('Please choose a file to upload.');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('title', title.trim());
            formData.append('description', description.trim());
            formData.append('category', category.trim());
            formData.append('file', file);

            const res = await fetch('/api/admin/documents', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data?.message || 'Failed to upload document.');
                return;
            }

            setSuccess('Document uploaded successfully.');
            setTitle('');
            setDescription('');
            setCategory('');
            setFile(null);
            setFormKey((k) => k + 1);
            await loadDocuments();
        } catch {
            setError('Failed to upload document.');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (doc: StaffDocument) => {
        if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
        setDeletingId(doc.id);
        setError('');
        setSuccess('');
        try {
            const res = await fetch(`/api/admin/documents/${doc.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) {
                setError(data?.message || 'Failed to delete document.');
                return;
            }
            setSuccess('Document deleted.');
            await loadDocuments();
        } catch {
            setError('Failed to delete document.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <Layout>
            <div className="content-area w-100 position-relative">
                <div className="p-4 mb-4 rounded-3" style={{ background: 'linear-gradient(135deg,#0f172a,var(--mubs-navy))', border: '1px solid rgba(255,255,255,.1)' }}>
                    <div className="row align-items-center g-3">
                        <div className="col">
                            <h4 className="text-white mb-1">Documents</h4>
                            <p className="text-white-50 mb-0">Upload and manage documents available to staff on the Documents page.</p>
                        </div>
                    </div>
                </div>

                {error && <div className="alert alert-danger py-2">{error}</div>}
                {success && <div className="alert alert-success py-2">{success}</div>}

                <div className="card border-0 shadow-sm rounded-3 mb-4">
                    <div className="card-body">
                        <h6 className="mb-3">Upload a document</h6>
                        <form key={formKey} onSubmit={handleUpload}>
                            <div className="row g-3">
                                <div className="col-12 col-md-6">
                                    <label className="form-label small">Title *</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Fourth National Development Plan (NDP-IV)"
                                    />
                                </div>
                                <div className="col-12 col-md-6">
                                    <label className="form-label small">Category</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        placeholder="e.g. National Policy"
                                    />
                                </div>
                                <div className="col-12">
                                    <label className="form-label small">Description</label>
                                    <textarea
                                        className="form-control"
                                        rows={2}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Short description shown to staff"
                                    />
                                </div>
                                <div className="col-12 col-md-6">
                                    <label className="form-label small">File *</label>
                                    <input
                                        type="file"
                                        className="form-control"
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.txt"
                                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    />
                                    <div className="form-text">PDF, Word, Excel, CSV or image. Max 25MB.</div>
                                </div>
                                <div className="col-12 col-md-6 d-flex align-items-end">
                                    <button type="submit" className="btn btn-primary" disabled={uploading}>
                                        {uploading ? 'Uploading...' : 'Upload document'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="card border-0 shadow-sm rounded-3">
                    <div className="card-body">
                        <h6 className="mb-3">Existing documents</h6>
                        {loading ? (
                            <div className="d-flex justify-content-center py-4">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        ) : documents.length === 0 ? (
                            <div className="text-muted small py-3">No documents uploaded yet.</div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table align-middle">
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>Category</th>
                                            <th>File</th>
                                            <th>Size</th>
                                            <th>Uploaded</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {documents.map((doc) => (
                                            <tr key={doc.id}>
                                                <td>
                                                    <div className="fw-semibold small">{doc.title}</div>
                                                    {doc.description && (
                                                        <div className="text-muted" style={{ fontSize: '.75rem' }}>{doc.description}</div>
                                                    )}
                                                </td>
                                                <td className="small">{doc.category || '—'}</td>
                                                <td className="small">
                                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                                        {doc.original_filename}
                                                    </a>
                                                </td>
                                                <td className="small">{formatSize(doc.file_size)}</td>
                                                <td className="small">{formatDate(doc.created_at)}</td>
                                                <td className="text-end">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        disabled={deletingId === doc.id}
                                                        onClick={() => handleDelete(doc)}
                                                    >
                                                        {deletingId === doc.id ? 'Deleting...' : 'Delete'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
