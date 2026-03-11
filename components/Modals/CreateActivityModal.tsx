"use client";

import { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { STRATEGIC_PILLARS_2025_2030, CORE_OBJECTIVES_2025_2030 } from '@/lib/strategic-plan';

interface Activity {
  id?: number;
  title: string;
  strategic_objective: string;
  pillar: string;
  core_objective?: string | null;
  department_id?: number | null;
  department_ids?: number[];
  target_kpi: string;
  status: string;
  priority?: string;
  parent_id?: string | number | null;
  progress?: number;
  start_date: string;
  end_date: string;
  timeline: string;
  description: string;
}

interface CreateActivityModalProps {
  show: boolean;
  onHide: () => void;
  onActivityCreated: () => void;
  activity?: Activity | null;   // if provided → Edit mode
  mode?: 'create' | 'edit' | 'reassign';
}

const BLANK = {
  title: '',
  strategic_objective: '',
  pillar: STRATEGIC_PILLARS_2025_2030[0],
  core_objective: '' as string,
  assignToDepartment: false,
  department_ids: [] as number[],
  target_kpi: '',
  status: 'pending',
  priority: 'Medium',
  parent_id: '',
  start_date: '',
  end_date: '',
  timeline: '',
  description: ''
};

export default function CreateActivityModal({
  show, onHide, onActivityCreated, activity = null, mode = 'create'
}: CreateActivityModalProps) {

  const [formData, setFormData] = useState({ ...BLANK });
  const [parents, setParents] = useState<Activity[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string; parent_id: number | null; unit_type: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (show) {
      fetchParents();
      fetchDepartments();
    }
  }, [show]);

  const fetchParents = async () => {
    try {
      const response = await fetch('/api/activities');
      if (response.ok) {
        const data = await response.json();
        setParents(data.filter((a: Activity) => a.id !== activity?.id));
      }
    } catch (error) {
      console.error('Error fetching parents:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const departmentUnitOptions = departments.filter(d => d.parent_id != null);

  // Populate form when editing
  useEffect(() => {
    if (activity && show) {
      const ids = activity.department_ids && activity.department_ids.length > 0
        ? activity.department_ids
        : (activity.department_id != null ? [Number(activity.department_id)] : []);
      setFormData({
        title: activity.title || '',
        strategic_objective: activity.strategic_objective || '',
        pillar: activity.pillar && STRATEGIC_PILLARS_2025_2030.includes(activity.pillar as any) ? activity.pillar : STRATEGIC_PILLARS_2025_2030[0],
        core_objective: activity.core_objective || '',
        assignToDepartment: ids.length > 0,
        department_ids: ids,
        target_kpi: activity.target_kpi || '',
        status: activity.status === 'in_progress' ? 'in_progress' : activity.status === 'completed' ? 'completed' : activity.status === 'overdue' ? 'overdue' : 'pending',
        priority: activity.priority || 'Medium',
        parent_id: activity.parent_id ? String(activity.parent_id) : '',
        start_date: activity.start_date ? activity.start_date.slice(0, 10) : '',
        end_date: activity.end_date ? activity.end_date.slice(0, 10) : '',
        timeline: activity.timeline || '',
        description: activity.description || ''
      });
    } else if (!activity && show) {
      setFormData({ ...BLANK });
    }
  }, [activity, show]);

  const isEdit = mode === 'edit' || mode === 'reassign';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = isEdit ? `/api/activities/${activity!.id}` : '/api/activities';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = isEdit
        ? { ...formData, progress: activity?.progress ?? 0, department_ids: formData.assignToDepartment ? formData.department_ids : [] }
        : { ...formData, department_ids: formData.assignToDepartment ? formData.department_ids : [] };
      delete (payload as any).assignToDepartment;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        onActivityCreated();
        onHide();
        setFormData({ ...BLANK });
      }
    } catch (error) {
      console.error('Error saving activity:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const titleLabel = mode === 'reassign' ? 'Reassign Activity'
    : mode === 'edit' ? 'Edit Activity'
      : 'Create Strategic Activity';

  const titleIcon = mode === 'reassign' ? 'assignment_ind'
    : mode === 'edit' ? 'edit'
      : 'add_task';

  const submitLabel = mode === 'reassign' ? 'Save Reassignment'
    : mode === 'edit' ? 'Save Changes'
      : 'Create Activity';

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton className="modal-header-mubs">
        <Modal.Title className="fw-bold d-flex align-items-center gap-2">
          <span className="material-symbols-outlined">{titleIcon}</span>
          {titleLabel}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <div className="row g-3">
            {/* Title — hidden in reassign mode */}
            {mode !== 'reassign' && (
              <div className="col-12">
                <Form.Label className="fw-bold small">Activity Title</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g. Digital Learning Infrastructure Phase 3"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
            )}

            {mode === 'reassign' && (
              <div className="col-12">
                <div className="alert alert-info py-2 px-3 small mb-0">
                  <strong>{formData.title}</strong>
                  <span className="text-muted ms-2">— select one or more departments/units below</span>
                </div>
              </div>
            )}

            <div className="col-md-6">
              <Form.Label className="fw-bold small">Strategic Pillar</Form.Label>
              <Form.Select
                value={formData.pillar}
                onChange={(e) => setFormData({ ...formData, pillar: e.target.value })}
                disabled={mode === 'reassign'}
              >
                {STRATEGIC_PILLARS_2025_2030.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Form.Select>
            </div>
            <div className="col-md-6">
              <Form.Label className="fw-bold small">Core Objective</Form.Label>
              <Form.Select
                value={formData.core_objective}
                onChange={(e) => setFormData({ ...formData, core_objective: e.target.value })}
                disabled={mode === 'reassign'}
              >
                <option value="">— Select objective —</option>
                {CORE_OBJECTIVES_2025_2030.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Form.Select>
            </div>

            <div className="col-12">
              <Form.Check
                type="checkbox"
                id="assignToDepartment"
                label="Assign to Department/Unit"
                checked={formData.assignToDepartment}
                onChange={(e) => setFormData({ ...formData, assignToDepartment: e.target.checked, department_ids: e.target.checked ? formData.department_ids : [] })}
              />
            </div>
            {formData.assignToDepartment && (
              <div className="col-12">
                <Form.Label className="fw-bold small mb-2">Select one or more Department(s)/Unit(s)</Form.Label>
                <div className="border rounded p-3 bg-light" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {departmentUnitOptions.map((d) => (
                    <Form.Check
                      key={d.id}
                      type="checkbox"
                      id={`dept-${d.id}`}
                      label={d.name}
                      checked={formData.department_ids.includes(d.id)}
                      onChange={(e) => {
                        const ids = e.target.checked
                          ? [...formData.department_ids, d.id]
                          : formData.department_ids.filter((id) => id !== d.id);
                        setFormData({ ...formData, department_ids: ids });
                      }}
                      className="mb-2"
                    />
                  ))}
                  {departmentUnitOptions.length === 0 && (
                    <span className="text-muted small">No departments/units loaded.</span>
                  )}
                </div>
              </div>
            )}

            {mode !== 'reassign' && (
              <>
                <div className="col-md-6">
                  <Form.Label className="fw-bold small">Target / KPI</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. 4 Labs upgraded"
                    value={formData.target_kpi}
                    onChange={(e) => setFormData({ ...formData, target_kpi: e.target.value })}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <Form.Label className="fw-bold small">Status</Form.Label>
                  <Form.Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="pending">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="overdue">Delayed</option>
                    <option value="completed">Completed</option>
                  </Form.Select>
                </div>
                <div className="col-md-6">
                  <Form.Label className="fw-bold small">Priority Level</Form.Label>
                  <Form.Select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </Form.Select>
                </div>
                <div className="col-md-6">
                  <Form.Label className="fw-bold small">Parent Activity (Optional)</Form.Label>
                  <Form.Select
                    value={formData.parent_id}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  >
                    <option value="">No Parent (Standalone)</option>
                    {parents.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-md-6">
                  <Form.Label className="fw-bold small">Start Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <Form.Label className="fw-bold small">End Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                  />
                </div>
                <div className="col-12">
                  <Form.Label className="fw-bold small">Strategic Objectives</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Describe the strategic objectives and scope..."
                    value={formData.strategic_objective}
                    onChange={(e) => setFormData({ ...formData, strategic_objective: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
            className="fw-bold text-white"
            disabled={submitting}
          >
            <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>
              {submitting ? 'hourglass_top' : 'check'}
            </span>
            {submitting ? 'Saving...' : submitLabel}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}