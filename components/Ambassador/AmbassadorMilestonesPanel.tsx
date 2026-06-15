'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import axios from 'axios';

type MilestoneTask = {
  taskOrder: number;
  taskName: string;
  milestoneProgress: number | null;
  assignmentStatus: string | null;
  completed: boolean;
};

type MilestoneActivity = {
  id: number;
  title: string;
  department: string;
  progress: number;
  pendingTasks: number;
  totalTasks: number;
  completedTasks: number;
  tasks: MilestoneTask[];
};

export default function AmbassadorMilestonesPanel() {
  const [managedUnitName, setManagedUnitName] = useState('');
  const [activities, setActivities] = useState<MilestoneActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/ambassador/milestones');
      setManagedUnitName(res.data.managedUnitName ?? '');
      setActivities(res.data.activities ?? []);
    } catch {
      setError('Failed to load milestone progress.');
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="table-card shadow-sm border-0 bg-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
      <div className="table-card-header flex-wrap gap-2">
        <div>
          <h5 className="mb-0 d-flex align-items-center gap-2">
            <span className="material-symbols-outlined text-primary">flag</span>
            Milestone progress
          </h5>
          <p className="text-muted small mb-0 mt-1">
            Auto-calculated from standard process tasks for <strong>{managedUnitName || 'your unit'}</strong>.
          </p>
        </div>
      </div>

      <div className="p-3 pt-2">
        {error && <div className="alert alert-danger mb-3 py-2 small">{error}</div>}

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-5 text-muted small">
            No milestone-linked strategic activities in your unit yet.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="small text-muted px-3">Activity</th>
                  <th className="small text-muted">Department</th>
                  <th className="small text-muted">Progress</th>
                  <th className="small text-muted">Tasks</th>
                  <th className="small text-muted px-3">Pending</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((act) => (
                  <Fragment key={act.id}>
                    <tr
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedId(expandedId === act.id ? null : act.id)}
                    >
                      <td className="px-3 fw-semibold small">{act.title}</td>
                      <td className="small">{act.department}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="progress flex-fill" style={{ height: 6, width: 72 }}>
                            <div
                              className="progress-bar bg-primary"
                              style={{ width: `${act.progress}%` }}
                            />
                          </div>
                          <span className="small fw-bold">{act.progress}%</span>
                        </div>
                      </td>
                      <td className="small">
                        {act.completedTasks}/{act.totalTasks}
                      </td>
                      <td className="px-3">
                        {act.pendingTasks > 0 ? (
                          <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>
                            {act.pendingTasks} pending
                          </span>
                        ) : (
                          <span className="badge bg-success" style={{ fontSize: '0.65rem' }}>
                            Complete
                          </span>
                        )}
                      </td>
                    </tr>
                    {expandedId === act.id ? (
                      <tr>
                        <td colSpan={5} className="px-3 pb-3 bg-light bg-opacity-50">
                          <div className="small fw-bold text-muted mb-2 text-uppercase" style={{ fontSize: '0.65rem' }}>
                            Process tasks
                          </div>
                          <ul className="list-unstyled mb-0">
                            {act.tasks.map((task) => (
                              <li
                                key={`${act.id}-${task.taskOrder}`}
                                className="d-flex align-items-center gap-2 py-1 small"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{
                                    fontSize: 16,
                                    color: task.completed ? '#15803d' : '#94a3b8',
                                  }}
                                >
                                  {task.completed ? 'check_circle' : 'radio_button_unchecked'}
                                </span>
                                <span className={task.completed ? 'text-dark' : 'text-muted'}>
                                  {task.taskName}
                                </span>
                                {task.milestoneProgress != null ? (
                                  <span className="text-muted ms-auto">{task.milestoneProgress}%</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
