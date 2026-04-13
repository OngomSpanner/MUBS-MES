"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import { Modal, Button } from "react-bootstrap";

import StatCard from "@/components/StatCard";
import TaskSubmissionModal, { type StaffTaskSubmissionContext } from "@/components/Staff/TaskSubmissionModal";
import SubmissionDetailModal from "@/components/Staff/SubmissionDetailModal";
import TaskCardQueue from "@/components/Staff/TaskCardQueue";

interface Task extends StaffTaskSubmissionContext {
  id: number;
  title: string;
  description?: string;
  startDate?: string;
  dueDate: string;
  status: string;
  type: string;
  daysLeft: number;
  task_type?: 'process' | 'kpi_driver';
  kpi_target_value?: number | null;
  activity_title?: string;
  unit_name?: string;
  parent_process_title?: string | null;
  assignee_name?: string | null;
  /** Comma-separated team member names (excluding current staff) */
  team_members?: string | null;
}

interface Stats {
  assigned: number;
  overdue: number;
  inProgress: number;
  completed: number;
}

function StaffTasksContent() {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats>({
    assigned: 0,
    overdue: 0,
    inProgress: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showProcessDetails, setShowProcessDetails] = useState(false);
  const [selectedTaskForReport, setSelectedTaskForReport] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState<'overdue' | 'active' | 'review' | 'history'>('overdue');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset to first page when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const fetchData = async () => {
    try {
      const response = await axios.get("/api/staff/tasks");
      setTasks(response.data.tasks);
      setStats(response.data.stats);
    } catch (error) {
      console.error("Error fetching staff tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = useCallback((task: Task) => {
    setSelectedTaskForReport(task);
    setShowModal(false);
    setShowViewModal(false);
    setShowProcessDetails(false);
    if (task.status === "Completed" || task.status === "Under Review" || task.status === "Incomplete") {
      setShowViewModal(true);
    } else {
      setShowProcessDetails(true);
    }
  }, []);

  useEffect(() => {
    const taskId = searchParams.get('taskId');
    if (taskId && tasks.length > 0) {
      const task = tasks.find(t => t.id === parseInt(taskId));
      if (task) {
        handleOpenModal(task);
      }
    }
  }, [searchParams, tasks, handleOpenModal]);

  const formatProcessDetailDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const statusBadgeStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return { bg: '#dcfce7', color: '#15803d' };
    if (s === 'under review') return { bg: '#eff6ff', color: 'var(--mubs-blue)' };
    if (s === 'in progress') return { bg: '#fef3c7', color: '#92400e' };
    if (s === 'returned') return { bg: '#ffedd5', color: '#9a3412' };
    if (s === 'incomplete' || s === 'not done') return { bg: '#fee2e2', color: '#b91c1c' };
    return { bg: '#f1f5f9', color: '#475569' };
  };

  const openSubmitFromProcessDetails = () => {
    if (!selectedTaskForReport || selectedTaskForReport.status === "Not opened") return;
    setShowProcessDetails(false);
    setShowModal(true);
  };

  const filteredTasks = tasks.filter(t => {
    if (activeTab === 'review') return t.status === 'Under Review';
    if (activeTab === 'history') return t.status === 'Completed';

    const isAction = t.status !== 'Completed' && t.status !== 'Under Review';
    if (!isAction) return false;

    if (activeTab === 'overdue') return t.daysLeft < 0;
    if (activeTab === 'active') return t.daysLeft >= 0;
    return true;
  });

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTasks = filteredTasks.slice(indexOfFirstItem, indexOfLastItem);

  const renderTaskRow = (task: Task) => {
    const overdue = task.daysLeft < 0 && task.status !== "Completed";
    const rowBg = overdue ? "#fff5f5" : "transparent";
    const isSubtask = task.assignment_type === 'process_subtask';
    const teamPreview = (task.team_members || '').trim();
    return (
      <tr key={task.id} style={{ background: rowBg }}>
        <td className="ps-4">
          <div className="fw-bold text-dark" style={{ fontSize: ".9rem" }}>
            {isSubtask && task.parent_process_title?.trim() ? task.parent_process_title : task.title}
          </div>
          {isSubtask && (
            <div className="text-muted" style={{ fontSize: ".78rem" }}>
              <span className="fw-semibold">Your duty:</span> {task.title}
              {teamPreview ? (
                <span className="ms-2">
                  <span className="fw-semibold">Team:</span> {teamPreview}
                </span>
              ) : null}
            </div>
          )}
        </td>
        <td>
          <span className="status-badge" style={{
            background: task.status === "Completed" ? "#dcfce7" : task.status === "Under Review" ? "#eff6ff" : overdue ? "#fee2e2" : "#f1f5f9",
            color: task.status === "Completed" ? "#15803d" : task.status === "Under Review" ? "var(--mubs-blue)" : overdue ? "#b91c1c" : "#475569",
            fontSize: ".75rem",
          }}>
            {overdue && task.status !== "Completed" ? "Overdue" : task.status}
          </span>
        </td>
        <td>
          <span style={{ fontSize: ".8rem", color: "#64748b" }}>{task.startDate ? new Date(task.startDate).toLocaleDateString() : "N/A"}</span>
        </td>
        <td>
          <span style={{ fontSize: ".8rem", color: "#64748b" }}>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "TBD"}</span>
        </td>
        <td className="pe-4 text-end text-nowrap" style={{ width: '1%' }}>
          <button
            type="button"
            onClick={() => handleOpenModal(task)}
            className="btn btn-sm btn-outline-primary fw-bold d-inline-flex align-items-center gap-1 text-nowrap"
            style={{ borderRadius: "8px", fontSize: ".8rem", whiteSpace: "nowrap" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{task.status === "Completed" || task.status === "Under Review" || task.status === "Incomplete" ? "visibility" : "assignment"}</span>
            {task.status === "Completed" || task.status === "Under Review" || task.status === "Incomplete" ? "View Details" : "View process"}
          </button>
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="content-area w-100">
      {/* Stat Cards (Admin-style) */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            icon="pending"
            label="Under Review"
            value={tasks.filter(t => t.status === 'Under Review').length}
            badge="Awaiting Feed"
            badgeIcon="hourglass_empty"
            color="blue"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            icon="pending_actions"
            label="Active"
            value={tasks.filter(t => t.status !== 'Completed' && t.status !== 'Under Review' && t.daysLeft >= 0).length}
            badge="Current"
            badgeIcon="schedule"
            color="yellow"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            icon="running_with_errors"
            label="Overdue"
            value={tasks.filter(t => t.status !== 'Completed' && t.status !== 'Under Review' && t.daysLeft < 0).length}
            badge="Urgent Action"
            badgeIcon="priority_high"
            color="red"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            icon="check_circle"
            label="Completed"
            value={tasks.filter(t => t.status === 'Completed').length}
            badge="Total History"
            badgeIcon="history"
            color="green"
          />
        </div>
      </div>

      {/* Tasks Table */}
      <div className="table-card p-0 overflow-hidden" style={{ borderRadius: '20px', border: '1px solid #e2e8f0' }}>
        <div className="table-card-header d-flex justify-content-between align-items-center p-4" style={{ background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
          <h5 className="mb-0 d-flex align-items-center gap-2 fw-bold" style={{ color: 'var(--mubs-navy)' }}>
            <span className="material-symbols-outlined" style={{ color: "var(--mubs-blue)" }}>checklist</span>
            My Assigned Processes
          </h5>
        </div>

        <div className="d-flex px-4 pt-2 bg-white border-bottom gap-4" style={{ overflowX: 'auto' }}>
            {[
              { id: 'overdue', label: '🚨 Overdue', badgeBg: '#fee2e2', badgeColor: '#b91c1c', count: tasks.filter(t => t.status !== 'Completed' && t.status !== 'Under Review' && t.daysLeft < 0).length },
              { id: 'active', label: '📅 Active', badgeBg: '#fef3c7', badgeColor: '#92400e', count: tasks.filter(t => t.status !== 'Completed' && t.status !== 'Under Review' && t.daysLeft >= 0).length },
              { id: 'review', label: 'Under Review', badgeBg: '#eff6ff', badgeColor: 'var(--mubs-blue)', count: tasks.filter(t => t.status === 'Under Review').length },
              { id: 'history', label: 'Completed', badgeBg: '#dcfce7', badgeColor: '#15803d', count: tasks.filter(t => t.status === 'Completed').length },
            ].map(tab => (
              <button
                key={tab.id}
                className={`pb-2 px-1 fw-bold border-0 bg-transparent position-relative flex-shrink-0 ${activeTab === tab.id ? 'text-primary' : 'text-muted'}`}
                style={{ fontSize: '0.82rem', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                onClick={() => setActiveTab(tab.id as any)}
              >
                {tab.label}
                <span className="badge rounded-pill ms-2" style={{ background: tab.badgeBg, color: tab.badgeColor, fontSize: '0.65rem' }}>{tab.count}</span>
                {activeTab === tab.id && <div className="position-absolute bottom-0 start-0 w-100 bg-primary" style={{ height: '3px', borderRadius: '3px 3px 0 0' }}></div>}
              </button>
            ))}
          </div>

        <div className="table-responsive">
        <table className="table mb-0 align-middle">
            <thead className="bg-light">
              <tr>
                <th className="ps-4">Process</th>
                <th>Status</th>
                <th>Start Date</th>
                <th>Due Date</th>
                <th className="pe-4 text-end text-nowrap" style={{ width: '1%' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {currentTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-muted">
                      <span className="material-symbols-outlined d-block mb-2 text-muted" style={{ fontSize: "36px", opacity: 0.3 }}>checklist</span>
                    No processes found in this section.
                  </td>
                </tr>
              ) : (
                currentTasks.map(task => renderTaskRow(task))
              )}
            </tbody>
        </table>
        </div>

        {/* Pagination Controls */}
        {filteredTasks.length > 0 && (
          <div className="p-4 border-top d-flex justify-content-between align-items-center bg-white" style={{ borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
            <div className="text-muted fw-bold" style={{ fontSize: '0.75rem' }}>
              Showing <span className="text-dark">{indexOfFirstItem + 1}</span> to <span className="text-dark">{Math.min(indexOfLastItem, filteredTasks.length)}</span> of <span className="text-dark">{filteredTasks.length}</span> processes
            </div>
            <div className="pagination-controls d-flex gap-2">
              <button 
                  className="btn btn-sm btn-outline-light border text-dark d-flex align-items-center justify-content-center p-0"
                  style={{ width: '32px', height: '32px', borderRadius: '8px', opacity: currentPage === 1 ? 0.5 : 1 }}
                  disabled={currentPage === 1}
                  onClick={() => { setCurrentPage(prev => prev - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button 
                      key={page}
                      className={`btn btn-sm fw-bold d-flex align-items-center justify-content-center p-0 ${currentPage === page ? 'btn-primary shadow-sm' : 'btn-outline-light border text-dark'}`}
                      style={{ width: '32px', height: '32px', borderRadius: '8px', fontSize: '0.75rem', transition: 'all 0.2s' }}
                      onClick={() => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  >
                      {page}
                  </button>
              ))}

              <button 
                  className="btn btn-sm btn-outline-light border text-dark d-flex align-items-center justify-content-center p-0"
                  style={{ width: '32px', height: '32px', borderRadius: '8px', opacity: currentPage === totalPages || totalPages === 0 ? 0.5 : 1 }}
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        show={showProcessDetails && !!selectedTaskForReport}
        onHide={() => setShowProcessDetails(false)}
        centered
        backdrop="static"
        size="lg"
      >
        <Modal.Header closeButton style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <Modal.Title className="fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: "0.98rem" }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: "22px" }}>description</span>
            Task details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          {selectedTaskForReport && (
            <div className="text-dark" style={{ fontSize: "0.88rem" }}>
              <div className="d-flex justify-content-between align-items-start gap-3">
                <div className="flex-grow-1">
                  <div className="fw-semibold" style={{ fontSize: "1.0rem", lineHeight: 1.25 }}>
                    {selectedTaskForReport.assignment_type === 'process_subtask' && selectedTaskForReport.parent_process_title?.trim()
                      ? selectedTaskForReport.parent_process_title
                      : selectedTaskForReport.title}
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.78rem", marginTop: 2 }}>
                    {selectedTaskForReport.activity_title?.trim() ? selectedTaskForReport.activity_title : "Department task"}
                    {selectedTaskForReport.unit_name?.trim() ? ` · ${selectedTaskForReport.unit_name}` : ""}
                  </div>
                </div>
                <span
                  className="badge rounded-pill"
                  style={{
                    background: statusBadgeStyle(selectedTaskForReport.status).bg,
                    color: statusBadgeStyle(selectedTaskForReport.status).color,
                    fontSize: "0.72rem",
                    padding: "6px 10px",
                    whiteSpace: "nowrap",
                    border: "1px solid rgba(2,6,23,0.06)"
                  }}
                >
                  {selectedTaskForReport.status}
                </span>
              </div>

              {selectedTaskForReport.assignment_type === 'process_subtask' && (
                <div className="mt-3 p-3 rounded-3" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
                  <div className="row g-2">
                    <div className="col-12 col-md-6">
                      <div className="text-muted fw-bold mb-1" style={{ fontSize: "0.7rem" }}>
                        Your duty (sub-task)
                      </div>
                      <div className="text-dark fw-semibold" style={{ fontSize: "0.92rem", lineHeight: 1.35 }}>
                        {selectedTaskForReport.title}
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted fw-bold mb-1" style={{ fontSize: "0.7rem" }}>
                        Team members
                      </div>
                      <div className="text-secondary" style={{ whiteSpace: "pre-wrap", fontSize: "0.86rem", lineHeight: 1.45 }}>
                        {(selectedTaskForReport.team_members || "").trim() ? selectedTaskForReport.team_members : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="row g-2 mt-2">
                <div className="col-6">
                  <div className="p-2 rounded-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div className="text-muted fw-bold" style={{ fontSize: "0.7rem" }}>Start</div>
                    <div className="fw-semibold" style={{ fontSize: "0.85rem" }}>{formatProcessDetailDate(selectedTaskForReport.startDate)}</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-2 rounded-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div className="text-muted fw-bold" style={{ fontSize: "0.7rem" }}>Due</div>
                    <div className="fw-semibold" style={{ fontSize: "0.85rem" }}>{formatProcessDetailDate(selectedTaskForReport.dueDate)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 px-3 pb-3 justify-content-end">
        {selectedTaskForReport?.status === "Not opened" && (
          <div className="me-auto small text-muted">
            This process is not opened yet. You can submit once HOD opens it.
          </div>
        )}
          <Button
            variant="primary"
            className="fw-bold d-inline-flex align-items-center gap-2"
            style={{ borderRadius: "10px", padding: "10px 14px" }}
            onClick={openSubmitFromProcessDetails}
          disabled={selectedTaskForReport?.status === "Not opened"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>upload_file</span>
            {selectedTaskForReport?.status === "Returned" ? "Resubmit report" : "Submit report"}
          </Button>
        </Modal.Footer>
      </Modal>

      <TaskSubmissionModal
        key={`submit-${selectedTaskForReport?.id}`}
        show={showModal}
        onHide={() => setShowModal(false)}
        task={selectedTaskForReport}
        onSuccess={fetchData}
      />
      <SubmissionDetailModal
        key={`view-task-${selectedTaskForReport?.id}`}
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        taskId={selectedTaskForReport?.id}
        assignmentType={selectedTaskForReport?.assignment_type}
        submission={null}
        onRevise={() => {
          setShowViewModal(false);
          setShowModal(true);
        }}
      />
    </div>
  );
}

export default function StaffTasks() {
  return (
    <Suspense fallback={<div>Loading tasks...</div>}>
      <StaffTasksContent />
    </Suspense>
  );
}
