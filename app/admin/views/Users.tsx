"use client";

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Modal, Button, Form } from 'react-bootstrap';
import CreateUserModal from '@/components/Modals/CreateUserModal';
import axios from 'axios';

interface User {
    id: number;
    full_name: string;
    email: string;
    role: string;
    department: string;
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
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, suspended: 0, definedRoles: 0 });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All Roles');

    // Edit modal state
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ full_name: '', email: '', role: '', department: '', status: '' });
    const [saving, setSaving] = useState(false);

    // Delete modal state
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;

    // Reset page when filters change
    useEffect(() => { setCurrentPage(1); }, [searchTerm, roleFilter]);

    useEffect(() => { fetchUsers(); }, [searchTerm, roleFilter]);
    useEffect(() => { fetchStats(); }, []);

    const fetchStats = async () => {
        try {
            const { data } = await axios.get('/api/users/stats');
            setStats(data);
        } catch (error) {
            console.error('Error fetching user stats:', error);
        }
    };

    const fetchUsers = async () => {
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append('search', searchTerm);
            if (roleFilter !== 'All Roles') params.append('role', roleFilter);
            const response = await axios.get(`/api/users?${params.toString()}`);
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (user: User) => {
        setSelectedUser(user);
        setEditForm({
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            department: user.department,
            status: user.status
        });
        setShowEditModal(true);
    };

    const handleEditSave = async () => {
        if (!selectedUser) return;
        setSaving(true);
        try {
            await axios.put(`/api/users/${selectedUser.id}`, editForm);
            setShowEditModal(false);
            fetchUsers();
            fetchStats();
        } catch (error) {
            console.error('Error updating user:', error);
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
            'Department Head': { bg: '#fff7ed', color: '#ea580c' },
            'HOD': { bg: '#f0f9ff', color: '#0369a1' },
            'Committee Member': { bg: '#f5f3ff', color: '#6d28d9' },
            'Staff': { bg: '#eff6ff', color: 'var(--mubs-blue)' }
        };
        return styles[role] || { bg: '#f1f5f9', color: '#475569' };
    };

    const getRoleIcon = (role: string) =>
        role === 'System Administrator' ? 'shield' :
            role === 'Strategy Manager' ? 'manage_accounts' :
                role === 'Department Head' || role === 'HOD' ? 'corporate_fare' :
                    role === 'Committee Member' ? 'groups' : 'assignment_ind';

    // Client-side pagination
    const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
    const paginatedUsers = users.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    return (
        <Layout>
            {/* Stat Cards */}
            <div className="row g-4 mb-4">
                <div className="col-sm-4 col-xl-4">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-blue)' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#eff6ff' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>group</span>
                            </div>
                            <span className="stat-badge" style={{ background: '#eff6ff', color: 'var(--mubs-blue)' }}>Total</span>
                        </div>
                        <div className="stat-label">System Users</div>
                        <div className="stat-value">{stats.total}</div>
                    </div>
                </div>
                <div className="col-sm-4 col-xl-4">
                    <div className="stat-card" style={{ borderLeftColor: '#10b981' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#ecfdf5' }}>
                                <span className="material-symbols-outlined" style={{ color: '#059669' }}>verified_user</span>
                            </div>
                            <span className="stat-badge" style={{ background: '#ecfdf5', color: '#059669' }}>Active</span>
                        </div>
                        <div className="stat-label">Active Accounts</div>
                        <div className="stat-value">{stats.active}</div>
                    </div>
                </div>
                <div className="col-sm-4 col-xl-4">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-yellow)' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#fffbeb' }}>
                                <span className="material-symbols-outlined" style={{ color: '#b45309' }}>admin_panel_settings</span>
                            </div>
                            <span className="stat-badge" style={{ background: '#fffbeb', color: '#b45309' }}>Roles</span>
                        </div>
                        <div className="stat-label">Defined Roles</div>
                        <div className="stat-value">{stats.definedRoles}</div>
                    </div>
                </div>
            </div>

            {/* Users Table */}
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
                            style={{ width: '140px' }}
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option>All Roles</option>
                            <option>System Administrator</option>
                            <option>Strategy Manager</option>
                            <option>Department Head</option>
                            <option>HOD</option>
                            <option>Committee Member</option>
                            <option>Staff</option>
                        </select>
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
                                <th>Department / Department</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-4">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-4 text-muted">No users found</td>
                                </tr>
                            ) : (
                                paginatedUsers.map((user) => {
                                    const roleStyle = getRoleBadge(user.role);
                                    const statusStyle = getStatusBadge(user.status);
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
                                                        const roleStyle = getRoleBadge(cleanRole);
                                                        return (
                                                            <span key={i} className="role-badge" style={{ background: roleStyle.bg, color: roleStyle.color }}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{getRoleIcon(cleanRole)}</span>
                                                                {cleanRole}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td style={{ fontSize: '.83rem' }}>{user.department}</td>
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
                        Showing {users.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, users.length)} of {stats.total} users
                    </span>
                    <div className="d-flex gap-1">
                        <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                            <button
                                key={pg}
                                className={`page-btn ${pg === currentPage ? 'active' : ''}`}
                                onClick={() => setCurrentPage(pg)}
                            >{pg}</button>
                        ))}
                        <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
                    </div>
                </div>
            </div>

            {/* Edit User Modal */}
            <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
                <Modal.Header closeButton className="modal-header-mubs">
                    <Modal.Title className="fw-bold d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined">manage_accounts</span>
                        Edit User
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="row g-3">
                        <div className="col-12">
                            <Form.Label className="fw-bold small">Full Name</Form.Label>
                            <Form.Control
                                value={editForm.full_name}
                                onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                            />
                        </div>
                        <div className="col-12">
                            <Form.Label className="fw-bold small">Email Address</Form.Label>
                            <Form.Control
                                type="email"
                                value={editForm.email}
                                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                            />
                        </div>
                        <div className="col-12">
                            <Form.Label className="fw-bold small">Roles (Select all that apply)</Form.Label>
                            <div className="d-flex flex-wrap gap-2 p-2 border rounded bg-light">
                                {['System Administrator', 'Strategy Manager', 'Department Head', 'HOD', 'Committee Member', 'Staff'].map(r => (
                                    <div key={r} className="form-check">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            id={`edit-role-${r}`}
                                            checked={editForm.role.split(',').map(x => x.trim()).includes(r)}
                                            onChange={e => {
                                                const roles = editForm.role.split(',').map(x => x.trim()).filter(Boolean);
                                                const newRoles = e.target.checked
                                                    ? [...roles, r]
                                                    : roles.filter(x => x !== r);
                                                setEditForm({ ...editForm, role: newRoles.join(', ') });
                                            }}
                                        />
                                        <label className="form-check-label small" htmlFor={`edit-role-${r}`}>{r}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="col-12">
                            <Form.Label className="fw-bold small">Department / Department</Form.Label>
                            <Form.Control
                                value={editForm.department}
                                onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                            />
                        </div>
                        <div className="col-12">
                            <Form.Label className="fw-bold small">Status</Form.Label>
                            <Form.Select
                                value={editForm.status}
                                onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                            >
                                <option>Active</option>
                                <option>Pending</option>
                                <option>Suspended</option>
                            </Form.Select>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => setShowEditModal(false)} disabled={saving}>Cancel</Button>
                    <Button
                        style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                        className="fw-bold text-white"
                        disabled={saving || !editForm.full_name.trim()}
                        onClick={handleEditSave}
                    >
                        <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>save</span>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteModal} onHide={() => !deleting && setShowDeleteModal(false)} centered>
                <Modal.Header closeButton className="modal-header-mubs">
                    <Modal.Title className="fw-bold d-flex align-items-center gap-2 text-danger">
                        <span className="material-symbols-outlined">warning</span>
                        Confirm Deletion
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to delete the user <strong>{userToDelete?.full_name}</strong>?</p>
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
        </Layout>
    );
}
