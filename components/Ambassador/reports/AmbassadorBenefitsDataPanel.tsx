'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import StaffBenefitsPanel from '@/components/Reports/StaffBenefitsPanel';
import RecordActions from '@/components/Ambassador/reports/RecordActions';
import ViewRecordModal from '@/components/Ambassador/reports/ViewRecordModal';
import BenefitEntryModal, { type BenefitRecord, type ReportMeta } from '@/components/Ambassador/reports/BenefitEntryModal';
import AmbassadorReportViewToggle, { type AmbassadorTableView } from '@/components/Ambassador/reports/AmbassadorReportViewToggle';
import StatCard from '@/components/StatCard';

type ScopeProps = { scopeFaculty?: string | null; lockFaculty?: boolean };

export default function AmbassadorBenefitsDataPanel({ scopeFaculty, lockFaculty }: ScopeProps) {
  const [tableView, setTableView] = useState<AmbassadorTableView>('entries');
  const [records, setRecords] = useState<BenefitRecord[]>([]);
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [viewRecord, setViewRecord] = useState<BenefitRecord | null>(null);
  const [editRecord, setEditRecord] = useState<BenefitRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const [listRes, metaRes] = await Promise.all([
        axios.get('/api/ambassador/reports/benefits'),
        axios.get('/api/ambassador/reports/staff-options'),
      ]);
      setRecords(listRes.data.records ?? []);
      setMeta({
        years: metaRes.data.years ?? [],
        benefitTypes: metaRes.data.benefitTypes ?? [],
        staff: metaRes.data.staff ?? [],
      });
    } catch {
      setListError('Could not load benefit entries.');
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
    userId: number;
    financialYearKey: string;
    benefitType: string;
    received: boolean;
  }) => {
    setSaving(true);
    setModalError(null);
    try {
      if (modalMode === 'edit' && editRecord) {
        await axios.patch(`/api/ambassador/reports/benefits/${editRecord.id}`, payload);
      } else {
        await axios.post('/api/ambassador/reports/benefits', payload);
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

  const handleDelete = async (record: BenefitRecord) => {
    if (!window.confirm(`Delete benefit entry for ${record.staffName}?`)) return;
    try {
      await axios.delete(`/api/ambassador/reports/benefits/${record.id}`);
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

  const benefitStats = useMemo(() => {
    const staffIds = new Set(records.map((r) => r.userId));
    const received = records.filter((r) => r.received).length;
    const benefitTypes = new Set(records.map((r) => r.benefitType));
    const years = new Set(records.map((r) => r.financialYearKey));
    const departments = new Set(
      records.map((r) => r.departmentName).filter((d) => d && d !== '—')
    );
    return {
      entries: records.length,
      staffCovered: staffIds.size,
      received,
      benefitTypes: benefitTypes.size,
      financialYears: years.size,
      departments: departments.size,
      facultyStaff: meta?.staff?.length ?? 0,
    };
  }, [records, meta]);

  return (
    <div className="d-flex flex-column gap-3">
      {!loading && !listError && (
        <div className="row g-3">
          <div className="col-6 col-md-4 col-xl-2">
            <StatCard label="Benefit entries" value={benefitStats.entries} color="blue" />
          </div>
          <div className="col-6 col-md-4 col-xl-2">
            <StatCard label="Staff with entries" value={benefitStats.staffCovered} color="blue" />
          </div>
          <div className="col-6 col-md-4 col-xl-2">
            <StatCard label="Benefits received" value={benefitStats.received} color="green" />
          </div>
          <div className="col-6 col-md-4 col-xl-2">
            <StatCard label="Benefit types" value={benefitStats.benefitTypes} color="blue" />
          </div>
          <div className="col-6 col-md-4 col-xl-2">
            <StatCard label="Financial years" value={benefitStats.financialYears} color="yellow" />
          </div>
          <div className="col-6 col-md-4 col-xl-2">
            <StatCard label="Faculty staff (HR)" value={benefitStats.facultyStaff} color="green" />
          </div>
        </div>
      )}
      <div className="table-card shadow-sm border-0 bg-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div className="p-4 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h5 className="mb-0 fw-bold">Staff Benefits</h5>
            <p className="text-muted small mb-0 mt-1">
              {tableView === 'entries'
                ? 'Record which staff received benefits each financial year.'
                : 'Male, female, and PwD counts by benefit type and financial year.'}
            </p>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <AmbassadorReportViewToggle view={tableView} onChange={setTableView} entriesLabel="Benefit entries" />
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
                  <th className="px-4 py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>STAFF</th>
                  <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>DEPARTMENT</th>
                  <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>YEAR</th>
                  <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>BENEFIT</th>
                  <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>RECEIVED</th>
                  <th className="px-4 py-3 border-0 text-end" style={{ fontSize: '.7rem', fontWeight: 800 }}>ACTIONS</th>
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
                      No benefit entries yet. Click <strong>Add entry</strong> to record data for your faculty.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 fw-bold" style={{ fontSize: '.85rem' }}>{r.staffName}</td>
                      <td className="text-muted small">{r.departmentName}</td>
                      <td>{r.financialYearLabel}</td>
                      <td>{r.benefitLabel}</td>
                      <td>
                        <span
                          className={`badge ${r.received ? 'bg-success-subtle text-success border border-success' : 'bg-secondary-subtle text-secondary'}`}
                        >
                          {r.received ? 'Yes' : 'No'}
                        </span>
                      </td>
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
          <div className="p-0 border-0">
            <StaffBenefitsPanel scopeFaculty={scopeFaculty} lockFaculty={lockFaculty} embedded />
          </div>
        )}
      </div>

      <BenefitEntryModal
        show={modalMode !== null}
        mode={modalMode === 'edit' ? 'edit' : 'create'}
        record={editRecord}
        meta={meta}
        saving={saving}
        error={modalError}
        onHide={closeModal}
        onSave={handleSave}
      />

      <ViewRecordModal
        show={!!viewRecord}
        title="Benefit entry details"
        fields={
          viewRecord
            ? [
                { label: 'Staff', value: viewRecord.staffName },
                { label: 'Department', value: viewRecord.departmentName },
                { label: 'Financial year', value: viewRecord.financialYearLabel },
                { label: 'Benefit', value: viewRecord.benefitLabel },
                { label: 'Received', value: viewRecord.received },
              ]
            : []
        }
        onHide={() => setViewRecord(null)}
      />
    </div>
  );
}
