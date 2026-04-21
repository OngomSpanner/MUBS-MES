'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

import StatCard from '@/components/StatCard';
import { expandProcessAssignmentsForDisplay } from '@/lib/process-assignment-display';

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
  standard_id?: number | null;
};

type ActivityData = {
  activities: Activity[];
  stats: { total: number; onTrack: number; inProgress: number; delayed: number };
};

function processAssignmentCoversTask(a: {
  staff_id: number | null;
  staff_name: string | null;
  subtasks?: Array<{ assigned_to: number }>;
}): boolean {
  const direct =
    (a.staff_id != null && Number(a.staff_id) > 0) || String(a.staff_name ?? '').trim() !== '';
  if (direct) return true;
  const subs = Array.isArray(a.subtasks) ? a.subtasks : [];
  return subs.length > 0 && subs.every((s) => s.assigned_to != null && Number(s.assigned_to) > 0);
}

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
  const [createBreakdownEnabled, setCreateBreakdownEnabled] = useState(false);
  const [createSubtasks, setCreateSubtasks] = useState<Array<{ title: string; assigned_to: number | '' }>>([]);
  const [createSaving, setCreateSaving] = useState(false);
  const [createFormNotice, setCreateFormNotice] = useState<string | null>(null);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const [showStaffSearchResults, setShowStaffSearchResults] = useState(false);

  type ProcessTask = {
    id: number;
    taskName: string;
    taskOrder: number;
    standard_id: number;
    performance_indicator?: string | null;
  };
  type ProcessAssignment = {
    id: number;
    standard_process_id: number;
    staff_id: number | null;
    section_id?: number | null;
    section_name?: string | null;
    status: string;
    staff_name: string | null;
    start_date?: string | null;
    subtasks?: Array<{
      id: number;
      title: string;
      assigned_to: number;
      assigned_to_name: string;
      status: string;
    }>;
  };
  const [processTasks, setProcessTasks] = useState<ProcessTask[]>([]);
  const [processAssignments, setProcessAssignments] = useState<ProcessAssignment[]>([]);
  const [assigningTask, setAssigningTask] = useState<ProcessTask | null>(null);
  const [assignStaffIds, setAssignStaffIds] = useState<number[]>([]);
  const [assignStaffSearchTerm, setAssignStaffSearchTerm] = useState('');
  const [showAssignStaffSearchResults, setShowAssignStaffSearchResults] = useState(false);
  const [assignBreakdownEnabled, setAssignBreakdownEnabled] = useState(false);
  const [assignSubtasks, setAssignSubtasks] = useState<Array<{ title: string; assigned_to: number | '' }>>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  type AssignSectionOption = {
    id: number;
    name: string;
    department_id: number;
    head_user_id: number | null;
    staff: Array<{ id: number }>;
  };
  const [assignSections, setAssignSections] = useState<AssignSectionOption[]>([]);
  const [assignmentSectionId, setAssignmentSectionId] = useState<number | ''>('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);
  const [processCatalogLoaded, setProcessCatalogLoaded] = useState(false);
  const [showAssignmentsRequiredDialog, setShowAssignmentsRequiredDialog] = useState(false);
  const detailLoadGen = useRef(0);

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
    if (!showAssignModal) return;
    (async () => {
      try {
        const res = await axios.get('/api/department-head/sections');
        const payload = res.data as { sections?: AssignSectionOption[] } | undefined;
        setAssignSections(Array.isArray(payload?.sections) ? payload.sections : []);
      } catch {
        setAssignSections([]);
      }
    })();
  }, [showAssignModal]);

  useEffect(() => {
    if (!showCreateTaskModal) return;
    setCreateTitle('');
    setCreateDescription('');
    setCreateStartDate('');
    setCreateEndDate('');
    setCreateAssigneeIds([]);
    setCreateBreakdownEnabled(false);
    setCreateSubtasks([]);
    setCreateSaving(false);
    setCreateFormNotice(null);
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
    setCreateSaving(true);
    setCreateFormNotice(null);
    try {
      if (createBreakdownEnabled) {
        if (createAssigneeIds.length === 0) {
          setCreateFormNotice('Add at least one staff member, then define sub-tasks and assignees.');
          return;
        }
        const cleaned = createSubtasks
          .map((s) => ({
            title: (s.title || '').trim(),
            assigned_to: s.assigned_to === '' ? null : Number(s.assigned_to),
          }))
          .filter((s) => s.title && s.assigned_to != null);
        if (cleaned.length === 0) {
          setCreateFormNotice('Add at least one sub-task with a title and assignee from your staff list.');
          return;
        }
        for (const row of cleaned) {
          if (!createAssigneeIds.includes(Number(row.assigned_to))) {
            setCreateFormNotice('Each sub-task must be assigned to someone in your selected staff list.');
            return;
          }
        }
        await axios.post('/api/department-head/tasks', {
          title: createTitle.trim(),
          description: createDescription || '',
          start_date: createStartDate || null,
          end_date: createEndDate,
          task_type: 'process',
          frequency: 'once',
          frequency_interval: 1,
          subtasks: cleaned,
        });
      } else {
        if (createAssigneeIds.length !== 1) {
          setCreateFormNotice('Select exactly one staff member, or turn on break down into sub-tasks for multiple staff.');
          return;
        }
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
      }
      setShowCreateTaskModal(false);
      await fetchActivities();
    } catch (e: any) {
      console.error('Create task failed:', e);
      setCreateFormNotice(e.response?.data?.message || 'Could not create task.');
    } finally {
      setCreateSaving(false);
    }
  }, [
    createTitle,
    createDescription,
    createStartDate,
    createEndDate,
    createAssigneeIds,
    createBreakdownEnabled,
    createSubtasks,
    fetchActivities,
  ]);

  const addStaffToAssign = useCallback(
    (id: number) => {
      if (!createBreakdownEnabled && createAssigneeIds.length >= 1 && !createAssigneeIds.includes(id)) {
        setCreateFormNotice('This task is assigned to one person. Turn on break down into sub-tasks to involve multiple staff.');
        return;
      }
      setCreateFormNotice(null);
      setCreateAssigneeIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setStaffSearchTerm('');
      setShowStaffSearchResults(false);
    },
    [createAssigneeIds, createBreakdownEnabled]
  );

  const removeStaffFromAssign = useCallback((id: number) => {
    setCreateAssigneeIds((prev) => prev.filter((x) => x !== id));
    setCreateSubtasks((prev) =>
      prev.map((st) => (st.assigned_to === id ? { ...st, assigned_to: '' as const } : st))
    );
  }, []);

  const clearAssignees = useCallback(() => {
    setCreateAssigneeIds([]);
    setCreateSubtasks([]);
    setStaffSearchTerm('');
    setShowStaffSearchResults(false);
  }, []);

  const fetchProcessTasks = useCallback(async (standardId: number, loadGen?: number) => {
    const mapRow = (p: Record<string, unknown>): ProcessTask => ({
      id: Number(p.id),
      taskName: String(p.step_name ?? p.task_name ?? '').trim() || '—',
      taskOrder: Number(p.step_order) || 0,
      standard_id: Number(p.standard_id),
    });
    try {
      const res = await axios.get('/api/standards');
      const standard = (res.data as any[]).find((s: any) => s.id === standardId);
      const raw = standard?.processes || [];
      const indicator =
        standard?.performance_indicator != null && String(standard.performance_indicator).trim() !== ''
          ? String(standard.performance_indicator)
          : null;

      setProcessTasks(
        raw.map((p: Record<string, unknown>) => ({
          ...mapRow(p),
          performance_indicator: indicator,
        }))
      );
    } catch {
      setProcessTasks([]);
    } finally {
      if (loadGen == null || loadGen === detailLoadGen.current) {
        setProcessCatalogLoaded(true);
      }
    }
  }, []);

  const fetchProcessAssignments = useCallback(async (activityId: number, loadGen?: number) => {
    try {
      const res = await axios.get('/api/department-head/process-assignments');
      setProcessAssignments((res.data as any[]).filter((a: any) => a.activity_id === activityId));
    } catch {
      setProcessAssignments([]);
    } finally {
      if (loadGen == null || loadGen === detailLoadGen.current) {
        setAssignmentsLoaded(true);
      }
    }
  }, []);

  const processDataReady = assignmentsLoaded && processCatalogLoaded;

  const canViewProcesses = useMemo(() => {
    if (!selected || !processDataReady) return false;
    if (!selected.standard_id || processTasks.length === 0) return true;
    for (const t of processTasks) {
      const ok = processAssignments.some(
        (a) => a.standard_process_id === t.id && processAssignmentCoversTask(a)
      );
      if (!ok) return false;
    }
    return true;
  }, [selected, processDataReady, processTasks, processAssignments]);

  useEffect(() => {
    if (processDataReady && canViewProcesses) setShowAssignmentsRequiredDialog(false);
  }, [processDataReady, canViewProcesses]);

  const handleAssignProcessTask = async () => {
    if (!assigningTask || assignStaffIds.length === 0 || !selected) return;
    setAssignSaving(true);
    try {
      const payload: Record<string, unknown> = {
        activity_id: selected.id,
        standard_process_id: assigningTask.id,
        staff_ids: assignStaffIds,
      };
      if (assignmentSectionId !== '') {
        payload.section_id = assignmentSectionId;
      }

      if (assignBreakdownEnabled) {
        const cleaned = assignSubtasks
          .map((s) => ({
            title: (s.title || '').trim(),
            assigned_to: s.assigned_to === '' ? null : Number(s.assigned_to),
          }))
          .filter((s) => s.title && s.assigned_to != null);

        if (cleaned.length === 0) {
          alert('Add at least one sub-task with an assignee.');
          return;
        }

        payload.breakdown = { subtasks: cleaned };
      }

      const { data } = await axios.post('/api/department-head/process-assignments', payload);
      await fetchProcessAssignments(selected.id);
      const created = Number(data?.created) || 0;
      const skippedDup = Number(data?.skippedDuplicate) || 0;
      if (created === 0) {
        alert(data?.message || 'No new assignments (selected staff may already be assigned to this task).');
        return;
      }
      if (skippedDup > 0) {
        alert(`${data?.message || 'Assigned.'}\nSkipped ${skippedDup} (already assigned).`);
      }
      setShowAssignModal(false);
      setAssignStaffIds([]);
      setAssignStaffSearchTerm('');
      setAssignmentSectionId('');
      setAssignBreakdownEnabled(false);
      setAssignSubtasks([]);
      setAssigningTask(null);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Could not save assignment');
    } finally {
      setAssignSaving(false);
    }
  };

  const handleRemoveProcessAssignment = async (assignmentId: number) => {
    if (!confirm('Remove this assignment?')) return;
    try {
      await axios.delete(`/api/department-head/process-assignments/${assignmentId}`);
      if (selected) await fetchProcessAssignments(selected.id);
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' &&
        e !== null &&
        'response' in e &&
        typeof (e as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (e as { response: { data: { message: string } } }).response.data.message
          : 'Could not remove assignment';
      alert(msg);
    }
  };

  const assignPoolUsers = useMemo(() => {
    if (assignmentSectionId === '') return departmentUsers;
    const sec = assignSections.find((s) => s.id === assignmentSectionId);
    if (!sec) return departmentUsers;
    const allowed = new Set<number>();
    for (const m of sec.staff || []) allowed.add(Number(m.id));
    if (sec.head_user_id != null) allowed.add(Number(sec.head_user_id));
    return departmentUsers.filter((u) => allowed.has(u.id));
  }, [departmentUsers, assignSections, assignmentSectionId]);

  const assignPoolFingerprint = useMemo(() => {
    const ids = assignPoolUsers.map((u) => u.id);
    ids.sort((a, b) => a - b);
    return ids.join(',');
  }, [assignPoolUsers]);

  useEffect(() => {
    if (assignmentSectionId === '') {
      const allowed = new Set(assignPoolUsers.map((u) => u.id));
      setAssignStaffIds((prev) => prev.filter((id) => allowed.has(id)));
      return;
    }
    const sec = assignSections.find((s) => s.id === assignmentSectionId);
    if (!sec) return;
    setAssignStaffIds(assignPoolUsers.map((u) => u.id));
  }, [assignmentSectionId, assignSections, assignPoolFingerprint, assignPoolUsers]);

  const assignStaffSearchResults = useMemo(() => {
    const term = assignStaffSearchTerm.trim().toLowerCase();
    const pool = assignPoolUsers.filter((u) => !assignStaffIds.includes(u.id));
    const matches =
      term === ''
        ? pool
        : pool.filter((u) => {
            const name = (u.full_name || '').toLowerCase();
            const pos = (u.position || '').toLowerCase();
            return name.includes(term) || pos.includes(term);
          });
    return matches.slice(0, 10);
  }, [assignPoolUsers, assignStaffIds, assignStaffSearchTerm]);

  const addStaffToProcessAssign = (id: number) => {
    if (!assignStaffIds.includes(id)) setAssignStaffIds((prev) => [...prev, id]);
    setAssignStaffSearchTerm('');
    setShowAssignStaffSearchResults(false);
  };

  const removeStaffFromProcessAssign = (id: number) => {
    setAssignStaffIds((prev) => prev.filter((x) => x !== id));
  };

  const closeActivityDetailModal = useCallback(() => {
    setShowModal(false);
    setShowAssignmentsRequiredDialog(false);
    setProcessTasks([]);
    setProcessAssignments([]);
    setAssignmentsLoaded(false);
    setProcessCatalogLoaded(false);
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
                        onClick={() => {
                          setSelected(a);
                          setShowModal(true);
                          setShowAssignmentsRequiredDialog(false);
                          detailLoadGen.current += 1;
                          const gen = detailLoadGen.current;
                          setAssignmentsLoaded(false);
                          setProcessCatalogLoaded(false);
                          setProcessTasks([]);
                          setProcessAssignments([]);
                          void fetchProcessAssignments(a.id, gen);
                          if (a.standard_id) {
                            void fetchProcessTasks(a.standard_id, gen);
                          } else {
                            setProcessCatalogLoaded(true);
                          }
                        }}
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
        <div
          className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
          style={{ maxWidth: createBreakdownEnabled ? '640px' : '560px' }}
        >
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
            <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
              <h6 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 mb-0" style={{ fontSize: '1.05rem' }}>
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>add_task</span>
                Create task (departmental)
              </h6>
              <button type="button" className="btn-close" onClick={() => setShowCreateTaskModal(false)} disabled={createSaving} aria-label="Close" />
            </div>
            <div className="modal-body px-4 pt-3 pb-3">
              {createFormNotice && (
                <div
                  className="alert alert-warning d-flex align-items-start gap-2 py-2 px-3 mb-3"
                  role="alert"
                  style={{ borderRadius: '10px', fontSize: '.82rem' }}
                >
                  <span className="material-symbols-outlined mt-0" style={{ fontSize: '18px' }}>
                    warning
                  </span>
                  <div className="flex-grow-1">{createFormNotice}</div>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setCreateFormNotice(null)}
                    style={{ fontSize: '.65rem' }}
                  />
                </div>
              )}
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
                  <div className="mb-3 p-3 rounded-3 border" style={{ background: '#ffffff' }}>
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '.9rem' }}>
                          Break down into sub-tasks (optional)
                        </div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          checked={createBreakdownEnabled}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setCreateBreakdownEnabled(on);
                            setCreateFormNotice(null);
                            if (on && createSubtasks.length === 0 && createAssigneeIds.length > 0) {
                              const initial = createAssigneeIds.map((sid) => ({
                                assigned_to: sid,
                                title: `${createTitle.trim() || 'Task'} — ${departmentUsers.find((u) => u.id === sid)?.full_name ?? 'Sub-task'}`,
                              }));
                              setCreateSubtasks(initial);
                            }
                            if (!on) {
                              setCreateSubtasks([]);
                              setCreateAssigneeIds((prev) => prev.slice(0, 1));
                            }
                          }}
                          disabled={createSaving}
                        />
                      </div>
                    </div>

                    {createBreakdownEnabled && (
                      <div className="mt-3 d-flex flex-column gap-2">
                        {createSubtasks.map((st, idx) => (
                          <div key={idx} className="d-flex flex-wrap gap-2 align-items-center">
                            <input
                              className="form-control form-control-sm"
                              style={{ flex: 1, minWidth: 220 }}
                              value={st.title}
                              placeholder={`Sub-task #${idx + 1} title`}
                              onChange={(e) => {
                                const arr = [...createSubtasks];
                                arr[idx] = { ...arr[idx], title: e.target.value };
                                setCreateSubtasks(arr);
                              }}
                              disabled={createSaving}
                            />
                            <select
                              className="form-select form-select-sm"
                              style={{ width: 220 }}
                              value={st.assigned_to === '' ? '' : String(st.assigned_to)}
                              onChange={(e) => {
                                const v = e.target.value;
                                const arr = [...createSubtasks];
                                arr[idx] = { ...arr[idx], assigned_to: v === '' ? '' : Number(v) };
                                setCreateSubtasks(arr);
                              }}
                              disabled={createSaving}
                            >
                              <option value="">Assign to…</option>
                              {createAssigneeIds.map((sid) => {
                                const u = departmentUsers.find((x) => x.id === sid);
                                return (
                                  <option key={sid} value={sid}>
                                    {u?.full_name || `Staff #${sid}`}
                                  </option>
                                );
                              })}
                            </select>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              style={{ fontSize: '.75rem' }}
                              onClick={() => setCreateSubtasks(createSubtasks.filter((_, i) => i !== idx))}
                              disabled={createSaving}
                              title="Remove sub-task"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            style={{ fontSize: '.75rem' }}
                            onClick={() => setCreateSubtasks([...createSubtasks, { title: '', assigned_to: '' }])}
                            disabled={createSaving}
                          >
                            + Add sub-task
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            style={{ fontSize: '.75rem' }}
                            onClick={() => {
                              const t = createTitle.trim() || 'Task';
                              const auto = createAssigneeIds.map((sid) => ({
                                assigned_to: sid,
                                title: `${t} — ${departmentUsers.find((u) => u.id === sid)?.full_name ?? 'Sub-task'}`,
                              }));
                              setCreateSubtasks(auto);
                            }}
                            disabled={createSaving || createAssigneeIds.length === 0}
                          >
                            Auto-split (1 per staff)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label small fw-bold text-muted mb-1">
                    {createBreakdownEnabled ? 'Staff to involve' : 'Assign to staff'}{' '}
                    <span className="text-danger">*</span>
                  </label>
                  {!createBreakdownEnabled ? (
                    <div className="text-muted small mb-2" style={{ fontSize: '.72rem' }}>
                      Select exactly one person responsible for this task.
                    </div>
                  ) : (
                    <div className="text-muted small mb-2" style={{ fontSize: '.72rem' }}>
                      Add everyone who will own a sub-task, then define sub-tasks above (each assignee must be in this list).
                    </div>
                  )}
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
                disabled={
                  createSaving ||
                  !createTitle.trim() ||
                  !createEndDate.trim() ||
                  (createBreakdownEnabled
                    ? createAssigneeIds.length === 0 ||
                      !createSubtasks.some(
                        (s) =>
                          s.title.trim() &&
                          typeof s.assigned_to === 'number' &&
                          s.assigned_to > 0
                      )
                    : createAssigneeIds.length !== 1)
                }
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
        <div
          className={`modal fade ${showModal ? 'show d-block' : ''}`}
          tabIndex={-1}
          style={{
            backgroundColor: showModal ? 'rgba(15, 23, 42, 0.6)' : 'transparent',
            zIndex: 1050,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>
                    visibility
                  </span>
                  Activity Details
                </h5>
                <button type="button" className="btn-close" onClick={closeActivityDetailModal} />
              </div>
              <div className="modal-body p-4 pt-3">
                <div className="row g-4">
                  <div className="col-12 border-bottom pb-3">
                    <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start">
                      <div className="text-muted small fw-medium" style={{ fontSize: '0.85rem' }}>
                        {selected.unit_name || 'Department'}
                      </div>
                      <div className="text-dark fw-semibold text-end" style={{ fontSize: '0.9rem' }}>
                        {selected.title}
                      </div>
                    </div>
                    <h4 className="fw-bold mb-2 text-primary mt-2" style={{ fontSize: '1.15rem' }}>
                      {selected.title}
                    </h4>
                    <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
                      <span
                        className="status-badge"
                        style={{
                          background:
                            selected.status === 'On Track'
                              ? '#dcfce7'
                              : selected.status === 'In Progress'
                                ? '#fef9c3'
                                : selected.status === 'Delayed'
                                  ? '#fee2e2'
                                  : '#f1f5f9',
                          color:
                            selected.status === 'On Track'
                              ? '#15803d'
                              : selected.status === 'In Progress'
                                ? '#a16207'
                                : selected.status === 'Delayed'
                                  ? '#b91c1c'
                                  : '#475569',
                          fontSize: '0.75rem',
                          padding: '4px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        {selected.status}
                      </span>
                      <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                        Due {formatDate(selected.end_date)}
                      </span>
                    </div>
                  </div>
                  <div className="col-12 mt-1">
                    <label
                      className="text-muted fw-bold mb-1 d-block"
                      style={{ fontSize: '0.7rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}
                    >
                      Performance
                    </label>
                    <div className="d-flex align-items-center gap-3">
                      <div className="progress flex-grow-1" style={{ height: '8px', borderRadius: '4px' }}>
                        <div
                          className="progress-bar bg-primary"
                          role="progressbar"
                          style={{ width: `${selected.progress ?? 0}%` }}
                        />
                      </div>
                      <span className="fw-bold text-primary" style={{ fontSize: '1rem' }}>
                        {selected.progress ?? 0}%
                      </span>
                    </div>
                  </div>
                  <div className="col-12 mt-2">
                    <label
                      className="text-muted fw-bold mb-1 d-block"
                      style={{ fontSize: '0.7rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}
                    >
                      Objectives
                    </label>
                    <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <p className="mb-0 text-secondary fw-medium" style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                        {String(selected.description || '').trim() || '—'}
                      </p>
                    </div>
                  </div>

                  {processTasks.length > 0 && (
                    <div className="col-12 mt-2 border-top pt-3">
                      <label
                        className="text-muted fw-bold mb-2 d-block"
                        style={{ fontSize: '0.7rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}
                      >
                        Process tasks
                      </label>
                      <div className="d-flex flex-column gap-2">
                        {processTasks.map((task, idx) => {
                          const taskAssignments = processAssignments.filter((a) => a.standard_process_id === task.id);
                          const assignmentIsOpen = (a: ProcessAssignment) =>
                            a.start_date != null && String(a.start_date).trim() !== '';
                          const assignmentIsTerminal = (a: ProcessAssignment) => {
                            const t = String(a.status ?? '').toLowerCase().trim();
                            return t === 'evaluated' || t === 'completed';
                          };
                          const subtaskIsTerminal = (st: { status?: string | null }) => {
                            const t = String(st?.status ?? '').toLowerCase().trim();
                            return t === 'evaluated' || t === 'completed';
                          };
                          const containerAssignmentFullyDone = (a: ProcessAssignment) => {
                            const hasStaff = String(a.staff_name ?? '').trim() !== '';
                            if (hasStaff) return assignmentIsTerminal(a);
                            const subs = Array.isArray(a.subtasks) ? a.subtasks : [];
                            if (subs.length === 0) return assignmentIsTerminal(a);
                            return subs.every(subtaskIsTerminal);
                          };
                          const hideAssign =
                            taskAssignments.length > 0 &&
                            (taskAssignments.some(assignmentIsOpen) ||
                              taskAssignments.some(containerAssignmentFullyDone));
                          return (
                            <div
                              key={task.id}
                              className="p-2 rounded border"
                              style={{ background: '#f8fafc', fontSize: '0.82rem' }}
                            >
                              <div className="d-flex align-items-start justify-content-between gap-2">
                                <div className="d-flex align-items-start gap-2">
                                  <span
                                    className="badge bg-primary-subtle text-primary fw-bold"
                                    style={{ minWidth: '22px', fontSize: '0.7rem' }}
                                  >
                                    {idx + 1}
                                  </span>
                                  <span className="text-dark fw-medium">{task.taskName}</span>
                                </div>
                                {!hideAssign ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm d-flex align-items-center gap-1"
                                    title="Assign staff to this process task"
                                    style={{
                                      fontSize: '0.7rem',
                                      background: 'var(--mubs-blue)',
                                      color: '#fff',
                                      borderRadius: '6px',
                                      padding: '2px 8px',
                                      whiteSpace: 'nowrap',
                                    }}
                                    onClick={() => {
                                      setAssigningTask(task);
                                      setAssignStaffIds([]);
                                      setAssignStaffSearchTerm('');
                                      setAssignBreakdownEnabled(false);
                                      setAssignSubtasks([]);
                                      setShowAssignModal(true);
                                    }}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                      person_add
                                    </span>
                                    Assign
                                  </button>
                                ) : null}
                              </div>
                              {taskAssignments.length > 0 && (
                                <div className="mt-2 d-flex flex-wrap gap-1">
                                  {expandProcessAssignmentsForDisplay<ProcessAssignment>(taskAssignments).map((item) => {
                                    if (item.kind === 'container') {
                                      const sa = item.a;
                                      const hasStaff = String(sa.staff_name ?? '').trim() !== '';
                                      const subtasks = Array.isArray(sa.subtasks) ? sa.subtasks : [];
                                      const sectionLabel = String(sa.section_name ?? '').trim();
                                      const useSectionSummary =
                                        !hasStaff && subtasks.length > 0 && sectionLabel !== '';
                                      const isDone = hasStaff
                                        ? assignmentIsTerminal(sa)
                                        : subtasks.length > 0
                                          ? subtasks.every(subtaskIsTerminal)
                                          : assignmentIsTerminal(sa);
                                      return (
                                        <span
                                          key={`c-${sa.id}`}
                                          className="badge d-inline-flex align-items-center gap-1"
                                          style={{
                                            background: isDone ? '#dcfce7' : '#e0f2fe',
                                            color: isDone ? '#15803d' : '#0369a1',
                                            fontSize: '0.7rem',
                                            fontWeight: 500,
                                          }}
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                                            {isDone ? 'check_circle' : useSectionSummary ? 'groups' : 'person'}
                                          </span>
                                          {hasStaff
                                            ? isDone
                                              ? `Task completed by ${sa.staff_name}`
                                              : sa.staff_name
                                            : isDone
                                              ? 'All sub-tasks completed'
                                              : useSectionSummary
                                                ? `${sectionLabel} (duties pending)`
                                                : 'Sub-tasks assigned'}
                                          {!isDone && (
                                            <>
                                              <span className="ms-1 text-muted" style={{ fontSize: '0.65rem' }}>
                                                ({sa.status})
                                              </span>
                                              {!assignmentIsOpen(sa) ? (
                                                <button
                                                  type="button"
                                                  className="btn-close p-0 ms-1"
                                                  style={{ fontSize: '9px', opacity: 0.75 }}
                                                  title={
                                                    hasStaff
                                                      ? 'Remove assignment'
                                                      : 'Remove assignment and all duties under this step'
                                                  }
                                                  aria-label="Remove assignment"
                                                  onClick={() => handleRemoveProcessAssignment(sa.id)}
                                                />
                                              ) : (
                                                <span
                                                  className="ms-1 text-muted"
                                                  style={{ fontSize: '0.62rem' }}
                                                  title="Opened processes cannot be removed here"
                                                >
                                                  locked
                                                </span>
                                              )}
                                            </>
                                          )}
                                        </span>
                                      );
                                    }
                                    if (item.kind === 'section_group') {
                                      const rows = item.rows;
                                      const sectionName = String(rows[0]?.section_name ?? '').trim();
                                      const isDone = rows.every((r) => assignmentIsTerminal(r));
                                      const pending = rows.filter((r) => !assignmentIsTerminal(r)).length;
                                      const anyOpened = rows.some((r) => assignmentIsOpen(r));
                                      return (
                                        <span
                                          key={`sec-${rows[0]?.section_id ?? rows[0]?.id}`}
                                          className="badge d-inline-flex align-items-center gap-1"
                                          style={{
                                            background: isDone ? '#dcfce7' : '#e0f2fe',
                                            color: isDone ? '#15803d' : '#0369a1',
                                            fontSize: '0.7rem',
                                            fontWeight: 500,
                                          }}
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                                            {isDone ? 'check_circle' : 'groups'}
                                          </span>
                                          {isDone ? `${sectionName} — completed` : sectionName}
                                          {!isDone && (
                                            <>
                                              <span className="ms-1 text-muted" style={{ fontSize: '0.65rem' }}>
                                                ({pending} pending)
                                              </span>
                                              {!anyOpened ? (
                                                <button
                                                  type="button"
                                                  className="btn-close p-0 ms-1"
                                                  style={{ fontSize: '9px', opacity: 0.75 }}
                                                  title={`Remove all assignments for ${sectionName}`}
                                                  aria-label="Remove section assignments"
                                                  onClick={async () => {
                                                    if (!confirm(`Remove all assignments for ${sectionName}?`)) return;
                                                    try {
                                                      for (const r of rows) {
                                                        await axios.delete(
                                                          `/api/department-head/process-assignments/${r.id}`
                                                        );
                                                      }
                                                      if (selected) await fetchProcessAssignments(selected.id);
                                                    } catch (e: unknown) {
                                                      const msg =
                                                        typeof e === 'object' &&
                                                        e !== null &&
                                                        'response' in e &&
                                                        typeof (e as { response?: { data?: { message?: string } } })
                                                          .response?.data?.message === 'string'
                                                          ? (e as { response: { data: { message: string } } }).response
                                                              .data.message
                                                          : 'Could not remove assignment';
                                                      alert(msg);
                                                    }
                                                  }}
                                                />
                                              ) : (
                                                <span
                                                  className="ms-1 text-muted"
                                                  style={{ fontSize: '0.62rem' }}
                                                  title="Cannot remove: one or more steps are already open"
                                                >
                                                  locked
                                                </span>
                                              )}
                                            </>
                                          )}
                                        </span>
                                      );
                                    }
                                    const sa = item.a;
                                    const isDone = assignmentIsTerminal(sa);
                                    return (
                                      <span
                                        key={sa.id}
                                        className="badge d-inline-flex align-items-center gap-1"
                                        style={{
                                          background: isDone ? '#dcfce7' : '#e0f2fe',
                                          color: isDone ? '#15803d' : '#0369a1',
                                          fontSize: '0.7rem',
                                          fontWeight: 500,
                                        }}
                                      >
                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                                          {isDone ? 'check_circle' : 'person'}
                                        </span>
                                        {isDone ? `Task completed by ${sa.staff_name}` : sa.staff_name}
                                        {!isDone && (
                                          <>
                                            <span className="ms-1 text-muted" style={{ fontSize: '0.65rem' }}>
                                              ({sa.status})
                                            </span>
                                            {!assignmentIsOpen(sa) ? (
                                              <button
                                                type="button"
                                                className="btn-close p-0 ms-1"
                                                style={{ fontSize: '9px', opacity: 0.75 }}
                                                title="Remove assignment"
                                                aria-label="Remove assignment"
                                                onClick={() => handleRemoveProcessAssignment(sa.id)}
                                              />
                                            ) : (
                                              <span
                                                className="ms-1 text-muted"
                                                style={{ fontSize: '0.62rem' }}
                                                title="Opened processes cannot be removed here"
                                              >
                                                locked
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </span>
                                    );
                                  })}
                                  {taskAssignments
                                    .filter((a) => String(a.staff_name ?? '').trim() === '')
                                    .flatMap((a) => {
                                      const sn = String(a.section_name ?? '').trim();
                                      if (sn !== '') return [];
                                      return Array.isArray(a.subtasks) ? a.subtasks : [];
                                    })
                                    .map((st) => (
                                      <span
                                        key={`st-${st.id}`}
                                        className="badge d-inline-flex align-items-center gap-1"
                                        style={{
                                          background: '#fff7ed',
                                          color: '#9a3412',
                                          fontSize: '0.7rem',
                                          fontWeight: 500,
                                        }}
                                      >
                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                                          subdirectory_arrow_right
                                        </span>
                                        {st.assigned_to_name}
                                        <span className="ms-1 text-muted" style={{ fontSize: '0.65rem' }}>
                                          ({st.status})
                                        </span>
                                      </span>
                                    ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer border-top-0 p-4 pt-0 d-flex justify-content-end gap-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary fw-bold"
                  style={{ borderRadius: '10px', fontSize: '.8rem' }}
                  onClick={closeActivityDetailModal}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary d-flex align-items-center gap-2 px-4 shadow-sm"
                  style={{ borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}
                  title={
                    !processDataReady
                      ? 'Loading process tasks and assignments…'
                      : !canViewProcesses
                        ? 'Assign every process task before opening Processes'
                        : undefined
                  }
                  disabled={!processDataReady}
                  onClick={() => {
                    if (!processDataReady) return;
                    if (!canViewProcesses) {
                      setShowAssignmentsRequiredDialog(true);
                      return;
                    }
                    closeActivityDetailModal();
                    router.push(
                      `/department-head?pg=tasks&mode=table&activity=${encodeURIComponent(selected.title || 'Department task')}&activityId=${encodeURIComponent(String(selected.id))}`
                    );
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    list
                  </span>
                  View processes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssignmentsRequiredDialog && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dept-assignments-required-title"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            zIndex: 1080,
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => setShowAssignmentsRequiredDialog(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-sm"
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '14px', overflow: 'hidden' }}>
              <div className="modal-body p-4 text-center">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                  style={{
                    width: 48,
                    height: 48,
                    background: '#fff7ed',
                    color: '#c2410c',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
                    assignment_late
                  </span>
                </div>
                <h2 id="dept-assignments-required-title" className="h6 fw-bold text-dark mb-2" style={{ fontSize: '1rem' }}>
                  Assignments required
                </h2>
                <p className="text-secondary mb-0" style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Complete all task assignments before proceeding.
                </p>
              </div>
              <div className="modal-footer border-0 justify-content-center pt-0 pb-4 px-4">
                <button
                  type="button"
                  className="btn btn-primary px-4 fw-semibold"
                  style={{ borderRadius: '8px', minWidth: '120px' }}
                  onClick={() => setShowAssignmentsRequiredDialog(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && assigningTask && selected && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15,23,42,0.7)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: '640px' }}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
              <div className="modal-header pb-0 px-4 pt-4 border-0 align-items-start">
                <h6 className="fw-bold d-flex align-items-center gap-2 mb-0" style={{ fontSize: '1rem' }}>
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '22px' }}>
                    person_add
                  </span>
                  Assign Process
                </h6>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssignStaffIds([]);
                    setAssignStaffSearchTerm('');
                    setAssignmentSectionId('');
                    setAssignBreakdownEnabled(false);
                    setAssignSubtasks([]);
                  }}
                />
              </div>
              <div className="modal-body px-4 py-3">
                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">Assign within</label>
                  <select
                    className="form-select form-select-sm"
                    value={assignmentSectionId === '' ? '' : String(assignmentSectionId)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAssignmentSectionId(v === '' ? '' : Number(v));
                    }}
                  >
                    <option value="">Whole department / unit</option>
                    {assignSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="form-text small text-muted">
                    Optional: only staff in this section appear below (manage sections under Staff → Sections).
                  </div>
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-12">
                    <div
                      className="p-3 rounded h-100"
                      style={{ background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: '0.82rem', color: '#0369a1' }}
                    >
                      <div className="row g-2 align-items-start">
                        <div
                          className="col-sm-4 text-uppercase fw-bold"
                          style={{ fontSize: '0.65rem', letterSpacing: '0.04em', color: '#0369a1' }}
                        >
                          Task
                        </div>
                        <div className="col-sm-8 fw-bold text-dark" style={{ fontSize: '0.88rem' }}>
                          {processTasks.findIndex((t) => t.id === assigningTask.id) + 1}. {assigningTask.taskName}
                        </div>
                        <div
                          className="col-sm-4 text-uppercase fw-bold"
                          style={{ fontSize: '0.65rem', letterSpacing: '0.04em', color: '#0369a1' }}
                        >
                          Activity
                        </div>
                        <div className="col-sm-8 text-dark" style={{ fontSize: '0.82rem' }}>
                          {selected.title}
                        </div>
                        {assigningTask.performance_indicator ? (
                          <>
                            <div
                              className="col-sm-4 text-uppercase fw-bold"
                              style={{ fontSize: '0.65rem', letterSpacing: '0.04em', color: '#0369a1' }}
                            >
                              Indicator
                            </div>
                            <div className="col-sm-8 text-dark small" style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                              {assigningTask.performance_indicator}
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-3 p-3 rounded-3 border" style={{ background: '#ffffff' }}>
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <div>
                      <div className="fw-bold text-dark" style={{ fontSize: '.9rem' }}>
                        Break down into sub-tasks (optional)
                      </div>
                    </div>
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={assignBreakdownEnabled}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setAssignBreakdownEnabled(on);
                          if (on && assignSubtasks.length === 0) {
                            const initial = assignStaffIds.map((sid) => ({
                              assigned_to: sid,
                              title: '',
                            }));
                            setAssignSubtasks(initial);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {assignBreakdownEnabled && (
                    <div className="mt-3 d-flex flex-column gap-2">
                      {assignSubtasks.length > 0 ? (
                        <div
                          className="d-flex flex-wrap gap-2 align-items-end border-bottom pb-1 mb-1"
                          style={{ columnGap: '0.5rem' }}
                        >
                          <span
                            className="small fw-semibold text-secondary"
                            style={{ flex: 1, minWidth: 220, fontSize: '0.72rem' }}
                          >
                            Duty
                          </span>
                          <span
                            className="small fw-semibold text-secondary"
                            style={{ width: 220, fontSize: '0.72rem' }}
                          >
                            Assigned to
                          </span>
                          <span style={{ width: 38 }} aria-hidden />
                        </div>
                      ) : null}
                      {assignSubtasks.map((st, idx) => (
                        <div key={idx} className="d-flex flex-wrap gap-2 align-items-center">
                          <input
                            className="form-control form-control-sm"
                            style={{ flex: 1, minWidth: 220 }}
                            value={st.title}
                            placeholder={`Duty #${idx + 1}`}
                            onChange={(e) => {
                              const arr = [...assignSubtasks];
                              arr[idx] = { ...arr[idx], title: e.target.value };
                              setAssignSubtasks(arr);
                            }}
                            disabled={assignSaving}
                          />
                          <select
                            className="form-select form-select-sm"
                            style={{ width: 220 }}
                            value={st.assigned_to === '' ? '' : String(st.assigned_to)}
                            onChange={(e) => {
                              const v = e.target.value;
                              const arr = [...assignSubtasks];
                              arr[idx] = { ...arr[idx], assigned_to: v === '' ? '' : Number(v) };
                              setAssignSubtasks(arr);
                            }}
                            disabled={assignSaving}
                          >
                            <option value="">Assign to…</option>
                            {assignStaffIds.map((sid) => {
                              const u = assignPoolUsers.find((x) => x.id === sid);
                              return (
                                <option key={sid} value={sid}>
                                  {u?.full_name || `Staff #${sid}`}
                                </option>
                              );
                            })}
                          </select>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            style={{ fontSize: '.75rem' }}
                            onClick={() => setAssignSubtasks(assignSubtasks.filter((_, i) => i !== idx))}
                            disabled={assignSaving}
                            title="Remove sub-task"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <div className="d-flex justify-content-between align-items-center">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          style={{ fontSize: '.75rem' }}
                          onClick={() => setAssignSubtasks([...assignSubtasks, { title: '', assigned_to: '' }])}
                          disabled={assignSaving}
                        >
                          + Add sub-task
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          style={{ fontSize: '.75rem' }}
                          onClick={() => {
                            const auto = assignStaffIds.map((sid) => ({
                              assigned_to: sid,
                              title: '',
                            }));
                            setAssignSubtasks(auto);
                          }}
                          disabled={assignSaving || assignStaffIds.length === 0}
                        >
                          Auto-split (1 per staff)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label fw-semibold small mb-0">Assign staff</label>
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                    Search or bulk-add, then confirm
                  </span>
                </div>
                <div className="position-relative mb-2">
                  <input
                    type="search"
                    className="form-control form-control-sm"
                    placeholder="Search staff by name or position..."
                    value={assignStaffSearchTerm}
                    onChange={(e) => {
                      setAssignStaffSearchTerm(e.target.value);
                      setShowAssignStaffSearchResults(true);
                    }}
                    onFocus={() => setShowAssignStaffSearchResults(true)}
                    autoComplete="off"
                  />
                  {showAssignStaffSearchResults && assignStaffSearchResults.length > 0 && (
                    <div
                      className="position-absolute w-100 bg-white border rounded shadow-sm mt-1 overflow-hidden"
                      style={{ zIndex: 1070, maxHeight: '220px', overflowY: 'auto' }}
                    >
                      {assignStaffSearchResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="btn btn-white w-100 text-start px-2 py-2 border-bottom small d-flex flex-column align-items-start"
                          onClick={() => addStaffToProcessAssign(u.id)}
                        >
                          <span className="fw-medium">{u.full_name}</span>
                          {u.position ? (
                            <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                              {u.position}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="d-flex flex-wrap gap-2" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                  {assignStaffIds.map((id) => {
                    const u = assignPoolUsers.find((x) => x.id === id);
                    return (
                      <span
                        key={id}
                        className="badge bg-light text-primary border d-flex align-items-center gap-1 py-1 px-2"
                        style={{ fontSize: '0.78rem' }}
                      >
                        {u?.full_name || id}
                        {u?.position ? <span className="text-muted fw-normal">({u.position})</span> : null}
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '14px', cursor: 'pointer' }}
                          role="presentation"
                          onClick={() => removeStaffFromProcessAssign(id)}
                        >
                          close
                        </span>
                      </span>
                    );
                  })}
                  {assignStaffIds.length === 0 && <span className="text-muted small">No staff selected yet.</span>}
                </div>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-0 d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssignStaffIds([]);
                    setAssignStaffSearchTerm('');
                    setAssignmentSectionId('');
                    setAssignBreakdownEnabled(false);
                    setAssignSubtasks([]);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm fw-bold"
                  style={{ background: 'var(--mubs-blue)', color: '#fff', borderColor: 'var(--mubs-blue)' }}
                  disabled={assignStaffIds.length === 0 || assignSaving}
                  onClick={handleAssignProcessTask}
                >
                  {assignSaving ? 'Saving...' : assignStaffIds.length > 1 ? `Assign ${assignStaffIds.length} staff` : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

