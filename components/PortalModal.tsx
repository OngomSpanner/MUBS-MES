'use client';

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type PortalModalProps = {
  show: boolean;
  onHide: () => void;
  children: ReactNode;
  zIndex?: number;
  /** Click backdrop to close (default true). */
  backdropDismiss?: boolean;
  backdropStyle?: CSSProperties;
};

const DEFAULT_BACKDROP: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.55)',
  backdropFilter: 'blur(3px)',
};

/**
 * Full-viewport modal shell (backdrop + dialog layer) portaled to document.body.
 * Use instead of inline modal-backdrop inside .content-area so the overlay covers sidebar + topbar.
 */
export default function PortalModal({
  show,
  onHide,
  children,
  zIndex = 1050,
  backdropDismiss = true,
  backdropStyle,
}: PortalModalProps) {
  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  if (!show || typeof document === 'undefined') return null;

  const backdropZ = zIndex - 1;

  return createPortal(
    <>
      <div
        className="modal-backdrop fade show"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: backdropZ,
          ...DEFAULT_BACKDROP,
          ...backdropStyle,
        }}
        onClick={backdropDismiss ? onHide : undefined}
        aria-hidden="true"
      />
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        style={{ zIndex }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
