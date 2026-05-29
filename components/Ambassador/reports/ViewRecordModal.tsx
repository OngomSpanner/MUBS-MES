'use client';

import { Modal, Button } from 'react-bootstrap';

export type ViewField = { label: string; value: string | number | boolean };

type ViewRecordModalProps = {
  show: boolean;
  title: string;
  fields: ViewField[];
  onHide: () => void;
};

export default function ViewRecordModal({ show, title, fields, onHide }: ViewRecordModalProps) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="modal-header-mubs">
        <Modal.Title className="fw-bold d-flex align-items-center gap-2">
          <span className="material-symbols-outlined">info</span>
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <dl className="mb-0">
          {fields.map((f) => (
            <div key={f.label} className="row mb-2">
              <dt className="col-sm-5 text-muted small">{f.label}</dt>
              <dd className="col-sm-7 mb-0 fw-semibold text-dark small">
                {typeof f.value === 'boolean' ? (f.value ? 'Yes' : 'No') : String(f.value)}
              </dd>
            </div>
          ))}
        </dl>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
