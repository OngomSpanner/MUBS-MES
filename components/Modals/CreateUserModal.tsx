"use client";

import { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { formatRoleForDisplay } from '@/lib/role-routing';

interface CreateUserModalProps {
  show: boolean;
  onHide: () => void;
  onUserCreated: () => void;
}

interface Department {
  id: number;
  name: string;
}

export default function CreateUserModal({ show, onHide, onUserCreated }: CreateUserModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: '',
    department_id: '' as string | number,
    password: ''
  });
  const [roles, setRoles] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!show) return;
    const load = async () => {
      setLoadingOptions(true);
      try {
        const [rolesRes, deptRes] = await Promise.all([
          fetch('/api/users/roles'),
          fetch('/api/departments')
        ]);
        if (rolesRes.ok) {
          const data = await rolesRes.json();
          setRoles(data.roles || []);
        }
        if (deptRes.ok) {
          const list = await deptRes.json();
          setDepartments(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        console.error('Error loading roles/departments', e);
      } finally {
        setLoadingOptions(false);
      }
    };
    load();
  }, [show]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const roleList = formData.role ? formData.role.split(',').map((r) => r.trim()).filter(Boolean) : [];
    if (roleList.length === 0) {
      alert('Please select at least one role.');
      return;
    }
    const departmentId = formData.department_id === '' ? null : Number(formData.department_id);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.full_name,
          email: formData.email,
          password: formData.password || undefined,
          role: roleList.join(','),
          department_id: departmentId
        })
      });

      if (response.ok) {
        onUserCreated();
        onHide();
        setFormData({
          full_name: '',
          email: '',
          role: '',
          department_id: '',
          password: ''
        });
      } else {
        const data = await response.json().catch(() => ({}));
        alert(data.message || 'Failed to create user.');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user.');
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton className="modal-header-mubs">
        <Modal.Title className="fw-bold d-flex align-items-center gap-2">
          <span className="material-symbols-outlined">person_add</span>
          Create New User
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <div className="row g-3">
            <div className="col-md-6">
              <Form.Label className="fw-bold small">Full Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. Joan Namutebi"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>
            <div className="col-md-6">
              <Form.Label className="fw-bold small">Email Address</Form.Label>
              <Form.Control
                type="email"
                placeholder="j.namutebi@mubs.ac.ug"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="col-12">
              <Form.Label className="fw-bold small">Assign Roles (Select all that apply)</Form.Label>
              <div className="d-flex flex-wrap gap-2 p-2 border rounded bg-light">
                {loadingOptions ? (
                  <span className="text-muted small">Loading roles...</span>
                ) : roles.length === 0 ? (
                  <span className="text-muted small">No roles available.</span>
                ) : (
                  roles.map((r) => {
                    const roleList = formData.role ? formData.role.split(',').map((x) => x.trim()).filter(Boolean) : [];
                    const checked = roleList.includes(r);
                    return (
                      <div key={r} className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`role-${r}`}
                          checked={checked}
                          onChange={(e) => {
                            const newRoles = e.target.checked
                              ? [...roleList, r]
                              : roleList.filter((x) => x !== r);
                            setFormData({ ...formData, role: newRoles.join(',') });
                          }}
                        />
                        <label className="form-check-label small" htmlFor={`role-${r}`}>
                          {formatRoleForDisplay(r)}
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="col-md-6">
              <Form.Label className="fw-bold small">Department</Form.Label>
              <Form.Select
                value={formData.department_id === '' ? '' : String(formData.department_id)}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value === '' ? '' : Number(e.target.value) })}
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Form.Select>
            </div>
            <div className="col-12">
              <Form.Label className="fw-bold small">Temporary Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Leave blank for auto-generated"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div className="col-12">
              <Form.Check
                type="checkbox"
                id="sendEmail"
                label={<span className="fw-bold small">Send activation email to user</span>}
                defaultChecked
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide}>
            Cancel
          </Button>
          <Button
            type="submit"
            style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
            className="fw-bold text-white"
          >
            <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>check</span>
            Create User
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}