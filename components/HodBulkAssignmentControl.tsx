'use client';

import { useRef, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import axios from 'axios';

type AssignmentResult = {
  rowNumber: number;
  email: string;
  status: 'updated' | 'skipped' | 'error';
  message: string;
};

interface HodBulkAssignmentControlProps {
  onCompleted?: () => void;
}

export default function HodBulkAssignmentControl({ onCompleted }: HodBulkAssignmentControlProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [summaryMessage, setSummaryMessage] = useState('');
  const [results, setResults] = useState<AssignmentResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const downloadTemplate = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await axios.get('/api/users/hod-assignment-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'hod-role-assignment-template.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message || 'Could not download template'
        : 'Could not download template';
      setError(msg);
    } finally {
      setDownloading(false);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await axios.post('/api/users/bulk-hod-assignment', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSummaryMessage(data.message || 'Upload complete');
      setResults(Array.isArray(data.results) ? data.results : []);
      setShowResults(true);
      if (data.summary?.updated > 0) onCompleted?.();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message || 'Upload failed'
        : 'Upload failed';
      setError(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="d-none"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
        }}
      />
      <button
        type="button"
        className="btn btn-sm btn-outline-success fw-bold d-flex align-items-center gap-1"
        onClick={() => void downloadTemplate()}
        disabled={downloading || uploading}
        title="Download Excel template for bulk HOD / Unit Head assignment"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
        {downloading ? 'Downloading…' : 'HOD template'}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-success fw-bold d-flex align-items-center gap-1"
        onClick={() => fileRef.current?.click()}
        disabled={downloading || uploading}
        title="Upload filled Excel template"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload_file</span>
        {uploading ? 'Uploading…' : 'Bulk HOD upload'}
      </button>

      {error && (
        <div className="w-100 small text-danger fw-semibold mt-1">{error}</div>
      )}

      <Modal show={showResults} onHide={() => setShowResults(false)} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">Bulk HOD assignment results</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small mb-3">{summaryMessage}</p>
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={`${r.rowNumber}-${r.email}`}>
                    <td>{r.rowNumber}</td>
                    <td>{r.email}</td>
                    <td>
                      <span
                        className={`badge ${r.status === 'updated' ? 'bg-success' : r.status === 'error' ? 'bg-danger' : 'bg-secondary'}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="small">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowResults(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
