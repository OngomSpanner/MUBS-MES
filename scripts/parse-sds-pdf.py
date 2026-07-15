#!/usr/bin/env python3
"""Parse Chapter 3 SDS matrix text into data/sds_standards_from_pdf.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTRACT = ROOT / "data" / "sds_pdf_extract.txt"
OUT = ROOT / "data" / "sds_standards_from_pdf.json"

PILLARS = [
    "Teaching, Learning and Student Success",
    "Infrastructure Development and Digital Transformation",
    "Research, Innovation, Employability and Community Engagement",
    "Equity, Inclusivity and Social Safeguards",
    "Human Capital, Governance, and Institutional Sustainability",
    "Partnerships, Collaborations and Internationalisation",
]
PILLAR_BY_ABBREV = {
    "TLSS": PILLARS[0],
    "IDDT": PILLARS[1],
    "R&I": PILLARS[2],
    "RI": PILLARS[2],
    "EISG": PILLARS[3],
    "HCG": PILLARS[4],
    "PCI": PILLARS[5],
}

STOP_FIELD = r"(?:Standard\s+Owner|Supporting\s+Units?:|Pathway:|User\s+Fee:|Purpose:|Objectives|Table\s*3:|Standard\s+Code|Standard\s+Title)"


def normalize_code(raw: str) -> str:
    s = re.sub(r"\s*/\s*", "/", (raw or "").strip())
    s = re.sub(r"(?<=\w)\s+(?=\w)", "", s)
    return s.replace(" ", "")


def clean_space(s: str) -> str:
    s = s or ""
    s = re.sub(r"=====PAGE\s*\d+=====", " ", s, flags=re.I)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\s*\n\s*", " ", s)
    return s.strip(" \n\t-–—")


def scrub_pdf_noise(s: str) -> str:
    """Remove extract artifacts and leaked Process/Coverage tails from quality-like text."""
    s = clean_space(s)
    if not s:
        return s
    # Hard stop before process/coverage/frequency if they leaked in
    s = re.split(r"\bProcess\s*:", s, maxsplit=1, flags=re.I)[0]
    s = re.split(r"\bCoverage\s*:", s, maxsplit=1, flags=re.I)[0]
    s = re.split(r"\bFrequency\s*:", s, maxsplit=1, flags=re.I)[0]
    # Stop before next-row PI markers that leak across page breaks
    s = re.split(
        r"\s+(?:\(?[ivxlc]+\)|[ivxlc]+\))\s+(?:No\.|Number|%|Aver\.?|Average)\b",
        s,
        maxsplit=1,
        flags=re.I,
    )[0]
    # Beneficiary / access tails that sit between Quality and a delayed Process:
    s = re.split(
        r"\s+All\s+(?:staff|students|newly|prospective|continuing|enrolled)\b",
        s,
        maxsplit=1,
        flags=re.I,
    )[0]
    s = re.split(r"\s+-(?:Published|Accredited|Staff list|Via )\b", s, maxsplit=1, flags=re.I)[0]
    s = re.split(r"\s+Online and physical\b", s, maxsplit=1, flags=re.I)[0]
    return clean_space(s)


def parse_code_meta(code: str) -> dict:
    parts = [p for p in code.split("/") if p]
    pillar_abbrev = parts[3] if len(parts) >= 6 else None
    owner_abbrev = parts[4] if len(parts) >= 6 else None
    pillar_num = objective_num = None
    for p in parts:
        m = re.match(r"^P(\d+)$", p, re.I)
        if m:
            pillar_num = int(m.group(1))
        m = re.match(r"^OBJ(\d+)$", p, re.I)
        if m:
            objective_num = int(m.group(1))
    pillar = PILLAR_BY_ABBREV.get(pillar_abbrev or "")
    if not pillar and pillar_num and 1 <= pillar_num <= len(PILLARS):
        pillar = PILLARS[pillar_num - 1]
    return {
        "pillar": pillar,
        "pillar_code": f"P{pillar_num}" if pillar_num else pillar_abbrev,
        "objective_code": f"OBJ{objective_num}" if objective_num else None,
        "owner_code": owner_abbrev,
    }


def take_field(block: str, label: str, stops: list[str]) -> str | None:
    pat = rf"{label}\s*(.*?)(?={'|'.join(stops)}|$)"
    m = re.search(pat, block, re.I | re.S)
    if not m:
        return None
    return clean_space(m.group(1)) or None


def extract_objectives(block: str) -> list[str]:
    m = re.search(
        rf"Objectives?\s*(.*?)(?=Table\s*3:|Output\s|Performance Indicator|Quality:|Process:|Coverage:|{STOP_FIELD}|$)",
        block,
        re.I | re.S,
    )
    if not m:
        return []
    body = m.group(1)
    items = re.findall(r"(?:\(?[ivx]+\)|[ivx]+\)|\d+[.)]|[-•])\s*([^\n]+)", body, re.I)
    out = [clean_space(x) for x in items if clean_space(x)]
    if out:
        return out
    return [clean_space(x) for x in re.findall(r"To\s+[^.]+\.", body)]


def extract_labeled_blocks(block: str, label: str) -> list[str]:
    parts = re.split(rf"\b{label}:\s*", block, flags=re.I)
    out = []
    for p in parts[1:]:
        cut = re.split(
            r"\b(?:Quality|Process|Coverage|Frequency|Access Criteria|Target beneficiary|Table\s*3:|Standard Code|Standard Title|User Fee|Purpose|Objectives)\b",
            p,
            maxsplit=1,
            flags=re.I,
        )
        text = clean_space(cut[0])
        if text and len(text) > 8:
            out.append(text)
    return out


def extract_pis(text: str) -> list[str]:
    """Pull roman / lettered performance indicators from a blob."""
    items = re.findall(
        r"(?:\(?[ivxlc]+\)|[ivxlc]+\)|\([a-z]\)|[a-z]\))\s*([^\n(]+?)(?=\s*(?:\(?[ivxlc]+\)|[ivxlc]+\)|\([a-z]\)|[a-z]\)|Quality:|Process:|Coverage:|Frequency:|$))",
        text,
        re.I,
    )
    cleaned = []
    for x in items:
        t = clean_space(x)
        t = re.sub(r"\s*(?:Quality|Process|Coverage|Frequency)\s*:.*$", "", t, flags=re.I).strip()
        t = re.sub(r"\s*https?://\S+", "", t).strip()
        if len(t) >= 8 and not t.lower().startswith(("quality", "process", "coverage", "frequency", "adherence", "conformance")):
            # Prefer KPI-looking phrases
            if re.search(r"\b(No\.|Number|%|Aver|Rate|Reach)\b|increase|satisfact|enquir|application|programme|session|school|partner|employer|student", t, re.I):
                cleaned.append(t)
            elif len(t) <= 160:
                cleaned.append(t)
    if cleaned:
        # de-dupe preserving order
        seen = set()
        out = []
        for c in cleaned:
            key = c.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(c)
        return out
    hits = re.findall(r"((?:No\.|Number|%|Aver\.?|Average|Rate)\s+[^.]+)", text, re.I)
    return [clean_space(h) for h in hits if len(clean_space(h)) >= 8]


def split_description_and_pis(preamble: str) -> tuple[str, str]:
    """
    Find the output heading which owns the PI list.

    PDF table columns often continue on the next page.  In that case the
    previous row's trailing PIs can appear before the next output heading.
    Selecting the last heading immediately followed by ``i)`` avoids attaching
    those orphaned items to the following output.
    """
    heading = None
    for match in re.finditer(r"(?m)^\s*([^\n]{6,240}?)\s*\n\s*((?:\(?i\)|i\))\s+)", preamble, re.I):
        candidate = clean_space(match.group(1))
        if (
            candidate
            and not re.search(r"^(?:Table|Quality|Process|Coverage|Frequency)\b", candidate, re.I)
            and not re.match(r"^(?:\(?[ivxlc]+\)|[ivxlc]+\))\s+", candidate, re.I)
        ):
            heading = (candidate, match.start(2))

    if heading:
        desc, pi_start = heading
        return desc, preamble[pi_start:]

    first_pi = re.search(r"(?:\(?i\)|i\))\s+", preamble, flags=re.I)
    if first_pi:
        return scrub_pdf_noise(preamble[: first_pi.start()]), preamble[first_pi.start() :]
    return scrub_pdf_noise(preamble), preamble


def extract_matrix_rows(block: str) -> list[dict]:
    """
    Rebuild matrix rows from flattened PDF text.
    Anchor on Quality: labels; preamble holds Output Service Description + PIs.
    Also harvest PIs that PDF extract shoved between Quality and Process (page breaks).
    """
    table_idx = re.search(r"Table\s*3[:.]?\d*", block, re.I)
    section = block[table_idx.start() :] if table_idx else block
    section = re.sub(
        r"Table\s*3[:.]?\d*:?[^\n]*Output Service Description Performance Indicator[^\n]*",
        "\n",
        section,
        count=1,
        flags=re.I,
    )

    markers = list(re.finditer(r"\bQuality:\s*", section, flags=re.I))
    if not markers:
        return []

    rows: list[dict] = []
    for i, m in enumerate(markers):
        row_start = markers[i - 1].end() if i else 0
        preamble = section[row_start : m.start()]
        rest = section[m.end() : markers[i + 1].start() if i + 1 < len(markers) else len(section)]

        qm = re.match(r"(.*?)(?=\bProcess:|\bCoverage:|\bFrequency:|$)", rest, re.I | re.S)
        quality_text = scrub_pdf_noise(qm.group(1) if qm else rest) or None
        # Drop PI fragments that leaked into quality text
        if quality_text:
            quality_text = re.split(
                r"\s+(?:\(?[ivxlc]+\)|[ivxlc]+\))\s+(?:No\.|%|Aver|Rate)\b",
                quality_text,
                maxsplit=1,
                flags=re.I,
            )[0].strip() or None

        process = scrub_pdf_noise(
            take_field(rest, r"Process:", [r"Coverage:", r"Frequency:", r"Quality:", r"$"]) or ""
        ) or None
        coverage = scrub_pdf_noise(
            take_field(rest, r"Coverage:", [r"Frequency:", r"Process:", r"Quality:", r"$"]) or ""
        ) or None
        frequency = scrub_pdf_noise(
            take_field(rest, r"Frequency:", [r"Process:", r"Quality:", r"Coverage:", r"$"]) or ""
        ) or None

        after_freq = ""
        fm = re.search(r"\bFrequency:\s*", rest, re.I)
        if fm:
            after_freq = scrub_pdf_noise(rest[fm.end() :])
            after_freq = re.split(r"\bQuality:", after_freq or "", maxsplit=1, flags=re.I)[0]
            after_freq = scrub_pdf_noise(after_freq)

        # Retain newlines here: they distinguish a new output title from PI
        # fragments carried over from the preceding page/row.
        desc, pi_blob = split_description_and_pis(preamble)

        desc = re.sub(r"^(?:Coverage|Frequency)\s*:\s*", "", desc or "", flags=re.I)
        desc = scrub_pdf_noise(desc)
        # Prefer a short title-like description (first sentence / line)
        if desc and len(desc) > 160:
            # keep first clause before a long policy dump
            cut = re.split(r"\s+https?://|\s+Adherence\b|\s+Conformance\b", desc, maxsplit=1, flags=re.I)[0]
            if len(cut) >= 8:
                desc = scrub_pdf_noise(cut)

        if not desc or len(desc) < 6 or desc.startswith("Output row"):
            # try last non-empty short line-ish chunk
            chunks = [c.strip() for c in re.split(r"\s{2,}|\n", preamble) if c.strip()]
            for c in reversed(chunks):
                cc = scrub_pdf_noise(re.sub(r"(?:\(?[ivxlc]+\)|[ivxlc]+\))\s*.*$", "", c, flags=re.I))
                if cc and 8 <= len(cc) <= 120 and not re.search(r"https?://", cc):
                    desc = cc
                    break
            if not desc or len(desc) < 6:
                desc = f"Output row {i + 1}"

        # PIs from preamble + any shoved between Quality and Process (common across page breaks)
        between = ""
        pm = re.search(r"\bProcess\s*:", rest, re.I)
        if pm:
            between = rest[: pm.start()]
        else:
            between = qm.group(1) if qm else ""

        pis = extract_pis(pi_blob) + extract_pis(between)
        # Also catch trailing PI lines that appear after process but look like KPI continuations
        # e.g. "...applications. iv) Reach and engagement..."
        # Do not let PIs belonging to the next output leak backwards when its
        # title/first PI was pushed to the following page.
        late_text = re.split(
            r"(?m)^\s*[^\n]{6,240}?\s*\n\s*(?:\(?i\)|i\))\s+",
            rest,
            maxsplit=1,
            flags=re.I,
        )[0]
        late = extract_pis(late_text)
        for p in late:
            if p not in pis and re.search(r"\b(Reach|engagement|marketing|enquir|application|satisfact)\b", p, re.I):
                pis.append(p)

        # de-dupe
        seen = set()
        uniq_pis = []
        for p in pis:
            k = p.lower()
            if k in seen:
                continue
            seen.add(k)
            uniq_pis.append(p)

        rows.append(
            {
                "sequence": i + 1,
                "service_description": desc[:240],
                "performance_indicators": uniq_pis,
                "quality_standard": quality_text,
                "process_text": process,
                "coverage": coverage,
                "frequency": frequency,
                "target_beneficiary": (after_freq[:500] if after_freq else None),
            }
        )
    return rows


CODE_RE = re.compile(
    r"(?:Standard\s+Code\.?:?\s*)?(MUBS\s*/\s*P\s*\d+\s*/\s*OBJ\s*\d+\s*/\s*[^/\n]+?\s*/\s*[^/\n]+?\s*/\s*S\s*\d+)",
    re.I,
)


def main() -> None:
    raw = EXTRACT.read_text(encoding="utf-8", errors="ignore")
    # Drop page markers early so they never embed in field text
    raw = re.sub(r"=====PAGE\s*\d+=====", "\n", raw, flags=re.I)
    start = raw.find("3.4 Detailed Service Delivery Standards Matrix")
    body = raw[start:] if start >= 0 else raw

    matches = list(CODE_RE.finditer(body))
    print("code hits", len(matches))

    parsed = []
    for i, m in enumerate(matches):
        code = normalize_code(m.group(1))
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        start_i = max(0, m.start() - 120)
        block = body[start_i:end]

        title = take_field(
            block,
            r"(?:Standard Title:|Standard Name:|Key Service Area:)",
            [r"Standard Owner", r"Supporting Units?:", r"Pathway:", r"User Fee:", r"Purpose:", r"Objectives"],
        )
        if title:
            title = re.sub(r"\s+Standard\s*$", "", title, flags=re.I).strip()

        owner = take_field(
            block,
            r"Standard Owner(?:\(s\))?:",
            [r"Supporting Units?:", r"Pathway:", r"User Fee:", r"Purpose:", r"Objectives"],
        )
        supporting = take_field(
            block,
            r"Supporting Units?:",
            [r"Pathway:", r"User Fee:", r"Purpose:", r"Objectives", r"Standard Code"],
        )
        pathway = take_field(
            block,
            r"Pathway:",
            [r"User Fee:", r"Purpose:", r"Objectives", r"Table\s*3:"],
        )
        user_fee = take_field(
            block,
            r"User Fee:",
            [r"Purpose:", r"Objectives", r"Pathway:", r"Table\s*3:"],
        )
        purpose = take_field(
            block,
            r"Purpose:",
            [r"Objectives", r"Table\s*3:", r"Output Service", r"Performance Indicator"],
        )
        objectives = extract_objectives(block)
        matrix_rows = extract_matrix_rows(block)
        processes = [r["process_text"] for r in matrix_rows if r.get("process_text")] or extract_labeled_blocks(
            block, "Process"
        )
        qualities = [r["quality_standard"] for r in matrix_rows if r.get("quality_standard")] or extract_labeled_blocks(
            block, "Quality"
        )
        coverages = [r["coverage"] for r in matrix_rows if r.get("coverage")] or extract_labeled_blocks(
            block, "Coverage"
        )
        frequencies = [r["frequency"] for r in matrix_rows if r.get("frequency")] or extract_labeled_blocks(
            block, "Frequency"
        )

        meta = parse_code_meta(code)
        parsed.append(
            {
                "code": code,
                "title": title or f"SDS {code}",
                "owner_label": owner,
                "supporting_units": supporting,
                "pathway": pathway,
                "user_fee": user_fee,
                "purpose": purpose,
                "objectives": objectives,
                **meta,
                "matrix_rows": matrix_rows,
                "matrix_process_blocks": processes,
                "matrix_quality_blocks": qualities,
                "matrix_coverage_blocks": coverages,
                "matrix_frequency_blocks": frequencies,
            }
        )

    best: dict[str, dict] = {}
    for p in parsed:
        key = p["code"]
        prev = best.get(key)
        score = (
            (20 if p.get("title") and not str(p["title"]).startswith("SDS ") else 0)
            + (10 if p.get("purpose") else 0)
            + (5 if p.get("pathway") else 0)
            + len(p.get("matrix_rows") or []) * 3
            + len(p.get("matrix_process_blocks") or [])
            + len(p.get("objectives") or [])
        )
        if not prev:
            best[key] = {**p, "_score": score}
            continue
        if score >= prev.get("_score", 0):
            merged = {**prev, **{k: v for k, v in p.items() if v}}
            merged["_score"] = score
            for list_key in (
                "objectives",
                "matrix_rows",
                "matrix_process_blocks",
                "matrix_quality_blocks",
                "matrix_coverage_blocks",
                "matrix_frequency_blocks",
            ):
                if len(p.get(list_key) or []) > len(prev.get(list_key) or []):
                    merged[list_key] = p[list_key]
            best[key] = merged

    result = [{k: v for k, v in x.items() if k != "_score"} for x in best.values()]
    result.sort(key=lambda x: x.get("code") or "")
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"standards": len(result), "out": str(OUT)}, indent=2))
    for x in result[:5]:
        rows = x.get("matrix_rows") or []
        pis = sum(len(r.get("performance_indicators") or []) for r in rows)
        print(
            "-",
            x["code"],
            "|",
            (x.get("title") or "")[:56],
            "| rows",
            len(rows),
            "| pis",
            pis,
        )


if __name__ == "__main__":
    main()
