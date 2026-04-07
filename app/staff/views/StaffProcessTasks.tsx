"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import StatCard from "@/components/StatCard";
import { labelForActivityUnitOfMeasure } from "@/lib/activity-unit-of-measure";

/** API still returns step_name / step_order from standard_processes; conceptually these are process tasks. */
interface ProcessAssignment {
  id: number;
  activity_id: number;
  standard_process_id: number;
  status: string;
  actual_value: number | null;
  commentary: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  step_name: string;
  step_order: number;
  standard_id: number;
  standard_title: string;
  quality_standard: string | null;
  output_standard: string | null;
  activity_title: string;
  pillar: string;
  target_kpi: string;
  unit_of_measure: string;
  activity_description: string | null;
  performance_indicator?: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:     { bg: '#f1f5f9', color: '#475569' },
  in_progress: { bg: '#fef9c3', color: '#a16207' },
  completed:   { bg: '#dcfce7', color: '#15803d' },
};

function taskTitle(a: ProcessAssignment): string {
  return (a.step_name || '').trim() || '—';
}

export default function StaffProcessTasks() {
  const [assignments, setAssignments] = useState<ProcessAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProcessAssignment | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateForm, setUpdateForm] = useState({ status: '', commentary: '', actual_value: '' });

  const fetchAssignments = async () => {
    try {
      const res = await axios.get('/api/staff/process-assignments');
      setAssignments(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAssignments(); }, []);

  const openTask = (a: ProcessAssignment) => {
    setSelected(a);
    setUpdateForm({ status: a.status, commentary: a.commentary || '', actual_value: a.actual_value != null ? String(a.actual_value) : '' });
    setShowModal(true);
  };

  const handleUpdate = async () => {
    if (!selected) return;
    setUpdating(true);
    try {
      await axios.put(`/api/staff/process-assignments/${selected.id}`, {
        status: updateForm.status,
        commentary: updateForm.commentary || null,
        actual_value: updateForm.actual_value !== '' ? parseFloat(updateForm.actual_value) : null
      });
      setShowModal(false);
      fetchAssignments();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Could not update');
    } finally {
      setUpdating(false);
    }
  };

  const pending = assignments.filter(a => a.status === 'pending').length;
  const inProgress = assignments.filter(a => a.status === 'in_progress').length;
  const completed = assignments.filter(a => a.status === 'completed').length;

  const statusLabel = (s: string) => s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
      </div>
    );
  }

  return (
    <div className="content-area w-100">
      <div className="row g-4 mb-4">
        <div className="col-12 col-sm-4">
          <StatCard icon="pending_actions" label="Pending" value={pending} badge="To Do" badgeIcon="radio_button_unchecked" color="blue" />
        </div>
        <div className="col-12 col-sm-4">
          <StatCard icon="sync" label="In Progress" value={inProgress} badge="Active" badgeIcon="trending_up" color="yellow" />
        </div>
        <div className="col-12 col-sm-4">
          <StatCard icon="check_circle" label="Completed" value={completed} badge="Done" badgeIcon="done_all" color="green" />
        </div>
      </div>

      <div className="table-card p-0 overflow-hidden" style={{ borderRadius: '20px', border: '1px solid #e2e8f0' }}>
        <div className="table-card-header d-flex justify-content-between align-items-center p-4" style={{ background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
          <h5 className="mb-0 d-flex align-items-center gap-2 fw-bold" style={{ color: 'var(--mubs-navy)' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>checklist</span>
            My process tasks
          </h5>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '36px', opacity: 0.3 }}>checklist</span>
            No process tasks have been assigned to you yet.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table mb-0 align-middle">
              <thead className="bg-light">
                <tr>
                  <th className="ps-4">Task</th>
                  <th>Activity</th>
                  <th>Standard</th>
                  <th>Status</th>
                  <th className="pe-4 text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(a => {
                  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
                  return (
                    <tr key={a.id}>
                      <td className="ps-4">
                        <div className="fw-bold text-dark" style={{ fontSize: '.88rem' }}>{taskTitle(a)}</div>
                        <div className="text-muted" style={{ fontSize: '.72rem' }}>Task #{a.step_order + 1}</div>
                      </td>
                      <td>
                        <div className="fw-medium" style={{ fontSize: '.82rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.activity_title}</div>
                        {a.pillar && <div className="text-muted" style={{ fontSize: '.7rem' }}>{a.pillar}</div>}
                      </td>
                      <td>
                        <div style={{ fontSize: '.8rem', color: 'var(--mubs-blue)', fontWeight: 500 }}>{a.standard_title}</div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: sc.bg, color: sc.color, fontWeight: 600, fontSize: '0.72rem' }}>
                          {statusLabel(a.status)}
                        </span>
                      </td>
                      <td className="pe-4 text-end">
                        <button
                          className="btn btn-sm btn-outline-primary fw-bold d-inline-flex align-items-center gap-1"
                          style={{ borderRadius: '8px', fontSize: '.78rem' }}
                          onClick={() => openTask(a)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                            {a.status === 'completed' ? 'visibility' : 'edit_note'}
                          </span>
                          {a.status === 'completed' ? 'View' : 'Update'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && selected && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15,23,42,0.65)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '14px' }}>
              <div className="modal-header border-0 px-4 pt-4 pb-0">
                <h6 className="fw-bold d-flex align-items-center gap-2 mb-0" style={{ fontSize: '1rem' }}>
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '22px' }}>edit_note</span>
                  Update task
                </h6>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <div className="modal-body px-4 py-3">
                <div className="p-3 rounded mb-3" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: '0.82rem' }}>
                  <div className="fw-bold text-dark">{taskTitle(selected)}</div>
                  <div className="text-muted mt-1">{selected.activity_title}</div>
                  {selected.standard_title && <div className="text-primary small mt-1">Standard: {selected.standard_title}</div>}
                  {selected.quality_standard && <div className="text-dark small mt-1 opacity-75"><strong>Quality:</strong> {selected.quality_standard}</div>}
                  {selected.performance_indicator && (
                    <div className="small mt-2 pt-2 border-top border-info border-opacity-50">
                      <strong className="text-secondary d-block mb-1">Performance indicator</strong>
                      <span className="text-dark">{selected.performance_indicator}</span>
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold small">Status</label>
                  <select
                    className="form-select form-select-sm"
                    value={updateForm.status}
                    onChange={e => setUpdateForm({ ...updateForm, status: e.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold small">
                    Actual Value
                    <span className="ms-1 text-muted fw-normal">
                      ({labelForActivityUnitOfMeasure(selected.unit_of_measure)})
                    </span>
                  </label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="Enter achieved value..."
                    value={updateForm.actual_value}
                    onChange={e => setUpdateForm({ ...updateForm, actual_value: e.target.value })}
                    step="any"
                    min="0"
                  />
                </div>

                <div className="mb-1">
                  <label className="form-label fw-semibold small">Commentary / Notes</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={3}
                    placeholder="Describe actions taken, challenges, or notes..."
                    value={updateForm.commentary}
                    onChange={e => setUpdateForm({ ...updateForm, commentary: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-0 d-flex gap-2 justify-content-end">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-sm fw-bold"
                  style={{ background: 'var(--mubs-blue)', color: '#fff', borderColor: 'var(--mubs-blue)' }}
                  onClick={handleUpdate}
                  disabled={updating}
                >
                  {updating ? 'Saving...' : 'Save Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
