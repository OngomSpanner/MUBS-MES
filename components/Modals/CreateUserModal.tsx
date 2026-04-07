"use client";

import { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { formatRoleForDisplay } from '@/lib/role-routing';
import { COMMITTEE_TYPES } from '@/lib/committee-types';

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
    first_name: '',
    surname: '',
    other_names: '',
    email: '',
    role: '',
    department_id: '' as string | number,
    managed_unit_id: '' as string | number,
    password: '',
    committee_types: [] as string[],
    employee_id: '',
    contract_terms: 'Permanent',
    contract_type: 'Full-time',
    staff_category: 'Administrative',
    position: '',
    contract_start: '',
    contract_end: '',
  });
  const [roles, setRoles] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Department[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const hasCommitteeRole = formData.role
    ? formData.role.split(',').map((r) => r.trim()).filter(Boolean).some((r) => r === 'committee_member' || formatRoleForDisplay(r) === 'Committee Member')
    : false;
  
  const hasAmbassadorRole = formData.role
    ? formData.role.split(',').map((r) => r.trim()).filter(Boolean).includes('ambassador')
    : false;

  useEffect(() => {
    if (!show) return;
    const load = async () => {
      setLoadingOptions(true);
      try {
        const [rolesRes, deptRes, facRes] = await Promise.all([
          fetch('/api/users/roles'),
          fetch('/api/departments?units_only=true'),
          fetch('/api/departments?parents_only=true')
        ]);
        if (rolesRes.ok) {
          const data = await rolesRes.json();
          setRoles(data.roles || []);
        }
        if (deptRes.ok) {
          const list = await deptRes.json();
          setDepartments(Array.isArray(list) ? list : []);
        }
        if (facRes.ok) {
          const list = await facRes.json();
          setFaculties(Array.isArray(list) ? list : []);
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
          first_name: formData.first_name,
          surname: formData.surname,
          other_names: formData.other_names,
          email: formData.email,
          password: formData.password || undefined,
          role: roleList.join(','),
          department_id: departmentId,
          managed_unit_id: hasAmbassadorRole && formData.managed_unit_id !== '' ? Number(formData.managed_unit_id) : null,
          committee_types: hasCommitteeRole ? formData.committee_types : undefined,
          employee_id: formData.employee_id,
          contract_terms: formData.contract_terms,
          contract_type: formData.contract_type,
          staff_category: formData.staff_category,
          position: formData.position,
          contract_start: formData.contract_start,
          contract_end: formData.contract_end,
        })
      });

      if (response.ok) {
        onUserCreated();
        onHide();
        setFormData({
          first_name: '',
          surname: '',
          other_names: '',
          email: '',
          role: '',
          department_id: '',
          managed_unit_id: '',
          password: '',
          committee_types: [],
          employee_id: '',
          contract_terms: 'Permanent',
          contract_type: 'Full-time',
          staff_category: 'Administrative',
          position: '',
          contract_start: '',
          contract_end: '',
        });
      } else {
        const data = await response.json().catch(() => ({}));
        const detail = data.detail ? ` ${data.detail}` : '';
        alert(data.message || 'Failed to create user.' + detail);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user.');
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg" backdrop="static" keyboard={false}>
      <Modal.Header closeButton className="modal-header-mubs">
        <Modal.Title className="fw-bold d-flex align-items-center gap-2">
          <span className="material-symbols-outlined">person_add</span>
          Create New User
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <div className="row g-3">
            <div className="col-md-4">
              <Form.Label className="fw-bold small">First Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. Joan"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="col-md-4">
              <Form.Label className="fw-bold small">Surname</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. Namutebi"
                value={formData.surname}
                onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                required
              />
            </div>
            <div className="col-md-4">
              <Form.Label className="fw-bold small">Other Names</Form.Label>
              <Form.Control
                type="text"
                placeholder="Optional"
                value={formData.other_names}
                onChange={(e) => setFormData({ ...formData, other_names: e.target.value })}
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
            <div className="col-md-6">
              <Form.Label className="fw-bold small">Employee ID (Optional)</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. EMP001"
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              />
            </div>
            
            <div className="col-12 py-1">
              <hr className="my-1 opacity-25" />
              <div className="fw-bold small text-primary mb-2">Employment & Contract Details</div>
            </div>

            <div className="col-md-4">
              <Form.Label className="fw-bold small">Staff Category</Form.Label>
              <Form.Select
                value={formData.staff_category}
                onChange={(e) => setFormData({ ...formData, staff_category: e.target.value })}
              >
                <option value="Administrative">Administrative</option>
                <option value="Support">Support</option>
              </Form.Select>
            </div>
            <div className="col-md-8">
              <Form.Label className="fw-bold small">Official Position</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. SENIOR LECTURER"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              />
            </div>
            <div className="col-md-6">
              <Form.Label className="fw-bold small">Contract Start Date</Form.Label>
              <Form.Control
                type="date"
                value={formData.contract_start}
                onChange={(e) => setFormData({ ...formData, contract_start: e.target.value })}
              />
            </div>
            <div className="col-md-6">
              <Form.Label className="fw-bold small">Contract End Date</Form.Label>
              <Form.Control
                type="date"
                value={formData.contract_end}
                onChange={(e) => setFormData({ ...formData, contract_end: e.target.value })}
              />
            </div>

            <div className="col-md-4">
              <Form.Label className="fw-bold small">Contract Terms</Form.Label>
              <Form.Select
                value={formData.contract_terms}
                onChange={(e) => setFormData({ ...formData, contract_terms: e.target.value })}
              >
                <option value="Permanent">Permanent</option>
                <option value="Contract">Contract</option>
              </Form.Select>
            </div>
            <div className="col-md-4">
              <Form.Label className="fw-bold small">Contract Type</Form.Label>
              <Form.Select
                value={formData.contract_type}
                onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
              </Form.Select>
            </div>

            <div className="col-12 py-1">
              <hr className="my-1 opacity-25" />
              <div className="fw-bold small text-primary mb-2">Roles & Assignments</div>
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
              <Form.Label className="fw-bold small">Department/Unit</Form.Label>
              <Form.Select
                value={formData.department_id === '' ? '' : String(formData.department_id)}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value === '' ? '' : Number(e.target.value) })}
              >
                <option value="">Select department/unit</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Form.Select>
            </div>
            {hasAmbassadorRole && (
              <div className="col-md-6">
                <Form.Label className="fw-bold small">Managed Faculty / Office Oversight</Form.Label>
                <Form.Select
                  value={formData.managed_unit_id === '' ? '' : String(formData.managed_unit_id)}
                  onChange={(e) => setFormData({ ...formData, managed_unit_id: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="border-primary"
                >
                  <option value="">Select faculty/office to oversee</option>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </Form.Select>
                <Form.Text className="text-primary small">This user will oversee all units under this Faculty/Office.</Form.Text>
              </div>
            )}
            {hasCommitteeRole && (
              <div className="col-12">
                <Form.Label className="fw-bold small">Committees (select committees this member belongs to)</Form.Label>
                <div className="d-flex flex-wrap gap-2 p-2 border rounded bg-light">
                  {COMMITTEE_TYPES.map((ct) => {
                    const checked = formData.committee_types.includes(ct);
                    return (
                      <div key={ct} className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`committee-${ct}`}
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...formData.committee_types, ct]
                              : formData.committee_types.filter((x) => x !== ct);
                            setFormData({ ...formData, committee_types: next });
                          }}
                        />
                        <label className="form-check-label small" htmlFor={`committee-${ct}`}>
                          {ct}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="col-12">
              <Form.Label className="fw-bold small">Temporary Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Leave blank for auto-generated"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <Form.Text className="text-muted small">User must set a new password on first login.</Form.Text>
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