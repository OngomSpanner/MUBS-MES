"use client";

import React, { useState, useEffect } from 'react';

export default function StaffSubmitReport() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [loadingSubmit, setLoadingSubmit] = useState(false);

    const [taskVal, setTaskVal] = useState('');
    const [description, setDescription] = useState('');
    const [evidenceLink, setEvidenceLink] = useState('');
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [kpiActualValue, setKpiActualValue] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [tasksRes, subsRes] = await Promise.all([
                fetch('/api/staff/tasks'),
                fetch('/api/staff/submissions')
            ]);
            if (tasksRes.ok) {
                const tr = await tasksRes.json();
                setTasks(tr.tasks || []);
            }
            if (subsRes.ok) {
                const sr = await subsRes.json();
                setRecentSubmissions(sr.submissions || []);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoadingTasks(false);
        }
    };

    const handleTaskChange = (val: string) => {
        setTaskVal(val);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.size > 10 * 1024 * 1024) {
                alert('File too large. Max 10MB.');
                return;
            }
            setAttachedFile(file);
        }
    };

    const handleSubmit = async (isDraft: boolean) => {
        if (!taskVal) {
            alert("Please select a task.");
            return;
        }
        if (!isDraft && !description) {
            alert("Please provide report details.");
            return;
        }
        if (!isDraft && !attachedFile && !evidenceLink) {
            alert("Please provide evidence of work either by uploading a file or providing a link.");
            return;
        }

        setLoadingSubmit(true);
        try {
            const formData = new FormData();
            formData.append('taskId', taskVal);
            formData.append('description', description);
            formData.append('evidenceLink', evidenceLink);
            formData.append('isDraft', isDraft ? 'true' : 'false');
            if (attachedFile) {
                formData.append('file', attachedFile);
            }
            formData.append('kpiActualValue', kpiActualValue);

            const res = await fetch('/api/staff/submissions', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error saving report');

            // alert(isDraft ? 'Draft saved successfully!' : 'Report submitted successfully!');

            // reset form if not draft
            if (!isDraft) {
                setTaskVal('');
                setDescription('');
                setEvidenceLink('');
                setAttachedFile(null);
                setKpiActualValue('');
                fetchData(); // refresh sidebar
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoadingSubmit(false);
        }
    };

    const selectedTask = tasks.find(t => t.id.toString() === taskVal);

    return (
        <div className="content-area w-100">
            <div className="row g-4">
                <div className="col-12">
                    <div className="table-card">
                        <div className="table-card-header" style={{ background: 'linear-gradient(90deg,#eff6ff,#fff)' }}>
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>upload_file</span>Submit Task Report / Update</h5>
                        </div>
                        <div className="p-4">
                            <div className="row g-3">
                                {/* Task select */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small">Select Task <span className="text-danger">*</span></label>
                                    <select
                                        className="form-select"
                                        id="taskSelect"
                                        value={taskVal}
                                        onChange={(e) => handleTaskChange(e.target.value)}
                                        disabled={loadingTasks || loadingSubmit}
                                    >
                                        <option value="">— Choose a task —</option>
                                        {tasks.filter(t => t.status !== 'Completed').map(t => (
                                            <option key={t.id} value={t.id.toString()}>
                                                {t.title} {t.daysLeft < 0 ? '⚠ OVERDUE' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Task info callout */}
                                {selectedTask && (
                                    <div className="col-12" id="taskInfoBox">
                                        <div className="p-3 rounded" style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderLeft: '4px solid var(--mubs-blue)' }}>
                                            <div className="fw-bold text-dark mb-1" style={{ fontSize: '.82rem' }} id="taskInfoTitle">{selectedTask.title}</div>
                                            <div className="text-muted" style={{ fontSize: '.75rem' }} id="taskInfoDue">
                                                {selectedTask.daysLeft < 0
                                                    ? `⚠ Overdue · Was due ${new Date(selectedTask.dueDate).toLocaleDateString()}`
                                                    : `Due: ${new Date(selectedTask.dueDate).toLocaleDateString()} · ${selectedTask.daysLeft} days remaining`
                                                }
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* KPI Tracking Section */}
                                {selectedTask && selectedTask.task_type === 'kpi_driver' && (
                                    <div className="col-12" id="kpiTracking">
                                        <label className="form-label fw-bold text-dark small mb-1">
                                            KPI Value <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="form-control shadow-sm"
                                            placeholder="Enter achieved value..."
                                            value={kpiActualValue}
                                            onChange={(e) => setKpiActualValue(e.target.value)}
                                            disabled={loadingSubmit}
                                        />
                                    </div>
                                )}

                                {/* Description */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small">Report Details <span className="text-danger">*</span></label>
                                    <textarea
                                        className="form-control"
                                        rows={5}
                                        placeholder="Describe what was done, what remains, any challenges encountered..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        disabled={loadingSubmit}
                                    ></textarea>
                                </div>

                                {/* File upload zone */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small d-flex align-items-center gap-2">
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>attach_file</span>
                                        Attach Supporting File
                                    </label>
                                    <div className="upload-zone position-relative">
                                        <input
                                            type="file"
                                            className="form-control"
                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                            onChange={handleFileChange}
                                            disabled={loadingSubmit}
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                        />
                                        <span className="material-symbols-outlined">cloud_upload</span>
                                        {attachedFile ? (
                                            <div className="fw-bold text-success" style={{ fontSize: '.88rem' }}>{attachedFile.name}</div>
                                        ) : (
                                            <div className="fw-bold text-muted" style={{ fontSize: '.88rem' }}>Click to upload or drag &amp; drop</div>
                                        )}
                                        <div className="text-muted" style={{ fontSize: '.75rem' }}>PDF, DOCX, XLSX, PNG, JPG (Max 10MB)</div>
                                    </div>
                                    {attachedFile && (
                                        <div className="text-start mt-1">
                                            <button className="btn btn-sm btn-outline-danger p-0 px-2" style={{ fontSize: '0.75rem' }} onClick={() => setAttachedFile(null)} disabled={loadingSubmit}>Remove File</button>
                                        </div>
                                    )}
                                </div>

                                {/* Link section */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small d-flex align-items-center gap-2">
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>link</span>
                                        Download link (Google Drive, SharePoint, etc.)
                                    </label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-white"><span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#94a3b8' }}>insert_link</span></span>
                                        <input
                                            type="url"
                                            className="form-control"
                                            placeholder="https://drive.google.com/file/..."
                                            value={evidenceLink}
                                            onChange={(e) => setEvidenceLink(e.target.value)}
                                            disabled={loadingSubmit}
                                        />
                                    </div>
                                </div>

                                <div className="col-12 d-flex gap-3 flex-wrap mt-2">
                                    <button
                                        className="btn fw-bold text-white px-4 py-2 d-flex align-items-center justify-content-center shadow-sm"
                                        style={{ background: 'var(--mubs-blue)', borderRadius: '8px' }}
                                        onClick={() => handleSubmit(false)}
                                        disabled={loadingSubmit}
                                    >
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>send</span>
                                        {loadingSubmit ? 'Submitting...' : 'Submit for Review'}
                                    </button>
                                    <button
                                        className="btn btn-outline-secondary fw-bold d-flex align-items-center justify-content-center shadow-sm"
                                        style={{ borderRadius: '8px' }}
                                        onClick={() => handleSubmit(true)}
                                        disabled={loadingSubmit}
                                    >
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>save</span>
                                        Save Draft
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
