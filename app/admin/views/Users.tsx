"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { Modal, Button, Form } from 'react-bootstrap';
import CreateUserModal from '@/components/Modals/CreateUserModal';
import HrSyncControl from '@/components/HrSyncControl';
import { formatRoleForDisplay } from '@/lib/role-routing';
import { COMMITTEE_TYPES } from '@/lib/committee-types';
import { STAFF_CATEGORIES } from '@/lib/staff-categories';
import {
    EMPLOYMENT_STATUSES,
    EMPLOYMENT_STATUS_LABELS,
    GENDER_OPTIONS,
    LEAVE_STATUSES,
    DISABILITY_STATUS_OPTIONS,
    DISABILITY_TYPE_OPTIONS,
} from '@/lib/staff-biodata';
import { USER_ACCOUNT_STATUSES } from '@/lib/user-account-status';
import axios from 'axios';

interface User {
    id: number;
    full_name: string;
    email: string;
    role: string;
    department_id: number | null;
    managed_unit_id: number | null;
    department: string;
    managed_unit: string | null;
    managed_unit_parent: string | null;
    status: string;
    created_date: string;
}

interface UserStats {
    total: number;
    active: number;
    suspended: number;
    definedRoles: number;
}

export default function UsersView() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const handledEditIdRef = useRef<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [usersTotal, setUsersTotal] = useState(0);
    const [usersTotalPages, setUsersTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, suspended: 0, definedRoles: 0 });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [rolesList, setRolesList] = useState<string[]>([]);
    const [filterDepartments, setFilterDepartments] = useState<
        { id: number; name: string; external_name?: string; parent_name?: string }[]
    >([]);

    // Edit modal state
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ 
        first_name: '', 
        surname: '', 
        other_names: '', 
        email: '', 
        role: '', 
        department_id: '' as string | number, 
        managed_unit_id: '' as string | number, 
        committee_types: [] as string[],
        employee_id: '',
        contract_terms: 'Permanent',
        contract_type: 'Full-time',
        staff_category: 'Administrative',
        position: '',
        contract_start: '',
        contract_end: '',
        status: 'Active',
        gender: '',
        nationality: '',
        date_of_birth: '',
        date_first_appointment: '',
        date_current_appointment: '',
        date_office_assignment: '',
        retirement_date: '',
        designation_grade: '',
        employment_status: 'active',
        leave_status: 'On Duty',
        disability_status: '',
        disability_type: '',
        workplace_accommodation: '',
        special_support_needs: '',
    });
    const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
    const [faculties, setFaculties] = useState<{ id: number; name: string }[]>([]);
    const [ambassadorUnits, setAmbassadorUnits] = useState<{ id: number; name: string; parent_name?: string }[]>([]);
    const [saving, setSaving] = useState(false);
    const [sendActivationEmail, setSendActivationEmail] = useState(false);

    // Delete modal state
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [activeSubTab, setActiveSubTab] = useState<'users' | 'departments'>('users');
    const PAGE_SIZE = 10;

    // Department Management State
    const [departmentsList, setDepartmentsList] = useState<any[]>([]);
    const [deptSearchTerm, setDeptSearchTerm] = useState('');
    const [deptsLoading, setDeptsLoading] = useState(false);
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [selectedDept, setSelectedDept] = useState<any | null>(null);
    const [deptFilter, setDeptFilter] = useState<'all' | 'units' | 'parents'>('units'); // Default to units as before but allow toggle
    const [deptForm, setDeptForm] = useState({ name: '', code: '', unit_type: 'department', parent_id: '' as string | number, description: '', is_active: 1 });
    const [showDeleteDeptModal, setShowDeleteDeptModal] = useState(false);
    const [deptToDelete, setDeptToDelete] = useState<any | null>(null);

    // Reset page when filters change
    useEffect(() => { setCurrentPage(1); }, [searchTerm, roleFilter, statusFilter, departmentFilter, activeSubTab, deptSearchTerm]);

    useEffect(() => {
        fetchUsers();
    }, [searchTerm, roleFilter, statusFilter, departmentFilter, currentPage]);

    const closeEditModal = useCallback(() => {
        setShowEditModal(false);
        handledEditIdRef.current = null;
        setSendActivationEmail(false);
        if (searchParams.get('edit')) {
            router.replace('/admin?pg=users');
        }
    }, [router, searchParams]);

    useEffect(() => {
        const editId = searchParams.get('edit');
        if (!editId) {
            handledEditIdRef.current = null;
            return;
        }
        if (handledEditIdRef.current === editId) return;
        handledEditIdRef.current = editId;
        (async () => {
            try {
                const { data } = await axios.get(`/api/users/${editId}`);
                setSelectedUser({
                    id: data.id,
                    full_name: data.full_name,
                    email: data.email,
                    role: data.role,
                    department_id: data.department_id,
                    managed_unit_id: data.managed_unit_id,
                    department: data.department || '',
                    managed_unit: data.managed_unit ?? null,
                    managed_unit_parent: data.managed_unit_parent ?? null,
                    status: data.status,
                    created_date: '',
                });
                setEditForm({
                    first_name: data.first_name || '',
                    surname: data.surname || '',
                    other_names: data.other_names || '',
                    email: data.email || '',
                    role: data.role || '',
                    department_id: data.department_id != null ? data.department_id : '',
                    managed_unit_id: data.managed_unit_id != null ? data.managed_unit_id : '',
                    committee_types: Array.isArray(data.committees) ? data.committees : [],
                    employee_id: data.employee_id || '',
                    contract_terms: data.contract_terms || 'Permanent',
                    contract_type: data.contract_type || 'Full-time',
                    staff_category: data.staff_category || 'Administrative',
                    position: data.position || '',
                    contract_start: data.contract_start || '',
                    contract_end: data.contract_end || '',
                    status: data.status || 'Active',
                    gender: data.gender || '',
                    nationality: data.nationality || '',
                    date_of_birth: data.date_of_birth || '',
                    date_first_appointment: data.date_first_appointment || '',
                    date_current_appointment: data.date_current_appointment || '',
                    date_office_assignment: data.date_office_assignment || '',
                    retirement_date: data.retirement_date || '',
                    designation_grade: data.designation_grade || '',
                    employment_status: data.employment_status || 'active',
                    leave_status: data.leave_status || 'On Duty',
                    disability_status: data.disability_status || '',
                    disability_type: data.disability_type || '',
                    workplace_accommodation: data.workplace_accommodation || '',
                    special_support_needs: data.special_support_needs || '',
                });
                setShowEditModal(true);
            } catch {
                handledEditIdRef.current = null;
            }
        })();
    }, [searchParams]);

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        const loadRoles = async () => {
            try {
                const { data } = await axios.get('/api/users/roles');
                setRolesList(data.roles || []);
            } catch (e) {
                console.error('Error loading roles for filter', e);
            }
        };
        loadRoles();
    }, []);

    useEffect(() => {
        const loadDepartments = async () => {
            try {
                const [deptRes, parentRes, ambassadorRes, filterDeptRes] = await Promise.all([
                    axios.get('/api/departments?units_only=true'),
                    axios.get('/api/departments?parents_only=true'),
                    axios.get('/api/departments?children_only=true'),
                    axios.get('/api/departments?active_only=true'),
                ]);
                setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
                setFaculties(Array.isArray(parentRes.data) ? parentRes.data : []);
                setAmbassadorUnits(Array.isArray(ambassadorRes.data) ? ambassadorRes.data : []);
                setFilterDepartments(Array.isArray(filterDeptRes.data) ? filterDeptRes.data : []);
            } catch (e) {
                console.error('Error loading departments', e);
            }
        };
        loadDepartments();
    }, []);

    const fetchDepartmentsList = async () => {
        setDeptsLoading(true);
        try {
            const response = await axios.get('/api/departments');
            setDepartmentsList(response.data);
        } catch (error) {
            console.error('Error fetching departments list:', error);
        } finally {
            setDeptsLoading(false);
        }
    };

    useEffect(() => {
        if (activeSubTab === 'departments') {
            fetchDepartmentsList();
        }
    }, [activeSubTab]);

    const fetchStats = async () => {
        try {
            const { data } = await axios.get('/api/users/stats');
            setStats(data);
        } catch (error) {
            console.error('Error fetching user stats:', error);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', String(currentPage));
            params.append('limit', String(PAGE_SIZE));
            if (searchTerm) params.append('search', searchTerm);
            if (roleFilter) params.append('role', roleFilter);
            if (statusFilter) params.append('status', statusFilter);
            if (departmentFilter) params.append('department_id', departmentFilter);
            const { data } = await axios.get<{
                users: User[];
                total: number;
                totalPages: number;
            }>(`/api/users?${params.toString()}`);
            setUsers(Array.isArray(data.users) ? data.users : []);
            setUsersTotal(data.total ?? 0);
            setUsersTotalPages(data.totalPages ?? 1);
            if (currentPage > (data.totalPages ?? 1)) {
                setCurrentPage(Math.max(1, data.totalPages ?? 1));
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = async (user: User) => {
        setSelectedUser(user);
        setSendActivationEmail(false);
        try {
            const { data } = await axios.get(`/api/users/${user.id}`);
            setEditForm({
                first_name: data.first_name || '',
                surname: data.surname || '',
                other_names: data.other_names || '',
                email: data.email || user.email,
                role: data.role || user.role,
                department_id: data.department_id != null ? data.department_id : '',
                managed_unit_id: data.managed_unit_id != null ? data.managed_unit_id : '',
                committee_types: Array.isArray(data.committees) ? data.committees : [],
                employee_id: data.employee_id || '',
                contract_terms: data.contract_terms || 'Permanent',
                contract_type: data.contract_type || 'Full-time',
                staff_category: data.staff_category || 'Administrative',
                position: data.position || '',
                contract_start: data.contract_start || '',
                contract_end: data.contract_end || '',
                status: data.status || user.status,
                gender: data.gender || '',
                nationality: data.nationality || '',
                date_of_birth: data.date_of_birth || '',
                date_first_appointment: data.date_first_appointment || '',
                date_current_appointment: data.date_current_appointment || '',
                date_office_assignment: data.date_office_assignment || '',
                retirement_date: data.retirement_date || '',
                designation_grade: data.designation_grade || '',
                employment_status: data.employment_status || 'active',
                leave_status: data.leave_status || 'On Duty',
                disability_status: data.disability_status || '',
                disability_type: data.disability_type || '',
                workplace_accommodation: data.workplace_accommodation || '',
                special_support_needs: data.special_support_needs || '',
            });
        } catch {
            setEditForm({
                first_name: '',
                surname: '',
                other_names: '',
                email: user.email,
                role: user.role,
                department_id: user.department_id != null ? user.department_id : '',
                managed_unit_id: user.managed_unit_id != null ? user.managed_unit_id : '',
                committee_types: [],
                employee_id: '',
                contract_terms: 'Permanent',
                contract_type: 'Full-time',
                staff_category: 'Administrative',
                position: '',
                contract_start: '',
                contract_end: '',
                status: user.status,
                gender: '',
                nationality: '',
                date_of_birth: '',
                date_first_appointment: '',
                date_current_appointment: '',
                date_office_assignment: '',
                retirement_date: '',
                designation_grade: '',
                employment_status: 'active',
                leave_status: 'On Duty',
                disability_status: '',
                disability_type: '',
                workplace_accommodation: '',
                special_support_needs: '',
            });
        }
        setShowEditModal(true);
    };

    const handleEditSave = async () => {
        if (!selectedUser) return;
        setSaving(true);
        try {
            const payload = {
                first_name: editForm.first_name.trim(),
                surname: editForm.surname.trim(),
                other_names: editForm.other_names.trim(),
                email: editForm.email.trim(),
                role: editForm.role,
                department_id: editForm.department_id === '' ? null : Number(editForm.department_id),
                managed_unit_id: editForm.managed_unit_id === '' ? null : Number(editForm.managed_unit_id),
                committee_types: editForm.committee_types,
                employee_id: editForm.employee_id,
                contract_terms: editForm.contract_terms,
                contract_type: editForm.contract_type,
                staff_category: editForm.staff_category,
                position: editForm.position,
                contract_start: editForm.contract_start,
                contract_end: editForm.contract_end,
                status: editForm.status,
                gender: editForm.gender || null,
                nationality: editForm.nationality,
                date_of_birth: editForm.date_of_birth,
                date_first_appointment: editForm.date_first_appointment,
                date_current_appointment: editForm.date_current_appointment,
                date_office_assignment: editForm.date_office_assignment,
                retirement_date: editForm.retirement_date,
                designation_grade: editForm.designation_grade,
                employment_status: editForm.employment_status,
                leave_status: editForm.leave_status,
                disability_status: editForm.disability_status || null,
                disability_type: editForm.disability_type,
                workplace_accommodation: editForm.workplace_accommodation,
                special_support_needs: editForm.special_support_needs,
                send_activation_email: sendActivationEmail,
            };
            await axios.put(`/api/users/${selectedUser.id}`, payload);
            closeEditModal();
            fetchUsers();
            fetchStats();
        } catch (error: any) {
            console.error('Error updating user:', error);
            alert(error.response?.data?.message ?? 'Failed to update user.');
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (userId: number, newStatus: string) => {
        try {
            await axios.patch(`/api/users/${userId}`, { status: newStatus });
            fetchUsers();
            fetchStats();
        } catch (error) {
            console.error('Error updating user status:', error);
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        setDeleting(true);
        try {
            await axios.delete(`/api/users/${userToDelete.id}`);
            setShowDeleteModal(false);
            setUserToDelete(null);
            fetchUsers();
            fetchStats();
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user.');
        } finally {
            setDeleting(false);
        }
    };

    const handleDeptSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...deptForm,
                parent_id: deptForm.parent_id === '' ? null : Number(deptForm.parent_id)
            };
            if (selectedDept) {
                await axios.put(`/api/departments/${selectedDept.id}`, payload);
            } else {
                await axios.post('/api/departments', payload);
            }
            setShowDeptModal(false);
            fetchDepartmentsList();
            // Also reload parent list for dropdowns
            const [deptRes, parentRes, ambassadorRes, filterDeptRes] = await Promise.all([
                axios.get('/api/departments?units_only=true'),
                axios.get('/api/departments?parents_only=true'),
                axios.get('/api/departments?children_only=true'),
                axios.get('/api/departments?active_only=true'),
            ]);
            setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
            setFaculties(Array.isArray(parentRes.data) ? parentRes.data : []);
            setAmbassadorUnits(Array.isArray(ambassadorRes.data) ? ambassadorRes.data : []);
            setFilterDepartments(Array.isArray(filterDeptRes.data) ? filterDeptRes.data : []);
        } catch (error: any) {
            console.error('Error saving department:', error);
            const msg = error.response?.data?.error || error.response?.data?.message || 'Failed to save department.';
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteDept = async () => {
        if (!deptToDelete) return;
        setDeleting(true);
        try {
            await axios.delete(`/api/departments/${deptToDelete.id}`);
            setShowDeleteDeptModal(false);
            setDeptToDelete(null);
            fetchDepartmentsList();
        } catch (error) {
            console.error('Error deleting department:', error);
            alert('Failed to delete department.');
        } finally {
            setDeleting(false);
        }
    };

    const formatDepartmentFilterLabel = (d: {
        name: string;
        external_name?: string;
        parent_name?: string;
    }) => {
        const label = (d.external_name?.trim() || d.name) || '—';
        return d.parent_name ? `${label} (${d.parent_name})` : label;
    };

    const getStatusBadge = (status: string) => {
        const styles: { [key: string]: { bg: string; color: string } } = {
            'Active': { bg: '#dcfce7', color: '#15803d' },
            'Pending': { bg: '#fef9c3', color: '#a16207' },
            'Suspended': { bg: '#fee2e2', color: '#b91c1c' }
        };
        return styles[status] || { bg: '#f1f5f9', color: '#475569' };
    };

    const getRoleBadge = (role: string) => {
        const styles: { [key: string]: { bg: string; color: string } } = {
            'System Administrator': { bg: '#eff6ff', color: 'var(--mubs-blue)' },
            'Strategy Manager': { bg: '#fdf2f8', color: '#9333ea' },
            'Head of Department': { bg: '#f0f9ff', color: '#0369a1' },
            'Unit Head': { bg: '#f0f9ff', color: '#0369a1' },
            'HOD': { bg: '#f0f9ff', color: '#0369a1' },
            'Staff': { bg: '#eff6ff', color: 'var(--mubs-blue)' },
            'Ambassador': { bg: '#fff7ed', color: '#ea580c' }
        };
        return styles[role] || { bg: '#f1f5f9', color: '#475569' };
    };

    const userHasAmbassadorRole = (role: string) =>
        (role || '').split(',').some((r) => r.trim().toLowerCase().replace(/\s+/g, '_') === 'ambassador');

    const formatAmbassadorOversight = (user: User) => {
        if (!userHasAmbassadorRole(user.role)) return null;
        if (!user.managed_unit) return 'Not assigned';
        if (user.managed_unit_parent) {
            return `${user.managed_unit} (${user.managed_unit_parent})`;
        }
        return user.managed_unit;
    };

    const getRoleIcon = (role: string) =>
        role === 'System Administrator' ? 'shield' :
            role === 'Strategy Manager' ? 'manage_accounts' :
                role === 'Head of Department' || role === 'Unit Head' || role === 'HOD' ? 'corporate_fare' :
                    role === 'Ambassador' ? 'verified_user' : 'assignment_ind';

    const totalPages = usersTotalPages;
    const rangeStart = usersTotal === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const rangeEnd = Math.min(currentPage * PAGE_SIZE, usersTotal);

    const visiblePages = (() => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages = new Set<number>([1, totalPages, currentPage]);
        if (currentPage > 1) pages.add(currentPage - 1);
        if (currentPage < totalPages) pages.add(currentPage + 1);
        if (currentPage > 2) pages.add(currentPage - 2);
        if (currentPage < totalPages - 1) pages.add(currentPage + 2);
        return Array.from(pages).sort((a, b) => a - b);
    })();

    return (
        <Layout>
            {/* Stat Cards */}
            <div className="row g-4 mb-4">
                <div className="col-sm-4 col-xl-4">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-blue)' }}>
                        <div className="stat-label">System Users</div>
                        <div className="stat-value">{stats.total}</div>
                    </div>
                </div>
                <div className="col-sm-4 col-xl-4">
                    <div className="stat-card" style={{ borderLeftColor: '#10b981' }}>
                        <div className="stat-label">Active Accounts</div>
                        <div className="stat-value">{stats.active}</div>
                    </div>
                </div>
                <div className="col-sm-4 col-xl-4">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-yellow)' }}>
                        <div className="stat-label">Defined Roles</div>
                        <div className="stat-value">{stats.definedRoles}</div>
                    </div>
                </div>
            </div>

            {/* Sub-Tabs Selector */}
            <div className="d-flex mb-4 gap-2 border-bottom pb-2">
                <button 
                    className={`btn btn-sm ${activeSubTab === 'users' ? 'btn-primary' : 'btn-light'}`}
                    onClick={() => setActiveSubTab('users')}
                    style={{ borderRadius: '8px', fontWeight: '600' }}
                >
                    <span className="material-symbols-outlined me-1" style={{ fontSize: '18px', verticalAlign: 'middle' }}>group</span>
                    All Users
                </button>
                <button 
                    className={`btn btn-sm ${activeSubTab === 'departments' ? 'btn-primary' : 'btn-light'}`}
                    onClick={() => setActiveSubTab('departments')}
                    style={{ borderRadius: '8px', fontWeight: '600' }}
                >
                    <span className="material-symbols-outlined me-1" style={{ fontSize: '18px', verticalAlign: 'middle' }}>corporate_fare</span>
                    Departments & Units
                </button>
            </div>

            {activeSubTab === 'users' ? (
                /* Users Table */
                <div className="table-card">
                <div className="table-card-header">
                    <h5>
                        <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>manage_accounts</span>
                        All Users
                    </h5>
                    <div className="d-flex gap-2 flex-wrap">
                        <div className="input-group input-group-sm" style={{ width: '200px' }}>
                            <span className="input-group-text bg-white">
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#64748b' }}>search</span>
                            </span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            className="form-select form-select-sm"
                            style={{ width: '180px' }}
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="">All Roles</option>
                            {rolesList.map((r) => (
                                <option key={r} value={r}>{formatRoleForDisplay(r)}</option>
                            ))}
                        </select>
                        <select
                            className="form-select form-select-sm"
                            style={{ width: '220px' }}
                            value={departmentFilter}
                            onChange={(e) => setDepartmentFilter(e.target.value)}
                            aria-label="Filter by department or unit"
                        >
                            <option value="">All Departments/Units</option>
                            {filterDepartments.map((d) => (
                                <option key={d.id} value={String(d.id)}>
                                    {formatDepartmentFilterLabel(d)}
                                </option>
                            ))}
                        </select>
                        <select
                            className="form-select form-select-sm"
                            style={{ width: '150px' }}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            aria-label="Filter by account status"
                        >
                            <option value="">All Statuses</option>
                            {USER_ACCOUNT_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <HrSyncControl
                            onSynced={() => {
                                fetchUsers();
                                fetchStats();
                            }}
                        />
                        <button className="btn btn-sm create-btn" onClick={() => setShowCreateModal(true)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_add</span>
                            New User
                        </button>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="table mb-0">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Department/Unit</th>
                                <th>Ambassador Oversight</th>
                                <th>Account Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-4">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-4 text-muted">No users found</td>
                                </tr>
                            ) : (
                                users.map((user) => {
                                    const statusStyle = getStatusBadge(user.status);
                                    const ambassadorOversight = formatAmbassadorOversight(user);
                                    return (
                                        <tr key={user.id}>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>person</span>
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{user.full_name}</div>
                                                        <div className="text-muted" style={{ fontSize: '.72rem' }}>Added {user.created_date}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-muted" style={{ fontSize: '.83rem' }}>{user.email}</td>
                                            <td>
                                                <div className="d-flex flex-wrap gap-1">
                                                    {(user.role || '').split(',').map((r, i) => {
                                                        const cleanRole = r.trim();
                                                        const displayRole = formatRoleForDisplay(cleanRole);
                                                        const roleStyle = getRoleBadge(displayRole);
                                                        return (
                                                            <span key={i} className="role-badge" style={{ background: roleStyle.bg, color: roleStyle.color }}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{getRoleIcon(displayRole)}</span>
                                                                {displayRole}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td style={{ fontSize: '.83rem' }}>{user.department || '—'}</td>
                                            <td style={{ fontSize: '.83rem' }}>
                                                {ambassadorOversight ? (
                                                    <span
                                                        className="d-inline-flex align-items-center gap-1 fw-semibold"
                                                        style={{ color: '#ea580c', fontSize: '.8rem' }}
                                                        title="Department/unit this ambassador oversees"
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified_user</span>
                                                        {ambassadorOversight}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted">—</span>
                                                )}
                                            </td>
                                            <td>
                                                <span
                                                    className="badge rounded-pill fw-semibold"
                                                    style={{
                                                        background: statusStyle.bg,
                                                        color: statusStyle.color,
                                                        fontSize: '.72rem',
                                                    }}
                                                >
                                                    {user.status || '—'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="d-flex gap-1">
                                                    <button
                                                        className="btn btn-xs btn-outline-primary py-0 px-2"
                                                        style={{ fontSize: '.75rem' }}
                                                        title="Edit user"
                                                        onClick={() => openEditModal(user)}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                                                    </button>
                                                    <button
                                                        className="btn btn-xs btn-outline-danger py-0 px-2"
                                                        style={{ fontSize: '.75rem' }}
                                                        title="Delete user"
                                                        onClick={() => {
                                                            setUserToDelete(user);
                                                            setShowDeleteModal(true);
                                                        }}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="table-card-footer">
                    <span className="footer-label">
                        Showing {rangeStart}–{rangeEnd} of {usersTotal} users
                        {totalPages > 1 ? ` · Page ${currentPage} of ${totalPages}` : ''}
                    </span>
                    <div className="d-flex gap-1 align-items-center flex-wrap">
                        <button className="page-btn" disabled={currentPage === 1 || loading} onClick={() => setCurrentPage(1)} title="First page">«</button>
                        <button className="page-btn" disabled={currentPage === 1 || loading} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                        {visiblePages.map((pg, idx) => {
                            const prev = visiblePages[idx - 1];
                            const showEllipsis = prev != null && pg - prev > 1;
                            return (
                                <span key={pg} className="d-flex gap-1">
                                    {showEllipsis && <span className="px-1 text-muted">…</span>}
                                    <button
                                        className={`page-btn ${pg === currentPage ? 'active' : ''}`}
                                        disabled={loading}
                                        onClick={() => setCurrentPage(pg)}
                                    >{pg}</button>
                                </span>
                            );
                        })}
                        <button className="page-btn" disabled={currentPage === totalPages || loading} onClick={() => setCurrentPage(p => p + 1)}>›</button>
                        <button className="page-btn" disabled={currentPage === totalPages || loading} onClick={() => setCurrentPage(totalPages)} title="Last page">»</button>
                    </div>
                </div>
            </div>
            ) : (
                /* Departments Management Table */
                <div className="table-card">
                    <div className="table-card-header">
                        <h5>
                            <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>corporate_fare</span>
                            Departments & Units
                        </h5>
                        <div className="d-flex gap-2 flex-wrap">
                            <div className="input-group input-group-sm" style={{ width: '200px' }}>
                                <span className="input-group-text bg-white border-end-0">
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#64748b' }}>search</span>
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0"
                                    placeholder="Search..."
                                    value={deptSearchTerm}
                                    onChange={(e) => setDeptSearchTerm(e.target.value)}
                                />
                            </div>
                            <select 
                                className="form-select form-select-sm" 
                                style={{ width: '150px' }}
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value as any)}
                            >
                                <option value="all">Show All</option>
                                <option value="units">Sub-Units Only</option>
                                <option value="parents">Faculties Only</option>
                            </select>
                            <button className="btn btn-sm create-btn" onClick={() => {
                                setSelectedDept(null);
                                setDeptForm({ name: '', code: '', unit_type: 'department', parent_id: '', description: '', is_active: 1 });
                                setShowDeptModal(true);
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_business</span>
                                New Dept/Unit
                            </button>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="table mb-0">
                            <thead>
                                <tr>
                                    <th>Department/Unit</th>
                                    <th>Office/Faculty</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deptsLoading ? (
                                    <tr>
                                        <td colSpan={3} className="text-center py-4">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : departmentsList.filter(d => {
                                    const matchesSearch = d.name.toLowerCase().includes(deptSearchTerm.toLowerCase()) || 
                                                          d.code.toLowerCase().includes(deptSearchTerm.toLowerCase());
                                    const matchesFilter = deptFilter === 'all' ? true : 
                                                         (deptFilter === 'units' ? d.parent_id !== null : d.parent_id === null);
                                    return matchesSearch && matchesFilter;
                                }).length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="text-center py-4 text-muted">No entries found</td>
                                    </tr>
                                ) : (
                                    departmentsList
                                        .filter(d => {
                                            const matchesSearch = d.name.toLowerCase().includes(deptSearchTerm.toLowerCase()) || 
                                                                  d.code.toLowerCase().includes(deptSearchTerm.toLowerCase());
                                            const matchesFilter = deptFilter === 'all' ? true : 
                                                                 (deptFilter === 'units' ? d.parent_id !== null : d.parent_id === null);
                                            return matchesSearch && matchesFilter;
                                        })
                                        .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                                        .map((d) => (
                                            <tr key={d.id}>
                                                <td>
                                                    <div className="d-flex flex-column">
                                                        <div className="fw-bold text-dark">{d.name}</div>
                                                        <div className="d-flex gap-1 mt-1">
                                                            <span className={`badge ${d.parent_id ? 'bg-info' : 'bg-primary'} text-white`} style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                                                                {d.unit_type}
                                                            </span>
                                                            {!d.is_active && <span className="badge bg-secondary text-white" style={{ fontSize: '10px' }}>Inactive</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="text-muted">{d.parent_name || d.name}</td>
                                                <td>
                                                    <div className="d-flex gap-1">
                                                        <button 
                                                            className="btn btn-xs btn-outline-primary py-0 px-2"
                                                            onClick={() => {
                                                                setSelectedDept(d);
                                                                setDeptForm({
                                                                    name: d.name,
                                                                    code: d.code,
                                                                    unit_type: d.unit_type,
                                                                    parent_id: d.parent_id || '',
                                                                    description: d.description || '',
                                                                    is_active: d.is_active ?? 1
                                                                });
                                                                setShowDeptModal(true);
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                                                        </button>
                                                        <button 
                                                            className="btn btn-xs btn-outline-danger py-0 px-2"
                                                            onClick={() => {
                                                                setDeptToDelete(d);
                                                                setShowDeleteDeptModal(true);
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-card-footer">
                        <span className="footer-label">
                            Showing {Math.min((currentPage-1)*PAGE_SIZE + 1, departmentsList.filter(d => {
                                const matchesFilter = deptFilter === 'all' ? true : (deptFilter === 'units' ? d.parent_id !== null : d.parent_id === null);
                                return matchesFilter && (d.name.toLowerCase().includes(deptSearchTerm.toLowerCase()) || d.code.toLowerCase().includes(deptSearchTerm.toLowerCase()));
                            }).length)}–{Math.min(currentPage*PAGE_SIZE, departmentsList.filter(d => {
                                const matchesFilter = deptFilter === 'all' ? true : (deptFilter === 'units' ? d.parent_id !== null : d.parent_id === null);
                                return matchesFilter && (d.name.toLowerCase().includes(deptSearchTerm.toLowerCase()) || d.code.toLowerCase().includes(deptSearchTerm.toLowerCase()));
                            }).length)} of {departmentsList.filter(d => {
                                const matchesFilter = deptFilter === 'all' ? true : (deptFilter === 'units' ? d.parent_id !== null : d.parent_id === null);
                                return matchesFilter && (d.name.toLowerCase().includes(deptSearchTerm.toLowerCase()) || d.code.toLowerCase().includes(deptSearchTerm.toLowerCase()));
                            }).length} entries
                        </span>
                        <div className="d-flex gap-1">
                            <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                            {Array.from({ length: Math.ceil(departmentsList.filter(d => {
                                const matchesFilter = deptFilter === 'all' ? true : (deptFilter === 'units' ? d.parent_id !== null : d.parent_id === null);
                                return matchesFilter && (d.name.toLowerCase().includes(deptSearchTerm.toLowerCase()) || d.code.toLowerCase().includes(deptSearchTerm.toLowerCase()));
                            }).length / PAGE_SIZE) }, (_, i) => i + 1).map(pg => (
                                <button key={pg} className={`page-btn ${pg === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(pg)}>{pg}</button>
                            ))}
                            <button className="page-btn" disabled={currentPage === Math.ceil(departmentsList.filter(d => {
                                const matchesFilter = deptFilter === 'all' ? true : (deptFilter === 'units' ? d.parent_id !== null : d.parent_id === null);
                                return matchesFilter && (d.name.toLowerCase().includes(deptSearchTerm.toLowerCase()) || d.code.toLowerCase().includes(deptSearchTerm.toLowerCase()));
                            }).length / PAGE_SIZE)} onClick={() => setCurrentPage(p => p + 1)}>›</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            <Modal show={showEditModal} onHide={closeEditModal} centered backdrop="static" keyboard={false} size="lg">
                <Modal.Header closeButton className="modal-header-mubs">
                    <Modal.Title className="fw-bold d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined">manage_accounts</span>
                        Edit User
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <div className="row g-3">
                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">First Name</Form.Label>
                            <Form.Control
                                type="text"
                                value={editForm.first_name}
                                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Surname</Form.Label>
                            <Form.Control
                                type="text"
                                value={editForm.surname}
                                onChange={(e) => setEditForm({ ...editForm, surname: e.target.value })}
                                required
                            />
                        </div>
                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Other Names</Form.Label>
                            <Form.Control
                                type="text"
                                value={editForm.other_names}
                                onChange={(e) => setEditForm({ ...editForm, other_names: e.target.value })}
                            />
                        </div>
                        <div className="col-md-6">
                            <Form.Label className="fw-bold small">Email Address</Form.Label>
                            <Form.Control
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className="col-md-6">
                            <Form.Label className="fw-bold small">Employee ID</Form.Label>
                            <Form.Control
                                type="text"
                                value={editForm.employee_id}
                                onChange={(e) => setEditForm({ ...editForm, employee_id: e.target.value })}
                            />
                        </div>

                        <div className="col-12 py-1">
                            <hr className="my-1 opacity-25" />
                            <div className="fw-bold small text-primary mb-2">Employment & Contract Details</div>
                        </div>

                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Staff Category</Form.Label>
                            <Form.Select
                                value={editForm.staff_category}
                                onChange={(e) => setEditForm({ ...editForm, staff_category: e.target.value })}
                            >
                                {STAFF_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </Form.Select>
                        </div>

                        <div className="col-md-8">
                            <Form.Label className="fw-bold small">Official Position</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="e.g. SENIOR LECTURER"
                                value={editForm.position}
                                onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                            />
                        </div>

                        <div className="col-md-6">
                            <Form.Label className="fw-bold small">Contract Start Date</Form.Label>
                            <Form.Control
                                type="date"
                                value={editForm.contract_start}
                                onChange={(e) => setEditForm({ ...editForm, contract_start: e.target.value })}
                            />
                        </div>

                        <div className="col-md-6">
                            <Form.Label className="fw-bold small">Contract End Date</Form.Label>
                            <Form.Control
                                type="date"
                                value={editForm.contract_end}
                                onChange={(e) => setEditForm({ ...editForm, contract_end: e.target.value })}
                            />
                        </div>

                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Contract Terms</Form.Label>
                            <Form.Select
                                value={editForm.contract_terms}
                                onChange={(e) => setEditForm({ ...editForm, contract_terms: e.target.value })}
                            >
                                <option value="Permanent">Permanent</option>
                                <option value="Contract">Contract</option>
                            </Form.Select>
                        </div>
                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Contract Type</Form.Label>
                            <Form.Select
                                value={editForm.contract_type}
                                onChange={(e) => setEditForm({ ...editForm, contract_type: e.target.value })}
                            >
                                <option value="Full-time">Full-time</option>
                                <option value="Part-time">Part-time</option>
                            </Form.Select>
                        </div>

                        <div className="col-12 py-1">
                            <hr className="my-1 opacity-25" />
                            <div className="fw-bold small text-primary mb-2">Personal &amp; Biodata</div>
                        </div>

                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Gender</Form.Label>
                            <Form.Select
                                value={editForm.gender}
                                onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                            >
                                <option value="">Select gender</option>
                                {GENDER_OPTIONS.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </Form.Select>
                        </div>
                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Nationality</Form.Label>
                            <Form.Control
                                type="text"
                                value={editForm.nationality}
                                onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })}
                            />
                        </div>
                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Date of Birth</Form.Label>
                            <Form.Control
                                type="date"
                                value={editForm.date_of_birth}
                                onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                            />
                        </div>
                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Designation / Grade</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="e.g. Senior Lecturer (Grade 3)"
                                value={editForm.designation_grade}
                                onChange={(e) => setEditForm({ ...editForm, designation_grade: e.target.value })}
                            />
                        </div>
                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Date of First Appointment</Form.Label>
                            <Form.Control
                                type="date"
                                value={editForm.date_first_appointment}
                                onChange={(e) => setEditForm({ ...editForm, date_first_appointment: e.target.value })}
                            />
                        </div>
                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Date Appointed to Current Position</Form.Label>
                            <Form.Control
                                type="date"
                                value={editForm.date_current_appointment}
                                onChange={(e) => setEditForm({ ...editForm, date_current_appointment: e.target.value })}
                            />
                        </div>
                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Date Assigned to Current Office</Form.Label>
                            <Form.Control
                                type="date"
                                value={editForm.date_office_assignment}
                                onChange={(e) => setEditForm({ ...editForm, date_office_assignment: e.target.value })}
                            />
                        </div>
                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Retirement Date</Form.Label>
                            <Form.Control
                                type="date"
                                value={editForm.retirement_date}
                                onChange={(e) => setEditForm({ ...editForm, retirement_date: e.target.value })}
                            />
                        </div>

                        <div className="col-12 py-1">
                            <hr className="my-1 opacity-25" />
                            <div className="fw-bold small text-primary mb-2">Persons with Disabilities (PwD)</div>
                        </div>

                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Disability Status</Form.Label>
                            <Form.Select
                                value={editForm.disability_status}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setEditForm({
                                        ...editForm,
                                        disability_status: v,
                                        ...(v !== 'Yes'
                                            ? {
                                                  disability_type: '',
                                                  workplace_accommodation: '',
                                                  special_support_needs: '',
                                              }
                                            : {}),
                                    });
                                }}
                            >
                                <option value="">Not recorded</option>
                                {DISABILITY_STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </Form.Select>
                        </div>
                        {editForm.disability_status === 'Yes' && (
                            <>
                                <div className="col-md-8">
                                    <Form.Label className="fw-bold small">Type / Category of Disability</Form.Label>
                                    <Form.Select
                                        value={editForm.disability_type}
                                        onChange={(e) => setEditForm({ ...editForm, disability_type: e.target.value })}
                                    >
                                        <option value="">Select type</option>
                                        {DISABILITY_TYPE_OPTIONS.map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </Form.Select>
                                </div>
                                <div className="col-md-6">
                                    <Form.Label className="fw-bold small">Workplace Accommodation Requirements</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        value={editForm.workplace_accommodation}
                                        onChange={(e) => setEditForm({ ...editForm, workplace_accommodation: e.target.value })}
                                    />
                                </div>
                                <div className="col-md-6">
                                    <Form.Label className="fw-bold small">Special Support Needs</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        value={editForm.special_support_needs}
                                        onChange={(e) => setEditForm({ ...editForm, special_support_needs: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        <div className="col-12 py-1">
                            <hr className="my-1 opacity-25" />
                            <div className="fw-bold small text-primary mb-2">HR Employment Status</div>
                        </div>

                        <div className="col-md-6">
                            <Form.Label className="fw-bold small">Employment Status</Form.Label>
                            <Form.Select
                                value={editForm.employment_status}
                                onChange={(e) => setEditForm({ ...editForm, employment_status: e.target.value })}
                            >
                                {EMPLOYMENT_STATUSES.map((s) => (
                                    <option key={s} value={s}>{EMPLOYMENT_STATUS_LABELS[s]}</option>
                                ))}
                            </Form.Select>
                        </div>
                        <div className="col-md-6">
                            <Form.Label className="fw-bold small">Leave Status</Form.Label>
                            <Form.Select
                                value={editForm.leave_status}
                                onChange={(e) => setEditForm({ ...editForm, leave_status: e.target.value })}
                            >
                                {LEAVE_STATUSES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </Form.Select>
                        </div>

                        <div className="col-md-6">
                            <Form.Label className="fw-bold small">Account Status</Form.Label>
                            <Form.Select
                                value={editForm.status}
                                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                            >
                                <option value="Active">Active</option>
                                <option value="Pending">Pending</option>
                                <option value="Suspended">Suspended</option>
                            </Form.Select>
                        </div>

                        <div className="col-12 py-1">
                            <hr className="my-1 opacity-25" />
                            <div className="fw-bold small text-primary mb-2">Roles & Assignments</div>
                        </div>

                        <div className="col-12">
                            <Form.Label className="fw-bold small">Assign Roles (Select all that apply)</Form.Label>
                            <div className="d-flex flex-wrap gap-2 p-2 border rounded bg-light">
                                {rolesList.map((r) => {
                                    const displayName = formatRoleForDisplay(r);
                                    const roleList = editForm.role.split(',').map((x: string) => x.trim()).filter(Boolean);
                                    return (
                                        <div key={r} className="form-check">
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                id={`edit-role-${r}`}
                                                checked={roleList.includes(r)}
                                                onChange={e => {
                                                    const newRoles = e.target.checked
                                                        ? [...roleList, r]
                                                        : roleList.filter((x: string) => x !== r);
                                                    setEditForm({ ...editForm, role: newRoles.join(',') });
                                                }}
                                            />
                                            <label className="form-check-label small" htmlFor={`edit-role-${r}`}>{displayName}</label>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="col-12">
                            <Form.Label className="fw-bold small">Department/Unit</Form.Label>
                            <Form.Select
                                value={editForm.department_id === '' ? '' : String(editForm.department_id)}
                                onChange={e => setEditForm({ ...editForm, department_id: e.target.value === '' ? '' : Number(e.target.value) })}
                            >
                                <option value="">Select department/unit</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </Form.Select>
                        </div>
                        {editForm.role && editForm.role.split(',').map((r: string) => r.trim()).filter(Boolean).includes('ambassador') && (
                            <div className="col-12">
                                <Form.Label className="fw-bold small text-primary">Managed Department/Unit</Form.Label>
                                <Form.Select
                                    value={editForm.managed_unit_id === '' ? '' : String(editForm.managed_unit_id)}
                                    onChange={e => setEditForm({ ...editForm, managed_unit_id: e.target.value === '' ? '' : Number(e.target.value) })}
                                    className="border-primary"
                                >
                                    <option value="">Select department/unit to oversee</option>
                                    {ambassadorUnits.map((f) => (
                                        <option key={f.id} value={f.id}>{f.name}{f.parent_name ? ` (${f.parent_name})` : ''}</option>
                                    ))}
                                </Form.Select>
                                <Form.Text className="text-primary small">Ambassador oversees this department or unit only.</Form.Text>
                            </div>
                        )}
                        {editForm.role && editForm.role.split(',').map((r: string) => r.trim()).filter(Boolean).some((r: string) => r === 'committee_member' || formatRoleForDisplay(r) === 'Committee Member') && (
                            <div className="col-12">
                                <Form.Label className="fw-bold small">Committees</Form.Label>
                                <div className="d-flex flex-wrap gap-2 p-2 border rounded bg-light">
                                    {COMMITTEE_TYPES.map((ct) => (
                                        <div key={ct} className="form-check">
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                id={`edit-committee-${ct}`}
                                                checked={editForm.committee_types.includes(ct)}
                                                onChange={e => {
                                                    const next = e.target.checked
                                                        ? [...editForm.committee_types, ct]
                                                        : editForm.committee_types.filter((x: string) => x !== ct);
                                                    setEditForm({ ...editForm, committee_types: next });
                                                }}
                                            />
                                            <label className="form-check-label small" htmlFor={`edit-committee-${ct}`}>{ct}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="col-12">
                            <Form.Check
                                type="checkbox"
                                id="edit-send-activation-email"
                                checked={sendActivationEmail}
                                onChange={(e) => setSendActivationEmail(e.target.checked)}
                                label={<span className="fw-bold small">Send activation email (HOD/Ambassador only)</span>}
                            />
                            <Form.Text className="text-muted small">
                                Sends an email with login and dashboard link if the user has HOD and/or Ambassador role.
                            </Form.Text>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={closeEditModal} disabled={saving}>Cancel</Button>
                    <Button
                        style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                        className="fw-bold text-white"
                        disabled={saving || !editForm.first_name.trim() || !editForm.surname.trim()}
                        onClick={handleEditSave}
                    >
                        <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>save</span>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteModal} onHide={() => !deleting && setShowDeleteModal(false)} centered backdrop="static" keyboard={false} size="lg">
                <Modal.Header closeButton className="modal-header-mubs">
                    <Modal.Title className="fw-bold d-flex align-items-center gap-2 text-danger">
                        <span className="material-symbols-outlined">warning</span>
                        Confirm Deletion
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to delete the user <strong>{selectedUser?.full_name}</strong>?</p>
                    <p className="text-muted small mb-0">This action cannot be undone and will remove all their roles and access from the system.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancel</Button>
                    <Button
                        variant="danger"
                        className="fw-bold"
                        disabled={deleting}
                        onClick={handleDeleteUser}
                    >
                        <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>delete</span>
                        {deleting ? 'Deleting...' : 'Delete User'}
                    </Button>
                </Modal.Footer>
            </Modal>

            <CreateUserModal
                show={showCreateModal}
                onHide={() => setShowCreateModal(false)}
                onUserCreated={() => { fetchUsers(); fetchStats(); }}
            />

            {/* Create/Edit Department Modal */}
            <Modal show={showDeptModal} onHide={() => setShowDeptModal(false)} centered backdrop="static" size="lg">
                <Modal.Header closeButton className="modal-header-mubs">
                    <Modal.Title className="fw-bold d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined">add_business</span>
                        {selectedDept ? 'Edit Department/Unit' : 'New Department/Unit'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="row g-3">
                        <div className="col-md-8">
                            <Form.Label className="fw-bold small">Department Name</Form.Label>
                            <Form.Control 
                                value={deptForm.name}
                                onChange={e => setDeptForm({...deptForm, name: e.target.value})}
                                placeholder="e.g. Department of Accounting"
                            />
                        </div>
                        <div className="col-md-4">
                            <Form.Label className="fw-bold small">Code</Form.Label>
                            <Form.Control 
                                value={deptForm.code}
                                onChange={e => setDeptForm({...deptForm, code: e.target.value})}
                                placeholder="e.g. ACC"
                            />
                        </div>
                        <div className="col-md-6">
                            <Form.Label className="fw-bold small">Unit Type</Form.Label>
                            <Form.Select 
                                value={deptForm.unit_type}
                                onChange={e => setDeptForm({...deptForm, unit_type: e.target.value})}
                            >
                                <option value="faculty">Faculty</option>
                                <option value="office">Office</option>
                                <option value="department">Department</option>
                                <option value="unit">Unit</option>
                            </Form.Select>
                        </div>
                        <div className="col-md-6">
                            <Form.Label className="fw-bold small">Parent Office/Faculty</Form.Label>
                            <Form.Select 
                                value={deptForm.parent_id}
                                onChange={e => setDeptForm({...deptForm, parent_id: e.target.value})}
                            >
                                <option value="">(Self-Parented / Principal Unit)</option>
                                {faculties.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </Form.Select>
                        </div>
                        <div className="col-12">
                            <Form.Label className="fw-bold small">Description (Optional)</Form.Label>
                            <Form.Control 
                                as="textarea" 
                                rows={3}
                                value={deptForm.description}
                                onChange={e => setDeptForm({...deptForm, description: e.target.value})}
                            />
                        </div>
                        <div className="col-12 mt-2">
                            <Form.Check 
                                type="switch"
                                id="dept-active-switch"
                                label={deptForm.is_active ? 'Active' : 'Inactive'}
                                checked={deptForm.is_active === 1}
                                onChange={e => setDeptForm({...deptForm, is_active: e.target.checked ? 1 : 0})}
                            />
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => setShowDeptModal(false)}>Cancel</Button>
                    <Button 
                        style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                        disabled={saving || !deptForm.name || !deptForm.code}
                        onClick={handleDeptSave}
                    >
                        {saving ? 'Saving...' : 'Save Department'}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Delete Department Confirmation Modal */}
            <Modal show={showDeleteDeptModal} onHide={() => !deleting && setShowDeleteDeptModal(false)} centered backdrop="static">
                <Modal.Header closeButton className="modal-header-mubs">
                    <Modal.Title className="fw-bold d-flex align-items-center gap-2 text-danger">
                        <span className="material-symbols-outlined">warning</span>
                        Confirm Deletion
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to delete <strong>{deptToDelete?.name}</strong>?</p>
                    <p className="text-muted small mb-0">
                        This will remove the department. Users assigned to this department will have their department assignment cleared.
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => setShowDeleteDeptModal(false)} disabled={deleting}>Cancel</Button>
                    <Button variant="danger" disabled={deleting} onClick={handleDeleteDept}>
                        {deleting ? 'Deleting...' : 'Delete Department'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Layout>
    );
}
