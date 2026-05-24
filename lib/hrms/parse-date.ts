const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

/** Parse HRMS date strings to YYYY-MM-DD or null */
export function parseHrmsDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const dmy = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (dmy) {
    const mon = MONTHS[dmy[2].toLowerCase()];
    if (!mon) return null;
    const day = dmy[1].padStart(2, '0');
    return `${dmy[3]}-${mon}-${day}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

export function normalizeHrmsEmail(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const email = String(value).replace(/\s+/g, '').trim().toLowerCase();
  if (!email || !email.includes('@')) return null;
  return email;
}
