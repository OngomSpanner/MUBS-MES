'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import StaffCourseUnitEnrollmentPanel from '@/components/Reports/StaffCourseUnitEnrollmentPanel';
import RecordActions from '@/components/Ambassador/reports/RecordActions';
import ViewRecordModal from '@/components/Ambassador/reports/ViewRecordModal';
import CourseUnitEnrollmentEntryModal, {
  type CourseUnitEnrollmentRecord,
} from '@/components/Ambassador/reports/CourseUnitEnrollmentEntryModal';
import AmbassadorReportViewToggle, { type AmbassadorTableView } from '@/components/Ambassador/reports/AmbassadorReportViewToggle';
import StatCard from '@/components/StatCard';

export default function AmbassadorCourseUnitEnrollmentPanel() {
  const [tableView, setTableView] = useState<AmbassadorTableView>('entries');
  const [records, setRecords] = useState<CourseUnitEnrollmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [viewRecord, setViewRecord] = useState<CourseUnitEnrollmentRecord | null>(null);
  const [editRecord, setEditRecord] = useState<CourseUnitEnrollmentRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [facultyFilter, setFacultyFilter] = useState('all');
  const [facultyOptions, setFacultyOptions] = useState<string[]>([]);

  useEffect(() => {
    axios
      .get('/api/enrollment/faculties')
      .then((res) => {
        const list = Array.isArray(res.data?.faculties) ? res.data.faculties : [];
        setFacultyOptions(list);
      })
      .catch(() => setFacultyOptions([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const params = facultyFilter !== 'all' ? `?faculty=${encodeURIComponent(facultyFilter)}` : '';
      const { data } = await axios.get(`/api/ambassador/reports/course-unit-enrollment${params}`);
      setRecords(data.records ?? []);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : null;
      setListError(msg || 'Could not load course unit enrollment entries.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [facultyFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const closeModal = () => {
    setModalMode(null);
    setEditRecord(null);
    setModalError(null);
  };

  const handleSave = async (payload: {
    facultyName: string;
    courseUnitName: string;
    totalStudents: number;
    maleCount: number;
    femaleCount: number;
    pwdCount: number;
  }) => {
    setSaving(true);
    setModalError(null);
    try {
      if (modalMode === 'edit' && editRecord) {
        await axios.patch(`/api/ambassador/reports/course-unit-enrollment/${editRecord.id}`, payload);
      } else {
        await axios.post('/api/ambassador/reports/course-unit-enrollment', payload);
      }
      closeModal();
      setTableView('entries');
      await load();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : null;
      setModalError(msg || 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: CourseUnitEnrollmentRecord) => {
    if (!window.confirm(`Delete enrollment data for "${record.courseUnitName}"?`)) return;
    try {
      await axios.delete(`/api/ambassador/reports/course-unit-enrollment/${record.id}`);
      await load();
    } catch {
      window.alert('Could not delete entry.');
    }
  };

  const stats = useMemo(() => {
    const totals = records.reduce(
      (acc, r) => ({
        students: acc.students + r.totalStudents,
        male: acc.male + r.maleCount,
        female: acc.female + r.femaleCount,
        pwd: acc.pwd + r.pwdCount,
      }),
      { students: 0, male: 0, female: 0, pwd: 0 }
    );
    return { courseUnits: records.length, ...totals };
  }, [records]);

  return (
    <div className="d-flex flex-column gap-3">
      {!loading && !listError && (
        <div className="row g-3">
          <div className="col-6 col-md-4 col-xl">
            <StatCard label="Course units" value={stats.courseUnits} color="blue" />
          </div>
          <div className="col-6 col-md-4 col-xl">
            <StatCard label="Total students" value={stats.students} color="green" />
          </div>
          <div className="col-6 col-md-4 col-xl">
            <StatCard label="Male / Female" value={`${stats.male} / ${stats.female}`} color="yellow" />
          </div>
          <div className="col-6 col-md-4 col-xl">
            <StatCard label="PwD students" value={stats.pwd} color="red" />
          </div>
        </div>
      )}

      <div className="table-card shadow-sm border-0 bg-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div className="p-4 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h5 className="mb-0 fw-bold">Course Unit Enrollment</h5>
            <p className="text-muted small mb-0 mt-1">
              {tableView === 'entries'
                ? 'Enter student counts per course unit (total, male, female, PwD).'
                : 'Filtered summary report (same view as admin reports).'}
            </p>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <select
              className="form-select form-select-sm"
              style={{ width: '180px' }}
              value={facultyFilter}
              onChange={(e) => setFacultyFilter(e.target.value)}
              aria-label="Filter by faculty"
            >
              <option value="all">All faculties</option>
              {facultyOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <AmbassadorReportViewToggle view={tableView} onChange={setTableView} summaryLabel="Summary report" />
            {tableView === 'entries' && (
              <button
                type="button"
                className="btn btn-primary btn-sm fw-bold px-3"
                style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                onClick={() => {
                  setModalError(null);
                  setEditRecord(null);
                  setModalMode('create');
                }}
              >
                <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: '18px' }}>
                  add
                </span>
                Add course unit
              </button>
            )}
          </div>
        </div>

        {tableView === 'entries' ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="px-4 py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                    FACULTY
                  </th>
                  <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                    COURSE UNIT
                  </th>
                  <th className="py-3 border-0 text-center" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                    TOTAL
                  </th>
                  <th className="py-3 border-0 text-center" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                    MALE
                  </th>
                  <th className="py-3 border-0 text-center" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                    FEMALE
                  </th>
                  <th className="py-3 border-0 text-center" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                    PWD
                  </th>
                  <th className="px-4 py-3 border-0 text-end" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4">
                      <div className="spinner-border text-primary" role="status" />
                    </td>
                  </tr>
                ) : listError ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <div className="alert alert-danger m-3 mb-3">{listError}</div>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted small">
                      No course unit enrollment data yet. Click <strong>Add course unit</strong> to enter data.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 small text-muted" style={{ fontSize: '.8rem' }}>
                        {r.facultyName}
                      </td>
                      <td className="fw-bold" style={{ fontSize: '.85rem' }}>
                        {r.courseUnitName}
                      </td>
                      <td className="text-center fw-semibold">{r.totalStudents}</td>
                      <td className="text-center">{r.maleCount}</td>
                      <td className="text-center">{r.femaleCount}</td>
                      <td className="text-center">{r.pwdCount}</td>
                      <td className="px-4">
                        <RecordActions
                          onView={() => setViewRecord(r)}
                          onEdit={() => {
                            setModalError(null);
                            setEditRecord(r);
                            setModalMode('edit');
                          }}
                          onDelete={() => handleDelete(r)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <StaffCourseUnitEnrollmentPanel facultyFilter={facultyFilter} hideFacultyFilter />
        )}
      </div>

      <CourseUnitEnrollmentEntryModal
        show={modalMode !== null}
        mode={modalMode === 'edit' ? 'edit' : 'create'}
        record={editRecord}
        saving={saving}
        error={modalError}
        onHide={closeModal}
        onSave={handleSave}
      />

      <ViewRecordModal
        show={!!viewRecord}
        title="Course unit enrollment"
        fields={
          viewRecord
            ? [
                { label: 'Faculty / school', value: viewRecord.facultyName },
                { label: 'Course unit', value: viewRecord.courseUnitName },
                { label: 'Total students', value: viewRecord.totalStudents },
                { label: 'Male', value: viewRecord.maleCount },
                { label: 'Female', value: viewRecord.femaleCount },
                { label: 'PwD', value: viewRecord.pwdCount },
              ]
            : []
        }
        onHide={() => setViewRecord(null)}
      />
    </div>
  );
}
