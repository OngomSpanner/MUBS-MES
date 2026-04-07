"use client";

import { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { STRATEGIC_PILLARS_2025_2030, CORE_OBJECTIVES_2025_2030 } from '@/lib/strategic-plan';
import {
  ACTIVITY_FY_TARGET_COLUMNS,
  type ActivityFyTargetKey,
  fyInputFromRow,
  parseFyPayload,
} from '@/lib/activity-fy-targets';
import {
  ACTIVITY_FY_UNIT_OF_MEASURE_OPTIONS,
  normalizeActivityUnitOfMeasure,
  symbolForActivityUnitOfMeasure,
  labelForActivityUnitOfMeasure,
} from '@/lib/activity-unit-of-measure';
import axios from 'axios';
import { fyRangeJulyJune, formatFyRangeShort } from '@/lib/financial-year';

interface Activity {
  id?: number;
  title: string;
  strategic_objective: string;
  standard_id?: number | null;
  pillar: string;
  target_kpi: string;
  department_id?: number | null;
  department_ids?: number[];
  kpi_target_value?: number | string | null;
  target_fy25_26?: string | number | null;
  target_fy26_27?: string | number | null;
  target_fy27_28?: string | number | null;
  target_fy28_29?: string | number | null;
  target_fy29_30?: string | number | null;
  unit_of_measure?: string | null;
  status: string;
  parent_id?: string | number | null;
  progress?: number;
}

type FormState = {
  title: string;
  strategic_objective: string;
  standard_id: string;
  pillar: string;
  target_kpi: string;
  department_ids: number[];
  status: string;
  parent_id: string;
  unit_of_measure: string;
} & Record<ActivityFyTargetKey, string>;

interface CreateActivityModalProps {
  show: boolean;
  onHide: () => void;
  onActivityCreated: () => void;
  activity?: Activity | null;
  mode?: 'create' | 'edit' | 'reassign';
}

const FY_EMPTY = fyInputFromRow({});

const BLANK: FormState = {
  title: '',
  strategic_objective: '',
  standard_id: '',
  pillar: '',
  target_kpi: '',
  department_ids: [] as number[],
  status: 'pending',
  parent_id: '',
  unit_of_measure: 'numeric',
  ...FY_EMPTY,
};

export default function CreateActivityModal({
  show, onHide, onActivityCreated, activity = null, mode = 'create'
}: CreateActivityModalProps) {

  const [formData, setFormData] = useState<FormState>({ ...BLANK });
  const [departments, setDepartments] = useState<{ id: number; name: string; parent_id: number | null; unit_type: string }[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (show) {
      fetchDepartments();
      fetchStandards();
    }
  }, [show]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) { console.error('Error fetching departments:', error); }
  };

  const fetchStandards = async () => {
    try {
      const res = await axios.get('/api/standards');
      setStandards(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error('Error fetching standards:', e); }
  };

  const departmentOptions = departments.filter(d => d.unit_type === 'department' || d.unit_type === 'unit');
  const facultyOfficeOptions = departments.filter(d => d.unit_type === 'faculty' || d.unit_type === 'office');

  const searchResults = searchTerm.trim() === '' ? [] : [
    ...facultyOfficeOptions.filter(fo => 
      fo.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).map(fo => ({ ...fo, isGroup: true, subLabel: '' })),
    ...departmentOptions.filter(d => 
      d.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).map(d => {
      const parent = facultyOfficeOptions.find(p => p.id === d.parent_id);
      return { ...d, isGroup: false, subLabel: parent ? parent.name : '' };
    })
  ].slice(0, 8);

  const addUnit = (id: number) => {
    if (!formData.department_ids.includes(id)) {
      setFormData({ ...formData, department_ids: [...formData.department_ids, id] });
    }
    setSearchTerm('');
    setShowResults(false);
  };

  const addByParent = (parentId: number) => {
    const childIds = departments.filter(d => d.parent_id === parentId).map(d => d.id);
    const newIds = Array.from(new Set([...formData.department_ids, ...childIds]));
    setFormData({ ...formData, department_ids: newIds });
    setSearchTerm('');
    setShowResults(false);
  };

  const removeUnit = (id: number) => {
    setFormData({ ...formData, department_ids: formData.department_ids.filter(i => i !== id) });
  };

  useEffect(() => {
    if (activity && show) {
      const ids = activity.department_id != null 
        ? [Number(activity.department_id)] 
        : (activity.department_ids && activity.department_ids.length > 0 ? activity.department_ids : []);
      setFormData({
        title: activity.title || '',
        strategic_objective: activity.strategic_objective || '',
        standard_id: activity.standard_id ? String(activity.standard_id) : '',
        pillar: activity.pillar || '',
        target_kpi: activity.target_kpi || '',
        department_ids: ids,
        status: activity.status || 'pending',
        parent_id: activity.parent_id ? String(activity.parent_id) : '',
        unit_of_measure: normalizeActivityUnitOfMeasure(activity.unit_of_measure),
        ...fyInputFromRow(activity),
      });
    } else if (!activity && show) {
      setFormData({ ...BLANK });
    }
  }, [activity, show]);

  const isEdit = mode === 'edit' || mode === 'reassign';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');

    try {
      const url = isEdit ? `/api/activities/${activity!.id}` : '/api/activities';
      const method = isEdit ? 'PUT' : 'POST';

      const fyFields = {} as Record<ActivityFyTargetKey, string>;
      for (const { key } of ACTIVITY_FY_TARGET_COLUMNS) fyFields[key] = formData[key];
      const fyPayload = parseFyPayload(fyFields);

      let kpiPreserve: number | null = null;
      if (isEdit && activity && activity.kpi_target_value != null && activity.kpi_target_value !== '') {
        const n = Number(activity.kpi_target_value);
        kpiPreserve = Number.isFinite(n) ? n : null;
      }

      const payload = {
        title: formData.title,
        strategic_objective: formData.strategic_objective,
        standard_id: formData.standard_id ? parseInt(formData.standard_id, 10) : null,
        pillar: formData.pillar,
        target_kpi: formData.target_kpi,
        department_ids: formData.department_ids,
        status: formData.status,
        parent_id: formData.parent_id || null,
        progress: activity?.progress ?? 0,
        kpi_target_value: kpiPreserve,
        unit_of_measure: normalizeActivityUnitOfMeasure(formData.unit_of_measure),
        ...fyPayload,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        onActivityCreated();
        onHide();
        setFormData({ ...BLANK });
      } else {
        setSubmitError(data?.message || data?.detail || 'Failed to save activity');
      }
    } catch (error: any) {
      console.error('Error saving activity:', error);
      setSubmitError(error.message || 'Failed to save activity');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedStandard = standards.find(s => String(s.id) === formData.standard_id);

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      scrollable
      backdrop="static"
      dialogClassName="modal-create-activity"
    >
      <Modal.Header closeButton className="modal-header-mubs py-2">
        <Modal.Title className="fw-bold d-flex align-items-center gap-2 fs-6 mb-0">
          <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>{mode === 'create' ? 'add_task' : 'edit'}</span>
          {mode === 'create' ? 'Create Activity' : 'Edit Activity'}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body className="p-3">
          <div className="row g-2">
            
            <div className="col-12">
              <Form.Label className="fw-bold small mb-1">Strategic Objective</Form.Label>
              <Form.Select
                size="sm"
                value={formData.strategic_objective}
                onChange={(e) => setFormData({ ...formData, strategic_objective: e.target.value })}
                required
              >
                <option value="">Select an Objective...</option>
                {CORE_OBJECTIVES_2025_2030.map((obj) => (
                  <option key={obj} value={obj}>{obj}</option>
                ))}
              </Form.Select>
            </div>

            <div className="col-12 col-md-6">
              <Form.Label className="fw-bold small mb-1">Pillar</Form.Label>
              <Form.Select
                size="sm"
                value={formData.pillar}
                onChange={(e) => setFormData({ ...formData, pillar: e.target.value })}
                required
              >
                <option value="">Select a Pillar...</option>
                {STRATEGIC_PILLARS_2025_2030.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Form.Select>
            </div>

            <div className="col-12 col-md-6">
              <Form.Label className="fw-bold small mb-1">Activity Name</Form.Label>
              <Form.Control
                size="sm"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="col-12">
              <Form.Label className="fw-bold small mb-1">Select Standard</Form.Label>
              <Form.Select
                size="sm"
                value={formData.standard_id}
                onChange={(e) => setFormData({ ...formData, standard_id: e.target.value })}
                required
              >
                <option value="">Select a saved standard...</option>
                {standards.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </Form.Select>
              {selectedStandard && (
                <div className="mt-1 py-1 px-2 bg-info bg-opacity-10 border border-info border-opacity-25 rounded small text-muted" style={{ fontSize: '0.75rem', lineHeight: 1.35 }}>
                  <span className="fw-semibold text-dark">{selectedStandard.title}</span>
                  {' · '}
                  {selectedStandard.processes?.length || 0} process{(selectedStandard.processes?.length || 0) === 1 ? '' : 'es'}
                </div>
              )}
            </div>

            {selectedStandard?.performance_indicator ? (
              <div className="col-12">
                <div className="py-2 px-2 bg-light border rounded small text-muted" style={{ fontSize: '0.78rem', lineHeight: 1.35 }}>
                  <span className="fw-semibold text-dark">Standard completion indicator:</span>{' '}
                  {selectedStandard.performance_indicator}
                </div>
              </div>
            ) : null}

            <div className="col-12">
              <Form.Label className="fw-bold small mb-1">Unit of measure (FY targets)</Form.Label>
              <Form.Select
                size="sm"
                value={formData.unit_of_measure}
                onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                required
              >
                {ACTIVITY_FY_UNIT_OF_MEASURE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Form.Select>
            </div>

            <div className="col-12">
              <Form.Label className="fw-bold small mb-1">Targets by financial year</Form.Label>
              <div className="table-responsive border rounded">
                <table className="table table-sm table-bordered align-middle mb-0" style={{ fontSize: '0.72rem' }}>
                  <thead className="table-light">
                    <tr>
                      {ACTIVITY_FY_TARGET_COLUMNS.map(({ key, label }) => (
                        <th key={key} className="text-center px-1 py-1">
                          <span title={formatFyRangeShort(fyRangeJulyJune(label.replace('FY ', '')))}>
                            {label.replace('FY ', '')}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {ACTIVITY_FY_TARGET_COLUMNS.map(({ key }) => (
                        <td key={key} className="p-0 align-middle">
                          <div className="d-flex align-items-stretch">
                            <Form.Control
                              type="number"
                              step="any"
                              size="sm"
                              className="text-center border-0 rounded-0 flex-grow-1"
                              style={{ fontSize: '0.8rem', minWidth: 0 }}
                              placeholder="—"
                              value={formData[key]}
                              onChange={(e) =>
                                setFormData({ ...formData, [key]: e.target.value } as FormState)
                              }
                            />
                            <span
                              className="d-flex align-items-center justify-content-center text-secondary border-start bg-light px-1 fw-bold user-select-none"
                              style={{ fontSize: '0.65rem', minWidth: '2rem', letterSpacing: '-0.02em' }}
                              title={labelForActivityUnitOfMeasure(formData.unit_of_measure)}
                            >
                              {symbolForActivityUnitOfMeasure(formData.unit_of_measure)}
                            </span>
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="col-12 pt-2 border-top">
              <Form.Label className="fw-bold small d-flex justify-content-between align-items-center mb-1">
                <span>Responsible Office(s)</span>
                <span className="text-muted fw-normal" style={{ fontSize: '0.65rem' }}>Search to add</span>
              </Form.Label>
              
              <div className="position-relative mb-2">
                <Form.Control
                  type="text"
                  placeholder="Search departments..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setShowResults(true); }}
                  onFocus={() => setShowResults(true)}
                  size="sm"
                />
                
                {showResults && searchResults.length > 0 && (
                  <div className="position-absolute w-100 bg-white border rounded shadow-sm mt-1 overflow-hidden" style={{ zIndex: 1050 }}>
                    {searchResults.map((res: any) => (
                      <button
                        key={`${res.isGroup ? 'g' : 'u'}-${res.id}`}
                        type="button"
                        className="btn btn-white w-100 text-start px-2 py-1 border-bottom hover-bg-light small d-flex justify-content-between align-items-center"
                        onClick={() => res.isGroup ? addByParent(res.id) : addUnit(res.id)}
                      >
                        <span className="small">{res.name} {res.subLabel && <span className="text-muted">({res.subLabel})</span>}</span>
                        {res.isGroup && <span className="badge bg-primary opacity-75">Add All</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="d-flex flex-wrap gap-2" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                {formData.department_ids.map(id => {
                  const dept = departments.find(d => d.id === id);
                  return (
                    <span key={id} className="badge bg-light text-primary border d-flex align-items-center gap-2 py-1 px-2">
                      {dept?.name || id}
                      <span className="material-symbols-outlined p-0" style={{ fontSize: '14px', cursor: 'pointer' }} onClick={() => removeUnit(id)}>close</span>
                    </span>
                  );
                })}
                {formData.department_ids.length === 0 && (
                  <span className="text-muted small">No offices selected yet.</span>
                )}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary py-0"
                  style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                  onClick={() => setFormData({ ...formData, department_ids: [] })}
                  disabled={formData.department_ids.length === 0}
                >
                  Clear selection
                </button>
              </div>
            </div>

          </div>
          {submitError && <div className="alert alert-danger mt-2 mb-0 py-2 small">{submitError}</div>}
        </Modal.Body>
        <Modal.Footer className="justify-content-end py-2">
          <Button type="submit" size="sm" style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Activity'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}