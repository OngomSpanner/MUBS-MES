'use client';

import { useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import {
  AMBASSADOR_GROUP_LABELS,
  AMBASSADOR_GROUP_ORDER,
  AMBASSADOR_GROUP_TITLES,
  countAmbassadorDepartmentsByGroup,
  filterDepartmentsByGroup,
  type AmbassadorDepartmentGroup,
} from '@/lib/department-ambassador-groups';

export type DepartmentUnitOption = {
  id: number;
  name: string;
  parent_id: number | null;
  unit_type: string;
  ambassador_group?: AmbassadorDepartmentGroup | null;
};

type Props = {
  departments: DepartmentUnitOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  label?: string;
  emptyHint?: string;
  showGroupChips?: boolean;
};

const GROUP_ORDER = AMBASSADOR_GROUP_ORDER;

export default function DepartmentUnitMultiSelect({
  departments,
  selectedIds,
  onChange,
  label = 'Department(s) / Unit(s)',
  emptyHint = 'No departments selected yet.',
  showGroupChips = true,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [activeSearchGroup, setActiveSearchGroup] = useState<AmbassadorDepartmentGroup | null>(null);

  const groupCounts = useMemo(
    () => countAmbassadorDepartmentsByGroup(departments),
    [departments],
  );

  const searchableDepartments = useMemo(() => {
    if (activeSearchGroup) return filterDepartmentsByGroup(departments, activeSearchGroup);
    return departments;
  }, [activeSearchGroup, departments]);

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return searchableDepartments
      .filter((d) => d.name.toLowerCase().includes(term))
      .slice(0, 8);
  }, [searchTerm, searchableDepartments]);

  const addUnit = (id: number) => {
    if (!selectedIds.includes(id)) onChange([...selectedIds, id]);
    setSearchTerm('');
    setShowResults(false);
  };

  const addGroup = (group: AmbassadorDepartmentGroup) => {
    const ids = filterDepartmentsByGroup(departments, group).map((d) => d.id);
    onChange(Array.from(new Set([...selectedIds, ...ids])));
    setSearchTerm('');
    setShowResults(false);
  };

  const toggleSearchGroup = (group: AmbassadorDepartmentGroup) => {
    setActiveSearchGroup((prev) => (prev === group ? null : group));
    setSearchTerm('');
  };

  const removeUnit = (id: number) => {
    onChange(selectedIds.filter((i) => i !== id));
  };

  return (
    <div className="col-12">
      <Form.Label className="fw-bold small d-flex justify-content-between align-items-center mb-1">
        <span>{label}</span>
        <span className="text-muted fw-normal" style={{ fontSize: '0.65rem' }}>
          Ambassador units only · search to add
        </span>
      </Form.Label>

      {showGroupChips ? (
        <div className="d-flex flex-wrap gap-1 mb-2">
          {GROUP_ORDER.map((group) => {
            const count = groupCounts[group];
            if (count === 0) return null;
            const active = activeSearchGroup === group;
            return (
              <span key={group} className="d-inline-flex">
                <button
                  type="button"
                  className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => toggleSearchGroup(group)}
                  style={
                    active
                      ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)', borderTopRightRadius: 0, borderBottomRightRadius: 0 }
                      : { fontSize: '0.72rem', borderTopRightRadius: 0, borderBottomRightRadius: 0 }
                  }
                  title={AMBASSADOR_GROUP_TITLES[group]}
                >
                  {AMBASSADOR_GROUP_LABELS[group]}
                  <span className="ms-1 opacity-75">({count})</span>
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => addGroup(group)}
                  style={
                    active
                      ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)', fontSize: '0.72rem', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: 0 }
                      : { fontSize: '0.72rem', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: 0 }
                  }
                  title={`Add all ${count} in this group`}
                >
                  +
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="position-relative mb-2">
        <Form.Control
          type="text"
          placeholder={
            activeSearchGroup
              ? `Search within ${AMBASSADOR_GROUP_LABELS[activeSearchGroup]}…`
              : 'Search ambassador departments / units…'
          }
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
                key={res.id}
                type="button"
                className="btn btn-white w-100 text-start px-2 py-1 border-bottom small d-flex justify-content-between align-items-center"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addUnit(res.id)}
              >
                <span className="small">{res.name}</span>
                {selectedIds.includes(res.id) ? (
                  <span className="badge bg-secondary opacity-75">Added</span>
                ) : null}
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
