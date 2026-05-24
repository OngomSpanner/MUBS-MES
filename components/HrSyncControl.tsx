'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProgressBar } from 'react-bootstrap';
import axios from 'axios';

const BATCH_SIZE = 50;
const DEFAULT_CHANGED_DAYS = 7;

type HrSyncStatus = {
  lastSyncLabel: string;
  nextMonthlySyncLabel: string;
  monthlySyncInProgress?: boolean;
};

type SyncErrorDetail = { query: string; message: string };

interface HrSyncControlProps {
  onSynced?: () => void;
}

export default function HrSyncControl({ onSynced }: HrSyncControlProps) {
  const [status, setStatus] = useState<HrSyncStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [errors, setErrors] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const runIdRef = useRef<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await axios.get<HrSyncStatus>('/api/hr/sync/status');
      setStatus(data);
    } catch {
      /* not HR admin */
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 45_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const runBatched = async () => {
    let offset = 0;
    let batchUpdated = 0;
    let batchErrors = 0;

    for (;;) {
      const res = await axios.post('/api/hr/sync', {
        scope: 'database',
        offset,
        limit: BATCH_SIZE,
        dryRun: false,
        onlyChanged: true,
        changedSinceDays: DEFAULT_CHANGED_DAYS,
      });

      const { summary, pagination } = res.data;
      const batchTotal = Number(pagination.total) || 0;
      setTotal(batchTotal);

      const batchErrList: SyncErrorDetail[] = Array.isArray(summary.errors) ? summary.errors : [];
      batchUpdated += summary.updated ?? 0;
      batchErrors += batchErrList.length;
      setUpdated(batchUpdated);
      setErrors(batchErrors);

      const nextProcessed = Math.min(
        (pagination.offset ?? 0) + (pagination.processed ?? 0),
        batchTotal
      );
      setProcessed(nextProcessed);

      if (pagination.nextOffset == null) break;
      offset = pagination.nextOffset;
    }

    return { updated: batchUpdated, errors: batchErrors };
  };

  const startSync = async () => {
    if (running || status?.monthlySyncInProgress) return;

    setRunning(true);
    setProcessed(0);
    setTotal(0);
    setUpdated(0);
    setErrors(0);
    setMessage(null);

    let finalUpdated = 0;
    let finalErrors = 0;

    try {
      const logRes = await axios.post('/api/hr/sync/run-log', { action: 'start', runType: 'manual' });
      runIdRef.current = logRes.data?.runId ?? null;

      const result = await runBatched();
      finalUpdated = result.updated;
      finalErrors = result.errors;

      await fetchStatus();
      setMessage(
        finalErrors > 0
          ? `Sync done — ${finalUpdated} updated, ${finalErrors} error(s).`
          : `Sync done — ${finalUpdated} updated.`
      );
      onSynced?.();
    } catch (err) {
      const data = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string; detail?: string })
        : null;
      setMessage(data?.detail || data?.message || 'HR sync failed');
    } finally {
      setRunning(false);
      try {
        await axios.post('/api/hr/sync/run-log', {
          action: 'complete',
          runId: runIdRef.current,
          updated: finalUpdated,
          skippedNotInHr: 0,
          errorCount: finalErrors,
        });
      } catch {
        /* ignore */
      }
      runIdRef.current = null;
    }
  };

  const progressPct = total > 0 ? Math.round((processed / total) * 100) : running ? 5 : 0;
  const busy = running || status?.monthlySyncInProgress;
  const lastSync = status?.lastSyncLabel ?? '—';

  return (
    <div className="d-flex align-items-center gap-2 flex-shrink-0">
      <span
        className="text-muted text-nowrap"
        style={{
          fontSize: '11px',
          maxWidth: '175px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={
          status
            ? `Last sync: ${status.lastSyncLabel}. Next automatic sync: ${status.nextMonthlySyncLabel} (last day of month)`
            : 'Last HR sync time'
        }
      >
        Last sync:{' '}
        <span className="text-secondary">
          {lastSync}
          {status?.monthlySyncInProgress ? ' (auto…)' : ''}
        </span>
      </span>

      {running && (
        <div style={{ width: 72 }}>
          <ProgressBar now={progressPct} style={{ height: 5 }} animated striped />
        </div>
      )}

      <button
        type="button"
        className="btn btn-sm btn-outline-primary text-nowrap"
        disabled={busy}
        onClick={startSync}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>sync</span>
        {running ? `${progressPct}%` : busy ? 'Syncing…' : 'Sync from HR System'}
      </button>

      {message && !running && (
        <span
          className={`text-nowrap ${errors > 0 ? 'text-warning' : 'text-success'}`}
          style={{ fontSize: '11px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}
          title={message}
        >
          {message}
        </span>
      )}
    </div>
  );
}
