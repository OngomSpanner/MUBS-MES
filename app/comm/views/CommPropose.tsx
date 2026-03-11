"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { STRATEGIC_PILLARS_2025_2030 } from '@/lib/strategic-plan';

const DRAFT_KEY = 'comm_proposal_draft';

export default function CommPropose() {
    const router = useRouter();
    const [evidenceLink, setEvidenceLink] = useState('');
    const [evidenceLinkPreview, setEvidenceLinkPreview] = useState(false);
    const [departments, setUnits] = useState<{ id: number; name: string }[]>([]);

    const [minutesFile, setMinutesFile] = useState<File | null>(null);
    const [additionalFile, setAdditionalFile] = useState<File | null>(null);
    const minutesInputRef = useRef<HTMLInputElement>(null);
    const additionalInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState('');
    const [pillar, setPillar] = useState('');
    const [committeeType, setCommitteeType] = useState('Other');
    const [positionAtCommittee, setPositionAtCommittee] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [description, setDescription] = useState('');
    const [kpi, setKpi] = useState('');
    const [suggestedUnit, setSuggestedUnit] = useState<number | ''>('');
    const [meetingRef, setMeetingRef] = useState('');
    const [deadline, setDeadline] = useState('');
    const [budget, setBudget] = useState<string>('');
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [submittedByUser, setSubmittedByUser] = useState<{ full_name: string; position: string | null } | null>(null);

    useEffect(() => {
        const fetchUnits = async () => {
            try {
                const res = await axios.get('/api/departments');
                setUnits(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error('Failed to fetch departments', err);
            }
        };
        fetchUnits();
    }, []);

    useEffect(() => {
        const fetchMe = async () => {
            try {
                const res = await axios.get('/api/auth/me');
                const u = res.data?.user;
                if (u) setSubmittedByUser({ full_name: u.full_name ?? '', position: u.position ?? null });
            } catch (_) {}
        };
        fetchMe();
    }, []);

    useEffect(() => {
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem(DRAFT_KEY) : null;
            if (raw) {
                const d = JSON.parse(raw);
                if (d && typeof d === 'object') {
                    if (d.title) setTitle(d.title);
                    if (d.pillar) setPillar(d.pillar);
                    if (d.committeeType) setCommitteeType(d.committeeType);
                    if (d.positionAtCommittee !== undefined) setPositionAtCommittee(d.positionAtCommittee);
                    if (d.priority) setPriority(d.priority);
                    if (d.description) setDescription(d.description);
                    if (d.kpi) setKpi(d.kpi);
                    if (d.suggestedUnit) setSuggestedUnit(d.suggestedUnit);
                    if (d.meetingRef) setMeetingRef(d.meetingRef);
                    if (d.deadline) setDeadline(d.deadline);
                    if (d.budget !== undefined) setBudget(String(d.budget));
                    if (d.evidenceLink) setEvidenceLink(d.evidenceLink);
                }
            }
        } catch (_) {}
    }, []);

    const handlePreviewEvidenceLink = () => {
        if (evidenceLink?.trim()) setEvidenceLinkPreview(true);
        else alert('Please paste a valid URL first.');
    };

    const saveDraft = () => {
        const draft = {
            title,
            pillar,
            committeeType,
            positionAtCommittee,
            priority,
            description,
            kpi,
            suggestedUnit: suggestedUnit || undefined,
            meetingRef,
            deadline,
            budget,
            evidenceLink
        };
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            alert('Draft saved. You can continue later.');
        } catch {
            alert('Could not save draft.');
        }
    };

    const discardDraft = () => {
        if (title || description || meetingRef || minutesFile || additionalFile) {
            if (!confirm('Discard this proposal? All unsaved changes will be lost.')) return;
        }
        setTitle('');
        setPillar('');
        setCommitteeType('Other');
        setPositionAtCommittee('');
        setPriority('Medium');
        setDescription('');
        setKpi('');
        setSuggestedUnit('');
        setMeetingRef('');
        setDeadline('');
        setBudget('');
        setEvidenceLink('');
        setEvidenceLinkPreview(false);
        setMinutesFile(null);
        setAdditionalFile(null);
        setIsConfirmed(false);
        try {
            localStorage.removeItem(DRAFT_KEY);
        } catch (_) {}
    };

    const committeeLabel = committeeType === 'Other' ? 'the committee' : `the ${committeeType}`;

    const openReviewModal = () => {
        if (!title?.trim() || !description?.trim()) {
            alert('Please fill in Title and Description.');
            return;
        }
        if (!meetingRef?.trim()) {
            alert('Please enter a Meeting / Session Reference.');
            return;
        }
        if (!minutesFile) {
            alert('Please attach meeting minutes (PDF, DOC, or DOCX).');
            return;
        }
        if (!isConfirmed) {
            alert('You must confirm the declaration before submitting.');
            return;
        }
        setShowReviewModal(true);
    };

    const submitProposal = async () => {
        setShowReviewModal(false);
        if (!minutesFile) {
            alert('Meeting minutes are required.');
            return;
        }
        setIsSubmitting(true);
        try {
            const form = new FormData();
            form.append('file', minutesFile);
            const uploadRes = await axios.post<{ path: string }>('/api/comm/upload', form);
            const minutesPath = uploadRes.data?.path || '';

            let additionalPath = '';
            if (additionalFile && additionalFile.size > 0) {
                const form2 = new FormData();
                form2.append('file', additionalFile);
                const up2 = await axios.post<{ path: string }>('/api/comm/upload', form2);
                additionalPath = up2.data?.path || '';
            }

            const meetingRefText = meetingRef.trim().slice(0, 100);
            let desc = description.trim();
            if (minutesPath) desc += `\n\nMeeting minutes: ${minutesPath}`;
            if (additionalPath) desc += `\n\nSupporting document: ${additionalPath}`;
            if (evidenceLink?.trim()) desc += `\n\nEvidence link: ${evidenceLink.trim()}`;

            await axios.post('/api/comm/proposals', {
                title: title.trim(),
                description: desc,
                meeting_reference: meetingRefText,
                minute_reference: meetingRefText,
                committee_type: committeeType,
                committee_position: positionAtCommittee?.trim() || null,
                suggested_unit_id: suggestedUnit || null,
                department_id: suggestedUnit || null,
                budget: budget ? parseFloat(budget) : null,
                pillar_id: null
            });

            try {
                localStorage.removeItem(DRAFT_KEY);
            } catch (_) {}
            alert('Proposal submitted successfully. It is now pending Principal review.');
            router.push('/comm?pg=pending');
            discardDraft();
        } catch (error: any) {
            console.error('Submit proposal error:', error);
            alert('Failed to submit proposal. ' + (error.response?.data?.message || error.message || ''));
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
                                        {STRATEGIC_PILLARS_2025_2030.map((p) => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Committee type</label>
                                    <select className="form-select" value={committeeType} onChange={(e) => setCommitteeType(e.target.value)}>
                                        <option value="Other">Other</option>
                                        <option value="Council">Council</option>
                                        <option value="TMC">TMC</option>
                                        <option value="Academic Board">Academic Board</option>
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Position at committee</label>
                                    <input type="text" className="form-control" placeholder="e.g. Secretary, Chair, Member" value={positionAtCommittee} onChange={(e) => setPositionAtCommittee(e.target.value)} />
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

                                <div className="col-md-6">
                                    <label className="form-label fw-black text-dark small">Budget (optional)</label>
                                    <input type="number" className="form-control" placeholder="e.g. 50000" min={0} step={1} value={budget} onChange={(e) => setBudget(e.target.value)} />
                                </div>
                                <div className="col-12"><hr style={{ borderColor: '#e2e8f0' }} /></div>

                                {/* Meeting minutes attachment */}
                                <div className="col-12">
                                    <label className="form-label fw-black text-dark small d-flex align-items-center gap-2">
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#7c3aed' }}>description</span>
                                        Attach Meeting Minutes <span className="text-danger">*</span>
                                        <span className="badge" style={{ background: '#f5f3ff', color: '#7c3aed', fontSize: '.65rem', fontWeight: 700 }}>Required</span>
                                    </label>
                                    <input
                                        type="file"
                                        ref={minutesInputRef}
                                        accept=".pdf,.doc,.docx"
                                        className="d-none"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            setMinutesFile(f || null);
                                            if (e.target) (e.target as HTMLInputElement).value = '';
                                        }}
                                    />
                                    <div className="upload-zone" onClick={() => minutesInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && minutesInputRef.current?.click()}>
                                        <span className="material-symbols-outlined">upload_file</span>
                                        <div className="fw-bold" style={{ fontSize: '.88rem', color: '#7c3aed' }}>Click to upload Meeting Minutes</div>
                                        <div className="text-muted" style={{ fontSize: '.75rem', marginTop: '2px' }}>PDF, DOC, DOCX · Max 20MB</div>
                                    </div>
                                    {minutesFile && (
                                        <div className="mt-2 p-2 rounded d-flex align-items-center gap-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: '18px' }}>check_circle</span>
                                            <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#15803d' }}>{minutesFile.name}</span>
                                            <button type="button" className="btn-close ms-auto" style={{ fontSize: '.6rem' }} onClick={() => setMinutesFile(null)} aria-label="Remove" />
                                        </div>
                                    )}
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
                                    <input
                                        type="file"
                                        ref={additionalInputRef}
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                        className="d-none"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            setAdditionalFile(f || null);
                                            if (e.target) (e.target as HTMLInputElement).value = '';
                                        }}
                                    />
                                    <div className="upload-zone" onClick={() => additionalInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && additionalInputRef.current?.click()}>
                                        <span className="material-symbols-outlined">cloud_upload</span>
                                        <div className="fw-bold text-muted" style={{ fontSize: '.85rem' }}>Click to attach research data, reports, or analysis</div>
                                        <div className="text-muted" style={{ fontSize: '.75rem' }}>PDF, DOCX, XLSX, PNG · Max 20MB</div>
                                    </div>
                                    {additionalFile && (
                                        <div className="mt-2 p-2 rounded d-flex align-items-center gap-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: '18px' }}>attach_file</span>
                                            <span style={{ fontSize: '.78rem', fontWeight: 600, color: '#15803d' }}>{additionalFile.name}</span>
                                            <button type="button" className="btn-close ms-auto" style={{ fontSize: '.6rem' }} onClick={() => setAdditionalFile(null)} aria-label="Remove" />
                                        </div>
                                    )}
                                </div>

                                <div className="col-12">
                                    <div className="p-3 rounded" style={{ background: '#f5f3ff', border: '1px solid #ede9fe' }}>
                                        <div className="form-check">
                                            <input className="form-check-input" type="checkbox" id="declaration" style={{ borderColor: '#7c3aed' }} checked={isConfirmed} onChange={(e) => setIsConfirmed(e.target.checked)} />
                                            <label className="form-check-label" htmlFor="declaration" style={{ fontSize: '.82rem', color: '#4c1d95', fontWeight: 600 }}>
                                                I confirm that this proposal is based on a formal committee discussion and that the meeting minutes attached accurately reflect the decision made. I am authorised to submit on behalf of {committeeLabel}.
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-12 d-flex gap-3 flex-wrap mt-1">
                                    <button type="button" className="btn fw-bold text-white px-4 py-2" style={{ background: '#7c3aed' }} onClick={openReviewModal} disabled={isSubmitting}>
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>send</span>
                                        {isSubmitting ? 'Submitting...' : 'Review & Submit'}
                                    </button>
                                    <button type="button" className="btn btn-outline-secondary fw-bold" onClick={saveDraft} disabled={isSubmitting}>
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>save</span>Save Draft
                                    </button>
                                    <button type="button" className="btn btn-link text-danger fw-bold text-decoration-none" onClick={discardDraft}>Discard</button>
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

            {/* Review & Confirm modal */}
            {showReviewModal && (
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} aria-modal="true" role="dialog">
                    <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                        <div className="modal-content">
                            <div className="modal-header border-0 pb-0">
                                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                    <span className="material-symbols-outlined" style={{ color: '#7c3aed' }}>fact_check</span>
                                    Review proposal before submitting
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setShowReviewModal(false)} aria-label="Close" />
                            </div>
                            <div className="modal-body pt-2">
                                <p className="text-muted small mb-3">Please confirm the details below. Click &quot;Confirm &amp; Submit&quot; to send the proposal, or &quot;Back to Edit&quot; to make changes.</p>
                                <div className="small">
                                    <div className="mb-3 pb-2 border-bottom">
                                        <span className="text-muted fw-bold d-block mb-1">Title</span>
                                        <span className="text-dark">{title || '—'}</span>
                                    </div>
                                    <div className="mb-3 pb-2 border-bottom">
                                        <span className="text-muted fw-bold d-block mb-1">Submitted by</span>
                                        <span className="text-dark">
                                            {submittedByUser?.full_name || '—'}
                                            {positionAtCommittee?.trim() ? `, ${positionAtCommittee.trim()}` : ''}
                                        </span>
                                    </div>
                                    <div className="row g-2 mb-2">
                                        <div className="col-6">
                                            <span className="text-muted fw-bold d-block mb-1">Committee type</span>
                                            <span className="text-dark">{committeeType}</span>
                                        </div>
                                        <div className="col-6">
                                            <span className="text-muted fw-bold d-block mb-1">Strategic Pillar</span>
                                            <span className="text-dark">{pillar || '—'}</span>
                                        </div>
                                    </div>
                                    <div className="row g-2 mb-2">
                                        <div className="col-6">
                                            <span className="text-muted fw-bold d-block mb-1">Priority</span>
                                            <span className="text-dark">{priority}</span>
                                        </div>
                                        <div className="col-6">
                                            <span className="text-muted fw-bold d-block mb-1">Meeting / Session Reference</span>
                                            <span className="text-dark">{meetingRef || '—'}</span>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <span className="text-muted fw-bold d-block mb-1">Description / Rationale</span>
                                        <div className="text-dark" style={{ whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>{description || '—'}</div>
                                    </div>
                                    {(kpi || suggestedUnit || deadline || budget || evidenceLink) && (
                                        <div className="row g-2 mb-2">
                                            {kpi && <div className="col-12"><span className="text-muted fw-bold d-block mb-1">Proposed KPI / Target</span><span className="text-dark">{kpi}</span></div>}
                                            {suggestedUnit && <div className="col-6"><span className="text-muted fw-bold d-block mb-1">Suggested Department</span><span className="text-dark">{departments.find(d => d.id === suggestedUnit)?.name ?? suggestedUnit}</span></div>}
                                            {deadline && <div className="col-6"><span className="text-muted fw-bold d-block mb-1">Proposed Deadline</span><span className="text-dark">{deadline}</span></div>}
                                            {budget && <div className="col-6"><span className="text-muted fw-bold d-block mb-1">Budget</span><span className="text-dark">{budget}</span></div>}
                                            {evidenceLink && <div className="col-12"><span className="text-muted fw-bold d-block mb-1">Evidence Link</span><span className="text-dark text-break">{evidenceLink}</span></div>}
                                        </div>
                                    )}
                                    <div className="mb-2">
                                        <span className="text-muted fw-bold d-block mb-1">Attachments</span>
                                        <ul className="list-unstyled mb-0">
                                            <li><span className="material-symbols-outlined align-middle me-1" style={{ fontSize: '16px', color: '#059669' }}>check_circle</span> Meeting minutes: <strong>{minutesFile?.name ?? '—'}</strong></li>
                                            {additionalFile ? <li><span className="material-symbols-outlined align-middle me-1" style={{ fontSize: '16px', color: '#059669' }}>attach_file</span> Supporting doc: <strong>{additionalFile.name}</strong></li> : null}
                                        </ul>
                                    </div>
                                    <div className="p-2 rounded mt-2" style={{ background: '#f5f3ff', border: '1px solid #ede9fe' }}>
                                        <span className="text-muted fw-bold d-block mb-1">Declaration</span>
                                        <span className="text-dark" style={{ fontSize: '.8rem' }}>I confirm that this proposal is based on a formal committee discussion and that the meeting minutes attached accurately reflect the decision made. I am authorised to submit on behalf of {committeeLabel}.</span>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer border-0 pt-0">
                                <button type="button" className="btn btn-outline-secondary fw-bold" onClick={() => setShowReviewModal(false)}>
                                    Back to Edit
                                </button>
                                <button type="button" className="btn fw-bold text-white px-4" style={{ background: '#7c3aed' }} onClick={submitProposal} disabled={isSubmitting}>
                                    <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>send</span>
                                    {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
