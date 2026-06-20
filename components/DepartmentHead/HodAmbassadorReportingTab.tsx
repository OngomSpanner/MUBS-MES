'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Badge, Button, Form, Modal } from 'react-bootstrap';
import { HOD_REVIEW_STATUS_LABELS, type HodReviewStatus } from '@/lib/hod-review-workflow-constants';

type ReportCategory =
  | 'benefits'
  | 'workforce'
  | 'skills'
  | 'programme-enrollment'
  | 'course-unit-enrollment'
  | 'rf-narrative';

type InboxItem = {
  id: number;
  category: ReportCategory;
  title: string;
  subtitle: string;
  hod_review_status: HodReviewStatus;
  updated_at: string;
  outcome_reason?: string | null;
};

const SUB_TABS: { key: ReportCategory; label: string }[] = [
  { key: 'benefits', label: 'Benefits' },
  { key: 'workforce', label: 'Workforce' },
  { key: 'skills', label: 'Skills' },
  { key: 'programme-enrollment', label: 'Programmes' },
  { key: 'course-unit-enrollment', label: 'Course units' },
  { key: 'rf-narrative', label: 'RF narratives' },
];

function statusBadge(status: HodReviewStatus) {
  switch (status) {
    case 'submitted':
      return 'warning';
    case 'approved':
      return 'success';
    case 'returned':
      return 'danger';
    default:
      return 'secondary';
  }
}

export default function HodAmbassadorReportingTab({ group }: { group: 'hr' | 'enrollment' | 'rf' }) {
  const categories: ReportCategory[] =
    group === 'hr'
      ? ['benefits', 'workforce', 'skills']
      : group === 'enrollment'
        ? ['programme-enrollment', 'course-unit-enrollment']
        : ['rf-narrative'];

  const [subTab, setSubTab] = useState<ReportCategory>(categories[0]);
  const [rows, setRows] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/department-head/ambassador-reporting', {
        params: { category: subTab },
      });
      setRows(res.data.items ?? []);
    } catch {
      setError('Failed to load ambassador reporting submissions.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [subTab]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (action: 'approve' | 'return') => {
    if (!selected) return;
    if (action === 'return' && !comment.trim()) {
      alert('Comment required when returning.');
      return;
    }
    setActing(true);
    try {
      await axios.patch('/api/department-head/ambassador-reporting', {
        category: selected.category,
        id: selected.id,
        action,
        comment: comment.trim(),
      });
      setSelected(null);
      setComment('');
      await load();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : 'Review failed';
      alert(String(msg ?? 'Review failed'));
    } finally {
      setActing(false);
    }
  };

  const visibleSubTabs = SUB_TABS.filter((t) => categories.includes(t.key));

  return (
    <div>
      {group !== 'rf' && visibleSubTabs.length > 1 ? (
        <div className="d-flex flex-wrap gap-2 mb-3">
          {visibleSubTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`btn btn-sm fw-bold ${subTab === t.key ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setSubTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="small">Title</th>
                <th className="small">Details</th>
                <th className="small">Updated</th>
                <th className="small">Status</th>
                <th className="small text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4 small">
                    No submissions in this category.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={`${r.category}-${r.id}`}>
                    <td className="small fw-semibold">{r.title}</td>
                    <td className="small text-muted">{r.subtitle}</td>
                    <td className="small text-muted">
                      {r.updated_at ? new Date(r.updated_at).toLocaleString() : '—'}
                    </td>
                    <td>
                      <Badge bg={statusBadge(r.hod_review_status)} style={{ fontSize: '0.65rem' }}>
                        {HOD_REVIEW_STATUS_LABELS[r.hod_review_status]}
                      </Badge>
                    </td>
                    <td className="text-end">
                      {r.hod_review_status === 'submitted' ? (
                        <Button size="sm" variant="outline-primary" onClick={() => { setSelected(r); setComment(''); }}>
                          Review
                        </Button>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal show={selected != null} onHide={() => !acting && setSelected(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">Review ambassador data</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selected ? (
            <>
              <p className="small mb-1">
                <strong>{selected.title}</strong>
              </p>
              <p className="small text-muted mb-2">{selected.subtitle}</p>
              {selected.outcome_reason ? (
                <p className="small border rounded p-2 bg-light mb-3" style={{ whiteSpace: 'pre-wrap' }}>
                  {selected.outcome_reason}
                </p>
              ) : null}
              <Form.Group>
                <Form.Label className="small fw-semibold">Comment (required if returning)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={acting}
                />
              </Form.Group>
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setSelected(null)} disabled={acting}>
            Cancel
          </Button>
          <Button variant="outline-danger" disabled={acting} onClick={() => void review('return')}>
            Return
          </Button>
          <Button variant="primary" disabled={acting} onClick={() => void review('approve')}>
            Approve
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
