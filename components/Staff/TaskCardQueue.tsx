"use client";

import React from "react";

interface Task {
  id: number;
  title: string;
  description: string;
  startDate?: string;
  dueDate: string;
  status: string;
  type: string;
  daysLeft: number;
  task_type?: 'process' | 'kpi_driver';
  kpi_target_value?: number | null;
  progress?: number;
}

interface TaskCardQueueProps {
  tasks: Task[];
  onAction: (task: Task) => void;
}

export default function TaskCardQueue({ tasks, onAction }: TaskCardQueueProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-5 bg-white rounded-4 border border-dashed">
        <span className="material-symbols-outlined text-muted mb-2" style={{ fontSize: '48px', opacity: 0.3 }}>
          checklist
        </span>
        <p className="text-muted">Your process queue is empty. Great job!</p>
      </div>
    );
  }

  const getPriorityInfo = (task: Task) => {
    const overdue = task.daysLeft < 0 && task.status !== "Completed";
    if (overdue) return { label: "OVERDUE", color: "#ef4444", bg: "#fef2f2" };
    if (task.daysLeft <= 2) return { label: "URGENT", color: "#f59e0b", bg: "#fffbeb" };
    return { label: "NORMAL", color: "#3b82f6", bg: "#eff6ff" };
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Completed": return { bg: "#dcfce7", color: "#15803d" };
      case "Under Review": return { bg: "#eff6ff", color: "#1d4ed8" };
      case "In Progress": return { bg: "#fef9c3", color: "#a16207" };
      default: return { bg: "#f1f5f9", color: "#475569" };
    }
  };

  return (
    <div className="row g-4">
      {tasks.map((task) => {
        const priority = getPriorityInfo(task);
        const statusStyle = getStatusStyle(task.status);
        const progress = task.progress ?? (task.status === "Completed" ? 100 : task.status === "Under Review" ? 90 : 25);

        return (
          <div key={task.id} className="col-12 col-md-6 col-xxl-4">
            <div 
              className="task-queue-card h-100 p-4 bg-white border rounded-4 shadow-sm d-flex flex-column"
              style={{ 
                transition: 'all 0.3s ease',
                borderTop: `6px solid ${priority.color}`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
            >
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div className="d-flex flex-column gap-1 flex-fill overflow-hidden">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span 
                      className="badge rounded-pill px-2 py-1" 
                      style={{ background: priority.bg, color: priority.color, fontSize: '0.65rem', fontWeight: '800' }}
                    >
                      {priority.label}
                    </span>
                    <span 
                      className="status-badge px-2 py-1 rounded-pill" 
                      style={{ background: statusStyle.bg, color: statusStyle.color, fontSize: '0.65rem', fontWeight: '600' }}
                    >
                      {task.status}
                    </span>
                  </div>
                  <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.05rem', wordBreak: 'break-word' }}>{task.title}</h5>
                </div>
              </div>

              <div className="flex-fill">
                <p className="text-muted small mb-3" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '3.6em' }}>
                  {task.description || "No description provided."}
                </p>

                <div className="d-flex justify-content-between align-items-center mb-3">
                   <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                    Due {new Date(task.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                  </div>
                  <div className="fw-bold" style={{ color: priority.color, fontSize: '0.75rem' }}>
                    {task.daysLeft < 0 ? `${Math.abs(task.daysLeft)} days late` : `${task.daysLeft} days left`}
                  </div>
                </div>

                <div className="progress-section mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="small text-muted fw-bold" style={{ fontSize: '0.65rem' }}>PROGRESS</span>
                    <span className="small fw-bold" style={{ fontSize: '0.7rem', color: priority.color }}>{progress}%</span>
                  </div>
                  <div className="progress" style={{ height: '6px', borderRadius: '10px', background: '#f1f5f9' }}>
                    <div 
                      className="progress-bar" 
                      style={{ 
                        width: `${progress}%`, 
                        background: `linear-gradient(90deg, ${priority.color}, #60a5fa)`,
                        borderRadius: '10px'
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-auto pt-3 border-top">
                <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '0.7rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                    {task.task_type === 'kpi_driver' ? 'trending_up' : 'settings'}
                  </span>
                  {task.type}
                </div>
                <button 
                  onClick={() => onAction(task)}
                  className="btn btn-sm text-white fw-bold px-3 py-2 d-flex align-items-center gap-1 shadow-sm"
                  style={{ background: 'var(--mubs-blue)', borderRadius: '10px', fontSize: '0.75rem' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {task.status === "Completed" || task.status === "Under Review" ? "visibility" : "upload_file"}
                  </span>
                  {task.status === "Completed" || task.status === "Under Review" ? "View Details" : (task.status === "Returned" || task.status === "Incomplete" ? "Resubmit" : "Submit Report")}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
