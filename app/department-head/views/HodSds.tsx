'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Badge, Button, Form, Modal, Nav, Spinner, Tab } from 'react-bootstrap';
import { ExpandableSdsText } from '@/components/LinkifyText';

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

type ActivityAssignment = {
  assignment_id: number;
  activity_id: number;
  staff_user_id: number;
  staff_name: string;
  staff_email?: string | null;
  target_date?: string | null;
};

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

type FlashTone = 'success' | 'info' | 'danger' | 'warning';

function FlashAlert({
  text,
  tone,
  onDismiss,
  className = 'py-2 small',
}: {
  text: string;
  tone: FlashTone;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div className={`alert alert-${tone} ${className} d-flex align-items-center justify-content-between gap-2 mb-2`}>
      <span>{text}</span>
      {onDismiss ? (
        <button type="button" className="btn-close" aria-label="Dismiss" onClick={onDismiss} />
      ) : null}
    </div>
  );
}

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
  const [assignMsgTone, setAssignMsgTone] = useState<FlashTone>('success');
  const [piMsg, setPiMsg] = useState<string | null>(null);
  const [piMsgTone, setPiMsgTone] = useState<FlashTone>('success');
  const [modalFlash, setModalFlash] = useState<{ text: string; tone: FlashTone } | null>(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [activityAssignments, setActivityAssignments] = useState<ActivityAssignment[]>([]);
  const [viewAssignedActivity, setViewAssignedActivity] = useState<SdsActivity | null>(null);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [deassigningId, setDeassigningId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    body: string;
    confirmLabel: string;
    danger?: boolean;
    run: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [piPeriod, setPiPeriod] = useState('');
  const [piPeriods, setPiPeriods] = useState<string[]>([]);
  const [piCatalog, setPiCatalog] = useState<PiCatalogItem[]>([]);
  const [piReports, setPiReports] = useState<PiReport[]>([]);
  const [piLoading, setPiLoading] = useState(false);
  const [piDrafts, setPiDrafts] = useState<Record<string, { value: string; comment: string }>>({});
  const [piSavingKey, setPiSavingKey] = useState<string | null>(null);

  const flashAssign = useCallback((text: string, tone: FlashTone = 'success') => {
    setAssignMsg(text);
    setAssignMsgTone(tone);
  }, []);

  const flashPi = useCallback((text: string, tone: FlashTone = 'success') => {
    setPiMsg(text);
    setPiMsgTone(tone);
  }, []);

  const flashModal = useCallback((text: string, tone: FlashTone = 'success') => {
    setModalFlash({ text, tone });
  }, []);

  // Auto-dismiss success + info (keep errors until dismissed)
  useEffect(() => {
    if (!assignMsg || (assignMsgTone !== 'success' && assignMsgTone !== 'info')) return;
    const t = window.setTimeout(() => setAssignMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [assignMsg, assignMsgTone]);

  useEffect(() => {
    if (!piMsg || (piMsgTone !== 'success' && piMsgTone !== 'info')) return;
    const t = window.setTimeout(() => setPiMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [piMsg, piMsgTone]);

  useEffect(() => {
    if (!modalFlash || (modalFlash.tone !== 'success' && modalFlash.tone !== 'info')) return;
    const t = window.setTimeout(() => setModalFlash(null), 3500);
    return () => window.clearTimeout(t);
  }, [modalFlash]);

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
    try {
      const params = period ? `?period=${encodeURIComponent(period)}` : '';
      const res = await axios.get(`/api/sds/hod/indicator-reports${params}`);
      setPiPeriod(String(res.data?.period || ''));
      setPiPeriods(Array.isArray(res.data?.available_periods) ? res.data.available_periods.map(String) : []);
      setPiCatalog(Array.isArray(res.data?.catalog) ? res.data.catalog : []);
      setPiReports(Array.isArray(res.data?.reports) ? res.data.reports : []);
      const drafts: Record<string, { value: string; comment: string }> = {};
      for (const r of (res.data?.reports || []) as PiReport[]) {
        const key = `${r.output_id || 0}::${r.indicator_text}`;
        drafts[key] = { value: r.value_text || '', comment: r.comment || '' };
      }
      setPiDrafts(drafts);
    } catch {
      flashPi('Could not load PI reporting catalog', 'danger');
    } finally {
      setPiLoading(false);
    }
  }, [flashPi]);

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
  }, [tab, loadPi]);

  const reportByKey = useMemo(() => {
    const map = new Map<string, PiReport>();
    for (const r of piReports) map.set(`${r.output_id || 0}::${r.indicator_text}`, r);
    return map;
  }, [piReports]);

  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) =>
      s.full_name.toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q),
    );
  }, [staff, staffSearch]);

  const assignedCountByActivity = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of activityAssignments) {
      map.set(a.activity_id, (map.get(a.activity_id) || 0) + 1);
    }
    return map;
  }, [activityAssignments]);

  const loadAssignmentsForDetail = useCallback(async (standard?: SdsDetail | null) => {
    if (!standard?.outputs?.length) {
      setActivityAssignments([]);
      return;
    }
    try {
      const res = await axios.get('/api/sds/hod?mode=assignments');
      const rows = (Array.isArray(res.data?.assignments) ? res.data.assignments : []) as ActivityAssignment[];
      const activityIds = new Set(
        standard.outputs.flatMap((o) => (o.activities || []).map((a) => a.id)),
      );
      setActivityAssignments(
        rows
          .filter((r) => activityIds.has(Number(r.activity_id)))
          .map((r) => ({
            assignment_id: Number(r.assignment_id),
            activity_id: Number(r.activity_id),
            staff_user_id: Number(r.staff_user_id),
            staff_name: String(r.staff_name || 'Staff'),
            staff_email: r.staff_email,
            target_date: r.target_date,
          })),
      );
    } catch {
      setActivityAssignments([]);
    }
  }, []);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await axios.get(`/api/sds/standards/${id}`);
      const data = res.data as SdsDetail;
      setDetail(data);
      await loadAssignmentsForDetail(data);
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
    setStaffSearch('');
    setTargetDate(suggestDate(activity.duration_days));
    setModalFlash(null);
  };

  const openViewAssigned = async (activity: SdsActivity) => {
    setViewAssignedActivity(activity);
    setAssignedLoading(true);
    setModalFlash(null);
    try {
      const res = await axios.get(`/api/sds/hod?mode=assignments&activityId=${activity.id}`);
      const rows = (Array.isArray(res.data?.assignments) ? res.data.assignments : []) as ActivityAssignment[];
      const mapped = rows.map((r) => ({
        assignment_id: Number(r.assignment_id),
        activity_id: Number(r.activity_id),
        staff_user_id: Number(r.staff_user_id),
        staff_name: String(r.staff_name || 'Staff'),
        staff_email: r.staff_email,
        target_date: r.target_date,
      }));
      setActivityAssignments((prev) => {
        const others = prev.filter((a) => a.activity_id !== activity.id);
        return [...others, ...mapped];
      });
      if (!mapped.length) {
        flashModal('No staff assigned to this activity yet.', 'info');
      }
    } catch {
      flashModal('Could not load assigned staff', 'danger');
    } finally {
      setAssignedLoading(false);
    }
  };

  const deassignStaff = async (assignmentId: number, staffName: string) => {
    setConfirmDialog({
      title: 'Deassign staff',
      body: `Remove ${staffName} from this activity?`,
      confirmLabel: 'Deassign',
      danger: true,
      run: async () => {
        setDeassigningId(assignmentId);
        try {
          await axios.patch('/api/sds/hod', { assignment_id: assignmentId, action: 'cancel' });
          setActivityAssignments((prev) => prev.filter((a) => a.assignment_id !== assignmentId));
          flashModal(`${staffName} deassigned.`, 'success');
          flashAssign(`${staffName} deassigned.`, 'success');
        } catch (e: unknown) {
          const msg = axios.isAxiosError(e) ? e.response?.data?.message || 'Deassign failed' : 'Deassign failed';
          flashModal(msg, 'danger');
        } finally {
          setDeassigningId(null);
        }
      },
    });
  };

  const submitAssign = async () => {
    if (!assignActivity || !selectedStaffIds.length) return;
    const count = selectedStaffIds.length;
    const activityName = assignActivity.activity_name;
    const activityId = assignActivity.id;
    const staffIds = [...selectedStaffIds];
    const date = targetDate || null;
    setConfirmDialog({
      title: 'Confirm assignment',
      body: `Assign ${count} staff member${count === 1 ? '' : 's'} to “${activityName}”?`,
      confirmLabel: 'Assign',
      run: async () => {
        setAssigning(true);
        setModalFlash(null);
        try {
          const res = await axios.post('/api/sds/hod', {
            activity_id: activityId,
            staff_user_ids: staffIds,
            target_date: date,
          });
          const created = Number(res.data?.created ?? count);
          const message = created > 0
            ? `Assigned to ${created} staff member${created === 1 ? '' : 's'}.`
            : 'No new assignments (staff may already be assigned).';
          flashAssign(message, created > 0 ? 'success' : 'info');
          setAssignActivity(null);
          if (detail) await loadAssignmentsForDetail(detail);
        } catch (e: unknown) {
          const msg = axios.isAxiosError(e) ? e.response?.data?.message || 'Assign failed' : 'Assign failed';
          flashModal(msg, 'danger');
        } finally {
          setAssigning(false);
        }
      },
    });
  };

  const savePiRow = async (
    item: PiCatalogItem,
    indicatorText: string,
    draft: { value: string; comment: string },
    key: string,
  ) => {
    if (!indicatorText.trim()) {
      flashPi('Enter an indicator description first', 'warning');
      return;
    }
    setPiSavingKey(key);
    try {
      await axios.post('/api/sds/hod/indicator-reports', {
        standard_id: item.standard_id,
        output_id: item.output_id,
        indicator_text: indicatorText.trim(),
        value_text: draft.value,
        comment: draft.comment || null,
        reporting_period: piPeriod,
      });
      flashPi('Performance indicator saved.', 'success');
      await loadPi(piPeriod);
    } catch (e: unknown) {
      flashPi(axios.isAxiosError(e) ? e.response?.data?.message || 'Save failed' : 'Save failed', 'danger');
    } finally {
      setPiSavingKey(null);
    }
  };

  return (
    <div className="container-fluid py-3">
      <h4 className="fw-bold mb-1" style={{ color: 'var(--mubs-blue)' }}>Service Delivery Standards</h4>
      <p className="text-muted small mb-3">
        Assign process activities to staff, and report performance indicators for your unit.
      </p>
      {error && (
        <FlashAlert text={error} tone="danger" onDismiss={() => setError(null)} className="py-2 small" />
      )}
      {assignMsg && tab === 'assign' && (
        <FlashAlert text={assignMsg} tone={assignMsgTone} onDismiss={() => setAssignMsg(null)} className="py-2 small" />
      )}
      {piMsg && tab === 'pi' && (
        <FlashAlert text={piMsg} tone={piMsgTone} onDismiss={() => setPiMsg(null)} className="py-2 small" />
      )}

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
                <Form.Select
                  size="sm"
                  value={piPeriod}
                  onChange={(e) => setPiPeriod(e.target.value)}
                  style={{ minWidth: 140 }}
                >
                  {piPeriods.map((period) => <option key={period} value={period}>{period}</option>)}
                </Form.Select>
              </div>
              <Button size="sm" variant="outline-primary" onClick={() => void loadPi(piPeriod)}>
                Reload
              </Button>
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
                      <ExpandableSdsText label="Standard (quality)" text={o.quality_standard} />
                    </div>
                  )}
                  <div className="mt-2">
                    <div className="small fw-bold mb-1">Assign Process Activities</div>
                    {(o.activities || []).map((a) => {
                      const assignedN = assignedCountByActivity.get(a.id) || 0;
                      return (
                      <div key={a.id} className="d-flex justify-content-between align-items-center gap-2 border-bottom py-2">
                        <div>
                          <span className="small fw-semibold">{a.sequence_no}. {a.activity_name}</span>
                          {a.duration_text ? <Badge bg="light" className="text-dark border ms-2">{a.duration_text}</Badge> : null}
                          {assignedN > 0 ? (
                            <Badge bg="info" className="ms-2">{assignedN} assigned</Badge>
                          ) : null}
                        </div>
                        <div className="d-flex gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => void openViewAssigned(a)}
                          >
                            View assigned
                          </Button>
                          <Button size="sm" variant="primary" style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }} onClick={() => openAssign(a)}>
                            Assign
                          </Button>
                        </div>
                      </div>
                      );
                    })}
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
          {modalFlash && assignActivity && (
            <FlashAlert
              text={modalFlash.text}
              tone={modalFlash.tone}
              onDismiss={() => setModalFlash(null)}
            />
          )}
          {assignActivity && (
            <>
              <div className="fw-semibold small mb-2">{assignActivity.activity_name}</div>
              <Form.Label className="small fw-bold">Search staff</Form.Label>
              <Form.Control
                size="sm"
                className="mb-2"
                placeholder="Type a name or email…"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />
              <Form.Label className="small fw-bold">Staff (select one or more)</Form.Label>
              <div className="border rounded-2 p-2 mb-2" style={{ maxHeight: 220, overflow: 'auto' }}>
                {filteredStaff.map((s) => (
                  <label key={s.id} className="d-flex gap-2 small mb-1">
                    <input
                      type="checkbox"
                      checked={selectedStaffIds.includes(s.id)}
                      onChange={() => setSelectedStaffIds((prev) =>
                        prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                      )}
                    />
                    <span>
                      {s.full_name}
                      {s.email ? <span className="text-muted"> — {s.email}</span> : null}
                    </span>
                  </label>
                ))}
                {!staff.length && <div className="text-muted small">No staff found in your department.</div>}
                {!!staff.length && !filteredStaff.length && (
                  <div className="text-muted small">No staff match “{staffSearch}”.</div>
                )}
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

      <Modal show={!!viewAssignedActivity} onHide={() => setViewAssignedActivity(null)} centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">Assigned staff</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalFlash && viewAssignedActivity && (
            <FlashAlert
              text={modalFlash.text}
              tone={modalFlash.tone}
              onDismiss={() => setModalFlash(null)}
            />
          )}
          {viewAssignedActivity && (
            <>
              <div className="fw-semibold small mb-2">{viewAssignedActivity.activity_name}</div>
              {assignedLoading ? (
                <div className="text-center py-3"><Spinner size="sm" /></div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {activityAssignments
                    .filter((a) => a.activity_id === viewAssignedActivity.id)
                    .map((a) => (
                      <div key={a.assignment_id} className="d-flex justify-content-between align-items-center border rounded-2 px-2 py-2">
                        <div className="small">
                          <div className="fw-semibold">{a.staff_name}</div>
                          {a.staff_email ? <div className="text-muted" style={{ fontSize: '0.72rem' }}>{a.staff_email}</div> : null}
                          {a.target_date ? <div className="text-muted" style={{ fontSize: '0.72rem' }}>Target: {String(a.target_date).slice(0, 10)}</div> : null}
                        </div>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          title="Deassign"
                          disabled={deassigningId === a.assignment_id}
                          onClick={() => void deassignStaff(a.assignment_id, a.staff_name)}
                          style={{ lineHeight: 1, width: 32, height: 32, padding: 0 }}
                        >
                          {deassigningId === a.assignment_id ? '…' : '×'}
                        </Button>
                      </div>
                    ))}
                  {!activityAssignments.some((a) => a.activity_id === viewAssignedActivity.id) && (
                    <div className="text-muted small py-2">No staff assigned to this activity yet.</div>
                  )}
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="outline-secondary" onClick={() => setViewAssignedActivity(null)}>Close</Button>
          <Button
            size="sm"
            variant="primary"
            style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
            onClick={() => {
              if (viewAssignedActivity) {
                const act = viewAssignedActivity;
                setViewAssignedActivity(null);
                openAssign(act);
              }
            }}
          >
            Assign more
          </Button>
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
    </div>
  );
}
