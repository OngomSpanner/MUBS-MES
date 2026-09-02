'use client';

import { Badge, Button } from 'react-bootstrap';

export type MeetingLite = {
  id: number;
  title: string;
  meeting_date: string;
  venue?: string | null;
};

export type ActionLite = {
  id: number;
  meeting_id: number | null;
  meeting_title: string | null;
  meeting_date: string | null;
  minute_no: string | null;
  title: string;
  assignee_name: string | null;
  office_name: string | null;
  deadline: string | null;
  status: string;
  progress_note: string | null;
  sds_assignment_id: number | null;
  team_name: string;
};

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

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

type Group = {
  key: string;
  meetingId: number | null;
  title: string;
  date: string;
  items: ActionLite[];
};

function buildGroups(meetings: MeetingLite[], items: ActionLite[]): Group[] {
  const byMeeting = new Map<number, ActionLite[]>();
  const unlinked: ActionLite[] = [];
  for (const item of items) {
    if (item.meeting_id) {
      const list = byMeeting.get(item.meeting_id) || [];
      list.push(item);
      byMeeting.set(item.meeting_id, list);
    } else {
      unlinked.push(item);
    }
  }

  const groups: Group[] = meetings
    .slice()
    .sort((a, b) => ymd(b.meeting_date).localeCompare(ymd(a.meeting_date)))
    .map((m) => ({
      key: `m-${m.id}`,
      meetingId: m.id,
      title: m.title,
      date: ymd(m.meeting_date),
      items: byMeeting.get(m.id) || [],
    }));

  for (const [id, list] of byMeeting) {
    if (groups.some((g) => g.meetingId === id)) continue;
    groups.push({
      key: `m-${id}`,
      meetingId: id,
      title: list[0]?.meeting_title || 'Meeting',
      date: ymd(list[0]?.meeting_date),
      items: list,
    });
  }

  if (unlinked.length) {
    groups.push({
      key: 'unlinked',
      meetingId: null,
      title: 'Not linked to a meeting',
      date: '',
      items: unlinked,
    });
  }
  return groups;
}

function ActionTable({
  items,
  canManage,
  onUpdate,
  onCopySds,
}: {
  items: ActionLite[];
  canManage: boolean;
  onUpdate: (item: ActionLite) => void;
  onCopySds?: (item: ActionLite) => void;
}) {
  if (items.length === 0) {
    return <div className="text-muted small px-3 py-3">No actions recorded for this meeting yet.</div>;
  }
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.82rem' }}>
        <thead className="table-light">
          <tr>
            <th style={{ width: 110 }}>Minute</th>
            <th>Action</th>
            <th>Office</th>
            <th>Responsible</th>
            <th>Deadline</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td className="text-muted">{i.minute_no || '—'}</td>
              <td>
                <div className="fw-semibold">{i.title}</div>
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
                <Button
                  size="sm"
                  variant="outline-primary"
                  className="me-1"
                  onClick={() => onUpdate(i)}
                >
                  Update
                </Button>
                {canManage && onCopySds && !i.sds_assignment_id ? (
                  <Button size="sm" variant="outline-secondary" onClick={() => onCopySds(i)}>
                    Add to SDS
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ActionMeetingsList({
  meetings,
  items,
  openMeetingKey,
  onOpenMeeting,
  canManage,
  onAssign,
  onUpdate,
  onCopySds,
}: {
  meetings: MeetingLite[];
  items: ActionLite[];
  openMeetingKey: string | null;
  onOpenMeeting: (key: string) => void;
  canManage: boolean;
  onAssign?: (meetingId: number | null) => void;
  onUpdate: (item: ActionLite) => void;
  onCopySds?: (item: ActionLite) => void;
}) {
  const groups = buildGroups(meetings, items);

  if (groups.length === 0) {
    return (
      <div className="border rounded-3 bg-white text-muted small py-5 text-center">
        No meetings yet. Record a meeting, then assign actions under it.
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex flex-wrap gap-1 mb-1">
        {groups.map((g) => (
          <button
            key={`chip-${g.key}`}
            type="button"
            className={`btn btn-sm ${openMeetingKey === g.key ? 'btn-primary' : 'btn-outline-secondary'}`}
            style={openMeetingKey === g.key ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined}
            onClick={() => onOpenMeeting(g.key)}
          >
            {g.date ? `${g.date} · ` : ''}
            {g.title.length > 42 ? `${g.title.slice(0, 42)}…` : g.title}
            <Badge bg={openMeetingKey === g.key ? 'light' : 'secondary'} className={openMeetingKey === g.key ? 'text-primary ms-1' : 'ms-1'} style={{ fontSize: '0.62rem' }}>
              {g.items.length}
            </Badge>
          </button>
        ))}
      </div>

      {groups.map((g) => {
        const done = g.items.filter((i) => i.status === 'done').length;
        const progress = g.items.filter((i) => i.status === 'in_progress').length;
        const notStarted = g.items.filter((i) => i.status === 'not_started').length;
        const open = openMeetingKey === g.key;
        return (
          <div key={g.key} className="border rounded-3 bg-white overflow-hidden">
            <button
              type="button"
              className="btn btn-white w-100 text-start px-3 py-3 d-flex align-items-start gap-2"
              onClick={() => onOpenMeeting(open ? '' : g.key)}
            >
              <span className="material-symbols-outlined text-primary mt-1" style={{ fontSize: 22 }}>
                {open ? 'expand_less' : 'expand_more'}
              </span>
              <div className="flex-grow-1">
                <div className="d-flex flex-wrap justify-content-between gap-2">
                  <div>
                    <div className="fw-semibold">{g.title}</div>
                    <div className="small text-muted">
                      {g.date || 'No date'}
                      {g.items.length ? ` · ${g.items.length} action${g.items.length === 1 ? '' : 's'}` : ' · No actions yet'}
                    </div>
                  </div>
                  {g.items.length ? (
                    <div className="small text-muted align-self-center">
                      {notStarted} not started · {progress} in progress · {done} done
                    </div>
                  ) : null}
                </div>
                {g.items.length ? (
                  <div className="progress mt-2" style={{ height: 6 }}>
                    <div className="progress-bar bg-success" style={{ width: `${pct(done, g.items.length)}%` }} />
                    <div className="progress-bar" style={{ width: `${pct(progress, g.items.length)}%`, background: 'var(--mubs-blue)' }} />
                  </div>
                ) : null}
              </div>
            </button>
            {open ? (
              <>
                {canManage && onAssign ? (
                  <div className="px-3 pb-2 d-flex justify-content-end">
                    <Button size="sm" onClick={() => onAssign(g.meetingId)} style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}>
                      <span className="material-symbols-outlined me-1" style={{ fontSize: 16, verticalAlign: 'middle' }}>add</span>
                      Assign action
                    </Button>
                  </div>
                ) : null}
                <ActionTable items={g.items} canManage={canManage} onUpdate={onUpdate} onCopySds={onCopySds} />
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
