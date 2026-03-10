"use client";

import { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

interface Activity {
  id?: number;
  title: string;
  strategic_objective: string;
  pillar: string;
  department_id: string | number | string[];
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
  pillar: 'Teaching & Learning',
  department_id: [] as string[],
  target_kpi: '',
  status: 'Not Started',
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (show) {
      fetchParents();
    }
  }, [show]);

  const fetchParents = async () => {
    try {
      const response = await fetch('/api/activities');
      if (response.ok) {
        const data = await response.json();
        // Only show activities that aren't children themselves (shallow hierarchy)
        // or just show all but exclude the current one if editing
        setParents(data.filter((a: Activity) => a.id !== activity?.id));
      }
    } catch (error) {
      console.error('Error fetching parents:', error);
    }
  };

  // Populate form when editing
  useEffect(() => {
    if (activity && show) {
      setFormData({
        title: activity.title || '',
        strategic_objective: activity.strategic_objective || '',
        pillar: activity.pillar || 'Teaching & Learning',
        department_id: activity.department_id ? String(activity.department_id).split(',').map(s => s.trim()) : [],
        target_kpi: activity.target_kpi || '',
        status: activity.status || 'Not Started',
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
        ? { ...formData, progress: activity?.progress ?? 0 }
        : formData;

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
                  <span className="text-muted ms-2">— select a new department below</span>
                </div>
              </div>
            )}

            {mode !== 'reassign' && (
              <div className="col-12">
                <Form.Label className="fw-bold small">Strategic Objective</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g. Enhance quality of academic programs"
                  value={formData.strategic_objective}
                  onChange={(e) => setFormData({ ...formData, strategic_objective: e.target.value })}
                />
              </div>
            )}

            <div className="col-md-6">
              <Form.Label className="fw-bold small">Strategic Pillar</Form.Label>
              <Form.Select
                value={formData.pillar}
                onChange={(e) => setFormData({ ...formData, pillar: e.target.value })}
                disabled={mode === 'reassign'}
              >
                <option>Teaching &amp; Learning</option>
                <option>Research &amp; Innovation</option>
                <option>Governance</option>
                <option>Infrastructure</option>
                <option>Partnerships</option>
              </Form.Select>
            </div>

            <div className="col-md-6">
              <Form.Label className="fw-bold small">
                {mode === 'reassign' ? '🔁 Assign to New Department(s)' : 'Assign to Department(s) (Hold Ctrl/Cmd to select multiple)'}
              </Form.Label>
              <Form.Select
                multiple
                value={Array.isArray(formData.department_id) ? formData.department_id : formData.department_id ? String(formData.department_id).split(',') : []}
                onChange={(e) => {
                  const options = e.target.options;
                  const selectedValues = [];
                  for (let i = 0; i < options.length; i++) {
                    if (options[i].selected) {
                      selectedValues.push(options[i].value);
                    }
                  }
                  setFormData({ ...formData, department_id: selectedValues });
                }}
                required
                style={{ minHeight: '120px' }}
              >
                <option value="1">Faculty of Computing</option>
                <option value="2">Faculty of Commerce</option>
                <option value="3">School of Grad Studies</option>
                <option value="4">Finance &amp; Admin</option>
                <option value="5">Research &amp; Innovation</option>
                <option value="6">eLearning Centre</option>
              </Form.Select>
            </div>

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
                    <option>Not Started</option>
                    <option>In Progress</option>
                    <option>On Track</option>
                    <option>Delayed</option>
                    <option>Completed</option>
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
                  <Form.Label className="fw-bold small">Timeline Description (Optional manually overridden string)</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. Q1 2024 - Q3 2025"
                    value={formData.timeline}
                    onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                  />
                </div>
                <div className="col-12">
                  <Form.Label className="fw-bold small">Description / Notes</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Describe the activity objectives and scope..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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