"use client";

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Modal, Button, Form } from 'react-bootstrap';
import axios from 'axios';

interface Proposal {
    id: number;
    title: string;
    submitted_by: string;
    department: string;
    submitted_date: string;
    budget: number;
    status: string;
    description?: string;
    committee_type: 'Council' | 'TMC' | 'Academic Board' | 'Other';
    minute_reference?: string;
    pillar_id?: number;
    pillar_title?: string;
    implementation_status?: string;
}

export default function CommitteeView() {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('All Statuses');
    const [committeeFilter, setCommitteeFilter] = useState('All Committees');
    const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
    const [editNote, setEditNote] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Modal visibility
    const [showView, setShowView] = useState(false);
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [showEdit, setShowEdit] = useState(false);

    // Derived stats from real data
    const stats = {
        pending: proposals.filter(p => p.status === 'Pending').length,
        approved: proposals.filter(p => p.status === 'Approved').length,
        rejected: proposals.filter(p => p.status === 'Rejected').length,
        edits: proposals.filter(p => p.status === 'Edit Requested').length,
    };

    const filteredProposals = proposals.filter(p => {
        const matchesStatus = statusFilter === 'All Statuses' || p.status === statusFilter;
        const matchesCommittee = committeeFilter === 'All Committees' || p.committee_type === committeeFilter;
        return matchesStatus && matchesCommittee;
    });

    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;
    const totalPages = Math.max(1, Math.ceil(filteredProposals.length / PAGE_SIZE));
    const paginatedProposals = filteredProposals.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    // Reset to page 1 when filter changes
    useEffect(() => { setCurrentPage(1); }, [statusFilter, committeeFilter]);

    useEffect(() => { fetchProposals(); }, []);

    const fetchProposals = async () => {
        try {
            const response = await axios.get('/api/committees');
            setProposals(response.data);
        } catch (error) {
            console.error('Error fetching proposals:', error);
        } finally {
            setLoading(false);
        }
    };

    const open = (modal: 'view' | 'approve' | 'reject' | 'edit', proposal: Proposal) => {
        setSelectedProposal(proposal);
        setEditNote('');
        if (modal === 'view') setShowView(true);
        if (modal === 'approve') setShowApprove(true);
        if (modal === 'reject') setShowReject(true);
        if (modal === 'edit') setShowEdit(true);
    };

    const closeAll = () => {
        setShowView(false);
        setShowApprove(false);
        setShowReject(false);
        setShowEdit(false);
        setSelectedProposal(null);
        setEditNote('');
    };

    const handleStatusChange = async (status: string, reviewer_notes?: string) => {
        if (!selectedProposal) return;
        setActionLoading(true);
        try {
            await axios.patch(`/api/committees/${selectedProposal.id}`, { status, reviewer_notes });
            closeAll();
            fetchProposals();
        } catch (error) {
            console.error('Error updating proposal:', error);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <Layout>
            <div className="row g-4 mb-4">
                {/* Stat Cards */}
                <div className="col-sm-6 col-md-3">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-blue)' }}>
                        <div className="stat-label">Pending Review</div>
                        <div className="stat-value">{stats.pending}</div>
                    </div>
                </div>
                <div className="col-sm-6 col-md-3">
                    <div className="stat-card" style={{ borderLeftColor: '#10b981' }}>
                        <div className="stat-label">Approved</div>
                        <div className="stat-value">{stats.approved}</div>
                    </div>
                </div>
                <div className="col-sm-6 col-md-3">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-red)' }}>
                        <div className="stat-label">Rejected</div>
                        <div className="stat-value">{stats.rejected}</div>
                    </div>
                </div>
                <div className="col-sm-6 col-md-3">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-yellow)' }}>
                        <div className="stat-label">Edit Requested</div>
                        <div className="stat-value">{stats.edits}</div>
                    </div>
                </div>
            </div>

            <div className="table-card">
                <div className="table-card-header">
                    <h5>
                        <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>groups</span>
                        Committee Activity Proposals
                    </h5>
                    <div className="d-flex gap-2">
                        <select
                            className="form-select form-select-sm"
                            style={{ width: '160px' }}
                            value={committeeFilter}
                            onChange={e => setCommitteeFilter(e.target.value)}
                        >
                            <option>All Committees</option>
                            <option>Council</option>
                            <option>TMC</option>
                            <option>Academic Board</option>
                            <option>Other</option>
                        </select>
                        <select
                            className="form-select form-select-sm"
                            style={{ width: '160px' }}
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option>All Statuses</option>
                            <option>Pending</option>
                            <option>Approved</option>
                            <option>Rejected</option>
                            <option>Edit Requested</option>
                        </select>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="table mb-0">
                        <thead>
                            <tr>
                                <th>Activity / Minute Ref</th>
                                <th>Source Committee</th>
                                <th>Submitted By</th>
                                <th>Department</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-4">Loading...</td></tr>
                            ) : paginatedProposals.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-4">No proposals found</td></tr>
                            ) : (
                                paginatedProposals.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <div className="fw-bold">{p.title}</div>
                                            <div className="text-muted small">Min: {p.minute_reference || 'N/A'}</div>
                                        </td>
                                        <td>
                                            <span className="badge bg-light text-dark">{p.committee_type}</span>
                                        </td>
                                        <td>{p.submitted_by}</td>
                                        <td>{p.department}</td>
                                        <td>{p.submitted_date}</td>
                                        <td>
                                            <span className={`status-badge ${p.status.toLowerCase().replace(' ', '-')}`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="d-flex gap-1">
                                                <button className="btn btn-sm btn-outline-primary" onClick={() => open('view', p)}>View</button>
                                                {p.status === 'Pending' && (
                                                    <>
                                                        <button className="btn btn-sm btn-outline-success" onClick={() => open('approve', p)}>Approve</button>
                                                        <button className="btn btn-sm btn-outline-danger" onClick={() => open('reject', p)}>Reject</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="table-card-footer">
                    <span className="footer-label">
                        Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredProposals.length)} of {filteredProposals.length}
                    </span>
                    <div className="d-flex gap-1">
                        <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                className={`page-btn ${page === currentPage ? 'active' : ''}`}
                                onClick={() => setCurrentPage(page)}
                            >{page}</button>
                        ))}
                        <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
                    </div>
                </div>
            </div>

            {selectedProposal && (
                <>
                    <Modal show={showView} onHide={closeAll} centered>
                        <Modal.Header closeButton className="modal-header-mubs">
                            <Modal.Title>Proposal Details</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <h5>{selectedProposal.title}</h5>
                            <p className="text-muted small">Submitted by {selectedProposal.submitted_by} on {selectedProposal.submitted_date}</p>
                            <hr />
                            <h6>Description / Rationale</h6>
                            <p>{selectedProposal.description || 'No description provided.'}</p>
                            <div className="row mt-3">
                                <div className="col-6 mb-3">
                                    <label className="fw-bold small">Source Committee</label>
                                    <div>{selectedProposal.committee_type}</div>
                                </div>
                                <div className="col-6 mb-3">
                                    <label className="fw-bold small">Minute Reference</label>
                                    <div>{selectedProposal.minute_reference || 'Not specified'}</div>
                                </div>
                                <div className="col-6 mb-3">
                                    <label className="fw-bold small">Budget</label>
                                    <div>UGX {selectedProposal.budget.toLocaleString()}</div>
                                </div>
                                <div className="col-6 mb-3">
                                    <label className="fw-bold small">Department</label>
                                    <div>{selectedProposal.department}</div>
                                </div>
                                {selectedProposal.pillar_title && (
                                    <div className="col-12 mb-3">
                                        <label className="fw-bold small text-primary">Strategic Goal Alignment</label>
                                        <div className="p-2 bg-light border-start border-primary border-3">
                                            {selectedProposal.pillar_title}
                                        </div>
                                    </div>
                                )}
                                <div className="col-12">
                                    <label className="fw-bold small">Implementation Progress</label>
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="progress flex-grow-1" style={{ height: '8px' }}>
                                            <div
                                                className={`progress-bar ${selectedProposal.status === 'Approved' ? 'bg-success' : 'bg-secondary'}`}
                                                style={{ width: selectedProposal.status === 'Approved' ? '40%' : '0%' }}
                                            ></div>
                                        </div>
                                        <span className="small fw-bold">{selectedProposal.implementation_status || 'Pending'}</span>
                                    </div>
                                </div>
                            </div>
                        </Modal.Body>
                    </Modal>

                    <Modal show={showApprove} onHide={closeAll} centered>
                        <Modal.Header closeButton className="modal-header-mubs">
                            <Modal.Title>Approve Proposal</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <p>Are you sure you want to approve <strong>{selectedProposal.title}</strong>?</p>
                            <Form.Group className="mb-3">
                                <Form.Label>Reviewer Notes (Optional)</Form.Label>
                                <Form.Control as="textarea" rows={3} value={editNote} onChange={e => setEditNote(e.target.value)} />
                            </Form.Group>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="light" onClick={closeAll}>Cancel</Button>
                            <Button variant="success" onClick={() => handleStatusChange('Approved', editNote)} disabled={actionLoading}>
                                {actionLoading ? 'Approving...' : 'Confirm Approval'}
                            </Button>
                        </Modal.Footer>
                    </Modal>

                    <Modal show={showReject} onHide={closeAll} centered>
                        <Modal.Header closeButton className="modal-header-mubs bg-danger">
                            <Modal.Title>Reject Proposal</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <p>Rejection reason for <strong>{selectedProposal.title}</strong>:</p>
                            <Form.Control as="textarea" rows={3} value={editNote} onChange={e => setEditNote(e.target.value)} required />
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="light" onClick={closeAll}>Cancel</Button>
                            <Button variant="danger" onClick={() => handleStatusChange('Rejected', editNote)} disabled={actionLoading || !editNote.trim()}>
                                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                            </Button>
                        </Modal.Footer>
                    </Modal>
                </>
            )}
        </Layout>
    );
}
