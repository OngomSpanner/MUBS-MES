import { cleanSdsDisplayText } from '@/lib/sds/clean-text';

type NamedStep = { activity_name: string };

/** True when a service_description looks usable as human-readable output cover text. */
export function isSensibleOutputDescription(raw: string | null | undefined): boolean {
  const s = cleanSdsDisplayText(raw);
  if (!s || s.length < 8) return false;
  if (/^Output\b/i.test(s)) return false;
  if (/https?:\/\//i.test(s)) return false;
  if (/\(\s*\d+\s*wee/i.test(s)) return false; // truncated "(1 wee"
  if (/\([A-Za-z]{2,8}\s*\(\d/i.test(s)) return false; // "ACMI (1"
  if (/\b(adherence to|conformance to|compliance with|quality assurance policy)\b/i.test(s) && s.length > 70) {
    return false;
  }
  // Too many unfinished parentheses → truncated PDF scrape
  const open = (s.match(/\(/g) || []).length;
  const close = (s.match(/\)/g) || []).length;
  if (open > close + 1) return false;
  return true;
}

/**
 * Build a short, readable cover line for an SDS output.
 * Prefer a clean stored description; otherwise summarise from process activities
 * (those come from the CSV and are trustworthy).
 */
export function deriveOutputCover(
  serviceDescription: string | null | undefined,
  activities: NamedStep[] | null | undefined,
): string {
  if (isSensibleOutputDescription(serviceDescription)) {
    return cleanSdsDisplayText(serviceDescription);
  }

  const names = (activities || [])
    .map((a) => String(a.activity_name || '').trim())
    .filter(Boolean);

  if (!names.length) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} → ${names[1]}`;

  return `Process from “${names[0]}” through “${names[names.length - 1]}” (${names.length} steps)`;
}
