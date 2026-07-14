'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Badge, Button, Form, Modal, Nav, Spinner, Tab } from 'react-bootstrap';

type SdsStandard = {
  id: number;
  code: string;
  title: string;
  pathway?: string | null;
  purpose?: string | null;
  output_count?: number;
};

type SdsActivity = {
  id: number;
  sequence_no: number;
  activity_name: string;
  duration_text: string | null;
  duration_days?: number | null;
};

type SdsOutput = {
  id: number;
  output_code: string;
  service_description: string;
  performance_indicators: string[];
  quality_standard: string | null;
  process_text: string | null;
  activities: SdsActivity[];
};

type SdsDetail = SdsStandard & {
  owner_department_name?: string;
  supporting_units?: string | null;
  user_fee?: string | null;
  objectives?: string[];
  outputs: SdsOutput[];
};

type StaffOption = { id: number; full_name: string; email?: string };

type PiCatalogItem = {
  standard_id: number;
  standard_code: string;
  standard_title: string;
  output_id: number;
  output_code: string;
  sequence_no: number;
  service_description: string;
  performance_indicators: string[];
};

type PiReport = {
  id: number;
  standard_id: number;
  output_id: number | null;
  indicator_text: string;
  value_text: string | null;
  comment: string | null;
  reporting_period: string;
};

export default function HodSdsView() {
  const [tab, setTab] = useState<'assign' | 'pi'>('assign');
  const [standards, setStandards] = useState<SdsStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SdsDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [assignActivity, setAssignActivity] = useState<SdsActivity | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [targetDate, setTargetDate] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const [piPeriod, setPiPeriod] = useState('');
  const [piCatalog, setPiCatalog] = useState<PiCatalogItem[]>([]);
  const [piReports, setPiReports] = useState<PiReport[]>([]);
  const [piLoading, setPiLoading] = useState(false);
  const [piMsg, setPiMsg] = useState<string | null>(null);
  const [piDrafts, setPiDrafts] = useState<Record<string, { value: string; comment: string }>>({});
  const [piSavingKey, setPiSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/sds/hod');
      setStandards(Array.isArray(res.data?.standards) ? res.data.standards : []);
    } catch {
      setError('Could not load SDS standards for your department');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPi = useCallback(async (period?: string) => {
    setPiLoading(true);
    setPiMsg(null);
    try {
      const params = period ? `?period=${encodeURIComponent(period)}` : '';
      const res = await axios.get(`/api/sds/hod/indicator-reports${params}`);
      setPiPeriod(String(res.data?.period || ''));
      setPiCatalog(Array.isArray(res.data?.catalog) ? res.data.catalog : []);
      setPiReports(Array.isArray(res.data?.reports) ? res.data.reports : []);
      const drafts: Record<string, { value: string; comment: string }> = {};
      for (const r of (res.data?.reports || []) as PiReport[]) {
        const key = `${r.output_id || 0}::${r.indicator_text}`;
        drafts[key] = { value: r.value_text || '', comment: r.comment || '' };
      }
      setPiDrafts(drafts);
    } catch {
      setPiMsg('Could not load PI reporting catalog');
    } finally {
      setPiLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    axios.get('/api/department-head/staff')
      .then(({ data }) => {
        const list = Array.isArray(data?.staff) ? data.staff : Array.isArray(data) ? data : [];
        setStaff(list.map((s: { id: number; full_name?: string; name?: string; email?: string }) => ({
          id: Number(s.id),
          full_name: String(s.full_name || s.name || '').trim(),
          email: s.email,
        })).filter((s: StaffOption) => s.id && s.full_name));
      })
      .catch(() => setStaff([]));
  }, [load]);

  useEffect(() => {
    if (tab === 'pi') void loadPi(piPeriod || undefined);
  }, [tab, loadPi]); // eslint-disable-line react-hooks/exhaustive-deps

  const reportByKey = useMemo(() => {
    const map = new Map<string, PiReport>();
    for (const r of piReports) map.set(`${r.output_id || 0}::${r.indicator_text}`, r);
    return map;
  }, [piReports]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await axios.get(`/api/sds/standards/${id}`);
      setDetail(res.data as SdsDetail);
    } catch {
      setError('Failed to open standard');
    } finally {
      setDetailLoading(false);
    }
  };

  const suggestDate = (days: number | null | undefined) => {
    if (days == null || !Number.isFinite(days)) return '';
    const d = new Date();
    d.setDate(d.getDate() + Number(days));
    return d.toISOString().slice(0, 10);
  };

  const openAssign = (activity: SdsActivity) => {
    setAssignActivity(activity);
    setSelectedStaffIds([]);
    setTargetDate(suggestDate(activity.duration_days));
    setAssignMsg(null);
  };

  const submitAssign = async () => {
    if (!assignActivity || !selectedStaffIds.length) return;
    setAssigning(true);
    setAssignMsg(null);
    try {
      const res = await axios.post('/api/sds/hod', {
        activity_id: assignActivity.id,
        staff_user_ids: selectedStaffIds,
        target_date: targetDate || null,
      });
      setAssignMsg(`Assigned to ${res.data?.created ?? selectedStaffIds.length} staff member(s).`);
      setAssignActivity(null);
    } catch (e: unknown) {
      setAssignMsg(axios.isAxiosError(e) ? e.response?.data?.message || 'Assign failed' : 'Assign failed');
    } finally {
      setAssigning(false);
    }
  };

  const savePiRow = async (
    item: PiCatalogItem,
    indicatorText: string,
    draft: { value: string; comment: string },
    key: string,
  ) => {
    if (!indicatorText.trim()) {
      setPiMsg('Enter an indicator description first');
      return;
    }
    setPiSavingKey(key);
    setPiMsg(null);
    try {
      await axios.post('/api/sds/hod/indicator-reports', {
        standard_id: item.standard_id,
        output_id: item.output_id,
        indicator_text: indicatorText.trim(),
        value_text: draft.value,
        comment: draft.comment || null,
        reporting_period: piPeriod,
      });
      setPiMsg('Saved (self-reported — no approval required).');
      await loadPi(piPeriod);
    } catch (e: unknown) {
      setPiMsg(axios.isAxiosError(e) ? e.response?.data?.message || 'Save failed' : 'Save failed');
    } finally {
      setPiSavingKey(null);
    }
  };

  return (
    <div className="container-fluid py-3">
      <h4 className="fw-bold mb-1" style={{ color: 'var(--mubs-blue)' }}>Service Delivery Standards</h4>
      <p className="text-muted small mb-3">
        Assign Process Activities to staff (HRM appraisal pull). Report Performance Indicators yourself — heads of unit; no approval step.
      </p>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {assignMsg && tab === 'assign' && <div className="alert alert-info py-2 small">{assignMsg}</div>}
      {piMsg && tab === 'pi' && <div className="alert alert-info py-2 small">{piMsg}</div>}

      <Tab.Container activeKey={tab} onSelect={(k) => setTab((k as 'assign' | 'pi') || 'assign')}>
        <Nav variant="tabs" className="mb-3">
          <Nav.Item>
            <Nav.Link eventKey="assign">Assign activities</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="pi">Report PIs</Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          <Tab.Pane eventKey="assign">
            <div className="table-responsive">
              <table className="table table-sm table-bordered" style={{ fontSize: '0.82rem' }}>
                <thead className="table-dark">
                  <tr>
                    <th>Code</th>
                    <th>Title</th>
                    <th>Outputs</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-4"><Spinner size="sm" /></td></tr>
                  ) : standards.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-muted py-4">No SDS standards mapped to your department yet.</td></tr>
                  ) : standards.map((s) => (
                    <tr key={s.id}>
                      <td className="fw-semibold">{s.code}</td>
                      <td>{s.title}</td>
                      <td>{s.output_count ?? '—'}</td>
                      <td><Button size="sm" variant="outline-primary" onClick={() => void openDetail(s.id)}>Open</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tab.Pane>

          <Tab.Pane eventKey="pi">
            <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
              <div>
                <Form.Label className="small fw-bold mb-1">Reporting period</Form.Label>
                <Form.Control
                  size="sm"
                  value={piPeriod}
                  onChange={(e) => setPiPeriod(e.target.value)}
                  placeholder="e.g. FY25/26"
                  style={{ minWidth: 140 }}
                />
              </div>
              <Button size="sm" variant="outline-primary" onClick={() => void loadPi(piPeriod)}>
                Reload
              </Button>
              <div className="small text-muted ms-auto">
                Self-reported by HoU — counts as final when saved.
              </div>
            </div>

            {piLoading ? (
              <div className="text-center py-4"><Spinner size="sm" /></div>
            ) : !piCatalog.length ? (
              <div className="text-muted small py-4">No SDS outputs with indicators for your department yet.</div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {piCatalog.map((item) => {
                  const indicators = item.performance_indicators?.length
                    ? item.performance_indicators
                    : [''];
                  return (
                    <div key={item.output_id} className="border rounded-3 p-3">
                      <div className="fw-bold small">{item.standard_code}</div>
                      <div className="small text-muted">{item.standard_title}</div>
                      <div className="mt-2 fw-semibold" style={{ fontSize: '0.85rem' }}>
                        {item.service_description}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>{item.output_code}</div>

                      {indicators.map((ind, idx) => {
                        const key = `${item.output_id}::${ind || `__custom_${idx}`}`;
                        const draft = piDrafts[key] || { value: '', comment: '' };
                        const existing = reportByKey.get(`${item.output_id}::${ind}`)
                          || (ind ? undefined : undefined);
                        return (
                          <div key={key} className="border-top mt-2 pt-2">
                            {ind ? (
                              <div className="small fw-semibold mb-1">{ind}</div>
                            ) : (
                              <>
                                <Form.Label className="small mb-0">Indicator (custom)</Form.Label>
                                <Form.Control
                                  size="sm"
                                  className="mb-2"
                                  placeholder="Describe the indicator…"
                                  value={draft.comment}
                                  onChange={(e) => setPiDrafts((prev) => ({
                                    ...prev,
                                    [key]: { ...draft, comment: e.target.value },
                                  }))}
                                />
                              </>
                            )}
                            <div className="row g-2 align-items-end">
                              <div className="col-md-3">
                                <Form.Label className="small mb-0">Value / actual</Form.Label>
                                <Form.Control
                                  size="sm"
                                  value={draft.value}
                                  onChange={(e) => setPiDrafts((prev) => ({
                                    ...prev,
                                    [key]: { ...draft, value: e.target.value },
                                  }))}
                                  placeholder="e.g. 92%"
                                />
                              </div>
                              <div className="col-md-6">
                                {ind ? (
                                  <>
                                    <Form.Label className="small mb-0">Comment (optional)</Form.Label>
                                    <Form.Control
                                      size="sm"
                                      value={draft.comment}
                                      onChange={(e) => setPiDrafts((prev) => ({
                                        ...prev,
                                        [key]: { ...draft, comment: e.target.value },
                                      }))}
                                    />
                                  </>
                                ) : (
                                  <div className="small text-muted">No matrix PI text for this output — enter a custom indicator above.</div>
                                )}
                              </div>
                              <div className="col-md-3">
                                <Button
                                  size="sm"
                                  className="w-100"
                                  style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                                  disabled={piSavingKey === key || !draft.value}
                                  onClick={() => void savePiRow(
                                    item,
                                    ind || draft.comment,
                                    ind ? draft : { value: draft.value, comment: '' },
                                    key,
                                  )}
                                >
                                  {piSavingKey === key ? 'Saving…' : existing ? 'Update' : 'Save'}
                                </Button>
                              </div>
                            </div>
                            {existing?.value_text ? (
                              <div className="small text-success mt-1">
                                Current: <Badge bg="success">{existing.value_text}</Badge>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>

      <Modal show={!!detail || detailLoading} onHide={() => setDetail(null)} size="xl" scrollable centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">{detail?.code || 'SDS Standard'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailLoading || !detail ? (
            <div className="text-center py-4"><Spinner size="sm" /></div>
          ) : (
            <div className="d-flex flex-column gap-3">
              <div>
                <div className="fw-bold">{detail.title}</div>
                {detail.pathway && <div className="small text-muted mt-1"><span className="fw-semibold">Pathway:</span> {detail.pathway}</div>}
                {detail.purpose && <div className="small mt-2">{detail.purpose}</div>}
              </div>
              {detail.outputs?.map((o) => (
                <div key={o.id} className="border rounded-3 p-3">
                  <div className="fw-bold small mb-1">{o.service_description}</div>
                  <div className="text-muted" style={{ fontSize: '0.72rem' }}>{o.output_code}</div>
                  {(o.performance_indicators || []).length > 0 && (
                    <ul className="small mb-2 mt-2 ps-3">
                      {o.performance_indicators.map((pi) => <li key={pi}>{pi}</li>)}
                    </ul>
                  )}
                  {o.quality_standard && (
                    <div className="small mt-2 p-2 rounded" style={{ background: '#f8fafc' }}>
                      <span className="fw-semibold">Standard (quality):</span> {o.quality_standard}
                    </div>
                  )}
                  <div className="mt-2">
                    <div className="small fw-bold mb-1">Assign Process Activities</div>
                    {(o.activities || []).map((a) => (
                      <div key={a.id} className="d-flex justify-content-between align-items-center gap-2 border-bottom py-2">
                        <div>
                          <span className="small fw-semibold">{a.sequence_no}. {a.activity_name}</span>
                          {a.duration_text ? <Badge bg="light" className="text-dark border ms-2">{a.duration_text}</Badge> : null}
                        </div>
                        <Button size="sm" variant="primary" style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }} onClick={() => openAssign(a)}>
                          Assign
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
      </Modal>

      <Modal show={!!assignActivity} onHide={() => setAssignActivity(null)} centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">Assign activity</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {assignActivity && (
            <>
              <div className="fw-semibold small mb-2">{assignActivity.activity_name}</div>
              <Form.Label className="small fw-bold">Staff (select one or more)</Form.Label>
              <div className="border rounded-2 p-2 mb-2" style={{ maxHeight: 220, overflow: 'auto' }}>
                {staff.map((s) => (
                  <label key={s.id} className="d-flex gap-2 small mb-1">
                    <input
                      type="checkbox"
                      checked={selectedStaffIds.includes(s.id)}
                      onChange={() => setSelectedStaffIds((prev) =>
                        prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                      )}
                    />
                    <span>{s.full_name}</span>
                  </label>
                ))}
                {!staff.length && <div className="text-muted small">No staff found in your department.</div>}
              </div>
              <Form.Label className="small fw-bold">Target date (suggested from duration, editable)</Form.Label>
              <Form.Control type="date" size="sm" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="outline-secondary" onClick={() => setAssignActivity(null)}>Cancel</Button>
          <Button size="sm" variant="primary" disabled={assigning || !selectedStaffIds.length} onClick={() => void submitAssign()}
            style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}>
            {assigning ? 'Assigning…' : 'Assign'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
