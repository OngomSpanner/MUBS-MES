'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Form } from 'react-bootstrap';
import {
  departmentsFromIndicators,
  exportSummary,
  filterIndicatorsByDepartment,
  groupExportByDepartment,
  type ExportIndicator,
  type ExportScope,
} from '@/lib/questionnaire/export-questionnaire';
import { downloadQuestionnaireExcel } from '@/lib/questionnaire/export-questionnaire-excel';
import { downloadQuestionnairePdf } from '@/lib/questionnaire/export-questionnaire-pdf';

type Props = {
  indicators: ExportIndicator[];
};

export default function ExportQuestionnairePanel({ indicators }: Props) {
  const [scope, setScope] = useState<ExportScope>('all');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const allDepartments = useMemo(() => departmentsFromIndicators(indicators), [indicators]);

  const scopedIndicators = useMemo(() => {
    if (scope === 'department' && departmentId) {
      return filterIndicatorsByDepartment(indicators, Number(departmentId));
    }
    return indicators;
  }, [indicators, scope, departmentId]);

  const selectedDepartmentName = useMemo(() => {
    if (!departmentId) return undefined;
    return allDepartments.find((d) => d.id === Number(departmentId))?.name;
  }, [allDepartments, departmentId]);

  const summary = useMemo(() => exportSummary(scopedIndicators), [scopedIndicators]);

  const unitBundles = useMemo(
    () => (scope === 'all' ? groupExportByDepartment(indicators, allDepartments) : []),
    [scope, indicators, allDepartments],
  );

  const canExport = scopedIndicators.length > 0 && (scope === 'all' || Boolean(departmentId));

  const exportExcel = () => {
    if (!canExport) return;
    setExporting('excel');
    try {
      downloadQuestionnaireExcel({
        scope,
        unitName: selectedDepartmentName,
        indicators: scope === 'department' ? scopedIndicators : indicators,
        departments: allDepartments,
      });
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (!canExport) return;
    setExporting('pdf');
    try {
      await downloadQuestionnairePdf({
        scope,
        unitName: selectedDepartmentName,
        unitId: departmentId ? Number(departmentId) : undefined,
        indicators: scope === 'department' ? scopedIndicators : indicators,
        departments: allDepartments,
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h6 className="fw-bold text-primary mb-1 d-flex align-items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
          Export Questionnaire
        </h6>
        <p className="text-muted small mb-0">
          Download printable PDF or Excel packs for unit heads — one file per unit, or a single unit only.
        </p>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="border rounded-3 p-3 h-100">
            <Form.Label className="small fw-bold mb-2">Export scope</Form.Label>
            <div className="d-flex flex-column gap-2 mb-3">
              <Form.Check
                type="radio"
                id="export-scope-all"
                name="exportScope"
                label="All units — PDF & Excel grouped by unit/department"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
              />
              <Form.Check
                type="radio"
                id="export-scope-dept"
                name="exportScope"
                label="Single unit / department"
                checked={scope === 'department'}
                onChange={() => setScope('department')}
              />
            </div>

            {scope === 'department' && (
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold mb-1">Select unit</Form.Label>
                <Form.Select
                  size="sm"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">— Choose unit —</option>
                  {allDepartments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}

            <div className="d-flex flex-wrap gap-2 mt-4">
              <Button
                variant="outline-danger"
                size="sm"
                className="fw-bold d-flex align-items-center gap-1"
                disabled={!canExport || exporting !== null}
                onClick={() => void exportPdf()}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>picture_as_pdf</span>
                {exporting === 'pdf' ? 'Generating PDF…' : 'Export PDF'}
              </Button>
              <Button
                variant="outline-success"
                size="sm"
                className="fw-bold d-flex align-items-center gap-1"
                disabled={!canExport || exporting !== null}
                onClick={exportExcel}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>table</span>
                {exporting === 'excel' ? 'Generating Excel…' : 'Export Excel'}
              </Button>
            </div>

            {scope === 'department' && !departmentId && (
              <p className="text-muted small mt-3 mb-0">Select a unit to enable export.</p>
            )}
          </div>
        </div>

        <div className="col-lg-5">
          <div className="border rounded-3 p-3 bg-light bg-opacity-50 h-100">
            <div className="small fw-bold text-uppercase text-muted mb-2" style={{ letterSpacing: '0.04em' }}>
              What you get
            </div>
            {canExport ? (
              <>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <Badge bg="primary" style={{ background: 'var(--mubs-blue)' }}>
                    {summary.indicatorCount} indicator{summary.indicatorCount !== 1 ? 's' : ''}
                  </Badge>
                  <Badge bg="secondary">{summary.metricCount} metrics</Badge>
                  {scope === 'all' && (
                    <Badge bg="light" className="text-dark border">{unitBundles.length} unit{unitBundles.length !== 1 ? 's' : ''}</Badge>
                  )}
                </div>
                <ul className="small text-muted mb-0 ps-3">
                  {scope === 'all' ? (
                    <>
                      <li>PDF — one section per unit (new page each)</li>
                      <li>Excel — one worksheet per unit</li>
                    </>
                  ) : (
                    <>
                      <li>PDF — formatted for <strong>{selectedDepartmentName}</strong> only</li>
                      <li>No repeated unit labels on every indicator</li>
                    </>
                  )}
                  <li>Targets shown in table header (gold row under each year)</li>
                  <li>Empty year columns for handwritten or typed entries</li>
                </ul>
              </>
            ) : (
              <p className="small text-muted mb-0">
                {indicators.length === 0
                  ? 'Create indicators first, then return here to export.'
                  : 'Choose a scope above to export.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
