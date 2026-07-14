'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Badge, Button, Modal, Spinner } from 'react-bootstrap';

type Assignment = {
  assignment_id: number;
  activity_name: string;
  duration_text: string | null;
  target_date: string | null;
  standard_code: string;
  standard_title: string;
  service_description: string;
  process_text: string | null;
  pathway?: string | null;
  assigned_by_name?: string | null;
  process_chain?: { id: number; sequence_no: number; activity_name: string; duration_text: string | null }[];
  co_assignees?: { id: number; full_name: string }[];
};

export default function StaffSdsView() {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Assignment | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/sds/staff/assignments');
        setRows(Array.isArray(res.data?.assignments) ? res.data.assignments : []);
      } catch {
        setError('Could not load your SDS assignments');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="container-fluid py-3">
      <h4 className="fw-bold mb-1" style={{ color: 'var(--mubs-blue)' }}>My SDS Activities</h4>
      <p className="text-muted small mb-3">
        Read-only view of Process Activities assigned to you. Completion is handled at appraisal time (not here).
      </p>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="table-responsive">
        <table className="table table-sm table-bordered" style={{ fontSize: '0.82rem' }}>
          <thead className="table-dark">
            <tr>
              <th>Activity</th>
              <th>Standard</th>
              <th>Duration</th>
              <th>Target date</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted py-4">No SDS activities assigned to you yet.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.assignment_id}>
                <td className="fw-semibold">{r.activity_name}</td>
                <td>
                  <div className="small">{r.standard_title}</div>
                  <div className="text-muted" style={{ fontSize: '0.7rem' }}>{r.standard_code}</div>
                </td>
                <td>{r.duration_text || '—'}</td>
                <td>{r.target_date ? String(r.target_date).slice(0, 10) : '—'}</td>
                <td>
                  <Button size="sm" variant="outline-secondary" onClick={() => setSelected(r)}>View more</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal show={!!selected} onHide={() => setSelected(null)} size="lg" centered scrollable>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">Activity context</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selected && (
            <div className="d-flex flex-column gap-2 small">
              <div><span className="fw-bold">Activity:</span> {selected.activity_name}</div>
              <div><span className="fw-bold">Standard:</span> {selected.standard_code} — {selected.standard_title}</div>
              <div><span className="fw-bold">Output:</span> {selected.service_description}</div>
              {selected.pathway && <div><span className="fw-bold">Pathway (summary):</span> {selected.pathway}</div>}
              <div>
                <div className="fw-bold mb-1">Full Process chain for this output</div>
                <ol className="mb-0 ps-3">
                  {(selected.process_chain || []).map((step) => (
                    <li key={step.id} className={step.activity_name === selected.activity_name ? 'fw-bold' : ''}>
                      {step.activity_name}
                      {step.duration_text ? <span className="text-muted"> ({step.duration_text})</span> : null}
                      {step.activity_name === selected.activity_name ? <Badge bg="warning" className="text-dark ms-2">Your step</Badge> : null}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <span className="fw-bold">Also assigned:</span>{' '}
                {(selected.co_assignees || []).length
                  ? selected.co_assignees!.map((c) => c.full_name).join(', ')
                  : 'Only you'}
              </div>
              <div><span className="fw-bold">Assigned by:</span> {selected.assigned_by_name || '—'}</div>
              <div><span className="fw-bold">Target date:</span> {selected.target_date ? String(selected.target_date).slice(0, 10) : '—'}</div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="outline-secondary" onClick={() => setSelected(null)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
