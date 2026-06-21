'use client';

import { useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import AmbassadorGroupBadgeChip from '@/components/AmbassadorGroupBadgeChip';
import {
  AMBASSADOR_GROUP_BADGE_LABELS,
  AMBASSADOR_GROUP_LABELS,
  AMBASSADOR_GROUP_ORDER,
  AMBASSADOR_GROUP_TITLES,
  countAmbassadorDepartmentsByGroup,
  filterDepartmentsByGroup,
  type AmbassadorDepartmentGroup,
  type AmbassadorDepartmentRow,
} from '@/lib/department-ambassador-groups';

export type AmbassadorDepartmentFilterMode = 'all' | 'group' | 'department';

export type AmbassadorDepartmentFilterValue = {
  mode: AmbassadorDepartmentFilterMode;
  group: AmbassadorDepartmentGroup | null;
  departmentId: number | null;
};

export const ALL_AMBASSADOR_DEPARTMENTS_FILTER: AmbassadorDepartmentFilterValue = {
  mode: 'all',
  group: null,
  departmentId: null,
};

type Props = {
  departments: AmbassadorDepartmentRow[];
  value: AmbassadorDepartmentFilterValue;
  onChange: (value: AmbassadorDepartmentFilterValue) => void;
  compact?: boolean;
  placeholder?: string;
};

const GROUP_ORDER = AMBASSADOR_GROUP_ORDER;

export function resolveAmbassadorDepartmentIds(
  departments: AmbassadorDepartmentRow[],
  value: AmbassadorDepartmentFilterValue,
): number[] | null {
  if (value.mode === 'all') return null;
  if (value.mode === 'department' && value.departmentId != null) {
    return [value.departmentId];
  }
  if (value.mode === 'group' && value.group) {
    return filterDepartmentsByGroup(departments, value.group).map((d) => d.id);
  }
  return null;
}

export default function AmbassadorDepartmentGroupFilter({
  departments,
  value,
  onChange,
  compact = false,
  placeholder = 'Search ambassador departments…',
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);

  const groupCounts = useMemo(
    () => countAmbassadorDepartmentsByGroup(departments),
    [departments],
  );

  const searchableDepartments = useMemo(() => {
    if (value.mode === 'group' && value.group) {
      return filterDepartmentsByGroup(departments, value.group);
    }
    return departments;
  }, [departments, value.group, value.mode]);

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return searchableDepartments
      .filter((d) => d.name.toLowerCase().includes(term))
      .slice(0, 8);
  }, [searchTerm, searchableDepartments]);

  const toggleGroup = (group: AmbassadorDepartmentGroup) => {
    if (value.mode === 'group' && value.group === group) {
      onChange(ALL_AMBASSADOR_DEPARTMENTS_FILTER);
      return;
    }
    onChange({ mode: 'group', group, departmentId: null });
    setSearchTerm('');
  };

  const selectDepartment = (id: number) => {
    onChange({ mode: 'department', group: null, departmentId: id });
    setSearchTerm('');
    setShowResults(false);
  };

  const selectedLabel = useMemo(() => {
    if (value.mode === 'department' && value.departmentId != null) {
      return departments.find((d) => d.id === value.departmentId)?.name ?? 'Selected department';
    }
    if (value.mode === 'group' && value.group) {
      const count = groupCounts[value.group];
      return `${AMBASSADOR_GROUP_LABELS[value.group]} (${count})`;
    }
    return 'All ambassador departments';
  }, [departments, groupCounts, value]);

  return (
    <div className={compact ? '' : 'w-100'}>
      <div className="d-flex flex-wrap align-items-center gap-1 mb-2">
        <AmbassadorGroupBadgeChip
          label="Clear"
          variant="clear"
          title="Clear filter and search"
          onClick={() => {
            onChange(ALL_AMBASSADOR_DEPARTMENTS_FILTER);
            setSearchTerm('');
            setShowResults(false);
          }}
        />
        <AmbassadorGroupBadgeChip
          label="All"
          active={value.mode === 'all'}
          title="Show all ambassador departments"
          onClick={() => onChange(ALL_AMBASSADOR_DEPARTMENTS_FILTER)}
        />
        {GROUP_ORDER.map((group) => {
          const count = groupCounts[group];
          if (count === 0) return null;
          const active = value.mode === 'group' && value.group === group;
          return (
            <AmbassadorGroupBadgeChip
              key={group}
              label={AMBASSADOR_GROUP_BADGE_LABELS[group]}
              count={count}
              active={active}
              title={`${AMBASSADOR_GROUP_TITLES[group]} — click to filter`}
              onClick={() => toggleGroup(group)}
            />
          );
        })}
      </div>

      <div className="position-relative" style={{ minWidth: compact ? '200px' : undefined }}>
        <Form.Control
          type="text"
          size="sm"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onBlur={() => window.setTimeout(() => setShowResults(false), 150)}
        />
        {value.mode !== 'all' ? (
          <div className="text-muted mt-1" style={{ fontSize: '0.62rem' }}>
            Showing: <span className="fw-semibold text-primary">{selectedLabel}</span>
          </div>
        ) : null}

        {showResults && searchResults.length > 0 ? (
          <div
            className="position-absolute w-100 bg-white border rounded shadow-sm mt-1 overflow-hidden"
            style={{ zIndex: 1050 }}
          >
            {searchResults.map((dept) => (
              <button
                key={dept.id}
                type="button"
                className="btn btn-white w-100 text-start px-2 py-1 border-bottom small"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectDepartment(dept.id)}
              >
                {dept.name}
                {dept.ambassador_group ? (
                  <span className="text-muted ms-1" style={{ fontSize: '0.65rem' }}>
                    ({AMBASSADOR_GROUP_BADGE_LABELS[dept.ambassador_group]})
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
