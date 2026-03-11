"use client";

import React, { useState, useEffect } from 'react';

export default function StaffSubmitReport() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [loadingSubmit, setLoadingSubmit] = useState(false);

    const [taskVal, setTaskVal] = useState('');
    const [progressVal, setProgressVal] = useState('0');
    const [reportType, setReportType] = useState('progress');
    const [description, setDescription] = useState('');
    const [evidenceLink, setEvidenceLink] = useState('');
    const [attachedFile, setAttachedFile] = useState<File | null>(null);

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
        const t = tasks.find(x => x.id.toString() === val);
        if (t) {
            setProgressVal(t.progress?.toString() || '0');
        } else {
            setProgressVal('0');
        }
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

        setLoadingSubmit(true);
        try {
            const formData = new FormData();
            formData.append('taskId', taskVal);
            formData.append('progress', progressVal);
            formData.append('reportType', reportType);
            formData.append('description', description);
            formData.append('evidenceLink', evidenceLink);
            formData.append('isDraft', isDraft ? 'true' : 'false');
            if (attachedFile) {
                formData.append('file', attachedFile);
            }

            const res = await fetch('/api/staff/submissions', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error saving report');

            alert(isDraft ? 'Draft saved successfully!' : 'Report submitted successfully!');

            // reset form if not draft
            if (!isDraft) {
                setTaskVal('');
                setProgressVal('0');
                setDescription('');
                setEvidenceLink('');
                setReportType('progress');
                setAttachedFile(null);
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
                <div className="col-12 col-lg-7">
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

                                {/* Report type */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small">Report Type</label>
                                    <div className="d-flex gap-3 flex-wrap">
                                        <div className="form-check">
                                            <input className="form-check-input" type="radio" name="reportType" id="rt1" value="progress"
                                                checked={reportType === 'progress'}
                                                onChange={(e) => setReportType(e.target.value)}
                                            />
                                            <label className="form-check-label small fw-bold" htmlFor="rt1">Progress Update</label>
                                        </div>
                                        <div className="form-check">
                                            <input className="form-check-input" type="radio" name="reportType" id="rt2" value="completion"
                                                checked={reportType === 'completion'}
                                                onChange={(e) => setReportType(e.target.value)}
                                            />
                                            <label className="form-check-label small fw-bold" htmlFor="rt2">Completion Report</label>
                                        </div>
                                        <div className="form-check">
                                            <input className="form-check-input" type="radio" name="reportType" id="rt3" value="issue"
                                                checked={reportType === 'issue'}
                                                onChange={(e) => setReportType(e.target.value)}
                                            />
                                            <label className="form-check-label small fw-bold" htmlFor="rt3">Issue / Blocker</label>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress slider */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small">Current Progress: <span id="progressVal" className="text-primary">{progressVal}</span>%</label>
                                    <input type="range" className="form-range" min="0" max="100" step="5" value={progressVal} onChange={(e) => setProgressVal(e.target.value)} disabled={loadingSubmit} />
                                </div>

                                {/* Description */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small">Report Details <span className="text-danger">*</span></label>
                                    <textarea
                                        className="form-control"
                                        rows={5}
                                        placeholder="Describe what was done, what remains, any challenges encountered...&#10;&#10;e.g. Installed and configured 2 of 4 network switches in Lab A. Encountered IP conflict issue — resolved by reassigning VLAN. Lab B configuration pending hardware delivery on 22 Apr."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        disabled={loadingSubmit}
                                    ></textarea>
                                </div>

                                {/* Evidence link */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small d-flex align-items-center gap-2"><span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>link</span>Evidence Link (Google Drive, SharePoint, etc.)</label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-white"><span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#94a3b8' }}>insert_link</span></span>
                                        <input
                                            type="url"
                                            className="form-control"
                                            id="evidenceLinkInput"
                                            placeholder="https://drive.google.com/file/..."
                                            value={evidenceLink}
                                            onChange={(e) => setEvidenceLink(e.target.value)}
                                            disabled={loadingSubmit}
                                        />
                                        <button className="btn btn-outline-secondary fw-bold" type="button" onClick={() => evidenceLink ? window.open(evidenceLink, '_blank') : alert('Please enter a link first.')}>Preview</button>
                                    </div>
                                </div>

                                {/* File upload zone */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small d-flex align-items-center gap-2"><span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>attach_file</span>Attach Supporting File (optional)</label>
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
                                        <div className="text-muted" style={{ fontSize: '.75rem' }}>PDF, DOCX, XLSX, PNG, JPG · Max 10MB</div>
                                    </div>
                                    {attachedFile && (
                                        <div className="text-start mt-1">
                                            <button className="btn btn-sm btn-outline-danger p-0 px-2" style={{ fontSize: '0.75rem' }} onClick={() => setAttachedFile(null)} disabled={loadingSubmit}>Remove File</button>
                                        </div>
                                    )}
                                </div>

                                <div className="col-12 d-flex gap-3 flex-wrap mt-1">
                                    <button
                                        className="btn fw-bold text-white px-4 py-2 d-flex align-items-center justify-content-center"
                                        style={{ background: 'var(--mubs-blue)' }}
                                        onClick={() => handleSubmit(false)}
                                        disabled={loadingSubmit}
                                    >
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>send</span>
                                        {loadingSubmit ? 'Submitting...' : 'Submit Report'}
                                    </button>
                                    <button
                                        className="btn btn-outline-secondary fw-bold d-flex align-items-center justify-content-center"
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

                {/* Tips & recent submissions */}
                <div className="col-12 col-lg-5 d-flex flex-column gap-4">
                    <div className="table-card">
                        <div className="table-card-header"><h5><span className="material-symbols-outlined me-2" style={{ color: '#b45309' }}>tips_and_updates</span>Submission Tips</h5></div>
                        <div className="p-4">
                            <div className="d-flex gap-3 mb-3 align-items-start">
                                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}><span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>link</span></div>
                                <div><div className="fw-bold text-dark" style={{ fontSize: '.84rem' }}>Include Evidence Links</div><div className="text-muted" style={{ fontSize: '.76rem' }}>Attach a Google Drive or SharePoint link to photos, spreadsheets, or documents supporting your report.</div></div>
                            </div>
                            <div className="d-flex gap-3 mb-3 align-items-start">
                                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}><span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#059669' }}>fact_check</span></div>
                                <div><div className="fw-bold text-dark" style={{ fontSize: '.84rem' }}>Be Specific</div><div className="text-muted" style={{ fontSize: '.76rem' }}>State what was done, quantities, dates and any obstacles clearly. Vague reports often get returned for revision.</div></div>
                            </div>
                            <div className="d-flex gap-3 mb-3 align-items-start">
                                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}><span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#b45309' }}>schedule</span></div>
                                <div><div className="fw-bold text-dark" style={{ fontSize: '.84rem' }}>Submit Before Deadline</div><div className="text-muted" style={{ fontSize: '.76rem' }}>Late submissions affect your evaluation score. Use Progress Updates if a task isn't yet complete.</div></div>
                            </div>
                            <div className="d-flex gap-3 align-items-start">
                                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}><span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-red)' }}>report_problem</span></div>
                                <div><div className="fw-bold text-dark" style={{ fontSize: '.84rem' }}>Report Blockers Early</div><div className="text-muted" style={{ fontSize: '.76rem' }}>If you're facing an issue, submit an "Issue / Blocker" report immediately — don't wait for the deadline.</div></div>
                            </div>
                        </div>
                    </div>

                    <div className="table-card">
                        <div className="table-card-header"><h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>history</span>Recent Submissions</h5></div>
                        <div className="p-3 d-flex flex-column gap-2">
                            {recentSubmissions.length === 0 ? (
                                <div className="text-muted small">No recent submissions found.</div>
                            ) : (
                                recentSubmissions.slice(0, 5).map(sub => (
                                    <div key={sub.id} className="d-flex align-items-center gap-3 p-2 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                        <span className="material-symbols-outlined" style={{ color: sub.status === 'Completed' ? '#059669' : sub.status === 'Under Review' ? '#b45309' : '#0ea5e9', fontSize: '22px' }}>
                                            {sub.status === 'Completed' ? 'check_circle' : sub.status === 'Under Review' ? 'pending_actions' : 'info'}
                                        </span>
                                        <div className="flex-fill">
                                            <div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>{sub.report_name}</div>
                                            <div className="text-muted" style={{ fontSize: '.73rem' }}>
                                                {new Date(sub.submitted_at).toLocaleDateString()} · {sub.status}
                                                {sub.score ? ` · Score: ${sub.score}/5` : ''}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
