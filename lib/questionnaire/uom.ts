/** Unit of Measure types for questionnaire metrics. */

export const UOM_OPTIONS = [
  { value: 'numeric',    label: 'Numeric' },
  { value: 'ratio',      label: 'Ratio (X:Y)' },
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'currency',   label: 'Currency (UGX / USD)' },
  { value: 'text',       label: 'Text' },
  { value: 'list',       label: 'List / Name' },
] as const;

export type UomValue = (typeof UOM_OPTIONS)[number]['value'];

export function uomLabel(uom: string): string {
  return UOM_OPTIONS.find((o) => o.value === uom)?.label ?? uom;
}

/** Validation: returns error message or null if valid. */
export function validateMetricValue(value: string, uom: UomValue | string): string | null {
  const v = value.trim();
  if (!v) return null; // blank allowed during partial save; required check is separate

  switch (uom) {
    case 'numeric': {
      const n = Number(v.replace(/,/g, ''));
      if (!Number.isFinite(n) || n < 0) return 'Must be a positive number';
      return null;
    }
    case 'ratio': {
      if (!/^\d+(\.\d+)?\s*:\s*\d+(\.\d+)?$/.test(v)) return 'Format must be X:Y (e.g. 3:1)';
      return null;
    }
    case 'percentage': {
      const n = parseFloat(v.replace('%', '').trim());
      if (!Number.isFinite(n) || n < 0 || n > 100) return 'Must be a number 0–100';
      return null;
    }
    case 'currency': {
      const cleaned = v.replace(/^[A-Z$]{1,5}\s*/i, '').replace(/,/g, '');
      const n = Number(cleaned);
      if (!Number.isFinite(n) || n < 0) return 'Must be a valid positive amount';
      return null;
    }
    case 'text':
    case 'list':
      return null;
    default:
      return null;
  }
}

/** Placeholder hint per UoM for input fields. */
export function uomPlaceholder(uom: UomValue | string): string {
  switch (uom) {
    case 'numeric':    return 'e.g. 42';
    case 'ratio':      return 'e.g. 3:1';
    case 'percentage': return 'e.g. 75 or 75%';
    case 'currency':   return 'e.g. 5000000';
    case 'text':       return 'Enter text…';
    case 'list':       return 'Enter names or list…';
    default:           return 'Enter value…';
  }
}
