'use client';

import { useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';

export type DepartmentUnitOption = {
  id: number;
  name: string;
  parent_id: number | null;
  unit_type: string;
};

type Props = {
  departments: DepartmentUnitOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  label?: string;
  emptyHint?: string;
};

export default function DepartmentUnitMultiSelect({
  departments,
  selectedIds,
  onChange,
  label = 'Department(s) / Unit(s)',
  emptyHint = 'No departments selected yet.',
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);

  const departmentOptions = useMemo(
    () => departments.filter((d) => d.unit_type === 'department' || d.unit_type === 'unit'),
    [departments]
  );
  const facultyOfficeOptions = useMemo(
    () => departments.filter((d) => d.unit_type === 'faculty' || d.unit_type === 'office'),
    [departments]
  );

  const searchResults = useMemo(() => {
    if (searchTerm.trim() === '') return [];
    const term = searchTerm.toLowerCase();
    return [
      ...facultyOfficeOptions
        .filter((fo) => fo.name.toLowerCase().includes(term))
        .map((fo) => ({ ...fo, isGroup: true, subLabel: '' })),
      ...departmentOptions
        .filter((d) => d.name.toLowerCase().includes(term))
        .map((d) => {
          const parent = facultyOfficeOptions.find((p) => p.id === d.parent_id);
          return { ...d, isGroup: false, subLabel: parent ? parent.name : '' };
        }),
    ].slice(0, 8);
  }, [searchTerm, facultyOfficeOptions, departmentOptions]);

  const addUnit = (id: number) => {
    if (!selectedIds.includes(id)) onChange([...selectedIds, id]);
    setSearchTerm('');
    setShowResults(false);
  };

  const addByParent = (parentId: number) => {
    const childIds = departments.filter((d) => d.parent_id === parentId).map((d) => d.id);
    onChange(Array.from(new Set([...selectedIds, ...childIds])));
    setSearchTerm('');
    setShowResults(false);
  };

  const removeUnit = (id: number) => {
    onChange(selectedIds.filter((i) => i !== id));
  };

  return (
    <div className="col-12">
      <Form.Label className="fw-bold small d-flex justify-content-between align-items-center mb-1">
        <span>{label}</span>
        <span className="text-muted fw-normal" style={{ fontSize: '0.65rem' }}>
          Search to add
        </span>
      </Form.Label>

      <div className="position-relative mb-2">
        <Form.Control
          type="text"
          placeholder="Search departments / units..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onBlur={() => window.setTimeout(() => setShowResults(false), 150)}
          size="sm"
        />

        {showResults && searchResults.length > 0 ? (
          <div
            className="position-absolute w-100 bg-white border rounded shadow-sm mt-1 overflow-hidden"
            style={{ zIndex: 1050 }}
          >
            {searchResults.map((res) => (
              <button
                key={`${res.isGroup ? 'g' : 'u'}-${res.id}`}
                type="button"
                className="btn btn-white w-100 text-start px-2 py-1 border-bottom small d-flex justify-content-between align-items-center"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (res.isGroup ? addByParent(res.id) : addUnit(res.id))}
              >
                <span className="small">
                  {res.name}{' '}
                  {res.subLabel ? <span className="text-muted">({res.subLabel})</span> : null}
                </span>
                {res.isGroup ? <span className="badge bg-primary opacity-75">Add all</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="d-flex flex-wrap gap-2" style={{ maxHeight: '100px', overflowY: 'auto' }}>
        {selectedIds.map((id) => {
          const dept = departments.find((d) => d.id === id);
          return (
            <span
              key={id}
              className="badge bg-light text-primary border d-flex align-items-center gap-2 py-1 px-2"
            >
              {dept?.name || id}
              <span
                className="material-symbols-outlined p-0"
                style={{ fontSize: '14px', cursor: 'pointer' }}
                onClick={() => removeUnit(id)}
                role="button"
                aria-label="Remove"
              >
                close
              </span>
            </span>
          );
        })}
        {selectedIds.length === 0 ? <span className="text-muted small">{emptyHint}</span> : null}
      </div>
    </div>
  );
}
