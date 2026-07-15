'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Badge, Button, Modal, Spinner } from 'react-bootstrap';
import { cleanSdsDisplayText } from '@/lib/sds/clean-text';

type ChainStep = {
  id: number;
  sequence_no: number;
  activity_name: string;
  duration_text: string | null;
};

type Assignment = {
  assignment_id: number;
  activity_id: number;
  activity_name: string;
  activity_sequence?: number;
  duration_text: string | null;
  target_date: string | null;
  standard_code: string;
  standard_title: string;
  pillar?: string | null;
  service_description: string;
  output_cover?: string | null;
  quality_standard?: string | null;
  pathway?: string | null;
  assigned_by_name?: string | null;
  process_chain?: ChainStep[];
  co_assignees?: { id: number; full_name: string }[];
};

function shortText(raw: string | null | undefined, max = 120): string {
  const cleaned = cleanSdsDisplayText(raw);
  if (!cleaned) return '';
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}…`;
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  return String(raw).slice(0, 10);
}

function isOverdue(target: string | null | undefined): boolean {
  if (!target) return false;
  const d = String(target).slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return d < today;
}

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

  const grouped = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const r of rows) {
      const key = r.pillar || 'Other';
      const list = map.get(key) || [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h4 className="fw-bold mb-1" style={{ color: 'var(--mubs-blue)' }}>My SDS Activities</h4>
          <p className="text-muted small mb-0">
            Process steps assigned to you. View context here — completion is handled at appraisal.
          </p>
        </div>
        <Badge bg="light" className="text-dark border align-self-start">
          {rows.length} active
        </Badge>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading ? (
        <div className="text-center py-5"><Spinner size="sm" /></div>
      ) : rows.length === 0 ? (
        <div className="border rounded-3 p-4 text-center text-muted small">
          No SDS activities assigned to you yet.
        </div>
      ) : (
        <div className="d-flex flex-column gap-4">
          {grouped.map(([pillar, items]) => (
            <section key={pillar}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <span
                  className="badge rounded-pill"
                  style={{ background: '#e8f1f8', color: 'var(--mubs-blue)', fontWeight: 600 }}
                >
                  {pillar}
                </span>
                <span className="text-muted small">{items.length} {items.length === 1 ? 'activity' : 'activities'}</span>
              </div>

              <div className="d-flex flex-column gap-2">
                {items.map((r) => {
                  const overdue = isOverdue(r.target_date);
                  return (
                    <div
                      key={r.assignment_id}
                      className="border rounded-3 p-3"
                      style={{ background: '#fff' }}
                    >
                      <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start">
                        <div className="flex-grow-1" style={{ minWidth: 200 }}>
                          <div className="fw-bold" style={{ color: '#0f172a' }}>{r.activity_name}</div>
                          <div className="text-muted small mt-1">{r.standard_title}</div>
                          <div className="d-flex flex-wrap gap-2 mt-2">
                            {r.duration_text ? (
                              <Badge bg="light" className="text-dark border">{r.duration_text}</Badge>
                            ) : null}
                            <Badge
                              bg={overdue ? 'danger' : 'light'}
                              className={overdue ? '' : 'text-dark border'}
                            >
                              Target {formatDate(r.target_date)}
                              {overdue ? ' · overdue' : ''}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => setSelected(r)}
                        >
                          Details
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal show={!!selected} onHide={() => setSelected(null)} size="lg" centered scrollable>
        <Modal.Header closeButton className="py-2 border-0 pb-0">
          <Modal.Title className="fs-6 fw-bold" style={{ color: 'var(--mubs-blue)' }}>
            {selected?.activity_name || 'Activity'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-2">
          {selected && (
            <div className="d-flex flex-column gap-3">
              <div className="d-flex flex-wrap gap-2">
                {selected.pillar ? (
                  <span
                    className="badge rounded-pill"
                    style={{ background: '#e8f1f8', color: 'var(--mubs-blue)', fontWeight: 600 }}
                  >
                    {selected.pillar}
                  </span>
                ) : null}
                {selected.duration_text ? (
                  <Badge bg="light" className="text-dark border">{selected.duration_text}</Badge>
                ) : null}
                <Badge
                  bg={isOverdue(selected.target_date) ? 'danger' : 'light'}
                  className={isOverdue(selected.target_date) ? '' : 'text-dark border'}
                >
                  Target {formatDate(selected.target_date)}
                </Badge>
              </div>

              <div className="rounded-3 p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div className="text-uppercase text-muted mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                  Service delivery standard
                </div>
                <div className="fw-semibold">{selected.standard_title}</div>
                <div className="text-muted small mt-1">{selected.standard_code}</div>
              </div>

              {shortText(selected.service_description || selected.output_cover, 200) ? (
                <div>
                  <div className="small fw-bold mb-1">This process</div>
                  <p className="small text-muted mb-0" style={{ lineHeight: 1.5 }}>
                    {shortText(selected.service_description || selected.output_cover, 220)}
                  </p>
                </div>
              ) : null}

              {(selected.process_chain || []).length > 0 && (
                <div>
                  <div className="small fw-bold mb-2">Your place in the process</div>
                  <div className="d-flex flex-column gap-1">
                    {(selected.process_chain || []).map((step) => {
                      const isYours =
                        Number(step.id) === Number(selected.activity_id)
                        || step.activity_name === selected.activity_name;
                      return (
                        <div
                          key={step.id}
                          className="d-flex align-items-center gap-2 rounded-2 px-2 py-2"
                          style={{
                            background: isYours ? '#fff8e6' : 'transparent',
                            border: isYours ? '1px solid #f0d78c' : '1px solid transparent',
                          }}
                        >
                          <span
                            className="rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0"
                            style={{
                              width: 22,
                              height: 22,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: isYours ? 'var(--mubs-yellow, #f5c518)' : '#e2e8f0',
                              color: '#0f172a',
                            }}
                          >
                            {step.sequence_no}
                          </span>
                          <div className="small flex-grow-1">
                            <span className={isYours ? 'fw-bold' : ''}>{step.activity_name}</span>
                            {step.duration_text ? (
                              <span className="text-muted"> · {step.duration_text}</span>
                            ) : null}
                          </div>
                          {isYours ? (
                            <Badge bg="warning" className="text-dark">You</Badge>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="d-flex flex-wrap gap-3 small text-muted border-top pt-3">
                <div>
                  <span className="fw-semibold text-dark">Assigned by</span>
                  <div>{selected.assigned_by_name || '—'}</div>
                </div>
                <div>
                  <span className="fw-semibold text-dark">Also on this step</span>
                  <div>
                    {(selected.co_assignees || []).length
                      ? selected.co_assignees!.map((c) => c.full_name).join(', ')
                      : 'Only you'}
                  </div>
                </div>
              </div>

              <div className="small rounded-2 px-3 py-2" style={{ background: '#f1f5f9', color: '#475569' }}>
                Completion is recorded at HR appraisal — this screen is for context only.
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2 border-0">
          <Button size="sm" variant="outline-secondary" onClick={() => setSelected(null)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
