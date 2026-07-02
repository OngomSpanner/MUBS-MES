import type { CSSProperties } from 'react';

/** Shared responsive column sizing for ambassador/HOD metric entry tables. */
export const METRIC_ENTRY_TABLE = {
  table: { fontSize: '0.8rem', width: '100%', marginBottom: 0 } satisfies CSSProperties,
  col: {
    metric: undefined as CSSProperties | undefined,
    unit: { width: '3.25rem' } satisfies CSSProperties,
    target: { width: '3.5rem' } satisfies CSSProperties,
    actual: { width: '6.5rem' } satisfies CSSProperties,
    comment: { width: '7.5rem' } satisfies CSSProperties,
  },
  th: {
    metric: { minWidth: '9rem' } satisfies CSSProperties,
    unit: {
      width: '3.25rem',
      maxWidth: '3.75rem',
      padding: '0.3rem 0.15rem',
      fontSize: '0.68rem',
      verticalAlign: 'middle',
    } satisfies CSSProperties,
    fy: {
      fontSize: '0.68rem',
      lineHeight: 1.15,
      padding: '0.3rem 0.15rem',
      verticalAlign: 'middle',
    } satisfies CSSProperties,
    fySub: { fontSize: '0.56rem' } satisfies CSSProperties,
    target: { width: '3.5rem', maxWidth: '4rem', background: '#334155' } satisfies CSSProperties,
    actual: { minWidth: '5.5rem' } satisfies CSSProperties,
    comment: { minWidth: '6rem', fontSize: '0.72rem' } satisfies CSSProperties,
  },
  td: {
    unit: {
      width: '3.25rem',
      maxWidth: '3.75rem',
      padding: '0.3rem 0.15rem',
      verticalAlign: 'middle',
      textAlign: 'center',
    } satisfies CSSProperties,
    target: {
      width: '3.5rem',
      maxWidth: '4rem',
      padding: '0.3rem 0.15rem',
      fontSize: '0.75rem',
      background: '#f1f5f9',
      textAlign: 'center',
      verticalAlign: 'middle',
    } satisfies CSSProperties,
    actual: { minWidth: '5.5rem', verticalAlign: 'middle' } satisfies CSSProperties,
    comment: { minWidth: '6rem', verticalAlign: 'middle' } satisfies CSSProperties,
    input: { fontSize: '0.78rem', width: '100%', minWidth: 0 } satisfies CSSProperties,
    badge: { fontSize: '0.55rem', lineHeight: 1.15, whiteSpace: 'normal' as const, wordBreak: 'break-word' as const },
  },
} as const;

/** Shorter unit label for narrow UNIT column. */
export function uomTableLabel(uom: string): string {
  switch (uom) {
    case 'numeric':
      return 'Num.';
    case 'ratio':
      return 'Ratio';
    case 'percentage':
      return '%';
    case 'currency':
      return 'UGX';
    case 'text':
      return 'Text';
    case 'list':
      return 'List';
    default:
      return uom;
  }
}
