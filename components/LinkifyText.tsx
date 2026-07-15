'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { cleanSdsDisplayText, isLongSdsText } from '@/lib/sds/clean-text';

function trimUrl(url: string): string {
  return url.replace(/[),.;:!]+$/g, '');
}

function labelForUrl(url: string, precedingHint?: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.toLowerCase();
    const hint = (precedingHint || '').toLowerCase();

    if (host.includes('unche') || /nche|cbet|competence/i.test(hint)) {
      return 'NCHE CBET standards (PDF)';
    }
    if (host.includes('mak.ac.ug') && (/quality/i.test(path) || /quality assurance/i.test(hint))) {
      return 'Mak Quality Assurance Policy';
    }
    if (host.includes('mak.ac.ug') && (/academic/i.test(path) || /academic policies/i.test(hint))) {
      return 'Mak Academic Policies Manual';
    }
    if (path.endsWith('.pdf')) return `${host} (PDF)`;
    return host;
  } catch {
    return 'Open document';
  }
}

type LinkPiece = { type: 'text'; value: string } | { type: 'link'; url: string; label: string };

/** Split prose + URLs. URLs never remain as visible text. */
export function splitLinkedText(text: string | null | undefined): LinkPiece[] {
  const raw = cleanSdsDisplayText(text);
  if (!raw) return [];

  const pieces: LinkPiece[] = [];
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  let cursor = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(raw)) !== null) {
    const full = m[0];
    const url = trimUrl(full);
    const before = raw.slice(cursor, m.index);

    // Short title immediately before URL (max ~80 chars) as hint only — not the visible dump
    const hintMatch = before.match(/([A-Za-z][\s\S]{0,80}?)\s*$/);
    const hint = hintMatch ? hintMatch[1].trim() : '';

    // Drop trailing incomplete PDF crumbs like "(CBE (2026)" before the URL
    const prose = before.replace(/\(\s*CBE\b[^)]*$/i, '(CBET)').replace(/\s+$/g, ' ');
    if (prose.trim()) pieces.push({ type: 'text', value: prose });

    pieces.push({ type: 'link', url, label: labelForUrl(url, hint || prose) });

    const trailing = full.slice(url.length);
    if (trailing) pieces.push({ type: 'text', value: trailing });
    cursor = m.index + full.length;
  }

  if (cursor < raw.length) {
    const rest = raw.slice(cursor).replace(/^\s+/, ' ');
    if (rest.trim()) pieces.push({ type: 'text', value: rest });
  }
  return pieces;
}

export function linkifyPlainText(text: string | null | undefined): ReactNode {
  const pieces = splitLinkedText(text);
  if (!pieces.length) return null;

  return (
    <>
      {pieces.map((p, i) =>
        p.type === 'text' ? (
          <span key={`t-${i}`}>{p.value}</span>
        ) : (
          <a
            key={`a-${i}`}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="fw-semibold text-decoration-underline mx-1"
            style={{ color: 'var(--mubs-blue)', wordBreak: 'normal' }}
          >
            {p.label}
          </a>
        ),
      )}
    </>
  );
}

export function LinkifyText({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text) return null;
  return <span className={className}>{linkifyPlainText(text)}</span>;
}

type ExpandableProps = {
  label: string;
  text: string | null | undefined;
  previewChars?: number;
  className?: string;
};

/** Preview (no raw URLs) + View more modal with full linked text. */
export function ExpandableSdsText({
  label,
  text,
  previewChars = 220,
  className,
}: ExpandableProps) {
  const [open, setOpen] = useState(false);
  const cleaned = cleanSdsDisplayText(text);
  const pieces = useMemo(() => splitLinkedText(cleaned), [cleaned]);
  if (!cleaned) return null;

  const links = pieces.filter((p): p is Extract<LinkPiece, { type: 'link' }> => p.type === 'link');
  const proseOnly = pieces
    .filter((p): p is Extract<LinkPiece, { type: 'text' }> => p.type === 'text')
    .map((p) => p.value)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  const long = isLongSdsText(proseOnly, previewChars) || links.length > 0;
  const previewProse = proseOnly.length > previewChars
    ? `${proseOnly.slice(0, previewChars).trim()}…`
    : proseOnly;

  return (
    <>
      <div className={className}>
        <span className="fw-semibold">{label}: </span>
        <span>{previewProse || (links.length ? 'See linked policies.' : '')}</span>
        {links.length > 0 && (
          <span className="d-inline-flex flex-wrap gap-1 align-items-center ms-1">
            {links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="badge text-decoration-none"
                style={{
                  background: '#e8f1f8',
                  color: 'var(--mubs-blue)',
                  border: '1px solid #c5d8e8',
                  fontWeight: 600,
                }}
              >
                {l.label}
              </a>
            ))}
          </span>
        )}
        {long && (
          <>
            {' '}
            <Button
              variant="link"
              size="sm"
              className="p-0 align-baseline"
              style={{ color: 'var(--mubs-blue)', fontSize: 'inherit' }}
              onClick={() => setOpen(true)}
            >
              View more
            </Button>
          </>
        )}
      </div>

      <Modal show={open} onHide={() => setOpen(false)} centered scrollable size="lg">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">{label}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="small" style={{ lineHeight: 1.55 }}>
          <LinkifyText text={cleaned} />
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="outline-secondary" onClick={() => setOpen(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
