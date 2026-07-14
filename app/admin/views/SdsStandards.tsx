'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Badge, Button, Form, Modal, Spinner } from 'react-bootstrap';
import Layout from '@/components/Layout';
import { STRATEGIC_PILLARS_2025_2030 } from '@/lib/strategic-plan';

type SdsStandardListItem = {
  id: number;
  code: string;
  title: string;
  pillar: string | null;
  owner_label: string | null;
  owner_department_id: number | null;
  owner_department_name?: string | null;
  output_count: number;
  activity_count: number;
  purpose?: string | null;
  pathway?: string | null;
};

type SdsActivity = {
  id: number;
  sequence_no: number;
  activity_name: string;
  duration_text: string | null;
};

type SdsOutput = {
  id: number;
  output_code: string;
  sequence_no: number;
  service_description: string;
  performance_indicators: string[];
  quality_standard: string | null;
  coverage: string | null;
  frequency: string | null;
  process_text: string | null;
  target_beneficiary: string | null;
  activities: SdsActivity[];
};

type SdsStandardDetail = SdsStandardListItem & {
  supporting_units: string | null;
  user_fee: string | null;
  purpose: string | null;
  pathway: string | null;
  objectives: string[];
  outputs: SdsOutput[];
};

type Dept = { id: number; name: string };

export default function SdsStandardsAdminView() {
  const [standards, setStandards] = useState<SdsStandardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pillar, setPillar] = useState('all');
  const [departmentId, setDepartmentId] = useState('all');
  const [q, setQ] = useState('');
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SdsStandardDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (pillar !== 'all') params.set('pillar', pillar);
      if (departmentId !== 'all') params.set('departmentId', departmentId);
      if (q.trim()) params.set('q', q.trim());
      const res = await axios.get(`/api/sds/standards?${params.toString()}`);
      setStandards(Array.isArray(res.data?.standards) ? res.data.standards : []);
    } catch {
      setError('Failed to load SDS standards');
      setStandards([]);
    } finally {
      setLoading(false);
    }
  }, [pillar, departmentId, q]);

  useEffect(() => {
    axios.get('/api/departments')
      .then(({ data }) => {
        const list = (Array.isArray(data) ? data : []).map((d: { id: number; name?: string; external_name?: string }) => ({
          id: Number(d.id),
          name: String(d.external_name || d.name || '').trim(),
        })).filter((d: Dept) => d.id && d.name);
        setDepartments(list);
      })
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openDetail = async (id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await axios.get(`/api/sds/standards/${id}`);
      setDetail(res.data as SdsStandardDetail);
    } catch {
      setError('Failed to load standard detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const saveMeta = async () => {
    if (!detail) return;
    setSaving(true);
    setError(null);
    try {
      await axios.put(`/api/sds/standards/${detail.id}`, {
        code: detail.code,
        title: detail.title,
        owner_department_id: detail.owner_department_id,
        owner_label: detail.owner_label,
        supporting_units: detail.supporting_units,
        pathway: detail.pathway,
        user_fee: detail.user_fee,
        purpose: detail.purpose,
        objectives: detail.objectives,
        pillar: detail.pillar,
        outputs: detail.outputs.map((o) => ({
          id: o.id,
          sequence_no: o.sequence_no,
          service_description: o.service_description,
          performance_indicators: o.performance_indicators,
          quality_standard: o.quality_standard,
          coverage: o.coverage,
          frequency: o.frequency,
          process_text: o.process_text,
          target_beneficiary: o.target_beneficiary,
        })),
      });
      await loadList();
      await openDetail(detail.id);
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? e.response?.data?.message || 'Save failed' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(() => ({
    standards: standards.length,
    outputs: standards.reduce((s, x) => s + (x.output_count || 0), 0),
    activities: standards.reduce((s, x) => s + (x.activity_count || 0), 0),
  }), [standards]);

  return (
    <Layout>
      <div className="container-fluid py-3">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h4 className="mb-1 fw-bold" style={{ color: 'var(--mubs-blue)' }}>Service Delivery Standards (SDS)</h4>
            <p className="text-muted small mb-0">
              Catalog from the official SDS document. Pathway = summary. Process Activities under each output are what HODs assign.
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <Badge bg="primary">{totals.standards} standards</Badge>
            <Badge bg="secondary">{totals.outputs} outputs</Badge>
            <Badge bg="light" className="text-dark border">{totals.activities} activities</Badge>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="table-card mb-3">
          <div className="table-card-header d-flex flex-wrap gap-2 align-items-end">
            <div>
              <Form.Label className="small fw-bold mb-1">Pillar</Form.Label>
              <Form.Select size="sm" value={pillar} onChange={(e) => setPillar(e.target.value)} style={{ minWidth: 240 }}>
                <option value="all">All pillars</option>
                {STRATEGIC_PILLARS_2025_2030.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Form.Select>
            </div>
            <div>
              <Form.Label className="small fw-bold mb-1">Owner department</Form.Label>
              <Form.Select size="sm" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} style={{ minWidth: 220 }}>
                <option value="all">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </Form.Select>
            </div>
            <div className="flex-grow-1" style={{ minWidth: 180 }}>
              <Form.Label className="small fw-bold mb-1">Search</Form.Label>
              <Form.Control size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code, title, owner…" />
            </div>
            <Button size="sm" variant="primary" style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }} onClick={() => void loadList()}>
              Apply
            </Button>
          </div>

          <div className="table-responsive">
            <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.8rem' }}>
              <thead className="table-dark">
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Owner</th>
                  <th>Pillar</th>
                  <th>Outputs</th>
                  <th>Activities</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-4"><Spinner size="sm" /> Loading…</td></tr>
                ) : standards.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-muted py-4">No SDS standards yet. Run seed: <code>node scripts/seed-sds-from-csv.js</code></td></tr>
                ) : standards.map((s) => (
                  <tr key={s.id}>
                    <td className="fw-semibold" style={{ whiteSpace: 'nowrap' }}>{s.code}</td>
                    <td>{s.title}</td>
                    <td>{s.owner_department_name || s.owner_label || '—'}</td>
                    <td style={{ fontSize: '0.72rem' }}>{s.pillar || '—'}</td>
                    <td className="text-center">{s.output_count}</td>
                    <td className="text-center">{s.activity_count}</td>
                    <td>
                      <Button size="sm" variant="outline-primary" onClick={() => void openDetail(s.id)}>Open</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal show={selectedId != null} onHide={() => { setSelectedId(null); setDetail(null); }} size="xl" scrollable centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">
            {detail ? `${detail.code}` : 'SDS Standard'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailLoading || !detail ? (
            <div className="text-center py-4"><Spinner size="sm" /> Loading…</div>
          ) : (
            <div className="d-flex flex-column gap-3">
              <div className="border rounded-3 p-3">
                <div className="row g-2">
                  <div className="col-md-8">
                    <Form.Label className="small fw-bold mb-1">Title</Form.Label>
                    <Form.Control size="sm" value={detail.title} onChange={(e) => setDetail({ ...detail, title: e.target.value })} />
                  </div>
                  <div className="col-md-4">
                    <Form.Label className="small fw-bold mb-1">Owner department</Form.Label>
                    <Form.Select
                      size="sm"
                      value={detail.owner_department_id ? String(detail.owner_department_id) : ''}
                      onChange={(e) => setDetail({
                        ...detail,
                        owner_department_id: e.target.value ? Number(e.target.value) : null,
                      })}
                    >
                      <option value="">— Unmapped —</option>
                      {departments.map((d) => (
                        <option key={d.id} value={String(d.id)}>{d.name}</option>
                      ))}
                    </Form.Select>
                  </div>
                  <div className="col-12">
                    <Form.Label className="small fw-bold mb-1">Pathway (summary only)</Form.Label>
                    <Form.Control size="sm" as="textarea" rows={2} value={detail.pathway || ''} onChange={(e) => setDetail({ ...detail, pathway: e.target.value })} />
                  </div>
                  <div className="col-12">
                    <Form.Label className="small fw-bold mb-1">Purpose</Form.Label>
                    <Form.Control size="sm" as="textarea" rows={2} value={detail.purpose || ''} onChange={(e) => setDetail({ ...detail, purpose: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <Form.Label className="small fw-bold mb-1">Supporting units</Form.Label>
                    <Form.Control size="sm" value={detail.supporting_units || ''} onChange={(e) => setDetail({ ...detail, supporting_units: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <Form.Label className="small fw-bold mb-1">User fee</Form.Label>
                    <Form.Control size="sm" value={detail.user_fee || ''} onChange={(e) => setDetail({ ...detail, user_fee: e.target.value })} />
                  </div>
                </div>
              </div>

              {detail.outputs.map((o, oi) => (
                <div key={o.id} className="border rounded-3 p-3">
                  <div className="fw-bold small mb-2" style={{ color: 'var(--mubs-blue)' }}>
                    Output {oi + 1}: {o.service_description}
                  </div>
                  <div className="text-muted small mb-2">{o.output_code}</div>
                  <Form.Label className="small fw-bold mb-1">Service description</Form.Label>
                  <Form.Control
                    size="sm"
                    as="textarea"
                    rows={2}
                    className="mb-2"
                    value={o.service_description}
                    onChange={(e) => {
                      const outputs = [...detail.outputs];
                      outputs[oi] = { ...o, service_description: e.target.value };
                      setDetail({ ...detail, outputs });
                    }}
                  />
                  <Form.Label className="small fw-bold mb-1">Quality / Standard block (stationary)</Form.Label>
                  <Form.Control
                    size="sm"
                    as="textarea"
                    rows={3}
                    className="mb-2"
                    value={o.quality_standard || ''}
                    onChange={(e) => {
                      const outputs = [...detail.outputs];
                      outputs[oi] = { ...o, quality_standard: e.target.value };
                      setDetail({ ...detail, outputs });
                    }}
                  />
                  <div className="mb-2">
                    <div className="small fw-bold mb-1">Process Activities (assignable)</div>
                    <ol className="small mb-0 ps-3">
                      {(o.activities || []).map((a) => (
                        <li key={a.id} className="mb-1">
                          <span className="fw-semibold">{a.activity_name}</span>
                          {a.duration_text ? <span className="text-muted"> — {a.duration_text}</span> : null}
                        </li>
                      ))}
                    </ol>
                    {!o.activities?.length && (
                      <div className="text-muted small">No activities seeded for this output yet.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="outline-secondary" onClick={() => { setSelectedId(null); setDetail(null); }}>Close</Button>
          <Button
            size="sm"
            variant="primary"
            style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
            disabled={!detail || saving}
            onClick={() => void saveMeta()}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Layout>
  );
}
