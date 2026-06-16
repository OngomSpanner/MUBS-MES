'use client';
import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

interface Props {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void;
  title: string;
  /** If set, shows response count warning and requires the user to type DELETE */
  responseCount?: number;
  /** Simple mode: just a confirm/cancel (no type-to-confirm) */
  simple?: boolean;
  itemDescription?: string;
  loading?: boolean;
}

export default function DeleteConfirmModal({
  show, onHide, onConfirm, title, responseCount, simple, itemDescription, loading,
}: Props) {
  const [typed, setTyped] = useState('');
  const requiresTyping = !simple && typeof responseCount === 'number' && responseCount > 0;
  const canConfirm = !requiresTyping || typed.trim() === 'DELETE';

  const handleHide = () => { setTyped(''); onHide(); };
  const handleConfirm = () => { if (!canConfirm) return; setTyped(''); onConfirm(); };

  return (
    <Modal show={show} onHide={handleHide} centered size="sm">
      <Modal.Header closeButton className="py-2" style={{ background: '#fff2f2', borderBottom: '1px solid #fecaca' }}>
        <Modal.Title className="fw-bold fs-6 d-flex align-items-center gap-2" style={{ color: '#b91c1c' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>warning</span>
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {requiresTyping ? (
          <>
            <div className="alert alert-danger py-2 px-3 mb-3" style={{ fontSize: '0.82rem', borderRadius: '8px' }}>
              <strong>{responseCount} response{responseCount !== 1 ? 's' : ''} submitted</strong> will be permanently deleted.
              {itemDescription && <div className="mt-1 text-muted">{itemDescription}</div>}
            </div>
            <p className="small mb-2">Type <strong>DELETE</strong> to confirm:</p>
            <Form.Control
              size="sm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type DELETE here"
              autoFocus
              style={{ borderColor: typed === 'DELETE' ? '#16a34a' : undefined }}
            />
          </>
        ) : (
          <p className="mb-0" style={{ fontSize: '0.85rem' }}>
            {itemDescription || 'This action cannot be undone. Are you sure?'}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer className="py-2 gap-2">
        <Button size="sm" variant="outline-secondary" onClick={handleHide} disabled={loading}>Cancel</Button>
        <Button
          size="sm"
          variant="danger"
          onClick={handleConfirm}
          disabled={!canConfirm || loading}
        >
          {loading ? 'Deleting…' : 'Delete'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
