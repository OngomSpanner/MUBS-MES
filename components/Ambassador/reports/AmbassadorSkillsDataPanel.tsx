'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import StaffEmploymentSkillStatusPanel from '@/components/Reports/StaffEmploymentSkillStatusPanel';
import RecordActions from '@/components/Ambassador/reports/RecordActions';
import ViewRecordModal from '@/components/Ambassador/reports/ViewRecordModal';
import SkillsEntryModal, { type SkillsRecord } from '@/components/Ambassador/reports/SkillsEntryModal';
import AmbassadorReportViewToggle, { type AmbassadorTableView } from '@/components/Ambassador/reports/AmbassadorReportViewToggle';
import StatCard from '@/components/StatCard';

type ScopeProps = { managedUnitId?: number };

export default function AmbassadorSkillsDataPanel({ managedUnitId }: ScopeProps) {
  const [tableView, setTableView] = useState<AmbassadorTableView>('entries');
  const [records, setRecords] = useState<SkillsRecord[]>([]);
  const [years, setYears] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [viewRecord, setViewRecord] = useState<SkillsRecord | null>(null);
  const [editRecord, setEditRecord] = useState<SkillsRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const [listRes, metaRes] = await Promise.all([
        axios.get('/api/ambassador/reports/employment-skill-status'),
        axios.get('/api/ambassador/reports/staff-options'),
      ]);
      setRecords(listRes.data.records ?? []);
      setYears(metaRes.data.years ?? []);
    } catch {
      setListError('Could not load skills assessments.');
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
    financialYearKey: string;
    reportsProduced: number;
    skillsMissing: number;
  }) => {
    setSaving(true);
    setModalError(null);
    try {
      if (modalMode === 'edit' && editRecord) {
        await axios.patch(`/api/ambassador/reports/employment-skill-status/${editRecord.id}`, payload);
      } else {
        await axios.post('/api/ambassador/reports/employment-skill-status', payload);
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

  const handleDelete = async (record: SkillsRecord) => {
    if (!window.confirm(`Delete skills assessment for ${record.financialYearLabel}?`)) return;
    try {
      await axios.delete(`/api/ambassador/reports/employment-skill-status/${record.id}`);
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

  const skillsStats = useMemo(() => {
    const reportsProduced = records.reduce((sum, r) => sum + (r.reportsProduced || 0), 0);
    const skillsMissing = records.reduce((sum, r) => sum + (r.skillsMissing || 0), 0);
    const sorted = [...records].sort((a, b) => b.financialYearKey.localeCompare(a.financialYearKey));
    const latest = sorted[0];
    return {
      financialYears: records.length,
      reportsProduced,
      skillsMissing,
      latestYear: latest?.financialYearLabel ?? '—',
      latestReports: latest?.reportsProduced ?? 0,
      latestSkillsGap: latest?.skillsMissing ?? 0,
    };
  }, [records]);

  return (
    <div className="d-flex flex-column gap-3">
      {!loading && !listError && (
        <div className="row g-3">
          <div className="col-6 col-md-4 col-xl">
            <StatCard label="Financial years recorded" value={skillsStats.financialYears} color="blue" />
          </div>
          <div className="col-6 col-md-4 col-xl">
            <StatCard label="Reports produced (total)" value={skillsStats.reportsProduced} color="green" />
          </div>
          <div className="col-6 col-md-4 col-xl">
            <StatCard label="Skills missing (total)" value={skillsStats.skillsMissing} color="red" />
          </div>
          <div className="col-6 col-md-4 col-xl">
            <StatCard
              label={`Reports · ${skillsStats.latestYear}`}
              value={skillsStats.latestReports}
              color="yellow"
            />
          </div>
        </div>
      )}
      <div className="table-card shadow-sm border-0 bg-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div className="p-4 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h5 className="mb-0 fw-bold">Skills Assessments</h5>
            <p className="text-muted small mb-0 mt-1">
              {tableView === 'entries'
                ? 'Annual reports produced and skills missing counts for your unit.'
                : 'Reports produced and skills missing by financial year.'}
            </p>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <AmbassadorReportViewToggle view={tableView} onChange={setTableView} entriesLabel="Yearly records" />
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
                  <th className="px-4 py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>FINANCIAL YEAR</th>
                  <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>REPORTS PRODUCED</th>
                  <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>SKILLS MISSING</th>
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
                      No skills assessments yet. Click <strong>Add entry</strong> to add data.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 fw-bold" style={{ fontSize: '.85rem' }}>{r.financialYearLabel}</td>
                      <td className="fw-semibold">{r.reportsProduced}</td>
                      <td className="fw-semibold">{r.skillsMissing}</td>
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
          <StaffEmploymentSkillStatusPanel
            key={records.length}
            ambassadorManagedUnitId={managedUnitId}
            embedded
          />
        )}
      </div>

      <SkillsEntryModal
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
        title="Skills assessment details"
        fields={
          viewRecord
            ? [
                { label: 'Financial year', value: viewRecord.financialYearLabel },
                { label: 'Reports produced', value: viewRecord.reportsProduced },
                { label: 'Skills missing', value: viewRecord.skillsMissing },
              ]
            : []
        }
        onHide={() => setViewRecord(null)}
      />
    </div>
  );
}
