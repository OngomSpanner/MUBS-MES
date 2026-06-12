'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  CHANGE_REQUEST_CATEGORIES,
  CHANGE_REQUEST_STATUS_LABELS,
  type AmbassadorChangeRequest,
  type ChangeRequestCategory,
  type ChangeRequestStatus,
} from '@/lib/ambassador/change-request-constants';

function statusBadgeStyle(status: ChangeRequestStatus): { bg: string; color: string } {
  switch (status) {
    case 'submitted':
      return { bg: '#dbeafe', color: '#1d4ed8' };
    case 'under_review':
      return { bg: '#fef3c7', color: '#b45309' };
    case 'approved':
      return { bg: '#dcfce7', color: '#15803d' };
    case 'rejected':
      return { bg: '#fee2e2', color: '#b91c1c' };
    case 'completed':
      return { bg: '#e0e7ff', color: '#3730a3' };
    default:
      return { bg: '#f1f5f9', color: '#475569' };
  }
}

function resetFormFields() {
  return {
    category: 'unit_structure' as ChangeRequestCategory,
    title: '',
    description: '',
  };
}

export default function AmbassadorProposeChanges() {
  const [requests, setRequests] = useState<AmbassadorChangeRequest[]>([]);
  const [managedUnitName, setManagedUnitName] = useState('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [category, setCategory] = useState<ChangeRequestCategory>('unit_structure');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await axios.get('/api/ambassador/change-requests');
      setRequests(res.data.requests ?? []);
      setManagedUnitName(res.data.managedUnitName ?? '');
    } catch {
      setListError('Failed to load your change requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const openModal = () => {
    const fresh = resetFormFields();
    setCategory(fresh.category);
    setTitle(fresh.title);
    setDescription(fresh.description);
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setModalError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    try {
      await axios.post('/api/ambassador/change-requests', { category, title, description });
      setModalOpen(false);
      setSuccess('Your request has been submitted to the System Administrator / Strategy Manager.');
      const fresh = resetFormFields();
      setCategory(fresh.category);
      setTitle(fresh.title);
      setDescription(fresh.description);
      await loadRequests();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to submit request.';
      setModalError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const categoryLabel = (value: ChangeRequestCategory) =>
    CHANGE_REQUEST_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  return (
    <div className="page-section active-page">
      {success && (
        <div className="alert alert-success py-2 small d-flex align-items-center justify-content-between gap-2 mb-3">
          <span>{success}</span>
          <button type="button" className="btn-close btn-close-sm" aria-label="Dismiss" onClick={() => setSuccess(null)} />
        </div>
      )}

      <div className="table-card shadow-sm border-0 bg-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div className="table-card-header flex-wrap gap-2">
          <div>
            <h5 className="mb-0 d-flex align-items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span>
              Your submissions
            </h5>
            <p className="text-muted small mb-0 mt-1">
              Change requests for <strong>{managedUnitName || 'your unit'}</strong>
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary fw-bold d-inline-flex align-items-center gap-2 ms-auto"
            style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)', borderRadius: '8px' }}
            onClick={openModal}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Propose a change
          </button>
        </div>

        <div className="p-0">
          {listError && (
            <div className="alert alert-danger m-3 mb-0 py-2 small">{listError}</div>
          )}

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-5 px-3">
              <span className="material-symbols-outlined d-block mb-2 text-muted" style={{ fontSize: '2.5rem', opacity: 0.4 }}>
                edit_note
              </span>
              <p className="text-muted small mb-3">No change requests yet.</p>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm fw-bold"
                onClick={openModal}
              >
                Propose a change
              </button>
            </div>
          ) : (
            <div className="list-group list-group-flush">
              {requests.map((req) => {
                const badge = statusBadgeStyle(req.status);
                return (
                  <div key={req.id} className="list-group-item px-4 py-3">
                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-1">
                      <div className="fw-bold text-dark">{req.title}</div>
                      <span
                        className="badge"
                        style={{ background: badge.bg, color: badge.color, fontSize: '0.65rem' }}
                      >
                        {CHANGE_REQUEST_STATUS_LABELS[req.status]}
                      </span>
                    </div>
                    <div className="text-muted small mb-2">
                      {categoryLabel(req.category)} ·{' '}
                      {new Date(req.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    <p className="small mb-0 text-dark" style={{ whiteSpace: 'pre-wrap' }}>
                      {req.description}
                    </p>
                    {req.adminNotes ? (
                      <div className="mt-2 p-2 rounded-3 bg-light small">
                        <span className="fw-semibold text-muted">Strategy Manager note: </span>
                        {req.adminNotes}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1050, backdropFilter: 'blur(4px)' }}
          onClick={closeModal}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 mb-0">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>edit_note</span>
                  Propose a change
                </h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={closeModal} disabled={submitting} />
              </div>
              <div className="modal-body p-4 pt-3">
                <p className="text-muted small mb-3">
                  Request updates to unit structure, indicators, activity templates, or other M&E setup for{' '}
                  <strong>{managedUnitName || 'your unit'}</strong>. Submissions are reviewed by the Strategy Manager.
                </p>

                {modalError && (
                  <div className="alert alert-danger py-2 small">{modalError}</div>
                )}

                <form id="propose-change-form" onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Category</label>
                    <select
                      className="form-select form-select-sm"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ChangeRequestCategory)}
                      required
                    >
                      {CHANGE_REQUEST_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Title</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={255}
                      placeholder="Brief summary of the change"
                      required
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label fw-semibold small">Description</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what should change and why…"
                      required
                      minLength={10}
                    />
                  </div>
                </form>
              </div>
              <div className="modal-footer border-top bg-light px-4 py-3 d-flex flex-wrap justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-light fw-bold px-3 py-2"
                  style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="propose-change-form"
                  className="btn btn-primary fw-bold px-3 py-2 d-inline-flex align-items-center gap-2"
                  disabled={submitting}
                  style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  {submitting ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
