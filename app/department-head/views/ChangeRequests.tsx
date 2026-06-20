'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import {
  CHANGE_REQUEST_CATEGORIES,
  CHANGE_REQUEST_STATUSES,
  CHANGE_REQUEST_STATUS_LABELS,
  type AdminChangeRequest,
  type ChangeRequestStatus,
} from '@/lib/ambassador/change-request-constants';

const API_BASE = '/api/department-head/change-requests';

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

const STATUS_FILTERS: { value: '' | ChangeRequestStatus; label: string }[] = [
  { value: '', label: 'All' },
  ...CHANGE_REQUEST_STATUSES.map((status) => ({
    value: status,
    label: CHANGE_REQUEST_STATUS_LABELS[status],
  })),
];

export default function ChangeRequestsView({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkId = Number(searchParams.get('id') || '');
  const pagePath = embedded
    ? '/department-head?pg=evaluations&tab=proposals'
    : '/department-head?pg=change-requests';

  const [requests, setRequests] = useState<AdminChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | ChangeRequestStatus>('');

  const [selected, setSelected] = useState<AdminChangeRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ChangeRequestStatus>('submitted');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const categoryLabel = useCallback(
    (value: string) => CHANGE_REQUEST_CATEGORIES.find((c) => c.value === value)?.label ?? value,
    []
  );

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const url = statusFilter
        ? `${API_BASE}?status=${encodeURIComponent(statusFilter)}`
        : API_BASE;
      const res = await axios.get(url);
      setRequests(res.data.requests ?? []);
    } catch {
      setListError('Failed to load ambassador change requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const openReview = useCallback((req: AdminChangeRequest) => {
    setSelected(req);
    setReviewStatus(req.status);
    setAdminNotes(req.adminNotes || '');
    setReviewError(null);
  }, []);

  const closeReview = useCallback(() => {
    if (saving) return;
    setSelected(null);
    setReviewError(null);
    if (searchParams.get('id')) {
      router.replace(pagePath);
    }
  }, [router, saving, searchParams, pagePath]);

  useEffect(() => {
    if (!Number.isFinite(deepLinkId) || deepLinkId <= 0 || loading) return;
    const match = requests.find((r) => r.id === deepLinkId);
    if (match) {
      openReview(match);
      return;
    }
    axios
      .get(`${API_BASE}/${deepLinkId}`)
      .then((res) => {
        if (res.data.request) openReview(res.data.request);
      })
      .catch(() => {
        setListError('The linked change request could not be found.');
      });
  }, [deepLinkId, loading, openReview, requests]);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'submitted' || r.status === 'under_review').length,
    [requests]
  );

  const handleSaveReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    setSaving(true);
    setReviewError(null);
    try {
      const res = await axios.patch(`${API_BASE}/${selected.id}`, {
        status: reviewStatus,
        adminNotes,
      });
      const updated = res.data.request as AdminChangeRequest;
      setSelected(updated);
      setSuccess('Change request updated.');
      await loadRequests();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to save review.';
      setReviewError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? '' : 'page-section active-page'}>
      {success && (
        <div className="alert alert-success py-2 small d-flex align-items-center justify-content-between gap-2 mb-3">
          <span>{success}</span>
          <button type="button" className="btn-close btn-close-sm" aria-label="Dismiss" onClick={() => setSuccess(null)} />
        </div>
      )}

      <div className="table-card shadow-sm border-0 bg-white" style={{ borderRadius: embedded ? '12px' : '16px', overflow: 'hidden' }}>
        {!embedded ? (
        <div className="table-card-header flex-wrap gap-2">
          <div>
            <h5 className="mb-0 d-flex align-items-center gap-2">
              <span className="material-symbols-outlined text-primary">rate_review</span>
              Ambassador change proposals
            </h5>
            <p className="text-muted small mb-0 mt-1">
              Review requests submitted by Strategic Plan Ambassadors
              {pendingCount > 0 ? (
                <>
                  {' '}
                  · <strong>{pendingCount}</strong> awaiting action
                </>
              ) : null}
            </p>
          </div>
        </div>
        ) : null}

        <div className="px-4 pt-3 pb-2 border-bottom bg-light">
          <div className="d-flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value || 'all'}
                type="button"
                className={`btn btn-sm ${statusFilter === filter.value ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={statusFilter === filter.value ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-0">
          {listError && <div className="alert alert-danger m-3 mb-0 py-2 small">{listError}</div>}

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
              <p className="text-muted small mb-0">No change requests match this filter.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="small text-muted">#</th>
                    <th className="small text-muted">Title</th>
                    <th className="small text-muted">Ambassador / Unit</th>
                    <th className="small text-muted">Category</th>
                    <th className="small text-muted">Submitted</th>
                    <th className="small text-muted">Status</th>
                    <th className="small text-muted text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const badge = statusBadgeStyle(req.status);
                    return (
                      <tr key={req.id}>
                        <td className="small text-muted">{req.id}</td>
                        <td className="fw-semibold">{req.title}</td>
                        <td className="small">
                          <div>{req.ambassadorName}</div>
                          <div className="text-muted">{req.managedUnitName}</div>
                        </td>
                        <td className="small">{categoryLabel(req.category)}</td>
                        <td className="small text-muted">
                          {new Date(req.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td>
                          <span className="badge" style={{ background: badge.bg, color: badge.color, fontSize: '0.65rem' }}>
                            {CHANGE_REQUEST_STATUS_LABELS[req.status]}
                          </span>
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary fw-bold"
                            onClick={() => openReview(req)}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1050, backdropFilter: 'blur(4px)' }}
          onClick={closeReview}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                <div>
                  <h5 className="modal-title fw-bold text-dark mb-1">{selected.title}</h5>
                  <p className="text-muted small mb-0">
                    Request #{selected.id} · {categoryLabel(selected.category)}
                  </p>
                </div>
                <button type="button" className="btn-close" aria-label="Close" onClick={closeReview} disabled={saving} />
              </div>
              <div className="modal-body p-4 pt-3">
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <div className="small text-muted">Ambassador</div>
                    <div className="fw-semibold">{selected.ambassadorName}</div>
                    {selected.ambassadorEmail ? (
                      <div className="small text-muted">{selected.ambassadorEmail}</div>
                    ) : null}
                  </div>
                  <div className="col-md-6">
                    <div className="small text-muted">Department / Unit</div>
                    <div className="fw-semibold">{selected.managedUnitName}</div>
                  </div>
                </div>

                <div className="mb-3 p-3 rounded-3 bg-light">
                  <div className="small text-muted mb-1">Proposal description</div>
                  <p className="small mb-0 text-dark" style={{ whiteSpace: 'pre-wrap' }}>
                    {selected.description}
                  </p>
                </div>

                {reviewError && <div className="alert alert-danger py-2 small">{reviewError}</div>}

                <form id="review-change-request-form" onSubmit={handleSaveReview}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Status</label>
                    <select
                      className="form-select form-select-sm"
                      value={reviewStatus}
                      onChange={(e) => setReviewStatus(e.target.value as ChangeRequestStatus)}
                      required
                    >
                      {CHANGE_REQUEST_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {CHANGE_REQUEST_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-0">
                    <label className="form-label fw-semibold small">Notes to ambassador (optional)</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={4}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Feedback, decision rationale, or next steps…"
                    />
                  </div>
                </form>
              </div>
              <div className="modal-footer border-top bg-light px-4 py-3 d-flex flex-wrap justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-light fw-bold px-3 py-2"
                  style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                  onClick={closeReview}
                  disabled={saving}
                >
                  Close
                </button>
                <button
                  type="submit"
                  form="review-change-request-form"
                  className="btn btn-primary fw-bold px-3 py-2"
                  disabled={saving}
                  style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  {saving ? 'Saving…' : 'Save review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
