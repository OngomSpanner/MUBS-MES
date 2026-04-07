'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import StatCard from '@/components/StatCard';

type Activity = {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  progress: number;
  start_date?: string | null;
  end_date?: string | null;
  unit_name?: string | null;
  assigned_staff?: number;
  pending_submissions?: number;
};

type ActivityData = {
  activities: Activity[];
  stats: { total: number; onTrack: number; inProgress: number; delayed: number };
};

export default function DepartmentalActivities() {
  const router = useRouter();
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Activity | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [departmentUsers, setDepartmentUsers] = useState<{ id: number; full_name: string; position: string | null }[]>([]);

  // Create task modal — departmental-only (no strategic parent link)
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [createAssigneeIds, setCreateAssigneeIds] = useState<number[]>([]);
  const [createSaving, setCreateSaving] = useState(false);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const [showStaffSearchResults, setShowStaffSearchResults] = useState(false);

  const fetchActivities = useCallback(async () => {
    const res = await axios.get('/api/department-head/departmental-activities', {
      params: { _: Date.now() },
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    setData(res.data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await fetchActivities();
        setError(null);
      } catch (e: any) {
        console.error('Error fetching departmental activities:', e);
        setError(e.response?.data?.message || 'Failed to load departmental activities.');
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchActivities]);

  useEffect(() => {
    // Needed for assigning staff in create modal
    (async () => {
      try {
        const res = await axios.get('/api/users/department');
        setDepartmentUsers(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error('Failed to fetch department users:', e);
        setDepartmentUsers([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!showCreateTaskModal) return;
    setCreateTitle('');
    setCreateDescription('');
    setCreateStartDate('');
    setCreateEndDate('');
    setCreateAssigneeIds([]);
    setCreateSaving(false);
    setStaffSearchTerm('');
    setShowStaffSearchResults(false);
  }, [showCreateTaskModal]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = data?.activities || [];
    if (!term) return list;
    return list.filter((a) => (a.title || '').toLowerCase().includes(term));
  }, [data?.activities, q]);

  const staffSearchResults = useMemo(() => {
    const term = staffSearchTerm.trim().toLowerCase();
    if (!term) return [];
    const pool = departmentUsers.filter((u) => !createAssigneeIds.includes(u.id));
    return pool
      .filter((u) => {
        const name = (u.full_name || '').toLowerCase();
        const pos = (u.position || '').toLowerCase();
        return name.includes(term) || pos.includes(term);
      })
      .slice(0, 10);
  }, [departmentUsers, createAssigneeIds, staffSearchTerm]);

  const handleCreateDepartmentTask = useCallback(async () => {
    if (!createTitle.trim() || !createEndDate.trim()) return;
    if (createAssigneeIds.length === 0) return;
    setCreateSaving(true);
    try {
      await axios.post('/api/department-head/tasks', {
        title: createTitle.trim(),
        description: createDescription || '',
        start_date: createStartDate || null,
        end_date: createEndDate,
        assigned_to_ids: createAssigneeIds,
        task_type: 'process',
        frequency: 'once',
        frequency_interval: 1,
      });
      setShowCreateTaskModal(false);
      await fetchActivities();
    } catch (e: any) {
      console.error('Create task failed:', e);
      alert(e.response?.data?.message || 'Could not create task.');
    } finally {
      setCreateSaving(false);
    }
  }, [
    createTitle,
    createDescription,
    createStartDate,
    createEndDate,
    createAssigneeIds,
    fetchActivities,
  ]);

  const addStaffToAssign = useCallback((id: number) => {
    setCreateAssigneeIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setStaffSearchTerm('');
    setShowStaffSearchResults(false);
  }, []);

  const removeStaffFromAssign = useCallback((id: number) => {
    setCreateAssigneeIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const clearAssignees = useCallback(() => {
    setCreateAssigneeIds([]);
    setStaffSearchTerm('');
    setShowStaffSearchResults(false);
  }, []);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'TBD';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  if (error) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3 p-4" role="alert">
          <span className="material-symbols-outlined fs-2 text-danger">error</span>
          <div>
            <h5 className="alert-heading text-danger fw-bold mb-1">Error Loading Departmental Activities</h5>
            <p className="mb-0 text-dark opacity-75">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div id="page-departmental-activities" className="page-section active-page">
      <div className="row g-4 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard icon="apartment" label="Departmental Activities" value={data.stats.total} badge="Operational" badgeIcon="info" color="blue" />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard icon="check_circle" label="On track" value={data.stats.onTrack} badge="Done" badgeIcon="done_all" color="green" />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard icon="pending" label="In progress" value={data.stats.inProgress} badge="Active" badgeIcon="trending_up" color="yellow" />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard icon="warning" label="Delayed" value={data.stats.delayed} badge="Requires action" badgeIcon="priority_high" color="red" />
        </div>
      </div>

      <div className="table-card p-0 overflow-hidden" style={{ borderRadius: '20px', border: '1px solid #e2e8f0' }}>
        <div className="table-card-header d-flex justify-content-between align-items-center p-4" style={{ background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h5 className="mb-0 fw-bold d-flex align-items-center gap-2" style={{ color: 'var(--mubs-navy)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>apartment</span>
              Departmental Activities
            </h5>
            <div className="text-muted small d-flex align-items-center gap-1 mt-1">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>layers</span>
              Not linked to strategic plan
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 fw-bold shadow-sm"
              style={{ fontSize: '.75rem', background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)', borderRadius: '10px', whiteSpace: 'nowrap' }}
              onClick={() => setShowCreateTaskModal(true)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              Create task
            </button>
            <div className="input-group input-group-sm" style={{ width: '260px' }}>
              <span className="input-group-text bg-light border-0" style={{ borderRadius: '10px 0 0 10px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
              </span>
              <input
                className="form-control bg-light border-0"
                style={{ borderRadius: '0 10px 10px 0' }}
                placeholder="Search activity…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary fw-bold d-inline-flex align-items-center gap-1"
              style={{ borderRadius: '10px', fontSize: '.75rem' }}
              onClick={() => router.push('/department-head?pg=tasks')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>checklist</span>
              Go to processes
            </button>
          </div>
        </div>

        <div className="table-responsive bg-white">
          <table className="table mb-0 align-middle">
            <thead className="bg-light">
              <tr>
                <th className="ps-4">Activity</th>
                <th>Due</th>
                <th>Status</th>
                <th>Progress</th>
                <th className="pe-4 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted">
                    <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '40px', opacity: 0.3 }}>inbox</span>
                    No departmental activities found.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="ps-4">
                      <div className="fw-bold text-dark" style={{ fontSize: '.88rem' }}>{a.title}</div>
                      <div className="text-muted" style={{ fontSize: '.72rem' }}>
                        {a.unit_name || '—'}{(a.assigned_staff ?? 0) > 0 ? ` · ${a.assigned_staff} assigned` : ''}{(a.pending_submissions ?? 0) > 0 ? ` · ${a.pending_submissions} pending` : ''}
                      </div>
                    </td>
                    <td style={{ fontSize: '.82rem' }}>{formatDate(a.end_date)}</td>
                    <td>
                      <span className="status-badge" style={{
                        background: a.status === 'On Track' ? '#dcfce7' : (a.status === 'In Progress' ? '#fef9c3' : (a.status === 'Delayed' ? '#fee2e2' : '#f1f5f9')),
                        color: a.status === 'On Track' ? '#15803d' : (a.status === 'In Progress' ? '#a16207' : (a.status === 'Delayed' ? '#b91c1c' : '#475569')),
                        fontSize: '0.7rem'
                      }}>{a.status}</span>
                    </td>
                    <td style={{ minWidth: '140px' }}>
                      <div className="d-flex align-items-center gap-2">
                        <div className="progress w-100" style={{ height: '6px', borderRadius: '10px' }}>
                          <div className="progress-bar" style={{
                            width: `${a.progress ?? 0}%`,
                            background: (a.progress ?? 0) > 70 ? '#10b981' : ((a.progress ?? 0) > 30 ? '#f59e0b' : '#3b82f6'),
                            borderRadius: '10px'
                          }} />
                        </div>
                        <span className="small fw-normal text-dark" style={{ fontSize: '.75rem' }}>{a.progress ?? 0}%</span>
                      </div>
                    </td>
                    <td className="pe-4 text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 fw-bold"
                        style={{ fontSize: '.75rem', borderRadius: '10px' }}
                        onClick={() => { setSelected(a); setShowModal(true); }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateTaskModal && (
        <div
          className="modal-backdrop fade show"
          style={{ zIndex: 1047, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(3px)' }}
          onClick={() => !createSaving && setShowCreateTaskModal(false)}
        />
      )}
      <div
        className={`modal fade ${showCreateTaskModal ? 'show d-block' : ''}`}
        tabIndex={-1}
        style={{ zIndex: 1048 }}
        aria-hidden={!showCreateTaskModal}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '560px' }}>
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
            <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
              <h6 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 mb-0" style={{ fontSize: '1.05rem' }}>
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>add_task</span>
                Create task (departmental)
              </h6>
              <button type="button" className="btn-close" onClick={() => setShowCreateTaskModal(false)} disabled={createSaving} aria-label="Close" />
            </div>
            <div className="modal-body px-4 pt-3 pb-3">
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label small fw-bold text-muted mb-1">Title</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    disabled={createSaving}
                    placeholder="e.g. Prepare departmental report"
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-bold text-muted mb-1">Description (optional)</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={3}
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    disabled={createSaving}
                    placeholder="Short instructions for staff…"
                    style={{ resize: 'none' }}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-muted mb-1">Start date (optional)</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={createStartDate}
                    onChange={(e) => setCreateStartDate(e.target.value)}
                    disabled={createSaving}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-muted mb-1">End date <span className="text-danger">*</span></label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={createEndDate}
                    onChange={(e) => setCreateEndDate(e.target.value)}
                    disabled={createSaving}
                    required
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-bold text-muted mb-1">Assign to staff <span className="text-danger">*</span></label>
                  <div className="d-flex align-items-center gap-2">
                    <div className="position-relative flex-grow-1">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search staff by name or position…"
                        value={staffSearchTerm}
                        onChange={(e) => {
                          setStaffSearchTerm(e.target.value);
                          setShowStaffSearchResults(true);
                        }}
                        onFocus={() => setShowStaffSearchResults(true)}
                        disabled={createSaving}
                      />
                      {showStaffSearchResults && staffSearchResults.length > 0 && (
                        <div
                          className="position-absolute w-100 bg-white border shadow-sm mt-1 rounded"
                          style={{ zIndex: 2, maxHeight: '220px', overflowY: 'auto' }}
                        >
                          {staffSearchResults.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              className="btn btn-link text-start w-100 px-3 py-2"
                              style={{ textDecoration: 'none', color: '#0f172a' }}
                              onClick={() => addStaffToAssign(u.id)}
                              disabled={createSaving}
                            >
                              <div className="fw-semibold" style={{ fontSize: '.85rem' }}>{u.full_name}</div>
                              <div className="text-muted" style={{ fontSize: '.72rem' }}>{u.position || '—'}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary fw-bold"
                      style={{ fontSize: '.75rem', borderRadius: '10px', whiteSpace: 'nowrap' }}
                      onClick={clearAssignees}
                      disabled={createSaving || createAssigneeIds.length === 0}
                      title="Clear selected staff"
                    >
                      Clear
                    </button>
                  </div>

                  {createAssigneeIds.length > 0 && (
                    <div className="mt-2 d-flex flex-wrap gap-1">
                      {createAssigneeIds.map((id) => {
                        const u = departmentUsers.find((x) => x.id === id);
                        return (
                          <span
                            key={id}
                            className="badge d-inline-flex align-items-center gap-1"
                            style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.72rem', fontWeight: 600 }}
                            title={u?.position ? `${u.full_name} — ${u.position}` : u?.full_name}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>person</span>
                            {u?.full_name || `Staff #${id}`}
                            <button
                              type="button"
                              className="btn-close p-0 ms-1"
                              style={{ fontSize: '7px', opacity: 0.7 }}
                              onClick={() => removeStaffFromAssign(id)}
                              disabled={createSaving}
                            />
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer bg-light border-top-0 py-3 px-4 d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-sm btn-light border fw-bold px-3"
                style={{ fontSize: '0.8rem', borderRadius: '10px' }}
                onClick={() => setShowCreateTaskModal(false)}
                disabled={createSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary fw-bold px-3 shadow-sm d-inline-flex align-items-center gap-2"
                style={{ fontSize: '0.8rem', borderRadius: '10px', background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                onClick={handleCreateDepartmentTask}
                disabled={createSaving || !createTitle.trim() || !createEndDate.trim() || createAssigneeIds.length === 0}
              >
                {createSaving ? (
                  <span className="spinner-border spinner-border-sm" style={{ width: '14px', height: '14px' }} />
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
                )}
                {createSaving ? 'Creating…' : 'Create & assign'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className={`modal fade ${showModal ? 'show d-block' : ''}`} tabIndex={-1} style={{ backgroundColor: showModal ? 'rgba(15, 23, 42, 0.6)' : 'transparent', zIndex: 1050, backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>apartment</span>
                  Departmental Activity
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <div className="modal-body p-4 pt-3">
                <h4 className="fw-bold mb-2 text-primary" style={{ fontSize: '1.15rem' }}>{selected.title}</h4>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <span className="status-badge" style={{
                    background: selected.status === 'On Track' ? '#dcfce7' : (selected.status === 'In Progress' ? '#fef9c3' : (selected.status === 'Delayed' ? '#fee2e2' : '#f1f5f9')),
                    color: selected.status === 'On Track' ? '#15803d' : (selected.status === 'In Progress' ? '#a16207' : (selected.status === 'Delayed' ? '#b91c1c' : '#475569')),
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    borderRadius: '6px'
                  }}>{selected.status}</span>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>Due {formatDate(selected.end_date)}</span>
                </div>
                {String(selected.description || '').trim() ? (
                  <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <p className="mb-0 text-secondary" style={{ fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {String(selected.description || '').trim()}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="modal-footer border-top-0 p-4 pt-0 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary fw-bold"
                  style={{ borderRadius: '10px', fontSize: '.8rem' }}
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary fw-bold d-inline-flex align-items-center gap-2"
                  style={{ borderRadius: '10px', fontSize: '.8rem', background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                  onClick={() => {
                    setShowModal(false);
                    router.push(`/department-head?pg=tasks&mode=table&activity=${encodeURIComponent('Department task')}&activityId=${encodeURIComponent(String(selected.id))}`);
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>checklist</span>
                  Open processes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

