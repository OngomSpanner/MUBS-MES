'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';


interface Staff {
    id: number;
    department_id: number;
    full_name: string;
    email: string;
    position: string | null;
    leave_status: string;
    contract_end_date: string | null;
    active_tasks: number;
    employment_status?: string | null;
    contract_type?: string | null;
    staff_category?: string | null;
    contract_start_date?: string | null;
    account_status?: string | null;
    section_id?: number | null;
    section_name?: string | null;
}

interface Alert {
    id: number;
    name: string;
    position: string;
    type: string;
    message: string;
    daysRemaining: number | null;
    activeTasks: number;
}

interface StaffData {
    staff: Staff[];
    alerts: Alert[];
}

interface Section {
    id: number;
    department_id: number;
    name: string;
    head_user_id: number | null;
    head_name: string | null;
    staff_count: number;
    staff: Pick<Staff, 'id' | 'full_name' | 'email' | 'position'>[];
}

const getErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
        const responseMessage = (error.response?.data as { message?: string } | undefined)?.message;
        return responseMessage || fallback;
    }
    return fallback;
};

function parseSectionsResponse(payload: unknown): {
    sections: Section[];
    default_department_id: number | null;
} {
    const body = payload as {
        sections?: Section[];
        default_department_id?: number | null;
    };
    return {
        sections: Array.isArray(body.sections) ? body.sections : [],
        default_department_id: typeof body.default_department_id === 'number' ? body.default_department_id : null,
    };
}

export default function DepartmentStaff() {
    const router = useRouter();
    const [data, setData] = useState<StaffData | null>(null);
    const [sections, setSections] = useState<Section[]>([]);
    const [defaultDepartmentId, setDefaultDepartmentId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingSections, setLoadingSections] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [profileStaff, setProfileStaff] = useState<Staff | null>(null);
    const [activeTab, setActiveTab] = useState<'staff' | 'sections'>('sections');
    const [showCreateSection, setShowCreateSection] = useState(false);
    const [createSectionName, setCreateSectionName] = useState('');
    const [createSectionHead, setCreateSectionHead] = useState<string>('');
    const [sectionModalError, setSectionModalError] = useState<string | null>(null);
    const [selectedSection, setSelectedSection] = useState<Section | null>(null);
    const [assigningStaffIds, setAssigningStaffIds] = useState<number[]>([]);
    const [editingSection, setEditingSection] = useState<Section | null>(null);
    const [editSectionName, setEditSectionName] = useState('');
    const [editSectionHead, setEditSectionHead] = useState('');
    const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null);

    const fetchSections = async () => {
        setLoadingSections(true);
        try {
            const response = await axios.get('/api/department-head/sections');
            const parsed = parseSectionsResponse(response.data);
            setSections(parsed.sections);
            setDefaultDepartmentId(parsed.default_department_id);
        } catch (fetchSectionsError: unknown) {
            console.error('Error fetching sections:', fetchSectionsError);
            setError(getErrorMessage(fetchSectionsError, 'Failed to load sections.'));
        } finally {
            setLoadingSections(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [staffResponse, sectionsResponse] = await Promise.all([
                    axios.get('/api/department-head/staff'),
                    axios.get('/api/department-head/sections'),
                ]);
                setData(staffResponse.data);
                const parsed = parseSectionsResponse(sectionsResponse.data);
                setSections(parsed.sections);
                setDefaultDepartmentId(parsed.default_department_id);
            } catch (error: unknown) {
                console.error('Error fetching department staff:', error);
                setError(getErrorMessage(error, 'Failed to load department staff. Please try again.'));
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (error) {
        return (
            <div className="container mt-5">
                <div className="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3 p-4" role="alert">
                    <span className="material-symbols-outlined fs-2 text-danger">error</span>
                    <div>
                        <h5 className="alert-heading text-danger fw-bold mb-1">Error Loading Staff</h5>
                        <p className="mb-0 text-dark opacity-75">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (loading || !data) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const filteredStaff = data.staff.filter(s =>
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.position || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getInitials = (name: string) => {
        const parts = (name || '').trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return '?';
        return parts.map((n) => n[0]).join('').toUpperCase().slice(0, 3);
    };

    const formatDisplayDate = (d: string | null | undefined) => {
        if (!d) return null;
        const t = new Date(d);
        if (Number.isNaN(t.getTime())) return null;
        return t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const effectiveCreateDepartmentId = (): number | null => {
        if (defaultDepartmentId != null) return defaultDepartmentId;
        const fromStaff = data.staff[0]?.department_id;
        return typeof fromStaff === 'number' && fromStaff > 0 ? fromStaff : null;
    };

    const toggleStaffInSection = (staffId: number) => {
        setAssigningStaffIds((prev) =>
            prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
        );
    };

    const openManageSection = (section: Section) => {
        setSectionModalError(null);
        setSelectedSection(section);
        const ids = new Set((section.staff || []).map((member) => Number(member.id)));
        if (section.head_user_id != null) {
            ids.add(section.head_user_id);
        }
        setAssigningStaffIds(Array.from(ids));
    };

    const saveSectionMembers = async () => {
        if (!selectedSection) return;
        setSectionModalError(null);
        try {
            await axios.post(`/api/department-head/sections/${selectedSection.id}/staff`, {
                staff_ids: assigningStaffIds,
            });
            await Promise.all([
                fetchSections(),
                axios.get('/api/department-head/staff').then((response) => setData(response.data)),
            ]);
            setSelectedSection(null);
            setAssigningStaffIds([]);
        } catch (saveError: unknown) {
            setSectionModalError(getErrorMessage(saveError, 'Failed to save section membership.'));
        }
    };

    const openEditSection = (section: Section) => {
        setSectionModalError(null);
        setEditingSection(section);
        setEditSectionName(section.name);
        setEditSectionHead(section.head_user_id != null ? String(section.head_user_id) : '');
    };

    const saveEditedSection = async () => {
        if (!editingSection) return;
        setSectionModalError(null);
        const name = editSectionName.trim();
        if (!name) {
            setSectionModalError('Section name is required.');
            return;
        }
        try {
            await axios.put(`/api/department-head/sections/${editingSection.id}`, {
                name,
                head_user_id: editSectionHead ? Number(editSectionHead) : null,
            });
            setEditingSection(null);
            await Promise.all([
                fetchSections(),
                axios.get('/api/department-head/staff').then((response) => setData(response.data)),
            ]);
        } catch (saveEditError: unknown) {
            setSectionModalError(getErrorMessage(saveEditError, 'Failed to update section.'));
        }
    };

    const deleteSection = async () => {
        if (!sectionToDelete) return;
        setSectionModalError(null);
        try {
            await axios.delete(`/api/department-head/sections/${sectionToDelete.id}`);
            setSectionToDelete(null);
            await Promise.all([
                fetchSections(),
                axios.get('/api/department-head/staff').then((response) => setData(response.data)),
            ]);
        } catch (delError: unknown) {
            setSectionModalError(getErrorMessage(delError, 'Failed to delete section.'));
        }
    };

    const createSection = async () => {
        setSectionModalError(null);
        const departmentId = effectiveCreateDepartmentId();
        if (departmentId == null) {
            setSectionModalError('Could not determine which department to create this section under.');
            return;
        }
        try {
            await axios.post('/api/department-head/sections', {
                name: createSectionName,
                head_user_id: createSectionHead ? Number(createSectionHead) : null,
                department_id: departmentId,
            });
            setCreateSectionName('');
            setCreateSectionHead('');
            setShowCreateSection(false);
            await Promise.all([
                fetchSections(),
                axios.get('/api/department-head/staff').then((response) => setData(response.data)),
            ]);
        } catch (createError: unknown) {
            setSectionModalError(getErrorMessage(createError, 'Failed to create section.'));
        }
    };

    const leaveBadgeStyle = (leave: string) => {
        const s = (leave || '').toLowerCase();
        if (s === 'on duty')
            return { bg: '#dcfce7', color: '#15803d' };
        if (s.includes('leave') || s.includes('sick') || s.includes('annual'))
            return { bg: '#fef3c7', color: '#b45309' };
        return { bg: '#f1f5f9', color: '#475569' };
    };

    const staffSectionsToggle = (
        <div className="btn-group border rounded-3 p-1 bg-light shadow-sm" role="group" aria-label="Sections or staff list">
            <button
                type="button"
                className={`btn btn-sm d-flex align-items-center gap-1 fw-bold ${activeTab === 'sections' ? 'btn-primary shadow-sm' : 'btn-light border-0'}`}
                onClick={() => setActiveTab('sections')}
                style={{ borderRadius: '6px', fontSize: '0.75rem', transition: 'all 0.2s' }}
            >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>account_tree</span>
                Sections
            </button>
            <button
                type="button"
                className={`btn btn-sm d-flex align-items-center gap-1 fw-bold ${activeTab === 'staff' ? 'btn-primary shadow-sm' : 'btn-light border-0'}`}
                onClick={() => setActiveTab('staff')}
                style={{ borderRadius: '6px', fontSize: '0.75rem', transition: 'all 0.2s' }}
            >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>table_rows</span>
                Staff
            </button>
        </div>
    );

    return (
        <div id="page-staff" className="page-section active-page">
            <div className="row g-4">
                {activeTab === 'sections' && (
                    <div className="col-12">
                        <div className="table-card shadow-sm border-0">
                            <div className="table-card-header bg-white border-bottom py-3 d-flex align-items-center flex-wrap gap-2">
                                <h5 className="mb-0 fw-black text-dark d-flex align-items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">account_tree</span>
                                    Department Sections
                                </h5>
                                <div className="ms-auto d-flex align-items-center gap-2 flex-wrap">
                                    {staffSectionsToggle}
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary fw-bold d-inline-flex align-items-center gap-1"
                                        onClick={() => {
                                            setSectionModalError(null);
                                            setShowCreateSection(true);
                                        }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                        Create section
                                    </button>
                                </div>
                            </div>

                            <div className="p-3">
                                {loadingSections ? (
                                    <div className="text-center py-4 text-muted">Loading sections...</div>
                                ) : sections.length === 0 ? (
                                    <div className="text-center py-4 text-muted">No sections created yet. Use &quot;Create section&quot; to get started.</div>
                                ) : (
                                    <div className="row g-3">
                                        {sections.map((section) => (
                                            <div key={section.id} className="col-12 col-md-6 col-xl-4">
                                                <div className="border rounded-3 p-3 h-100 bg-white">
                                                    <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                                                        <div className="min-w-0">
                                                            <h6 className="mb-1 fw-bold text-dark">{section.name}</h6>
                                                            <div className="small text-muted">
                                                                Head: {section.head_name || 'Not assigned'}
                                                            </div>
                                                        </div>
                                                        <div className="d-flex align-items-center gap-1 flex-shrink-0">
                                                            <span className="badge bg-light text-dark border">{section.staff_count} staff</span>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-secondary border-0 px-2 py-1"
                                                                title="Edit section"
                                                                aria-label="Edit section"
                                                                onClick={() => openEditSection(section)}
                                                            >
                                                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-danger border-0 px-2 py-1"
                                                                title="Delete section"
                                                                aria-label="Delete section"
                                                                onClick={() => {
                                                                    setSectionModalError(null);
                                                                    setSectionToDelete(section);
                                                                }}
                                                            >
                                                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-primary fw-bold w-100 mt-2"
                                                        onClick={() => openManageSection(section)}
                                                    >
                                                        Manage staff
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Department Staff Roster */}
                {activeTab === 'staff' && <div className="col-12">
                    <div className="table-card shadow-sm border-0">
                        <div className="table-card-header bg-white border-bottom py-3 d-flex align-items-center flex-wrap gap-2">
                            <h5 className="mb-0 fw-black text-dark d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-primary">group</span>
                                Department Staff Roster
                            </h5>
                            <div className="ms-auto d-flex align-items-center gap-2 flex-wrap">
                                {staffSectionsToggle}
                                <div style={{ width: '220px', minWidth: '180px' }}>
                                    <div className="input-group input-group-sm">
                                        <span className="input-group-text bg-light border-end-0">
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#64748b' }}>search</span>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control bg-light border-start-0 ps-0"
                                            placeholder="Search staff..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0 align-middle">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="ps-4" style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Staff Member</th>
                                        <th style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Position</th>
                                        <th style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Leave Status</th>
                                        <th style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Contract End</th>
                                        <th style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Open assignments</th>
                                        <th className="pe-4 text-end" style={{ fontSize: '.75rem', textTransform: 'uppercase', color: '#64748b' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStaff.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-5 text-muted">No staff found matching your criteria.</td>
                                        </tr>
                                    ) : (
                                        filteredStaff.map((s) => (
                                            <tr key={s.id} className={(s.leave_status || '').toLowerCase() !== 'on duty' ? 'bg-light bg-opacity-50' : ''}>
                                                <td className="ps-4">
                                                    <div className="d-flex align-items-center gap-3 py-1">
                                                        <div className="staff-avatar" style={{
                                                            background: 'var(--mubs-blue)',
                                                            width: '36px',
                                                            height: '36px',
                                                            borderRadius: '10px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: '#fff',
                                                            fontWeight: 'bold',
                                                            fontSize: '.85rem'
                                                        }}>
                                                            {getInitials(s.full_name)}
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>
                                                                {s.full_name}
                                                            </div>
                                                            <div className="text-muted small" style={{ fontSize: '.72rem' }}>{s.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td><span className="small text-dark fw-medium">{s.position || '—'}</span></td>
                                                <td>
                                                    <span
                                                        className="status-badge"
                                                        style={{
                                                            background: leaveBadgeStyle(s.leave_status).bg,
                                                            color: leaveBadgeStyle(s.leave_status).color,
                                                            fontSize: '0.65rem',
                                                        }}
                                                    >
                                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '10px' }}>event_available</span>
                                                        {s.leave_status || '—'}
                                                    </span>
                                                </td>
                                                <td>
                                                    {s.contract_end_date ? (
                                                        <span className="small text-dark" style={{ fontSize: '.8rem' }}>
                                                            {new Date(s.contract_end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted small">—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span
                                                            className={`fw-black ${Number(s.active_tasks) > 5 ? 'text-danger' : 'text-primary'}`}
                                                            style={{ fontSize: '.9rem' }}
                                                        >
                                                            {s.active_tasks ?? 0}
                                                        </span>
                                                        <span className="text-muted small" style={{ fontSize: '.72rem' }}>
                                                            processes
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="pe-4 text-end">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-primary fw-bold d-inline-flex align-items-center gap-1 px-3 py-1"
                                                        style={{ fontSize: '.75rem', borderRadius: '8px' }}
                                                        onClick={() => setProfileStaff(s)}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_search</span>
                                                        View details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-card-footer border-top py-3 px-4">
                            <span className="footer-label small text-muted">Showing {filteredStaff.length} of {data.staff.length} staff members</span>
                        </div>
                    </div>
                </div>}

                {/* HR Action Required — below roster */}
                {activeTab === 'staff' && <div className="col-12">
                    <div className="table-card shadow-sm" style={{ borderTop: '4px solid var(--mubs-red)' }}>
                        <div className="table-card-header" style={{ background: '#fff1f2', borderBottom: '1px solid #fee2e2' }}>
                            <h5 className="mb-0 fw-black text-danger d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined">assignment_late</span>
                                HR Action Required
                            </h5>
                        </div>
                        <div className="p-3">
                            {data.alerts.length === 0 ? (
                                <div className="text-center py-4 text-muted small">
                                    No HR alerts at this time.
                                </div>
                            ) : (
                                <div className="row g-3">
                                    {data.alerts.map((alert, idx) => (
                                        <div key={idx} className="col-12 col-md-6 col-lg-4">
                                            <div className={`warn-card p-3 rounded-3 border-start border-4 h-100 ${alert.type === 'Leave' ? 'bg-danger-subtle border-danger' : 'bg-warning-subtle border-warning'}`}>
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <div className="fw-bold text-dark d-flex align-items-center gap-2">
                                                        <div className="staff-avatar" style={{
                                                            background: alert.type === 'Leave' ? '#dc2626' : '#d97706',
                                                            width: '28px',
                                                            height: '28px',
                                                            fontSize: '.7rem',
                                                            borderRadius: '8px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: '#fff',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {getInitials(alert.name)}
                                                        </div>
                                                        <span style={{ fontSize: '.9rem' }}>{alert.name}</span>
                                                    </div>
                                                    <span className={`badge ${alert.type === 'Leave' ? 'bg-danger text-white' : 'bg-warning text-dark'}`} style={{ fontSize: '.6rem' }}>
                                                        {alert.type.toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="text-dark fw-bold mb-1" style={{ fontSize: '.8rem' }}>{alert.message}</div>
                                                <div className="text-muted mb-3" style={{ fontSize: '.75rem', lineHeight: '1.4' }}>
                                                    Position: {alert.position}<br />
                                                    Impact: {alert.activeTasks} active tasks assigned.
                                                </div>
                                                <button
                                                    type="button"
                                                    className={`btn btn-sm w-100 fw-bold ${alert.type === 'Leave' ? 'btn-danger' : 'btn-warning'} py-1`}
                                                    style={{ fontSize: '.75rem' }}
                                                    onClick={() =>
                                                        router.push(
                                                            `/department-head?pg=tasks&assignee=${encodeURIComponent(alert.name)}`
                                                        )
                                                    }
                                                >
                                                    {alert.type === 'Leave' ? 'View assignments' : 'View details'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>}
            </div>

            {/* Staff profile / details modal */}
            {profileStaff && (
                <div
                    className={`modal fade ${profileStaff ? 'show d-block' : ''}`}
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1050, backdropFilter: 'blur(4px)' }}
                    onClick={() => setProfileStaff(null)}
                >
                    <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                            <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 mb-0" style={{ fontSize: '1.1rem' }}>
                                    <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>badge</span>
                                    Staff profile
                                </h5>
                            </div>
                            <div className="modal-body p-4 pt-3">
                                <div className="d-flex align-items-start gap-4 mb-4 flex-wrap">
                                    <div
                                        className="staff-avatar flex-shrink-0"
                                        style={{
                                            background: 'var(--mubs-blue)',
                                            width: '64px',
                                            height: '64px',
                                            borderRadius: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                            fontWeight: 'bold',
                                            fontSize: '1.5rem',
                                        }}
                                    >
                                        {getInitials(profileStaff.full_name)}
                                    </div>
                                    <div className="flex-grow-1" style={{ minWidth: '200px' }}>
                                        <h6 className="fw-black text-dark mb-1" style={{ fontSize: '1.15rem' }}>
                                            {profileStaff.full_name}
                                        </h6>
                                        <div className="text-muted mb-2" style={{ fontSize: '0.88rem' }}>
                                            {profileStaff.email}
                                        </div>
                                        <div className="d-flex flex-wrap gap-2 align-items-center">
                                            <span
                                                className="status-badge"
                                                style={{
                                                    background: leaveBadgeStyle(profileStaff.leave_status).bg,
                                                    color: leaveBadgeStyle(profileStaff.leave_status).color,
                                                    fontSize: '0.72rem',
                                                }}
                                            >
                                                Leave Status: {profileStaff.leave_status || '—'}
                                            </span>
                                            {profileStaff.account_status ? (
                                                <span className="badge bg-light text-dark border" style={{ fontSize: '0.7rem' }}>
                                                    Account: {profileStaff.account_status}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-muted fw-bold mb-2" style={{ fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                    Staff information
                                </div>
                                <div className="rounded-3 border bg-light overflow-hidden mb-4">
                                    {[
                                        { label: 'Position', value: profileStaff.position || '—' },
                                        { label: 'Section', value: profileStaff.section_name || 'Unassigned' },
                                        { label: 'Staff category', value: profileStaff.staff_category || '—' },
                                        { label: 'Contract type', value: profileStaff.contract_type || '—' },
                                        { label: 'Employment status', value: profileStaff.employment_status || '—' },
                                        {
                                            label: 'Contract start',
                                            value: formatDisplayDate(profileStaff.contract_start_date) || '—',
                                        },
                                        {
                                            label: 'Contract end',
                                            value:
                                                formatDisplayDate(profileStaff.contract_end_date) || 'No end date on file',
                                        },
                                        {
                                            label: 'Open assignments',
                                            value: String(profileStaff.active_tasks ?? 0),
                                        },
                                    ].map((row, idx, arr) => (
                                        <div
                                            key={row.label}
                                            className={`d-flex justify-content-between align-items-start gap-3 px-3 py-2 bg-white ${idx < arr.length - 1 ? 'border-bottom' : ''}`}
                                            style={{ fontSize: '0.82rem' }}
                                        >
                                            <span className="text-muted fw-semibold flex-shrink-0">{row.label}</span>
                                            <span className="text-dark text-end" style={{ wordBreak: 'break-word' }}>
                                                {row.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="modal-footer border-top bg-light px-4 py-3 d-flex flex-wrap justify-content-end gap-2">
                                <button
                                    type="button"
                                    className="btn btn-outline-primary fw-bold px-3 py-2 d-inline-flex align-items-center gap-2"
                                    style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                                    onClick={() => {
                                        setProfileStaff(null);
                                        router.push(`/department-head?pg=evaluations`);
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>rate_review</span>
                                    Evaluations
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary fw-bold px-3 py-2 d-inline-flex align-items-center gap-2 shadow-sm"
                                    style={{
                                        background: 'var(--mubs-blue)',
                                        borderColor: 'var(--mubs-blue)',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                    }}
                                    onClick={() => {
                                        setProfileStaff(null);
                                        router.push(
                                            `/department-head?pg=tasks&assignee=${encodeURIComponent(profileStaff.full_name)}`
                                        );
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>checklist</span>
                                    View assigned processes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {editingSection && (
                <div
                    className="modal fade show d-block"
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1050, backdropFilter: 'blur(4px)' }}
                    onClick={() => setEditingSection(null)}
                >
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                            <div className="modal-header">
                                <h5 className="modal-title fw-bold">Edit section</h5>
                            </div>
                            <div className="modal-body">
                                {sectionModalError && <div className="alert alert-danger py-2">{sectionModalError}</div>}
                                <div className="mb-3">
                                    <label className="form-label small fw-bold">Section name</label>
                                    <input
                                        className="form-control"
                                        value={editSectionName}
                                        onChange={(e) => setEditSectionName(e.target.value)}
                                    />
                                </div>
                                <div className="mb-2">
                                    <label className="form-label small fw-bold">Section head (optional)</label>
                                    <select
                                        className="form-select"
                                        value={editSectionHead}
                                        onChange={(e) => setEditSectionHead(e.target.value)}
                                    >
                                        <option value="">None</option>
                                        {data.staff
                                            .filter((member) => Number(member.department_id) === Number(editingSection.department_id))
                                            .map((member) => (
                                                <option key={member.id} value={member.id}>{member.full_name}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => setEditingSection(null)}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={saveEditedSection}
                                    disabled={!editSectionName.trim()}
                                >
                                    Save changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {sectionToDelete && (
                <div
                    className="modal fade show d-block"
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1060, backdropFilter: 'blur(4px)' }}
                    onClick={() => setSectionToDelete(null)}
                >
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                            <div className="modal-header border-0 pb-0">
                                <h5 className="modal-title fw-bold text-danger d-flex align-items-center gap-2">
                                    <span className="material-symbols-outlined">warning</span>
                                    Delete section
                                </h5>
                            </div>
                            <div className="modal-body pt-2">
                                {sectionModalError && <div className="alert alert-danger py-2">{sectionModalError}</div>}
                                <p className="mb-0 text-dark" style={{ fontSize: '0.95rem' }}>
                                    Delete <strong>{sectionToDelete.name}</strong>? Staff will no longer be assigned to this section (they become unassigned). This cannot be undone.
                                </p>
                            </div>
                            <div className="modal-footer border-top">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => setSectionToDelete(null)}>
                                    Cancel
                                </button>
                                <button type="button" className="btn btn-danger fw-bold" onClick={deleteSection}>
                                    Delete section
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCreateSection && (
                <div
                    className="modal fade show d-block"
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1050, backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowCreateSection(false)}
                >
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                            <div className="modal-header">
                                <h5 className="modal-title fw-bold">Create section</h5>
                            </div>
                            <div className="modal-body">
                                {sectionModalError && <div className="alert alert-danger py-2">{sectionModalError}</div>}
                                <div className="mb-3">
                                    <label className="form-label small fw-bold">Section name</label>
                                    <input
                                        className="form-control"
                                        value={createSectionName}
                                        onChange={(e) => setCreateSectionName(e.target.value)}
                                    />
                                </div>
                                <div className="mb-2">
                                    <label className="form-label small fw-bold">Section head (optional)</label>
                                    <select
                                        className="form-select"
                                        value={createSectionHead}
                                        onChange={(e) => setCreateSectionHead(e.target.value)}
                                    >
                                        <option value="">None</option>
                                        {data.staff
                                            .filter((member) => {
                                                const depId = effectiveCreateDepartmentId();
                                                return depId == null || Number(member.department_id) === depId;
                                            })
                                            .map((member) => (
                                                <option key={member.id} value={member.id}>{member.full_name}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCreateSection(false)}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={createSection}
                                    disabled={!createSectionName.trim() || effectiveCreateDepartmentId() == null}
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedSection && (
                <div
                    className="modal fade show d-block"
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1050, backdropFilter: 'blur(4px)' }}
                    onClick={() => setSelectedSection(null)}
                >
                    <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                            <div className="modal-header">
                                <h5 className="modal-title fw-bold">Manage staff: {selectedSection.name}</h5>
                            </div>
                            <div className="modal-body">
                                {sectionModalError && <div className="alert alert-danger py-2">{sectionModalError}</div>}
                                <div className="small text-muted mb-3">
                                    Select which staff members belong to this section.
                                </div>
                                <div className="row g-2" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                                    {data.staff
                                        .filter((member) => Number(member.department_id) === Number(selectedSection.department_id))
                                        .map((member) => (
                                            <div key={member.id} className="col-12 col-md-6">
                                                <label className="border rounded-2 p-2 w-100 d-flex align-items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={assigningStaffIds.includes(member.id)}
                                                        onChange={() => toggleStaffInSection(member.id)}
                                                    />
                                                    <span>
                                                        <span className="d-block fw-semibold text-dark">{member.full_name}</span>
                                                        <span className="small text-muted">{member.position || 'No position'}</span>
                                                    </span>
                                                </label>
                                            </div>
                                        ))}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => setSelectedSection(null)}>
                                    Cancel
                                </button>
                                <button type="button" className="btn btn-primary" onClick={saveSectionMembers}>
                                    Save members
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
