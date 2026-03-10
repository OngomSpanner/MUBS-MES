"use client";

import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

interface CreateUserModalProps {
  show: boolean;
  onHide: () => void;
  onUserCreated: () => void;
}

export default function CreateUserModal({ show, onHide, onUserCreated }: CreateUserModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'Staff',
    department: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onUserCreated();
        onHide();
        setFormData({
          full_name: '',
          email: '',
          role: 'Staff',
          department: '',
          password: ''
        });
      }
    } catch (error) {
      console.error('Error creating user:', error);
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
                {['System Administrator', 'Strategy Manager', 'Department Head', 'HOD', 'Committee Member', 'Staff'].map(r => (
                  <div key={r} className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`role-${r}`}
                      checked={formData.role.split(',').map(x => x.trim()).includes(r)}
                      onChange={e => {
                        const roles = formData.role.split(',').map(x => x.trim()).filter(Boolean);
                        const newRoles = e.target.checked
                          ? [...roles, r]
                          : roles.filter(x => x !== r);
                        setFormData({ ...formData, role: newRoles.join(', ') });
                      }}
                    />
                    <label className="form-check-label small" htmlFor={`role-${r}`}>{r}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-md-6">
              <Form.Label className="fw-bold small">Department / Department</Form.Label>
              <Form.Select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              >
                <option>Faculty of Computing</option>
                <option>Faculty of Commerce</option>
                <option>School of Grad Studies</option>
                <option>Finance & Admin</option>
                <option>Research & Innovation</option>
                <option>eLearning Centre</option>
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