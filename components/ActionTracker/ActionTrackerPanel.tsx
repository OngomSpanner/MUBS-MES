'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Badge, Button, Form, Modal, Spinner } from 'react-bootstrap';
import * as XLSX from 'xlsx';
import ReportsSectionHeader from '@/components/Reports/ReportsSectionHeader';

type Portal = 'admin' | 'hod' | 'staff';
type Team = {
  id: number;
  name: string;
  kind: string;
  department_id: number | null;
  department_name: string | null;
  description: string | null;
  member_count: number;
  action_count: number;
  done_count: number;
};
type Member = {
  id: number;
  seat_label: string;
  department_id: number | null;
  department_name: string | null;
  user_id: number | null;
  full_name: string | null;
  email: string | null;
  is_secretariat: number;
};
type Meeting = { id: number; title: string; meeting_date: string; venue: string | null };
type Item = {
  id: number;
  team_id: number;
  meeting_id: number | null;
  minute_no: string | null;
  title: string;
  assignee_user_id: number | null;
  assignee_name: string | null;
  office_department_id: number | null;
  office_name: string | null;
  deadline: string | null;
  status: string;
  progress_note: string | null;
  sds_assignment_id: number | null;
  team_name: string;
  meeting_title: string | null;
  meeting_date: string | null;
};
type Dept = { id: number; name: string };
type Person = { id: number; full_name: string; email: string; department_id: number | null };

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
};

function statusBadge(status: string) {
  if (status === 'done') return 'success';
  if (status === 'in_progress') return 'primary';
  return 'secondary';
}

function ymd(v: string | null | undefined) {
  return v ? String(v).slice(0, 10) : '';
}

export default function ActionTrackerPanel({ portal }: { portal: Portal }) {
  const [tab, setTab] = useState<'actions' | 'teams' | 'mine'>(portal === 'staff' ? 'mine' : 'actions');
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<number>(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [mine, setMine] = useState<Item[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canCreateCommittee, setCanCreateCommittee] = useState(false);
  const [canCreateDepartmental, setCanCreateDepartmental] = useState(false);

  const [showTeam, setShowTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamKind, setTeamKind] = useState('committee');
  const [teamDept, setTeamDept] = useState('');

  const [showMember, setShowMember] = useState(false);
  const [seat, setSeat] = useState('');
  const [memberDept, setMemberDept] = useState('');
  const [memberUser, setMemberUser] = useState('');
  const [editingMember, setEditingMember] = useState<number | null>(null);
  const [isSecretariat, setIsSecretariat] = useState(false);

  const [showMeeting, setShowMeeting] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');

  const [showAction, setShowAction] = useState(false);
  const [minuteNo, setMinuteNo] = useState('');
  const [actionTitle, setActionTitle] = useState('');
  const [actionMeeting, setActionMeeting] = useState('');
  const [actionUser, setActionUser] = useState('');
  const [actionOffice, setActionOffice] = useState('');
  const [actionDeadline, setActionDeadline] = useState('');
  const [updateItem, setUpdateItem] = useState<Item | null>(null);
  const [updateStatus, setUpdateStatus] = useState('in_progress');
  const [updateNote, setUpdateNote] = useState('');
  const [busy, setBusy] = useState(false);

  const loadTeams = useCallback(async () => {
    const res = await axios.get('/api/action-tracker/teams');
    setTeams(res.data.teams || []);
    setCanCreateCommittee(Boolean(res.data.actor?.canCreateCommittee));
    setCanCreateDepartmental(Boolean(res.data.actor?.canCreateDepartmental));
    return res.data.teams as Team[];
  }, []);

  const loadTeamDetail = useCallback(async (id: number) => {
    if (!id) {
      setMembers([]);
      setMeetings([]);
      setItems([]);
      return;
    }
    const [m, g, i] = await Promise.all([
      axios.get('/api/action-tracker/members', { params: { team_id: id } }),
      axios.get('/api/action-tracker/meetings', { params: { team_id: id } }),
      axios.get('/api/action-tracker/items', { params: { team_id: id } }),
    ]);
    setMembers(m.data.members || []);
    setMeetings(g.data.meetings || []);
    setItems(i.data.items || []);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await loadTeams();
      const nextId = teamId || list[0]?.id || 0;
      if (!teamId && nextId) setTeamId(nextId);
      await loadTeamDetail(nextId);
      if (portal === 'staff' || portal === 'hod') {
        const mineRes = await axios.get('/api/action-tracker/items', { params: { mine: '1' } });
        setMine(mineRes.data.items || []);
      }
    } catch {
      setError('Could not load Action Tracker.');
    } finally {
      setLoading(false);
    }
  }, [loadTeamDetail, loadTeams, portal, teamId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void axios.get('/api/departments?active_only=1').then((r) => {
      const rows = Array.isArray(r.data) ? r.data : [];
      setDepts(rows.map((d: { id: number; name: string }) => ({ id: Number(d.id), name: String(d.name) })));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const dept = memberDept || actionOffice;
    void axios.get('/api/action-tracker/people', { params: dept ? { department_id: dept } : {} }).then((r) => {
      setPeople(r.data.people || []);
    }).catch(() => setPeople([]));
  }, [memberDept, actionOffice]);

  const selected = useMemo(() => teams.find((t) => t.id === teamId) || null, [teams, teamId]);
  const counts = useMemo(() => {
    const list = tab === 'mine' ? mine : items;
    return {
      total: list.length,
      done: list.filter((i) => i.status === 'done').length,
      progress: list.filter((i) => i.status === 'in_progress').length,
      notStarted: list.filter((i) => i.status === 'not_started').length,
    };
  }, [items, mine, tab]);

  const exportReport = () => {
    const rows = items.map((i) => ({
      Committee: i.team_name,
      Meeting: i.meeting_title || '',
      Date: ymd(i.meeting_date),
      'Minute No': i.minute_no || '',
      Action: i.title,
      Office: i.office_name || '',
      Responsible: i.assignee_name || '',
      Deadline: ymd(i.deadline),
      Status: STATUS_LABEL[i.status] || i.status,
      Progress: i.progress_note || '',
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Action report');
    XLSX.writeFile(wb, `${selected?.name || 'action-tracker'}-report.xlsx`);
  };

  const saveTeam = async () => {
    setBusy(true);
    try {
      await axios.post('/api/action-tracker/teams', {
        name: teamName,
        kind: canCreateCommittee ? teamKind : 'departmental',
        department_id: teamDept || null,
      });
      setShowTeam(false);
      setTeamName('');
      await loadTeams();
    } catch (e: unknown) {
      alert(axios.isAxiosError(e) ? e.response?.data?.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const saveMember = async () => {
    setBusy(true);
    try {
      if (editingMember) {
        await axios.patch('/api/action-tracker/members', {
          id: editingMember,
          seat_label: seat,
          department_id: memberDept || null,
          user_id: memberUser || null,
          is_secretariat: isSecretariat,
        });
      } else {
        await axios.post('/api/action-tracker/members', {
          team_id: teamId,
          seat_label: seat,
          department_id: memberDept || null,
          user_id: memberUser || null,
          is_secretariat: isSecretariat,
        });
      }
      setShowMember(false);
      setSeat('');
      setMemberUser('');
      setEditingMember(null);
      await loadTeamDetail(teamId);
    } catch (e: unknown) {
      alert(axios.isAxiosError(e) ? e.response?.data?.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const saveMeeting = async () => {
    setBusy(true);
    try {
      await axios.post('/api/action-tracker/meetings', {
        team_id: teamId,
        title: meetingTitle,
        meeting_date: meetingDate,
      });
      setShowMeeting(false);
      setMeetingTitle('');
      await loadTeamDetail(teamId);
    } catch (e: unknown) {
      alert(axios.isAxiosError(e) ? e.response?.data?.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const saveAction = async () => {
    setBusy(true);
    try {
      await axios.post('/api/action-tracker/items', {
        team_id: teamId,
        meeting_id: actionMeeting || null,
        minute_no: minuteNo,
        title: actionTitle,
        assignee_user_id: actionUser || null,
        office_department_id: actionOffice || null,
        deadline: actionDeadline || null,
      });
      setShowAction(false);
      setActionTitle('');
      setMinuteNo('');
      await loadTeamDetail(teamId);
    } catch (e: unknown) {
      alert(axios.isAxiosError(e) ? e.response?.data?.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const submitUpdate = async () => {
    if (!updateItem) return;
    setBusy(true);
    try {
      await axios.patch(`/api/action-tracker/items/${updateItem.id}`, {
        status: updateStatus,
        progress_note: updateNote,
        comment: updateNote,
      });
      setUpdateItem(null);
      setUpdateNote('');
      await loadTeamDetail(teamId);
      const mineRes = await axios.get('/api/action-tracker/items', { params: { mine: '1' } });
      setMine(mineRes.data.items || []);
    } catch (e: unknown) {
      alert(axios.isAxiosError(e) ? e.response?.data?.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const copySds = async (item: Item) => {
    if (!confirm('Add this action onto SDS for the assigned staff member?')) return;
    try {
      await axios.patch(`/api/action-tracker/items/${item.id}`, { to_sds: true });
      await loadTeamDetail(teamId);
    } catch (e: unknown) {
      alert(axios.isAxiosError(e) ? e.response?.data?.message : 'Could not copy to SDS');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" size="sm" className="text-primary" />
      </div>
    );
  }

  const list = tab === 'mine' ? mine : items;

  return (
    <div>
      <ReportsSectionHeader
        icon="groups"
        title="Action Tracker"
        count={counts.total}
        description="Track actions from committees, unit meetings and teams. Strategy sets up school committees. Heads of units can create their own meeting teams and assign actions. Assigned people get a notification and email. Done / in progress / not started is updated on the action. You can copy an action onto SDS for that staff member."
        filters={(
          <>
            {portal !== 'staff' ? (
              <Form.Select size="sm" value={teamId} onChange={(e) => { const id = Number(e.target.value); setTeamId(id); void loadTeamDetail(id); }} style={{ width: 260 }}>
                {teams.length === 0 ? <option value={0}>No teams yet</option> : null}
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Form.Select>
            ) : null}
            {(canCreateCommittee || canCreateDepartmental) && portal !== 'staff' ? (
              <Button size="sm" variant="outline-primary" onClick={() => setShowTeam(true)}>New team</Button>
            ) : null}
            {portal !== 'staff' ? (
              <Button size="sm" variant="outline-secondary" onClick={exportReport} disabled={!items.length}>Export report</Button>
            ) : null}
          </>
        )}
      />

      {error ? <div className="alert alert-danger py-2 small">{error}</div> : null}

      <div className="d-flex flex-wrap gap-2 mb-3">
        {portal !== 'staff' ? (
          <Button size="sm" variant={tab === 'actions' ? 'primary' : 'outline-secondary'} onClick={() => setTab('actions')}>Actions</Button>
        ) : null}
        {portal !== 'staff' ? (
          <Button size="sm" variant={tab === 'teams' ? 'primary' : 'outline-secondary'} onClick={() => setTab('teams')}>Members</Button>
        ) : null}
        <Button size="sm" variant={tab === 'mine' ? 'primary' : 'outline-secondary'} onClick={() => setTab('mine')}>My actions</Button>
        <span className="small text-muted align-self-center ms-2">
          {counts.notStarted} not started · {counts.progress} in progress · {counts.done} done
        </span>
      </div>

      {tab === 'teams' && selected ? (
        <div className="border rounded-3 p-3 bg-white">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div>
              <div className="fw-semibold">{selected.name}</div>
              <div className="small text-muted">{selected.kind} {selected.department_name ? `· ${selected.department_name}` : ''}</div>
            </div>
            <Button size="sm" onClick={() => { setEditingMember(null); setSeat(''); setShowMember(true); }}>Add member</Button>
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead className="table-light"><tr><th>Office / seat</th><th>Unit</th><th>Person</th><th /></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.seat_label}{m.is_secretariat ? <Badge bg="info" className="ms-1">Secretariat</Badge> : null}</td>
                    <td className="text-muted">{m.department_name || '—'}</td>
                    <td>{m.full_name || <span className="text-muted">Not linked yet</span>}</td>
                    <td className="text-end">
                      <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => {
                        setEditingMember(m.id);
                        setSeat(m.seat_label);
                        setMemberDept(m.department_id ? String(m.department_id) : '');
                        setMemberUser(m.user_id ? String(m.user_id) : '');
                        setIsSecretariat(Boolean(m.is_secretariat));
                        setShowMember(true);
                      }}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {(tab === 'actions' || tab === 'mine') ? (
        <div className="border rounded-3 bg-white">
          {tab === 'actions' ? (
            <div className="p-2 d-flex gap-2 border-bottom">
              <Button size="sm" variant="outline-primary" onClick={() => setShowMeeting(true)} disabled={!teamId}>Record meeting</Button>
              <Button size="sm" variant="primary" onClick={() => setShowAction(true)} disabled={!teamId}>Assign action</Button>
            </div>
          ) : null}
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.82rem' }}>
              <thead className="table-light">
                <tr>
                  <th>Minute</th>
                  <th>Action</th>
                  <th>Office</th>
                  <th>Responsible</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id}>
                    <td className="text-muted">{i.minute_no || '—'}</td>
                    <td>
                      <div className="fw-semibold">{i.title}</div>
                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>{i.team_name}{i.meeting_title ? ` · ${i.meeting_title}` : ''}</div>
                      {i.progress_note ? <div className="text-muted mt-1">{i.progress_note}</div> : null}
                    </td>
                    <td>{i.office_name || '—'}</td>
                    <td>{i.assignee_name || '—'}</td>
                    <td>{ymd(i.deadline) || '—'}</td>
                    <td>
                      <Badge bg={statusBadge(i.status)}>{STATUS_LABEL[i.status] || i.status}</Badge>
                      {i.sds_assignment_id ? <div className="small text-muted">On SDS</div> : null}
                    </td>
                    <td className="text-nowrap text-end">
                      <Button size="sm" variant="outline-primary" className="me-1" onClick={() => {
                        setUpdateItem(i);
                        setUpdateStatus(i.status === 'not_started' ? 'in_progress' : i.status);
                        setUpdateNote(i.progress_note || '');
                      }}>Update</Button>
                      {tab === 'actions' && !i.sds_assignment_id ? (
                        <Button size="sm" variant="outline-secondary" onClick={() => void copySds(i)}>To SDS</Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {list.length === 0 ? (
                  <tr><td colSpan={7} className="text-muted small py-4 text-center">No actions yet. Record a meeting and assign actions.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Modal show={showTeam} onHide={() => setShowTeam(false)} centered>
        <Modal.Header closeButton><Modal.Title className="fs-6">New team or committee</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label className="small">Name</Form.Label>
            <Form.Control size="sm" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Faculty Board, Estates weekly meeting" />
          </Form.Group>
          {canCreateCommittee ? (
            <Form.Group className="mb-2">
              <Form.Label className="small">Type</Form.Label>
              <Form.Select size="sm" value={teamKind} onChange={(e) => setTeamKind(e.target.value)}>
                <option value="committee">School committee</option>
                <option value="departmental">Unit / departmental meeting</option>
                <option value="adhoc">Ad hoc team</option>
              </Form.Select>
            </Form.Group>
          ) : null}
          {teamKind === 'departmental' || !canCreateCommittee ? (
            <Form.Group>
              <Form.Label className="small">Unit</Form.Label>
              <Form.Select size="sm" value={teamDept} onChange={(e) => setTeamDept(e.target.value)}>
                <option value="">Select unit</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Form.Select>
            </Form.Group>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowTeam(false)}>Cancel</Button>
          <Button disabled={busy || !teamName.trim()} onClick={() => void saveTeam()}>Save</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showMember} onHide={() => setShowMember(false)} centered>
        <Modal.Header closeButton><Modal.Title className="fs-6">{editingMember ? 'Edit member' : 'Add member'}</Modal.Title></Modal.Header>
        <Modal.Body>
          <p className="small text-muted">Pick the office first, then the person who represents that office.</p>
          <Form.Group className="mb-2">
            <Form.Label className="small">Office / seat</Form.Label>
            <Form.Control size="sm" value={seat} onChange={(e) => setSeat(e.target.value)} placeholder="e.g. Estates, PDU, Principal" />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Unit in the system</Form.Label>
            <Form.Select size="sm" value={memberDept} onChange={(e) => setMemberDept(e.target.value)}>
              <option value="">Select unit</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Person representing that office</Form.Label>
            <Form.Select size="sm" value={memberUser} onChange={(e) => setMemberUser(e.target.value)}>
              <option value="">Select person</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Check type="checkbox" label="Secretariat" checked={isSecretariat} onChange={(e) => setIsSecretariat(e.target.checked)} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowMember(false)}>Cancel</Button>
          <Button disabled={busy || !seat.trim()} onClick={() => void saveMember()}>Save</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showMeeting} onHide={() => setShowMeeting(false)} centered>
        <Modal.Header closeButton><Modal.Title className="fs-6">Record meeting</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label className="small">Title</Form.Label>
            <Form.Control size="sm" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="e.g. 48th Development Committee" />
          </Form.Group>
          <Form.Group>
            <Form.Label className="small">Date</Form.Label>
            <Form.Control size="sm" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowMeeting(false)}>Cancel</Button>
          <Button disabled={busy || !meetingTitle.trim() || !meetingDate} onClick={() => void saveMeeting()}>Save</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showAction} onHide={() => setShowAction(false)} centered>
        <Modal.Header closeButton><Modal.Title className="fs-6">Assign action</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label className="small">Minute no.</Form.Label>
            <Form.Control size="sm" value={minuteNo} onChange={(e) => setMinuteNo(e.target.value)} placeholder="e.g. Min48/4.0" />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Action required</Form.Label>
            <Form.Control size="sm" as="textarea" rows={2} value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Meeting</Form.Label>
            <Form.Select size="sm" value={actionMeeting} onChange={(e) => setActionMeeting(e.target.value)}>
              <option value="">None</option>
              {meetings.map((m) => <option key={m.id} value={m.id}>{ymd(m.meeting_date)} · {m.title}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Office responsible</Form.Label>
            <Form.Select size="sm" value={actionOffice} onChange={(e) => setActionOffice(e.target.value)}>
              <option value="">Select office</option>
              {members.filter((m) => m.department_id).map((m) => (
                <option key={m.id} value={m.department_id || ''}>
                  {m.seat_label}{m.full_name ? ` · ${m.full_name}` : ''}
                </option>
              ))}
              {depts.map((d) => <option key={`d-${d.id}`} value={d.id}>{d.name}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Person responsible</Form.Label>
            <Form.Select size="sm" value={actionUser} onChange={(e) => setActionUser(e.target.value)}>
              <option value="">Select person</option>
              {members.filter((m) => m.user_id).map((m) => (
                <option key={m.id} value={m.user_id || ''}>{m.full_name} ({m.seat_label})</option>
              ))}
              {people.map((p) => <option key={`p-${p.id}`} value={p.id}>{p.full_name}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small">Deadline</Form.Label>
            <Form.Control size="sm" type="date" value={actionDeadline} onChange={(e) => setActionDeadline(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowAction(false)}>Cancel</Button>
          <Button disabled={busy || !actionTitle.trim()} onClick={() => void saveAction()}>Assign</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!updateItem} onHide={() => setUpdateItem(null)} centered>
        <Modal.Header closeButton><Modal.Title className="fs-6">Update progress</Modal.Title></Modal.Header>
        <Modal.Body>
          <p className="small">{updateItem?.title}</p>
          <Form.Group className="mb-2">
            <Form.Label className="small">Status</Form.Label>
            <Form.Select size="sm" value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value)}>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small">Progress / feedback</Form.Label>
            <Form.Control size="sm" as="textarea" rows={3} value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setUpdateItem(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void submitUpdate()}>Save</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
