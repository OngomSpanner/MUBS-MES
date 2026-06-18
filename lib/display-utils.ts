export function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

export function formatReadableName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '—') return trimmed;
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return trimmed;
}

export function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function hasDisplayValue(value: string | number | null | undefined): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  return s !== '' && s !== '—';
}
