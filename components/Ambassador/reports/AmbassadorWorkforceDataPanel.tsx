'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import StaffWorkforceAssessmentsPanel from '@/components/Reports/StaffWorkforceAssessmentsPanel';
import RecordActions from '@/components/Ambassador/reports/RecordActions';
import ViewRecordModal from '@/components/Ambassador/reports/ViewRecordModal';
import WorkforceEntryModal, { type WorkforceRecord } from '@/components/Ambassador/reports/WorkforceEntryModal';
import AmbassadorReportViewToggle, { type AmbassadorTableView } from '@/components/Ambassador/reports/AmbassadorReportViewToggle';
import StatCard from '@/components/StatCard';

type ScopeProps = { managedUnitId?: number };

export default function AmbassadorWorkforceDataPanel({ managedUnitId }: ScopeProps) {
  const [tableView, setTableView] = useState<AmbassadorTableView>('entries');
  const [records, setRecords] = useState<WorkforceRecord[]>([]);
  const [years, setYears] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [viewRecord, setViewRecord] = useState<WorkforceRecord | null>(null);
  const [editRecord, setEditRecord] = useState<WorkforceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const [listRes, metaRes] = await Promise.all([
        axios.get('/api/ambassador/reports/workforce-assessments'),
        axios.get('/api/ambassador/reports/staff-options'),
      ]);
      setRecords(listRes.data.records ?? []);
      setYears(metaRes.data.years ?? []);
    } catch {
      setListError('Could not load workforce assessments.');
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
    assessmentDetail: string;
    financialYearKey: string;
    countValue: number;
  }) => {
    setSaving(true);
    setModalError(null);
    try {
      if (modalMode === 'edit' && editRecord) {
        await axios.patch(`/api/ambassador/reports/workforce-assessments/${editRecord.id}`, payload);
      } else {
        await axios.post('/api/ambassador/reports/workforce-assessments', payload);
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

  const handleDelete = async (record: WorkforceRecord) => {
    if (!window.confirm(`Delete "${record.assessmentDetail}" for ${record.financialYearLabel}?`)) return;
    try {
      await axios.delete(`/api/ambassador/reports/workforce-assessments/${record.id}`);
      await load();
    } catch {
      window.alert('Could not delete entry.');
    }
  };

  const openCreate = () => {
    setModalError(null);
    setEditRecord(null);
    setModalMode('create');
  };

  const workforceStats = useMemo(() => {
    const assessmentTypes = new Set(records.map((r) => r.assessmentDetail.trim()).filter(Boolean));
    const fyKeys = new Set(records.map((r) => r.financialYearKey));
    const totalStaffCount = records.reduce((sum, r) => sum + (r.countValue || 0), 0);
    return {
      entries: records.length,
      assessmentAreas: assessmentTypes.size,
      financialYears: fyKeys.size,
      totalStaffAssessed: totalStaffCount,
    };
  }, [records]);

  return (
    <div className="d-flex flex-column gap-3">
      {!loading && !listError && (
        <div className="row g-3">
          <div className="col-6 col-md-4 col-xl-3">
            <StatCard label="Assessment entries" value={workforceStats.entries} color="blue" />
          </div>
          <div className="col-6 col-md-4 col-xl-3">
            <StatCard label="Assessment areas" value={workforceStats.assessmentAreas} color="blue" />
          </div>
          <div className="col-6 col-md-4 col-xl-3">
            <StatCard label="Financial years" value={workforceStats.financialYears} color="yellow" />
          </div>
          <div className="col-6 col-md-4 col-xl-3">
            <StatCard label="Staff assessed (total)" value={workforceStats.totalStaffAssessed} color="green" />
          </div>
        </div>
      )}
      <div className="table-card shadow-sm border-0 bg-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div className="p-4 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h5 className="mb-0 fw-bold">Workforce Assessments</h5>
            <p className="text-muted small mb-0 mt-1">
              {tableView === 'entries'
                ? 'Enter assessment details and counts per financial year for your faculty.'
                : 'Assessment details with headcounts rolled up by financial year.'}
            </p>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <AmbassadorReportViewToggle view={tableView} onChange={setTableView} entriesLabel="Assessment entries" />
            {tableView === 'entries' && (
              <button
                type="button"
                className="btn btn-primary btn-sm fw-bold px-3"
                style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                onClick={openCreate}
              >
                <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: '18px' }}>
                  add
                </span>
                Add entry
              </button>
            )}
          </div>
        </div>

        {tableView === 'entries' ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="px-4 py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>ASSESSMENT DETAILS</th>
                  <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>FINANCIAL YEAR</th>
                  <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>COUNT</th>
                  <th className="px-4 py-3 border-0 text-end" style={{ fontSize: '.7rem', fontWeight: 800 }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-4">
                      <div className="spinner-border text-primary" role="status" />
                    </td>
                  </tr>
                ) : listError ? (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <div className="alert alert-danger m-3 mb-3">{listError}</div>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-muted small">
                      No workforce assessments yet. Click <strong>Add entry</strong> to add data.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 fw-bold" style={{ fontSize: '.85rem' }}>{r.assessmentDetail}</td>
                      <td>{r.financialYearLabel}</td>
                      <td className="fw-semibold">{r.countValue}</td>
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
          <StaffWorkforceAssessmentsPanel
            key={records.length}
            ambassadorManagedUnitId={managedUnitId}
            embedded
          />
        )}
      </div>

      <WorkforceEntryModal
        show={modalMode !== null}
        mode={modalMode === 'edit' ? 'edit' : 'create'}
        record={editRecord}
        years={years}
        saving={saving}
        error={modalError}
        onHide={closeModal}
        onSave={handleSave}
      />

      <ViewRecordModal
        show={!!viewRecord}
        title="Workforce assessment details"
        fields={
          viewRecord
            ? [
                { label: 'Assessment details', value: viewRecord.assessmentDetail },
                { label: 'Financial year', value: viewRecord.financialYearLabel },
                { label: 'Count', value: viewRecord.countValue },
              ]
            : []
        }
        onHide={() => setViewRecord(null)}
      />
    </div>
  );
}
