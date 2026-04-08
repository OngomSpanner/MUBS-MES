"use client";

import React, { useState } from "react";
import { Modal, Button } from "react-bootstrap";
import axios from "axios";

export interface StaffTaskSubmissionContext {
  id: number;
  title: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  status?: string;
  task_type?: 'process' | 'kpi_driver';
  kpi_target_value?: number | null;
  assignment_type?: 'legacy' | 'process_task' | 'process_subtask';
  instruction?: string | null;
}

interface TaskSubmissionModalProps {
  show: boolean;
  onHide: () => void;
  task: StaffTaskSubmissionContext | null;
  onSuccess?: () => void;
}

export default function TaskSubmissionModal({ show, onHide, task, onSuccess }: TaskSubmissionModalProps) {
  const [description, setDescription] = useState("");
  const [evidenceLink, setEvidenceLink] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [kpiActualValue, setKpiActualValue] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [submission, setSubmission] = useState<any>(null);

  React.useEffect(() => {
    if (show && task) {
      setDescription("");
      setEvidenceLink("");
      setAttachedFile(null);
      setExistingAttachments([]);
      setSubmission(null);
      setKpiActualValue("");
      setErrorMsg("");
      setSuccessMsg("");
      
      const fetchSubmission = async () => {
        setFetching(true);
        try {
          const res = await axios.get("/api/staff/submissions");
          const allSubmissions = res.data.submissions || [];
          const found = allSubmissions.find((s: any) => s.task_id === task.id);
          
          if (found) {
            setSubmission(found);
            setDescription(found.description || "");
            setKpiActualValue(found.kpi_actual_value != null ? found.kpi_actual_value.toString() : "");
            
            if (found.attachments) {
              const parts = found.attachments.split(" | ");
              const files: string[] = [];
              let foundLink = "";
              
              parts.forEach((p: string) => {
                if (p.startsWith("http")) foundLink = p;
                else if (p.startsWith("/uploads/")) files.push(p);
              });
              setExistingAttachments(files);
              setEvidenceLink(foundLink);
            }
          }
        } catch (err) {
          console.error("Error fetching submission:", err);
        } finally {
          setFetching(false);
        }
      };

      if (
        task.status === "In Progress" ||
        task.status === "Returned" ||
        task.status === "Incomplete" ||
        task.status === "Under Review"
      ) {
          fetchSubmission();
      }
    }
  }, [show, task]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg("File too large. Max 10MB.");
        return;
      }
      setAttachedFile(file);
    }
  };

  const handleSubmit = async (isDraft: boolean) => {
    if (!task) return;
    if (!isDraft && !description.trim()) {
      setErrorMsg("Report Details are required to submit.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const formData = new FormData();
      formData.append("taskId", task.id.toString());
      formData.append("assignmentType", task.assignment_type || 'legacy');
      formData.append("description", description);
      formData.append("evidenceLink", evidenceLink);
      formData.append("isDraft", isDraft ? "true" : "false");
      formData.append("kpiActualValue", kpiActualValue);
      if (attachedFile) {
        formData.append("file", attachedFile);
      }

      await axios.post("/api/staff/submissions", formData);

      setSuccessMsg(isDraft ? "Draft saved successfully!" : "Report submitted successfully!");
      
      setTimeout(() => {
        onHide();
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.response?.data?.message || err.message || "An unexpected error occurred.");
      console.error(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={() => !submitting && onHide()} centered backdrop="static" keyboard={false} size="lg">
      <Modal.Header closeButton style={{ background: 'linear-gradient(90deg,#eff6ff,#fff)', borderBottom: '1px solid #e2e8f0', padding: '0.75rem 1rem' }}>
        <Modal.Title className="fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.05rem' }}>
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '22px' }}>upload_file</span>
          Submit Report
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        {fetching ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary me-2"></div>
            <div className="text-muted" style={{ fontSize: '0.9rem' }}>Loading report details...</div>
          </div>
        ) : (
          <div className="row g-3">
            {errorMsg && (
                <div className="col-12">
                    <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 border-0 shadow-sm" style={{ borderRadius: '8px', fontSize: '0.82rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
                        {errorMsg}
                    </div>
                </div>
            )}
            {successMsg && (
                <div className="col-12">
                    <div className="alert alert-success d-flex align-items-center gap-2 py-2 px-3 border-0 shadow-sm" style={{ borderRadius: '8px', fontSize: '0.82rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                        {successMsg}
                    </div>
                </div>
            )}

            {/* Task summary: no strategic activity / pillar / objective text */}
            {task && (
                <div className="col-12">
                    <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '4px solid var(--mubs-blue)' }}>
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>assignment</span>
                            <span className="fw-bold text-dark small">Your task</span>
                        </div>
                        <div className="mb-2">
                            <div className="text-muted fw-bold" style={{ fontSize: '0.68rem' }}>Task</div>
                            <div className="fw-semibold text-dark" style={{ fontSize: '0.9rem' }}>{task.title}</div>
                        </div>
                        <div className="d-flex gap-4 flex-wrap">
                            <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: '0.75rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_today</span>
                                <span className="fw-bold">Start:</span> {task.startDate ? new Date(task.startDate).toLocaleDateString() : 'N/A'}
                            </div>
                            <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: '0.75rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>event_available</span>
                                <span className="fw-bold">End date:</span> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="col-12">
              <label className="form-label fw-bold text-dark small">
                Report Details <span className="text-danger">*</span>
              </label>
              <textarea
                className="form-control"
                rows={5}
                placeholder="Describe what was done, what remains, any challenges encountered..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
              ></textarea>
            </div>

            {task?.task_type === 'kpi_driver' && (
              <div className="col-12">
                <label className="form-label fw-bold text-dark small mb-1">
                  KPI Value
                </label>
                <input
                  type="text"
                  className="form-control shadow-sm"
                  placeholder="Enter achieved value..."
                  value={kpiActualValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                      setKpiActualValue(val);
                    }
                  }}
                  disabled={submitting}
                />
              </div>
            )}
            
            <div className="col-12">
              <label className="form-label fw-bold text-dark small d-flex align-items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>attach_file</span>
                Attach Supporting File
              </label>
              {existingAttachments.length > 0 && (
                  <div className="mb-2 p-2 border rounded-2 bg-light d-flex align-items-center gap-2">
                      <span className="material-symbols-outlined text-success" style={{ fontSize: '18px' }}>check_circle</span>
                      <span className="small text-muted">A file is already attached. Uploading a new one will replace it.</span>
                  </div>
              )}
              <input
                type="file"
                className="form-control"
                onChange={handleFileChange}
                disabled={submitting}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              />
              <small className="text-muted">PDF, DOCX, XLSX, PNG, JPG (Max 10MB)</small>
            </div>

            <div className="col-12">
              <label className="form-label fw-bold text-dark small d-flex align-items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>link</span>
                Download link (Google Drive, SharePoint, etc.)
              </label>
              <input
                type="url"
                className="form-control"
                placeholder="https://drive.google.com/..."
                value={evidenceLink}
                onChange={(e) => setEvidenceLink(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer className="border-0 bg-light p-3 d-flex justify-content-end">
        <Button style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)', borderRadius: '8px' }} className="fw-bold text-white px-4" onClick={() => handleSubmit(false)} disabled={submitting}>
          {submitting ? 'Submitting...' : (task?.status === 'Returned' || task?.status === 'Incomplete' || task?.status === 'Under Review' ? 'Resubmit' : 'Submit for Review')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
