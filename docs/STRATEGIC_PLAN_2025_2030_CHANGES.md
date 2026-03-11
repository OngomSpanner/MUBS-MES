# Strategic Plan 2025-2030 – System Alignment

## Summary

The 2025-2030 plan defines **4 Key Strategic Pillars** and **4 Core Objectives**. The system has been updated so that activities and proposals use these consistently.

---

## 1. Key Strategic Pillars (these replace the previous set)

The system uses **only** these four pillars. The old set (Teaching & Learning, Research & Innovation, Governance, Infrastructure, Partnerships) has been removed from the app and migration maps existing data to the new pillars.

| Pillar | Focus |
|--------|--------|
| **Research, Innovation & Community Engagement** | Centres of Excellence, research hubs, PDM and national programmes |
| **Equity & Social Safeguards** | CSR, PWDs, disadvantaged groups, environmental protection |
| **Human Capital & Sustainability** | Staff development, succession planning, commercial arm, endowment fund |
| **Partnerships & Internationalisation** | Industry-academia links, International Office, global benchmarking |

---

## 2. Core Objectives (new tagging for activities)

| Core objective | Description |
|----------------|-------------|
| **Digital Advancement** | Digital excellence, MUBS Digital Space, blended learning |
| **Academic Quality** | Relevant, skilled graduates for a changing business environment |
| **Infrastructure Investment** | Modern infrastructure for a world-class learning environment |
| **Governance & Accountability** | Ethical management and results-oriented strategy implementation |

---

## 3. Changes made in the system

### 3.1 Constants (`lib/strategic-plan.ts`)

- `STRATEGIC_PILLARS_2025_2030` – array of the 4 pillars.
- `CORE_OBJECTIVES_2025_2030` – array of the 4 core objectives.
- Use these everywhere for dropdowns and filters so labels stay in one place.

### 3.2 Database

- **Migration:** `public/migrations/strategic_plan_2025_2030.sql`
  - Maps old pillar values to the new 4 pillars.
  - Changes `strategic_activities.pillar` enum to the new pillars.
  - Adds `strategic_activities.core_objective` (VARCHAR 120, nullable).

**Run the migration** (after backup):

```bash
mysql -u your_user -p your_database < public/migrations/strategic_plan_2025_2030.sql
```

If `core_objective` already exists, skip or comment out the last `ALTER TABLE ... ADD COLUMN core_objective`.

### 3.3 Application

- **Activities API** – reads/writes `pillar` and `core_objective`; pillar values are the new 4.
- **Create Activity modal** – pillar dropdown uses the 4 new pillars; new “Core Objective” dropdown uses the 4 core objectives.
- **Committee proposal form** – pillar dropdown uses the 4 new pillars.
- **Strategic Summary (Principal)** – pillar filter uses the 4 new pillars.
- **Other views** (e.g. Department Strategic Activities) – show whatever pillar/value the API returns (no hardcoded old list).

---

## 4. Suggested optional enhancements

1. **Reporting** – Add reports or dashboards grouped by pillar and by core objective.
2. **Committee proposals** – If `committee_proposals` still has `pillar_id`, consider a small lookup table for the 4 pillars and link to it, or store pillar name (VARCHAR) aligned with `STRATEGIC_PILLARS_2025_2030`.
3. **Help text** – On “Strategic Pillar” and “Core Objective” dropdowns, add short descriptions (e.g. from the tables above) so users choose correctly.
4. **Labels** – Use `PILLAR_LABELS` from `lib/strategic-plan.ts` in tight spaces (e.g. table columns) and full names in forms and filters.
