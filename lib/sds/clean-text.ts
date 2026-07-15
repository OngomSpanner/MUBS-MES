/** Strip PDF extract artifacts and collapse noise in SDS text fields. */
export function cleanSdsDisplayText(raw: string | null | undefined): string {
  let s = String(raw || '');
  if (!s) return '';

  // Page break markers dumped into the extract file
  s = s.replace(/=====PAGE\s*\d+=====/gi, ' ');
  // Lone page-number lines that leak from PDF (e.g. "30" before "ii)")
  s = s.replace(/(?:^|\s)\d{1,3}(?=\s+(?:\(?[ivxlc]+\)|[ivxlc]+\))\s)/gi, ' ');

  // Quality fields must not include Process / Coverage / Frequency tails
  s = s.replace(/\bProcess\s*:[\s\S]*$/i, '').trim();
  s = s.replace(/\bCoverage\s*:[\s\S]*$/i, '').trim();
  s = s.replace(/\bFrequency\s*:[\s\S]*$/i, '').trim();
  // Beneficiary / methodology tails that leaked across PDF page breaks
  s = s.replace(/\s+All\s+(?:staff|students|newly|prospective|continuing|enrolled)\b[\s\S]*$/i, '').trim();
  s = s.replace(/\s+-(?:Published|Accredited|Staff list|Via )\b[\s\S]*$/i, '').trim();
  s = s.replace(/\s+Online and physical\b[\s\S]*$/i, '').trim();

  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\s*\n\s*/g, ' ');
  return s.trim();
}

/** True when text is long enough to warrant a "View more" control. */
export function isLongSdsText(raw: string | null | undefined, limit = 280): boolean {
  return cleanSdsDisplayText(raw).length > limit;
}
