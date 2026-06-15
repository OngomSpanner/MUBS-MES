'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

type MilestoneTask = {
  taskOrder: number;
  taskName: string;
  milestoneProgress: number | null;
  assignmentStatus: string | null;
  completed: boolean;
};

type Props = {
  activityId: number;
  className?: string;
};

export default function MilestoneProgressPanel({ activityId, className }: Props) {
  const [parentProgress, setParentProgress] = useState<number | null>(null);
  const [tasks, setTasks] = useState<MilestoneTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .get('/api/department-head/milestone-progress', { params: { activityId } })
      .then((res) => {
        if (cancelled) return;
        setParentProgress(res.data?.parentProgress != null ? Number(res.data.parentProgress) : null);
        setTasks(Array.isArray(res.data?.tasks) ? res.data.tasks : []);
      })
      .catch(() => {
        if (!cancelled) {
          setParentProgress(null);
          setTasks([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  if (loading || tasks.length === 0) return null;

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div
      className={`border-0 shadow-sm bg-white ${className ?? ''}`}
      style={{ borderRadius: '12px', overflow: 'hidden' }}
    >
      <div className="p-3 border-bottom bg-light bg-opacity-50">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h6 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.9rem' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>
              flag
            </span>
            Milestone progress
          </h6>
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted small">
              {completedCount}/{tasks.length} tasks
            </span>
            <span className="badge bg-primary" style={{ fontSize: '0.75rem' }}>
              {parentProgress ?? 0}%
            </span>
          </div>
        </div>
        <div className="progress mt-2" style={{ height: '6px', borderRadius: '4px' }}>
          <div
            className="progress-bar bg-primary"
            style={{ width: `${Math.min(100, Math.max(0, parentProgress ?? 0))}%` }}
          />
        </div>
      </div>
      <div className="p-3 d-flex flex-column gap-2">
        {tasks.map((task) => (
          <div key={`${task.taskOrder}-${task.taskName}`} className="d-flex align-items-center gap-2">
            <span
              className={`material-symbols-outlined flex-shrink-0 ${task.completed ? 'text-success' : 'text-secondary'}`}
              style={{ fontSize: '18px' }}
            >
              {task.completed ? 'check_circle' : 'trip_origin'}
            </span>
            <span
              className={`flex-grow-1 small text-truncate ${task.completed ? 'text-dark fw-semibold' : 'text-secondary'}`}
            >
              {task.taskName}
            </span>
            <span className="text-muted small flex-shrink-0" style={{ fontSize: '0.72rem' }}>
              {task.milestoneProgress != null ? `${task.milestoneProgress}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
