'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import StaffProgrammeEnrollmentPanel from '@/components/Reports/StaffProgrammeEnrollmentPanel';
import RecordActions from '@/components/Ambassador/reports/RecordActions';
import ViewRecordModal from '@/components/Ambassador/reports/ViewRecordModal';
import ProgrammeEnrollmentEntryModal, {
  type ProgrammeEnrollmentRecord,
} from '@/components/Ambassador/reports/ProgrammeEnrollmentEntryModal';
import AmbassadorReportViewToggle, { type AmbassadorTableView } from '@/components/Ambassador/reports/AmbassadorReportViewToggle';
import StatCard from '@/components/StatCard';

export default function AmbassadorProgrammeEnrollmentPanel() {
  const [tableView, setTableView] = useState<AmbassadorTableView>('entries');
  const [records, setRecords] = useState<ProgrammeEnrollmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [viewRecord, setViewRecord] = useState<ProgrammeEnrollmentRecord | null>(null);
  const [editRecord, setEditRecord] = useState<ProgrammeEnrollmentRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const { data } = await axios.get('/api/ambassador/reports/programme-enrollment');
      setRecords(data.records ?? []);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : null;
      setListError(msg || 'Could not load programme enrollment entries.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeModal = () => {
    setModalMode(null);
    setEditRecord(null);
    setModalError(null);
  };

  const handleSave = async (payload: {
    programmeName: string;
    totalStudents: number;
    maleCount: number;
    femaleCount: number;
    pwdCount: number;
    pwdDetails: string | null;
  }) => {
    setSaving(true);
    setModalError(null);
    try {
      if (modalMode === 'edit' && editRecord) {
        await axios.patch(`/api/ambassador/reports/programme-enrollment/${editRecord.id}`, payload);
      } else {
        await axios.post('/api/ambassador/reports/programme-enrollment', payload);
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

  const handleDelete = async (record: ProgrammeEnrollmentRecord) => {
    if (!window.confirm(`Delete enrollment data for "${record.programmeName}"?`)) return;
    try {
      await axios.delete(`/api/ambassador/reports/programme-enrollment/${record.id}`);
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
    return { programmes: records.length, ...totals };
  }, [records]);

  return (
    <div className="d-flex flex-column gap-3">
      {!loading && !listError && (
        <div className="row g-3">
          <div className="col-6 col-md-4 col-xl">
            <StatCard label="Programmes" value={stats.programmes} color="blue" />
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
            <h5 className="mb-0 fw-bold">Programme Enrollment</h5>
            <p className="text-muted small mb-0 mt-1">
              {tableView === 'entries'
                ? 'Enter student counts per programme (total, male, female, PwD).'
                : 'Filtered summary report (same view as admin reports).'}
            </p>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
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
                Add programme
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
                    PROGRAMME
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
                    <td colSpan={6} className="text-center py-4">
                      <div className="spinner-border text-primary" role="status" />
                    </td>
                  </tr>
                ) : listError ? (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <div className="alert alert-danger m-3 mb-3">{listError}</div>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted small">
                      No programme enrollment data yet. Click <strong>Add programme</strong> to enter data.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 fw-bold" style={{ fontSize: '.85rem' }}>
                        {r.programmeName}
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
          <StaffProgrammeEnrollmentPanel key={records.length} />
        )}
      </div>

      <ProgrammeEnrollmentEntryModal
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
        title="Programme enrollment"
        fields={
          viewRecord
            ? [
                { label: 'Programme', value: viewRecord.programmeName },
                { label: 'Total students', value: viewRecord.totalStudents },
                { label: 'Male', value: viewRecord.maleCount },
                { label: 'Female', value: viewRecord.femaleCount },
                { label: 'PwD', value: viewRecord.pwdCount },
                { label: 'PwD details', value: viewRecord.pwdDetails || '—' },
              ]
            : []
        }
        onHide={() => setViewRecord(null)}
      />
    </div>
  );
}
