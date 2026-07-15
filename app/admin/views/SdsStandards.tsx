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

type FlashTone = 'success' | 'info' | 'danger' | 'warning';

export default function SdsStandardsAdminView() {
  const [standards, setStandards] = useState<SdsStandardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<FlashTone>('success');
  const [modalFlash, setModalFlash] = useState<{ text: string; tone: FlashTone } | null>(null);
  const [pillar, setPillar] = useState('all');
  const [departmentId, setDepartmentId] = useState('all');
  const [q, setQ] = useState('');
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SdsStandardDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ code: '', title: '', owner_department_id: '', pillar: '' });
  const [creating, setCreating] = useState(false);

  const [addActivityForOutput, setAddActivityForOutput] = useState<number | null>(null);
  const [newActivity, setNewActivity] = useState({ activity_name: '', duration_text: '' });
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  const [editActivity, setEditActivity] = useState({ activity_name: '', duration_text: '', sequence_no: 1 });
  const [busyActivity, setBusyActivity] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    body: string;
    confirmLabel: string;
    danger?: boolean;
    run: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [addingOutput, setAddingOutput] = useState(false);
  const [newOutputDesc, setNewOutputDesc] = useState('');

  const flashPage = (text: string, tone: FlashTone = 'success') => {
    setMsg(text);
    setMsgTone(tone);
  };

  const flashModal = (text: string, tone: FlashTone = 'success') => {
    setModalFlash({ text, tone });
  };

  useEffect(() => {
    if (!msg || (msgTone !== 'success' && msgTone !== 'info')) return;
    const t = window.setTimeout(() => setMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [msg, msgTone]);

  useEffect(() => {
    if (!modalFlash || (modalFlash.tone !== 'success' && modalFlash.tone !== 'info')) return;
    const t = window.setTimeout(() => setModalFlash(null), 3500);
    return () => window.clearTimeout(t);
  }, [modalFlash]);

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
    setEditingActivityId(null);
    setAddActivityForOutput(null);
    setModalFlash(null);
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
      flashPage('Standard metadata saved.', 'success');
      flashModal('Standard metadata saved.', 'success');
      await loadList();
      await openDetail(detail.id);
    } catch (e: unknown) {
      const text = axios.isAxiosError(e) ? e.response?.data?.message || 'Save failed' : 'Save failed';
      setError(text);
      flashModal(text, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const deactivateStandard = async () => {
    if (!detail) return;
    const code = detail.code;
    const id = detail.id;
    setConfirmDialog({
      title: 'Deactivate standard',
      body: `Deactivate ${code}? Heads of unit will no longer see it.`,
      confirmLabel: 'Deactivate',
      danger: true,
      run: async () => {
        setSaving(true);
        try {
          await axios.delete(`/api/sds/standards/${id}`);
          flashPage('Standard deactivated.', 'success');
          setSelectedId(null);
          setDetail(null);
          await loadList();
        } catch (e: unknown) {
          setError(axios.isAxiosError(e) ? e.response?.data?.message || 'Deactivate failed' : 'Deactivate failed');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const createStandard = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await axios.post('/api/sds/standards', {
        code: createForm.code,
        title: createForm.title,
        owner_department_id: createForm.owner_department_id ? Number(createForm.owner_department_id) : null,
        pillar: createForm.pillar || null,
      });
      setShowCreate(false);
      setCreateForm({ code: '', title: '', owner_department_id: '', pillar: '' });
      await loadList();
      if (res.data?.id) await openDetail(Number(res.data.id));
      flashPage('Standard created.', 'success');
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? e.response?.data?.message || 'Create failed' : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const createOutput = async () => {
    if (!detail || !newOutputDesc.trim()) return;
    setBusyActivity(true);
    try {
      await axios.post('/api/sds/outputs', {
        standard_id: detail.id,
        service_description: newOutputDesc.trim(),
      });
      setNewOutputDesc('');
      setAddingOutput(false);
      await openDetail(detail.id);
      await loadList();
      flashModal('Output added.', 'success');
      flashPage('Output added.', 'success');
    } catch (e: unknown) {
      const text = axios.isAxiosError(e) ? e.response?.data?.message || 'Add output failed' : 'Add output failed';
      setError(text);
      flashModal(text, 'danger');
    } finally {
      setBusyActivity(false);
    }
  };

  const createActivity = async (outputId: number) => {
    if (!detail || !newActivity.activity_name.trim()) return;
    setBusyActivity(true);
    try {
      await axios.post('/api/sds/activities', {
        output_id: outputId,
        activity_name: newActivity.activity_name.trim(),
        duration_text: newActivity.duration_text.trim() || null,
      });
      setNewActivity({ activity_name: '', duration_text: '' });
      setAddActivityForOutput(null);
      await openDetail(detail.id);
      await loadList();
      flashModal('Activity added.', 'success');
      flashPage('Activity added.', 'success');
    } catch (e: unknown) {
      const text = axios.isAxiosError(e) ? e.response?.data?.message || 'Add activity failed' : 'Add activity failed';
      setError(text);
      flashModal(text, 'danger');
    } finally {
      setBusyActivity(false);
    }
  };

  const saveActivityEdit = async (activityId: number) => {
    if (!detail || !editActivity.activity_name.trim()) return;
    setBusyActivity(true);
    try {
      await axios.put(`/api/sds/activities/${activityId}`, {
        activity_name: editActivity.activity_name.trim(),
        duration_text: editActivity.duration_text.trim() || null,
        sequence_no: editActivity.sequence_no,
      });
      setEditingActivityId(null);
      await openDetail(detail.id);
      await loadList();
      flashModal('Activity updated.', 'success');
      flashPage('Activity updated.', 'success');
    } catch (e: unknown) {
      const text = axios.isAxiosError(e) ? e.response?.data?.message || 'Update failed' : 'Update failed';
      setError(text);
      flashModal(text, 'danger');
    } finally {
      setBusyActivity(false);
    }
  };

  const deleteActivity = async (activityId: number, name: string) => {
    if (!detail) return;
    const standardId = detail.id;
    setConfirmDialog({
      title: 'Delete activity',
      body: `Delete activity “${name}”? Active staff assignments will be cancelled.`,
      confirmLabel: 'Delete',
      danger: true,
      run: async () => {
        setBusyActivity(true);
        try {
          await axios.delete(`/api/sds/activities/${activityId}`);
          await openDetail(standardId);
          await loadList();
          flashModal('Activity deleted.', 'success');
          flashPage('Activity deleted.', 'success');
        } catch (e: unknown) {
          const text = axios.isAxiosError(e) ? e.response?.data?.message || 'Delete failed' : 'Delete failed';
          setError(text);
          flashModal(text, 'danger');
        } finally {
          setBusyActivity(false);
        }
      },
    });
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
              Catalog from the official SDS document. Pathway = summary. Process Activities under each output are assigned by Heads of Unit.
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <Badge bg="primary">{totals.standards} standards</Badge>
            <Badge bg="secondary">{totals.outputs} outputs</Badge>
            <Badge bg="light" className="text-dark border">{totals.activities} activities</Badge>
            <Button
              size="sm"
              variant="primary"
              style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
              onClick={() => setShowCreate(true)}
            >
              + Add standard
            </Button>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small d-flex justify-content-between align-items-center gap-2">
            <span>{error}</span>
            <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setError(null)} />
          </div>
        )}
        {msg && (
          <div className={`alert alert-${msgTone} py-2 small d-flex justify-content-between align-items-center gap-2`}>
            <span>{msg}</span>
            <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setMsg(null)} />
          </div>
        )}

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
                  <tr><td colSpan={7} className="text-center text-muted py-4">No SDS standards yet.</td></tr>
                ) : standards.map((s) => (
                  <tr key={s.id}>
                    <td className="fw-semibold" style={{ whiteSpace: 'nowrap' }}>{s.code}</td>
                    <td>{s.title}</td>
                    <td>{s.owner_department_name || s.owner_label || '—'}</td>
                    <td style={{ fontSize: '0.72rem' }}>{s.pillar || '—'}</td>
                    <td className="text-center">{s.output_count}</td>
                    <td className="text-center">{s.activity_count}</td>
                    <td>
                      <Button size="sm" variant="outline-primary" onClick={() => void openDetail(s.id)}>Open / Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">Add SDS standard</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Label className="small fw-bold">Code</Form.Label>
          <Form.Control size="sm" className="mb-2" placeholder="MUBS/P5/OBJ4/HCG/HRD/S002" value={createForm.code}
            onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} />
          <Form.Label className="small fw-bold">Title</Form.Label>
          <Form.Control size="sm" className="mb-2" value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} />
          <Form.Label className="small fw-bold">Owner department</Form.Label>
          <Form.Select size="sm" className="mb-2" value={createForm.owner_department_id}
            onChange={(e) => setCreateForm({ ...createForm, owner_department_id: e.target.value })}>
            <option value="">— Unmapped —</option>
            {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </Form.Select>
          <Form.Label className="small fw-bold">Pillar</Form.Label>
          <Form.Select size="sm" value={createForm.pillar}
            onChange={(e) => setCreateForm({ ...createForm, pillar: e.target.value })}>
            <option value="">— From code / optional —</option>
            {STRATEGIC_PILLARS_2025_2030.map((p) => <option key={p} value={p}>{p}</option>)}
          </Form.Select>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="outline-secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button size="sm" variant="primary" disabled={creating || !createForm.code.trim() || !createForm.title.trim()}
            style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
            onClick={() => void createStandard()}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={selectedId != null} onHide={() => { setSelectedId(null); setDetail(null); }} size="xl" scrollable centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">
            {detail ? `${detail.code}` : 'SDS Standard'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalFlash && (
            <div className={`alert alert-${modalFlash.tone} py-2 small d-flex justify-content-between align-items-center gap-2`}>
              <span>{modalFlash.text}</span>
              <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setModalFlash(null)} />
            </div>
          )}
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
                  <Form.Label className="small fw-bold mb-1">Quality / Standard block</Form.Label>
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

                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="small fw-bold">Process Activities</div>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => {
                        setAddActivityForOutput(o.id);
                        setNewActivity({ activity_name: '', duration_text: '' });
                        setEditingActivityId(null);
                      }}
                    >
                      + Add activity
                    </Button>
                  </div>

                  {(o.activities || []).map((a) => (
                    <div key={a.id} className="border rounded-2 p-2 mb-2" style={{ background: '#fafbfc' }}>
                      {editingActivityId === a.id ? (
                        <div className="row g-2 align-items-end">
                          <div className="col-md-1">
                            <Form.Label className="small mb-0">#</Form.Label>
                            <Form.Control size="sm" type="number" min={1} value={editActivity.sequence_no}
                              onChange={(e) => setEditActivity({ ...editActivity, sequence_no: Number(e.target.value) || 1 })} />
                          </div>
                          <div className="col-md-6">
                            <Form.Label className="small mb-0">Activity name</Form.Label>
                            <Form.Control size="sm" value={editActivity.activity_name}
                              onChange={(e) => setEditActivity({ ...editActivity, activity_name: e.target.value })} />
                          </div>
                          <div className="col-md-3">
                            <Form.Label className="small mb-0">Duration</Form.Label>
                            <Form.Control size="sm" value={editActivity.duration_text}
                              onChange={(e) => setEditActivity({ ...editActivity, duration_text: e.target.value })}
                              placeholder="e.g. 2 weeks" />
                          </div>
                          <div className="col-md-2 d-flex gap-1">
                            <Button size="sm" variant="primary" disabled={busyActivity}
                              style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                              onClick={() => void saveActivityEdit(a.id)}>Save</Button>
                            <Button size="sm" variant="outline-secondary" onClick={() => setEditingActivityId(null)}>✕</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="small">
                            <span className="fw-semibold">{a.sequence_no}. {a.activity_name}</span>
                            {a.duration_text ? <span className="text-muted"> — {a.duration_text}</span> : null}
                          </div>
                          <div className="d-flex gap-1 flex-shrink-0">
                            <Button size="sm" variant="outline-primary" onClick={() => {
                              setEditingActivityId(a.id);
                              setEditActivity({
                                activity_name: a.activity_name,
                                duration_text: a.duration_text || '',
                                sequence_no: a.sequence_no,
                              });
                              setAddActivityForOutput(null);
                            }}>Edit</Button>
                            <Button size="sm" variant="outline-danger" disabled={busyActivity}
                              onClick={() => void deleteActivity(a.id, a.activity_name)}>Delete</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {addActivityForOutput === o.id && (
                    <div className="border border-primary rounded-2 p-2 mb-2">
                      <div className="row g-2 align-items-end">
                        <div className="col-md-7">
                          <Form.Label className="small mb-0">New activity name</Form.Label>
                          <Form.Control size="sm" value={newActivity.activity_name}
                            onChange={(e) => setNewActivity({ ...newActivity, activity_name: e.target.value })}
                            placeholder="e.g. Verify applicant documents" />
                        </div>
                        <div className="col-md-3">
                          <Form.Label className="small mb-0">Duration</Form.Label>
                          <Form.Control size="sm" value={newActivity.duration_text}
                            onChange={(e) => setNewActivity({ ...newActivity, duration_text: e.target.value })}
                            placeholder="3 days" />
                        </div>
                        <div className="col-md-2 d-flex gap-1">
                          <Button size="sm" variant="primary" disabled={busyActivity || !newActivity.activity_name.trim()}
                            style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                            onClick={() => void createActivity(o.id)}>Add</Button>
                          <Button size="sm" variant="outline-secondary" onClick={() => setAddActivityForOutput(null)}>✕</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!o.activities?.length && addActivityForOutput !== o.id && (
                    <div className="text-muted small">No activities yet — use + Add activity.</div>
                  )}
                </div>
              ))}

              {addingOutput ? (
                <div className="border rounded-3 p-3">
                  <Form.Label className="small fw-bold">New output — service description</Form.Label>
                  <Form.Control size="sm" as="textarea" rows={2} className="mb-2" value={newOutputDesc}
                    onChange={(e) => setNewOutputDesc(e.target.value)} />
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="primary" disabled={busyActivity || !newOutputDesc.trim()}
                      style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                      onClick={() => void createOutput()}>Save output</Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => setAddingOutput(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline-primary" onClick={() => { setAddingOutput(true); setNewOutputDesc(''); }}>
                  + Add output
                </Button>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2 d-flex justify-content-between">
          <Button size="sm" variant="outline-danger" disabled={!detail || saving} onClick={() => void deactivateStandard()}>
            Deactivate standard
          </Button>
          <div className="d-flex gap-2">
            <Button size="sm" variant="outline-secondary" onClick={() => { setSelectedId(null); setDetail(null); }}>Close</Button>
            <Button
              size="sm"
              variant="primary"
              style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
              disabled={!detail || saving}
              onClick={() => void saveMeta()}
            >
              {saving ? 'Saving…' : 'Save metadata'}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      <Modal
        show={!!confirmDialog}
        onHide={() => { if (!confirmBusy) setConfirmDialog(null); }}
        centered
        backdrop="static"
        style={{ zIndex: 1080 }}
      >
        <Modal.Header closeButton={!confirmBusy} className="py-2">
          <Modal.Title className="fs-6 fw-bold">{confirmDialog?.title || 'Confirm'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="small">
          {confirmDialog?.body}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={confirmBusy}
            onClick={() => setConfirmDialog(null)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant={confirmDialog?.danger ? 'danger' : 'primary'}
            disabled={confirmBusy}
            style={confirmDialog?.danger ? undefined : { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
            onClick={() => {
              if (!confirmDialog) return;
              void (async () => {
                setConfirmBusy(true);
                try {
                  await confirmDialog.run();
                  setConfirmDialog(null);
                } finally {
                  setConfirmBusy(false);
                }
              })();
            }}
          >
            {confirmBusy ? 'Please wait…' : (confirmDialog?.confirmLabel || 'Confirm')}
          </Button>
        </Modal.Footer>
      </Modal>
    </Layout>
  );
}
