'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Badge, Button, Spinner } from 'react-bootstrap';

type DeliveryRow = {
  id: number;
  event_type: string;
  event_label: string;
  indicator_id: number;
  department_id: number;
  recipient_user_id: number;
  recipient_email: string | null;
  recipient_name: string | null;
  channel: 'in_app' | 'email';
  status: 'sent' | 'failed' | 'skipped';
  error_message: string | null;
  retry_count: number;
  created_at: string;
  sent_at: string | null;
  indicator_text: string | null;
  department_name: string | null;
};

function statusVariant(status: string): string {
  if (status === 'sent') return 'success';
  if (status === 'failed') return 'danger';
  return 'secondary';
}

function formatWhen(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB');
}

export default function NotificationDeliveriesPanel() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = statusFilter !== 'all' ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const res = await axios.get(`/api/admin/notification-deliveries${params}`);
      setDeliveries(res.data.deliveries || []);
      setTotal(res.data.total ?? 0);
    } catch (e: unknown) {
      setErr(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Failed to load' : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleResend = async (id: number) => {
    setResendingId(id);
    setSuccessMsg(null);
    setErr(null);
    try {
      await axios.post(`/api/admin/notification-deliveries/${id}/resend`);
      setSuccessMsg('Notification resent successfully.');
      await load();
    } catch (e: unknown) {
      setErr(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Resend failed' : 'Resend failed');
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h5 className="fw-bold mb-1">Notification deliveries</h5>
          <p className="text-muted small mb-0">
            Performance indicator in-app and email attempts. Resend failed or skipped deliveries from here.
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <select
            className="form-select form-select-sm"
            style={{ width: '140px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
            <option value="sent">Sent</option>
          </select>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      {err && <div className="alert alert-danger py-2 small">{err}</div>}
      {successMsg && <div className="alert alert-success py-2 small">{successMsg}</div>}

      {loading ? (
        <div className="d-flex justify-content-center p-5">
          <Spinner animation="border" size="sm" />
        </div>
      ) : deliveries.length === 0 ? (
        <div className="border rounded-3 p-4 text-center text-muted small bg-white">
          No delivery records yet. They appear when ambassadors submit indicators or HODs approve/return them.
        </div>
      ) : (
        <div className="table-responsive border rounded-3 bg-white">
          <table className="table table-sm table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Indicator</th>
                <th>Recipient</th>
                <th>Channel</th>
                <th>Status</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td className="small text-nowrap">{formatWhen(d.created_at)}</td>
                  <td className="small">{d.event_label}</td>
                  <td className="small">
                    <div className="fw-semibold">{d.indicator_text || `ID ${d.indicator_id}`}</div>
                    <div className="text-muted">{d.department_name || `Dept ${d.department_id}`}</div>
                  </td>
                  <td className="small">
                    <div>{d.recipient_name || `User #${d.recipient_user_id}`}</div>
                    {d.recipient_email ? <div className="text-muted">{d.recipient_email}</div> : null}
                  </td>
                  <td className="small text-capitalize">{d.channel === 'in_app' ? 'In-app' : 'Email'}</td>
                  <td>
                    <Badge bg={statusVariant(d.status)} className="text-uppercase" style={{ fontSize: '.65rem' }}>
                      {d.status}
                    </Badge>
                    {d.retry_count > 0 ? (
                      <div className="text-muted" style={{ fontSize: '.68rem' }}>
                        Retries: {d.retry_count}
                      </div>
                    ) : null}
                    {d.error_message ? (
                      <div className="text-danger" style={{ fontSize: '.68rem', maxWidth: '180px' }}>
                        {d.error_message}
                      </div>
                    ) : null}
                  </td>
                  <td className="text-end">
                    {d.status !== 'sent' ? (
                      <Button
                        size="sm"
                        variant="outline-primary"
                        disabled={resendingId === d.id}
                        onClick={() => void handleResend(d.id)}
                      >
                        {resendingId === d.id ? 'Sending…' : 'Resend'}
                      </Button>
                    ) : (
                      <span className="text-muted small">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > deliveries.length ? (
        <p className="text-muted small mt-2 mb-0">Showing {deliveries.length} of {total} records.</p>
      ) : null}
    </div>
  );
}
