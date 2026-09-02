'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Badge, Button, Form, Modal, Spinner } from 'react-bootstrap';
import * as XLSX from 'xlsx';
import ReportsSectionHeader from '@/components/Reports/ReportsSectionHeader';
import SearchableSelect from '@/components/ActionTracker/SearchableSelect';
import PeopleSearchSelect from '@/components/ActionTracker/PeopleSearchSelect';
import ActionTrackerReports from '@/components/ActionTracker/ActionTrackerReports';
import ActionMeetingsList from '@/components/ActionTracker/ActionMeetingsList';

type Portal = 'admin' | 'hod' | 'staff';
type Team = {
  id: number;
  name: string;
  kind: string;
  department_id: number | null;
  department_name: string | null;
  description: string | null;
  auto_sds: number;
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
type Meeting = {
  id: number;
  team_id?: number;
  title: string;
  meeting_date: string;
  venue: string | null;
  team_name?: string;
};
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

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
};

function ymd(v: string | null | undefined) {
  return v ? String(v).slice(0, 10) : '';
}

export default function ActionTrackerPanel({ portal }: { portal: Portal }) {
  const [tab, setTab] = useState<'actions' | 'teams' | 'mine' | 'reports'>(portal === 'staff' ? 'mine' : 'actions');
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<number>(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [mine, setMine] = useState<Item[]>([]);
  const [reportItems, setReportItems] = useState<Item[]>([]);
  const [reportMeetings, setReportMeetings] = useState<Meeting[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
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
  const [actionToSds, setActionToSds] = useState(true);
  const [openMeetingKey, setOpenMeetingKey] = useState<string | null>(null);
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
    const nextMeetings = (g.data.meetings || []) as Meeting[];
    if (nextMeetings[0]?.id) {
      setOpenMeetingKey((prev) => prev || `m-${nextMeetings[0].id}`);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await loadTeams();
      const preferred = list.find((t) => t.name === 'Development Committee')?.id;
      const nextId = teamId || preferred || list[0]?.id || 0;
      if (!teamId && nextId) setTeamId(nextId);
      await loadTeamDetail(nextId);
      if (portal === 'staff' || portal === 'hod') {
        const mineRes = await axios.get('/api/action-tracker/items', { params: { mine: '1' } });
        setMine(mineRes.data.items || []);
      }
      const [allItems, allMeetings] = await Promise.all([
        axios.get('/api/action-tracker/items'),
        axios.get('/api/action-tracker/meetings'),
      ]);
      setReportItems(allItems.data.items || []);
      setReportMeetings(allMeetings.data.meetings || []);
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
    if (tab === 'mine') {
      const first = mine.find((i) => i.meeting_id);
      if (first?.meeting_id) setOpenMeetingKey(`m-${first.meeting_id}`);
      else if (mine.length) setOpenMeetingKey('unlinked');
    }
  }, [tab, mine]);

  useEffect(() => {
    void axios.get('/api/departments?active_only=1').then((r) => {
      const rows = Array.isArray(r.data) ? r.data : [];
      setDepts(rows.map((d: { id: number; name: string }) => ({ id: Number(d.id), name: String(d.name) })));
    }).catch(() => undefined);
  }, []);

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

  const officeOptions = useMemo(() => {
    const fromMembers = members
      .filter((m) => m.department_id)
      .map((m) => ({
        value: String(m.department_id),
        label: `${m.seat_label}${m.full_name ? ` · ${m.full_name}` : ''}`,
      }));
    const seen = new Set(fromMembers.map((o) => o.value));
    const fromDepts = depts
      .filter((d) => !seen.has(String(d.id)))
      .map((d) => ({ value: String(d.id), label: d.name }));
    return [...fromMembers, ...fromDepts];
  }, [members, depts]);

  const memberPeople = useMemo(
    () => members.filter((m) => m.user_id).map((m) => ({
      value: String(m.user_id),
      label: `${m.full_name} (${m.seat_label})`,
    })),
    [members],
  );

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
      setOpenMeetingKey(null);
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
        to_sds: actionToSds,
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

  const openAssign = (meetingId: number | null) => {
    setActionMeeting(meetingId ? String(meetingId) : (meetings[0]?.id ? String(meetings[0].id) : ''));
    setActionToSds(Boolean(selected?.auto_sds ?? 1));
    setShowAction(true);
  };

  const saveAutoSds = async (enabled: boolean) => {
    if (!selected) return;
    setTeams((prev) => prev.map((t) => (t.id === selected.id ? { ...t, auto_sds: enabled ? 1 : 0 } : t)));
    try {
      await axios.patch('/api/action-tracker/teams', { id: selected.id, auto_sds: enabled ? 1 : 0 });
    } catch (e: unknown) {
      setTeams((prev) => prev.map((t) => (t.id === selected.id ? { ...t, auto_sds: enabled ? 0 : 1 } : t)));
      alert(axios.isAxiosError(e) ? e.response?.data?.message : 'Could not save SDS setting');
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
        description="Actions sit under each meeting so you can open one sitting at a time. Search units and people the same way as elsewhere in the system. SDS copy is a setting on the committee — automatic, or only when you tick it on an action."
        filters={(
          <>
            {portal !== 'staff' ? (
              <div style={{ width: 280 }}>
                <SearchableSelect
                  value={teamId ? String(teamId) : ''}
                  onChange={(v) => {
                    const id = Number(v || 0);
                    setTeamId(id);
                    setOpenMeetingKey(null);
                    void loadTeamDetail(id);
                  }}
                  options={teams.map((t) => ({ value: String(t.id), label: t.name, hint: t.kind }))}
                  placeholder="Search committees / teams"
                  emptyLabel="Select team"
                  allowEmpty={teams.length === 0}
                />
              </div>
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

      <div className="d-flex flex-wrap gap-2 mb-3 border-bottom pb-3">
        {portal !== 'staff' ? (
          <Button size="sm" className="d-flex align-items-center gap-1" variant={tab === 'actions' ? 'primary' : 'outline-secondary'} style={tab === 'actions' ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined} onClick={() => setTab('actions')}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>event_note</span>
            Meetings
          </Button>
        ) : null}
        {portal !== 'staff' ? (
          <Button size="sm" className="d-flex align-items-center gap-1" variant={tab === 'teams' ? 'primary' : 'outline-secondary'} style={tab === 'teams' ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined} onClick={() => setTab('teams')}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>groups</span>
            Members
          </Button>
        ) : null}
        <Button size="sm" className="d-flex align-items-center gap-1" variant={tab === 'mine' ? 'primary' : 'outline-secondary'} style={tab === 'mine' ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined} onClick={() => setTab('mine')}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>person</span>
          My actions
        </Button>
        <Button size="sm" className="d-flex align-items-center gap-1" variant={tab === 'reports' ? 'primary' : 'outline-secondary'} style={tab === 'reports' ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined} onClick={() => setTab('reports')}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>monitoring</span>
          Reports
        </Button>
        <span className="small text-muted align-self-center ms-2">
          {counts.notStarted} not started · {counts.progress} in progress · {counts.done} done
        </span>
      </div>

      {tab === 'teams' && selected ? (
        <div className="d-flex flex-column gap-3">
          <div className="border rounded-3 p-3 bg-white">
            <div className="fw-semibold mb-1 d-flex align-items-center gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>settings</span>
              SDS setting
            </div>
            <p className="small text-muted mb-2">
              When this is on, assigning an action also creates an SDS activity for that staff member. Turn it off to keep actions in Action Tracker only, then add SDS on individual actions if needed.
            </p>
            <Form.Check
              type="switch"
              id="auto-sds-switch"
              label={selected.auto_sds ? 'Automatically add assigned actions to SDS' : 'Do not add to SDS automatically'}
              checked={Boolean(selected.auto_sds)}
              onChange={(e) => void saveAutoSds(e.target.checked)}
            />
          </div>
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
        </div>
      ) : null}

      {tab === 'reports' ? (
        <ActionTrackerReports
          items={portal === 'staff' ? mine : reportItems}
          meetings={reportMeetings}
          teams={teams}
        />
      ) : null}

      {(tab === 'actions' || tab === 'mine') ? (
        <div>
          {tab === 'actions' ? (
            <div className="d-flex flex-wrap gap-2 mb-3">
              <Button size="sm" variant="outline-primary" onClick={() => setShowMeeting(true)} disabled={!teamId}>
                <span className="material-symbols-outlined me-1" style={{ fontSize: 16, verticalAlign: 'middle' }}>event</span>
                Record meeting
              </Button>
              <Button size="sm" onClick={() => openAssign(meetings[0]?.id ?? null)} disabled={!teamId} style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}>
                <span className="material-symbols-outlined me-1" style={{ fontSize: 16, verticalAlign: 'middle' }}>add</span>
                Assign action
              </Button>
            </div>
          ) : null}
          <ActionMeetingsList
            meetings={tab === 'mine'
              ? Array.from(new Map(list.filter((i) => i.meeting_id).map((i) => [i.meeting_id as number, { id: i.meeting_id as number, title: i.meeting_title || 'Meeting', meeting_date: i.meeting_date || '' }])).values())
              : meetings}
            items={list}
            openMeetingKey={openMeetingKey}
            onOpenMeeting={(key) => setOpenMeetingKey(key || null)}
            canManage={tab === 'actions'}
            onAssign={tab === 'actions' ? openAssign : undefined}
            onUpdate={(i) => {
              setUpdateItem(i as Item);
              setUpdateStatus(i.status === 'not_started' ? 'in_progress' : i.status);
              setUpdateNote(i.progress_note || '');
            }}
            onCopySds={tab === 'actions' ? (i) => void copySds(i as Item) : undefined}
          />
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
              <SearchableSelect
                value={teamDept}
                onChange={setTeamDept}
                options={depts.map((d) => ({ value: String(d.id), label: d.name }))}
                placeholder="Search unit"
                emptyLabel="Select unit"
              />
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
            <SearchableSelect
              value={memberDept}
              onChange={(v) => { setMemberDept(v); setMemberUser(''); }}
              options={depts.map((d) => ({ value: String(d.id), label: d.name }))}
              placeholder="Search unit"
              emptyLabel="Select unit"
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Person representing that office</Form.Label>
            <PeopleSearchSelect
              value={memberUser}
              onChange={setMemberUser}
              departmentId={memberDept}
              placeholder="Search person"
            />
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
            <SearchableSelect
              value={actionMeeting}
              onChange={setActionMeeting}
              options={meetings.map((m) => ({ value: String(m.id), label: `${ymd(m.meeting_date)} · ${m.title}` }))}
              placeholder="Search meeting"
              emptyLabel="None"
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Office responsible</Form.Label>
            <SearchableSelect
              value={actionOffice}
              onChange={(v) => { setActionOffice(v); setActionUser(''); }}
              options={officeOptions}
              placeholder="Search office or unit"
              emptyLabel="Select office"
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Person responsible</Form.Label>
            <PeopleSearchSelect
              value={actionUser}
              onChange={setActionUser}
              departmentId={actionOffice}
              extraOptions={memberPeople}
              placeholder="Search person"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label className="small">Deadline</Form.Label>
            <Form.Control size="sm" type="date" value={actionDeadline} onChange={(e) => setActionDeadline(e.target.value)} />
          </Form.Group>
          <Form.Check
            className="mt-3"
            type="switch"
            id="action-to-sds"
            label="Add this action to SDS for the assigned person"
            checked={actionToSds}
            onChange={(e) => setActionToSds(e.target.checked)}
          />
          <div className="small text-muted mt-1">
            {selected?.auto_sds
              ? 'This committee currently adds assigned actions to SDS automatically. Turn the switch off to keep this action in Action Tracker only.'
              : 'This committee does not add to SDS automatically. Turn the switch on to create an SDS activity for this person.'}
          </div>
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
