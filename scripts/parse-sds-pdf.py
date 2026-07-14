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
    s = re.sub(r"[ \t]+", " ", s or "")
    s = re.sub(r"\s*\n\s*", " ", s)
    return s.strip(" \n\t-–—")


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
        r"(?:\(?[ivxlc]+\)|[ivxlc]+\)|\([a-z]\)|[a-z]\))\s*([^\n(]+?)(?=\s*(?:\(?[ivxlc]+\)|[ivxlc]+\)|\([a-z]\)|[a-z]\)|$))",
        text,
        re.I,
    )
    cleaned = []
    for x in items:
        t = clean_space(x)
        t = re.sub(r"\s*Quality:.*$", "", t, flags=re.I).strip()
        if len(t) >= 8 and not t.lower().startswith(("quality", "process", "coverage", "frequency")):
            cleaned.append(t)
    if cleaned:
        return cleaned
    # fallback: No. of / % of sentences
    hits = re.findall(r"((?:No\.|Number|%|Aver\.?|Average)\s+of[^.]+)", text, re.I)
    return [clean_space(h) for h in hits if len(clean_space(h)) >= 8]


def extract_matrix_rows(block: str) -> list[dict]:
    """
    Rebuild matrix rows from flattened PDF text.
    Each row is anchored on a 'Quality:' label; preamble before it holds
    service description + performance indicators.
    """
    table_idx = re.search(r"Table\s*3[:.]?\d*", block, re.I)
    section = block[table_idx.start() :] if table_idx else block
    # Drop table header noise once
    section = re.sub(
        r"Table\s*3[:.]?\d*:?[^\n]*Output Service Description Performance Indicator[^\n]*",
        "\n",
        section,
        count=1,
        flags=re.I,
    )

    # Split keeping delimiters via finditer on Quality:
    markers = list(re.finditer(r"\bQuality:\s*", section, flags=re.I))
    if not markers:
        return []

    rows: list[dict] = []
    for i, m in enumerate(markers):
        row_start = markers[i - 1].end() if i else 0
        # For first row, skip leftover header fragments
        preamble = section[row_start : m.start()]
        rest = section[m.end() : markers[i + 1].start() if i + 1 < len(markers) else len(section)]

        # Pull Process / Coverage / Frequency from rest
        quality = take_field(rest, r"^", [r"Process:", r"Coverage:", r"Frequency:", r"$"])
        # Better: text until Process:
        qm = re.match(r"(.*?)(?=\bProcess:|\bCoverage:|\bFrequency:|$)", rest, re.I | re.S)
        quality_text = clean_space(qm.group(1) if qm else rest)

        process = take_field(rest, r"Process:", [r"Coverage:", r"Frequency:", r"Quality:", r"$"])
        coverage = take_field(rest, r"Coverage:", [r"Frequency:", r"Process:", r"Quality:", r"$"])
        frequency = take_field(rest, r"Frequency:", [r"Process:", r"Quality:", r"Coverage:", r"$"])

        # After frequency, leftover is often beneficiary / access / methodology / inputs (noisy)
        after_freq = ""
        fm = re.search(r"\bFrequency:\s*.*?(?=\n|$)", rest, re.I | re.S)
        if fm:
            after_freq = clean_space(rest[fm.end() :])
        # Cap after_freq to avoid swallowing next service description too much
        after_freq = re.split(r"\bQuality:", after_freq, maxsplit=1, flags=re.I)[0]

        # Preamble: service description + PIs
        pis = extract_pis(preamble)
        # Remove PI markers from description
        desc = preamble
        desc = re.sub(
            r"(?:\(?[ivxlc]+\)|[ivxlc]+\)|\([a-z]\)|[a-z]\))\s*[^\n(]+",
            " ",
            desc,
            flags=re.I,
        )
        desc = clean_space(desc)
        # Strip lingering Frequency/Coverage tails from previous row
        desc = re.sub(r"^(?:Coverage|Frequency)\s*:\s*", "", desc, flags=re.I)
        desc = re.sub(r"^.*?Frequency:\s*[^.]*\.\s*", "", desc, flags=re.I)
        desc = clean_space(desc)
        # Drop very short / garbage descriptions
        if len(desc) < 6:
            desc = f"Output row {i + 1}"

        rows.append(
            {
                "sequence": i + 1,
                "service_description": desc[:800],
                "performance_indicators": pis,
                "quality_standard": quality_text or None,
                "process_text": process,
                "coverage": coverage,
                "frequency": frequency,
                "target_beneficiary": after_freq[:500] or None,
            }
        )
    return rows


CODE_RE = re.compile(
    r"(?:Standard\s+Code\.?:?\s*)?(MUBS\s*/\s*P\s*\d+\s*/\s*OBJ\s*\d+\s*/\s*[^/\n]+?\s*/\s*[^/\n]+?\s*/\s*S\s*\d+)",
    re.I,
)


def main() -> None:
    raw = EXTRACT.read_text(encoding="utf-8", errors="ignore")
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
