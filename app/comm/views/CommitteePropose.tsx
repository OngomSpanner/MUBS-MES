"use client";

import React, { useState } from 'react';

export default function CommitteePropose() {
    const [minutesPreview, setMinutesPreview] = useState(false);
    const [evidenceLink, setEvidenceLink] = useState('');
    const [evidenceLinkPreview, setEvidenceLinkPreview] = useState(false);

    const previewEvidenceLink = () => {
        if (evidenceLink) {
            setEvidenceLinkPreview(true);
            alert('Evidence link attached.');
        } else {
            alert('Please paste a valid URL first.');
        }
    };

    const submitProposal = () => {
        const declaration = (document.getElementById('declaration') as HTMLInputElement)?.checked;
        if (!declaration) {
            alert('Please confirm the declaration before submitting.');
            return;
        }
        alert('Proposal submitted successfully! It is now pending Admin review.');
        window.location.href = '/committee?pg=pending';
    };

    return (
        <div id="page-propose" className="page-section active-page">
            <div className="row g-4">
                <div className="col-12 col-lg-7">
                    <div className="table-card" style={{ borderRadius: '14px', background: '#fff', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.12)' }}>
                        <div className="table-card-header" style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(90deg,#f5f3ff,#fff)' }}>
                            <h5 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>post_add</span>Propose a New Strategic Activity</h5>
                        </div>
                        <div className="p-4">

                            {/* Progress stepper */}
                            <div className="stepper mb-4 d-flex align-items-start gap-0">
                                <div className="step done" style={{ flex: 1, position: 'relative', textAlign: 'center' }}>
                                    <div className="step-dot" style={{ width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto .4rem', fontSize: '.8rem', fontWeight: 800, position: 'relative', zIndex: 1, border: '2px solid #10b981', background: '#10b981', color: '#fff' }}><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit_note</span></div>
                                    <div className="step-label" style={{ fontSize: '.68rem', fontWeight: 700, color: '#059669' }}>Details</div>
                                    <div style={{ position: 'absolute', top: '16px', left: '50%', width: '100%', height: '2px', background: '#10b981', zIndex: 0 }}></div>
                                </div>
                                <div className="step active-step" style={{ flex: 1, position: 'relative', textAlign: 'center' }}>
                                    <div className="step-dot" style={{ width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto .4rem', fontSize: '.8rem', fontWeight: 800, position: 'relative', zIndex: 1, border: '2px solid #7c3aed', background: '#7c3aed', color: '#fff' }}>2</div>
                                    <div className="step-label" style={{ fontSize: '.68rem', fontWeight: 700, color: '#7c3aed' }}>Evidence</div>
                                    <div style={{ position: 'absolute', top: '16px', left: '50%', width: '100%', height: '2px', background: 'linear-gradient(90deg,#7c3aed,#e2e8f0)', zIndex: 0 }}></div>
                                </div>
                                <div className="step" style={{ flex: 1, position: 'relative', textAlign: 'center' }}>
                                    <div className="step-dot" style={{ width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto .4rem', fontSize: '.8rem', fontWeight: 800, position: 'relative', zIndex: 1, border: '2px solid #e2e8f0', background: '#fff', color: '#94a3b8' }}>3</div>
                                    <div className="step-label" style={{ fontSize: '.68rem', fontWeight: 700, color: '#94a3b8' }}>Review</div>
                                    <div style={{ position: 'absolute', top: '16px', left: '50%', width: '100%', height: '2px', background: '#e2e8f0', zIndex: 0 }}></div>
                                </div>
                                <div className="step" style={{ flex: 1, position: 'relative', textAlign: 'center' }}>
                                    <div className="step-dot" style={{ width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto .4rem', fontSize: '.8rem', fontWeight: 800, position: 'relative', zIndex: 1, border: '2px solid #e2e8f0', background: '#fff', color: '#94a3b8' }}>4</div>
                                    <div className="step-label" style={{ fontSize: '.68rem', fontWeight: 700, color: '#94a3b8' }}>Submit</div>
                                </div>
                            </div>

                            <div className="row g-3">
                                {/* Activity details */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small">Activity / Proposal Title <span className="text-danger">*</span></label>
                                    <input type="text" className="form-control" id="proposalTitle" placeholder="e.g. Establish Post-Graduate Research Centre" />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Strategic Pillar <span className="text-danger">*</span></label>
                                    <select className="form-select" id="pillarSelect">
                                        <option value="">— Select pillar —</option>
                                        <option>Teaching &amp; Learning</option>
                                        <option>Research &amp; Innovation</option>
                                        <option>Infrastructure</option>
                                        <option>Industry Partnerships</option>
                                        <option>Governance</option>
                                        <option>Finance &amp; Resources</option>
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Priority Level</label>
                                    <select className="form-select">
                                        <option>High</option>
                                        <option>Medium</option>
                                        <option>Low</option>
                                    </select>
                                </div>
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small">Description / Rationale <span className="text-danger">*</span></label>
                                    <textarea className="form-control" rows={4} placeholder="Describe what this activity involves, why it is proposed, and what outcome it aims to achieve based on the committee's discussion..."></textarea>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Proposed KPI / Target</label>
                                    <input type="text" className="form-control" placeholder="e.g. 50 post-grad students enrolled by Dec 2025" />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Suggested Implementation Department</label>
                                    <select className="form-select">
                                        <option value="">— Optional suggestion —</option>
                                        <option>Faculty of Computing</option>
                                        <option>Faculty of Commerce</option>
                                        <option>Research &amp; Innovation</option>
                                        <option>Finance &amp; Administration</option>
                                        <option>Library</option>
                                        <option>Student Affairs</option>
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Meeting / Session Reference <span className="text-danger">*</span></label>
                                    <input type="text" className="form-control" id="meetingRef" placeholder="e.g. Meeting #9 · 12 Apr 2025" />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Proposed Deadline</label>
                                    <input type="date" className="form-control" />
                                </div>

                                {/* Divider */}
                                <div className="col-12"><hr style={{ borderColor: '#e2e8f0' }} /></div>

                                {/* Meeting minutes attachment */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small d-flex align-items-center gap-2">
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#7c3aed' }}>description</span>
                                        Attach Meeting Minutes <span className="text-danger">*</span>
                                        <span className="badge" style={{ background: '#f5f3ff', color: '#7c3aed', fontSize: '.65rem', fontWeight: 700 }}>Required</span>
                                    </label>
                                    <div className="upload-zone" onClick={() => alert('File picker opened (demo).')} style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '2rem 1.5rem', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '2.8rem', color: '#cbd5e1', marginBottom: '.4rem', display: 'block' }}>upload_file</span>
                                        <div className="fw-bold" style={{ fontSize: '.88rem', color: '#7c3aed' }}>Click to upload Meeting Minutes</div>
                                        <div className="text-muted" style={{ fontSize: '.75rem', marginTop: '2px' }}>PDF, DOCX · Max 20MB</div>
                                    </div>
                                    {minutesPreview && (
                                        <div className="mt-2 p-2 rounded d-flex align-items-center gap-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }} id="minutesPreview">
                                            <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: '18px' }}>check_circle</span>
                                            <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#15803d' }}>meeting-minutes-apr-12-2025.pdf attached</span>
                                            <button className="btn-close ms-auto" style={{ fontSize: '.6rem' }} onClick={() => setMinutesPreview(false)}></button>
                                        </div>
                                    )}
                                    {!minutesPreview && (
                                        <button className="btn btn-link text-decoration-none p-0 mt-1 fw-bold" style={{ fontSize: '.78rem', color: '#7c3aed' }} onClick={() => setMinutesPreview(true)}>
                                            <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>simulation</span>Simulate file attached (demo)
                                        </button>
                                    )}
                                </div>

                                {/* Supporting evidence link */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small d-flex align-items-center gap-2">
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#7c3aed' }}>link</span>
                                        Supporting Evidence Link (optional)
                                    </label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-white"><span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#94a3b8' }}>insert_link</span></span>
                                        <input type="url" className="form-control" id="evidenceLink" placeholder="https://drive.google.com/... or SharePoint link" value={evidenceLink} onChange={e => setEvidenceLink(e.target.value)} />
                                        <button className="btn btn-outline-secondary fw-bold" onClick={previewEvidenceLink}>Attach</button>
                                    </div>
                                    {evidenceLinkPreview && (
                                        <div id="evidenceLinkPreview" className="mt-2">
                                            <div className="p-2 rounded d-flex align-items-center gap-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                                <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: '18px' }}>check_circle</span>
                                                <span style={{ fontSize: '.78rem', color: '#15803d', fontWeight: 700 }} id="evidenceLinkText">✓ Evidence linked: {evidenceLink.substring(0, 55)}{(evidenceLink.length > 55 ? '…' : '')}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Additional evidence upload */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small d-flex align-items-center gap-2">
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#7c3aed' }}>attach_file</span>
                                        Additional Supporting Document (optional)
                                    </label>
                                    <div className="upload-zone" onClick={() => alert('File picker opened (demo).')} style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '2rem 1.5rem', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '2.8rem', color: '#cbd5e1', marginBottom: '.4rem', display: 'block' }}>cloud_upload</span>
                                        <div className="fw-bold text-muted" style={{ fontSize: '.85rem' }}>Attach research data, reports, or analysis</div>
                                        <div className="text-muted" style={{ fontSize: '.75rem' }}>PDF, DOCX, XLSX, PNG · Max 15MB</div>
                                    </div>
                                </div>

                                {/* Declaration */}
                                <div className="col-12">
                                    <div className="p-3 rounded" style={{ background: '#f5f3ff', border: '1px solid #ede9fe' }}>
                                        <div className="form-check">
                                            <input className="form-check-input" type="checkbox" id="declaration" style={{ borderColor: '#7c3aed' }} />
                                            <label className="form-check-label" htmlFor="declaration" style={{ fontSize: '.82rem', color: '#4c1d95', fontWeight: 600 }}>
                                                I confirm that this proposal is based on a formal committee discussion and that the meeting minutes attached accurately reflect the decision made. I am authorised to submit on behalf of the Academic Board Committee.
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-12 d-flex gap-3 flex-wrap mt-1">
                                    <button className="btn fw-bold text-white px-4 py-2" style={{ background: '#7c3aed' }} onClick={submitProposal}>
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>send</span>Submit Proposal
                                    </button>
                                    <button className="btn btn-outline-secondary fw-bold" onClick={() => alert('Draft saved successfully.')}>
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>save</span>Save Draft
                                    </button>
                                    <button className="btn btn-link text-danger fw-bold text-decoration-none" onClick={() => { if (window.confirm('Discard this proposal?')) window.location.href = '/committee?pg=dashboard'; }}>Discard</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right side tips */}
                <div className="col-12 col-lg-5 d-flex flex-column gap-4">
                    <div className="table-card" style={{ borderRadius: '14px', background: '#fff', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.12)' }}>
                        <div className="table-card-header" style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}><h5 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>tips_and_updates</span>Proposal Guidelines</h5></div>
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
