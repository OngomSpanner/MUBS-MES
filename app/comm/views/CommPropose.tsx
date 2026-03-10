"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function CommPropose() {
    const [minutesPreview, setMinutesPreview] = useState(false);
    const [evidenceLink, setEvidenceLink] = useState('');
    const [evidenceLinkPreview, setEvidenceLinkPreview] = useState(false);
    const [departments, setUnits] = useState<{ id: number, name: string }[]>([]);

    // Form State
    const [title, setTitle] = useState('');
    const [pillar, setPillar] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [description, setDescription] = useState('');
    const [kpi, setKpi] = useState('');
    const [suggestedUnit, setSuggestedUnit] = useState<number | ''>('');
    const [meetingRef, setMeetingRef] = useState('');
    const [deadline, setDeadline] = useState('');
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchUnits = async () => {
            try {
                const res = await axios.get('/api/departments');
                setUnits(res.data);
            } catch (err) {
                console.error("Failed to fetch departments", err);
            }
        };
        fetchUnits();
    }, []);

    const handlePreviewEvidenceLink = () => {
        if (evidenceLink) {
            setEvidenceLinkPreview(true);
        } else {
            alert("Please paste a valid URL first.");
        }
    };

    const submitProposal = async () => {
        if (!title || !description || !meetingRef) {
            alert("Please fill in all strictly required fields: Title, Description, and Meeting Reference.");
            return;
        }

        if (!minutesPreview) {
            alert("Please attach meeting minutes before submitting.");
            return;
        }

        if (!isConfirmed) {
            alert("You must confirm the declaration tickbox at the bottom before submitting.");
            return;
        }

        setIsSubmitting(true);
        try {
            await axios.post('/api/comm/proposals', {
                title,
                pillar,
                priority,
                description,
                kpi,
                suggested_unit_id: suggestedUnit ? suggestedUnit : null,
                meeting_reference: meetingRef,
                deadline: deadline || null,
                evidence_url: evidenceLink || 'simulated-minutes-doc.pdf'
            });

            alert("Proposal submitted successfully! It is now pending Admin review.");

            // Reset form
            setTitle(''); setPillar(''); setPriority('Medium'); setDescription('');
            setKpi(''); setSuggestedUnit(''); setMeetingRef(''); setDeadline('');
            setEvidenceLink(''); setEvidenceLinkPreview(false); setMinutesPreview(false); setIsConfirmed(false);

        } catch (error: any) {
            console.error("Error submitting proposal:", error);
            alert("Failed to submit proposal. " + (error.response?.data?.message || ""));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="content-area-comm">
            <div className="row g-4">
                <div className="col-12 col-lg-7">
                    <div className="table-card">
                        <div className="table-card-header" style={{ background: 'linear-gradient(90deg,#f5f3ff,#fff)' }}>
                            <h5><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>post_add</span>Propose a New Strategic Activity</h5>
                        </div>
                        <div className="p-4">

                            {/* Progress stepper */}
                            <div className="stepper mb-4">
                                <div className="step done" id="s1"><div className="step-dot"><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit_note</span></div><div className="step-label">Details</div></div>
                                <div className="step active-step" id="s2"><div className="step-dot">2</div><div className="step-label">Evidence</div></div>
                                <div className="step" id="s3"><div className="step-dot">3</div><div className="step-label">Review</div></div>
                                <div className="step" id="s4"><div className="step-dot">4</div><div className="step-label">Submit</div></div>
                            </div>

                            <div className="row g-3">
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small">Activity / Proposal Title <span className="text-danger">*</span></label>
                                    <input type="text" className="form-control" placeholder="e.g. Establish Post-Graduate Research Centre" value={title} onChange={(e) => setTitle(e.target.value)} />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Strategic Pillar</label>
                                    <select className="form-select" value={pillar} onChange={(e) => setPillar(e.target.value)}>
                                        <option value="">— Select pillar —</option>
                                        <option value="Teaching & Learning">Teaching &amp; Learning</option>
                                        <option value="Research & Innovation">Research &amp; Innovation</option>
                                        <option value="Infrastructure">Infrastructure</option>
                                        <option value="Industry Partnerships">Industry Partnerships</option>
                                        <option value="Governance">Governance</option>
                                        <option value="Finance & Resources">Finance &amp; Resources</option>
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Priority Level</label>
                                    <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small">Description / Rationale <span className="text-danger">*</span></label>
                                    <textarea className="form-control" rows={4} placeholder="Describe what this activity involves, why it is proposed, and what outcome it aims to achieve based on the committee's discussion..." value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Proposed KPI / Target</label>
                                    <input type="text" className="form-control" placeholder="e.g. 50 post-grad students enrolled by Dec 2025" value={kpi} onChange={(e) => setKpi(e.target.value)} />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Suggested Implementation Department</label>
                                    <select className="form-select" value={suggestedUnit} onChange={(e) => setSuggestedUnit(e.target.value ? parseInt(e.target.value) : '')}>
                                        <option value="">— Optional suggestion —</option>
                                        {departments.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Meeting / Session Reference <span className="text-danger">*</span></label>
                                    <input type="text" className="form-control" placeholder="e.g. Meeting #9 · 12 Apr 2025" value={meetingRef} onChange={(e) => setMeetingRef(e.target.value)} />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Proposed Deadline</label>
                                    <input type="date" className="form-control" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                                </div>

                                <div className="col-12"><hr style={{ borderColor: '#e2e8f0' }} /></div>

                                {/* Meeting minutes attachment */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small d-flex align-items-center gap-2">
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#7c3aed' }}>description</span>
                                        Attach Meeting Minutes <span className="text-danger">*</span>
                                        <span className="badge" style={{ background: '#f5f3ff', color: '#7c3aed', fontSize: '.65rem', fontWeight: 700 }}>Required</span>
                                    </label>
                                    <div className="upload-zone" onClick={() => alert('File picker opened')}>
                                        <span className="material-symbols-outlined">upload_file</span>
                                        <div className="fw-bold" style={{ fontSize: '.88rem', color: '#7c3aed' }}>Click to upload Meeting Minutes</div>
                                        <div className="text-muted" style={{ fontSize: '.75rem', marginTop: '2px' }}>PDF, DOCX · Max 20MB</div>
                                    </div>
                                    {minutesPreview && (
                                        <div className="mt-2 p-2 rounded d-flex align-items-center gap-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: '18px' }}>check_circle</span>
                                            <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#15803d' }}>meeting-minutes.pdf attached</span>
                                            <button className="btn-close ms-auto" style={{ fontSize: '.6rem' }} onClick={() => setMinutesPreview(false)}></button>
                                        </div>
                                    )}
                                    <button className="btn btn-link text-decoration-none p-0 mt-1 fw-bold" style={{ fontSize: '.78rem', color: '#7c3aed' }} onClick={() => setMinutesPreview(true)}>
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>simulation</span>Simulate file attached
                                    </button>
                                </div>

                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small d-flex align-items-center gap-2">
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#7c3aed' }}>link</span>
                                        Supporting Evidence Link (optional)
                                    </label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-white"><span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#94a3b8' }}>insert_link</span></span>
                                        <input type="url" className="form-control" placeholder="https://drive.google.com/..." value={evidenceLink} onChange={e => setEvidenceLink(e.target.value)} />
                                        <button className="btn btn-outline-secondary fw-bold" onClick={handlePreviewEvidenceLink}>Attach</button>
                                    </div>
                                    {evidenceLinkPreview && (
                                        <div className="mt-2">
                                            <div className="p-2 rounded d-flex align-items-center gap-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                                <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: '18px' }}>check_circle</span>
                                                <span style={{ fontSize: '.78rem', color: '#15803d', fontWeight: 700 }}>Evidence linked</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small d-flex align-items-center gap-2">
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#7c3aed' }}>attach_file</span>
                                        Additional Supporting Document (optional)
                                    </label>
                                    <div className="upload-zone" onClick={() => alert('File picker opened')}>
                                        <span className="material-symbols-outlined">cloud_upload</span>
                                        <div className="fw-bold text-muted" style={{ fontSize: '.85rem' }}>Attach research data, reports, or analysis</div>
                                        <div className="text-muted" style={{ fontSize: '.75rem' }}>PDF, DOCX, XLSX, PNG · Max 15MB</div>
                                    </div>
                                </div>

                                <div className="col-12">
                                    <div className="p-3 rounded" style={{ background: '#f5f3ff', border: '1px solid #ede9fe' }}>
                                        <div className="form-check">
                                            <input className="form-check-input" type="checkbox" id="declaration" style={{ borderColor: '#7c3aed' }} checked={isConfirmed} onChange={(e) => setIsConfirmed(e.target.checked)} />
                                            <label className="form-check-label" htmlFor="declaration" style={{ fontSize: '.82rem', color: '#4c1d95', fontWeight: 600 }}>
                                                I confirm that this proposal is based on a formal committee discussion and that the meeting minutes attached accurately reflect the decision made. I am authorised to submit on behalf of the Academic Board Committee.
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-12 d-flex gap-3 flex-wrap mt-1">
                                    <button className="btn fw-bold text-white px-4 py-2" style={{ background: '#7c3aed' }} onClick={submitProposal} disabled={isSubmitting}>
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>send</span>
                                        {isSubmitting ? 'Submitting...' : 'Submit Proposal'}
                                    </button>
                                    <button className="btn btn-outline-secondary fw-bold" onClick={() => alert('Draft saved successfully.')}>
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>save</span>Save Draft
                                    </button>
                                    <button className="btn btn-link text-danger fw-bold text-decoration-none">Discard</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right side tips */}
                <div className="col-12 col-lg-5 d-flex flex-column gap-4">
                    <div className="table-card">
                        <div className="table-card-header"><h5><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>tips_and_updates</span>Proposal Guidelines</h5></div>
                        <div className="p-4">
                            <div className="d-flex gap-3 mb-3 align-items-start">
                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#7c3aed' }}>description</span></div>
                                <div><div className="fw-bold text-dark" style={{ fontSize: '.84rem' }}>Minutes are mandatory</div><div className="text-muted" style={{ fontSize: '.76rem' }}>Every proposal must be backed by meeting minutes. Proposals without attached minutes will be returned without review.</div></div>
                            </div>
                            <div className="d-flex gap-3 mb-3 align-items-start">
                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#059669' }}>fact_check</span></div>
                                <div><div className="fw-bold text-dark" style={{ fontSize: '.84rem' }}>Be specific about outcomes</div><div className="text-muted" style={{ fontSize: '.76rem' }}>State a measurable KPI. Vague proposals are harder to approve and assign to departments.</div></div>
                            </div>
                            <div className="d-flex gap-3 mb-3 align-items-start">
                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>assignment_ind</span></div>
                                <div><div className="fw-bold text-dark" style={{ fontSize: '.84rem' }}>Suggest an implementation department</div><div className="text-muted" style={{ fontSize: '.76rem' }}>Although not required, suggesting a department speeds up the approval and assignment process.</div></div>
                            </div>
                            <div className="d-flex gap-3 align-items-start">
                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#b45309' }}>schedule</span></div>
                                <div><div className="fw-bold text-dark" style={{ fontSize: '.84rem' }}>Approval takes 5–10 working days</div><div className="text-muted" style={{ fontSize: '.76rem' }}>Proposals go to Admin for review, then to the Principal for final sign-off before a department is assigned.</div></div>
                            </div>
                        </div>
                    </div>

                    <div className="table-card">
                        <div className="table-card-header"><h5><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>account_tree</span>Proposal Workflow</h5></div>
                        <div className="p-4">
                            <div className="timeline-item">
                                <div className="timeline-dot" style={{ background: '#f5f3ff' }}><span className="material-symbols-outlined" style={{ color: '#7c3aed' }}>post_add</span></div>
                                <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>1 · Committee Submits Proposal</div>
                                <div className="text-muted" style={{ fontSize: '.75rem' }}>With meeting minutes and evidence attached</div>
                            </div>
                            <div className="timeline-item">
                                <div className="timeline-dot" style={{ background: '#fffbeb' }}><span className="material-symbols-outlined" style={{ color: '#b45309' }}>manage_accounts</span></div>
                                <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>2 · Admin Review</div>
                                <div className="text-muted" style={{ fontSize: '.75rem' }}>Strategic alignment and feasibility check</div>
                            </div>
                            <div className="timeline-item">
                                <div className="timeline-dot" style={{ background: '#eff6ff' }}><span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>gavel</span></div>
                                <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>3 · Principal Decision</div>
                                <div className="text-muted" style={{ fontSize: '.75rem' }}>Approved or rejected with feedback</div>
                            </div>
                            <div className="timeline-item">
                                <div className="timeline-dot" style={{ background: '#dcfce7' }}><span className="material-symbols-outlined" style={{ color: '#059669' }}>assignment_ind</span></div>
                                <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>4 · Department Assigned (if approved)</div>
                                <div className="text-muted" style={{ fontSize: '.75rem' }}>Responsible department notified; activity tracked</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
