'use client';

import { useMemo, useState } from 'react';
import { Badge } from 'react-bootstrap';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import SearchableSelect from '@/components/ActionTracker/SearchableSelect';

export type ReportItem = {
  id: number;
  team_id: number;
  team_name: string;
  meeting_id: number | null;
  meeting_title: string | null;
  meeting_date: string | null;
  minute_no: string | null;
  title: string;
  assignee_name: string | null;
  office_name: string | null;
  deadline: string | null;
  status: string;
  sds_assignment_id: number | null;
};

export type ReportMeeting = {
  id: number;
  team_id?: number;
  title: string;
  meeting_date: string;
  team_name?: string;
};

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
};

const COLORS = {
  not_started: '#94a3b8',
  in_progress: '#005696',
  done: '#10b981',
  overdue: '#dc3545',
};

function ymd(v: string | null | undefined) {
  return v ? String(v).slice(0, 10) : '';
}

function isOverdue(item: ReportItem, today: string) {
  if (item.status === 'done' || !item.deadline) return false;
  return ymd(item.deadline) < today;
}

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

export default function ActionTrackerReports({
  items,
  meetings,
  teams,
}: {
  items: ReportItem[];
  meetings: ReportMeeting[];
  teams: { id: number; name: string }[];
}) {
  const [teamFilter, setTeamFilter] = useState('');
  const [meetingFilter, setMeetingFilter] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (teamFilter && String(i.team_id) !== teamFilter) return false;
      if (meetingFilter && String(i.meeting_id || '') !== meetingFilter) return false;
      return true;
    });
  }, [items, teamFilter, meetingFilter]);

  const meetingOptions = useMemo(() => {
      const list = teamFilter
      ? meetings.filter((m) => String(m.team_id || '') === teamFilter)
      : meetings;
    return list.map((m) => ({
      value: String(m.id),
      label: `${ymd(m.meeting_date)} · ${m.title}`,
      hint: m.team_name,
    }));
  }, [meetings, teamFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const done = filtered.filter((i) => i.status === 'done').length;
    const progress = filtered.filter((i) => i.status === 'in_progress').length;
    const notStarted = filtered.filter((i) => i.status === 'not_started').length;
    const overdue = filtered.filter((i) => isOverdue(i, today)).length;
    const onSds = filtered.filter((i) => i.sds_assignment_id).length;
    return { total, done, progress, notStarted, overdue, onSds, completion: pct(done, total), sdsPct: pct(onSds, total) };
  }, [filtered, today]);

  const statusPie = [
    { name: 'Not started', key: 'not_started', value: stats.notStarted, color: COLORS.not_started },
    { name: 'In progress', key: 'in_progress', value: stats.progress, color: COLORS.in_progress },
    { name: 'Done', key: 'done', value: stats.done, color: COLORS.done },
  ].filter((d) => d.value > 0);

  const byOffice = useMemo(() => {
    const map = new Map<string, { office: string; not_started: number; in_progress: number; done: number; overdue: number }>();
    for (const i of filtered) {
      const office = i.office_name || 'Unassigned office';
      const row = map.get(office) || { office, not_started: 0, in_progress: 0, done: 0, overdue: 0 };
      row[i.status as 'not_started' | 'in_progress' | 'done'] += 1;
      if (isOverdue(i, today)) row.overdue += 1;
      map.set(office, row);
    }
    return [...map.values()].sort((a, b) => (b.not_started + b.in_progress + b.done) - (a.not_started + a.in_progress + a.done));
  }, [filtered, today]);

  const byTeam = useMemo(() => {
    const map = new Map<string, { team: string; total: number; done: number; overdue: number }>();
    for (const i of filtered) {
      const team = i.team_name || 'Team';
      const row = map.get(team) || { team, total: 0, done: 0, overdue: 0 };
      row.total += 1;
      if (i.status === 'done') row.done += 1;
      if (isOverdue(i, today)) row.overdue += 1;
      map.set(team, row);
    }
    return [...map.values()].map((r) => ({ ...r, completion: pct(r.done, r.total) }));
  }, [filtered, today]);

  const byMeeting = useMemo(() => {
    const map = new Map<string, { meeting: string; date: string; total: number; done: number; progress: number; not_started: number }>();
    for (const i of filtered) {
      const key = i.meeting_id ? String(i.meeting_id) : 'none';
      const meeting = i.meeting_title || 'No meeting linked';
      const row = map.get(key) || { meeting, date: ymd(i.meeting_date), total: 0, done: 0, progress: 0, not_started: 0 };
      row.total += 1;
      if (i.status === 'done') row.done += 1;
      else if (i.status === 'in_progress') row.progress += 1;
      else row.not_started += 1;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [filtered]);

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-3" style={{ maxWidth: 720 }}>
        <div style={{ minWidth: 240, flex: 1 }}>
          <SearchableSelect
            value={teamFilter}
            onChange={(v) => { setTeamFilter(v); setMeetingFilter(''); }}
            options={teams.map((t) => ({ value: String(t.id), label: t.name }))}
            placeholder="All teams / committees"
            emptyLabel="All teams"
          />
        </div>
        <div style={{ minWidth: 280, flex: 1 }}>
          <SearchableSelect
            value={meetingFilter}
            onChange={setMeetingFilter}
            options={meetingOptions}
            placeholder="All meetings"
            emptyLabel="All meetings"
          />
        </div>
      </div>

      <div className="row g-3 mb-3">
        {[
          { label: 'Actions', value: stats.total, color: 'var(--mubs-blue)' },
          { label: 'Completion', value: `${stats.completion}%`, color: '#10b981' },
          { label: 'In progress', value: stats.progress, color: '#005696' },
          { label: 'Overdue', value: stats.overdue, color: '#dc3545' },
          { label: 'On SDS', value: `${stats.onSds} (${stats.sdsPct}%)`, color: '#7c3aed' },
        ].map((card) => (
          <div className="col-6 col-md" key={card.label}>
            <div className="border rounded-3 bg-white p-3 h-100" style={{ borderLeft: `4px solid ${card.color}` }}>
              <div className="text-muted small">{card.label}</div>
              <div className="fw-bold fs-4">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="border rounded-3 bg-white p-3 h-100">
            <div className="fw-semibold mb-2">Status mix</div>
            {statusPie.length === 0 ? (
              <div className="text-muted small py-4 text-center">No actions in this view.</div>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {statusPie.map((d) => <Cell key={d.key} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="small text-muted text-center">
              {stats.notStarted} not started · {stats.progress} in progress · {stats.done} done
            </div>
          </div>
        </div>
        <div className="col-md-8">
          <div className="border rounded-3 bg-white p-3 h-100">
            <div className="fw-semibold mb-2">Completion by team</div>
            {byTeam.length === 0 ? (
              <div className="text-muted small py-4 text-center">No team data yet.</div>
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={byTeam} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="team" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" name="Actions" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="done" name="Done" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="overdue" name="Overdue" fill="#dc3545" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded-3 bg-white p-3 mb-3">
        <div className="fw-semibold mb-2">Actions by office</div>
        {byOffice.length === 0 ? (
          <div className="text-muted small py-4 text-center">No office data yet.</div>
        ) : (
          <div style={{ height: Math.max(260, byOffice.length * 36) }}>
            <ResponsiveContainer>
              <BarChart data={byOffice} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="office" width={150} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="not_started" name="Not started" stackId="a" fill={COLORS.not_started} />
                <Bar dataKey="in_progress" name="In progress" stackId="a" fill={COLORS.in_progress} />
                <Bar dataKey="done" name="Done" stackId="a" fill={COLORS.done} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="border rounded-3 bg-white mb-3">
        <div className="p-3 fw-semibold border-bottom">Per meeting</div>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
            <thead className="table-light">
              <tr>
                <th>Meeting</th>
                <th>Date</th>
                <th>Actions</th>
                <th>Done</th>
                <th>In progress</th>
                <th>Not started</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              {byMeeting.map((m) => (
                <tr key={`${m.meeting}-${m.date}`}>
                  <td>{m.meeting}</td>
                  <td>{m.date || '—'}</td>
                  <td>{m.total}</td>
                  <td>{m.done}</td>
                  <td>{m.progress}</td>
                  <td>{m.not_started}</td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="progress flex-grow-1" style={{ height: 8 }}>
                        <div className="progress-bar bg-success" style={{ width: `${pct(m.done, m.total)}%` }} />
                      </div>
                      <span className="small">{pct(m.done, m.total)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {byMeeting.length === 0 ? (
                <tr><td colSpan={7} className="text-muted small py-4 text-center">No meetings in this view.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border rounded-3 bg-white">
        <div className="p-3 fw-semibold border-bottom">Action detail</div>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.82rem' }}>
            <thead className="table-light">
              <tr>
                <th>Minute</th>
                <th>Action</th>
                <th>Team</th>
                <th>Office</th>
                <th>Responsible</th>
                <th>Deadline</th>
                <th>Status</th>
                <th>SDS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className={isOverdue(i, today) ? 'table-danger' : undefined}>
                  <td className="text-muted">{i.minute_no || '—'}</td>
                  <td>
                    <div>{i.title}</div>
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>{i.meeting_title || ''}</div>
                  </td>
                  <td>{i.team_name}</td>
                  <td>{i.office_name || '—'}</td>
                  <td>{i.assignee_name || '—'}</td>
                  <td>{ymd(i.deadline) || '—'}</td>
                  <td>
                    <Badge bg={i.status === 'done' ? 'success' : i.status === 'in_progress' ? 'primary' : 'secondary'}>
                      {STATUS_LABEL[i.status] || i.status}
                    </Badge>
                    {isOverdue(i, today) ? <div className="small text-danger">Overdue</div> : null}
                  </td>
                  <td>{i.sds_assignment_id ? 'Yes' : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-muted small py-4 text-center">No actions match these filters.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
